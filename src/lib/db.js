/**
 * JSON-file persistence with debounced atomic writes.
 * No native modules, so it runs anywhere Node runs (Termux, Replit, VPS).
 */
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.ARENA_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'arena.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

let data = {};
try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { data = {}; }

let timer = null;
function flush() {
    clearTimeout(timer);
    fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(data, null, 2));
    fs.renameSync(`${FILE}.tmp`, FILE);
}
function save() {
    clearTimeout(timer);
    timer = setTimeout(flush, 500);
}

process.on('exit', flush);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flush(); process.exit(0); });

const fresh = () => ({
    config: { announceChannelId: null, judgeRoleId: null, organizerRoleId: null, teamCategoryId: null },
    event: null,          // the current hackathon
    teams: {},            // teamId -> team
    scores: {},           // teamId -> { judgeId: { innovation, execution, ... , feedback } }
    challenges: {},       // messageId -> { challengeId, solvers: [userId], postedAt }
    points: {},           // userId -> challenge points
    history: []           // finished events (summary)
});

/** Returns the arena state for a guild (created on first use). */
function guild(guildId) {
    if (!data[guildId]) data[guildId] = fresh();
    return data[guildId];
}

module.exports = { guild, save, flush, fresh };
