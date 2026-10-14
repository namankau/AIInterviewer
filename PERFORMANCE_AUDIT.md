# Performance audit — 13 October 2026

## Scope and confidence

Phase 1 only. This audit reads the current `develop` application and its existing production build. No application code, database schema, or AI prompts were changed. User-visible delay estimates below are **inferred from code** unless explicitly marked **measured**. A code path proves a wait or repeated work, but does not prove its duration on a candidate's device.

The local Next production server started, but this sandbox denied even a loopback request to `127.0.0.1:3000` (`curl: (7) ... Bad access`). There is no authenticated browser session, reachable API/database, Lighthouse, or React Profiler trace here. Consequently **LCP, INP, TBT, endpoint response times, query plans, and real click-to-paint times are unmeasured**. A live interview or model call was not run, in accordance with `AGENTS.md`.

### Application map

| Area | Implementation | Main action-to-feedback path |
| --- | --- | --- |
| Framework and routing | Next.js 16 App Router, React 19, TypeScript; Spring Boot/Kotlin `/api/v1`; Supabase Auth/Postgres | Next `Link`/router navigation; protected routes pass through `src/proxy.ts` and `getClaims()`; client components then obtain a token and fetch the API. |
| State and data | Local React state/hooks plus two module-level external stores for course and Arena progress; `fetch` wrapper in `apps/web/src/lib/api.ts`; no general query cache | Token lookup → client effect → API → state update → render. Courses and Arena progress use shared stores and optimistic local writes. |
| Build | Next/Turbopack production build; Tailwind; Gradle backend | Static course/chapter routes; dynamic dashboard; code editor and Excalidraw in the room; Pyodide in a worker. |
| Login | `/login` → Google OAuth → `/auth/callback` → protected destination | Sign-in button sets `pending` immediately, then OAuth redirect and cookie exchange; destination page performs its own client data fetch. |
| Dashboard/history/profile | `/dashboard`, `/history`, `/profile` | Skeleton/placeholder → token → parallel endpoint calls → whole dashboard/profile state commit. Delete waits for server before removing its row. |
| Interview setup and core action | `/interview/new` → optional loop brief/prep plan → `/interview/[id]` | Forms show pending state; start POST composes opening material before returning; room GETs session, device check, begin POST, then audio capture → turn POST → next question. |
| Reports | `/report/[id]` | Report skeleton → token → GET; first GET can generate the report with an AI call; later GETs read stored data. |
| Lists/search/learning | `/questions`, `/questions/[slug]`, `/courses`, `/courses/[course]/[chapter]`, `/arena/[course]` | Question detail uses 20-row pages; catalogue search filters four course cards locally; Arena practice fetches its course corpus after hydration. Course completion updates locally before API confirmation. |
| Checkout | No active checkout/payment flow | Payment work is out of scope. |

### Existing baseline (artifact measurements)

The existing `.next` production build was dated 13 October 2026. Counting distinct JS files referenced by each route's client-reference manifest and their **uncompressed filesystem size** gives: landing **309 KiB**, login **310 KiB**, dashboard **392 KiB**, interview setup **360 KiB**, interview room **884 KiB**, report **352 KiB**, chapter **477 KiB**, Arena course **381 KiB**. These are **measured build-artifact sizes**, not transferred bytes, executed bytes, or a Web Vitals score. The design room's separate `react-loadable-manifest.json` names additional chunks; two are **589,062 B** and **531,189 B** uncompressed. Compression, caching, navigation mode, and the exact chunks loaded in a browser need a network trace.

## Executive summary: five issues candidates would most feel

1. **The interview room can rerender its editor or drawing board on every microphone animation frame** (F01). This is the clearest risk to typing, drawing, and button responsiveness during the core experience.
2. **Starting a session waits for opening composition before navigation** (F02). The button responds, but the candidate stays on setup until the model path completes.
3. **The dashboard holds all real content behind its slowest of four requests** (F03), including readiness computation that reads complete report JSON for every completed round (F04).
4. **The first report view runs AI generation inside its GET request** (F05). Its skeleton is good feedback, but the valuable result cannot appear until that entire call completes.
5. **The free-text company setup makes the loop brief a hard gate** (F06). Its loading state offers no way forward, while brief and plan also repeat loop resolution, which may be model-backed. The structured setup path bypasses this step.

