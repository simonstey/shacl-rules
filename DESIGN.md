---
name: SHACL Rules Playground
description: Browser IDE for authoring and executing SHACL 1.2 Rules in SRL
colors:
  surface: "#ffffff"
  surface-2: "#fafafa"
  surface-3: "#f4f4f5"
  ink: "#18181b"
  ink-2: "#3f3f46"
  ink-muted: "#52525b"
  border: "#e4e4e5"
  border-2: "#d4d4d8"
  surface-dark: "#09090b"
  surface-2-dark: "#18181b"
  surface-3-dark: "#27272a"
  ink-dark: "#f4f4f5"
  ink-2-dark: "#d4d4d8"
  ink-muted-dark: "#a1a1aa"
  border-dark: "#27272a"
  border-2-dark: "#3f3f46"
  accent: "#3b82f6"
  positive: "#16a34a"
  diagram: "#a855f7"
  danger: "#ef4444"
  warning: "#eab308"
typography:
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.05em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  code:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0.01em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-run:
    backgroundColor: "{colors.positive}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.lg}"
    padding: "8px"
  input-search:
    backgroundColor: "{colors.surface-3-dark}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    padding: "8px 12px"
  provenance-badge:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
---

# Design System: SHACL Rules Playground

## 1. Overview

**Creative North Star: "The Reference Bench"**

A workbench for people who work in triples. This is not a marketing surface and never pretends to be one — it is a precise instrument for authoring SHACL 1.2 Rules, running them over real RDF, and inspecting exactly what was inferred and why. The visual system earns trust the way a good reference implementation does: through legibility, honest state, and the total absence of decoration that doesn't carry information. The tool disappears into the task; the code and the inferred triples are the only things asking for attention.

Density is deliberate. Two Monaco editors, a live validation stream, a syntax breakdown, and a provenance-linked inference panel all coexist on one screen without cards, without shadows, without a hero. Structure comes from a two-tier neutral surface system and hairline borders, not from elevation. Color is rationed hard: a single blue accent for interaction and selection, green reserved for "run" and "valid", purple for the syntax-diagram mode, and an eight-hue categorical ramp used **only** to bind an inferred triple to the rule that produced it. Color is a data channel here, not a mood.

The system explicitly rejects: generic AI-SaaS chrome (cream/gradient/glass, hero metrics, rounded card grids); cluttered enterprise-IDE toolbars and gray-on-gray dialog soup; toy-like cartoon color; and over-minimal stripping that would hide the state a practitioner needs. It should read like a first-class developer tool — VS Code / Linear lineage — not a landing page and not Eclipse.

**Key Characteristics:**
- Two-tier neutral surfaces + hairline borders instead of cards and shadows
- Rationed accent color; provenance is the only place a full palette appears
- Monospace for all RDF/SRL content, sans for chrome; never mixed
- Light and dark are equal first-class themes, driven by a class on `<html>`
- Every state legible: default / hover / focus / active / disabled / loading / error / empty

## 2. Colors

A two-tier neutral surface system in both themes, one blue accent, and a small set of semantic status colors. Neutrals are true zinc (chroma ~0) — no warm or cool tint.

