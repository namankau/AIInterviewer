#!/usr/bin/env node
/**
 * The source register: validate, check, render, import.
 *
 *   node scripts/source-register.mjs validate [--dir <path>]
 *   node scripts/source-register.mjs check    [--dir <path>] [--only <company>] [--partition <name>]
 *   node scripts/source-register.mjs render   [--dir <path>]
 *   node scripts/source-register.mjs import   [--only <company>] [--dry-run] [--timeout-minutes <n>]
 *
 * PRD §04 (Tier B sources: employer career-site process pages, openly-licensed
 * repositories, individual authors' own posts used with attribution — "requires a
 * per-source review and a maintained source register") and §16 ("maintain a source
 * register … obtain a legal review of the source register before public launch").
 *
 * This file has one job beyond bookkeeping: `check` must see exactly what the backend's
 * `SourceFetcher` will see, using exactly the same robots.txt semantics as
 * `RobotsRules.kt` and the same tag-stripping as `SourceFetcher.readableText`. It is a
 * deliberate, tested port rather than an approximation — the two are checked against the
 * same cases in `RobotsRulesTest.kt` (ported into `source-register.test.mjs`) so drift
 * between the tool that curates the register and the code that reads it shows up as a
 * failing test, not a surprise on the day someone re-checks a source.
 *
 * No dependencies beyond the Node standard library (CLAUDE.md rule 6). Node >= 20.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------------------
// Constants shared with the backend. Keep these in lockstep with the Kotlin they mirror.
// ---------------------------------------------------------------------------------------

/** Mirrors `RobotsRules.USER_AGENT`. */
export const USER_AGENT = "AceMyInterviewBot";

/** Mirrors `SourceFetcher.USER_AGENT_HEADER`. Used for both robots.txt and the page GET. */
export const USER_AGENT_HEADER = `${USER_AGENT} (+https://acemyinterview.com/bot; curated source library, not a crawler)`;

/** Mirrors `SourceFetcher.MAX_CONTENT_CHARS`. */
export const MAX_CONTENT_CHARS = 120_000;

/** The `import` command's definition of "readable" (task 036, Tooling section). */
export const MIN_READABLE_CHARS = 800;

/**
 * One request at a time, spaced out — this is somebody else's server. Read from the
 * environment on every call, rather than frozen at module load, so tests (which run
 * against a local HTTP server and would otherwise take forever) can dial both down
 * without caring whether they set the variable before or after this module was imported.
 */
function minHostIntervalMs() {
  return Number(process.env.SOURCE_REGISTER_MIN_HOST_INTERVAL_MS ?? 2000);
}
function requestTimeoutMs() {
  return Number(process.env.SOURCE_REGISTER_TIMEOUT_MS ?? 20_000);
}

/**
 * Hard exclusions (task 036). This list is code, not a policy someone has to remember —
 * `validate` fails the build on any URL whose host is or ends with one of these, and on
 * any registered subdomain of one. Regional Glassdoor domains are matched by pattern
 * below rather than enumerated, since new ccTLDs appear without asking us.
 */
export const EXCLUDED_DOMAINS = Object.freeze([
  "leetcode.com",
  "leetcode.cn",
  "teamblind.com",
  "reddit.com",
  "redd.it",
  "ambitionbox.com",
  "geeksforgeeks.org",
  "linkedin.com",
  "lnkd.in",
  "quora.com",
  "youtube.com",
  "youtu.be",
]);

/**
 * Returns the excluded domain a host matches (itself or a parent), or null. Handles
 * `glassdoor.*` across every TLD/ccTLD (glassdoor.com, glassdoor.co.in, glassdoor.co.uk,
 * …) by matching the label "glassdoor" wherever it falls in the hostname, rather than
 * enumerating suffixes.
 */
