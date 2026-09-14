import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hostIsExcluded,
  robotsAllows,
  readableText,
  validateRegister,
  renderMarkdown,
  loadPartitionFiles,
  passesCheck,
  run,
  MIN_READABLE_CHARS,
} from "./source-register.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures", "source-register");

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), `source-register-${prefix}-`));
}

/** The `.json` files directly inside a fixture directory (non-recursive — subdirectories
 * like `check/filters` are their own fixture, not part of their parent's). */
function jsonFilesIn(dir) {
  return readdirSync(dir).filter((name) => name.endsWith(".json") && statSync(join(dir, name)).isFile());
}

/** Copies a fixture directory's JSON files to a fresh temp dir, so tests that mutate
 * files (check) never touch the checked-in fixtures. */
function copyFixtureDir(name) {
  const src = join(FIXTURES, name);
  const dest = tempDir(name.replace(/[\\/]/g, "-"));
  for (const file of jsonFilesIn(src)) {
    writeFileSync(join(dest, file), readFileSync(join(src, file)));
  }
  return dest;
}

/** Same, but replaces the `{{BASE_URL}}` placeholder in every copied JSON file. */
function copyFixtureDirWithBaseUrl(name, baseUrl) {
  const src = join(FIXTURES, name);
  const dest = tempDir(name.replace(/[\\/]/g, "-"));
  for (const file of jsonFilesIn(src)) {
    const text = readFileSync(join(src, file), "utf8").replaceAll("{{BASE_URL}}", baseUrl);
    writeFileSync(join(dest, file), text);
  }
  return dest;
}

/** The CLI narrates progress with console.log/error. Tests care about the return code and
 * the files on disk, not the narration, so it is muted for the duration of the call.
 * Deliberately does not touch process.stdout.write: node:test's own TAP reporter writes
 * through that stream, and patching it globally races the reporter's concurrent output. */
