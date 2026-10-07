import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ContactPage from "../contact/page";
import TermsPage from "../terms/page";
import PrivacyPage from "./page";

/**
 * The legal pages make promises the code has to keep. These pin the ones that matter most,
 * so a change to the product that breaks one shows up as a failing test, not a false policy.
 */
describe("legal pages", () => {
  it("states the camera is never recorded and recordings go after the retention window", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/your camera is never recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/deleted 28 days after the interview/i)).toBeInTheDocument();
    expect(screen.getByText(/india \(mumbai, ap-south-1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/never receives recordings of your voice/i)).toBeInTheDocument();
  });

  it("shows an obvious gap, never an invented contact, when the owner has not set one", () => {
    render(<ContactPage />);

    expect(screen.getAllByText(/to be confirmed before launch/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /@/ })).not.toBeInTheDocument();
  });

  it("states the same daily allowance the API enforces", () => {
    render(<TermsPage />);

    expect(screen.getByText(/up to 2 rounds and\s+60 minutes a day/i)).toBeInTheDocument();
  });

  it("links every legal page from the others", () => {
    render(<PrivacyPage />);
    const footer = screen.getByRole("navigation", { name: /legal/i });

    expect(footer).toHaveTextContent(/privacy policy/i);
    expect(footer).toHaveTextContent(/terms of use/i);
    expect(footer).toHaveTextContent(/contact/i);
  });
});
