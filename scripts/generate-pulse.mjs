#!/usr/bin/env node
// Generates assets/pulse.svg — last-7-days activity + top languages, Dell-1996 catalog style.
// Single variant: white canvas, 1px black hairlines, flat tint bars (see DESIGN.md).
// Usage: GITHUB_TOKEN=... node scripts/generate-pulse.mjs
import { writeFileSync } from "node:fs";

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) { console.error("GITHUB_TOKEN required"); process.exit(1); }
const LOGIN = "luv-jeri";

const to = new Date();
const from = new Date(to.getTime() - 7 * 24 * 3600 * 1000);

const query = `query($login:String!,$from:DateTime!,$to:DateTime!){
  user(login:$login){
    contributionsCollection(from:$from,to:$to){
      totalCommitContributions totalPullRequestContributions totalPullRequestReviewContributions
    }
    repositories(first:50,ownerAffiliations:OWNER,isFork:false,orderBy:{field:PUSHED_AT,direction:DESC}){
      nodes{ languages(first:5,orderBy:{field:SIZE,direction:DESC}){ edges{ size node{ name } } } }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { login: LOGIN, from: from.toISOString(), to: to.toISOString() } }),
});
const json = await res.json();
if (json.errors) { console.error(JSON.stringify(json.errors)); process.exit(1); }

const cc = json.data.user.contributionsCollection;
const acts = [
  { label: "COMMITS", n: cc.totalCommitContributions },
  { label: "PULL REQUESTS", n: cc.totalPullRequestContributions },
  { label: "REVIEWS", n: cc.totalPullRequestReviewContributions },
];

const langTotals = {};
for (const r of json.data.user.repositories.nodes)
  for (const e of r.languages.edges) langTotals[e.node.name] = (langTotals[e.node.name] ?? 0) + e.size;
const langs = Object.entries(langTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
const langSum = langs.reduce((s, [, v]) => s + v, 0) || 1;

// Dell-1996 closed palette: flat tint fills, hairlines, no gradients. Dual theme output.
const TINTS = ["#8c9ae0", "#b3bd95", "#e6915d", "#9ab6c8", "#d77a7a"];
const THEMES = {
  light: { canvas: "#ffffff", panel: "#ffffff", ink: "#000000", line: "#000000" },
  dark:  { canvas: "#0d1117", panel: "#0d1117", ink: "#ffffff", line: "#ffffff" },
};

function render(t) {
  const maxAct = Math.max(...acts.map(a => a.n), 1);
  const actRows = acts.map((a, i) => {
    const w = Math.max(6, Math.round((a.n / maxAct) * 230));
    const y = 86 + i * 36;
    return `<text class="hv" x="32" y="${y}" font-size="11" font-weight="700" fill="${t.ink}">${a.label}</text>
  <text class="bk" x="288" y="${y + 1}" font-size="14" fill="${t.ink}" text-anchor="end">${a.n}</text>
  <rect x="32" y="${y + 7}" width="230" height="10" fill="${t.panel}" stroke="${t.line}" stroke-width="1"/>
  <rect x="33" y="${y + 8}" width="${Math.min(w, 228)}" height="8" fill="${TINTS[0]}"/>`;
  }).join("\n");

  const langRows = langs.map(([name, v], i) => {
    const w = Math.max(6, Math.round((v / langSum) * 230));
    const y = 86 + i * 27;
    return `<text class="hv" x="368" y="${y}" font-size="11" font-weight="700" fill="${t.ink}">${name.toUpperCase()}</text>
  <rect x="470" y="${y - 9}" width="230" height="10" fill="${t.panel}" stroke="${t.line}" stroke-width="1"/>
  <rect x="471" y="${y - 8}" width="${Math.min(w, 228)}" height="8" fill="${TINTS[(i + 1) % TINTS.length]}"/>`;
  }).join("\n");

  const stamp = to.toISOString().slice(0, 10);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 732 240" width="732" height="240" role="img" aria-label="System monitor, last 7 days: ${acts.map(a => `${a.n} ${a.label.toLowerCase()}`).join(", ")}. Top languages: ${langs.map(([n]) => n).join(", ")}.">
  <style>
    .hv { font-family: Helvetica, Arial, sans-serif; }
    .bk { font-family: 'Arial Black', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 900; }
    .tm { font-family: 'Times New Roman', Times, serif; }
  </style>
  <rect x="0" y="0" width="732" height="240" fill="${t.canvas}"/>
  <rect x="2" y="2" width="728" height="34" fill="${t.panel}" stroke="${t.line}" stroke-width="1"/>
  <text class="hv" x="16" y="25" font-size="14" font-weight="700" fill="${t.ink}">SYSTEM MONITOR — THIS WEEK</text>
  <text class="tm" x="716" y="25" font-size="12" font-style="italic" fill="${t.ink}" text-anchor="end">auto-generated ${stamp}</text>
  <rect x="2" y="36" width="728" height="202" fill="${t.panel}" stroke="${t.line}" stroke-width="1"/>
  <text class="bk" x="32" y="64" font-size="15" fill="${t.ink}">ACTIVITY</text>
  <text class="bk" x="368" y="64" font-size="15" fill="${t.ink}">LANGUAGES</text>
  <line x1="340" y1="50" x2="340" y2="222" stroke="${t.line}" stroke-width="1"/>
${actRows}
${langRows}
</svg>
`;
}

writeFileSync("assets/pulse.svg", render(THEMES.light));
writeFileSync("assets/pulse-dark.svg", render(THEMES.dark));
console.log("pulse cards written");
