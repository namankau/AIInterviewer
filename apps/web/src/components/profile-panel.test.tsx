import type { ProfileDetails } from "@acemyinterview/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfilePanel } from "./profile-panel";
import { resetCourseProgress } from "@/lib/use-course-progress";

const fetchProfile = vi.hoisted(() => vi.fn());
const updateProfile = vi.hoisted(() => vi.fn());
const fetchMe = vi.hoisted(() => vi.fn());
const fetchSessions = vi.hoisted(() => vi.fn());
const fetchArenaProgress = vi.hoisted(() => vi.fn());
const fetchCourseProgress = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  fetchProfile,
  fetchMe,
  fetchSessions,
  fetchArenaProgress,
  fetchCourseProgress,
  updateProfile,
  uploadResume: vi.fn(),
  deleteResume: vi.fn(),
  uploadAvatar: vi.fn(),
  saveSkill: vi.fn(),
  removeSkill: vi.fn(),
  ApiRequestError: class ApiRequestError extends Error {},
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));

const profile = (over: Partial<ProfileDetails> = {}): ProfileDetails => ({
  resume: null,
  skills: [],
  avatarUrl: null,
  currentLevel: null,
  targetLevel: null,
  linkedinUrl: null,
  ...over,
});

/**
 * The reported bug, which was end to end: the profile was write-only. Everything typed
 * into this form persisted correctly and nothing ever came back, so on the next visit the
 * fields were blank again and the save looked as though it had failed.
 */
describe("ProfilePanel", () => {
  beforeEach(() => {
    resetCourseProgress();
    fetchProfile.mockReset();
    updateProfile.mockReset();
    fetchMe.mockReset();
    fetchSessions.mockReset();
    fetchArenaProgress.mockReset();
    fetchCourseProgress.mockReset();
    fetchMe.mockResolvedValue({
      id: "candidate-1",
      email: "candidate@example.com",
      displayName: "Candidate",
      preferredLanguage: "english",
      createdAt: "2026-09-01T00:00:00Z",
      profile: {},
    });
    fetchSessions.mockResolvedValue([]);
    fetchArenaProgress.mockResolvedValue({
      xp: 0,
      streak: { current: 0, longest: 0, lastActiveDate: null },
      badges: [],
      cards: {},
      masteredChallengeIds: [],
    });
    fetchCourseProgress.mockResolvedValue({ completed: {} });
  });

  it("puts identity, learning progress, interview history and Arena activity in one overview", async () => {
    fetchProfile.mockResolvedValue(profile({ avatarUrl: "https://example.com/avatar.png", targetLevel: "Staff Engineer" }));
    fetchCourseProgress.mockResolvedValue({
      completed: { java: ["intro", "loops"], dsa: ["arrays"] },
    });
    fetchSessions.mockResolvedValue([
      {
        id: "round-1",
        companyName: "Acme",
        roleTitle: "Backend Engineer",
        roundType: "technical_fundamentals",
        status: "completed",
        startedAt: "2026-09-20T10:00:00Z",
        endedAt: "2026-09-20T10:30:00Z",
        hasReport: true,
        reportExpired: false,
        reportExpiresAt: null,
        reportRetentionDays: 30,
      },
      {
        id: "round-2",
        companyName: "Example Co",
        roleTitle: "Platform Engineer",
        roundType: "behavioural_competency",
        status: "completed",
        startedAt: "2026-09-21T10:00:00Z",
        endedAt: "2026-09-21T10:30:00Z",
        hasReport: true,
        reportExpired: false,
        reportExpiresAt: null,
        reportRetentionDays: 30,
      },
    ]);
    fetchArenaProgress.mockResolvedValue({
      xp: 120,
      streak: { current: 4, longest: 7, lastActiveDate: "2026-09-24" },
      badges: [],
      cards: {},
      masteredChallengeIds: [],
    });

    render(
      <ProfilePanel
        outlines={[
          { slug: "java", title: "Java Programming", chapters: [{ slug: "intro", title: "Intro" }, { slug: "loops", title: "Loops" }] },
          { slug: "dsa", title: "Data Structures", chapters: [{ slug: "arrays", title: "Arrays" }, { slug: "trees", title: "Trees" }] },
        ]}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Candidate" })).toBeInTheDocument();
    expect(screen.getByAltText("Profile photo")).toHaveAttribute("src", "https://example.com/avatar.png");
    expect(await screen.findByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("4 days")).toBeInTheDocument();
    expect(screen.getByText("Example Co")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/courses/dsa/trees");
  });

  it("shows back what was saved, rather than an empty form", async () => {
    fetchProfile.mockResolvedValue(
      profile({
        currentLevel: "Senior Member of Technical Staff",
        targetLevel: "Staff Engineer",
        linkedinUrl: "https://linkedin.com/in/naman",
      }),
    );

    render(<ProfilePanel />);

    await waitFor(() =>
      expect(screen.getByLabelText(/linkedin/i)).toHaveValue("https://linkedin.com/in/naman"),
    );
    expect(screen.getByLabelText(/current level/i)).toHaveValue("Senior Member of Technical Staff");
    expect(screen.getByLabelText(/target level/i)).toHaveValue("Staff Engineer");
  });

  /**
   * The candidate told us their current role by uploading a resume. Making them type it
   * again into a box labelled "as your employer titles it" is asking the same question
   * twice.
   */
  it("fills the current role in from the resume when nothing has been saved", async () => {
    fetchProfile.mockResolvedValue(
      profile({
        resume: {
          id: "r1",
          filename: "cv.pdf",
          status: "parsed",
          error: null,
          uploadedAt: "2026-09-08T00:00:00Z",
          headline: "Backend engineer",
          employments: [
            { employer: "Infosys", title: "Engineer", startDate: "2019-07-01", endDate: "2022-02-01", current: false },
            { employer: "Salesforce", title: "SMTS", startDate: "2022-03-01", endDate: null, current: true },
          ],
          projects: [],
          detectedSkills: [],
          lowConfidenceFields: [],
          totalExperienceMonths: 86,
          gapCount: 0,
          shortTenureCount: 0,
        },
      }),
    );

    render(<ProfilePanel />);

    await waitFor(() => expect(screen.getByLabelText(/current level/i)).toHaveValue("SMTS"));
  });

  /**
   * Blank fields have to reach the server. The form used to drop them before sending, and
   * the server reads absent as "leave it alone", so a field could never be emptied once
   * it had been filled in.
   */
  it("can empty a field that was filled in before", async () => {
    fetchProfile.mockResolvedValue(profile({ linkedinUrl: "https://linkedin.com/in/wrong" }));
    updateProfile.mockResolvedValue(profile());

    render(<ProfilePanel />);
    const linkedin = await screen.findByLabelText(/linkedin/i);
    await waitFor(() => expect(linkedin).toHaveValue("https://linkedin.com/in/wrong"));

    await userEvent.clear(linkedin);
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith("token", expect.objectContaining({ linkedinUrl: "" })),
    );
  });

});
