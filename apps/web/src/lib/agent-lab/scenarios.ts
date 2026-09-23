import type { LabClause, LabScenario } from "@/lib/agent-lab/types";

/**
 * The agent lab's scenarios (task 057). Authored content, not model output — every
 * observation string below is a made-up record from a made-up system, and none of it
 * describes any real company, order, train or person.
 *
 * Each scenario exists to make one specific failure visible by letting the reader cause
 * it: a tool that was never given, a tool description that does not say what the tool
 * needs, a loop nobody told to stop, and an agent that cannot see what its own actions
 * returned.
 */

const USE_TOOLS: LabClause = {
  id: "use-tools",
  text: "Before you answer, look the facts up with the tools. Never answer from memory.",
  effect: "use-tools-first",
  note: "Switch this off and the agent answers straight away, from nothing. Watch what it says.",
};

const ADMIT: LabClause = {
  id: "admit",
  text: "If you cannot look something up, say you do not know. Never guess.",
  effect: "admit-uncertainty",
  note: "This only matters when the agent is stuck — it changes an invented answer into an honest one.",
};

const STOP_WHEN_DONE: LabClause = {
  id: "stop",
  text: "Stop as soon as you have what the goal asked for. Do not re-check your own work.",
  effect: "stop-when-answered",
  note: "Switch this off and nothing in the loop decides it is finished. Only the step limit does.",
};

/** Lab 1 — the plain thought / action / observation loop, and what happens without tools. */
const refundStatus: LabScenario = {
  id: "refund-status",
  title: "Has the refund actually been paid?",
  goal: "Find out whether the refund for order A-4471 has actually reached Asha's bank account.",
  brief:
    "The simplest possible agent: two tools, two steps. Run it once as it stands to watch the " +
    "thought → action → observation loop. Then switch the tools off, one at a time, and see what " +
    "an agent does when it cannot look something up.",
  tools: [
    {
      name: "find_order",
      about: "Stands in for the orders database — the thing a support agent would open first.",
      descriptions: [
        {
          id: "precise",
          label: "Accurate",
          text: "Look up one order by its order id. Returns the item, the return date, and the refund id if a refund was raised.",
        },
      ],
      parameters: [{ name: "order_id", type: "string", description: "The order id, e.g. A-4471." }],
    },
    {
      name: "check_refund_status",
      about: "Stands in for the payments system, which is a different system from the orders one.",
      descriptions: [
        {
          id: "precise",
          label: "Accurate",
          text: "Look up one refund by its refund id. Returns its state, the amount, and the date and account it was paid to.",
        },
      ],
      parameters: [{ name: "refund_id", type: "string", description: "The refund id, e.g. RFD-9182." }],
    },
  ],
  clauses: [USE_TOOLS, ADMIT],
  stepLimits: [2, 3, 5, 8],
  plan: [
    {
      thought:
        "I have an order number but not a refund id, and the payments system only takes refund ids. " +
        "So the order lookup has to come first.",
      tool: "find_order",
      args: { order_id: "A-4471" },
      observation:
        '{"order_id": "A-4471", "item": "running shoes", "returned_on": "2026-08-30", "refund_id": "RFD-9182"}',
    },
    {
      thought:
        "The order gave me refund id RFD-9182. Now I can ask the payments system where that refund actually got to.",
      tool: "check_refund_status",
      args: { refund_id: "RFD-9182" },
      observation:
        '{"refund_id": "RFD-9182", "state": "paid", "amount_inr": 3499, "paid_on": "2026-09-08", "to_account": "HDFC ****4412"}',
    },
  ],
  answer:
    "Yes. Refund RFD-9182 for order A-4471 — ₹3,499 — was paid on 8 September 2026 into the HDFC account ending 4412.",
  guessedAnswer:
    "Your refund for order A-4471 has been processed and should reach your account within 5–7 working days.",
  honestAnswer:
    "I cannot check this. I have no way to look up order A-4471 or its refund, so I do not know whether the money has been paid.",
  lessons: [
    "One step is one thought, one action, one observation. The observation is the only new fact in the loop.",
    "The second step was only possible because the first one returned the refund id — the agent could not have guessed RFD-9182.",
    "With no tool, the agent still produced an answer. It was fluent, plausible, and about nothing.",
    "The clause that told it to say \"I don't know\" is the only reason the no-tool run ended honestly.",
  ],
};

