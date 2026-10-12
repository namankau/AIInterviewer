export interface LandingTestimonial {
  /** A genuine quote approved by the person named below. */
  quote: string;
  name: string;
  /** Optional context such as “Final-year CSE student”; never invent an employer. */
  context?: string;
  /** Store approved profile images under `apps/web/public/testimonials/`. */
  avatarSrc: `/testimonials/${string}`;
}

/**
 * Testimonials are deliberately empty until real candidates approve their quote,
 * display name, context, and profile image. The landing page omits the whole section
 * while this list is empty; fabricated social proof would damage the trust it is meant
 * to create.
 */
export const LANDING_TESTIMONIALS: readonly LandingTestimonial[] = [];
