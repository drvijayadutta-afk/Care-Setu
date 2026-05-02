#!/usr/bin/env node
// scripts/update-bible.mjs — keeps BIBLE.md in sync with task completion.
//
// Usage (direct):
//   node scripts/update-bible.mjs --task=S1 --status=done --note="..." [--commit=SHA]
//
// Usage (from git post-commit hook): scans the most recent commit for tags
// like [S1], [H2], [M3], [P1.2], [O1] and marks each tagged task done.
//   node scripts/update-bible.mjs --from-commit=HEAD
//
// Statuses: pending | in-progress | blocked | done
//
// The script edits two managed regions in BIBLE.md, delimited by HTML
// comments. Anything outside those regions is left untouched, so humans can
// freely edit the strategic content.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const BIBLE_PATH = resolve(REPO_ROOT, "BIBLE.md");

const STATUS_START = "<!-- bible:status:start -->";
const STATUS_END = "<!-- bible:status:end -->";
const LOG_START = "<!-- bible:log:start -->";
const LOG_END = "<!-- bible:log:end -->";

const STATUS_ICON = {
  pending: "⬜",
  "in-progress": "🟨",
  blocked: "🟥",
  done: "✅",
};

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    out[m[1]] = m[2] ?? true;
  }
  return out;
}

function readBible() {
  if (!existsSync(BIBLE_PATH)) {
    throw new Error(`BIBLE.md not found at ${BIBLE_PATH}`);
  }
  return readFileSync(BIBLE_PATH, "utf8");
}

function writeBible(content) {
  writeFileSync(BIBLE_PATH, content, "utf8");
}

function extractRegion(text, startMarker, endMarker) {
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`Managed region ${startMarker}…${endMarker} missing or malformed`);
  }
  const before = text.slice(0, startIdx + startMarker.length);
  const region = text.slice(startIdx + startMarker.length, endIdx);
  const after = text.slice(endIdx);
  return { before, region, after };
}

function parseTable(region) {
  const lines = region.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows = [];
  let header = null;
  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim()).slice(1, -1);
    if (cells.every((c) => /^-+$/.test(c.replace(/[: ]/g, "")))) continue;
    if (!header) {
      header = cells;
    } else {
      rows.push(cells);
    }
  }
  return { header, rows };
}

function renderTable(header, rows) {
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length))
  );
  const fmtRow = (cells) =>
    "| " + cells.map((c, i) => (c ?? "").padEnd(widths[i])).join(" | ") + " |";
  const sep =
    "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";
  return [fmtRow(header), sep, ...rows.map(fmtRow)].join("\n");
}

function updateTaskRow(text, taskId, status, dateIso, commitShort, note) {
  const { before, region, after } = extractRegion(text, STATUS_START, STATUS_END);
  const { header, rows } = parseTable(region);
  if (!header) {
    throw new Error("Status table header not found");
  }
  const idCol = header.findIndex((h) => /^id$|task/i.test(h));
  const statusCol = header.findIndex((h) => /^status$/i.test(h));
  const dateCol = header.findIndex((h) => /date|completed/i.test(h));
  const commitCol = header.findIndex((h) => /commit/i.test(h));
  const noteCol = header.findIndex((h) => /note/i.test(h));
  if (idCol < 0 || statusCol < 0) {
    throw new Error("Status table must have ID and Status columns");
  }
  const rowIdx = rows.findIndex((r) => r[idCol]?.trim() === taskId);
  if (rowIdx < 0) {
    console.warn(`⚠️  Task ${taskId} not in status table — skipping`);
    return text;
  }
  const icon = STATUS_ICON[status] ?? "⬜";
  rows[rowIdx][statusCol] = `${icon} ${status}`;
  // Reverting to pending clears Date and Commit — those fields only carry
  // meaning while a task is in-progress, blocked, or done.
  if (status === "pending") {
    if (dateCol >= 0) rows[rowIdx][dateCol] = "—";
    if (commitCol >= 0) rows[rowIdx][commitCol] = "—";
  } else {
    if (dateCol >= 0) rows[rowIdx][dateCol] = dateIso ?? "—";
    if (commitCol >= 0) rows[rowIdx][commitCol] = commitShort ?? "—";
  }
  if (noteCol >= 0 && note) rows[rowIdx][noteCol] = note;
  return `${before}\n${renderTable(header, rows)}\n${after}`;
}

