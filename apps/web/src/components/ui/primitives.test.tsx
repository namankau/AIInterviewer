import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldHint, FieldLabel, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";

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
});