## Findings

| ID | Location (file:line) | Interaction affected | Symptom | Likely cause | Estimated delay | Severity | Fix effort |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F01 | `apps/web/src/lib/use-interview-capture.ts:80`; `apps/web/src/components/interview-room.tsx:729` | Speaking while typing/drawing | Potential input jank | RAF `setLevel` rerenders the room, which reconstructs DSA/Excalidraw child props | **Inferred from code:** one state update per animation frame; click delay unmeasured | High | M |
| F02 | `apps/web/src/components/new-interview-form.tsx:570`; `apps/api/src/main/kotlin/com/interviewos/api/interview/InterviewService.kt:315` | Start interview | Setup remains pending before room navigation | POST completes opening composition synchronously | **Inferred from code:** includes one or more model calls; seconds unmeasured | High | L |
| F03 | `apps/web/src/components/dashboard-panel.tsx:126` | First dashboard paint after login/navigation | Greeting and primary action remain skeleton until every endpoint settles | One `Promise.allSettled` commits the whole view | **Inferred from code:** wait equals slowest of four requests; duration unmeasured | High | S |
| F04 | `apps/api/src/main/kotlin/com/interviewos/api/interview/SessionRepository.kt:1139`; `ReadinessService.kt:20` | Dashboard/readiness and prep plan | Time and payload rise with account history | Unbounded full report JSON read; each payload parsed repeatedly in Kotlin | **Inferred from code:** grows with completed reports; duration unmeasured | High | L |
| F05 | `apps/api/src/main/kotlin/com/interviewos/api/interview/ReportService.kt:35`; `apps/web/src/components/report-view.tsx:34` | Open first report | Long skeleton-only wait | First GET composes and stores report synchronously | **Inferred from code:** model call on critical path; duration unmeasured | High | L |
| F06 | `apps/web/src/components/loop-brief-step.tsx:62`; `apps/api/src/main/kotlin/com/interviewos/api/loopbrief/PrepPlanService.kt:39` | Free-text company setup | Cannot continue while brief loads; plan may lag | Loading branch has no skip; brief and plan each call `resolveLoop` | **Inferred from code:** includes model-backed resolution on some paths; duration unmeasured | High | M |
| F07 | `apps/web/src/app/page.tsx:35`; `apps/web/src/lib/api.ts:143` | Public landing load | Hero waits on decorative usage counters when API is slow | Server awaits `fetchUsage` before rendering; no explicit timeout | **Inferred from code:** bounded only by fetch/platform timeout; duration unmeasured | Medium | S |
| F08 | `apps/web/src/components/interview-room.tsx:373` | Stop answer | Processing state appears after recorder finalization | `await capture.stop()` precedes `setPhase("submitting")` | **Inferred from code:** recorder finalization delay, magnitude unmeasured | Medium | S |
| F09 | `apps/web/src/lib/use-question-audio.ts:70` | Next question voice | Polling can issue overlapping GETs on a slow link | 400 ms interval starts a new async request without an in-flight guard | **Inferred from code:** first check at 400 ms; later checks on a 400 ms cadence; network delay unmeasured | Medium | S |
| F10 | `apps/api/src/main/kotlin/com/interviewos/api/interview/SessionRepository.kt:193` | Dashboard/history/profile | History payload and DB work grow without bound | `listSessions` has no limit/cursor; dashboard only displays a few | **Inferred from code:** grows with all rounds; duration unmeasured | Medium | M |
| F11 | `apps/web/src/components/arena/arena-course-practice.tsx:46` | Open Arena course practice | Practice panel stays on loading text after page renders | Full course challenge corpus fetched and parsed only after hydration | **Inferred from code:** one additional request plus full-corpus parse; duration unmeasured | Medium | M |
| F14 | `apps/web/src/components/profile-panel.tsx:85,138` | Open profile / upload resume | Resume details wait for unrelated data; upload confirmation waits for another GET | Profile commits after four requests; upload then refetches profile serially | **Inferred from code:** slowest-load and extra-round-trip waits; duration unmeasured | Medium | S |
| F12 | `apps/web/src/lib/use-access-token.ts:17` | First authenticated screen | Repeated session work before API calls | Each mounted consumer invokes `getSession()` and subscribes, even with module-cached token | **Inferred from code:** repeated async work; duration unmeasured | Low | S |
| F13 | `apps/web/src/components/question-bank-index.tsx:73` | Question-bank index | Potential slow rendering only if company count becomes large | Per-company array copying and unpaginated render | **Inferred from code:** scales with company count; current impact unmeasured | Low | S |

