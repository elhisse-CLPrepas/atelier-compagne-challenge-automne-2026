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

function extractUrls(text) {
  return text.match(/https?:\/\/\S+/gu) || [];
}

function normalizedDestination(value) {
  const url = new URL(value);
  return `${url.origin}${url.pathname.replace(/\/+$/u, "")}`;
}

async function validateDate(date, { writeReport = false } = {}) {
  const dir = path.join(dailyRoot, date);
  const facts = await loadJsonYaml(path.join(root, "config", "approved-facts.yml"));
  const channels = await loadJsonYaml(path.join(root, "config", "channels.yml"));
  const campaign = await loadJsonYaml(path.join(root, "config", "campaign.yml"));
  const errors = [];
  const warnings = [];
  const required = ["brief.yml", "facebook.md", "linkedin.md", "whatsapp.md", "validation.yml", "publication.json"];

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
  if (brief.human_review_required !== true) errors.push("La revue humaine doit rester obligatoire.");

  const allowedStatuses = new Set(["draft", "scheduled", "published", "measured"]);
  if (!allowedStatuses.has(publication.status)) errors.push(`État de publication inconnu : ${publication.status}`);
  if (publication.status === "draft" && publication.human_approval !== false) {
    errors.push("Un brouillon ne peut pas porter une approbation humaine.");
  }
  if (publication.status !== "draft") {
    if (publication.human_approval !== true) errors.push("L’approbation humaine est requise après le brouillon.");
    if (!publication.approved_by) errors.push("Le nom du valideur humain est requis.");
    if (!publication.scheduled_for || Number.isNaN(Date.parse(publication.scheduled_for))) {
      errors.push("Une date de programmation ISO 8601 valide est requise.");
    }
  }
  if (["published", "measured"].includes(publication.status)) {
    if (!publication.published_at || Number.isNaN(Date.parse(publication.published_at))) {
      errors.push("Une date de publication ISO 8601 valide est requise.");
    }
    if (!publication.platform_urls || Object.keys(publication.platform_urls).length === 0) {
      errors.push("Au moins un lien public est requis après diffusion.");
    }
  }

  for (const [channel, limits] of Object.entries(channels)) {
    const text = await readFile(path.join(dir, `${channel}.md`), "utf8");
    const total = wordCount(text);
    if (total < limits.min_words || total > limits.max_words) {
      errors.push(`${channel}: ${total} mots hors limites ${limits.min_words}-${limits.max_words}.`);
    }
    const urls = extractUrls(text);
    if (urls.length !== 1) {
      errors.push(`${channel}: un seul lien est requis.`);
    } else {
      const actual = new URL(urls[0]);
      const expectedBase = brief.cta === "view_portfolio" ? facts.portfolio_url : facts.offer_url;
      if (normalizedDestination(actual) !== normalizedDestination(expectedBase)) {
        errors.push(`${channel}: destination non approuvée.`);
      }
      const expectedParams = {
        utm_source: limits.utm_source,
        utm_medium: limits.utm_medium,
        utm_campaign: campaign.campaign_id,
        utm_content: `${date}_${channel}`
      };
      for (const [name, expected] of Object.entries(expectedParams)) {
        if (actual.searchParams.get(name) !== expected) errors.push(`${channel}: paramètre ${name} incorrect.`);
      }
    }
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
