#!/usr/bin/env node
// Rewrites the NOW-BUILDING block in README.md with the 3 most recently pushed public repos.
// Usage: node scripts/generate-now-building.mjs   (GITHUB_TOKEN optional, raises rate limit)
import { readFileSync, writeFileSync } from "node:fs";

const LOGIN = "luv-jeri";
const headers = { "User-Agent": LOGIN };
if (process.env.GITHUB_TOKEN) headers.Authorization = `bearer ${process.env.GITHUB_TOKEN}`;

const res = await fetch(`https://api.github.com/users/${LOGIN}/repos?sort=pushed&per_page=15`, { headers });
if (!res.ok) { console.error(`GitHub API ${res.status}`); process.exit(1); }
const repos = (await res.json())
  .filter(r => !r.fork && !r.archived && r.name !== LOGIN)
  .slice(0, 3);

const lines = repos.map(r =>
  `- 🔨 **[${r.name}](${r.html_url})** — ${r.description ?? "in progress"}`
).join("\n");

const README = "README.md";
const md = readFileSync(README, "utf8");
const START = "<!-- NOW-BUILDING:START -->";
const END = "<!-- NOW-BUILDING:END -->";
const block = `${START}\n${lines}\n${END}`;
const next = md.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);

if (next === md) { console.log("now-building: no change"); }
else { writeFileSync(README, next); console.log("now-building: updated"); }
