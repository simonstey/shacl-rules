# Product

## Register

product

## Users

Two overlapping audiences share one surface:

- **Practitioners** — RDF/SHACL developers and semantic-web engineers authoring and debugging SHACL 1.2 inference rules against real Turtle data. Fluent in Turtle/SPARQL, they want fast iteration, clear validation feedback, and trustworthy provenance for every inferred triple.
- **Learners** — people new to SHACL/RDF using the playground to understand how inference rules work. They need scaffolding (examples, syntax diagrams, hover docs) without the tool feeling like a toy.

The job to be done: write SRL rules, see them validated live, run them over data, and understand *why* each fact was inferred — all in the browser, with zero setup.

## Product Purpose

A web-based playground for authoring and executing SHACL 1.2 Rules written in SRL (Shape Rules Language). Dual Monaco editors (Turtle data + SRL rules), keystroke-debounced validation, an in-browser fixed-point rule engine, and an inferred-triples panel with provenance. Success = a developer can trust the tool as a faithful, fast reference for SHACL 1.2 Rules behavior, and a learner can build intuition for inference without leaving the page.

## Brand Personality

**Precise, technical, trustworthy.** Voice is that of a reference implementation: confident through correctness, not decoration. The interface earns trust by being legible, stateful, and honest about what it computed (and what it couldn't). Familiarity is a feature — it should feel like a first-class developer tool (Linear/VS Code lineage), where the UI disappears into the task.

## Anti-references

- **Generic AI-SaaS** — no cream/gradient/glassmorphism marketing aesthetic, no hero metrics, no rounded identical card grids, no 2026 AI-slop template.
- **Enterprise Java IDE** — no cluttered Eclipse-style toolbars, tiny gray-on-gray chrome, or dialog soup.
- **Toy / playful** — no cartoon colors, oversized rounded bubbles, or emoji-heavy UI. This is a technical spec tool.
- **Overly minimal** — do not strip away useful state or density. The tool must surface a lot of information (validation diagnostics, provenance, execution stats) legibly.

## Design Principles

1. **Faithful to the spec.** The UI's job is to represent SHACL 1.2 Rules behavior honestly. Show what was inferred, from which rule, and surface what isn't yet implemented rather than faking it.
2. **State is the product.** Validation status, execution results, provenance links, and error states are the core value. Standardize and make legible every state (default/hover/focus/active/disabled/loading/error/empty) rather than hiding complexity.
3. **Earned familiarity over novelty.** Standard developer-tool affordances (editors, resizable panels, tabs, status bar). Delight lives in responsiveness and detail, not invented controls.
4. **Legible density.** Dense information where experts need it, teaching affordances where learners need them — both at once, without noise.
5. **Trust through correctness.** Fast, deterministic feedback. Never overstate certainty; distinguish "valid" from "supported" from "inferred."

## Accessibility & Inclusion

Target **WCAG 2.1 AA**: body text ≥4.5:1 contrast (both light and dark themes), visible focus indicators on all interactive elements, logical keyboard navigation, semantic HTML with proper landmarks and heading hierarchy, and ARIA labels/states on icon-only controls. Respect `prefers-reduced-motion` for all animations. Since editors and panels carry the workload, ensure non-editor chrome (toolbar, tabs, status bar, panels) is fully keyboard-operable and screen-reader labeled.
