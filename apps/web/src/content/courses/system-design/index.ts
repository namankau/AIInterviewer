import type { Block, Chapter, Course } from "@/content/courses/types";

type ChapterSpec = {
  slug: string;
  title: string;
  summary: string;
  analogy: [title: string, text: string];
  idea: string;
  flow: [string, string, string];
  best: string;
  check: string;
  pitfall: string;
  interview: string;
  lab?: "url-shortener" | "ticket-booking" | "rag-assistant" | "tool-using-agent";
  artifact?: Extract<Block, { kind: "compare" | "table" }>;
};

const labIntroductions: Record<NonNullable<ChapterSpec["lab"]>, string> = {
  "url-shortener": "A redirect path is read-heavy. Place the minimum components needed to create a collision-safe key, preserve the mapping and make repeat redirects quick. More than one arrangement can pass if every responsibility is covered.",
  "ticket-booking": "Two buyers are racing for the final seat. Compose a path that lets people browse quickly but makes one authoritative operation choose the winner. The checker looks for responsibilities, not a vendor-specific diagram.",
  "rag-assistant": "A useful answer needs authorised evidence before generation. Build the path from source content to retrieval to a cited answer, keeping private documents out of the wrong user's context.",
  "tool-using-agent": "The model may propose an action, but it must not become a real side effect without validation and permission. Assemble a bounded tool loop with an observation path and a clear stop.",
};

function makeChapter(spec: ChapterSpec, minutes = 13): Chapter {
  const blocks: Block[] = [
    {
      kind: "analogy",
      title: spec.analogy[0],
      text: spec.analogy[1],
    },
    {
      kind: "p",
      text: spec.idea,
    },
    {
      kind: "steps",
      title: "Build the picture in three moves",
      steps: [
        { label: spec.flow[0], text: `Start with **${spec.flow[0]}** and state what enters or leaves this stage.` },
        { label: spec.flow[1], text: `Add **${spec.flow[1]}** only after the first stage has a clear job.` },
        { label: spec.flow[2], text: `Finish with **${spec.flow[2]}**, then trace one request from end to end.` },
      ],
    },
    {
      kind: "concept",
      title: "The design move",
      text: spec.best,
    },
  ];

  if (spec.artifact) blocks.push(spec.artifact);

  if (spec.lab) {
    blocks.push(
      { kind: "h", text: "Architecture lab: make the trade-off visible" },
      { kind: "p", text: labIntroductions[spec.lab] },
      { kind: "architecturelab", scenarioId: spec.lab },
    );
  }

  blocks.push(
    {
      kind: "pitfall",
      items: [spec.pitfall, "Adding a fashionable component without explaining the failure or load it handles."],
    },
    {
      kind: "remember",
      items: [spec.best, spec.check, "Every box needs a job; every arrow needs data and a direction."],
    },
    {
      kind: "interview",
      items: [spec.interview, "Say the trade-off aloud and describe what would make you change the design."],
    },
    {
      kind: "quiz",
      question: `Which move is strongest when designing ${spec.title.toLowerCase()}?`,
      options: [spec.best, spec.pitfall, "Copy a large-company diagram before gathering requirements", "Optimise every component for maximum scale"],
      answer: 0,
      why: `The useful move is: ${spec.best} It connects a component to a requirement instead of decorating the diagram.`,
    },
    {
      kind: "quiz",
      question: "What should you verify before adding another box to this design?",
      options: ["Whether the box has a clear responsibility and solves a stated constraint", "Whether its logo looks familiar", "Whether it makes the diagram symmetrical", "Whether another candidate used it"],
      answer: 0,
      why: spec.check,
    },
  );

  return { slug: spec.slug, title: spec.title, summary: spec.summary, minutes, blocks };
}