/** Lab 2 — a tool description that does not say what the tool actually needs. */
const trainBooking: LabScenario = {
  id: "train-booking",
  title: "The tool description is the tool's user manual",
  goal: "Find the earliest train from Pune to Mumbai on 12 October that still has AC chair-car seats.",
  brief:
    "One of these tools has two descriptions: an accurate one and a vague one. Nothing else about " +
    "the tool changes — same name, same parameters, same data behind it. Run it with each and " +
    "compare the traces.",
  tools: [
    {
      name: "search_trains",
      about: "Stands in for a railway timetable API. It is strict about station codes, like the real ones are.",
      descriptions: [
        {
          id: "precise",
          label: "Accurate",
          text:
            "Search trains between two stations on one date. `from` and `to` must be station codes " +
            "(PUNE, CSMT, NDLS), never city names. Returns train number, name and departure time, earliest first.",
        },
        {
          id: "vague",
          label: "Vague",
          text: "Finds trains.",
          misleading: true,
        },
      ],
      parameters: [
        { name: "from", type: "string", description: "Origin." },
        { name: "to", type: "string", description: "Destination." },
        { name: "date", type: "string", description: "Travel date, YYYY-MM-DD." },
      ],
    },
    {
      name: "check_availability",
      about: "Stands in for the seat-availability service, which is a separate call from the timetable.",
      descriptions: [
        {
          id: "precise",
          label: "Accurate",
          text: "Check seats on one train, on one date, in one class code (CC, SL, 3A, 2A). Returns the availability string.",
        },
      ],
      parameters: [
        { name: "train", type: "string", description: "Train number, e.g. 12124." },
        { name: "date", type: "string", description: "Travel date, YYYY-MM-DD." },
        { name: "class", type: "string", description: "Class code, e.g. CC." },
      ],
    },
  ],
  clauses: [USE_TOOLS, ADMIT],
  stepLimits: [3, 4, 6, 10],
  plan: [
    {
      thought:
        "The description says `from` and `to` are station codes, not city names. Pune is PUNE and " +
        "Mumbai's main terminus is CSMT, so I will use those.",
      tool: "search_trains",
      args: { from: "PUNE", to: "CSMT", date: "2026-10-12" },
      observation:
        '[{"train": "12124", "name": "Deccan Queen", "dep": "07:15"}, {"train": "11008", "name": "Deccan Express", "dep": "15:10"}]',
      misled: {
        thought:
          "The description just says it finds trains, so I will pass the two places the user named " +
          "and hope that is what it wants.",
        args: { from: "Pune", to: "Mumbai", date: "2026-10-12" },
        observation:
          '{"error": "unknown station \'Pune\' — expected a station code such as PUNE; see /stations for the list"}',
      },
    },
    {
      thought:
        "12124 Deccan Queen at 07:15 is the earlier of the two. The goal asks for AC chair car, " +
        "which is class code CC, so I will check that specifically.",
      tool: "check_availability",
      args: { train: "12124", date: "2026-10-12", class: "CC" },
      observation: '{"train": "12124", "date": "2026-10-12", "class": "CC", "status": "AVAILABLE 41"}',
    },
  ],
  answer:
    "12124 Deccan Queen, departing PUNE at 07:15 on 12 October, has AC chair car available — 41 seats at the time of checking.",
  guessedAnswer:
    "The Deccan Queen leaves Pune around 7am and normally has chair car seats — you should be able to book it.",
  honestAnswer:
    "I have no way to search the timetable or check seats, so I do not know what runs from Pune on 12 October or what is available.",
  lessons: [
    "The vague description cost a whole step and produced a call the API rejected. Nothing about the tool changed — only what the agent was told about it.",
    "The agent recovered because the error said what was wrong. An error that just said \"bad request\" would have left it guessing.",
    "Now switch observations off and run the vague version again: it cannot read the error, so it makes the same wrong call until the step limit.",
    "Tool descriptions are read by the model on every single turn. They are part of the prompt, and they cost tokens like the rest of it.",
  ],
};

