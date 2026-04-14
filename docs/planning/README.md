# Planning Documents

Foundational planning artifacts for the Pomodoro Timer Extension. These documents define what the product is, how it should be built, and what decisions we've committed to.

These are distinct from `docs/*_IMPLEMENTATION.md`, which document specific feature implementations as they currently exist.

## Documents

### Product
- [**prd.md**](prd.md) — Product Requirements Document. Vision, target users, feature scope, non-functional requirements, success metrics.
- [**user-stories.md**](user-stories.md) — Every user-facing behavior the extension supports, organized by domain. Acceptance criteria for the rewrite.

### Design
- [**ui-ux-spec.md**](ui-ux-spec.md) — Component inventory, layouts, theme system, interaction patterns, accessibility patterns.

### Technical
- [**architecture.md**](architecture.md) — Current architecture, pain points, proposed new architecture, migration approach.
- [**data-model.md**](data-model.md) — Storage schema, entity definitions, in-memory state, known issues.
- [**api-specification.md**](api-specification.md) — Messaging contract between contexts. Every message action documented.

### Process
- [**roadmap.md**](roadmap.md) — Phased plan for executing the architecture rewrite.
- [**risk-assessment.md**](risk-assessment.md) — Risks specific to the rewrite, with mitigations.
- [**decisions/**](decisions/) — Architecture Decision Records. Why we chose what we chose.

## Reading Order

For someone new to the project:

1. **prd.md** — what is this product?
2. **user-stories.md** — what does it do?
3. **architecture.md** — how is it built?
4. **roadmap.md** — what's planned?
5. The rest as reference.

## Resuming Work on the Rewrite

To pick up the architecture rewrite in a new Claude Code session, use this prompt:

> Let's start the architecture rewrite. Read `@docs/planning/README.md` for context, then begin Phase 0 from `@docs/planning/roadmap.md`. Stop after each phase for review before continuing to the next.

### Notes for the assistant

- **Per-phase checkpoints**: Each phase in [roadmap.md](roadmap.md) has explicit deliverables and exit criteria. Treat these as natural review points — finish a phase, summarize what changed, and wait for confirmation before starting the next.
- **Target-state references**: The planning docs reference paths and types that don't exist yet (e.g., `src/background/`, `src/shared/`, the `MessageMap` discriminated union). These describe the *target* state; they get created as Phase 1+ progresses. The current `public/background/service-worker.js` remains in place until Phase 3 deletes it.
- **Feature parity is the bar**: The acceptance criterion for the entire rewrite is that every story in [user-stories.md](user-stories.md) still passes. If a behavior change is unavoidable, surface it explicitly rather than silently changing it.
- **Decision discipline**: If a question arises that isn't covered by an existing ADR in [decisions/](decisions/), pause and ask before deciding. New decisions get a new ADR.