const foundations: ChapterSpec[] = [
  {
    slug: "requirements-first",
    title: "Start With Requirements, Not Boxes",
    summary: "Turn a vague product idea into users, actions, limits and a design target.",
    analogy: ["Plan the trip before choosing the vehicle", "A bicycle is excellent for a nearby shop and terrible for moving a family across a country. Architecture choices only make sense after the journey is known."],
    idea: "Ask who uses the system, what they must do, what can wait, and what failure would hurt most. Separate must-haves from later wishes. A short requirement list prevents an impressive solution to the wrong problem.",
    flow: ["user goal", "system action", "success signal"],
    best: "Write three core user actions and two quality constraints before drawing components.",
    check: "Check that every proposed component supports a named action or constraint.",
    pitfall: "Starting with microservices, queues or databases before learning what the system must do.",
    interview: "Clarify scope in the first minutes: users, core actions, traffic shape, data size and the most important quality goal.",
    artifact: {
      kind: "compare",
      title: "Two kinds of requirement",
      columns: [
        { label: "What users do", items: ["Create a document", "Share a link", "Reserve a seat"] },
        { label: "How well it works", items: ["Loads within a target", "Survives a zone failure", "Prevents double booking"] },
      ],
    },
  },
  {
    slug: "functional-and-quality-requirements",
    title: "Functional and Quality Requirements",
    summary: "Tell what a system does apart from how well it must do it.",
    analogy: ["A restaurant menu and its service promise", "The menu says what can be ordered. The promise that food arrives warm within twenty minutes says how well the restaurant must perform."],
    idea: "Functional requirements describe visible capabilities such as create, search or share. Quality requirements describe speed, availability, durability, privacy and cost. Make important qualities measurable.",
    flow: ["capability", "quality target", "measurement"],
    best: "Rewrite vague words such as fast or reliable as a number measured over a time window.",
    check: "Check whether two people could independently decide if each requirement passed.",
    pitfall: "Calling everything a must-have and leaving no way to trade one quality against another.",
    interview: "Choose the two qualities that drive architecture and explain why the others are secondary for this product.",
  },
  {
    slug: "latency-throughput-and-reliability",
    title: "Latency, Throughput and Reliability",
    summary: "Measure waiting time, work per second and whether the service keeps its promise.",
    analogy: ["A supermarket checkout", "How long one shopper waits is latency. How many shoppers all tills serve per minute is throughput. Whether a till is open when promised is availability."],
    idea: "Latency is a distribution, so a p95 often says more than an average. Throughput counts completed work per unit time. Availability and durability answer different questions: can I use it now, and will my saved data still exist later?",
    flow: ["request arrives", "work completes", "metric recorded"],
    best: "Name the percentile and time window for latency, plus the unit for throughput.",
    check: "Check peak traffic and tail latency, not only daily averages.",
    pitfall: "Treating 99% availability as perfection; it still permits meaningful downtime.",
    interview: "Translate a product promise into a measurable service-level objective and discuss its cost.",
  },
  {
    slug: "back-of-the-envelope-estimation",
    title: "Back-of-the-Envelope Estimation",
    summary: "Estimate requests, storage and bandwidth well enough to expose the real bottleneck.",
    analogy: ["Packing water for a trek", "You do not need the exact number of sips. People × hours × rough consumption tells you whether to carry two bottles or arrange a water tanker."],
    idea: "State round assumptions, keep units beside every number, and calculate orders of magnitude. Estimate average and peak requests per second, bytes stored per day, retention, and outgoing bandwidth.",
    flow: ["assumptions", "calculation", "capacity decision"],
    best: "Use round numbers, show units and run a sensitivity check on the uncertain assumption.",
    check: "Check whether the answer changes by ten times at peak or with longer retention.",
    pitfall: "Producing precise-looking numbers from assumptions that were never stated.",
    interview: "Estimate aloud, invite correction, then connect the result to partitioning, caching or storage choices.",
  },
  {
    slug: "journey-of-a-request",
    title: "The Journey of a Request",
    summary: "Follow one click through DNS, the network, an application and storage.",
    analogy: ["A parcel with several sorting stops", "A parcel goes from local pickup through sorting centres to a destination. A request similarly crosses name lookup, networks and services before a response returns."],
    idea: "The browser resolves a name, opens a secure connection, sends an HTTP request, and receives a response. Proxies, load balancers, services, caches and databases may each add time or fail.",
    flow: ["client and DNS", "edge and service", "cache or database"],
    best: "Trace one request and one response before multiplying the system into many services.",
    check: "Check timeouts, retries and observability at every network boundary.",
    pitfall: "Drawing arrows without saying what protocol or data crosses them.",
    interview: "Use the request journey to locate latency, security boundaries and single points of failure.",
  },
  {
    slug: "api-contracts-and-idempotency",
    title: "API Contracts and Idempotency",
    summary: "Design interfaces that remain safe when clients retry and datasets grow.",
    analogy: ["A numbered token at a service desk", "If you repeat the same token, staff should not charge you twice. The token lets the desk recognise a retry instead of treating it as a new order."],
    idea: "An API contract defines inputs, outputs and errors. Pagination bounds work. Versioning protects clients. An idempotency key lets a server return the result of an earlier operation instead of repeating a side effect.",
    flow: ["validated request", "idempotency check", "stable response"],
    best: "Give retried write operations a client-generated idempotency key and store the result briefly.",
    check: "Check how duplicates, partial failures and pagination order are handled.",
    pitfall: "Retrying a payment-like write blindly and creating the action twice.",
    interview: "Specify success and error shapes, retry behaviour, pagination and compatibility—not merely endpoint names.",
  },
  {
    slug: "data-models-from-access-patterns",
    title: "Model Data From Access Patterns",
    summary: "Shape data around the questions the product asks most often.",
    analogy: ["Arrange a kitchen for the meals you cook", "A spice used every day belongs near the stove; a festival dish can live on a high shelf. Storage layout follows access frequency and grouping."],
    idea: "List entities, ownership, relationships and the hottest reads and writes. Choose identifiers deliberately. Normalise when consistency and flexible queries matter; duplicate selected data when a proven read path needs it.",
    flow: ["access pattern", "keys and relations", "query path"],
    best: "Write the top reads and writes before selecting tables, documents or indexes.",
    check: "Check ownership, uniqueness, deletion and how each hot query finds its rows.",
    pitfall: "Choosing a database category first and forcing the data model to fit it.",
    interview: "Walk through one write and two important reads using concrete keys.",
  },
  {
    slug: "a-repeatable-design-method",
    title: "A Repeatable Design Method",
    summary: "Use one calm sequence from requirements to bottlenecks and trade-offs.",
    analogy: ["A pilot's checklist", "Experienced pilots still use a checklist because pressure makes people skip basics. A design interview deserves the same protection."],
    idea: "Clarify scope, estimate scale, define APIs and data, draw a simple path, then deepen the risky parts. Finish with failures, observability, security and explicit trade-offs. Loop back when new facts appear.",
    flow: ["scope and scale", "simple design", "stress and refine"],
    best: "Keep a visible checklist and spend detail time on the requirement that drives risk.",
    check: "Check that the final design still satisfies the opening requirements.",
    pitfall: "Spending most of the interview naming components and no time validating the complete flow.",
    interview: "Narrate the method so the interviewer can redirect scope before you invest in the wrong branch.",
  },
];

