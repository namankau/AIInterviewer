# The browser harness

Drives a whole interview in a real Chromium, as a real signed-in candidate, against a
running stack and live Gemini.

## Why it exists

The previous run reported the interview loop as "verified end to end". It was — end to
end of the *server*. A script posted WAV files at the API and everything passed, while
three failures that only a browser produces shipped anyway:

- Chrome labels a recording `video/webm;codecs=vp9,opus`, and the comma is illegal in an
  unquoted HTTP parameter, so every answer submitted with the camera on returned 500.
- Gemini's speech is headerless PCM, which no `<audio>` element will decode. Every
  question was silent text on screen.
- The camera opened without video consent.

Container formats, autoplay policy, device permissions and consent are browser
behaviour. Nothing that mocks the browser will find a bug in any of them.

## Running it

Not part of CI: it needs a browser, real credentials and live Gemini, and it costs money
per run. Run it before merging anything that touches capture, submission, speech or
consent.

```bash
# once
npx playwright install chromium

# a signed-in test candidate, and a real spoken answer for Chromium to play
node --env-file=.env scripts/test-user.mjs > /tmp/session.json
node --env-file=.env scripts/e2e/make-answers.mjs /tmp/audio

# the stack, in another terminal
npm run dev

# the run
cd /tmp && node --env-file=<repo>/.env <repo>/scripts/e2e/interview.mjs /tmp/audio/answer-1.wav
```

`interview.mjs` reads `session.json` and writes screenshots relative to its own working
directory, so run it from wherever you want those to land.

## What it checks

Composer → device check → room → hint → a spoken answer that ends on its own silence →
the next question. It prints `TURN_LATENCY_SECONDS` and `SILENCE_STOP_SECONDS`, which are
the two numbers worth watching: 7.0s and 3.6s-after-speech on 3 September 2026, against
~24s per turn before speech came off the critical path.

Chromium is given a real spoken answer as its microphone
(`--use-file-for-fake-audio-capture`), so the transcript comes from actual speech rather
than the built-in test tone — which never goes quiet, and so would never let the room's
silence detection finish a turn. Each generated WAV carries a silent tail for exactly
that reason.

## What it does not do

It runs one turn, not a whole round, so the report is not exercised here. It also cannot
test Google sign-in: `test-user.mjs` mints a password account through the admin API and
the session cookie is injected directly.
