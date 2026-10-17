import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldHint, FieldLabel, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { ProgressBar } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";

describe("shared UI primitives", () => {
  it("keeps a button non-submitting unless its caller opts in", () => {
    render(<Button>Continue</Button>);

    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute("type", "button");
  });

  it("renders action links as navigable links", () => {
    render(<ActionLink href="/interview/new">New interview</ActionLink>);

    expect(screen.getByRole("link", { name: "New interview" })).toHaveAttribute(
      "href",
      "/interview/new",
    );
  });

  it("keeps a loading action unavailable and announces its busy state", () => {
    render(<Button loading>Save changes</Button>);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toHaveAttribute("aria-busy", "true");
  });

  it("retains native field labelling and description relationships", () => {
    render(
      <>
        <FieldLabel htmlFor="role">Target role</FieldLabel>
        <Input id="role" aria-describedby="role-hint" />
        <FieldHint id="role-hint">Use the title from the job post.</FieldHint>
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Target role" })).toHaveAccessibleDescription(
      "Use the title from the job post.",
    );
  });

  it("uses semantic heading and status content", () => {
    render(
      <PageHeader
        eyebrow="Practice"
        title="Your interview plan"
        description={<Badge tone="positive">Ready</Badge>}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Your interview plan" })).toBeVisible();
    expect(screen.getByText("Ready")).toBeVisible();
  });

  it("announces errors and exposes bounded progress accessibly", () => {
    render(<><Alert tone="error">Could not save</Alert><ProgressBar label="Course progress" value={125} /></>);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
    expect(screen.getByRole("progressbar", { name: "Course progress" })).toHaveAttribute("aria-valuenow", "100");
  });

  it("offers an action when a collection is empty", () => {
    render(<EmptyState title="No rounds yet" action={<Button>Start a round</Button>} />);
    expect(screen.getByRole("heading", { name: "No rounds yet" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Start a round" })).toBeEnabled();
  });

  it("moves tab focus and selection with arrow keys", () => {
    const onChange = vi.fn();
    render(<Tabs tabs={[{ id: "overview", label: "Overview" }, { id: "history", label: "History" }]} active="overview" onChange={onChange} label="Profile sections" idPrefix="profile" />);
    const overview = screen.getByRole("tab", { name: "Overview" });
    overview.focus();
    fireEvent.keyDown(overview, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("history");
    expect(screen.getByRole("tab", { name: "History" })).toHaveFocus();
  });
});