const buildingBlocks: ChapterSpec[] = [
  {
    slug: "scale-up-and-scale-out", title: "Scale Up and Scale Out", summary: "Know when a larger machine helps and when work must spread across machines.",
    analogy: ["A bigger bus or more buses", "A bigger bus is simple until the road or vehicle reaches a limit. More buses add capacity but require routes, coordination and balanced passengers."],
    idea: "Vertical scaling adds resources to one machine and is operationally simple. Horizontal scaling adds machines and needs stateless work, load distribution and coordination. Most systems use both at different layers.",
    flow: ["measure saturation", "add capacity", "rebalance traffic"], best: "Scale only the measured bottleneck and preserve headroom for bursts.", check: "Check CPU, memory, network, storage and state—not merely request count.", pitfall: "Adding application replicas while a single database remains saturated.", interview: "Compare the simplicity ceiling of scale-up with the coordination cost of scale-out.",
  },
  {
    slug: "load-balancing-and-health", title: "Load Balancing and Health Checks", summary: "Send work only to instances that can safely accept it.",
    analogy: ["A host seating restaurant guests", "The host sends each party to an open table, avoids a table being cleaned and notices when a section closes."],
    idea: "A load balancer spreads requests using a policy. Readiness says an instance can receive traffic; liveness says it should be restarted. Draining lets in-flight work finish before removal.",
    flow: ["health signal", "routing decision", "healthy instance"], best: "Separate readiness from liveness and remove unhealthy instances from rotation quickly.", check: "Check whether health probes test dependencies without causing a dependency storm.", pitfall: "Using a shallow 200 response as proof that the whole request path works.", interview: "Discuss algorithms, sticky sessions, zone awareness and graceful draining only as requirements demand.",
  },
  {
    slug: "caching-layers", title: "Caching Without Stale Surprises", summary: "Use faster copies while planning expiry, invalidation and misses.",
    analogy: ["Keep daily items on the desk", "A notebook on your desk is faster than visiting an archive, but a changed address must reach the notebook or it becomes confidently wrong."],
    idea: "Caches may live in browsers, CDNs, services or databases. Pick a key, value, TTL and invalidation rule. Measure hit rate, miss cost and staleness tolerance. Protect the origin from stampedes.",
    flow: ["cache lookup", "origin on miss", "fill with expiry"], best: "Cache a proven read hotspot with an explicit staleness budget and miss path.", check: "Check invalidation, eviction, hot keys and what happens when the cache is empty.", pitfall: "Treating a cache as the source of truth or assuming invalidation is automatic.", interview: "Explain cache-aside, write-through or write-behind through one concrete read and update.",
  },
  {
    slug: "sql-and-nosql", title: "SQL, NoSQL and the Actual Workload", summary: "Choose a store from relationships, queries, consistency and scale—not fashion.",
    analogy: ["A ledger and labelled storage bins", "A ledger excels when entries relate and totals must agree. Labelled bins make known lookups easy, but cross-bin questions need extra planning."],
    idea: "Relational databases offer joins, constraints and transactions. Document, key-value, wide-column and graph stores optimise different shapes. The question is which access patterns and guarantees dominate.",
    flow: ["data relationships", "query patterns", "store choice"], best: "Choose the simplest store that meets the required queries and consistency guarantees.", check: "Check transactions, secondary queries, operations expertise and migration cost.", pitfall: "Selecting NoSQL because the system may become large, without a partition or query plan.", interview: "Compare two plausible stores against the same workload rather than reciting categories.",
    artifact: {
      kind: "compare",
      title: "Start from the dominant need",
      columns: [
        { label: "Relational", items: ["Related records and joins", "Strong constraints", "Flexible transactional queries"] },
        { label: "Key-value or document", items: ["Known-key access", "Flexible aggregate shape", "Straightforward horizontal partitioning"] },
      ],
    },
  },
  {
    slug: "indexes-and-query-cost", title: "Indexes and Query Cost", summary: "Trade extra write work and storage for faster reads.",
    analogy: ["The index at the back of a textbook", "An index jumps to a topic without scanning every page, but somebody must update it whenever the book changes."],
    idea: "An index is an ordered or hashed helper structure. Its column order matters. It speeds matching reads but costs storage and write maintenance. Query plans reveal whether it is used.",
    flow: ["query filter", "index lookup", "row fetch"], best: "Build indexes from frequent query predicates and sort order, then inspect the query plan.", check: "Check selectivity, write amplification, covering fields and unused indexes.", pitfall: "Indexing every column and slowing writes without improving important queries.", interview: "Design a composite index for one exact query and explain why field order matters.",
  },
  {
    slug: "replication-and-failover", title: "Replication and Failover", summary: "Keep copies for availability and read scale while handling lag honestly.",
    analogy: ["Duplicate answer sheets in separate rooms", "A second copy protects against a spilled drink, but it helps only if changes reach it and people know which copy is authoritative."],
    idea: "A leader may accept writes while replicas copy changes and serve reads. Synchronous replication reduces data loss but adds latency. Asynchronous replication is faster but can expose lag or lose recent writes during failover.",
    flow: ["write leader", "replicate change", "read or promote"], best: "Select replication mode from the allowed data-loss and latency budgets.", check: "Check replication lag, promotion, split-brain prevention and read-after-write needs.", pitfall: "Calling replicas backups; operator mistakes can replicate to every copy.", interview: "Describe a leader failure minute by minute, including detection and client reconnection.",
  },
  {
    slug: "partitioning-and-hot-keys", title: "Partitioning, Sharding and Hot Keys", summary: "Divide data and traffic without concentrating the busiest work.",
    analogy: ["Checkout lines split by surname", "Alphabetical lines divide people, but a school trip whose names share one letter can overload a single line."],
    idea: "Partitioning assigns records to shards by range, hash or directory. A good key spreads load and supports common queries. Rebalancing moves ownership safely as data grows.",
    flow: ["partition key", "shard routing", "local query"], best: "Choose a high-cardinality key that spreads peak traffic and preserves required locality.", check: "Check skew, cross-shard queries, resharding and globally unique identifiers.", pitfall: "Partitioning by a value that becomes a celebrity or time-based hot key.", interview: "Use estimated distribution to compare hash, range and tenant-aware partitioning.",
  },
  {
    slug: "consistency-and-cap", title: "Consistency and Network Partitions", summary: "Decide what users may observe when copies cannot communicate.",
    analogy: ["Two ticket counters after the phone line breaks", "Both counters can keep selling and risk duplicate seats, or one can stop until it can confirm availability. The broken link forces a choice."],
    idea: "During a network partition, a distributed service cannot guarantee both every request succeeds and every response reflects one latest order. Real designs choose per operation and often offer session guarantees or conflict resolution.",
    flow: ["write accepted", "copies diverge", "reconcile or reject"], best: "State the consistency users require for each operation, especially money, ownership and inventory.", check: "Check read-after-write, monotonic reads, conflict detection and partition behaviour.", pitfall: "Using CAP as a database ranking or claiming a system is simply consistent at all times.", interview: "Tell a user-visible partition story rather than only naming C, A and P.",
  },
  {
    slug: "transactions-and-concurrency", title: "Transactions and Double-Booking", summary: "Protect multi-step invariants when many requests race.",
    analogy: ["Reserve a changing room before walking to it", "Two shoppers seeing one free room cannot both claim it. A single guarded update must decide the winner."],
    idea: "Transactions keep related changes atomic. Isolation controls which concurrent effects can be observed. Optimistic locking checks a version at write time; pessimistic locking reserves access earlier. Constraints are the final guard.",
    flow: ["read version", "conditional update", "commit or retry"], best: "Put the invariant in a database constraint or atomic conditional write, not only application code.", check: "Check races, deadlocks, retry safety and transaction boundaries.", pitfall: "Reading availability and writing a booking as separate unguarded operations.", interview: "Draw two concurrent requests and point to the exact operation that permits only one winner.",
    lab: "ticket-booking",
  },
  {
    slug: "queues-streams-and-backpressure", title: "Queues, Streams and Backpressure", summary: "Decouple producers from slower work without hiding overload forever.",
    analogy: ["A tray between kitchen and waiters", "The tray absorbs a brief rush, but if dishes arrive faster forever, it fills. Someone must slow orders, add workers or reject work."],
    idea: "Queues buffer and distribute work; streams retain an ordered record for multiple consumers. Consumers acknowledge work. At-least-once delivery means handlers must tolerate duplicates. Backpressure keeps backlog bounded.",
    flow: ["producer publishes", "broker stores", "consumer acknowledges"], best: "Define delivery semantics, idempotent handling and a maximum useful backlog age.", check: "Check lag, poison messages, retries, ordering and overload policy.", pitfall: "Calling a queue infinitely scalable and ignoring stale work piling up.", interview: "Choose sync or async from the user's need for an immediate result, then explain failure recovery.",
  },
  {
    slug: "rate-limits-retries-and-circuits", title: "Rate Limits, Retries and Circuit Breakers", summary: "Keep one struggling dependency from becoming a system-wide failure.",
    analogy: ["A clinic with appointments and an emergency stop", "Appointments smooth arrivals. Repeatedly sending everyone to a closed room makes the hallway worse; pause and try later."],
    idea: "Rate limits enforce fair budgets. Timeouts bound waiting. Retries need exponential backoff, jitter and a budget. A circuit breaker temporarily stops calls to a failing dependency so it can recover.",
    flow: ["admission limit", "bounded attempt", "backoff or fail fast"], best: "Combine timeouts, capped retries with jitter, and an overall deadline.", check: "Check retry amplification, per-tenant fairness and degraded responses.", pitfall: "Retrying every failure immediately at every layer.", interview: "Calculate how three retries across three layers can magnify one failed request.",
  },
  {
    slug: "object-storage-and-cdns", title: "Files, Object Storage and CDNs", summary: "Store large immutable objects cheaply and deliver them near users.",
    analogy: ["Warehouse stock with nearby display shelves", "The warehouse keeps the durable item; nearby shelves serve popular items quickly and are refilled when empty."],
    idea: "Keep file bytes in object storage and metadata in a queryable database. Use signed upload URLs to avoid routing every byte through application servers. CDNs cache objects at edge locations.",
    flow: ["signed upload", "object storage", "CDN delivery"], best: "Separate blob bytes from metadata and authorise access with short-lived signed URLs.", check: "Check content type, size, malware scanning, deletion and cache invalidation.", pitfall: "Storing large file bytes directly in a frequently queried relational table.", interview: "Trace upload and download paths, including access control and interrupted transfers.",
  },
  {
    slug: "search-and-autocomplete", title: "Search, Indexing and Autocomplete", summary: "Build a read-optimised view for text lookup and ranked suggestions.",
    analogy: ["A library catalogue beside the shelves", "The catalogue contains searchable clues about books. It can be rebuilt from the shelves, but it must receive updates to stay useful."],
    idea: "A search index tokenises fields into an inverted map, then filters and ranks matches. Autocomplete needs prefix or n-gram structures and tight latency. The source database remains authoritative.",
    flow: ["change event", "search index", "ranked query"], best: "Treat search as a derived read model with an explicit indexing-lag promise.", check: "Check relevance, freshness, typo handling, access filters and zero-result queries.", pitfall: "Using a transactional database scan for every full-text query at scale.", interview: "Separate candidate retrieval from ranking and describe how updates reach the index.",
  },
  {
    slug: "observability-slos-and-security", title: "Observability, SLOs and Safe Failure", summary: "Know what broke, protect data and practise recovery before an incident.",
    analogy: ["A car dashboard plus a seat belt", "Gauges explain what the car is doing; alerts signal danger; the seat belt limits damage. None replaces careful driving."],
    idea: "Metrics show trends, logs explain events and traces connect one request across services. Service-level objectives turn user promises into thresholds. Least privilege, encryption, audit trails, backups and tested recovery reduce harm.",
    flow: ["instrument request", "alert on symptom", "diagnose and recover"], best: "Measure user-visible symptoms and tie alerts to an owned response playbook.", check: "Check cardinality, sensitive data in logs, backup restore tests and dependency objectives.", pitfall: "Alerting on every internal metric until operators ignore the noise.", interview: "Finish a design with dashboards, trace IDs, data protection and one rehearsed failure scenario.",
  },
];

