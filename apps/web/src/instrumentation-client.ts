import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry-options";

// Browser errors. No replay integration: it records the screen, and the screen here is a
// candidate's interview.
Sentry.init(sentryOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
