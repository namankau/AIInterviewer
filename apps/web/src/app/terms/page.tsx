import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal-page";
import { CONTACT_EMAIL_DISPLAY, LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of use",
  description: `The terms for using ${LEGAL.productName}.`,
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      intro={`These terms cover your use of ${LEGAL.productName}, a practice tool for job interviews. By signing in you agree to them and to our privacy policy.`}
    >
      <LegalSection id="service" title="What the service is">
        <p>
          {LEGAL.productName} runs practice interviews with an AI interviewer and writes you a
          feedback report. It also offers free courses and practice questions. The interviewer is
          an AI model, not a person, and it is not connected to any employer.
        </p>
      </LegalSection>

      <LegalSection id="practice" title="Practice, not a promise">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Feedback and scores are written by an AI model. They can be wrong and are meant to help
            you practise, not to predict whether you will get a job.
          </li>
          <li>
            When we describe how a company interviews, we label where it comes from: a published
            source, a reported account, or general patterns for that kind of employer. We are not
            affiliated with any employer named on the site, and their names belong to them.
          </li>
          <li>Nothing on the service is career, legal or financial advice.</li>
        </ul>
      </LegalSection>

      <LegalSection id="account" title="Your account">
        <ul className="list-disc space-y-2 pl-5">
          <li>You sign in with Google and are responsible for activity on your account.</li>
          <li>
            You must be 18 or over, or have the verifiable consent of a parent or guardian.
          </li>
          <li>You can delete your account at any time from your profile.</li>
        </ul>
      </LegalSection>

      <LegalSection id="free" title="Free practice and limits">
        <p>
          Practice interviews are currently free, up to {LEGAL.dailyRounds} rounds and{" "}
          {LEGAL.dailyMinutes} minutes a day, reset at midnight India time. We may change these
          limits, or introduce paid plans, and will say so on the site before a change affects you.
          Courses and the Arena are free.
        </p>
      </LegalSection>

      <LegalSection id="use" title="Fair use">
        <p>Please do not:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>use the service to get help during a real interview or assessment;</li>
          <li>upload a resume or recordings of anyone but yourself;</li>
          <li>try to get around the daily limits, for example with automated scripts or many accounts;</li>
          <li>copy or resell the courses, questions or reports, or scrape the service;</li>
          <li>attack, overload or try to access parts of the service or data that are not yours.</li>
        </ul>
        <p>We may suspend accounts that do.</p>
      </LegalSection>

      <LegalSection id="content" title="Your content">
        <p>
          Your resume, recordings and answers remain yours. You let us use them only to provide the
          service to you, as described in our{" "}
          <Link href="/privacy" className="font-medium text-accent hover:underline">
            privacy policy
          </Link>
          . The courses, questions, software and design of {LEGAL.productName} belong to us.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="Availability and liability">
        <p>
          The service is provided as it is, and we do not promise it will always be available or
          free of errors. To the extent the law allows, we are not liable for indirect losses, or
          for decisions made on the basis of AI feedback. Nothing here limits rights you have under
          Indian consumer law.
        </p>
      </LegalSection>

      <LegalSection id="law" title="Changes and governing law">
        <p>
          We may update these terms and will change the date above when we do. If a change is
          significant, we will tell you in the app first. These terms are governed by the laws of
          India. Questions go to {CONTACT_EMAIL_DISPLAY}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