### F01 — microphone level drives the entire room

```tsx
// use-interview-capture.ts:80–82
setLevel(level);
rafRef.current = requestAnimationFrame(tick);
// interview-room.tsx:729–730
<DsaWorkspace problem={workspace.problem} board={session?.board ?? null} onBoardChange={onBoardChange} />
```

The capture hook lives in `InterviewRoom`; each animation frame updates its state. The room builds a workspace node in render, while `DsaWorkspace` renders CodeMirror and `DesignWorkspace` renders Excalidraw. React may bail out inside those libraries, but this code gives them avoidable parent work on every frame. **Confidence: high that renders are requested; medium that this produces perceptible jank.** Proposed fix: isolate the meter/speaking indicator behind a subscribed leaf or throttle its React updates, and memoize the stable workspace boundary. Preserve timing measurements at their current sample rate. Profile commits and input event-to-paint while recording before choosing the exact split.

### F02 — session creation is a synchronous model path

```tsx
// new-interview-form.tsx:570–586
const session = await startSession(accessToken, { /* round and consent */ });
onStart(session.id);
```

`InterviewService.start` calls `composeAndOpen` before returning. That path may compose a workspace or opening question through Gemini. The button has a pending state, so the problem is the long wait for a room, not a dead click. **Confidence: high for the critical path; low for the duration.** Proposed fix: measure stage timings first, then consider an accepted/session-preparing response with a stable status endpoint so navigation can happen promptly and the room can show preparation progress. This changes API state transitions and needs careful retry/idempotency design; do not simply fire and forget the model call.

### F03 — dashboard waits for its slowest endpoint

```tsx
// dashboard-panel.tsx:126–137
Promise.allSettled([fetchEntitlement({ accessToken }), fetchSessions({ accessToken }),
  fetchReadiness({ accessToken }), fetchMe({ accessToken })])
  .then(([ent, list, ready, candidate]) => setDashboard({ /* ... */, loaded: true }));
```

The skeleton is useful, but even a quick `me` or entitlement response cannot show the greeting or Start action until readiness and history finish. **Confidence: high.** Proposed fix: let identity/entitlement render as soon as they resolve and keep independent history/readiness placeholders. Keep token ownership checks so one user's data never flashes for another.

### F04 — readiness reads and reparses every full report

```kotlin
// SessionRepository.kt:1143–1149
select s.company_name, s.role_title, s.ended_at, r.payload::text as payload
  from public.sessions s join public.session_reports r on r.session_id = s.id
 where s.user_id = :u and s.status = 'completed'
```

`ReadinessService` groups every row and calls `hasEnoughEvidence`, `competenciesOf`, and, for recurring weaknesses, those parsers again. This is especially costly because readiness is also called inside `PrepPlanService.readinessFor`, which then keeps just one company/role. Existing migrations include `sessions_user_company_role_idx` and `sessions_user_id_created_at_idx`; **this audit does not claim a missing index**. **Confidence: high for repeated work; low for present-day user impact without row counts/EXPLAIN.** Proposed fix: parse once per row, query only the company/role for `readinessFor`, and consider a compact derived summary once actual history volumes justify it. Preserve the evidence threshold and grouping semantics.

### F05 — report generation occupies the first GET

```kotlin
// ReportService.kt:40 and 177–180 (separate excerpts)
repository.findReportJson(sessionId, userId)?.let { payload ->
val composed =
    AiSpendContext.of(userId, sessionId) {
        interviewAi.composeReport(
```

The report view renders a thoughtful loading state, but the first request cannot produce the report until model generation and grounding complete. A second request during generation gets `report_generating`. **Confidence: high for the mechanism; low for actual duration.** Proposed fix: time generation and wait first. If it is a material pain point, start durable generation at round completion and expose status/retry; keep the current lease, immutable report, and evidence checks. This is a larger state-machine change.

### F06 — brief and plan redo loop resolution

