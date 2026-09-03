/**
 * Renders spoken candidate answers to WAV, so the browser harness can feed Chromium a
 * real voice rather than a test tone.
 *
 * Each file gets a silent tail: Chromium loops the fake capture file, and the room ends
 * an answer on sustained silence, so the tail is what lets the loop actually finish a
 * turn instead of talking forever.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const key = process.env.GEMINI_API_KEY;
if (!key) {
  process.stderr.write("GEMINI_API_KEY is not set\n");
  process.exit(1);
}

const OUT = process.argv[2] ?? ".";
mkdirSync(OUT, { recursive: true });

const RATE = 24_000;
const SILENCE_TAIL_SECONDS = 7;

const ANSWERS = [
  {
    name: "answer-1",
    text:
      "Sure. I'm a backend engineer with about six years in, mostly on payments and " +
      "ledger systems. For the last two years I've been at a fintech looking after the " +
      "settlement pipeline — it reconciles roughly four hundred thousand transactions a " +
      "day against three payment processors. Before that I was doing more general " +
      "platform work, a lot of Java and Kotlin, some Postgres tuning.",
  },
  {
    name: "answer-2",
    text:
      "The biggest one was moving the settlement store to an append-only ledger. We had " +
      "been mutating balance rows in place, and every time reconciliation disagreed with " +
      "the processor we had no way to tell what the balance had been at the time. So we " +
      "made writes immutable and projected a read model off them asynchronously. The " +
      "trade-off was that the read model went eventually consistent, which the finance " +
      "team really did not like at first.",
  },
  {
    name: "answer-3",
    text:
      "Honestly, we just polled. A worker read the ledger table every couple of seconds " +
      "looking for rows it had not projected yet, and if the projection failed we retried " +
      "it. It was mostly fine. We did see some lag at peak but nobody complained much.",
  },
];

for (const answer of ANSWERS) {
  const pcm = await speak(answer.text);
  const silence = Buffer.alloc(RATE * 2 * SILENCE_TAIL_SECONDS);
  const path = join(OUT, `${answer.name}.wav`);
  writeFileSync(path, wav(Buffer.concat([pcm, silence]), RATE));
  process.stdout.write(
    `${path} ${(pcm.length / (RATE * 2)).toFixed(1)}s speech + ${SILENCE_TAIL_SECONDS}s silence\n`,
  );
}

async function speak(text) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
          },
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`TTS failed ${response.status}: ${await response.text()}`);
  }
  const body = await response.json();
  const data = body?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!data) throw new Error(`no audio in response: ${JSON.stringify(body).slice(0, 400)}`);
  return Buffer.from(data, "base64");
}

/** Minimal 16-bit mono RIFF header — the same shape WavAudio.wrap writes on the API. */
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
