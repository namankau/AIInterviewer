import type { ArchitectureScenario } from "@/lib/architecture-lab/types";

const primer = {
  title: "System Design Primer",
  url: "https://github.com/donnemartin/system-design-primer",
  license: "CC BY 4.0",
} as const;

const aiAgents = {
  title: "AI Agents for Beginners",
  url: "https://github.com/microsoft/ai-agents-for-beginners",
  license: "MIT",
} as const;

const generativeAi = {
  title: "Generative AI for Beginners",
  url: "https://github.com/microsoft/generative-ai-for-beginners",
  license: "MIT",
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
] as const;

export function getArchitectureScenario(id: string): ArchitectureScenario | undefined {
  return architectureScenarios.find((scenario) => scenario.id === id);
}
