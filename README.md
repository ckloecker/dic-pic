# dic-pic

## Development workflow

This repository uses a requirements-first, test-driven V-model. Work from the
requirements toward implementation on the left side of the V, then verify each
level against its corresponding tests on the right side. Keep requirement IDs
stable and trace them through design, implementation, and tests.

Do not infer missing product behavior. Clarify ambiguous or missing
requirements before implementing them. Define the relevant tests from the
approved requirements and design before writing production code, then confirm
that they fail for the expected reason before implementing the behavior.

## Repository structure

- `requirements/` — approved, uniquely identified product and system
  requirements.
- `design/system/` — system-level decomposition and interfaces.
- `design/detailed/` — component-level design and implementation guidance.
- `src/` — production implementation.
- `tests/unit/` — detailed-design/component verification.
- `tests/integration/` — component and interface integration verification.
- `tests/system/` — system-level requirement verification.
- `tests/acceptance/` — user and product requirement acceptance verification.
- `traceability/` — links between requirements, design, implementation, and
  verification evidence.

See the README in each directory for what belongs there. Keep each change
traceable to approved requirements and update its verification evidence when
behavior changes.