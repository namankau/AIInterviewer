import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal-page";
import { CONTACT_EMAIL_DISPLAY, LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Contact",
  description: `How to reach the ${LEGAL.productName} team.`,
};

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact"
      intro="Questions, problems with a round, or a request about your data: write to us and a person will reply."
    >
      <LegalSection id="email" title="Email">
        <p>
          {LEGAL.contactEmail ? (
            <a href={`mailto:${LEGAL.contactEmail}`} className="font-medium text-accent hover:underline">
              {LEGAL.contactEmail}
            </a>
          ) : (
            CONTACT_EMAIL_DISPLAY
          )}
        </p>
        <p>
          If something went wrong in an interview, include the date and the company you were
          practising for. Never send us your password; we never ask for it.
        </p>
      </LegalSection>

      <LegalSection id="data" title="Data requests and complaints">
        <p>
          To see, correct or delete your data, or to make a complaint, write to our Grievance
          Officer, {LEGAL.grievanceOfficer}, at the address above. We reply within 30 days. You can
          also delete interviews or your whole account yourself from your profile. See the{" "}
          <Link href="/privacy" className="font-medium text-accent hover:underline">
            privacy policy
          </Link>{" "}
          for your rights.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
