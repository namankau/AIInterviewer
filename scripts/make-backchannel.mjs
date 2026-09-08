/**
 * Renders the interviewer's listening noises to WAV, once, into the web app's public
 * directory.
 *
 * A real interviewer makes small sounds while you talk — "mm-hm", "right", "okay" — and
 * their absence is most of why a spoken mock interview feels like dictating into a void.
 * The candidate cannot tell whether anything is hearing them until the next question
 * arrives fifteen seconds later.
 *
 * These are generated ahead of time and committed rather than synthesised per session:
 * they never change, there are five of them, and a backchannel that arrives after a
 * round trip to a model is not a backchannel. Total is a few tens of kilobytes.
 *
 *   node --env-file=.env scripts/make-backchannel.mjs
 *
 * Re-run only when the set or the voice changes.
 *
 * **The voice must match the one the round itself speaks with**, and matching the
 * `voiceName` is not enough to achieve that. This has been wrong twice.
 *
 * First the names differed: questions were Kore and these were Puck, so the interviewer
 * acknowledged you as a different person. Fixing that was not enough, because these were
 * still rendered with a style instruction wrapped around the text — "in a quiet, natural,
 * unhurried voice, as a brief acknowledgement while listening to someone speak" — and
 * Gemini's TTS is steered by exactly that kind of natural-language direction. Same voice,
 * different performance: measured against the live API, a bare "Mm-hm." comes back 0.53s
 * long and the wrapped one 0.93s — slower, more deliberate, audibly another person.
 *
 * So the request below is the same shape `GeminiInterviewAi.synthesizeSpeech` sends for a
 * question: bare text, no direction, same model, same voice. Anything added here is a
 * difference the candidate can hear.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const key = process.env.GEMINI_API_KEY;
if (!key) {
  process.stderr.write("GEMINI_API_KEY is not set\n");
  process.exit(1);
}

const OUT = process.argv[2] ?? join("apps", "web", "public", "interviewer");
mkdirSync(OUT, { recursive: true });

// Must equal GeminiProperties.voiceName. A mismatch is not a subtle bug: it is a second
// person speaking in the middle of somebody's interview.
const VOICE = process.env.GEMINI_VOICE_NAME ?? "Kore";

const RATE = 24_000;

/**
 * Two kinds of sound, and the difference matters.
 *
 * `listening` plays into a pause while the candidate is still going. It has to be short
 * and unremarkable enough to sit under their voice without taking the floor from them.
 *
 * `acknowledging` plays once, the moment they stop, while the model is still thinking.
 * It can be a beat longer because the floor is genuinely free.
 */
const CLIPS = [
  { name: "listening-1", text: "Mm-hm." },
  { name: "listening-2", text: "Right." },
  { name: "listening-3", text: "Okay, sure." },
  { name: "listening-4", text: "Mm-hmm, yeah." },
  { name: "acknowledging-1", text: "Okay, got it." },
  { name: "acknowledging-2", text: "Right, thank you." },
  { name: "acknowledging-3", text: "Okay, let me think about that." },
];

let directed = 0;
for (const clip of CLIPS) {
  const rendered = await speak(clip.text);
  if (rendered.direction) directed++;
  const path = join(OUT, `${clip.name}.wav`);
  writeFileSync(path, wav(rendered.pcm, RATE));
  process.stdout.write(
    `${path}  ${(rendered.pcm.length / (RATE * 2)).toFixed(2)}s  "${clip.text}"${rendered.direction ? "   <- NEEDED DIRECTION" : ""}\n`,
  );
}

if (directed > 0) {
  process.stderr.write(
    `\n${directed} clip(s) would not render as bare text and had to be directed, so they may \n` +
      `not match the interviewer. Rephrase those as fuller phrases and re-run.\n`,
  );
}

/**
 * Bare first, exactly as a question is spoken.
 *
 * A very short interjection on its own can read to the model as a chat turn to answer
 * rather than a line to perform: a bare "Okay." comes back as HTTP 400, "Model tried to
 * generate text". The retry adds the smallest direction that will do, and says so loudly,
 * because a directed clip is one that may not sound like the interviewer. The fix when
 * that happens is to rephrase the clip as a fuller phrase, not to keep the direction.
 */
async function speak(text) {
  const bare = await render(text);
  if (bare) return { pcm: bare, direction: false };

  const steered = await render(`Say: ${text}`);
  if (steered) return { pcm: steered, direction: true };

  process.stderr.write(`TTS would not render "${text}" bare or directed\n`);
  process.exit(1);
}

async function render(text) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
        },
      }),
    },
  );
  if (!response.ok) {
    // A refusal to perform the line is what the retry is for. Anything else — a bad key,
    // a rate limit, a spend cap — is not, and quietly retrying would hide it.
    if (response.status === 400) return null;
    process.stderr.write(`TTS failed (${response.status}): ${await response.text()}\n`);
    process.exit(1);
  }
  const body = await response.json();
  const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  return part ? Buffer.from(part.inlineData.data, "base64") : null;
}

/** Gemini returns headerless PCM, which no <audio> element will decode. */
function wav(pcm, rate) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
