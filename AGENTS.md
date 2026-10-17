# Instructions for AI contributors

- Treat approved artifacts in `requirements/` as the source of truth. Do not
  invent or silently broaden product behavior.
- In all documents, one sentence per line for easier revision management.
- If requirements are missing, ambiguous, or contradictory, stop and request
  clarification instead of making assumptions.
- Before implementation, identify the requirement IDs, affected design
  artifacts, and corresponding tests. Add or update the tests first and verify
  they fail for the expected reason.
- Implement only what is needed to satisfy the approved requirements and
  design. Keep changes small and preserve existing behavior not covered by the
  change.
- Run the relevant tests and record links between requirement IDs, design,
  implementation, and verification in `traceability/`.
- Update affected requirements, design, tests, and traceability together when
  approved behavior changes.