function appendLog(text, taskId, status, dateIso, commitShort, note) {
  const { before, region, after } = extractRegion(text, LOG_START, LOG_END);
  const entry = `- \`${dateIso}\` · **${taskId}** → ${status}${commitShort && commitShort !== "—" ? ` · \`${commitShort}\`` : ""}${note ? ` · ${note}` : ""}`;
  // Normalize: drop blank lines between marker and first entry, then append.
  const normalized = region.replace(/^\s+/, "").replace(/\s+$/, "");
  const body = normalized ? normalized + "\n" + entry : entry;
  return `${before}\n${body}\n${after}`;
}

function nowIso() {
  return new Date().toISOString().replace("T", " ").slice(0, 19) + "Z";
}

function shortSha(sha) {
  return sha?.slice(0, 7) || "—";
}

function gitCommitInfo(ref) {
  try {
    const sha = execSync(`git rev-parse ${ref}`, { cwd: REPO_ROOT })
      .toString()
      .trim();
    const msg = execSync(`git log -1 --format=%B ${ref}`, { cwd: REPO_ROOT })
      .toString()
      .trim();
    return { sha, msg };
  } catch {
    return null;
  }
}

function extractTaskTagsFromMessage(msg) {
  // Tags are valid only on the SUBJECT line (first line).
  // Body text often contains the literal token in prose / docs / examples
  // (e.g. "see [S1] in the plan") and we don't want those to fire updates.
  const subject = msg.split("\n")[0];
  const out = new Set();
  const re = /\[([SHMP]\d+(?:\.\d+)?|O\d+)\]/g;
  let m;
  while ((m = re.exec(subject))) out.add(m[1]);
  return [...out];
}

function main() {
  const args = parseArgs(process.argv);
  let updates = [];
  const dateIso = nowIso();

  if (args["from-commit"]) {
    const info = gitCommitInfo(args["from-commit"]);
    if (!info) {
      console.error("❌ Could not read commit info");
      process.exit(0); // do not fail the hook
    }
    const tags = extractTaskTagsFromMessage(info.msg);
    if (tags.length === 0) {
      console.log("ℹ️  No bible task tags in commit message — nothing to update");
      return;
    }
    const firstLine = info.msg.split("\n")[0].slice(0, 80);
    for (const id of tags) {
      updates.push({
        id,
        status: "done",
        commit: shortSha(info.sha),
        note: firstLine,
      });
    }
  } else if (args.task) {
    updates.push({
      id: args.task,
      status: args.status || "done",
      commit: args.commit ? shortSha(args.commit) : "manual",
      note: args.note || "",
    });
  } else {
    console.error(
      "Usage: --task=ID [--status=done|in-progress|blocked|pending] [--note=...] [--commit=SHA]\n" +
        "       --from-commit=HEAD"
    );
    process.exit(1);
  }

  let text = readBible();
  for (const u of updates) {
    text = updateTaskRow(text, u.id, u.status, dateIso, u.commit, u.note);
    text = appendLog(text, u.id, u.status, dateIso, u.commit, u.note);
    console.log(`✅ Bible updated: ${u.id} → ${u.status}`);
  }
  writeBible(text);
}

try {
  main();
} catch (err) {
  console.error(`❌ update-bible failed: ${err.message}`);
  // Do NOT exit non-zero from a git hook — never block a commit
  if (!process.argv.some((a) => a.startsWith("--from-commit"))) {
    process.exit(1);
  }
}
