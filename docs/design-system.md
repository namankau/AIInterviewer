# Untiered web design system

The source of truth is `apps/web/src/app/globals.css`. Tailwind 4 reads the aliases in `@theme inline`; components use semantic class names such as `bg-surface-raised`, `text-ink-muted`, and `border-line`. Do not copy hex values into JSX. The palette serves an open, encouraging learning platform and keeps live interview screens quiet.

## Color

| Role | Light token | Use |
| --- | --- | --- |
| Primary | `--accent` (`#2456d3`) | Main action, active navigation, links |
| Primary hover | `--accent-strong` (`#1948b7`) | Hover and stronger text |
| Secondary | `--navy` (`#142449`) | Hero, footer, focused scenario surfaces |
| Supporting accent | `--accent-2` (`#087f68`) | Progress and achievement |
| Highlight | `--highlight` (`#e9a72d`) | Small emphasis only |
| Neutral | `--neutral-50` through `--neutral-900` | Art and data views; use roles for UI |
| Background / card / inset | `--surface` / `--surface-raised` / `--surface-sunken` | Page, card, inset |
| Text | `--ink` / `--ink-muted` / `--ink-subtle` | Primary, secondary, tertiary |
| Border | `--line` / `--line-strong` | Default and stronger dividers |
| Semantic | `--positive`, `--warning`, `--danger`, `--info` | Status; pair with matching `-wash` |

The dark palette uses the same roles under `prefers-color-scheme: dark`. Contrast must be checked in both modes. Use `text-on-navy` and `text-on-navy-muted` on navy bands. Never use a wash token as foreground text.

## Type

Plus Jakarta Sans is self-hosted through `next/font` for the product interface. Code uses the system monospace stack. Use `text-hero` for marketing hero, `text-display` for page h1, `text-title` for major sections, `text-h2`, `text-h3`, `text-h4` where document hierarchy needs them, `text-heading` for card titles, `text-body` for reading copy, `text-label` for controls, and `text-caption`/`text-micro` for supporting text. The scale and line heights live in `@theme inline`; do not use arbitrary `text-[...]` sizes.

## Geometry and motion

- Spacing follows Tailwind's 4px scale. CSS counterparts are `--space-1` through `--space-16` for shared CSS.
- Radius: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, and `--radius-pill`.
- Elevation: `--shadow-sm`, `--shadow-md`, and `--shadow-lg`. A card starts with `--shadow-sm`; stronger shadows are reserved for overlays.
- Container widths: `--layout-content` and `--layout-wide`. Breakpoints align with Tailwind `sm` (40rem), `md` (48rem), `lg` (64rem), `xl` (80rem).
- Layers: `--z-base`, `--z-sticky`, `--z-overlay`, and `--z-toast`.
- Motion: `--motion-fast` 150ms, `--motion-base` 200ms, `--motion-slow` 250ms, using `--ease-product`. The global reduced-motion rule removes decorative animation and transitions.
- Interactive controls must be at least 44px high and retain the global visible focus outline. Only use a smaller visible icon if its clickable parent remains 44px.

## Usage

```tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input, FieldHint } from "@/components/ui/field";

<Card className="p-6">
  <FieldLabel htmlFor="role">Target role</FieldLabel>
  <Input id="role" aria-describedby="role-hint" />
  <FieldHint id="role-hint">Use the job title.</FieldHint>
  <Button className="mt-6">Continue</Button>
</Card>
```

Use `Button` and `ActionLink` for equivalent actions; keep native `button`, `label`, and form semantics. Reuse `ErrorPanel` and `RouteLoading` for route feedback. Dynamic chart positions and progress widths may use inline percentage styles; their colors and shapes still come from tokens.

Do not invent employer-specific visual labels or progress claims. The live interview remains sparse: speaking state, timer, round label, and exit are the primary visible controls.
