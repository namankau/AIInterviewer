import { dashboardQuestionPool } from "@/lib/arena/corpus";
import { possibleDateKeysWorldwide, questionOfTheDay } from "@/lib/arena/progression";
import { courseEnabled } from "@/lib/flags";

/** Only the dates that can be "today" anywhere are sent to the browser. */
export function dailyQuestionsByDate() {
  const eligible = dashboardQuestionPool.filter((challenge) => courseEnabled(challenge.courseSlug));
  return Object.fromEntries(
    possibleDateKeysWorldwide().flatMap((dateKey) => {
      const question = questionOfTheDay(eligible, dateKey);
      return question ? [[dateKey, question] as const] : [];
    }),
  );
}
