import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const invocationRoot = process.cwd();
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skip = path.resolve(invocationRoot) !== sourceRoot;

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "campaign-a2-"));
  await Promise.all([
    cp(path.join(sourceRoot, "config"), path.join(root, "config"), { recursive: true }),
    cp(path.join(sourceRoot, "scripts"), path.join(root, "scripts"), { recursive: true }),
    mkdir(path.join(root, "02-CONTENUS", "QUOTIDIEN"), { recursive: true })
  ]);
  return root;
}

function run(root, script, args = []) {
  return spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], {
    cwd: root,
    encoding: "utf8"
  });
}

async function prepareValidated(root, date) {
  const prepare = run(root, "prepare-day.mjs", ["--date", date]);
  assert.equal(prepare.status, 0, prepare.stderr);
  const validate = run(root, "validate-content.mjs", ["--date", date, "--write-report"]);
  assert.equal(validate.status, 0, validate.stderr);
}

test("prépare et contrôle un contenu dans un espace isolé", { skip }, async () => {
  const root = await fixture();
  try {
    await prepareValidated(root, "2026-08-30");
    const report = JSON.parse(
      await readFile(path.join(root, "02-CONTENUS", "QUOTIDIEN", "2026-08-30", "validation.yml"), "utf8")
    );
    assert.equal(report.status, "passed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuse un pack sans confirmation humaine", { skip }, async () => {
  const root = await fixture();
  try {
    await prepareValidated(root, "2026-08-30");
    const result = run(root, "build-publication-pack.mjs", [
      "--date", "2026-08-30",
      "--scheduled-for", "2026-08-30T18:00:00+01:00",
      "--approved-by", "test"
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Confirmation humaine absente/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("termine sans erreur hors période en mode planifié", { skip }, async () => {
  const root = await fixture();
  try {
    const result = run(root, "prepare-day.mjs", ["--date", "2026-09-26", "--skip-unplanned"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Aucun contenu planifié/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("dirige un CTA portfolio vers le portfolio approuvé", { skip }, async () => {
  const root = await fixture();
  try {
    await prepareValidated(root, "2026-09-02");
    const facebook = await readFile(
      path.join(root, "02-CONTENUS", "QUOTIDIEN", "2026-09-02", "facebook.md"),
      "utf8"
    );
    assert.match(facebook, /portfolio-formation-ia-ln-ia/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuse une destination non approuvée", { skip }, async () => {
  const root = await fixture();
  try {
    await prepareValidated(root, "2026-08-30");
    const file = path.join(root, "02-CONTENUS", "QUOTIDIEN", "2026-08-30", "facebook.md");
    const original = await readFile(file, "utf8");
    await writeFile(
      file,
      original.replace(
        /https:\/\/elhisse-clprepas\.github\.io\/offre-formation-ia\/\?\S+/u,
        "https://evil.example/phish?utm_source=facebook&utm_medium=organic&utm_campaign=automne_2026&utm_content=2026-08-30_facebook"
      )
    );
    const result = run(root, "validate-content.mjs", ["--date", "2026-08-30"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /destination non approuvée/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("construit le pack après contrôle et confirmation", { skip }, async () => {
  const root = await fixture();
  try {
    await prepareValidated(root, "2026-08-30");
    const result = run(root, "build-publication-pack.mjs", [
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
    await rm(root, { recursive: true, force: true });
  }
});

