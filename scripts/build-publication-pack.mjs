import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function load(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

const date = getArg("date");
const scheduledFor = getArg("scheduled-for");
const approvedBy = getArg("approved-by");
const confirmation = getArg("confirm");
const requestedChannels = (getArg("channels") || "facebook,linkedin,whatsapp")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const allowedChannels = new Set(["facebook", "linkedin", "whatsapp"]);

if (!date || !scheduledFor || !approvedBy) {
  throw new Error("--date, --scheduled-for et --approved-by sont obligatoires.");
}
if (confirmation !== "VALIDATION_HUMAINE") {
  throw new Error("Confirmation humaine absente. Utiliser --confirm VALIDATION_HUMAINE.");
}
if (requestedChannels.some((channel) => !allowedChannels.has(channel))) {
  throw new Error("Canal inconnu.");
}

const sourceDir = path.join(root, "02-CONTENUS", "QUOTIDIEN", date);
const validation = await load(path.join(sourceDir, "validation.yml"));
if (validation.status !== "passed") throw new Error("Le contrôle automatique doit être réussi.");

const outputDir = path.join(root, "dist", "publications", date);
await mkdir(outputDir, { recursive: true });
await Promise.all([
  cp(path.join(sourceDir, "brief.yml"), path.join(outputDir, "brief.yml")),
  ...requestedChannels.map((channel) =>
    cp(path.join(sourceDir, `${channel}.md`), path.join(outputDir, `${channel}.md`))
  )
]);

const manifest = {
  date,
  status: "approved-for-scheduling",
  approved_by: approvedBy,
  approved_at: new Date().toISOString(),
  scheduled_for: scheduledFor,
  channels: requestedChannels,
  direct_publication: false,
  remaining_human_action: "Programmer ou publier le pack sur les plateformes autorisées puis enregistrer les URL."
};
await writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Pack approuvé créé dans ${path.relative(root, outputDir)}.`);