```tsx
// loop-brief-step.tsx:62, 72, 110–115 (separate excerpts)
fetchLoopBrief(query, { accessToken })
  .then((result) => active && setBrief(result))
fetchPrepPlan(query, { accessToken })
  .then((result) => active && setPlan(result))
if (!brief) {
  return (
    <p className="rounded-2xl border border-line bg-surface-raised p-6 text-body text-ink-muted shadow-[var(--shadow-sm)]">
      Reading how {companyName} interviews…
    </p>
  );
}
```

On the free-text path for a named company, while `brief` is null, the component returns only “Reading how … interviews”; the candidate cannot choose **Skip** until the request finishes or fails. The structured company/role/round path bypasses the brief. Both backend services call `resolveLoop`; that can read the directory, sources, cached general pattern, and model employer knowledge. Requests are parallel, so this is not necessarily a two-call waterfall, but it duplicates work and may make the plan lag. **Confidence: high for the hard gate and duplicate resolution; medium for real-world duration.** Proposed fix: expose Skip during loading first. Then share a resolved result through a combined brief-and-plan response or safe request-scoped cache. Keep provenance labels and source/model separation unchanged.

### F07 — optional counters gate the landing page

```tsx
// app/page.tsx:35
const usage = await fetchUsage();
```

The server awaits a decorative statistic before it can return the marketing page. `fetchUsage` catches errors and uses a 300-second revalidation policy, but has no short failure deadline for an uncached slow API. **Confidence: high for blocking behavior; low for frequency.** Proposed fix: stream the counter behind a Suspense boundary or serve the hero without counters until a bounded fetch completes. Keep only true, verified counts.

### F08 — recorder finalization precedes visible submit state

```tsx
// interview-room.tsx:373–377
const captured = await capture.stop();
if (!captured) return;
liveTranscript.stop();
setPhase("submitting");
```

The candidate's Stop/Submit action waits for `MediaRecorder.onstop` and Blob construction before the room says it is submitting. **Confidence: high for order; low for delay.** Proposed fix: display a `finalizing`/processing state immediately on click, disable repeat submission, then proceed with capture finalization. Keep the actual upload gated on a valid Blob.

### F09 — audio polling can overlap

```tsx
// use-question-audio.ts:70–81
const timer = setInterval(async () => {
  const latest = await fetchTurn(sessionId, turnIndex, { accessToken });
  if (latest.questionAudioStatus === "pending") return;
}, POLL_INTERVAL_MS); // 400 ms
```

When one GET lasts longer than 400 ms, another can start. Polling resolution may arrive out of order, and extra authenticated requests compete with the next turn on a weak connection. The first check starts at 400 ms and later checks are 400 ms apart; this is **not a measured latency**. **Confidence: high.** Proposed fix: one in-flight poll at a time with a delay after completion, plus cancellation on turn change; compare detection time and request count before/after.

### F10 — history endpoint is unbounded

```sql
-- SessionRepository.kt:197–204
select ... from public.sessions s
left join public.session_reports r on r.session_id = s.id
where s.user_id = :u order by s.created_at desc
```

The dashboard displays only a small recent slice, but `fetchSessions` receives all sessions. History legitimately needs older rows; the API has no cursor to serve them in pages. **Confidence: high for growth; low for current impact.** Proposed fix: a bounded recent-sessions request for dashboard/profile and cursor pagination for history. The existing `(user_id, created_at desc)` index supports that direction; confirm with a real query plan.

### F11 — Arena practice loads the whole course after hydration

```tsx
// arena-course-practice.tsx:46–55
useEffect(() => {
  fetch(`/api/arena/challenges/${courseSlug}`)
    .then((res) => res.json() as Promise<Challenge[]>).then(setAllCourseChallenges);
}, [courseSlug]);
```

The page shell can render first, then a full corpus request and JSON parse must finish before practice is usable. This is an intentional trade-off against putting hundreds of cards and visualization frames into static HTML; it should be measured before changing. **Confidence: high for the extra request; low for perceptible delay.** Proposed fix if the trace warrants it: cache/prefetch the likely next course corpus or split a small session-selection payload from full card content while preserving personal review scheduling.

### F14 — profile details wait for unrelated requests

