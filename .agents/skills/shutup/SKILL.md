---
name: shutup
description: "Compress bloated AI prompts, plans, outlines, and agent instructions to 30-50%. Removes verbosity, boilerplate, over-explaining, and prompt bloat. For prompt engineering, reducing verbose AI output, and stopping plan drift during iteration."
---

# shutup

## Purpose

Compress and prune AI-written or AI-facing prompts, plans, outlines, and handoffs.

The reader is usually another capable AI or agent, not a beginner who needs obvious reasoning, generic workflow advice, or hand-holding. Do not teach the reader what competent models already know.

## Default Compression

If the user gives a target ratio, follow it.

If no ratio is given, reduce the artifact to 30%-50% of the original length. For severe bloat, prefer the lower end. For dense technical material, preserve required facts and land near the upper end.

## Trigger Situations

Use this skill when the user asks to:

- write a prompt for another AI
- write a plan, outline, handoff, or task list
- prepare instructions for Codex, Claude, Hermes, MiMo, or another agent
- make an AI-generated artifact shorter
- remove verbosity, boilerplate, repetition, or over-explanation
- stop prompt bloat, plan bloat, or drift before continuing iteration

## Core Principles

1. Delete before rewriting.
2. Preserve intent; do not add new requirements.
3. Treat the reader AI as competent.
4. A plan should clarify direction, not simulate every future detail.
5. Avoid locking in early assumptions before evidence exists.
6. Human-facing plans should be even easier to scan.
7. The best output is the smallest version that still steers the next actor correctly.

## Remove Aggressively

- repeated goals
- generic AI reminders
- motivational, apologetic, or ceremonial language
- "be careful", "ensure", "robust", "comprehensive" unless measurable
- obvious workflow advice
- hand-holding for common AI capabilities
- speculative branches
- premature implementation detail
- fallback trees not needed yet
- long risk lists with no action impact
- options the user did not ask for
- background that does not change execution
- phrasing that exists only to sound professional

## Keep

- goal
- current facts
- non-obvious context
- hard constraints
- scope boundaries
- expected output
- validation criteria
- stop conditions
- unresolved questions that truly block execution

## Plan Rule

For plans and outlines, list checkpoints, not imagined future minutiae.

Prefer direction, sequence, boundaries, and validation. Avoid step-by-step simulation of work not yet observed, excessive fallback trees, and instructions that tell the AI how to perform basic reasoning.

## Output Format

When pruning existing text:

```markdown
## Shutup Version

<compressed version>

## Cut

- <main removed noise type>
- <main removed noise type>
- <main removed noise type>
```

When creating a new AI-facing prompt or plan from scratch, output only the clean artifact unless the user asks for explanation.

## Quality Check

Before finalizing, ask:

- Is this 30%-50% of the source unless told otherwise?
- Did I remove explanations a competent AI does not need?
- Did I preserve the actual goal?
- Did I avoid adding new scope?
- Did I avoid turning a direction plan into premature detail?
- Would this reduce drift in the next iteration?
