# Integration tests

Verify interactions and interfaces between components against the system
design. Link each test back to the relevant design and requirement IDs.

Run `node --test tests/integration/build-metadata.test.mjs` from the repository root with Node.js 22 or newer.
These REQ-SYS-13 checks verify exact branch/commit stamping, HTML escaping, unchanged source HTML, and explicit rejection of missing metadata or markers.
The Pages workflow runs the same tests before preparing the published artifact.
