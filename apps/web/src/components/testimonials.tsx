import Image from "next/image";

import type { LandingTestimonial } from "@/content/landing-testimonials";

export function Testimonials({ testimonials }: { testimonials: readonly LandingTestimonial[] }) {
  if (testimonials.length === 0) return null;

  return (
    <section aria-labelledby="candidate-stories" className="border-b border-line bg-surface-sunken">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col gap-3 pb-10 sm:max-w-3xl">
          <span className="pill pill-positive w-fit">Candidate stories</span>
          <h2 id="candidate-stories" className="text-display text-balance text-ink">
            Practice that changed the next conversation.
          </h2>
          <p className="text-body text-ink-muted">
            Real words from candidates who agreed to share their experience with Untiered.
          </p>
        </div>

        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {testimonials.map((testimonial) => (
            <li
              key={`${testimonial.name}-${testimonial.quote}`}
              className="relative flex min-h-72 flex-col overflow-hidden rounded-3xl border border-line bg-surface-raised p-7 shadow-[var(--shadow-sm)]"
            >
              <span aria-hidden="true" className="absolute right-4 top-1 text-hero font-bold leading-none text-accent/10">
                “
              </span>
              <blockquote className="relative text-body leading-relaxed text-ink">
                “{testimonial.quote}”
              </blockquote>
              <div className="relative mt-auto flex items-center gap-3 border-t border-line pt-6">
                <Image
                  src={testimonial.avatarSrc}
                  alt={`${testimonial.name}'s profile photo`}
                  width={48}
                  height={48}
                  className="size-12 rounded-full border border-line object-cover shadow-[var(--shadow-sm)]"
                />
                <div>
                  <p className="text-caption font-semibold text-ink">{testimonial.name}</p>
                  {testimonial.context ? <p className="text-micro text-ink-subtle">{testimonial.context}</p> : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