/** Lab 3 — nothing in the loop decides it is finished. */
const pantryRestock: LabScenario = {
  id: "pantry-restock",
  title: "An agent with nothing telling it to stop",
  goal: "Make sure the kitchen does not run out of atta this week.",
  brief:
    "This agent does its job correctly in two steps. The interesting part is what happens after " +
    "that. Switch off the \"stop as soon as you are done\" clause, set the step limit high, and run it.",
  tools: [
    {
      name: "check_stock",
      about: "Stands in for a pantry inventory — which, like most real ones, updates when the delivery arrives, not when the order is placed.",
      descriptions: [
        {
          id: "precise",
          label: "Accurate",
          text: "Read how much of one item is in the pantry right now, and how much is typically used in a week.",
        },
      ],
      parameters: [{ name: "item", type: "string", description: "Item name, e.g. atta." }],
    },
    {
      name: "order_item",
      about: "Stands in for placing a grocery order. It really does place one, every time it is called.",
      descriptions: [
        {
          id: "precise",
          label: "Accurate",
          text: "Place an order for one item, in kilograms. Returns the expected delivery day.",
        },
      ],
      parameters: [
        { name: "item", type: "string", description: "Item name." },
        { name: "kg", type: "string", description: "Quantity in kilograms." },
      ],
    },
  ],
  clauses: [USE_TOOLS, STOP_WHEN_DONE, ADMIT],
  stepLimits: [2, 4, 6, 9],
  loopsAfterAnswer: true,
  plan: [
    {
      thought: "Before ordering anything I should find out how much is actually left and how fast it goes.",
      tool: "check_stock",
      args: { item: "atta" },
      observation: '{"item": "atta", "kg_left": 2, "weekly_use_kg": 6}',
    },
    {
      thought: "2 kg left against about 6 kg a week. Ordering 5 kg covers the week with a little margin.",
      tool: "order_item",
      args: { item: "atta", kg: "5" },
      observation: '{"ordered": "atta", "kg": 5, "delivery": "tomorrow"}',
    },
    {
      afterAnswer: true,
      thought: "Let me confirm the pantry is healthy now.",
      tool: "check_stock",
      args: { item: "atta" },
      observation: '{"item": "atta", "kg_left": 2, "weekly_use_kg": 6}',
    },
    {
      afterAnswer: true,
      thought: "Still only 2 kg against 6 kg a week. That is not enough. I should order.",
      tool: "order_item",
      args: { item: "atta", kg: "5" },
      observation: '{"ordered": "atta", "kg": 5, "delivery": "tomorrow"}',
    },
  ],
  answer: "Ordered 5 kg of atta, arriving tomorrow. With 2 kg left and about 6 kg used a week, that covers you.",
  guessedAnswer: "You most likely have enough atta for the week — most kitchens keep a few kilos in.",
  honestAnswer: "I cannot see inside the pantry and cannot place an order, so I do not know whether you will run out.",
  lessons: [
    "The stock tool reads the pantry, and the pantry only changes when the delivery arrives. So the second check returns exactly what the first one did.",
    "The agent is not malfunctioning. It is doing precisely what it was asked, forever, because nothing told it when \"done\" was.",
    "Every extra turn here placed a real order. A loop that only wastes tokens is the lucky version of this bug.",
    "The step limit is the backstop, not the design. Both the OpenAI Agents SDK's `max_turns` and Anthropic's \"stopping conditions\" guidance exist for exactly this run.",
  ],
};