### Primary
- **Signal Blue** (#3b82f6): The single interaction accent. Primary-action affordance, current selection, focus ring, active tab underline, resize-handle hover, and the "syntax analysis" panel toggle. Never decorative — if blue appears, something is interactive or selected.

### Secondary
- **Run Green** (#16a34a): Reserved for the Run Rules action and the "valid" / "inferred-count" status. Green means "go" and "good"; it appears nowhere else.
- **Diagram Purple** (#a855f7): Marks the syntax-diagram mode and its toggle only. A mode color, not a general accent.

### Tertiary — Provenance Ramp
An 8-hue categorical set (blue, green, purple, orange, pink, cyan, yellow, red) used **exclusively** to color-code which rule inferred which triple. Each rule Rn gets a stable hue; its badge and inferred triples share it. This is data visualization, not decoration.

### Neutral
- **Ink** (#18181b light / #f4f4f5 dark): Primary text, headings.
- **Ink-2** (#3f3f46 light / #d4d4d8 dark): Secondary text, filled labels.
- **Ink-muted** (#52525b light / #a1a1aa dark): Tertiary text — counts, positions, stats. Tuned to clear 4.5:1 on its surface in both themes.
- **Surface** (#ffffff light / #09090b dark): App root / editor canvas.
- **Surface-2** (#fafafa–#f4f4f5 light / #18181b dark): Panels, sidebar, header, footer.
- **Surface-3** (#f4f4f5 light / #27272a dark): Inputs, selected controls, hover fills.
- **Border** (#e4e4e5 light / #27272a dark) and **Border-2** (#d4d4d8 light / #3f3f46 dark): Hairline structure between surfaces.

### SRL Syntax Palette (editor-internal)
Monaco token colors, tuned per theme for AA on the editor canvas: keywords purple (#D19AFF dark), functions warm (#FFD580), variables cyan (#67E8F9), IRIs teal (#2DD4BF), strings coral (#FCA5A5), numbers green (#86EFAC), comments (#6EE7B7). Both editors share these themes.

### Named Rules
**The Color-Is-Data Rule.** Outside the accent (blue), the two mode colors (green/purple), and status (red/yellow/green), full-spectrum color appears in exactly one place: the provenance ramp. If you reach for a fourth decorative hue, stop — it's noise.

**The Muted-Floor Rule.** Muted text never goes below Ink-muted (#52525b light / #a1a1aa dark). Lighter gray "for elegance" fails contrast; it is prohibited for any text a user must read.

## 3. Typography

**Sans Font:** Geist (with system-ui, sans-serif)
**Mono Font:** Geist Mono (with ui-monospace, monospace)

**Character:** One sans family across all chrome (headings, labels, buttons, body) and one mono family for all RDF/SRL content and positional data. The split is strict and meaningful: mono signals "this is code or a term you can copy", sans signals "this is UI". No display face — a playground doesn't shout.

### Hierarchy
- **Title** (600, 1rem / 16px, 1.4): App title, panel section headings.
- **Label** (500, 0.75rem / 12px, +0.05em, often uppercase): Panel-header chrome, tab labels, category badges. Uppercase tracking is panel-chrome convention, not decorative eyebrow.
- **Body** (400, 0.8125rem / 13px, 1.5): Descriptions, messages, example summaries.
- **Code** (400, 0.75rem / 12px, 1.6, mono): Inferred triples, token images, IRIs, all RDF terms.
- **Micro** (400–500, 0.625–0.6875rem / 10–11px): Counts, badges, line:col, stats bar. Tabular-nums for aligned numerics.

### Named Rules
**The Two-Font Rule.** Sans for chrome, mono for content. Never a display font in a label; never sans on an RDF term. If a value could be copy-pasted into a `.ttl` file, it is mono.

## 4. Elevation

Flat by default. This system conveys depth through a two-tier surface stack (Surface → Surface-2 → Surface-3) and hairline borders, not shadows. There are no drop shadows on panels, cards, or the header — a resize handle and a border are the only separators between regions. The single exception is Monaco's own editor overlays (autocomplete, hover cards), which carry the editor's native elevation and are left alone.

### Named Rules
**The No-Shadow Rule.** Structure is borders and surface tiers, never `box-shadow`. If two regions need separating, use a hairline border or a surface-tier step, not elevation.

## 5. Components

### Buttons
- **Shape:** Rounded (8–12px; `rounded-lg`).
- **Run (primary):** Run Green background, white text, play glyph; disabled → neutral Surface-3 with Ink-muted text and `cursor-not-allowed` when validation fails or a run is in flight (spinner glyph, `cursor-wait`).
- **Icon toggles:** Transparent by default, Ink-muted glyph; hover → Surface-3 fill; active/pressed → accent-tinted fill (blue for syntax panel, purple for diagrams). All carry `aria-label` + `aria-pressed`.
- **Focus:** 2px Signal Blue outline at 2px offset (`focus-visible`), never removed.

### Inputs / Fields
- **Style:** Surface-3 fill, hairline border, `rounded-md`; mono is not used for input text (these are search boxes, not code).
- **Focus:** Blue focus ring (`ring-2`/`ring-1` blue), border goes transparent.
- **Placeholder:** Held at the muted floor — never lighter (AA).

### Tabs (results panel)
- **Style:** Full `role="tablist"` / `tab` / `tabpanel` semantics with `aria-selected` + `aria-controls`. Inactive tab = Ink-muted; active = Ink with a 2px accent underline (blue for Validation, green for Inferred). Count badge sits inline.

### List item (examples sidebar)
- **Selected:** Accent background tint (`bg-blue-500/15` dark / `bg-blue-50` light) + medium weight. **Never** a colored left border.
- **Hover:** Neutral Surface-3 fill.

### Provenance badge (signature component)
- **Style:** `Rn` pill, `rounded-sm`, colored from the provenance ramp by rule index (bg at ~15–20% alpha, text at full hue, hairline border of the same hue). The badge on an inferred triple and the rule group header share one hue — this is the core "why was this inferred" affordance.

### Status bar / validation markers
- Green "✓ Valid", red "N errors", tabular timing. Error/warning list items use a filled circular glyph (`!` / `?` / `i`) in the semantic color at low-alpha background, not a side-stripe.

## 6. Do's and Don'ts

### Do:
- **Do** drive theme from a `light` / `dark` class on `<html>`; read colors from CSS-variable tokens (`--surface`, `--ink-muted`, `--accent`, …) so both themes share one source of truth.
- **Do** keep muted text at or above the muted floor (#52525b light / #a1a1aa dark) — verify 4.5:1.
- **Do** reserve the 8-hue ramp for provenance only; keep it stable per rule index.
- **Do** use mono for every RDF/SRL term and sans for every piece of chrome.
- **Do** give every interactive element all states, including a visible `focus-visible` ring, and honor `prefers-reduced-motion`.
- **Do** convey structure with surface tiers + hairline borders.

### Don't:
- **Don't** use `border-left` / `border-right` > 1px as a colored accent stripe on list items, cards, or callouts. (Selection is a background tint.)
- **Don't** introduce gradient text, glassmorphism, hero-metric blocks, or identical rounded card grids — the generic AI-SaaS look is an explicit anti-reference.
- **Don't** drift toward a cluttered enterprise-IDE toolbar or gray-on-gray dialog soup.
- **Don't** add cartoon color or oversized rounded bubbles — this is a technical spec tool, not a toy.
- **Don't** strip away the state a practitioner needs (validation, provenance, stats) in the name of minimalism.
- **Don't** add `box-shadow` for structure; use borders and surface tiers.
- **Don't** put a display font — or any sans — on an RDF term.
