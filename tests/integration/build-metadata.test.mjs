import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../../scripts/stamp-build.mjs", import.meta.url));
const source = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const commit = "0123456789abcdef0123456789abcdef01234567";

async function stamp(environment, html = source) {
  const directory = await mkdtemp(join(tmpdir(), "dic-pic-build-"));
  const target = join(directory, "index.html");
  try {
    await writeFile(target, html);
    const result = spawnSync(process.execPath, [script, target], {
      env: { ...process.env, GITHUB_REF_NAME: "", GITHUB_SHA: "", ...environment },
      encoding: "utf8",
    });
    return { ...result, html: await readFile(target, "utf8") };
  } finally {
    await rm(directory, { recursive: true });
  }
}

test("REQ-SYS-13: stamps the exact branch and full commit without changing source HTML", async () => {
  const result = await stamp({ GITHUB_REF_NAME: "develop", GITHUB_SHA: commit });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.html.includes('<meta name="build-branch" content="develop">'));
  assert.ok(result.html.includes(`<meta name="build-commit" content="${commit}">`));
  assert.equal(await readFile(new URL("../../index.html", import.meta.url), "utf8"), source);
  assert.equal(result.html.replace('content="develop"', 'content=""')
    .replace(`content="${commit}"`, 'content=""'), source);
});

test("REQ-SYS-13: escapes branch metadata instead of injecting HTML", async () => {
  const result = await stamp({ GITHUB_REF_NAME: 'feature/a&b"<tag>-$&', GITHUB_SHA: commit });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.html.includes('content="feature/a&amp;b&quot;&lt;tag&gt;-$&amp;"'));
});

for (const [name, environment] of [
  ["missing branch", { GITHUB_SHA: commit }],
  ["missing commit", { GITHUB_REF_NAME: "develop" }],
  ["invalid commit", { GITHUB_REF_NAME: "develop", GITHUB_SHA: "short-sha" }],
]) {
  test(`REQ-SYS-13: rejects ${name} without writing the file`, async () => {
    const result = await stamp(environment);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /deployment metadata/i);
    assert.equal(result.html, source);
  });
}

test("REQ-SYS-13: rejects missing HTML injection markers without writing the file", async () => {
  const html = "<!doctype html><title>No injection markers</title>";
  const result = await stamp({ GITHUB_REF_NAME: "develop", GITHUB_SHA: commit }, html);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /injection marker/i);
  assert.equal(result.html, html);
});
