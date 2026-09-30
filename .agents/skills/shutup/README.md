# shutup — Kill Prompt Bloat

[![skills.sh](https://skills.sh/b/NEUwpy/shutup-skill)](https://skills.sh/NEUwpy/shutup-skill)

> AI writes verbose prompts, plans, and outlines. This skill makes them shut up.

**Problem:** AI-generated instructions keep getting longer with each iteration — full of filler, obvious advice, and premature detail. The result is bloated prompts that confuse the next AI and drift from the original goal.

**Solution:** A compression skill that treats the reader as a competent AI, cuts noise, and preserves only what steers execution.

---

## What It Does

Compresses AI-facing artifacts — prompts, plans, outlines, handoffs, task lists — to 30–50% of original length by default.

**Removes:**
- Repeated goals and motivational filler
- Generic workflow advice ("be careful", "ensure quality")
- Speculative branches and premature implementation detail
- Fallback trees not needed yet
- Phrasing that exists only to sound professional

**Keeps:**
- Goal, constraints, scope boundaries
- Non-obvious context
- Expected output and validation criteria
- Stop conditions and blocking questions

## When to Use

- AI-generated prompt is bloated and needs tightening
- Plan/outline drifts into premature detail
- Iterating a prompt keeps making it worse
- Handoff between AI agents is full of noise
- Creating a clean prompt from scratch for another AI

## Installation

**Any agent (via skills CLI):**
```bash
npx skills add NEUwpy/shutup-skill -g -y
```

**Hermes Agent (manual):**
```bash
# Copy SKILL.md to your skills directory
cp SKILL.md ~/.hermes/skills/shutup/SKILL.md
```

**Claude Code / Cursor / Codex / OpenCode:**
```bash
npx skills add NEUwpy/shutup-skill -a claude-code -a cursor -y
```

## Core Principle

The reader is a capable AI. Don't teach it what it already knows.

---

## 中文说明

**shutup** 是一个提示词压缩 skill，专门解决 AI 写的 prompt/plan/outline 越改越长、充满废话的问题。

默认压缩到原文 30%-50%，保留目标、约束、边界，删除套话、过度规划和假设性内容。

适用于 Hermes Agent，将 `SKILL.md` 放到 skills 目录即可使用。
