import { readFile, writeFile } from "node:fs/promises";

const branch = process.env.GITHUB_REF_NAME;
const commit = process.env.GITHUB_SHA;
if (!branch?.trim() || !/^[0-9a-f]{40}$/i.test(commit ?? "")) {
  throw new Error("Deployment metadata requires GITHUB_REF_NAME and a full forty-character GITHUB_SHA.");
}
const target = process.argv[2];
if (!target) throw new Error("A staged HTML file is required.");

let html = await readFile(target, "utf8");
function escapeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
for (const [name, value] of [["build-branch", branch], ["build-commit", commit]]) {
  const marker = `<meta name="${name}" content="">`;
  if (!html.includes(marker)) throw new Error(`Missing HTML injection marker: ${name}.`);
  html = html.replace(marker, () => `<meta name="${name}" content="${escapeAttribute(value)}">`);
}
await writeFile(target, html);
console.log(`Stamped build metadata: ${branch} at ${commit}`);
