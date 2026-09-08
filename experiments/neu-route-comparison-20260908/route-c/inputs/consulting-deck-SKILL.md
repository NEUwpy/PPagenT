---
name: consulting-deck
description: Create, revise, and audit executive-ready strategy-consulting presentations as native, editable PowerPoint files. Use when turning topics, text, Markdown, Word, PDF, spreadsheets, CSV data, URLs, research, or an existing PPTX into a board, client, strategy, transformation, market-analysis, or McKinsey-style consulting deck; when applying a brand or PowerPoint template; or when checking a deck's storyline, evidence, charts, layout, and visual quality.
---

# Consulting Deck

Create decision-ready presentations, not decorative summaries. Build a clear
argument, trace every material claim, select layouts by communication job, and
deliver a native `.pptx` whose text, charts, tables, and simple diagrams remain
editable.

Treat this as an independent presentation system created by **Peng · 智珠在睿**.
Do not imply affiliation with McKinsey, BCG, Bain, or another consultancy. Do not
copy their logos, proprietary templates, or protected brand assets unless the user
provides licensed assets and explicitly asks to use them.

## Load the right guidance

Load guidance progressively:

1. Start every Create or Revise route with `references/harness-system.md`,
   `references/workflow.md`, and `references/presentation-modes.md`.
2. Read `references/problem-solving-system.md` for a topic, open business question,
   strategy choice, or research-from-scratch request. Do not force a hypothesis tree
   onto a faithful source-summary request.
3. Read `references/storyline-system.md` when building the governing thought and
   slide sequence.
4. Read `references/chart-system.md` and `references/charts-and-data.md` only when
   quantitative evidence or material exhibits are present.
5. Read `references/visual-system.md` and `references/layout-library.md` when
   planning the method sample and full slide system.
6. Read `references/quality-gates.md` before validation and delivery.
7. Read `references/brand-system.md` only when a brand, logo, font, or PPTX template
   is used.
8. Read `references/runtime-adapters.md` before selecting the PPTX production route.
   When `production_runtime` resolves to `ppt-master-adapter`, also read
   `references/ppt-master-adapter.md` and enforce its security, handoff, and content-lock boundaries.
9. Read `references/workspace-schema.md` when creating, resuming, or revising a
   saved deck project.

## Route the request

Choose exactly one primary route:

- **Create** — turn source material or a topic into a new editable deck.
- **Revise** — modify an existing saved deck project and regenerate affected slides.
- **Template** — apply a user-supplied brand or native PowerPoint template.
- **Audit** — inspect an existing deck without changing it unless the user asks.

Do not silently combine routes. A template request can refine Create or Revise, but
the underlying saved project remains the source of truth.

## Establish the production contract

Before authoring:

1. Identify the audience, decision, presentation context, language, page count,
   presentation mode, density mode, analysis route, and source boundary.
2. Use the host's current native PowerPoint capability when it can create editable
   objects and render every slide for inspection.
3. Use an independently installed PPT Master adapter only when deeper native
   PowerPoint behavior is required, the exact version has an `approved` security
   record, and the user has selected or approved that runtime. Never install it
   automatically or allow it to replace the approved evidence and storyline.
4. Use PptxGenJS only as a fallback when it is already available or the user approves
   installation. Never replace the requested PPTX with HTML.
5. Preserve an editable project workspace. Do not make the final `.pptx` the only
   source of truth.
6. Keep the default output brand-neutral. Apply `assets/brands/peng.json` only when
   the user explicitly selects the Peng preset.
7. Use the staged harness in `references/harness-system.md`. Do not jump from a
   source file directly to slide-rendering code.
8. Treat machine-readable gate files as the source of truth. Never claim a gate
   passed unless the corresponding JSON exists and contains `"passed": true`.

## Apply the consulting standard

Require all of the following:

- Lead with a governing thought and answer-first slide titles.
- For a problem-solving route, define the problem boundary, build an issue tree,
  and maintain falsifiable hypotheses before broad research.
- Give each slide one communication job and one main takeaway.
- Make horizontal logic coherent across slides and vertical logic sufficient within
  each slide.
- Distinguish facts, calculations, source interpretations, and hypotheses.
- Cite external claims and assets in visible footnotes or speaker notes.
- Treat charts as the primary analytical language, not a secondary decoration layer.
- Write a declarative `charts.json` record before rendering every material exhibit.
- Use the question-based chart families, annotation system, and rendering hierarchy in
  `references/chart-system.md`.
- Use native charts for data that users may need to inspect or edit. Use Vizro's
  visual vocabulary and optional prototype route for selection and validation, not
  as permission to flatten the final PowerPoint.
- In Research Analytical mode, rebuild the source's material exhibits before creating
  conceptual summaries. Meet the evidence-led and native-chart thresholds in
  `references/presentation-modes.md`.
- Use a semantic layout from `references/layout-library.md`; do not invent a layout
  merely to fill space.
- Use the title-as-structure visual device only on covers, section dividers, and a
  small number of decisive insight slides.
- Render and inspect every slide at full size before delivery.
- Keep machine checks and expert review separate. Geometry scripts cannot prove
  evidence quality, chart truthfulness, or executive clarity.
- Record true cross-slide prerequisites in `slides.json`. Generate in
  dependency-safe order, then assemble in audience-facing display order.

## Use two density modes

- **Speaker-led** — fewer words, larger type, more pages, stronger pacing.
- **Reading-first** — more self-contained evidence, annotations, and footnotes.

Choose one mode from the presentation context. Do not create a vague middle mode.
When content does not fit, split the slide or sharpen the argument before reducing
font size.

Density mode is not presentation mode. A reading-first Executive Story and a
reading-first Research Analytical deck can have similar text density but different
shares of exhibits, footnotes, and conceptual pages.

## Preview visual direction

When the user has not supplied a locked template or explicit visual reference:

1. Create three compact visual directions from `references/visual-system.md`.
2. Show a real cover, an analytical/data slide, and a framework/action slide for
   each direction.
3. Keep preview content authentic to the user's material; never show internal labels
   such as “Option A” inside the slide itself.
4. Ask the user to choose once, then apply the selected system consistently.

Skip this gate only when the user explicitly asks to proceed directly or provides a
clear visual reference. Record the chosen direction in the project workspace.

## Preserve editability

- Keep text as text.
- Keep tables as tables.
- Keep charts as native charts whenever practical.
- Keep chart data and chart intent separate from slide layout code.
- Keep simple matrices, timelines, processes, and issue trees as native shapes.
- Use images for photographs, textured artwork, or illustrations—not for entire
  text-heavy slides.
- Never deliver a deck whose pages are flattened screenshots.

## Iterate from the saved project

For requests such as “change slide 3's title,” edit the project source and regenerate
the affected output. Preserve source material, evidence IDs, chart data, slide IDs,
and speaker notes. Re-run all affected quality checks and the final deck-level check.

## Learn without mutating the installed Skill

Classify every material correction as either one-off or repeatable. Record repeatable
lessons in the deck workspace at `qa/experience-log.md`; do not silently edit the
installed Skill during ordinary deck production. Promote a repeated lesson into this
Skill only through a reviewed, versioned Skill update.

## Deliver

Deliver the final `.pptx` plus a concise summary. Keep intermediate plans, previews,
and QA files inside the project workspace unless the user requests them. State any
unverified claims, font substitutions, compatibility limitations, or remaining
warnings explicitly.