const aiSystems: ChapterSpec[] = [
  {
    slug: "ai-request-path", title: "The AI Request Path", summary: "Place a model behind a controlled gateway with context, streaming and fallbacks.",
    analogy: ["A translator behind a reception desk", "The receptionist checks the request, gathers documents, chooses the translator and records the result instead of letting every visitor enter directly."],
    idea: "An AI request path authenticates the user, applies policy, assembles context, selects a model, calls it, streams or validates output and records safe telemetry. Keep provider details behind an adapter.",
    flow: ["AI gateway", "context and model", "validated response"], best: "Centralise model access so policy, budgets, fallbacks and observability apply consistently.", check: "Check timeouts, streaming cancellation, provider errors and sensitive prompt data.", pitfall: "Calling model providers directly from every client and duplicating policy logic.", interview: "Trace one AI request and name what remains deterministic around the probabilistic call.",
  },
  {
    slug: "tokens-context-cost-and-capacity", title: "Tokens, Context, Cost and Capacity", summary: "Budget input, output, latency and spend before the prompt reaches a model.",
    analogy: ["A suitcase with weight and airline fees", "More items may help the trip, but the suitcase has a hard limit and every extra kilogram costs time and money."],
    idea: "Model work grows with input and generated tokens. Context windows are finite and useful information can be buried. Enforce per-request and per-tenant budgets; summarise or retrieve instead of attaching everything.",
    flow: ["token estimate", "budget decision", "bounded generation"], best: "Set input, output, latency and cost budgets per request type.", check: "Check worst-case context, concurrent demand, cancellation and unit economics.", pitfall: "Sending entire histories and documents because they fit inside the advertised context limit.", interview: "Estimate peak tokens per minute and describe what degrades when the budget is reached.",
  },
  {
    slug: "embeddings-vector-search-and-rag", title: "Embeddings, Vector Search and RAG", summary: "Retrieve small, relevant evidence before asking a model to answer.",
    analogy: ["Give an open-book student the right pages", "The student answers better with three relevant pages than with a trolley of every book in the library."],
    idea: "Chunk source documents, create embeddings, retrieve candidates, optionally rerank, and place cited evidence in the prompt. Access control must filter retrieval. Evaluate retrieval separately from answer generation.",
    flow: ["chunk and index", "retrieve evidence", "grounded answer"], best: "Measure whether retrieval found the answer-bearing chunk before judging model prose.", check: "Check chunk boundaries, freshness, permissions, citations and no-answer behaviour.", pitfall: "Calling vector similarity truth and skipping access filters or source citations.", interview: "Separate ingestion and query paths, then diagnose retrieval misses versus generation mistakes.",
    lab: "rag-assistant",
  },
  {
    slug: "model-routing-batching-and-caching", title: "Model Routing, Batching and Caching", summary: "Match request difficulty to capability while protecting latency and quality.",
    analogy: ["Send each parcel by the right service", "A local envelope does not need an international express courier. Valuable urgent parcels may justify the expensive route."],
    idea: "A router selects a model from task, risk and budget. Batching raises throughput for delay-tolerant work. Exact or semantic caches can avoid repeated calls but need privacy boundaries and freshness rules.",
    flow: ["classify request", "route or batch", "cache safe result"], best: "Route from measured task quality and cost, with a safe fallback when classification is uncertain.", check: "Check cache tenant isolation, batch delay, route accuracy and provider capacity.", pitfall: "Routing by prompt length alone or sharing cached private outputs across users.", interview: "Define a routing policy and the offline evaluation that earns permission to use a cheaper model.",
  },
  {
    slug: "ai-evaluation-and-tracing", title: "Evaluation, Tracing and Feedback", summary: "Measure task success with representative cases instead of judging a demo.",
    analogy: ["A driving test with a route sheet", "One smooth trip proves little. A fair test repeats hills, traffic and parking with recorded criteria."],
    idea: "Build a versioned evaluation set from real task categories, including failures and safety cases. Record prompt, retrieved evidence, tool events and outputs with privacy controls. Combine deterministic checks, expert review and user outcomes.",
    flow: ["representative cases", "trace each stage", "score and compare"], best: "Gate changes on a versioned evaluation set split by task and risk category.", check: "Check leakage, subjective rubrics, regressions by segment and feedback bias.", pitfall: "Using thumbs-up rate alone or changing prompts after looking at the test answers.", interview: "Explain how you isolate retrieval, tool and generation quality in one trace.",
  },
  {
    slug: "agent-anatomy", title: "Agent Anatomy: Model, Tools and State", summary: "Turn a model call into a bounded system that can observe and act.",
    analogy: ["A trainee with a manual and locked toolbox", "The trainee reads instructions, chooses an allowed tool, observes the result and stops when the job is complete. Access is limited, not assumed."],
    idea: "An agent combines a model with instructions, typed tools, state and a loop. The runtime validates tool arguments, enforces permissions, records observations and applies step and cost limits.",
    flow: ["decide next step", "validated tool call", "observation and stop"], best: "Keep the runtime deterministic around model choices: validate, authorise, limit and log every action.", check: "Check tool scopes, argument validation, loop limits and recovery after partial side effects.", pitfall: "Giving the model broad credentials and trusting prompt text as the security boundary.", interview: "Draw the agent loop and mark exactly where untrusted model output becomes a real action.",
    lab: "tool-using-agent",
  },
  {
    slug: "agent-workflow-patterns", title: "Agent Workflow Patterns", summary: "Choose sequential, routed, parallel or planner-worker flows only when they fit.",
    analogy: ["Organise a school project", "Some tasks follow a checklist, some split among classmates, and some need a coordinator. Adding classmates to a one-page task only adds meetings."],
    idea: "Sequential chains suit ordered transformations. Routers choose specialised paths. Parallel workers suit independent subtasks. Planner-worker flows adapt but add latency, cost and harder evaluation. Start with the least agentic pattern that works.",
    flow: ["classify dependency", "choose workflow", "join and verify"], best: "Use deterministic workflows where the path is known; add planning only for genuine uncertainty.", check: "Check dependency order, fan-out limits, shared state and merge conflicts.", pitfall: "Using multiple agents because the architecture sounds advanced rather than because tasks are independent.", interview: "Compare a fixed workflow and a planner for the same task across reliability, cost and debuggability.",
    artifact: {
      kind: "table",
      head: ["Pattern", "Use it when", "Main cost"],
      rows: [
        ["Sequential", "Every step depends on the previous one", "A slow stage delays the whole chain"],
        ["Parallel", "Subtasks are independent", "Fan-out and merge need bounds"],
        ["Planner-worker", "The route cannot be known in advance", "Higher cost and harder evaluation"],
      ],
    },
  },
  {
    slug: "agent-memory-safety-and-recovery", title: "Agent Memory, Approval and Recovery", summary: "Store only useful state and put humans around irreversible actions.",
    analogy: ["A workshop job card", "The card records approved work and completed steps. A mechanic still asks before replacing an expensive part and can resume after a break."],
    idea: "Separate conversation context, durable user facts and task checkpoints. Give each a schema, retention period and owner controls. Require approval before high-impact tools. Use idempotency and compensation for resumable workflows.",
    flow: ["load scoped state", "approve risky action", "checkpoint or compensate"], best: "Persist minimal typed state with provenance, expiry and a user-visible way to correct or delete it.", check: "Check consent, stale memory, approval binding, duplicate actions and resumability.", pitfall: "Saving every conversation forever and treating generated summaries as verified user facts.", interview: "Design a crash-safe tool workflow and identify the actions that always need human confirmation.",
  },
];

