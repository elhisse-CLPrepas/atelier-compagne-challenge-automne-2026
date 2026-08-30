import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function loadJsonYaml(file) {
  return JSON.parse(await readFile(path.join(root, file), "utf8"));
}

function todayIn(timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function words(text) {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function trackedUrl(base, channel, date, channels, campaign) {
  const url = new URL(base);
  url.searchParams.set("utm_source", channels[channel].utm_source);
  url.searchParams.set("utm_medium", channels[channel].utm_medium);
  url.searchParams.set("utm_campaign", campaign.campaign_id);
  url.searchParams.set("utm_content", `${date}_${channel}`);
  return url.toString();
}

function makeMessages({ plan, facts, channels, campaign }) {
  const f = facts.facts;
  const cta = facts.cta_labels[plan.cta];
  const url = Object.fromEntries(
    Object.keys(channels).map((channel) => [
      channel,
      trackedUrl(facts.offer_url, channel, plan.date, channels, campaign)
    ])
  );

  return {
    facebook: `${plan.angle}\n\nUtiliser l’intelligence artificielle ne suffit pas. Le vrai défi consiste à transformer un besoin professionnel en production utile, contrôlée et présentable.\n\nLe ${f.campaign_name} propose une progression par la pratique : besoin réel, cadrage, production, contrôle humain, correction, documentation et preuve.\n\nVous apprenez à produire des documents, des supports, des visuels, des pages web et des workflows. Chaque réalisation peut enrichir votre ${f.proof}.\n\nDépart : ${f.start_date}\n${f.duration} • ${f.sessions} • ${f.delivery}\n\n${f.positioning}\n\n${cta} :\n${url.facebook}\n\n${facts.signature}\n`,
    linkedin: `${plan.angle}\n\nBeaucoup de professionnels utilisent déjà l’intelligence artificielle. Peu disposent pourtant d’une méthode stable pour cadrer leur besoin, contrôler le résultat et présenter une preuve de leur production.\n\nLe ${f.campaign_name} transforme cet usage occasionnel en capacité de production. La progression suit un parcours clair : besoin réel → cadrage → prompt → production → contrôle humain → correction → documentation → preuve.\n\nLe parcours permet de travailler sur des documents professionnels, des supports pédagogiques, des visuels, des pages web et des workflows compréhensibles. Le ${f.proof} rend la progression visible.\n\nDépart : ${f.start_date}\n${f.duration} • ${f.sessions} • ${f.delivery}\n\n${f.positioning}\n\n${cta} :\n${url.linkedin}\n\n${facts.signature}\n`,
    whatsapp: `${plan.angle}\n\nLe ${f.campaign_name} vous aide à passer d’un usage occasionnel de l’IA à une production organisée et contrôlée.\n\nVous avancez par étapes : besoin, cadrage, production, contrôle humain et preuve. Vous construisez des livrables concrets et un ${f.proof}.\n\nDépart : ${f.start_date}\n${f.duration} • ${f.sessions} • ${f.delivery}\n\n${f.positioning}\n\n${cta} :\n${url.whatsapp}\n\n${facts.signature}\n`
  };
}

const campaign = await loadJsonYaml("config/campaign.yml");
const channels = await loadJsonYaml("config/channels.yml");
const facts = await loadJsonYaml("config/approved-facts.yml");
const date = getArg("date") || todayIn(campaign.timezone);
const force = hasFlag("force");
const plan = campaign.schedule.find((entry) => entry.date === date);

if (!plan) {
  if (hasFlag("skip-unplanned")) {
    console.log(`Aucun contenu planifié pour ${date}. Fin sans erreur.`);
    process.exit(0);
  }
  throw new Error(`Aucun contenu planifié pour ${date}.`);
}

const outputDir = path.join(root, "02-CONTENUS", "QUOTIDIEN", date);
try {
  await access(path.join(outputDir, "brief.yml"));
  if (!force) {
    console.log(`Le dossier ${date} existe déjà. Aucun écrasement.`);
    process.exit(0);
  }
} catch {
  // Le dossier peut être créé.
}

await mkdir(outputDir, { recursive: true });
const messages = makeMessages({ plan, facts, channels, campaign });
const brief = {
  ...plan,
  campaign_id: campaign.campaign_id,
  source: facts.source,
  human_review_required: true,
  generated_by: "automation-a2"
};
const validation = {
  status: "pending",
  checked_at: null,
  errors: [],
  warnings: ["Validation humaine obligatoire avant programmation."]
};
const publication = {
  date,
  status: "draft",
  human_approval: false,
  approved_by: null,
  scheduled_for: null,
  published_at: null,
  platform_urls: {},
  metrics: {
    reach: null,
    clicks: null,
    conversations: null,
    qualified_prospects: null,
    interviews: null,
    confirmed_registrations: null
  }
};

await Promise.all([
  writeFile(path.join(outputDir, "brief.yml"), `${JSON.stringify(brief, null, 2)}\n`),
  ...Object.entries(messages).map(([channel, text]) =>
    writeFile(path.join(outputDir, `${channel}.md`), text)
  ),
  writeFile(path.join(outputDir, "validation.yml"), `${JSON.stringify(validation, null, 2)}\n`),
  writeFile(path.join(outputDir, "publication.json"), `${JSON.stringify(publication, null, 2)}\n`)
]);

console.log(`Contenu préparé pour ${date}.`);
for (const [channel, text] of Object.entries(messages)) {
  console.log(`${channel}: ${words(text)} mots`);
}
