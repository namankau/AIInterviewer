# Handoff — 2026-09-29

## Task
Diagnose why the mock interviewer can stop speaking after 5–7 minutes and add production-ready, privacy-safe open-source observability (direct owner report; no task file).

## What I built
- Fixed `apps/api/src/main/kotlin/com/interviewos/interview/QuestionSpeech.kt` so background question-speech failures, including failures wrapped by parallel `CompletableFuture.join()` calls, always move audio from `pending` to terminal `unavailable` instead of silently abandoning the worker.
- Added browser-speech and generated-audio watchdogs in `apps/web/src/lib/browser-speech.ts`, `apps/web/src/hooks/use-browser-voice.ts`, and `apps/web/src/hooks/use-question-audio.ts`. Speech completion timeouts, model-audio errors, stalls, and absolute playback timeouts now recover the room to listening rather than leaving it stuck.
- Added privacy-safe speech lifecycle reporting through `apps/api/src/main/kotlin/com/interviewos/interview/InterviewTelemetry.kt`: an authenticated, ownership-checked endpoint accepts only a fixed event vocabulary and bounded numeric fields. It rejects free-form content and does not log emails, questions, transcripts, resumes, or audio.
- Added request correlation through `X-Request-ID`, MDC `request_id`, structured HTTP completion events, CORS support for the correlation header, and Spring Boot's built-in Logstash JSON console format.
- Added focused backend and frontend regression coverage for failed parallel TTS chunks, telemetry validation and ownership, request correlation, browser-speech completion timeout, generated-audio polling timeout, and model-audio playback recovery.
- Added `docs/observability.md`, covering the open-source production path Spring Boot JSON stdout → Grafana Alloy → Loki → Grafana, privacy boundaries, incident investigation by session and turn, useful LogQL queries, and launch alert candidates.

## Assumptions I made
- There is no intentional five-minute interview or speech cutoff; the traced code contains no such timer. The observed timing is consistent with a later turn encountering one of the unhandled lifecycle failures.
- The exact historical session for `naman.kaushik06@gmail.com` cannot be attributed conclusively because the old system did not record browser speech/playback lifecycle events. I fixed two deterministic paths that reproduce the same permanent-silence state.
- Production runtime and log-discovery metadata are not specified in the repository, so I documented the supported collector and dashboard architecture without inventing a deployment-specific Alloy manifest.
- An operator may resolve an email to an owned session through the application/database during an incident, but the email itself must never enter application logs.

## What I could NOT verify
- The exact failure in the historical Java interview, because the required client and turn-level telemetry did not exist when it occurred.
- Live voice quality, end-to-end latency, or a ten-minute Gemini interview. Repository rules prohibit live interviews and model spend without owner approval.
- Production Alloy/Loki/Grafana installation, retention, access control, and alert routing; these depend on the actual hosting environment and require deployment operations.

## Verification status
- Frontend typecheck: pass.
- Frontend lint: pass.
- Frontend tests: pass — 56 files and 2,758 tests.
- Frontend production build: pass — all 174 static pages generated.
- Backend `ktlintCheck test build`: pass — `BUILD SUCCESSFUL`, 16 tasks.
- GitHub CI on code head `a2eda63`: pass — API and web jobs green in runs `36543709154` and `36543779129`.
- No dependency, secret, schema, or migration changes; no live AI calls were made.

## Merge status
- Branch `fix/interview-audio-observability` is pushed and PR #21 is open into `develop`: https://github.com/namankau/AIInterviewer/pull/21.
- It is intentionally not merged because the change adds an authenticated endpoint, and repository rules require human review for auth-related changes. `main` was not touched.

## Suggested next task
- Configure Alloy, Loki, Grafana dashboards, and the documented alerts in the production runtime before launch, then run an owner-approved interview canary lasting longer than ten minutes.

## Open questions for you
- Which production runtime/platform should the deployment-specific Grafana Alloy discovery configuration target?
