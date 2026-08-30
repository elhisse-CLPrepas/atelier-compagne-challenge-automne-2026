import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const expectedRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skip = path.resolve(root) !== expectedRoot;

function run(script, args = []) {
  return spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], {
    cwd: root,
    encoding: "utf8"
  });
}

test("prépare et contrôle le contenu du 30 août", { skip }, async () => {
  const dir = path.join(root, "02-CONTENUS", "QUOTIDIEN", "2026-08-30");
  await rm(dir, { recursive: true, force: true });
  const prepare = run("prepare-day.mjs", ["--date", "2026-08-30"]);
  assert.equal(prepare.status, 0, prepare.stderr);
  const validate = run("validate-content.mjs", ["--date", "2026-08-30", "--write-report"]);
  assert.equal(validate.status, 0, validate.stderr);
  const report = JSON.parse(await readFile(path.join(dir, "validation.yml"), "utf8"));
  assert.equal(report.status, "passed");
});

test("refuse un pack sans confirmation humaine", { skip }, () => {
  const result = run("build-publication-pack.mjs", [
    "--date", "2026-08-30",
    "--scheduled-for", "2026-08-30T18:00:00+01:00",
    "--approved-by", "test"
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Confirmation humaine absente/u);
});

test("termine sans erreur hors période en mode planifié", { skip }, () => {
  const result = run("prepare-day.mjs", ["--date", "2026-09-26", "--skip-unplanned"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Aucun contenu planifié/u);
});

test("construit le pack après contrôle et confirmation", { skip }, async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "a2-pack-"));
  try {
    const result = run("build-publication-pack.mjs", [
      "--date", "2026-08-30",
      "--scheduled-for", "2026-08-30T18:00:00+01:00",
      "--approved-by", "test",
      "--confirm", "VALIDATION_HUMAINE"
    ]);
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(
      await readFile(path.join(root, "dist", "publications", "2026-08-30", "manifest.json"), "utf8")
    );
    assert.equal(manifest.status, "approved-for-scheduling");
    assert.equal(manifest.direct_publication, false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
