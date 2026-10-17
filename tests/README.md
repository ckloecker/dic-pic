# Verification tests

Tests on the right side of the V verify the artifacts on the left. Derive tests
from approved requirements and design, and write them before the associated
production implementation.

- `unit/` verifies detailed designs and individual components.
- `integration/` verifies component interactions and interfaces.
- `system/` verifies system requirements.
- `acceptance/` verifies product and user requirements.

Keep tests mapped to requirement IDs in `traceability/`.
