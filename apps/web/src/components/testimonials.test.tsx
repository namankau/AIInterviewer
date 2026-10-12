import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Testimonials } from "@/components/testimonials";

describe("Testimonials", () => {
  it("omits the section instead of inventing social proof when no approved quotes exist", () => {
    const { container } = render(<Testimonials testimonials={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows approved copy, identity, context, and profile photo", () => {
    render(
      <Testimonials
        testimonials={[
          {
            quote: "The follow-up exposed where my explanation became vague.",
            name: "Asha Rao",
            context: "Final-year CSE student",
            avatarSrc: "/testimonials/asha-rao.jpg",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Practice that changed the next conversation." })).toBeInTheDocument();
    expect(screen.getByText(/follow-up exposed/)).toBeInTheDocument();
    expect(screen.getByText("Asha Rao")).toBeInTheDocument();
    expect(screen.getByText("Final-year CSE student")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Asha Rao's profile photo" })).toBeInTheDocument();
  });
});
