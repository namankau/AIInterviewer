# Production observability

InterviewOS writes newline-delimited JSON to standard output using Spring Boot's
built-in Logstash formatter. The application does not need a proprietary logging
SDK or another logging dependency.

For production, use this open-source path:

```text
API stdout -> Grafana Alloy -> Grafana Loki -> Grafana dashboards and alerts
```

Alloy should be deployed next to the application by the hosting platform and should
forward the container's stdout to Loki. Keep only stable, low-cardinality values such
as `service`, `environment`, and `level` as Loki labels. Fields such as `session_id`,
`request_id`, and `turn_index` must remain JSON fields; promoting them to labels will
create unbounded cardinality.

The exact Alloy discovery block depends on whether production uses Docker,
Kubernetes, or a host service manager, so it belongs in the deployment repository
once that target is selected. The application-side log contract below does not change.

## Configuration

Production requires no setting: `LOGGING_STRUCTURED_FORMAT_CONSOLE` defaults to
`logstash`. Set it to a Spring Boot-supported format only when the log collector
requires a different format.

Every API response includes `X-Request-ID`. A valid incoming value is preserved so a
reverse proxy or frontend can correlate its own logs; otherwise the API creates a UUID.
The identifier is also present as `request_id` in every log written during the request.

## Interview speech events

| `event` | Meaning | Important fields |
| --- | --- | --- |
| `question_speech_started` | Server started generating question audio | `session_id`, `turn_index`, `provider` |
| `question_speech_finished` | Server persisted a terminal audio state | previous fields, `duration_ms`, `status` |
| `question_speech_failed` | AI or storage failed; the browser should fall back to local speech | previous fields, `duration_ms`, `error_type` |
| `question_speech_state_write_failed` | Terminal state could not be persisted; polling may time out | `session_id`, `turn_index`, `status`, `error_type` |
| `interview_client_failure` | Browser reported a local speech or model-audio failure | `event_type`, `session_id`, `turn_index`, optional `duration_ms` |
| `http_request_completed` | One API request completed | `request_id`, `request_method`, `request_path`, `status`, `duration_ms` |

`interview_client_failure.event_type` is a server-controlled vocabulary:

- `browser_speech_failed`
- `browser_speech_timed_out`
- `question_audio_poll_timed_out`
- `model_audio_play_rejected`
- `model_audio_error`
- `model_audio_stalled`
- `model_audio_timed_out`

Browser reporting is best effort. A closed tab, lost network connection, or crashed
browser can prevent the event from reaching the API; the client recovery still runs.

## Incident lookup

Support should first resolve the candidate's email and approximate time to a session
UUID in the database. Email must not be used as a log field. Then query Loki by that
UUID and expand the time window a few minutes on either side.

Example LogQL (adapt the stable stream labels to the deployment):

```logql
{service="interviewos-api", environment="production"}
  | json
  | session_id = "SESSION_UUID"
```

For a silent interviewer, inspect events in this order:

1. Find the last `question_speech_started` for the session and turn.
2. Confirm it has a matching `question_speech_finished`. A missing terminal event
   suggests process termination; `question_speech_state_write_failed` identifies a
   failed database update.
3. If the terminal status is `unavailable`, inspect `question_speech_failed` and its
   `provider`, `duration_ms`, and `error_type`.
4. If the status is `ready`, inspect `interview_client_failure` for polling, playback,
   or local browser-speech timeouts.
5. Use the nearby `request_id` to correlate HTTP failures without searching on personal
   data.

Create alerts after production traffic establishes a baseline. Useful first signals
are any `question_speech_state_write_failed`, a sustained rise in
`question_speech_failed`, and a sustained rise in each client `event_type`. Avoid alerting
on a single browser playback error because user gesture policies and device audio changes
can cause isolated failures.

## Privacy contract

Application logs may contain opaque identifiers needed for diagnosis: `session_id`,
`request_id`, `turn_index`, provider, timings, status, and exception type. They must not
contain email addresses, names, résumé contents, question or transcript text, audio,
authorization headers, signed storage URLs, or arbitrary client-provided messages.

The client-event endpoint enforces session ownership and accepts only the fixed event
names above plus bounded numeric fields. New fields or events require the same privacy
review before they are added.

Restrict Grafana and Loki access to operators, place authentication in front of Loki,
use encrypted transport, and configure a retention period appropriate for production.
