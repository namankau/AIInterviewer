import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BlockRenderer } from "@/components/courses/block-renderer";
import { InlineText, plainText } from "@/components/courses/inline-text";

describe("InlineText", () => {
  it("renders *italic* as emphasis, without the asterisks", () => {
    const { container } = render(<InlineText text="checked *before* the loop" />);
    expect(container.querySelector("em")?.textContent).toBe("before");
    expect(container.textContent).toBe("checked before the loop");
  });

  it("leaves spaced arithmetic asterisks alone", () => {
    const { container } = render(<InlineText text="2 * 3 * 4 is 24" />);
    expect(container.querySelector("em")).toBeNull();
    expect(container.textContent).toBe("2 * 3 * 4 is 24");
  });

  it("keeps bold and italic apart", () => {
    const { container } = render(<InlineText text="**always** runs *once*" />);
    expect(container.querySelector("strong")?.textContent).toBe("always");
    expect(container.querySelector("em")?.textContent).toBe("once");
  });

  it("formats markup in block titles and headings", () => {
    const { container } = render(
      <BlockRenderer
        blocks={[
          { kind: "h", text: "The anatomy of `main`" },
          { kind: "trace", title: "Following `total`", steps: ["one"] },
        ]}
      />,
    );
    expect(container.textContent).not.toContain("`");
    expect(container.querySelectorAll("code")).toHaveLength(2);
  });
});

describe("plainText", () => {
  it("strips inline markup for page titles and descriptions", () => {
    expect(plainText("Anatomy of `main`, **bold** and *italic*")).toBe(
      "Anatomy of main, bold and italic",
    );
  });
});
