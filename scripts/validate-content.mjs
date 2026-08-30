import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dailyRoot = path.join(root, "02-CONTENUS", "QUOTIDIEN");

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function loadJsonYaml(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function wordCount(text) {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function countUrls(text) {
  return (text.match(/https?:\/\/\S+/gu) || []).length;
}

async function validateDate(date, { writeReport = false } = {}) {
  const dir = path.join(dailyRoot, date);
  const facts = await loadJsonYaml(path.join(root, "config", "approved-facts.yml"));
  const channels = await loadJsonYaml(path.join(root, "config", "channels.yml"));
  const campaign = await loadJsonYaml(path.join(root, "config", "campaign.yml"));
  const errors = [];
  const warnings = [];
  const required = ["brief.yml", "facebook.md", "linkedin.md", "whatsapp.md", "publication.json"];

  for (const file of required) {
    try {
      await readFile(path.join(dir, file), "utf8");
    } catch {
      errors.push(`Fichier manquant : ${file}`);
    }
  }
  if (errors.length) return { date, status: "failed", errors, warnings };

  const brief = await loadJsonYaml(path.join(dir, "brief.yml"));
  const publication = await loadJsonYaml(path.join(dir, "publication.json"));
  if (!campaign.schedule.some((entry) => entry.date === date)) errors.push("Date absente du calendrier approuvé.");
  if (!facts.cta_labels[brief.cta]) errors.push(`CTA non approuvé : ${brief.cta}`);
  if (brief.source !== facts.source) errors.push("La source du brief ne correspond pas à la source approuvée.");
  if (publication.status !== "draft" || publication.human_approval !== false) {
    errors.push("Un contenu généré doit rester en brouillon sans approbation humaine.");
  }

  for (const [channel, limits] of Object.entries(channels)) {
    const text = await readFile(path.join(dir, `${channel}.md`), "utf8");
    const total = wordCount(text);
    if (total < limits.min_words || total > limits.max_words) {
      errors.push(`${channel}: ${total} mots hors limites ${limits.min_words}-${limits.max_words}.`);
    }
    if (countUrls(text) !== 1) errors.push(`${channel}: un seul lien est requis.`);
    if (!text.includes(facts.facts.start_date)) errors.push(`${channel}: date de départ absente.`);
    if (!text.includes(facts.facts.duration)) errors.push(`${channel}: durée absente.`);
    if (!text.includes(facts.facts.sessions)) errors.push(`${channel}: nombre de séances absent.`);
    if (!text.includes(facts.facts.delivery)) errors.push(`${channel}: modalité en ligne absente.`);
    if (!text.includes(facts.signature)) errors.push(`${channel}: signature absente.`);
    for (const marker of facts.forbidden_markers) {
      if (text.toLocaleLowerCase("fr").includes(marker.toLocaleLowerCase("fr"))) {
        errors.push(`${channel}: marqueur interdit détecté : ${marker}`);
      }
    }
    for (const source of facts.forbidden_patterns) {
      if (new RegExp(source, "iu").test(text)) errors.push(`${channel}: donnée tarifaire non approuvée détectée.`);
    }
  }

  const report = {
    status: errors.length ? "failed" : "passed",
    checked_at: new Date().toISOString(),
    errors,
    warnings: ["Validation humaine obligatoire avant programmation.", ...warnings]
  };
  if (writeReport) {
    await writeFile(path.join(dir, "validation.yml"), `${JSON.stringify(report, null, 2)}\n`);
  }
  return { date, ...report };
}

let dates = [];
if (process.argv.includes("--all")) {
  try {
    dates = (await readdir(dailyRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/u.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch {
    dates = [];
  }
} else {
  const date = getArg("date");
  if (!date) throw new Error("Utiliser --date AAAA-MM-JJ ou --all.");
  dates = [date];
}

if (!dates.length) {
  console.log("Aucun dossier quotidien à contrôler.");
  process.exit(0);
}

const reports = [];
for (const date of dates) {
  reports.push(await validateDate(date, { writeReport: process.argv.includes("--write-report") }));
}
for (const report of reports) {
  console.log(`${report.date}: ${report.status}`);
  for (const error of report.errors) console.error(`- ${error}`);
}
if (reports.some((report) => report.status !== "passed")) process.exitCode = 1;
