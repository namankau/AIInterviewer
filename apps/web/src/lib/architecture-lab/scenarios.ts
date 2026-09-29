import type { ArchitectureScenario } from "@/lib/architecture-lab/types";

const primer = {
  title: "System Design Primer",
  url: "https://github.com/donnemartin/system-design-primer/tree/ae9bbd7b02d90b9866215de185217d33f39ab733",
  license: "CC BY 4.0",
} as const;

const aiAgents = {
  title: "AI Agents for Beginners",
  url: "https://github.com/microsoft/ai-agents-for-beginners/tree/25b7985f3b2dc37a84f4a7387ccd3c9f0e5b1595",
  license: "MIT",
} as const;

const generativeAi = {
  title: "Generative AI for Beginners",
  url: "https://github.com/microsoft/generative-ai-for-beginners/tree/d8ec07e31c4b32bd283d565c1abd9b58bb5cf2e8",
  license: "MIT",
} as const;

const kubernetesDocs = {
  title: "Kubernetes documentation",
  url: "https://github.com/kubernetes/website/tree/2ad36cb0f1215e344d9108c0edaf3cbee081dce0",
  license: "CC BY 4.0",
} as const;

const quickFixJ = {
  title: "QuickFIX/J",
  url: "https://github.com/quickfix-j/quickfixj/tree/0ffe2f49cee24b1b55ce81283294d1b9ceaffb5b",
  license: "QuickFIX Software License 1.0",
} as const;

const h3 = {
  title: "H3",
  url: "https://github.com/uber/h3/tree/cd62033b337b128ea7c4749f2302143b424187fc",
  license: "Apache 2.0",
} as const;

