import type { ProfileDetails } from "@acemyinterview/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfilePanel } from "./profile-panel";

const fetchProfile = vi.hoisted(() => vi.fn());
const updateProfile = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  fetchProfile,
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
    fetchProfile.mockReset();
    updateProfile.mockReset();
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
