# Evidence-first chart system

Charts are the primary analytical language of a research or strategy deck. They are
not decoration and they are not interchangeable containers for numbers.

This system is informed by:

- McKinsey Global Institute, **2025 in charts**:
  `https://www.mckinsey.com/mgi/our-research/mckinsey-global-institute-2025-in-charts`
- McKinsey, **The Week in Charts**:
  `https://www.mckinsey.com/featured-insights/week-in-charts`
- McKinsey / QuantumBlack, **Vizro**:
  `https://github.com/mckinsey/vizro`
- Vizro **Visual Vocabulary**:
  `https://vizro-demo-visual-vocabulary.hf.space/`

Use these as analytical and engineering references. Do not copy McKinsey logos,
proprietary templates, page chrome, or a published chart pixel-for-pixel. Build an
independent, neutral system.

## The chart communication stack

Every analytical exhibit should contain five layers:

1. **Answer** — an action title that states the conclusion.
2. **Measure** — a subtitle naming the metric, unit, geography, period, and status.
3. **Evidence** — the chart or table that preserves the material data relationships.
4. **Interpretation** — direct annotation that explains the gap, inflection, driver,
   threshold, or outlier.
5. **Provenance** — source, sample, methodology, forecast status, and rounding note.

If one layer is missing, the exhibit is incomplete.

## McKinsey-style chart grammar

The visual signature is disciplined rather than minimal:

- white or near-white analytical canvas;
- black or dark-navy type;
- restrained axes and light-gray gridlines;
- one focal color; context is neutral or a related blue scale;
- semantic red or green only when the data has actual negative or positive meaning;
- direct labels before legends;
- annotations anchored to the mark they explain;
- exact values where the decision depends on them;
- generous external whitespace, dense internal evidence;
- source line and qualification always visible;
- no ornamental gradients, shadows, 3-D effects, or decorative icons inside charts.

High information density is allowed when hierarchy is strong. Do not confuse sparse
content with elegance.

## Select a chart by analytical question

Choose the family before the specific subtype.

### Deviation

Question: How far is each value from a baseline, target, or midpoint?

Use:

- diverging bar for positive and negative deviation;
- butterfly for two-sided comparison;
- lollipop for a small number of deviations;
- surplus-deficit filled line for time-based gaps.

Avoid a generic clustered bar when the baseline itself is the message.

### Correlation

Question: Do two or three variables move together, cluster, or create outliers?

Use:

- scatter for two quantitative variables;
- bubble for two variables plus magnitude;
- connected scatter for a path through two dimensions;
- column-and-line only when the scales and relationship are explicit;
- scatter matrix only for appendix or technical audiences.

Annotate meaningful quadrants, thresholds, clusters, and named outliers.

### Ranking

Question: Who leads, who lags, and how stable is the order?

Use:

- ordered horizontal bar for one period;
- ordered dot or bubble when mark area is useful;
- slope for two-period rank or value change;
- bump for rank evolution over several periods.

Sort by the metric that proves the title. Do not preserve alphabetical order unless
alphabetical lookup is the purpose.

### Distribution

Question: How are observations spread, concentrated, or skewed?

Use:

- histogram for frequency distribution;
- boxplot or violin for comparable groups;
- cumulative curve for thresholds or concentration;
- beeswarm for individual observations when sample size permits;
- dumbbell for two observations per category.

Show sample size and explain the distribution statistic.

### Magnitude

Question: How large is each value?

Use:

- horizontal bar for long category labels;
- column for a few discrete periods;
- paired bar or column for two comparable series;
- bullet for actual versus target;
- parallel coordinates only for expert audiences;
- pictogram only when approximate share is sufficient.

Start bars at zero. If a truncated axis is required, disclose it prominently.

### Time

Question: What changed over time and where did the pattern shift?

Use:

- line for continuous change;
- area only when volume or accumulation matters;
- small multiples for several differently scaled but structurally comparable trends;
- sparkline for compact table-like comparisons;
- stepped line for discrete state changes;
- heatmap for repeated time cycles;
- Gantt for planned intervals.

Prefer endpoint labels and direct inflection annotations. Do not label every point.

### Part to whole

Question: What composes the total, and which components drive the change?

Use:

- stacked bar for composition across categories;
- stacked column for composition across a few periods;
- waterfall for sequential positive and negative contributions;
- Marimekko for two simultaneous share dimensions;
- treemap for nested share when exact comparison is secondary;
- grid plot for approximate share;
- donut or pie only for at most five clearly different parts.

Waterfalls must reconcile start + drivers = end. Marimekko widths and heights must
both be explained.

### Flow

Question: How does volume move between stages, entities, or states?

Use:

- Sankey for quantified flows;
- chord for many-to-many relationships when direction is not primary;
- funnel only when stages reconcile and attrition is real;
- flow map when movement is geographic.

Do not use arrows alone when flow magnitude is material.

### Spatial

Question: Where does the phenomenon occur?

Use:

- choropleth for normalized regional rates;
- bubble map for absolute magnitude;
- dot map for individual locations;
- flow map for movement.

Never map raw totals with choropleth shading when population or area drives the
result.

### Matrix and multi-dimensional comparison

Question: Which combinations or factor patterns matter?

Use:

- 2×2 matrix for two explicit dimensions and four meaningful quadrants;
- heatmap for entities × factors;
- table-heatmap hybrid when exact values and pattern recognition both matter;
- segmented matrix when technical feasibility and work type jointly determine the
  outcome.