/** Original exercises informed by the cited open-source teaching material, never copied prose. */
export const architectureScenarios: readonly ArchitectureScenario[] = [
  {
    id: "url-shortener",
    title: "Make a short-link service",
    brief: "Place each building block so redirects stay fast while new links are created safely.",
    successMessage: "Your read path is fast, durable, and separated from background work.",
    zones: [
      { id: "edge", label: "Edge", description: "Closest to the browser; good for repeated reads." },
      { id: "service", label: "Application", description: "Validates requests and owns link rules." },
      { id: "data", label: "Data", description: "Durable mappings and identifiers live here." },
      { id: "background", label: "Background", description: "Work that need not delay a redirect." },
    ],
    components: [
      { id: "redirect-cache", label: "Redirect cache", description: "Keeps popular code-to-URL lookups nearby.", acceptedZoneIds: ["edge", "service"], feedback: "A cache can sit at the edge or beside the application; both reduce repeated database reads." },
      { id: "link-api", label: "Link API", description: "Creates links and resolves short codes.", acceptedZoneIds: ["service"], feedback: "Request validation and link rules belong in the application layer." },
      { id: "mapping-store", label: "Mapping store", description: "Persists short code → destination pairs.", acceptedZoneIds: ["data"], feedback: "The authoritative mapping needs durable storage." },
      { id: "analytics-worker", label: "Click analytics worker", description: "Counts visits without slowing redirects.", acceptedZoneIds: ["background"], feedback: "Analytics can run asynchronously after the redirect path finishes." },
    ],
    sources: [primer],
  },
  {
    id: "ticket-booking",
    title: "Prevent double-booked seats",
    brief: "Build the path from browsing a show to confirming exactly one buyer for a seat.",
    successMessage: "Your design separates fast browsing from the strongly controlled booking path.",
    zones: [
      { id: "read", label: "Browse path", description: "High-volume show and seat-map reads." },
      { id: "booking", label: "Booking path", description: "Commands that reserve and confirm seats." },
      { id: "data", label: "Source of truth", description: "Durable inventory and booking records." },
      { id: "async", label: "Async work", description: "Notifications and slow follow-up tasks." },
    ],
    components: [
      { id: "catalog-cache", label: "Show cache", description: "Serves popular listings quickly.", acceptedZoneIds: ["read"], feedback: "Read-heavy catalogue data benefits from a dedicated browse path." },
      { id: "reservation-service", label: "Reservation service", description: "Owns hold, expiry, and confirm rules.", acceptedZoneIds: ["booking"], feedback: "One service should own the reservation state transition." },
      { id: "seat-lock", label: "Atomic seat claim", description: "Allows only one active claim for a seat.", acceptedZoneIds: ["booking", "data"], feedback: "Atomicity may be enforced by the booking service with storage support, or directly by the data layer." },
      { id: "inventory-store", label: "Inventory store", description: "Persists seat and booking state.", acceptedZoneIds: ["data"], feedback: "Confirmed inventory needs one durable source of truth." },
      { id: "notification-queue", label: "Confirmation queue", description: "Carries email and receipt jobs.", acceptedZoneIds: ["async"], feedback: "A confirmation message should not extend the booking transaction." },
    ],
    sources: [primer],
  },
  {
    id: "rag-assistant",
    title: "Ground an answer in documents",
    brief: "Arrange a retrieval-augmented assistant so indexing is separate from the user answer path.",
    successMessage: "Your assistant retrieves evidence before generation and keeps indexing off the request path.",
    zones: [
      { id: "ingest", label: "Offline ingest", description: "Prepares documents before questions arrive." },
      { id: "retrieval", label: "Retrieval", description: "Finds relevant chunks for this question." },
      { id: "orchestration", label: "Answer path", description: "Builds grounded context and calls the model." },
      { id: "guardrail", label: "Safety & evidence", description: "Checks input and the supported final answer." },
    ],
    components: [
      { id: "chunk-embed", label: "Chunk + embed worker", description: "Turns source documents into searchable chunks.", acceptedZoneIds: ["ingest"], feedback: "Chunking and embedding can happen before a user asks a question." },
      { id: "vector-index", label: "Vector index", description: "Returns chunks similar to the query.", acceptedZoneIds: ["retrieval"], feedback: "The index serves the retrieval step, not generation itself." },
      { id: "prompt-builder", label: "Context builder", description: "Combines the question with retrieved evidence.", acceptedZoneIds: ["orchestration"], feedback: "The answer path must attach evidence before calling the model." },
      { id: "model-gateway", label: "Model gateway", description: "Calls a model and handles timeout or fallback.", acceptedZoneIds: ["orchestration"], feedback: "A gateway centralises model calls, budgets, and fallbacks." },
      { id: "evidence-check", label: "Evidence check", description: "Rejects unsupported claims or asks for clarification.", acceptedZoneIds: ["guardrail", "orchestration"], feedback: "Evidence checks can be a distinct guardrail or a final orchestration step." },
    ],
    sources: [generativeAi],
  },
  {
    id: "tool-using-agent",
    title: "Give an agent safe tools",
    brief: "Place the controls around a model that can read data and request a real-world action.",
    successMessage: "Your agent separates reasoning, permissions, human approval, and audit evidence.",
    zones: [
      { id: "orchestration", label: "Agent loop", description: "Plans the next bounded step." },
      { id: "tools", label: "Tool boundary", description: "Validates and executes permitted calls." },
      { id: "approval", label: "Human control", description: "Pauses consequential actions for a person." },
      { id: "state", label: "State & audit", description: "Stores minimal state and an inspectable history." },
    ],
    components: [
      { id: "planner", label: "Planner / router", description: "Chooses a tool or returns an answer.", acceptedZoneIds: ["orchestration"], feedback: "Planning belongs inside a bounded orchestration loop." },
      { id: "tool-gateway", label: "Permissioned tool gateway", description: "Checks schemas and the caller's allowed actions.", acceptedZoneIds: ["tools"], feedback: "Tools need validation and permissions at a firm execution boundary." },
      { id: "approval-gate", label: "Approval gate", description: "Requires confirmation before a consequential write.", acceptedZoneIds: ["approval", "tools"], feedback: "Approval may be a separate human-control stage or enforced at the tool boundary." },
      { id: "checkpoint", label: "Run checkpoint", description: "Lets an interrupted run resume safely.", acceptedZoneIds: ["state"], feedback: "Durable checkpoints belong with the agent's minimal execution state." },
      { id: "audit-log", label: "Audit log", description: "Records tool requests, outcomes, and approvals.", acceptedZoneIds: ["state"], feedback: "An append-only history makes actions explainable and reviewable." },
    ],
    sources: [aiAgents],
  },
  {
    id: "safe-deployment",
    title: "Roll out a release safely",
    brief: "Place the controls that turn one verified artifact into a gradual, observable and reversible release.",
    successMessage: "Your pipeline builds once, limits the first audience, and keeps rollback independent of a new build.",
    zones: [
      { id: "build", label: "Build & verify", description: "Turns a source revision into one trusted artifact." },
      { id: "artifact", label: "Artifact store", description: "Keeps immutable versions available for release or rollback." },
      { id: "rollout", label: "Rollout control", description: "Changes a small traffic slice before broad promotion." },
      { id: "observe", label: "Health gate", description: "Compares user-visible health and decides whether to continue." },
    ],
    components: [
      { id: "isolated-builder", label: "Isolated build worker", description: "Runs untrusted build steps and tests away from the control plane.", acceptedZoneIds: ["build"], feedback: "Build work needs an isolated worker with bounded credentials." },
      { id: "signed-artifact", label: "Signed immutable artifact", description: "The exact bytes promoted through each environment.", acceptedZoneIds: ["artifact", "build"], feedback: "Signing may finish in the build stage or at the artifact boundary; the promoted bytes must stay identical." },
      { id: "canary-controller", label: "Canary rollout controller", description: "Moves a small traffic share to the new version.", acceptedZoneIds: ["rollout"], feedback: "Gradual exposure belongs to rollout control." },
      { id: "slo-comparison", label: "Error and latency comparison", description: "Compares the canary with the current version.", acceptedZoneIds: ["observe"], feedback: "A health gate should measure user-visible symptoms, not only process uptime." },
      { id: "rollback-pointer", label: "Previous-version pointer", description: "Restores a known-good artifact without rebuilding.", acceptedZoneIds: ["artifact", "rollout"], feedback: "The prior artifact can be selected from storage or represented by rollout state; either keeps rollback quick." },
    ],
    sources: [kubernetesDocs, primer],
  },
  {
    id: "brokerage-order",
    title: "Route a customer order safely",
    brief: "Arrange a retail order path so duplicates, late venue messages and partial fills remain auditable.",
    successMessage: "Your order has one identity, guarded transitions, a protocol boundary and a durable event history.",
    zones: [
      { id: "admission", label: "Admission", description: "Authenticates the customer and validates the request." },
      { id: "orders", label: "Order authority", description: "Owns order identity and valid state changes." },
      { id: "venue", label: "Market boundary", description: "Translates and routes messages to an external venue." },
      { id: "audit", label: "Audit & recovery", description: "Keeps an independent history for reconciliation." },
    ],
    components: [
      { id: "risk-check", label: "Buying-power and risk check", description: "Rejects orders that violate account rules.", acceptedZoneIds: ["admission", "orders"], feedback: "Risk can be an admission stage or a guarded transition owned by the order service." },
      { id: "order-state", label: "Order state machine", description: "Allows only valid, idempotent status changes.", acceptedZoneIds: ["orders"], feedback: "One authority must own the order's durable state." },
      { id: "fix-gateway", label: "Protocol gateway", description: "Maps internal commands to venue messages and acknowledgements.", acceptedZoneIds: ["venue"], feedback: "External protocol handling belongs at a narrow market boundary." },
      { id: "event-ledger", label: "Append-only order ledger", description: "Records requests, acknowledgements and fills.", acceptedZoneIds: ["orders", "audit"], feedback: "The ledger may live beside order state or in a separate audit boundary, but it must be durable." },
      { id: "reconciler", label: "Reconciliation worker", description: "Finds and repairs disagreement with venue records.", acceptedZoneIds: ["audit"], feedback: "Reconciliation is an independent recovery concern." },
    ],
    sources: [quickFixJ, primer],
  },
  {
    id: "video-streaming",
    title: "Publish and stream a video",
    brief: "Separate upload processing from playback so viewers receive nearby segments in a quality their network can sustain.",
    successMessage: "Your design publishes complete renditions asynchronously and keeps application servers out of the media-byte path.",
    zones: [
      { id: "ingest", label: "Upload ingest", description: "Accepts and scans the original object." },
      { id: "process", label: "Media processing", description: "Creates renditions, segments and a complete manifest." },
      { id: "origin", label: "Media origin", description: "Durably stores immutable published media." },
      { id: "delivery", label: "Viewer delivery", description: "Serves cached segments close to viewers." },
    ],
    components: [
      { id: "signed-upload", label: "Signed direct upload", description: "Lets the client send the original to object storage.", acceptedZoneIds: ["ingest", "origin"], feedback: "The signed permission can be issued at ingest while bytes land directly at the origin store." },
      { id: "transcode-workers", label: "Transcode workers", description: "Create multiple qualities and short segments.", acceptedZoneIds: ["process"], feedback: "CPU-heavy conversion belongs off the user request path." },
      { id: "manifest-publisher", label: "Atomic manifest publisher", description: "Exposes only a complete set of segments.", acceptedZoneIds: ["process", "origin"], feedback: "Publication can finish processing or be an atomic origin metadata change." },
      { id: "object-origin", label: "Immutable object origin", description: "Stores manifests and every media segment.", acceptedZoneIds: ["origin"], feedback: "Published media needs durable immutable storage." },
      { id: "cdn", label: "CDN edge cache", description: "Serves popular segments near the viewer.", acceptedZoneIds: ["delivery"], feedback: "The CDN belongs on the playback delivery path." },
    ],
    sources: [primer],
  },
  {
    id: "ride-dispatch",
    title: "Match a rider with one driver",
    brief: "Place fast approximate location search beside a strongly controlled assignment decision.",
    successMessage: "Your design finds fresh candidates quickly while one authoritative transition chooses the driver.",
    zones: [
      { id: "location", label: "Location ingest", description: "Receives replaceable driver positions." },
      { id: "search", label: "Nearby search", description: "Finds and ranks a bounded set of fresh candidates." },
      { id: "dispatch", label: "Dispatch", description: "Sends expiring offers and chooses one acceptance." },
      { id: "trip", label: "Trip authority", description: "Stores the durable trip and assignment state." },
    ],
    components: [
      { id: "cell-index", label: "Geospatial cell index", description: "Groups recent driver positions for nearby lookup.", acceptedZoneIds: ["location", "search"], feedback: "The cell index may be maintained during ingest or queried as the search layer." },
      { id: "freshness-filter", label: "Freshness and eligibility filter", description: "Removes old or unavailable driver records.", acceptedZoneIds: ["search"], feedback: "Candidate search must remove stale or ineligible drivers before offers." },
      { id: "offer-manager", label: "Expiring offer manager", description: "Sends bounded offers and closes them after assignment.", acceptedZoneIds: ["dispatch"], feedback: "Offer lifecycle belongs to dispatch." },
      { id: "atomic-assign", label: "Atomic trip assignment", description: "Allows exactly one acceptance to win.", acceptedZoneIds: ["dispatch", "trip"], feedback: "The guarded transition can be initiated by dispatch or enforced at the trip store boundary." },
      { id: "trip-store", label: "Trip state store", description: "Persists the rider, assigned driver and status.", acceptedZoneIds: ["trip"], feedback: "The final assignment needs one durable authority." },
    ],
    sources: [h3, primer],
  },
] as const;

export function getArchitectureScenario(id: string): ArchitectureScenario | undefined {
  return architectureScenarios.find((scenario) => scenario.id === id);
}
