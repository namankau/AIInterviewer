/**
 * Drives a whole interview in a real Chromium, as a real signed-in candidate.
 *
 * The last run's "verified end to end" meant end to end of the *server* — a script
 * posted WAV files at the API and everything passed, while three browser-only failures
 * shipped: a container type the API could not parse, headerless PCM no <audio> can play,
 * and a camera that opened without consent. Anything only a browser produces needs a
 * browser to find.
 *
 * Chromium is given a real spoken answer as its microphone (--use-file-for-fake-audio-
 * capture), so the transcript comes from actual speech rather than a test tone. Each WAV
 * carries a silent tail, which is what lets the room's own silence detection end a turn.
 *
 * Not part of CI: it needs a browser, real credentials and live Gemini. See README.md
 * beside this file for how to run it and what it does not cover.
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const HERE = process.cwd();
const SHOTS = join(HERE, "shots");
mkdirSync(SHOTS, { recursive: true });

const session = JSON.parse(readFileSync(join(HERE, "session.json"), "utf8"));
const answer = process.argv[2] ?? join(HERE, "audio", "answer-1.wav");
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

const log = (...parts) => process.stdout.write(`${parts.join(" ")}\n`);
let step = 0;
const shot = async (page, name) => {
  step += 1;
  const file = join(SHOTS, `${String(step).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  log("   shot:", file);
};

const browser = await chromium.launch({
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${answer}`,
    "--autoplay-policy=no-user-gesture-required",
  ],
});

const context = await browser.newContext({
  permissions: ["microphone", "camera"],
  viewport: { width: 1280, height: 900 },
});

// @supabase/ssr keeps the session in a base64-prefixed cookie on the app's own origin.
await context.addCookies([
  {
    name: `sb-${projectRef}-auth-token`,
    value:
      "base64-" +
      Buffer.from(
        JSON.stringify({
          access_token: session.accessToken,
          refresh_token: session.refreshToken,
          expires_at: session.expiresAt,
          expires_in: 3600,
          token_type: "bearer",
          user: { id: session.userId, email: session.email },
        }),
      ).toString("base64"),
    domain: "localhost",
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  },
]);

const page = await context.newPage();
page.on("console", (message) => {
  if (message.type() === "error") log("   console error:", message.text().slice(0, 300));
});
page.on("pageerror", (error) => log("   page error:", String(error).slice(0, 300)));

async function api(path, method = "GET") {
  const response = await fetch(`http://localhost:8080${path}`, {
    method,
    headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/json" },
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${await response.text()}`);
  return response.json();
}

const failures = [];
const check = (label, ok, detail = "") => {
  log(ok ? "PASS" : "FAIL", label, detail);
  if (!ok) failures.push(label + (detail ? ` — ${detail}` : ""));
};

try {
  // A previous run leaves a session in progress, and the dashboard then correctly offers
  // to resume it rather than start another. Clear it so every run begins from the same
  // place. Abandoned sessions do not consume the free interview, so this is repeatable.
  log("== clearing any open session ==");
  const open = await api("/api/v1/sessions");
  for (const previous of open.filter((s) => s.status === "in_progress")) {
    await api(`/api/v1/sessions/${previous.id}/abandon`, "POST");
    log("   abandoned", previous.id);
  }

  log("\n== dashboard ==");
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
  await shot(page, "dashboard");
  const startLink = page.getByRole("link", { name: /start (an|your first) interview/i });
  check("dashboard offers the one primary action", await startLink.isVisible().catch(() => false));

  log("\n== setup ==");
  await startLink.click();
  await page.waitForURL(/\/interview\/new/, { timeout: 15_000 });
  // The composer: one sentence, then correct what it got wrong.
  const intent = "Infosys project deep-dive next week. 6 years, payments and ledger systems.";
  await page.getByLabel(/describe the interview/i).fill(intent);
  const composedAt = Date.now();
  await page.getByRole("button", { name: /set up the round/i }).click();
  await page.getByRole("button", { name: /begin interview/i }).waitFor({ timeout: 90_000 });
  log(`   composed in ${((Date.now() - composedAt) / 1000).toFixed(1)}s`);
  await shot(page, "composed");

  const company = await page.getByPlaceholder("Infosys").inputValue();
  const role = await page.getByPlaceholder("Senior Backend Engineer").inputValue();
  check("the composer read the employer out of the sentence", company === "Infosys", company);
  check("and proposed a role", role.length > 3, role);
  check(
    "and told the candidate how the round was grounded",
    await page.getByText(/general patterns/i).first().isVisible().catch(() => false),
  );

  await page.getByRole("checkbox", { name: /record my voice/i }).check();
  await page.getByRole("checkbox", { name: /record my camera/i }).check();
  await shot(page, "setup");

  const startedAt = Date.now();
  await page.getByRole("button", { name: /begin interview/i }).click();
  await page.waitForURL(/\/interview\/[0-9a-f-]{36}/, { timeout: 120_000 });
  const sessionId = page.url().split("/").pop();
  log(`   session ${sessionId} created in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

  log("\n== the antechamber ==");
  const enter = page.getByRole("button", { name: /enter the room/i });
  await enter.waitFor({ timeout: 30_000 });
  await page.getByText(/ready\. say something/i).waitFor({ timeout: 20_000 });
  await shot(page, "device-check");
  check("device check reports a live microphone", true);
  check(
    "camera preview is shown when video was consented to",
    await page.getByLabel(/your camera preview/i).first().isVisible().catch(() => false),
  );

  await enter.click();

  log("\n== the room ==");
  const question = page.locator("main p.text-title").first();
  await question.waitFor({ timeout: 30_000 });
  const firstQuestion = (await question.textContent())?.trim() ?? "";
  check("a question is shown", firstQuestion.length > 20, firstQuestion.slice(0, 90) + "…");
  await shot(page, "room-question");

  // The voice arrives after the text. That is the whole point of the change.
  const audioReady = await page
    .locator("audio")
    .first()
    .waitFor({ timeout: 60_000 })
    .then(() => true)
    .catch(() => false);
  check("the interviewer's voice arrives after the text", audioReady);
  if (audioReady) {
    const src = await page.locator("audio").first().getAttribute("src");
    check("question audio is a signed URL", Boolean(src && src.startsWith("http")), (src ?? "").slice(0, 70) + "…");
    const playable = await page.locator("audio").first().evaluate(
      (el) =>
        new window.Promise((resolve) => {
          if (el.readyState >= 2) return resolve({ ok: true, duration: el.duration });
          el.addEventListener("loadeddata", () => resolve({ ok: true, duration: el.duration }), { once: true });
          el.addEventListener("error", () => resolve({ ok: false, error: String(el.error?.code) }), { once: true });
          window.setTimeout(() => resolve({ ok: false, error: "timeout" }), 20_000);
        }),
    );
    check("the browser can actually decode it", playable.ok, JSON.stringify(playable));
  }

  log("\n== asking for a nudge ==");
  await page.getByRole("button", { name: /give me a nudge/i }).click();
  const hint = page.locator("aside").filter({ hasText: /you asked for help/i });
  const gotHint = await hint.waitFor({ timeout: 90_000 }).then(() => true).catch(() => false);
  check("a hint comes back", gotHint);
  if (gotHint) {
    const text = (await hint.textContent()) ?? "";
    check("the room says what asking cost", /recorded as/i.test(text), text.replace(/\s+/g, " ").slice(0, 140));
    await shot(page, "hint");
  }

  log("\n== answering, and letting the silence end it ==");
  await page.getByRole("button", { name: /^answer$/i }).click();
  await page.getByText(/listening ·/i).waitFor({ timeout: 15_000 });
  await shot(page, "answering");

  const answerStart = Date.now();
  // One unambiguous marker. Matching on loose text hit two elements at once in the
  // submitting phase, and strict mode rejected the wait -- which reads as a product
  // failure and is not one.
  const moved = await page
    .getByRole("button", { name: /done answering/i })
    .waitFor({ state: "detached", timeout: 120_000 })
    .then(() => true)
    .catch(() => false);
  const silenceSeconds = (Date.now() - answerStart) / 1000;
  check(
    "the answer ended itself on silence",
    moved,
    moved ? `after ${silenceSeconds.toFixed(1)}s of a 22.9s answer + 7s tail` : "still recording",
  );
  log(`SILENCE_STOP_SECONDS=${silenceSeconds.toFixed(1)}`);

  const turnStart = Date.now();
  const nextQuestion = await question
    .filter({ hasNotText: firstQuestion })
    .waitFor({ timeout: 180_000 })
    .then(() => true)
    .catch(() => false);
  const turnSeconds = (Date.now() - turnStart) / 1000;
  check("the next question comes back", nextQuestion, `${turnSeconds.toFixed(1)}s after submitting`);
  if (nextQuestion) {
    log("   next question:", ((await question.textContent()) ?? "").trim().slice(0, 140));
    await shot(page, "room-next-question");
  }
  log(`\nTURN_LATENCY_SECONDS=${turnSeconds.toFixed(1)}`);
  log(`SESSION_ID=${sessionId}`);
} catch (error) {
  failures.push(`threw: ${String(error).slice(0, 400)}`);
  log("ERROR", String(error).slice(0, 800));
  await shot(page, "failure").catch(() => undefined);
} finally {
  log("\n== result ==");
  if (failures.length === 0) {
    log("all checks passed");
  } else {
    failures.forEach((f) => log(" -", f));
  }
  await browser.close();
  process.exit(failures.length === 0 ? 0 : 1);
}