Keep the matrix labels more prominent than its grid.

## Use complex charts only when they preserve a material relationship

Complexity is justified when a simpler chart would destroy a relationship needed for
the conclusion.

Examples:

- use a waterfall when the bridge from start to end matters;
- use small multiples when several trends share a question but not a scale;
- use a bubble plot when both position and magnitude are decision-relevant;
- use Marimekko when two share dimensions must be read together;
- use a heatmap when the pattern across many rows and columns is the finding;
- use a 2×2 or segmented matrix when two independent dimensions determine ownership,
  action, or automation potential.

If the audience cannot explain all encodings after a ten-second orientation, simplify
or split the exhibit.

## Annotation system

Use four annotation types deliberately:

- **direct label** — series, endpoint, bar, or segment name adjacent to the mark;
- **delta label** — percentage-point, multiple, or absolute gap;
- **structural guide** — bracket, threshold, shaded zone, baseline, or quadrant;
- **interpretive callout** — one sentence explaining why the highlighted pattern
  matters.

Rules:

- annotate the evidence, not the empty margin;
- connect callouts to one exact mark;
- keep one primary annotation and at most two secondary annotations;
- use verbs and comparisons, not labels such as “interesting”;
- avoid leaders that cross one another;
- do not repeat a value in the title, label, callout, and sidebar.

## Color architecture

Use one of these patterns:

- **focus + context** — focal series in navy or blue, comparison series in gray;
- **ordered intensity** — a single-hue sequential scale for low-to-high;
- **diverging** — two hues around a neutral midpoint;
- **categorical families** — distinct but controlled hues when categories have no
  order;
- **semantic** — red for actual negative/risk, green for actual positive/benefit.

Default evidence palette:

- ink: `#111820`
- navy: `#0B2D52`
- blue: `#1687C7`
- sky: `#67C5E8`
- pale: `#E8EDF2`
- muted: `#66717D`
- line: `#C7CED6`
- negative: `#D94B3D`
- positive: `#3C8C6E`

Use at most one saturated focal color on a routine exhibit. Multi-category charts may
use a controlled family, but no rainbow ordering.

## Declarative chart specification

Create one `charts.json` record per exhibit before rendering. This applies the
declarative principle used by Vizro: the analytical intent, data, encoding,
annotation, and renderer are separate from slide layout code.

Required fields:

```json
{
  "chart_id": "CH01",
  "slide_id": "S03",
  "question": "What explains the change?",
  "conclusion": "Asset appreciation explains 36% of wealth growth",
  "family": "part-to-whole",
  "subtype": "waterfall",
  "data_path": "data/wealth-bridge.json",
  "source_locator": "PDF p.12, Figure 3",
  "unit": "$ trillion",
  "period": "2000–2024",
  "sample": "",
  "encoding": {
    "x": "driver",
    "y": "value",
    "color": "role"
  },
  "focal_marks": ["paper wealth"],
  "annotations": ["36% of growth"],
  "renderer": "native-pptx",
  "editability": "native-chart",
  "reconciliation": "passed"
}
```

Do not author chart styling directly in slide code until this record is complete.

## Vizro integration

Vizro contributes three capabilities:

1. **Visual vocabulary** — use its question-based chart taxonomy to select chart
   families and discover appropriate complex charts.
2. **Declarative configuration** — separate chart intent, data, encodings, layout,
   and actions from rendering code.
3. **Complex-chart prototyping** — use Vizro/Plotly as an optional preview and
   analytical validation route for chart types that are difficult to reason about
   directly in PowerPoint.

Vizro is not the final PowerPoint renderer by default.

Rendering hierarchy:

1. `native-pptx` — editable native chart for line, bar, column, stacked, waterfall,
   scatter, and bubble when supported;
2. `native-shapes` — editable PowerPoint reconstruction for Marimekko, heatmap,
   segmented matrix, lollipop, dumbbell, or simple Sankey;
3. `vizro-preview` — optional Plotly/Vizro prototype to validate encodings and
   annotations, followed by native reconstruction;
4. `source-image` — cited source figure only when exact reproduction is necessary or
   the data cannot be recovered;
5. `svg-fallback` — only with explicit approval when fidelity matters more than
   editability.

Do not install or execute Vizro automatically. If the host lacks Vizro and a runtime
preview would materially improve the result, ask for approval, run the Skill security
gate, and install a pinned version in an isolated environment. Vizro is Apache-2.0;
preserve required license notices when code is reused or redistributed.

## Chart method sample

Before full production, render at least three exhibits:

- one routine native chart;
- one dense multi-series chart;
- one complex chart or matrix when the source requires it.

Evaluate:

- whether the title is proven in under ten seconds;
- whether all material dimensions survive;
- whether focal marks dominate without hiding context;
- whether labels and annotations are readable at presentation scale;
- whether the chart remains editable;
- whether the source and methodology are complete.

Do not continue if the dense or complex sample still looks like a default Office
chart.

## Chart QA score

Score every material chart from 0 to 2 on each dimension:

- analytical fit;
- data fidelity;
- information density;
- hierarchy and focus;
- labeling and annotation;
- editability;
- source completeness.

Minimum:

- no dimension may score 0;
- total must be at least 12/14 for internal delivery;
- total must be at least 13/14 for a public example.

Block delivery for category-label mismatch, reversed ordering, wrong units, hidden
denominators, non-reconciling totals, or annotations pointing to the wrong mark.
