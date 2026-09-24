type LessonDetails = {
  example: string;
  glossary: [term: string, meaning: string][];
};

/** Original, beginner-first examples and definitions for the first 38 course chapters. */
const legacyChapterDetails = {
  "requirements-first": {
    example: "For a school-results portal, the three core actions are publish marks, view one result and download a marksheet. A useful quality target is that results open within two seconds during the morning traffic spike. Live chat and social sharing can wait because they do not help the main job.",
    glossary: [["functional requirement", "A user action the system must support."], ["quality requirement", "A measurable promise about speed, safety or reliability."], ["constraint", "A limit the design must respect, such as budget or deadline."], ["scope", "The work included now and the work deliberately left out."]],
  },
  "functional-and-quality-requirements": {
    example: "“Students can submit an assignment” is functional. “Ninety-five out of one hundred submissions finish within three seconds” is a measurable quality target. If storage is briefly slow, the system may accept the file and show processing rather than breaking the speed promise.",
    glossary: [["capability", "Something a user can do with the product."], ["latency target", "The maximum waiting time promised for a chosen share of requests."], ["availability target", "The share of time a service should be usable."], ["measurement window", "The period over which a target is checked."]],
  },
  "latency-throughput-and-reliability": {
    example: "A checkout serves 600 purchases in one minute, so its throughput is 10 purchases per second. Most finish in 300 ms, but the slowest 5% take 1.8 seconds; p95 exposes that wait while the average hides it. Availability asks whether checkout works now, while durability asks whether a saved order survives a crash.",
    glossary: [["latency", "Time taken for one operation to finish."], ["throughput", "Completed operations per unit of time."], ["p95", "A value that 95% of measured requests are at or below."], ["durability", "The promise that confirmed data survives later failures."]],
  },
  "back-of-the-envelope-estimation": {
    example: "Suppose 1 million users each open a feed 10 times daily. That is 10 million reads per day, roughly 116 per second on average. If peak traffic is ten times average, design for about 1,200 reads per second. Stating the peak multiplier matters more than pretending the estimate is exact.",
    glossary: [["QPS", "Queries or requests handled per second."], ["peak traffic", "The busiest expected period, not the daily average."], ["retention", "How long stored data must remain available."], ["order of magnitude", "A rough scale such as hundreds, thousands or millions."]],
  },
  "journey-of-a-request": {
    example: "When a learner opens a lesson, DNS finds the site's address, a secure connection is created, an edge proxy receives the HTTP request, and a service checks enrolment. The service reads lesson metadata and returns a signed media location. Each network hop needs a timeout because any hop can stall.",
    glossary: [["DNS", "The directory that turns a domain name into a network address."], ["TLS", "Encryption and identity checking for a network connection."], ["HTTP request", "A structured message asking a server to perform an action."], ["network hop", "One boundary a request crosses between components."]],
  },
  "api-contracts-and-idempotency": {
    example: "A client sends `POST /orders` with idempotency key `checkout-82`. The server creates order 941 and remembers the result. The response is lost, so the client retries with the same key. The server returns order 941 instead of charging and creating a second order.",
    glossary: [["API contract", "The agreed request, response and error shapes between systems."], ["idempotency", "Repeating the same operation has no additional effect."], ["pagination", "Returning a large result in bounded pages."], ["versioning", "Changing an interface without silently breaking existing clients."]],
  },
  "data-models-from-access-patterns": {
    example: "A classroom app most often asks for all assignments in one class ordered by due date. A useful key starts with `class_id`, and an index includes `due_date`. Student submissions keep their own owner and status. This design follows real reads instead of starting from a fashionable database type.",
    glossary: [["entity", "A thing the system stores, such as a class or assignment."], ["access pattern", "A frequent way the product reads or changes data."], ["primary key", "A value that uniquely identifies one stored record."], ["normalisation", "Keeping one fact in one authoritative place to avoid disagreement."]],
  },
  "a-repeatable-design-method": {
    example: "For a photo-sharing prompt, first choose upload, view and delete as scope. Estimate image bytes and view traffic, define the upload and view APIs, then draw client → storage → CDN. Only after that should you deepen processing, permissions and deletion. The sequence keeps the discussion tied to user needs.",
    glossary: [["high-level design", "The small set of major components and request paths."], ["bottleneck", "The resource that reaches its limit first."], ["trade-off", "A benefit gained by accepting a cost elsewhere."], ["failure mode", "A specific way the system can stop meeting its promise."]],
  },
  "scale-up-and-scale-out": {
    example: "One API machine reaches 80% CPU at peak. Moving from 4 to 8 cores is a quick scale-up. When one machine is no longer enough, three stateless API replicas scale out behind a load balancer. User sessions move to shared storage so any replica can handle the next request.",
    glossary: [["vertical scaling", "Giving one machine more CPU, memory or storage."], ["horizontal scaling", "Adding more machines that share the work."], ["stateless service", "A service that does not depend on local memory between requests."], ["headroom", "Unused capacity reserved for bursts and failures."]],
  },
  "load-balancing-and-health": {
    example: "Three lesson-service instances receive traffic. Instance B is still loading its database connections, so readiness is false and the load balancer sends it nothing. Later B freezes; liveness fails and the platform restarts it. Existing requests drain from instance A before maintenance removes it.",
    glossary: [["load balancer", "A component that distributes requests across service instances."], ["readiness probe", "A check that says an instance can receive new traffic now."], ["liveness probe", "A check that says a stuck instance should be restarted."], ["connection draining", "Stopping new work while allowing in-flight work to finish."]],
  },
  "caching-layers": {
    example: "A course catalogue changes hourly but is read thousands of times a minute. The service caches each category for 60 seconds. A miss reads the database and fills the cache. To avoid a stampede at expiry, one request refreshes while others briefly use the older safe value.",
    glossary: [["cache hit", "A request answered from the faster saved copy."], ["cache miss", "A request that must visit the underlying source."], ["TTL", "The time a cached value may live before expiry."], ["cache stampede", "Many requests rebuilding the same expired value at once."]],
  },
  "sql-and-nosql": {
    example: "A booking needs one transaction across a reservation, payment reference and inventory claim, so a relational store is a strong starting point. A separate key-value cache can serve public property summaries by ID. Using both is justified by two different jobs, not by a claim that one database is always better.",
    glossary: [["relational database", "A store of related tables with constraints and transactions."], ["document store", "A store that keeps a related aggregate as one flexible document."], ["key-value store", "A store optimised for retrieving a value by one key."], ["transaction", "A group of changes that succeeds or fails as one unit."]],
  },
  "indexes-and-query-cost": {
    example: "The query `WHERE class_id = 12 ORDER BY due_date` runs often. An index on `(class_id, due_date)` jumps to class 12 and already has the right order. Reversing the columns is less useful because many classes share each due date. Every submission write must also update the index.",
    glossary: [["index", "A helper structure that finds selected rows without scanning them all."], ["composite index", "An index ordered by more than one field."], ["selectivity", "How strongly a filter narrows the matching rows."], ["query plan", "The database's chosen steps for executing a query."]],
  },
  "replication-and-failover": {
    example: "An order database writes to a leader and copies changes to two replicas. Product browsing may read a slightly delayed replica, but the confirmation screen reads the leader so a new order appears immediately. If the leader fails, one replica is promoted and clients reconnect using the database endpoint.",
    glossary: [["leader", "The replica authorised to accept a chosen class of writes."], ["replica", "Another copy that receives changes from an authoritative node."], ["replication lag", "The delay before a replica receives the latest change."], ["failover", "Moving responsibility to a healthy replacement after failure."]],
  },
  "partitioning-and-hot-keys": {
    example: "Messages are partitioned by `conversation_id`, keeping one conversation together and spreading many conversations across shards. A public broadcast with millions of readers becomes a hot key, so its cached read path is replicated separately. Changing shard ownership happens in ranges rather than copying the entire dataset.",
    glossary: [["partition", "One subset of a larger dataset or workload."], ["shard", "A machine or storage unit responsible for one or more partitions."], ["partition key", "The value used to choose a record's partition."], ["hot key", "A key receiving much more traffic than the rest."]],
  },
  "consistency-and-cap": {
    example: "Two regions lose contact. Profile-photo updates may remain available in both and reconcile later. A final-seat reservation cannot safely accept two winners, so one region rejects or delays that write until it reaches the authority. Consistency is chosen per operation, not as one label for the whole product.",
    glossary: [["network partition", "A period when parts of a distributed system cannot communicate."], ["consistency", "Rules about which writes a read is allowed to observe."], ["availability", "The ability to return a non-error response to a request."], ["conflict resolution", "A rule for combining or choosing between concurrent changes."]],
  },
  "transactions-and-concurrency": {
    example: "Two buyers read seat A7 as free. Both try `UPDATE seats SET owner=? WHERE id='A7' AND owner IS NULL`. One update changes one row and wins; the other changes zero rows and must choose another seat. The condition makes the race safe at the source of truth.",
    glossary: [["atomicity", "Related changes appear all together or not at all."], ["isolation", "Rules limiting what concurrent operations can observe."], ["optimistic locking", "A write succeeds only if a previously read version still matches."], ["invariant", "A rule that must remain true, such as one owner per seat."]],
  },
  "queues-streams-and-backpressure": {
    example: "Checkout publishes an `order-confirmed` event and responds without waiting for email. Three email workers consume it. If a worker crashes before acknowledgement, the message is delivered again, so sending uses the order ID as a deduplication key. A growing hour-old backlog triggers admission limits.",
    glossary: [["queue", "A buffer that hands work to one of several consumers."], ["stream", "An ordered retained log that multiple consumers may read."], ["acknowledgement", "A consumer's signal that processing finished safely."], ["backpressure", "A way to slow or reject new work when consumers cannot keep up."]],
  },
  "rate-limits-retries-and-circuits": {
    example: "A profile service gives each user 60 writes a minute. Its database call times out after 300 ms and retries at most twice with randomised backoff inside a one-second deadline. When failures remain high, a circuit opens and returns a safe error instead of multiplying database load.",
    glossary: [["rate limit", "A budget for how many operations are allowed in a period."], ["exponential backoff", "Waiting progressively longer between retry attempts."], ["jitter", "Random delay added so many clients do not retry together."], ["circuit breaker", "A temporary stop on calls to a dependency that is repeatedly failing."]],
  },
  "object-storage-and-cdns": {
    example: "A learner requests a signed upload URL and sends a 500 MB video directly to object storage. A metadata row records ownership and processing state. After publication, a CDN caches immutable video segments near viewers; the application server returns metadata but never carries every media byte.",
    glossary: [["object storage", "Durable storage addressed by object keys rather than table rows."], ["signed URL", "A short-lived permission for one upload or download."], ["CDN", "A network of edge caches that serves content near users."], ["origin", "The authoritative location a CDN uses on a cache miss."]],
  },
  "search-and-autocomplete": {
    example: "Course titles are copied from the catalogue database into a search index. Typing `distrib` retrieves prefix candidates, filters courses the learner may see, and ranks exact title matches above descriptions. A catalogue update may take ten seconds to appear, so the product states that freshness budget.",
    glossary: [["inverted index", "A map from terms to the documents containing them."], ["tokenisation", "Splitting text into searchable units."], ["ranking", "Ordering matching candidates by estimated usefulness."], ["indexing lag", "Delay before source changes appear in search."]],
  },
  "observability-slos-and-security": {
    example: "A checkout SLO says 99.9% of valid requests succeed each month. Metrics show the error rise, a trace follows one failed request through payment and inventory, and structured logs explain the rejected transition without storing card details. An alert links to a rollback playbook owned by the checkout team.",
    glossary: [["metric", "A numeric measurement tracked over time."], ["log", "A structured record of a specific event."], ["trace", "The connected path of one request across components."], ["SLO", "A measurable reliability target for a service."], ["least privilege", "Giving each identity only the permissions it needs."]],
  },
  "ai-request-path": {
    example: "A study assistant receives an authenticated question. A gateway removes unsupported attachments, retrieves permitted course notes, chooses a model within the user's budget, streams the response and records latency plus source IDs. Provider credentials never reach the browser.",
    glossary: [["model gateway", "A controlled server boundary for model calls and policy."], ["context", "The instructions and evidence sent with a request."], ["streaming", "Returning output in pieces while generation continues."], ["fallback", "A planned alternative used when the preferred model is unavailable."]],
  },
  "tokens-context-cost-and-capacity": {
    example: "A request contains 2,000 input tokens and allows 500 output tokens. At 100 simultaneous requests, the gateway rejects oversized histories and retrieves only the most relevant notes. A “summarise everything” background job can wait for cheaper batch capacity instead of delaying live questions.",
    glossary: [["token", "A small text unit a model reads or generates."], ["context window", "The maximum tokens a model can consider in one request."], ["output limit", "A bound on how much the model may generate."], ["capacity budget", "The allowed model work across concurrent requests."]],
  },
  "embeddings-vector-search-and-rag": {
    example: "A policy document is split by headings into chunks and indexed with owner permissions. A question retrieves 20 candidates, reranks five, and sends three cited passages to the model. If no passage supports an answer, the assistant says the evidence is missing instead of guessing.",
    glossary: [["embedding", "A numeric representation used to compare meaning approximately."], ["vector search", "Finding stored vectors near a query vector."], ["chunk", "A bounded passage stored and retrieved as one unit."], ["RAG", "Retrieving evidence and adding it to a generation request."], ["reranking", "Scoring retrieved candidates again with a more precise method."]],
  },
  "model-routing-batching-and-caching": {
    example: "A classifier sends simple formatting requests to a small model and safety-sensitive explanations to a stronger reviewed path. Nightly summaries are batched because a few minutes of delay is acceptable. A cache stores only public, versioned prompts; private user answers never cross tenant boundaries.",
    glossary: [["model routing", "Choosing a model or workflow from task, risk and budget."], ["batching", "Combining delay-tolerant work to improve throughput."], ["semantic cache", "A cache that may reuse results for meaningfully similar requests."], ["tenant isolation", "Keeping one customer's data inaccessible to another."]],
  },
  "ai-evaluation-and-tracing": {
    example: "Before changing a retrieval prompt, the team runs 200 versioned cases: answerable, unanswerable, permission-sensitive and ambiguous. Each trace stores retrieved source IDs, tool outcomes and the final answer. Scores show that the change helps easy cases but harms no-answer behaviour, so release is blocked.",
    glossary: [["evaluation set", "A saved collection of representative test cases."], ["rubric", "Written criteria for deciding answer quality."], ["trace", "A record of the important stages inside one AI request."], ["regression", "A previously working behaviour that becomes worse after a change."]],
  },
  "agent-anatomy": {
    example: "A refund agent may look up an order and draft a refund request. The runtime validates typed arguments, checks the user's permission, asks a human before money moves, records the result and stops after five steps. The model proposes; deterministic code authorises and executes.",
    glossary: [["tool", "A typed operation an agent may request."], ["agent loop", "Repeated choose-action-observe steps with a stop condition."], ["observation", "The structured result returned after a tool call."], ["permission boundary", "Code that decides whether the requested action is allowed."]],
  },
  "agent-workflow-patterns": {
    example: "Translating then proofreading a letter is sequential because step two needs step one. Checking price and delivery availability can run in parallel because the tasks are independent. Planning a research report may need a planner, but a fixed refund checklist is safer and easier to test.",
    glossary: [["sequential workflow", "A fixed chain where each stage uses the previous result."], ["router", "A component that selects one specialised path."], ["parallel fan-out", "Starting independent tasks at the same time."], ["planner-worker", "A planner creates tasks that one or more workers execute."]],
  },
  "agent-memory-safety-and-recovery": {
    example: "A travel-planning run stores a typed checkpoint after flights are compared, not the model's hidden guesses. Before booking, the user approves the exact route and price. If the process restarts, the idempotency key prevents a second purchase and the audit record shows which approval authorised the first.",
    glossary: [["checkpoint", "Saved execution state from which a workflow can resume."], ["human approval", "Explicit confirmation bound to one consequential action."], ["compensation", "A planned action that reverses or offsets an earlier side effect."], ["provenance", "Where a saved fact or decision came from."], ["retention", "How long state remains stored before deletion."]],
  },
  "case-url-shortener": {
    example: "Creating a link generates random code `k7P2q`, checks uniqueness and stores its destination. A redirect first checks the edge cache, then the mapping store on a miss, and returns an HTTP redirect. A click event enters a queue so analytics cannot slow the user's redirect.",
    glossary: [["short code", "A compact identifier mapped to a destination URL."], ["collision", "Two generated codes attempting to identify different links."], ["redirect", "An HTTP response telling the client to visit another URL."], ["hot link", "A short link receiving unusually high traffic."]],
  },
  "case-collaborative-editor": {
    example: "Asha inserts `blue` while Ben, briefly offline, inserts `small` at the same location. Each edit carries a document version and operation ID. The merge method produces the same final text on both devices, then a snapshot lets a reconnecting client avoid replaying the entire history.",
    glossary: [["operation", "A small edit such as insert or delete."], ["convergence", "All replicas reach the same document after receiving the same edits."], ["presence", "Temporary information such as cursor position or online status."], ["snapshot", "A complete document state saved at a known history point."]],
  },
  "case-ticket-booking": {
    example: "Buyer A and Buyer B select seat C12 from a cached seat map. The inventory store conditionally changes C12 from `AVAILABLE` to `HELD(A)` with a five-minute expiry. B's update fails. A's payment callback uses one idempotency key to confirm the hold exactly once.",
    glossary: [["hold", "A temporary exclusive claim that expires unless confirmed."], ["inventory source of truth", "The authoritative state deciding whether an item is available."], ["conditional write", "A write that succeeds only if the current state matches."], ["waiting room", "Admission control that limits how many buyers reach scarce inventory."]],
  },
  "case-personalised-feed": {
    example: "When an ordinary creator posts, the system writes the post ID into followers' feed inboxes. A celebrity post is not copied millions of times; it is merged during reads. Ranking scores a bounded candidate set, and a cursor containing score plus ID keeps pages stable as newer posts arrive.",
    glossary: [["candidate generation", "Collecting a bounded set of items that might enter the feed."], ["ranking", "Ordering candidates for one reader."], ["fan-out on write", "Copying references into recipients' inboxes when content is published."], ["fan-out on read", "Collecting content when a reader opens the feed."], ["cursor", "A stable marker used to fetch the next page."]],
  },
  "case-chat-and-presence": {
    example: "A phone sends message 88 through a connection gateway. The chat service stores it with the next sequence number before acknowledging `sent`. Another device receives it and acknowledges `delivered`. After reconnecting with last-seen 84, it fetches 85–88; duplicate 88 is ignored by message ID.",
    glossary: [["connection gateway", "A service maintaining many long-lived client connections."], ["sequence number", "An increasing value that orders messages in one conversation."], ["delivery acknowledgement", "A signal that a message reached a chosen stage."], ["presence heartbeat", "A repeated signal used to estimate whether a device is online."]],
  },
  "case-file-sync-and-sharing": {
    example: "A 1 GB file changes in one 4 MB region. The client hashes chunks, uploads only the missing chunk and then commits a new version manifest. Another device downloads that chunk and reconstructs the version. A revoked share fails authorisation even if its old download URL was copied.",
    glossary: [["chunk", "A bounded piece of a larger file."], ["content hash", "An identifier calculated from bytes and used to detect matching content."], ["manifest", "Metadata listing the chunks that form one file version."], ["conflict copy", "A preserved alternate version created when offline edits cannot merge safely."]],
  },
  "case-search-and-autocomplete": {
    example: "Typing `data str` retrieves prefix candidates in under 50 ms. The service removes private courses before ranking, then returns five suggestions. Full search may use slower typo matching and filters. Catalogue changes reach both indexes through events, and freshness lag is measured separately.",
    glossary: [["prefix index", "A structure for finding terms that begin with typed characters."], ["candidate retrieval", "The fast first stage that finds possible results."], ["permission filter", "A check removing results the caller may not know about."], ["relevance", "How well a result answers the user's search intent."]],
  },
  "case-ai-products-and-agents": {
    example: "A support assistant retrieves only the signed-in customer's orders and cited policy passages. It may draft a return request, but a deterministic policy check and user approval precede submission. If evidence is missing or the request exceeds its tools, it hands the conversation to a person with the trace.",
    glossary: [["grounding", "Basing an answer on retrieved, inspectable evidence."], ["tool boundary", "The validated interface between model output and real actions."], ["human handoff", "Transferring the task and useful context to a person."], ["sandbox", "An isolated environment limiting what generated code can affect."], ["evaluation case", "A representative task with expected safety and quality behaviour."]],
  },
} satisfies Record<string, LessonDetails>;

export type LegacyChapterSlug = keyof typeof legacyChapterDetails;

export function legacyDetails(slug: LegacyChapterSlug): LessonDetails {
  return legacyChapterDetails[slug];
}
