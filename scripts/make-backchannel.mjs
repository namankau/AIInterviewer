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
 * Re-run only when the set or the voice changes. The voice matches the one the round
 * itself uses, or the acknowledgements come from a different person than the questions.
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
  { name: "listening-3", text: "Okay." },
  { name: "listening-4", text: "Mm." },
  { name: "acknowledging-1", text: "Okay, got it." },
  { name: "acknowledging-2", text: "Right, thank you." },
  { name: "acknowledging-3", text: "Okay, let me think about that." },
];

for (const clip of CLIPS) {
  const pcm = await speak(clip.text);
  const path = join(OUT, `${clip.name}.wav`);
  writeFileSync(path, wav(pcm, RATE));
  process.stdout.write(`${path}  ${(pcm.length / (RATE * 2)).toFixed(2)}s  "${clip.text}"\n`);
}

async function speak(text) {
  // A bare "Okay." reads to the model as something to answer rather than something to
  // read, and it returns text instead of audio. Saying so explicitly is the difference
  // between a recording and a 400.
  const instruction =
    "Read the following aloud exactly as written, in a quiet, natural, unhurried voice, " +
    `as a brief acknowledgement while listening to someone speak. Say nothing else: ${text}`;

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: instruction }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
        },
      }),
    },
  );
  if (!response.ok) {
    process.stderr.write(`TTS failed (${response.status}): ${await response.text()}\n`);
    process.exit(1);
  }
  const body = await response.json();
  const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) {
    process.stderr.write("TTS returned no audio\n");
    process.exit(1);
  }
  return Buffer.from(part.inlineData.data, "base64");
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