/** Lab 4 — an agent that cannot see what its own actions returned. */
const helpdeskReset: LabScenario = {
  id: "helpdesk-reset",
  title: "An agent that cannot see what it just did",
  goal: "Work out why Ravi's password reset email never arrived, and get him back in.",
  brief:
    "Four steps, and each one is chosen because of what the step before it returned. Run it once " +
    "as it stands. Then switch off \"show the agent what its actions returned\" and run it again.",
  tools: [
    {
      name: "find_user",
      about: "Stands in for the user directory.",
      descriptions: [
        {
          id: "precise",
          label: "Accurate",
          text: "Find a user by the email address they gave you. Returns their user id, the email address actually on file, and their status.",
        },
      ],
      parameters: [{ name: "email", type: "string", description: "The address the user says is theirs." }],
    },
    {
      name: "check_email_log",
      about: "Stands in for the mail delivery log — the record of what was sent where, and what happened to it.",
      descriptions: [
        {
          id: "precise",
          label: "Accurate",
          text: "Read the recent mail this user was sent: when, to which address, and whether it was delivered or bounced.",
        },
      ],
      parameters: [{ name: "user_id", type: "string", description: "User id, e.g. U-2290." }],
    },
    {
      name: "update_email",
      about: "Stands in for correcting the address on the account. A write, not a read.",
      descriptions: [
        {
          id: "precise",
          label: "Accurate",
          text: "Change the email address on file for one user.",
        },
      ],
      parameters: [
        { name: "user_id", type: "string", description: "User id." },
        { name: "email", type: "string", description: "The corrected address." },
      ],
    },
    {
      name: "resend_reset",
      about: "Stands in for sending a fresh password-reset link.",
      descriptions: [
        {
          id: "precise",
          label: "Accurate",
          text: "Send a new password reset email to whatever address is currently on file for this user.",
        },
      ],
      parameters: [{ name: "user_id", type: "string", description: "User id." }],
    },
  ],
  clauses: [USE_TOOLS, STOP_WHEN_DONE, ADMIT],
  stepLimits: [4, 6, 8, 12],
  plan: [
    {
      thought: "Ravi gave me an address. The first thing worth knowing is whether it matches what the account actually holds.",
      tool: "find_user",
      args: { email: "ravi.k@example.com" },
      observation:
        '{"user_id": "U-2290", "email_on_file": "ravi.k@exampel.com", "status": "active"}',
    },
    {
      thought:
        "The address on file is ravi.k@exampel.com — 'exampel', not 'example'. That looks like a typo. " +
        "The mail log will tell me whether that is where the resets went.",
      tool: "check_email_log",
      args: { user_id: "U-2290" },
      observation:
        '{"last_reset_email": "2026-09-19T11:04Z", "to": "ravi.k@exampel.com", "delivery": "bounced: domain not found"}',
    },
    {
      thought:
        "Confirmed: it bounced because the domain does not exist. Resending now would bounce again. " +
        "I have to fix the address first.",
      tool: "update_email",
      args: { user_id: "U-2290", email: "ravi.k@example.com" },
      observation: '{"user_id": "U-2290", "email": "ravi.k@example.com", "updated": true}',
    },
    {
      thought: "Address corrected. Now a fresh reset link will go somewhere that exists.",
      tool: "resend_reset",
      args: { user_id: "U-2290" },
      observation:
        '{"sent_to": "ravi.k@example.com", "delivery": "delivered", "at": "2026-09-22T09:12Z"}',
    },
  ],
  answer:
    "The address on the account was ravi.k@exampel.com — a typo — so every reset email bounced with " +
    "\"domain not found\". I corrected it to ravi.k@example.com and sent a fresh link, which was delivered at 09:12.",
  guessedAnswer:
    "Please check your spam folder and try the reset link again in a few minutes. If it still does not arrive, contact support.",
  honestAnswer:
    "I cannot look up the account or the mail log, so I do not know why the email did not arrive.",
  lessons: [
    "Step 2 exists because step 1 returned a misspelled address. Step 3 exists because step 2 said it bounced. Take the observations away and none of that reasoning can happen.",
    "With observations hidden, every turn looks identical to the agent — same goal, same tools, nothing new — so it makes the same call again, and again.",
    "This is the loop's real engine. Anthropic's guidance calls it \"ground truth from the environment at each step\"; the ReAct paper is the same idea under a different name.",
    "The guessed answer is what a support reply looks like when nobody checked anything. It is not wrong on purpose; it is just about nothing.",
  ],
};

export const agentLabScenarios: LabScenario[] = [refundStatus, trainBooking, pantryRestock, helpdeskReset];

export function getScenario(id: string): LabScenario | undefined {
  return agentLabScenarios.find((scenario) => scenario.id === id);
}
