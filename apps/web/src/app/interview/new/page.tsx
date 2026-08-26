import type { Metadata } from "next";

import { NewInterviewForm } from "@/components/new-interview-form";

export const metadata: Metadata = { title: "Start an interview" };

/**
 * Session setup. Company and role are named here, per session — there is no stored
 * target list, and no setup step that asks the candidate to declare targets in
 * advance (PRD 05).
 */
export default function NewInterviewPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <NewInterviewForm />
    </div>
  );
}