```tsx
// profile-panel.tsx:85–91, 138–141 (separate excerpts)
Promise.allSettled([
  fetchProfile({ accessToken }), fetchMe({ accessToken }),
  fetchSessions({ accessToken }), fetchArenaProgress({ accessToken }),
]).then(/* commit profile as one loaded state */);
await uploadResume(operationToken, file);
const details = await fetchProfile({ accessToken: operationToken });
```

The profile skeleton waits for the slowest of profile, identity, history, and Arena even though resume details are its primary content. After a resume upload, the screen waits for a second request before showing the parsed details and “Saved.” The second fetch may be needed for detected skills, so removing it outright could change behavior. **Confidence: high for the waterfalls; low for their real duration.** Proposed fix: reveal profile details as soon as their own request finishes; show independent placeholders for secondary sections. For upload, use the `ResumeView` response for immediate resume feedback, then reconcile skills from the profile GET, while retaining error behavior.

## Quick wins (each likely under 30 minutes)

1. F08: show processing state before awaiting recorder finalization.
2. F09: prevent overlapping question-audio polls.
3. F07: set a short, explicit deadline for optional landing counters and render the hero without them on timeout.
4. F03: let the dashboard's primary greeting/action render from early endpoint results while the lower sections finish. This is a small code change but needs a privacy regression test.

These are proposals for Phase 2, **not changes made in this audit**. F01 may also be quick once a profiler confirms the workspace commits, but the correct isolation point needs measurement.

## Measurement plan and acceptance evidence

| Finding(s) | Profile/experiment | Record before and after |
| --- | --- | --- |
| F01, F08 | Chrome Performance + React Profiler on a consented test account, while speaking, typing in DSA, drawing in design, and stopping capture; CPU throttle 4× | INP and event-to-next-paint for editor/pointer/Stop; long tasks; room/workspace commits per second; recorder-stop-to-processing-state. |
| F02, F06 | Add privacy-safe server spans around `resolveLoop`, workspace/opening composition, and session creation; browser Network waterfall for setup | click-to-pending, click-to-room, each AI/DB segment, number of model-backed resolutions. No live AI test without owner approval. |
| F03, F04, F10, F12, F14 | Authenticated navigation trace plus API timings; representative test accounts with 0, 20, 200 rounds; `EXPLAIN (ANALYZE, BUFFERS)` on sanitized staging data | dashboard/profile skeleton duration and time to primary content; upload-to-resume-feedback; per-endpoint p50/p95; report rows/bytes parsed; session payload bytes; token lookups; query plan and buffers. |
| F05 | Report GET trace for new and stored report; server generation span | first-report wait p50/p95, stored-report p50/p95, generation retries/conflicts; confirm report correctness separately. No live AI test without owner approval. |
| F07 | Lighthouse mobile and Chrome Network under warm/cold cache and deliberately delayed usage API | LCP, TBT, TTFB, hero paint, counter arrival. |
| F09 | Throttled-network trace of one pending question audio, including a >400 ms GET | concurrent poll count, total GET count, speech-ready-to-play gap. |
| F11 | Chrome Network/Performance on Arena course, cold/warm cache, mid-tier phone throttle | click-to-practice-ready, payload transfer size, JSON parse task, memory; compare against chapter/course JS cost. |
| All routes | Lighthouse mobile/desktop and Web Vitals in a deployed test environment | LCP/INP/TBT/CLS by route and device; JS transferred/executed, cache status, font/image requests. |

No current finding is based on an observed missing database index, layout thrashing, 300 ms tap delay, or unnecessary image transfer. The public assets are small, `next/image` is used for brand/testimonial imagery, Pyodide runs in a worker, DSA Python warms at room entry, question detail is paginated, and Excalidraw is already dynamically imported. Those paths still need a browser trace to rule out device-specific problems.

## Assumptions and Phase 2 boundary

- Priority reflects a candidate using the voice interview as the core product, with dashboard and report as the next most frequent/high-value screens. Actual traffic and device mix were unavailable.
- The build artifact matches the checked-out `develop` application; the repo's branch contents were compared before creating this report branch.
- No caching/optimistic change should weaken authorization, show another account's data, invent employer evidence, or report a successful write before it is durable. If a Phase 2 fix trades freshness for speed, document its staleness window and failure path with the before/after measurement.
- Phase 2 requires owner approval. Fixes should follow measured priority, one logical change per commit, with the existing frontend and backend verification loop before and after. No new dependency is proposed.
