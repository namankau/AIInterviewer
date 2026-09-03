#!/usr/bin/env node
/**
 * Creates (or reuses) a confirmed test candidate and prints a signed-in session for it.
 *
 *   node --env-file=.env scripts/test-user.mjs [email]
 *
 * Why this exists: sign-in is Google-only, which is right for real candidates and
 * useless for driving the app end to end. This mints a password account through the
 * admin API so a browser harness can be signed in without an OAuth round trip.
 *
 * It uses the service-role key, so it is a local development tool. It never runs in CI,
 * and it must never be called from application code.
 *
 * Prints JSON: { userId, email, password, accessToken, refreshToken, expiresAt }.
 */

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceRoleKey || !anonKey) {
  fail("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.");
}

const email = process.argv[2] ?? "e2e.candidate@acemyinterview.test";
// Fixed so a rerun reuses the same account rather than accumulating orphans, and so the
// owner can sign in as the test candidate by hand when they want to look at something.
const password = "interview-harness-9f2c1a";

const created = await request(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers: adminHeaders(),
  body: JSON.stringify({ email, password, email_confirm: true }),
});

// A repeat run hits "email already registered", which is the expected path, not a
// failure — the account is reused and its password reset to the known one.
if (!created.ok) {
  const existing = await request(
    `${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    { headers: adminHeaders() },
  );
  if (!existing.ok) fail(`Could not find or create ${email}: ${existing.text}`);

  const match = (existing.body.users ?? []).find((user) => user.email === email);
  if (!match) fail(`Could not find or create ${email}: ${created.text}`);

  const reset = await request(`${url}/auth/v1/admin/users/${match.id}`, {
    method: "PUT",
    headers: adminHeaders(),
    body: JSON.stringify({ password, email_confirm: true }),
  });
  if (!reset.ok) fail(`Could not reset the test password: ${reset.text}`);
}

const signedIn = await request(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anonKey, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!signedIn.ok) fail(`Could not sign the test candidate in: ${signedIn.text}`);

process.stdout.write(
  `${JSON.stringify(
    {
      userId: signedIn.body.user.id,
      email,
      password,
      accessToken: signedIn.body.access_token,
      refreshToken: signedIn.body.refresh_token,
      expiresAt: signedIn.body.expires_at,
    },
    null,
    2,
  )}\n`,
);

function adminHeaders() {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function request(target, init) {
  const response = await fetch(target, init);
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { ok: response.ok, status: response.status, text, body };
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
