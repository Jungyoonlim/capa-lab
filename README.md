# Capa Lab

An adaptive learning engine that builds and evolves curricula from learner performance data. Instead of static course structures, the curriculum itself learns from the learner.

## What it does

**Socratic tutoring** — Claude acts as a tutor that never gives answers directly. It guides through questions, tracks the structural quality of responses (not just correctness), and adapts difficulty in real time.

**ZPD-based assessment** — Every response is evaluated against the SOLO taxonomy (Prestructural → Extended Abstract) across four knowledge types (Factual, Conceptual, Procedural, Metacognitive). The engine tracks where you are, where you're stuck, and what to target next.

**Curriculum generation** — Type a topic. The engine decomposes it into sequenced learning layers, each scoped so a learner can progress through 5-10 assessment sessions. Review, edit, reorder, then save.

**Curriculum evolution** — After enough sessions, the engine aggregates gap patterns, plateau data, and Bloom matrix holes to suggest structural changes: split a layer that's too broad, add a missing intermediate layer, merge overlapping ones. The curriculum adapts to what learners actually struggle with.

## How it works

```
Topic → Generate layers → Study sessions → Assessments → Gap patterns → Evolve curriculum
                                  ↑                                           |
                                  └───────────────────────────────────────────┘
```

The core feedback loop:

1. **Generate** — Claude decomposes a topic into 3-7 prerequisite-ordered layers
2. **Assess** — Socratic sessions evaluate SOLO level, knowledge coverage, calibration (predicted vs actual confidence)
3. **Track** — The engine maintains a ZPD state per layer: current level, confidence, Bloom matrix gaps, plateau detection
4. **Evolve** — Assessment patterns feed back into curriculum structure (SPLIT / ADD / REORDER / REFINE / MERGE)

### Assessment engine

- **Advancement**: 3 consecutive assessments at the next SOLO level + a transfer exercise + knowledge coverage across 3+ types
- **Demotion**: 2 consecutive assessments below current level
- **Plateau detection**: Stuck at Multistructural (listing without connecting) for 3+ sessions triggers a protocol shift — "because" chains over "and" lists
- **Calibration**: Tracks prediction-vs-actual gap with trend analysis (improving / stable / degrading)
- **Bloom targeting**: Finds the weakest cell in the knowledge-type x cognitive-process matrix and targets it next

### Combination gates

Layers can be combined for cross-domain exercises, gated by prerequisites:
- 2-layer combo: both at Relational + metacognitive coverage
- 3-layer combo: all Relational + full knowledge coverage
- Full stack: all Relational + 2 at Extended Abstract

## Tech stack

- **Next.js 16** + React 19
- **Claude API** (Sonnet 4) for tutoring and curriculum generation
- **SQLite** (better-sqlite3) for embedded state
- **Tailwind CSS** for UI

## Getting started

```bash
cp .env.example .env    # add your ANTHROPIC_API_KEY
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The database seeds automatically on first request.

- **Dashboard** (`/`) — ZPD matrix, session history, combination gates
- **Curriculum** (`/curriculum`) — Generate new domains, evolve existing ones
- **Session** (`/session/[id]`) — Socratic tutoring chat with live assessment
- **History** (`/history`) — Past sessions with calibration stats

## Project structure

```
src/
  app/                          # Next.js pages + API routes
    api/curriculum/             # Generate, save, evolve, apply
    api/sessions/               # Session CRUD + message handling
    curriculum/                 # Curriculum management UI
    session/[id]/               # Tutoring chat + review
  lib/
    engine/
      assessment.ts             # SOLO advancement, Bloom targeting, calibration
      curriculum.ts             # Generate + evolve with Claude
      gating.ts                 # Combination gate logic
    claude.ts                   # Tutor system prompt + API calls
    db.ts                       # SQLite schema + operations
    types.ts                    # Domain types + enums
  domains/
    rust-mastery.ts             # Example hand-written domain config
```

## What's next

- **Cross-learner analytics** — Aggregate gap patterns across users to find universally hard concepts
- **Gap normalization** — Cluster similar `specificGaps` strings instead of naive frequency counting
- **Curriculum versioning** — Track structure changes over time to measure if evolution actually helps
- **Spaced repetition** — Schedule layer revisits based on decay curves
- **Richer exercises** — Code sandboxes, diagram tasks, fill-in-the-blank beyond chat
