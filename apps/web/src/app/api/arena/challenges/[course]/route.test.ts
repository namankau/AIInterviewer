import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.hoisted(() => vi.fn());
const challengesForCourse = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getClaims } }),
}));
vi.mock("@/lib/arena/corpus", () => ({ challengesForCourse }));

import { GET } from "./route";

const params = { params: Promise.resolve({ course: "java" }) };

describe("GET /api/arena/challenges/[course]", () => {
  beforeEach(() => {
    getClaims.mockReset();
    challengesForCourse.mockReset().mockReturnValue([{ id: "one" }]);
  });

  it("serves the course's challenges to a signed-in learner", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });

    const response = await GET(new Request("http://localhost/api/arena/challenges/java"), params);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "one" }]);
    expect(challengesForCourse).toHaveBeenCalledWith("java");
  });

  it("refuses a signed-out request without reading the corpus", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });

    const response = await GET(new Request("http://localhost/api/arena/challenges/java"), params);

    expect(response.status).toBe(401);
    expect(challengesForCourse).not.toHaveBeenCalled();
  });
});