const cases: ChapterSpec[] = [
  {
    slug: "case-url-shortener", title: "Case: A URL Shortening Service", summary: "Create short keys, redirect quickly and handle popular links without inventing complexity.",
    analogy: ["A cloakroom ticket", "A tiny ticket maps to one bulky coat. The ticket must be unique, quick to check and useless if guessed access would be unsafe."],
    idea: "Clarify custom aliases, expiry and analytics. Generate a unique short key, store key-to-destination metadata, and serve redirects through a cache backed by durable storage. Treat redirects as the dominant path.",
    flow: ["create short key", "store mapping", "resolve and redirect"], best: "Optimise the read-heavy redirect path while keeping key creation collision-safe.", check: "Check key space, abuse controls, expiry, hot links and analytics isolation.", pitfall: "Using a predictable counter without discussing enumeration, custom aliases or multiple regions.", interview: "Estimate key length and redirect traffic, then deepen collision handling and cache misses.",
    lab: "url-shortener",
  },
  {
    slug: "case-collaborative-editor", title: "Case: A Collaborative Document Editor", summary: "Synchronise edits, presence and durable snapshots across unreliable connections.",
    analogy: ["Several people edit sticky notes on one board", "Everyone needs to see changes, but a temporarily offline person must rejoin without erasing work placed while they were away."],
    idea: "Separate durable document content from ephemeral cursors and presence. Send operations over a realtime channel, order or merge concurrent edits, persist an operation log or snapshots, and resynchronise reconnecting clients.",
    flow: ["local edit", "merge and broadcast", "snapshot and resync"], best: "Choose an operational-transform or conflict-free merge model and state its convergence guarantee.", check: "Check concurrent edits, offline replay, permissions, document size and history retention.", pitfall: "Broadcasting whole documents on every keystroke or treating cursor presence as durable content.", interview: "Walk two users editing the same position while one disconnects and reconnects.",
  },
  {
    slug: "case-ticket-booking", title: "Case: A Ticket Booking Platform", summary: "Search events broadly, then protect scarce seats during a timed checkout.",
    analogy: ["A shopkeeper holds one item briefly", "The item can be held while a buyer pays, but the hold expires and returns it to the shelf if payment never completes."],
    idea: "Use a search-friendly read model for events and a strongly guarded inventory path for seats. Create expiring holds with atomic conditional updates. Confirm payment idempotently and release abandoned holds.",
    flow: ["browse inventory", "atomic timed hold", "idempotent confirmation"], best: "Make seat state transitions atomic and put expiry in the inventory source of truth.", check: "Check concurrent holds, payment callbacks, expiry races, waiting rooms and audit trails.", pitfall: "Trusting a cached seat map as proof that a seat can still be booked.", interview: "Draw two buyers racing for one seat and locate the single winner operation.",
  },
  {
    slug: "case-personalised-feed", title: "Case: A Personalised Feed", summary: "Combine candidate generation, ranking and fan-out under a freshness budget.",
    analogy: ["A morning newspaper assembled for one reader", "Editors gather candidate stories, rank them for the reader and leave room for breaking news rather than printing the entire archive."],
    idea: "Generate candidates from follows and recommendations, filter policy-ineligible items, rank a bounded set, and paginate with stable cursors. Fan-out on write helps ordinary creators; fan-out on read avoids massive celebrity writes. Hybrid systems use both.",
    flow: ["candidate generation", "filter and rank", "cursor page"], best: "Separate candidate retrieval from ranking and pick fan-out strategy from follower distribution.", check: "Check freshness, duplicates, privacy changes, celebrity skew and pagination stability.", pitfall: "Recomputing the whole feed synchronously or using offset pagination on a changing list.", interview: "Compare fan-out-on-write and fan-out-on-read for ordinary and high-fan-out creators.",
    artifact: {
      kind: "compare",
      title: "Where feed work happens",
      columns: [
        { label: "Fan-out on write", items: ["Fast reads", "More writes per post", "Poor fit for huge follower counts"] },
        { label: "Fan-out on read", items: ["Cheaper publishing", "More work at read time", "Useful for high-fan-out creators"] },
        { label: "Hybrid", items: ["Precompute ordinary creators", "Merge celebrity posts at read time", "More operational complexity"] },
      ],
    },
  },
  {
    slug: "case-chat-and-presence", title: "Case: Chat, Delivery and Presence", summary: "Deliver ordered conversations while treating online status as an approximate signal.",
    analogy: ["Registered mail plus a porch light", "A receipt can prove a letter reached a mailbox. A porch light hints someone is home but is never perfect evidence."],
    idea: "Maintain long-lived connections through gateways, assign per-conversation order, persist messages before acknowledgement, and fan out to connected devices or push notifications. Presence uses heartbeats and expiry and is intentionally approximate.",
    flow: ["connection gateway", "persist and order", "fan out and acknowledge"], best: "Guarantee ordering within a conversation, not globally across every message.", check: "Check duplicates, multiple devices, offline sync, large groups and presence expiry.", pitfall: "Promising exactly-once delivery end to end or treating presence as a durable fact.", interview: "Explain sent, delivered and read states and what happens across reconnects.",
  },
  {
    slug: "case-file-sync-and-sharing", title: "Case: File Sync and Sharing", summary: "Move chunks efficiently, retain versions and enforce access at every download.",
    analogy: ["Ship numbered boxes, not the whole house", "When one room changes, send only its labelled boxes. A manifest proves which pieces form the latest complete version."],
    idea: "Split files into hashed chunks, upload missing chunks, store immutable objects and commit metadata atomically. Sync clients compare versions and resolve conflicts. Sharing uses explicit principals and short-lived download authorisation.",
    flow: ["chunk and hash", "upload missing objects", "commit version metadata"], best: "Make immutable blobs cheap and put version, ownership and permissions in transactional metadata.", check: "Check conflict copies, resumable upload, deduplication privacy, deletion and revoked shares.", pitfall: "Overwriting a mutable file object in place and losing recoverable versions.", interview: "Trace a changed large file from local detection through another device receiving it.",
  },
  {
    slug: "case-search-and-autocomplete", title: "Case: Search and Autocomplete", summary: "Serve typo-tolerant suggestions quickly while keeping ranking and permissions correct.",
    analogy: ["A helpful librarian finishes the question", "The librarian suggests likely titles after a few letters but still checks which shelf and access rules apply before handing over a result."],
    idea: "Stream source changes into separate indexes for full search and low-latency prefixes. Retrieve candidates, apply access filters, rank them, and learn carefully from aggregated interactions. Cache popular safe prefixes.",
    flow: ["prefix candidates", "permission filter", "ranked suggestions"], best: "Apply authorisation before returning results and keep autocomplete latency work bounded.", check: "Check typo tolerance, trending updates, sensitive terms, ranking evaluation and zero results.", pitfall: "Returning a title in autocomplete that the user is not allowed to know exists.", interview: "Define relevance and latency metrics separately, then explain how index freshness is measured.",
  },
  {
    slug: "case-ai-products-and-agents", title: "Case: AI Assistants and Agents", summary: "Design support, research, coding and interview assistants from one safe architecture vocabulary.",
    analogy: ["A supervised team at a reference desk", "Staff can consult approved books and tools, but risky actions need a supervisor and every answer shows where its evidence came from."],
    idea: "A support assistant emphasises grounded retrieval and escalation. A research agent needs source tracking and bounded parallel search. A coding agent needs a sandbox and patch review. An interview coach needs consent, media controls and evidence-backed feedback. Start with one agent unless roles are genuinely independent.",
    flow: ["scope and evidence", "bounded tools", "evaluate and approve"], best: "Design the deterministic safety, evidence and evaluation layers before multiplying agents.", check: "Check data permissions, tool side effects, citations, human handoff, budgets and recovery.", pitfall: "Building a multi-agent society before one bounded workflow is reliable and measurable.", interview: "Choose one AI product, draw its trust boundaries and explain when the system refuses or escalates.",
  },
];

export const systemDesignCourse: Course = {
  slug: "system-design",
  title: "System Design",
  tagline: "From one request to resilient distributed and AI systems — practise the trade-offs, then assemble the architecture yourself.",
  level: "Beginner to interview-ready — no distributed-systems background assumed",
  codeLanguage: "python",
  requiresCodeExamples: false,
  modules: [
    { title: "Foundations: frame the problem", chapters: foundations.map((spec) => makeChapter(spec, 12)) },
    { title: "Building blocks: scale safely", chapters: buildingBlocks.map((spec) => makeChapter(spec, 14)) },
    { title: "AI and agent system design", chapters: aiSystems.map((spec) => makeChapter(spec, 15)) },
    { title: "Case studies: compose the system", chapters: cases.map((spec) => makeChapter(spec, 17)) },
  ],
};
