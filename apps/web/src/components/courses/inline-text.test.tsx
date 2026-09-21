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

  it("renders {{O(n)}} as a complexity pill, without the braces", () => {
    const { container } = render(<InlineText text="This runs in {{O(n log n)}} time." />);
    expect(container.textContent).toBe("This runs in O(n log n) time.");
    const pill = container.querySelector(".pill-accent");
    expect(pill?.textContent).toBe("O(n log n)");
  });

  it("renders ~~term~~ as a key-term chip, without the tildes", () => {
    const { container } = render(<InlineText text="A ~~pivot~~ splits the array." />);
    expect(container.textContent).toBe("A pivot splits the array.");
    const chip = container.querySelector('span[style*="color-mix"]');
    expect(chip?.textContent).toBe("pivot");
  });

  it("leaves a real backtick-quoted array literal containing braces alone (not a complexity pill)", () => {
    const { container } = render(<InlineText text="Given `{{1,2},{3,4}}`, what is its length?" />);
    expect(container.querySelector(".pill-accent")).toBeNull();
    expect(container.querySelector("code")?.textContent).toBe("{{1,2},{3,4}}");
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