export function hostIsExcluded(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  for (const domain of EXCLUDED_DOMAINS) {
    if (host === domain || host.endsWith(`.${domain}`)) return domain;
  }
  const labels = host.split(".");
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === "glassdoor" && i < labels.length - 1) {
      return labels.slice(i).join(".");
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------
// RobotsRules.kt, ported. Same semantics, same defaults, same "err towards not fetching."
// See RobotsRulesTest.kt — every case there has a twin in source-register.test.mjs.
// ---------------------------------------------------------------------------------------

/**
 * Whether [url] may be fetched per [robotsTxt], under [USER_AGENT]. A robots.txt that
 * cannot be parsed into any rule for us allows everything, as the standard requires.
 */
export function robotsAllows(robotsTxt, url) {
  let path;
  try {
    const parsed = new URL(url);
    path = parsed.pathname + parsed.search;
  } catch {
    // A URL we cannot even parse is not one we should be fetching.
    return false;
  }

  const rules = rulesFor(robotsTxt);
  if (rules.length === 0) return true;

  const candidates = rules.filter((rule) => matchesPattern(rule.path, path));
  const best = pickBest(candidates);
  return best ? best.allow : true;
}

/** The rules that apply to us: our named block if there is one, else the wildcard block. */
function rulesFor(robotsTxt) {
  const groups = new Map();
  let currentAgents = [];
  let readingAgents = false;

  for (const raw of robotsTxt.split(/\r\n|\r|\n/)) {
    const line = raw.split("#")[0].trim();
    if (line === "") continue;
    const colon = line.indexOf(":");
    const field = (colon === -1 ? "" : line.slice(0, colon)).trim().toLowerCase();
    const value = (colon === -1 ? "" : line.slice(colon + 1)).trim();
    if (field === "") continue;

    if (field === "user-agent") {
      if (!readingAgents) {
        currentAgents = [];
        readingAgents = true;
      }
      currentAgents.push(value.toLowerCase());
    } else if (field === "allow" || field === "disallow") {
      readingAgents = false;
      if (value === "" && field === "disallow") continue; // "Disallow:" allows all
      for (const agent of currentAgents) {
        if (!groups.has(agent)) groups.set(agent, []);
        groups.get(agent).push({ path: value, allow: field === "allow" });
      }
    } else {
      readingAgents = false;
    }
  }

  return groups.get(USER_AGENT.toLowerCase()) ?? groups.get("*") ?? [];
}

/** `*` matches any run of characters; a trailing `$` anchors the end. */
function matchesPattern(pattern, path) {
  if (pattern === "") return false;
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.split("*").map(escapeRegExp).join(".*");
  const regex = new RegExp(`^${escaped}${anchored ? "$" : ""}`);
  return regex.test(path);
}

function escapeRegExp(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Longest matching pattern wins; Allow wins a tie — the documented precedence. */
function pickBest(rules) {
  let best = null;
  for (const rule of rules) {
    if (!best) {
      best = rule;
      continue;
    }
    if (rule.path.length > best.path.length) {
      best = rule;
    } else if (rule.path.length === best.path.length && rule.allow && !best.allow) {
      best = rule;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------
// SourceFetcher.readableText, ported verbatim (same regexes, same order of operations).
// ---------------------------------------------------------------------------------------

const SCRIPT_OR_STYLE = /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi;
const TAG = /<[^>]+>/g;
const WHITESPACE = /\s+/g;

export function readableText(body) {
  return body
    .replace(SCRIPT_OR_STYLE, " ")
    .replace(TAG, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(WHITESPACE, " ")
    .trim();
}

// ---------------------------------------------------------------------------------------
// Fetch helpers: one request at a time, a real timeout, spacing between hits to a host.
// ---------------------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const lastRequestAtByHost = new Map();

/** Waits out any remainder of the per-host spacing, then performs the request. */
async function politeFetch(host, url, options) {
  const last = lastRequestAtByHost.get(host) ?? 0;
  const wait = last + minHostIntervalMs() - Date.now();
  if (wait > 0) await sleep(wait);
  try {
    return await fetchWithTimeout(url, options, requestTimeoutMs());
  } finally {
    lastRequestAtByHost.set(host, Date.now());
  }
}

/**
 * What SourceFetcher's robotsAllows() sees for one URL: robots.txt fetched with our
 * User-Agent, unreachable or erroring treated as "allow everything" (the standard's
 * default), then run through the same rule engine.
 */
async function fetchRobotsAllowed(url) {
  const parsed = new URL(url);
  const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;
  let robotsTxt = "";
  try {
    const response = await politeFetch(parsed.host, robotsUrl, {
      headers: { "User-Agent": USER_AGENT_HEADER },
    });
    if (response.ok) {
      robotsTxt = await response.text();
    }
    // A non-2xx robots.txt is unreachable as far as the standard is concerned: allow.
  } catch {
    // Network error or timeout: same as above, allow.
  }
  return robotsAllows(robotsTxt, url);
}

/**
 * Checks one source exactly as `SourceFetcher` would: robots.txt first (a disallow means
 * the page is never fetched, matching `loadLink`), then a plain GET with the same
 * User-Agent and Accept header, then the same tag-stripping and length cap.
 */
async function checkOne(entry) {
  const checkedAt = new Date().toISOString();
  let parsed;
  try {
    parsed = new URL(entry.url);
  } catch {
    return { checkedAt, robotsAllowed: false, httpStatus: null, readableChars: null, readable: false, error: "URL could not be parsed" };
  }

  const robotsAllowed = await fetchRobotsAllowed(entry.url);
  if (!robotsAllowed) {
    return { checkedAt, robotsAllowed: false, httpStatus: null, readableChars: null, readable: false, error: null };
  }

  try {
    const response = await politeFetch(parsed.host, entry.url, {
      headers: {
        "User-Agent": USER_AGENT_HEADER,
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
    });
    if (!response.ok) {
      return {
        checkedAt,
        robotsAllowed: true,
        httpStatus: response.status,
        readableChars: null,
        readable: false,
        error: `HTTP ${response.status}`,
      };
    }
    const body = await response.text();
    const readable = readableText(body).slice(0, MAX_CONTENT_CHARS);
    return {
      checkedAt,
      robotsAllowed: true,
      httpStatus: response.status,
      readableChars: readable.length,
      readable: readable.length >= MIN_READABLE_CHARS,
      error: null,
    };
  } catch (error) {
    return {
      checkedAt,
      robotsAllowed: true,
      httpStatus: null,
      readableChars: null,
      readable: false,
      error: error?.message ? String(error.message) : "fetch failed",
    };
  }
}

// ---------------------------------------------------------------------------------------
// Loading and saving the register.
// ---------------------------------------------------------------------------------------

const DEFAULT_DIR = "docs/source-register";

/** Reads every `*.json` file in [dir], sorted by filename so output order is stable. */
export function loadPartitionFiles(dir) {
  const names = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));
  return names.map((name) => {
    const path = join(dir, name);
    const data = JSON.parse(readFileSync(path, "utf8"));
    return { file: name, path, data };
  });
}

function writePartitionFile(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

// ---------------------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------------------

const VALID_ORIGINS = new Set(["employer", "author", "open_licence"]);
const VALID_CONTRIBUTES = new Set(["process", "questions"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates every loaded partition file and returns the list of problems found (empty
 * means the register is clean). Checks the whole set together so a URL duplicated across
 * two partitions is caught, not just duplicates inside one file.
 */
export function validateRegister(files) {
  const errors = [];
  const seenUrls = new Map(); // url -> "file"

  for (const { file, data } of files) {
    if (!isNonEmptyString(data.partition)) {
      errors.push(`${file}: missing or empty "partition"`);
    }
    if (!isNonEmptyString(data.checkedOn)) {
      errors.push(`${file}: missing or empty "checkedOn"`);
    }
    if (!Array.isArray(data.sources)) {
      errors.push(`${file}: "sources" must be an array`);
      continue;
    }

    data.sources.forEach((entry, index) => {
      const where = `${file} sources[${index}]${entry?.url ? ` (${entry.url})` : ""}`;

      if (!isNonEmptyString(entry.url)) {
        errors.push(`${where}: missing or empty "url"`);
      } else {
        let parsed = null;
        try {
          parsed = new URL(entry.url);
        } catch {
          errors.push(`${where}: "url" is not a valid absolute URL`);
        }
        if (parsed) {
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            errors.push(`${where}: "url" must be http or https`);
          }
          const excluded = hostIsExcluded(parsed.hostname);
          if (excluded) {
            errors.push(`${where}: host is excluded (${excluded}) — this source may not be used`);
          }
        }

        const key = entry.url.trim();
        if (seenUrls.has(key)) {
          errors.push(`${where}: duplicate of ${seenUrls.get(key)} (same url: ${key})`);
        } else {
          seenUrls.set(key, where);
        }
      }

      if (!isNonEmptyString(entry.title)) errors.push(`${where}: missing or empty "title"`);
      if (!isNonEmptyString(entry.publisher)) errors.push(`${where}: missing or empty "publisher"`);
      if (!isNonEmptyString(entry.companyName)) errors.push(`${where}: missing or empty "companyName"`);
      if (!isNonEmptyString(entry.basis)) errors.push(`${where}: missing or empty "basis"`);
      if (!isNonEmptyString(entry.summary)) errors.push(`${where}: missing or empty "summary"`);

      if (!VALID_ORIGINS.has(entry.origin)) {
        errors.push(`${where}: "origin" must be one of ${[...VALID_ORIGINS].join(", ")}, got ${JSON.stringify(entry.origin)}`);
      }

      if (!Array.isArray(entry.contributes) || entry.contributes.length === 0) {
        errors.push(`${where}: "contributes" must be a non-empty array`);
      } else {
        entry.contributes.forEach((c) => {
          if (!VALID_CONTRIBUTES.has(c)) {
            errors.push(`${where}: "contributes" has an invalid entry ${JSON.stringify(c)}`);
          }
        });
      }

      if (entry.roleFamily !== null && !isNonEmptyString(entry.roleFamily)) {
        errors.push(`${where}: "roleFamily" must be null or a non-empty string`);
      }

      if (entry.publishedOn !== null && !(isNonEmptyString(entry.publishedOn) && DATE_RE.test(entry.publishedOn))) {
        errors.push(`${where}: "publishedOn" must be null or "YYYY-MM-DD"`);
      }

      if (typeof entry.robotsAllows !== "boolean") {
        errors.push(`${where}: "robotsAllows" must be a boolean`);
      } else if (entry.robotsAllows === false) {
        errors.push(`${where}: "robotsAllows" is false — a source robots.txt disallows may not be registered`);
      }

      // Null is the researcher saying "could not tell". That is an honest answer, and
      // `check` settles it with a real plain GET — a guessed boolean would be worse.
      if (entry.readableWithoutJs !== null && typeof entry.readableWithoutJs !== "boolean") {
        errors.push(`${where}: "readableWithoutJs" must be a boolean, or null when unknown`);
      }
    });

    if (data.rejected !== undefined) {
      if (!Array.isArray(data.rejected)) {
        errors.push(`${file}: "rejected" must be an array`);
      } else {
        data.rejected.forEach((entry, index) => {
          const where = `${file} rejected[${index}]`;
          if (!isNonEmptyString(entry?.url)) errors.push(`${where}: missing or empty "url"`);
          if (!isNonEmptyString(entry?.reason)) errors.push(`${where}: missing or empty "reason"`);
        });
      }
    }

    if (data.gaps !== undefined) {
      if (!Array.isArray(data.gaps)) {
        errors.push(`${file}: "gaps" must be an array`);
      } else {
        data.gaps.forEach((entry, index) => {
          if (!isNonEmptyString(entry)) errors.push(`${file} gaps[${index}]: must be a non-empty string`);
        });
      }
    }
  }

  return errors;
}

function cmdValidate(dir) {
  const files = loadPartitionFiles(dir);
  if (files.length === 0) {
    console.log(`No partition files found in ${dir}.`);
    return 0;
  }
  const errors = validateRegister(files);
  const sourceCount = files.reduce((n, f) => n + (f.data.sources?.length ?? 0), 0);

  if (errors.length === 0) {
    console.log(`${files.length} partition file(s), ${sourceCount} source(s): valid.`);
    return 0;
  }

  console.error(`${errors.length} problem(s) found:`);
  for (const error of errors) console.error(`  - ${error}`);
  return 1;
}

// ---------------------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------------------

function matchesOnly(entry, only) {
  if (!only) return true;
  return (entry.companyName ?? "").toLowerCase() === only.toLowerCase();
}

function matchesPartition(file, data, partition) {
  if (!partition) return true;
  const stem = basename(file, ".json");
  return (
    (data.partition ?? "").toLowerCase() === partition.toLowerCase() ||
    stem.toLowerCase() === partition.toLowerCase()
  );
}

async function cmdCheck(dir, { only, partition } = {}) {
  const files = loadPartitionFiles(dir);
  let checked = 0;
  let blocked = 0;
  let failed = 0;

  for (const { file, path, data } of files) {
    if (!matchesPartition(file, data, partition)) continue;
    if (!Array.isArray(data.sources)) continue;

    let changed = false;
    for (const entry of data.sources) {
      if (!matchesOnly(entry, only)) continue;
      const result = await checkOne(entry);
      entry.check = result;
      changed = true;
      checked += 1;
      if (!result.robotsAllowed) {
        blocked += 1;
        console.log(`checking ${entry.url} … blocked by robots.txt`);
      } else if (result.error || (result.httpStatus && result.httpStatus >= 400)) {
        failed += 1;
        console.log(`checking ${entry.url} … failed (${result.error ?? `HTTP ${result.httpStatus}`})`);
      } else {
        console.log(`checking ${entry.url} … ok (${result.readableChars} readable char(s))`);
      }
    }

    if (changed) writePartitionFile(path, data);
  }

  console.log(`\nChecked ${checked} source(s): ${blocked} blocked, ${failed} failed, ${checked - blocked - failed} ok.`);
  return 0;
}

// ---------------------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------------------

const ORIGIN_LABELS = { employer: "Employer", author: "Author", open_licence: "Open licence" };
const ORIGIN_ORDER = { employer: 0, author: 1, open_licence: 2 };

function mdEscape(text) {
  return String(text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function mdLink(title, url) {
  return `[${mdEscape(title || url)}](${url})`;
}

function checkCell(entry, field) {
  const check = entry.check;
  if (!check) return "unchecked";
  if (field === "robots") return check.robotsAllowed ? "allowed" : "blocked";
  if (field === "readable") {
    if (check.readableChars === null || check.readableChars === undefined) return "n/a";
    return `${check.readable ? "yes" : "no"} (${check.readableChars} chars)`;
  }
  if (field === "checked") return check.checkedAt ?? "—";
  return "—";
}

/**
 * Builds `REGISTER.md` from the loaded partition files. Pure and deterministic: every
 * list is explicitly sorted, so re-rendering the same JSON produces byte-identical output.
 */
export function renderMarkdown(files) {
  const sortedFiles = [...files].sort((a, b) => a.file.localeCompare(b.file));

  const lines = [];
  lines.push("# Source register");
  lines.push("");
  lines.push(
    "This is the register of sources the interviewer may read for company-specific process " +
      "detail and reported interview questions (PRD §04, Tier B). It is generated from the " +
      "JSON files in this directory by `node scripts/source-register.mjs render` — **edit " +
      "the JSON, not this file.** Regenerate after any change to the data or after running " +
      "`check`.",
  );
  lines.push("");
  lines.push(
    "Every source here still needs the owner's per-source review (PRD §04), and the whole " +
      "register needs a legal review before public launch (PRD §16). Nothing here has had " +
      "either yet.",
  );
  lines.push("");

  // ---- Summary: company -> counts by origin, across every partition. ----
  const byCompany = new Map();
  for (const { data } of sortedFiles) {
    for (const entry of data.sources ?? []) {
      const company = entry.companyName ?? "(unknown)";
      if (!byCompany.has(company)) {
        byCompany.set(company, { employer: 0, author: 0, open_licence: 0 });
      }
      const counts = byCompany.get(company);
      if (entry.origin in counts) counts[entry.origin] += 1;
    }
  }
  const companiesSorted = [...byCompany.keys()].sort((a, b) => a.localeCompare(b));

  lines.push("## Summary");
  lines.push("");
  lines.push("| Company | Employer | Author | Open licence | Total |");
  lines.push("|---|---|---|---|---|");
  for (const company of companiesSorted) {
    const c = byCompany.get(company);
    const total = c.employer + c.author + c.open_licence;
    lines.push(`| ${mdEscape(company)} | ${c.employer} | ${c.author} | ${c.open_licence} | ${total} |`);
  }
  lines.push("");

  // ---- Per partition, per company: the sources themselves. ----
  for (const { file, data } of sortedFiles) {
    const partitionLabel = data.partition ?? basename(file, ".json");
    lines.push(`## ${mdEscape(partitionLabel)}`);
    lines.push("");

    const companies = new Map();
    for (const entry of data.sources ?? []) {
      const company = entry.companyName ?? "(unknown)";
      if (!companies.has(company)) companies.set(company, []);
      companies.get(company).push(entry);
    }
    const names = [...companies.keys()].sort((a, b) => a.localeCompare(b));

    if (names.length === 0) {
      lines.push("_No sources recorded yet._");
      lines.push("");
    }

    for (const company of names) {
      lines.push(`### ${mdEscape(company)}`);
      lines.push("");
      lines.push("| Title | Origin | Publisher | Basis | Published | Checked | Robots | Readable |");
      lines.push("|---|---|---|---|---|---|---|---|");
      const entries = [...companies.get(company)].sort((a, b) => {
        const rank = (ORIGIN_ORDER[a.origin] ?? 9) - (ORIGIN_ORDER[b.origin] ?? 9);
        if (rank !== 0) return rank;
        return (a.title ?? "").localeCompare(b.title ?? "");
      });
      for (const entry of entries) {
        lines.push(
          `| ${mdLink(entry.title, entry.url)} | ${ORIGIN_LABELS[entry.origin] ?? entry.origin} | ` +
            `${mdEscape(entry.publisher)} | ${mdEscape(entry.basis)} | ${entry.publishedOn ?? "—"} | ` +
            `${mdEscape(checkCell(entry, "checked"))} | ${mdEscape(checkCell(entry, "robots"))} | ` +
            `${mdEscape(checkCell(entry, "readable"))} |`,
        );
      }
      lines.push("");
    }
  }

  // ---- Rejected, per partition. ----
  lines.push("## Rejected");
  lines.push("");
  for (const { file, data } of sortedFiles) {
    const partitionLabel = data.partition ?? basename(file, ".json");
    const rejected = [...(data.rejected ?? [])].sort((a, b) => (a.url ?? "").localeCompare(b.url ?? ""));
    lines.push(`### ${mdEscape(partitionLabel)}`);
    lines.push("");
    if (rejected.length === 0) {
      lines.push("_Nothing recorded._");
    } else {
      for (const entry of rejected) {
        lines.push(`- ${entry.url} — ${mdEscape(entry.reason)}`);
      }
    }
    lines.push("");
  }

  // ---- Gaps, per partition. ----
  lines.push("## Gaps");
  lines.push("");
  for (const { file, data } of sortedFiles) {
    const partitionLabel = data.partition ?? basename(file, ".json");
    const gaps = [...(data.gaps ?? [])].sort((a, b) => a.localeCompare(b));
    lines.push(`### ${mdEscape(partitionLabel)}`);
    lines.push("");
    if (gaps.length === 0) {
      lines.push("_Nothing recorded._");
    } else {
      for (const gap of gaps) lines.push(`- ${mdEscape(gap)}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function cmdRender(dir) {
  const files = loadPartitionFiles(dir);
  const markdown = renderMarkdown(files);
  const outPath = join(dir, "REGISTER.md");
  writeFileSync(outPath, markdown, "utf8");
  console.log(`Wrote ${outPath} from ${files.length} partition file(s).`);
  return 0;
}

// ---------------------------------------------------------------------------------------
// import
// ---------------------------------------------------------------------------------------

function pollIntervalMs() {
  return Number(process.env.SOURCE_REGISTER_POLL_INTERVAL_MS ?? 5000);
}

/** The pause between POSTs (task 036: "Pause ≥1s between posts"). Lazy, for the same
 * reason as the other timing knobs above. */
function postIntervalMs() {
  return Number(process.env.SOURCE_REGISTER_POST_INTERVAL_MS ?? 1000);
}

export function passesCheck(entry) {
  const check = entry.check;
  if (!check) return false;
  if (!check.robotsAllowed) return false;
  if (typeof check.httpStatus !== "number" || check.httpStatus < 200 || check.httpStatus >= 300) return false;
  if (!check.readable) return false;
  return true;
}

async function pollUntilSettled(apiBase, headers, urls, timeoutMinutes) {
  const deadline = Date.now() + timeoutMinutes * 60_000;
  const pending = new Set(urls);
  let lastList = [];

  while (pending.size > 0 && Date.now() < deadline) {
    const response = await fetch(`${apiBase}/api/v1/admin/sources`, { headers });
    if (!response.ok) {
      throw new Error(`GET /api/v1/admin/sources failed: HTTP ${response.status}`);
    }
    lastList = await response.json();
    for (const source of lastList) {
      if (pending.has(source.url) && source.status !== "pending") {
        pending.delete(source.url);
      }
    }
    if (pending.size > 0) await sleep(pollIntervalMs());
  }

  return lastList;
}

async function cmdImport(dir, { only, dryRun, timeoutMinutes } = {}) {
  const apiBase = process.env.API_BASE_URL;
  const token = process.env.ADMIN_ACCESS_TOKEN;
  if (!dryRun && (!apiBase || !token)) {
    console.error("API_BASE_URL and ADMIN_ACCESS_TOKEN must be set (unless --dry-run).");
    return 1;
  }

  const files = loadPartitionFiles(dir);
  const candidates = [];
  for (const { data } of files) {
    for (const entry of data.sources ?? []) {
      if (!matchesOnly(entry, only)) continue;
      candidates.push(entry);
    }
  }

  const toImport = [];
  for (const entry of candidates) {
    if (passesCheck(entry)) {
      toImport.push(entry);
    } else {
      console.log(`skip ${entry.url}: ${entry.check ? "failed its last check" : "never checked"}`);
    }
  }

  console.log(`${toImport.length} of ${candidates.length} candidate(s) pass their last check.`);

  if (dryRun) {
    for (const entry of toImport) {
      console.log(
        `would POST ${entry.url} (company=${entry.companyName}, origin=${entry.origin}, publishedOn=${entry.publishedOn ?? "null"})`,
      );
    }
    return 0;
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  for (const entry of toImport) {
    const body = {
      url: entry.url,
      title: entry.title,
      publisher: entry.publisher,
      companyName: entry.companyName,
      origin: entry.origin,
      publishedOn: entry.publishedOn,
    };
    const response = await fetch(`${apiBase}/api/v1/admin/sources/links`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    console.log(
      response.ok
        ? `POST ${entry.url} … ${response.status}`
        : `POST ${entry.url} … ${response.status} ${await response.text()}`,
    );
    await sleep(postIntervalMs());
  }

  console.log("\nPolling for every imported source to settle…");
  const settled = await pollUntilSettled(
    apiBase,
    headers,
    toImport.map((e) => e.url),
    timeoutMinutes ?? 20,
  );

  console.log("\nurl\tstatus\tquestions");
  for (const entry of toImport) {
    const row = settled.find((s) => s.url === entry.url);
    console.log(`${entry.url}\t${row?.status ?? "unknown"}\t${row?.questionCount ?? "-"}`);
  }

  return 0;
}

// ---------------------------------------------------------------------------------------
// CLI plumbing.
// ---------------------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

export async function run(argv) {
  const [command, ...rest] = argv;
  const args = parseArgs(rest);
  const dir = resolve(args.dir ?? DEFAULT_DIR);

  switch (command) {
    case "validate":
      return cmdValidate(dir);
    case "check":
      return cmdCheck(dir, { only: args.only, partition: args.partition });
    case "render":
      return cmdRender(dir);
    case "import":
      return cmdImport(dir, {
        only: args.only,
        dryRun: Boolean(args["dry-run"]),
        timeoutMinutes: args["timeout-minutes"] ? Number(args["timeout-minutes"]) : undefined,
      });
    default:
      console.error("Usage: source-register.mjs <validate|check|render|import> [options]");
      return 1;
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code ?? 0),
    (error) => {
      console.error(error?.stack ?? String(error));
      process.exit(1);
    },
  );
}