async function withSilencedConsole(fn) {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

// =========================================================================================
// hostIsExcluded — the hard exclusion list (task 036) and its regional Glassdoor variants.
// =========================================================================================

describe("hostIsExcluded", () => {
  const excluded = [
    "leetcode.com",
    "www.leetcode.com",
    "leetcode.cn",
    "teamblind.com",
    "reddit.com",
    "old.reddit.com",
    "redd.it",
    "glassdoor.com",
    "www.glassdoor.com",
    "glassdoor.co.in",
    "glassdoor.co.uk",
    "ambitionbox.com",
    "geeksforgeeks.org",
    "linkedin.com",
    "www.linkedin.com",
    "lnkd.in",
    "quora.com",
    "youtube.com",
    "youtu.be",
  ];

  for (const host of excluded) {
    test(`${host} is excluded`, () => {
      assert.ok(hostIsExcluded(host), `expected ${host} to be excluded`);
    });
  }

  const allowed = ["example.com", "myglassdoor.com", "notleetcode.com", "amazon.jobs", "google.com", "medium.com"];

  for (const host of allowed) {
    test(`${host} is not excluded`, () => {
      assert.equal(hostIsExcluded(host), null);
    });
  }
});

// =========================================================================================
// robotsAllows — ported from RobotsRulesTest.kt. Every case there has a twin here, so the
// two implementations are provably in agreement rather than independently "probably right".
// =========================================================================================

describe("robotsAllows (RobotsRulesTest.kt parity)", () => {
  test("a site with no robots file allows everything", () => {
    assert.equal(robotsAllows("", "https://example.com/interviews/google"), true);
  });

  test("a blanket disallow is honoured", () => {
    const robots = "User-agent: *\nDisallow: /";
    assert.equal(robotsAllows(robots, "https://example.com/anything"), false);
  });

  test("a disallowed subtree is honoured while the rest of the site is not", () => {
    const robots = "User-agent: *\nDisallow: /private/";
    assert.equal(robotsAllows(robots, "https://example.com/private/notes"), false);
    assert.equal(robotsAllows(robots, "https://example.com/blog/interviewing"), true);
  });

  test("a rule naming us beats the wildcard block", () => {
    const robots = "User-agent: *\nDisallow:\n\nUser-agent: AceMyInterviewBot\nDisallow: /";
    assert.equal(robotsAllows(robots, "https://example.com/blog"), false);
  });

  test("the longest matching rule wins, so a carve-out inside a disallow is respected", () => {
    const robots = "User-agent: *\nDisallow: /docs/\nAllow: /docs/public/";
    assert.equal(robotsAllows(robots, "https://example.com/docs/internal"), false);
    assert.equal(robotsAllows(robots, "https://example.com/docs/public/guide"), true);
  });

  test("an empty disallow means allow everything, as the standard says", () => {
    const robots = "User-agent: *\nDisallow:";
    assert.equal(robotsAllows(robots, "https://example.com/anything"), true);
  });

  test("wildcards and end-anchors are understood", () => {
    const robots = "User-agent: *\nDisallow: /*.pdf$";
    assert.equal(robotsAllows(robots, "https://example.com/files/report.pdf"), false);
    assert.equal(robotsAllows(robots, "https://example.com/files/report.html"), true);
  });

  test("comments and casing do not confuse it", () => {
    const robots = "# our rules\nUSER-AGENT: *\nDISALLOW: /private/   # keep out";
    assert.equal(robotsAllows(robots, "https://example.com/private/x"), false);
  });

  test("a URL that cannot be parsed is not fetched", () => {
    assert.equal(robotsAllows("", "not a url at all"), false);
  });
});

// =========================================================================================
// readableText — ported from SourceFetcher.readableText.
// =========================================================================================

describe("readableText (SourceFetcher.readableText parity)", () => {
  test("strips script and style blocks entirely, including their content", () => {
    const html = "<html><head><style>.x{color:red}</style></head><body><script>evil()</script>Hello</body></html>";
    assert.equal(readableText(html), "Hello");
  });

  test("strips tags but keeps text", () => {
    assert.equal(readableText("<div><p>One</p><p>Two</p></div>"), "One Two");
  });

  test("decodes the handful of entities SourceFetcher knows about", () => {
    assert.equal(readableText("Tom &amp; Jerry"), "Tom & Jerry");
    assert.equal(readableText("&lt;tag&gt;"), "<tag>");
    assert.equal(readableText("&quot;quoted&quot;"), '"quoted"');
    assert.equal(readableText("It&#39;s"), "It's");
    assert.equal(readableText("a&nbsp;b"), "a b");
  });

  test("mirrors the exact replace order, entities included: &amp;lt; becomes < not &lt;", () => {
    // &amp; is decoded to & before &lt; is decoded, so "&amp;lt;" becomes "&lt;" and then
    // "<". This is a property of the shared implementation, not something to "fix" here —
    // the whole point of this port is that both sides do the same thing, quirks included.
    assert.equal(readableText("&amp;lt;"), "<");
  });

  test("collapses whitespace and trims", () => {
    assert.equal(readableText("  a\n\n  b\t\tc  "), "a b c");
  });

  test("case-insensitive script/style tags with attributes are still stripped", () => {
    const html = '<SCRIPT type="text/javascript">var x = 1;</SCRIPT>Visible';
    assert.equal(readableText(html), "Visible");
  });
});

// =========================================================================================
// validateRegister — schema, duplicates, hard exclusions.
// =========================================================================================

function baseEntry(overrides = {}) {
  return {
    url: "https://example.com/careers/how-we-hire",
    title: "How we hire",
    publisher: "Example Corp",
    companyName: "Example Corp",
    origin: "employer",
    basis: "Example Corp's own careers page",
    contributes: ["process"],
    roleFamily: null,
    publishedOn: null,
    summary: "Names the stages.",
    robotsAllows: true,
    readableWithoutJs: true,
    ...overrides,
  };
}

function baseFile(sources, overrides = {}) {
  return {
    file: overrides.file ?? "A.json",
    data: {
      partition: "A",
      checkedOn: "2026-09-14",
      sources,
      rejected: [],
      gaps: [],
      ...overrides,
    },
  };
}

describe("validateRegister", () => {
  test("a well-formed register has no errors", () => {
    const files = [baseFile([baseEntry(), baseEntry({ url: "https://example.com/blog/experience", origin: "author" })])];
    assert.deepEqual(validateRegister(files), []);
  });

  test("a rejected entry naming an excluded host is fine — only `sources` is checked", () => {
    const files = [
      baseFile([baseEntry()], { rejected: [{ url: "https://leetcode.com/discuss/x", reason: "Hard exclusion: LeetCode" }] }),
    ];
    assert.deepEqual(validateRegister(files), []);
  });

  for (const field of ["url", "title", "publisher", "companyName", "basis", "summary"]) {
    test(`flags a missing "${field}"`, () => {
      const entry = baseEntry({ [field]: "" });
      const errors = validateRegister([baseFile([entry])]);
      assert.ok(
        errors.some((e) => e.includes(`"${field}"`)),
        `expected an error mentioning "${field}", got: ${errors.join("; ")}`,
      );
    });
  }

  test("flags an invalid origin", () => {
    const errors = validateRegister([baseFile([baseEntry({ origin: "leetcode" })])]);
    assert.ok(errors.some((e) => e.includes('"origin"')));
  });

  test("flags an empty or invalid contributes array", () => {
    const errors1 = validateRegister([baseFile([baseEntry({ contributes: [] })])]);
    assert.ok(errors1.some((e) => e.includes('"contributes"')));
    const errors2 = validateRegister([baseFile([baseEntry({ contributes: ["salary"] })])]);
    assert.ok(errors2.some((e) => e.includes('"contributes"')));
  });

  test("flags a publishedOn that isn't null or YYYY-MM-DD", () => {
    const errors = validateRegister([baseFile([baseEntry({ publishedOn: "last month" })])]);
    assert.ok(errors.some((e) => e.includes('"publishedOn"')));
  });

  test("flags robotsAllows: false as a hard failure", () => {
    const errors = validateRegister([baseFile([baseEntry({ robotsAllows: false })])]);
    assert.ok(errors.some((e) => e.includes("robotsAllows")));
  });

  test("flags a source on the exclusion list, host match", () => {
    const errors = validateRegister([baseFile([baseEntry({ url: "https://leetcode.com/discuss/google" })])]);
    assert.ok(errors.some((e) => e.includes("excluded")));
  });

  test("flags a source on the exclusion list, subdomain match", () => {
    const errors = validateRegister([baseFile([baseEntry({ url: "https://old.reddit.com/r/x" })])]);
    assert.ok(errors.some((e) => e.includes("excluded")));
  });

  test("flags a source on a regional Glassdoor domain", () => {
    const errors = validateRegister([baseFile([baseEntry({ url: "https://www.glassdoor.co.in/Interview/x" })])]);
    assert.ok(errors.some((e) => e.includes("excluded")));
  });

  test("flags a duplicate URL within one file", () => {
    const errors = validateRegister([baseFile([baseEntry(), baseEntry()])]);
    assert.ok(errors.some((e) => e.includes("duplicate")));
  });

  test("flags a duplicate URL across two files", () => {
    const files = [baseFile([baseEntry()], { file: "A.json" }), baseFile([baseEntry()], { file: "B.json" })];
    const errors = validateRegister(files);
    assert.ok(errors.some((e) => e.includes("duplicate")));
  });

  test("flags a malformed rejected entry", () => {
    const errors = validateRegister([baseFile([baseEntry()], { rejected: [{ url: "", reason: "" }] })]);
    assert.ok(errors.some((e) => e.includes("rejected")));
  });
});

// =========================================================================================
// CLI: validate — the fixture directories on disk, exercised through `run()`.
// =========================================================================================

describe("CLI: validate", () => {
  test("exits 0 on the valid fixture", async () => {
    const code = await withSilencedConsole(() => run(["validate", "--dir", join(FIXTURES, "valid")]));
    assert.equal(code, 0);
  });

  test("exits 1 on the invalid fixture", async () => {
    const code = await withSilencedConsole(() => run(["validate", "--dir", join(FIXTURES, "invalid")]));
    assert.equal(code, 1);
  });
});

// =========================================================================================
// render — deterministic Markdown from the loaded JSON.
// =========================================================================================

describe("renderMarkdown", () => {
  test("is deterministic: rendering twice produces identical output", () => {
    const files = loadPartitionFiles(join(FIXTURES, "valid"));
    assert.equal(renderMarkdown(files), renderMarkdown(files));
  });

  test("contains a summary table, per-company tables, rejected reasons and gaps", () => {
    const files = loadPartitionFiles(join(FIXTURES, "valid"));
    const md = renderMarkdown(files);
    assert.match(md, /## Summary/);
    assert.match(md, /\| Example Corp \| 1 \| 1 \| 0 \| 2 \|/);
    assert.match(md, /### Example Corp/);
    assert.match(md, /### Example Org/);
    assert.match(md, /\[How we hire - Example Corp Careers\]\(https:\/\/example\.com\/careers\/how-we-hire\)/);
    assert.match(md, /## Rejected/);
    assert.match(md, /Hard exclusion: LeetCode Discuss/);
    assert.match(md, /## Gaps/);
    assert.match(md, /Example Two Corp - nothing usable found/);
  });

  test("sorts companies alphabetically regardless of JSON order", () => {
    const files = loadPartitionFiles(join(FIXTURES, "valid"));
    const md = renderMarkdown(files);
    const indexOfCorp = md.indexOf("### Example Corp");
    const indexOfOrg = md.indexOf("### Example Org");
    assert.ok(indexOfCorp !== -1 && indexOfOrg !== -1 && indexOfCorp < indexOfOrg);
  });

  test("cmdRender writes REGISTER.md matching renderMarkdown's output", async () => {
    const dir = copyFixtureDir("valid");
    await withSilencedConsole(() => run(["render", "--dir", dir]));
    const written = readFileSync(join(dir, "REGISTER.md"), "utf8");
    const expected = renderMarkdown(loadPartitionFiles(dir));
    assert.equal(written, expected);
    rmSync(dir, { recursive: true, force: true });
  });
});

// =========================================================================================
// check — against a local HTTP server, so this proves the fetch/robots/strip pipeline
// without depending on any live third-party site.
// =========================================================================================

function startFixtureServer() {
  const hits = new Map();
  const record = (path) => hits.set(path, (hits.get(path) ?? 0) + 1);

  const longText = `Interview process. ${"This describes a real hiring loop in enough detail to be useful. ".repeat(20)}`;

  const server = createServer((req, res) => {
    record(req.url);
    if (req.url === "/robots.txt") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("User-agent: *\nDisallow: /blocked/\n");
      return;
    }
    if (req.url === "/allowed/long" || req.url === "/allowed/long-b") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<html><body><script>ignored()</script><p>${longText}</p></body></html>`);
      return;
    }
    if (req.url === "/allowed/short") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><p>Too short.</p></body></html>");
      return;
    }
    if (req.url === "/blocked/page") {
      // Should never be requested: robots.txt disallows it. If this ever fires, the
      // check command has fetched a page it should not have.
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><p>Should never be fetched.</p></body></html>");
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });

  return new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolvePromise({ server, baseUrl: `http://127.0.0.1:${port}`, hits });
    });
  });
}

describe("check", () => {
  let fixture;

  before(async () => {
    fixture = await startFixtureServer();
    process.env.SOURCE_REGISTER_MIN_HOST_INTERVAL_MS = "10";
    process.env.SOURCE_REGISTER_TIMEOUT_MS = "5000";
  });

  after(async () => {
    delete process.env.SOURCE_REGISTER_MIN_HOST_INTERVAL_MS;
    delete process.env.SOURCE_REGISTER_TIMEOUT_MS;
    await new Promise((resolveClose) => fixture.server.close(resolveClose));
  });

  test("records robots result, HTTP status, readable length and checkedAt for every case", async () => {
    const dir = copyFixtureDirWithBaseUrl("check", fixture.baseUrl);
    await withSilencedConsole(() => run(["check", "--dir", dir]));

    const [{ data }] = loadPartitionFiles(dir);
    const byUrl = Object.fromEntries(data.sources.map((s) => [s.url, s.check]));

    const long = byUrl[`${fixture.baseUrl}/allowed/long`];
    assert.equal(long.robotsAllowed, true);
    assert.equal(long.httpStatus, 200);
    assert.ok(long.readableChars >= MIN_READABLE_CHARS, `expected >= ${MIN_READABLE_CHARS} chars, got ${long.readableChars}`);
    assert.equal(long.readable, true);
    assert.equal(long.error, null);
    assert.ok(typeof long.checkedAt === "string" && !Number.isNaN(Date.parse(long.checkedAt)));

    const short = byUrl[`${fixture.baseUrl}/allowed/short`];
    assert.equal(short.httpStatus, 200);
    assert.ok(short.readableChars < MIN_READABLE_CHARS);
    assert.equal(short.readable, false);

    const blocked = byUrl[`${fixture.baseUrl}/blocked/page`];
    assert.equal(blocked.robotsAllowed, false);
    assert.equal(blocked.httpStatus, null);
    assert.equal(fixture.hits.get("/blocked/page"), undefined, "the blocked page must never be fetched");

    const missing = byUrl[`${fixture.baseUrl}/missing/page`];
    assert.equal(missing.robotsAllowed, true);
    assert.equal(missing.httpStatus, 404);
    assert.equal(missing.readable, false);

    rmSync(dir, { recursive: true, force: true });
  });

  test("writes back 2-space JSON with a trailing newline, preserving key order", async () => {
    const dir = copyFixtureDirWithBaseUrl("check", fixture.baseUrl);
    const before_ = readFileSync(join(dir, "template.json"), "utf8");
    const originalKeys = Object.keys(JSON.parse(before_).sources[0]);

    await withSilencedConsole(() => run(["check", "--dir", dir]));

    const raw = readFileSync(join(dir, "template.json"), "utf8");
    assert.ok(raw.endsWith("}\n"), "expected a single trailing newline");
    assert.equal(raw, JSON.stringify(JSON.parse(raw), null, 2) + "\n");

    const keysAfter = Object.keys(JSON.parse(raw).sources[0]);
    assert.deepEqual(keysAfter.slice(0, originalKeys.length), originalKeys, "existing keys must keep their order");
    assert.equal(keysAfter.at(-1), "check", "the new field is appended, not interleaved");

    rmSync(dir, { recursive: true, force: true });
  });

  test("--only limits checking to the named company", async () => {
    const dir = copyFixtureDirWithBaseUrl("check/filters", fixture.baseUrl);
    await withSilencedConsole(() => run(["check", "--dir", dir, "--only", "Fixture Co"]));

    const files = loadPartitionFiles(dir);
    const fixtureCo = files.flatMap((f) => f.data.sources).find((s) => s.companyName === "Fixture Co");
    const otherCo = files.flatMap((f) => f.data.sources).find((s) => s.companyName === "Other Co");
    assert.ok(fixtureCo.check, "Fixture Co should have been checked");
    assert.equal(otherCo.check, undefined, "Other Co should not have been checked");

    rmSync(dir, { recursive: true, force: true });
  });

  test("--partition limits checking to the named partition file", async () => {
    const dir = copyFixtureDirWithBaseUrl("check/filters", fixture.baseUrl);
    await withSilencedConsole(() => run(["check", "--dir", dir, "--partition", "B-fixture"]));

    const files = loadPartitionFiles(dir);
    const aEntry = files.find((f) => f.data.partition === "A-fixture").data.sources[0];
    const bEntry = files.find((f) => f.data.partition === "B-fixture").data.sources[0];
    assert.equal(aEntry.check, undefined);
    assert.ok(bEntry.check);

    rmSync(dir, { recursive: true, force: true });
  });
});

// =========================================================================================
// import — passesCheck's gate, --dry-run, and the missing-credentials guard. The wiring
// against a real admin API (POST + poll) is exercised against a local fake server, never
// the product's own API — task 036 says explicitly not to run `import` for real here.
// =========================================================================================

describe("passesCheck", () => {
  test("rejects an entry that was never checked", () => {
    assert.equal(passesCheck({}), false);
  });

  test("rejects a robots-blocked entry", () => {
    assert.equal(passesCheck({ check: { robotsAllowed: false, httpStatus: 200, readable: true } }), false);
  });

  test("rejects a non-2xx HTTP status", () => {
    assert.equal(passesCheck({ check: { robotsAllowed: true, httpStatus: 404, readable: true } }), false);
  });

  test("rejects text under the readable threshold", () => {
    assert.equal(passesCheck({ check: { robotsAllowed: true, httpStatus: 200, readable: false } }), false);
  });

  test("accepts a passing check", () => {
    assert.equal(passesCheck({ check: { robotsAllowed: true, httpStatus: 200, readable: true } }), true);
  });
});

describe("CLI: import", () => {
  test("--dry-run never makes a network request and needs no credentials", async () => {
    const dir = copyFixtureDir("valid");
    // Give one entry a passing check so --dry-run has something to report.
    const files = loadPartitionFiles(dir);
    files[0].data.sources[0].check = { robotsAllowed: true, httpStatus: 200, readable: true, readableChars: 999 };
    writeFileSync(files[0].path, JSON.stringify(files[0].data, null, 2) + "\n");

    delete process.env.API_BASE_URL;
    delete process.env.ADMIN_ACCESS_TOKEN;
    const code = await withSilencedConsole(() => run(["import", "--dir", dir, "--dry-run"]));
    assert.equal(code, 0);

    rmSync(dir, { recursive: true, force: true });
  });

  test("refuses to run for real without API_BASE_URL and ADMIN_ACCESS_TOKEN", async () => {
    const dir = copyFixtureDir("valid");
    delete process.env.API_BASE_URL;
    delete process.env.ADMIN_ACCESS_TOKEN;
    const code = await withSilencedConsole(() => run(["import", "--dir", dir]));
    assert.equal(code, 1);
    rmSync(dir, { recursive: true, force: true });
  });

  test("posts passing entries, skips failing ones, and polls until every import settles", async () => {
    const dir = copyFixtureDir("valid");
    const files = loadPartitionFiles(dir);
    // Two entries pass their check and should be imported; the third failed its check
    // (robots blocked it) and must be skipped even though it is otherwise well-formed.
    files[0].data.sources[0].check = { robotsAllowed: true, httpStatus: 200, readable: true, readableChars: 999 };
    files[0].data.sources[1].check = { robotsAllowed: false, httpStatus: null, readable: false, readableChars: null };
    writeFileSync(files[0].path, JSON.stringify(files[0].data, null, 2) + "\n");
    files[1].data.sources[0].check = { robotsAllowed: true, httpStatus: 200, readable: true, readableChars: 999 };
    writeFileSync(files[1].path, JSON.stringify(files[1].data, null, 2) + "\n");

    const posted = [];
    const getCounts = new Map();
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        assert.equal(req.headers.authorization, "Bearer test-token");
        if (req.method === "POST" && req.url === "/api/v1/admin/sources/links") {
          const parsed = JSON.parse(body);
          posted.push(parsed);
          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ id: parsed.url, url: parsed.url, status: "pending", questionCount: 0 }));
          return;
        }
        if (req.method === "GET" && req.url === "/api/v1/admin/sources") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify(
              posted.map((p) => {
                const seen = (getCounts.get(p.url) ?? 0) + 1;
                getCounts.set(p.url, seen);
                return { id: p.url, url: p.url, status: seen === 1 ? "pending" : "fetched", questionCount: 3 };
              }),
            ),
          );
          return;
        }
        res.writeHead(404);
        res.end();
      });
    });

    await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
    const { port } = server.address();

    process.env.API_BASE_URL = `http://127.0.0.1:${port}`;
    process.env.ADMIN_ACCESS_TOKEN = "test-token";
    process.env.SOURCE_REGISTER_POLL_INTERVAL_MS = "20";
    process.env.SOURCE_REGISTER_POST_INTERVAL_MS = "5";

    try {
      const code = await withSilencedConsole(() => run(["import", "--dir", dir, "--timeout-minutes", "0.05"]));
      assert.equal(code, 0);
      assert.equal(posted.length, 2, "both passing entries should be posted, the failing one skipped");
      const postedUrls = posted.map((p) => p.url).sort();
      assert.deepEqual(
        postedUrls,
        [files[0].data.sources[0].url, files[1].data.sources[0].url].sort(),
      );
      assert.ok(!postedUrls.includes(files[0].data.sources[1].url), "the robots-blocked entry must be skipped");
      assert.equal(posted[0].origin, "employer");
      assert.ok("publishedOn" in posted[0]);
    } finally {
      delete process.env.API_BASE_URL;
      delete process.env.ADMIN_ACCESS_TOKEN;
      delete process.env.SOURCE_REGISTER_POLL_INTERVAL_MS;
      delete process.env.SOURCE_REGISTER_POST_INTERVAL_MS;
      await new Promise((resolveClose) => server.close(resolveClose));
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
