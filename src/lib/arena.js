/**
 * Pure hackathon logic (no Discord calls) so it can be unit-tested.
 */
const crypto = require('node:crypto');
const { judging } = require('../config');

/** Errors whose message is safe to show to the user. */
class ArenaError extends Error {
    constructor(message) { super(message); this.userFacing = true; }
}

const UNITS = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

/** "30m" | "2h" | "3d" | "1w" | "1d12h" -> ms (null when invalid) */
function parseDuration(input) {
    const str = String(input).trim().toLowerCase();
    if (!/^(\d+\s*[mhdw]\s*)+$/.test(str)) return null;
    let total = 0;
    for (const [, n, u] of str.matchAll(/(\d+)\s*([mhdw])/g)) total += Number(n) * UNITS[u];
    return total;
}

/** Human readable "2d 4h 10m" */
function formatDuration(ms) {
    if (ms <= 0) return '0m';
    const d = Math.floor(ms / UNITS.d);
    const h = Math.floor((ms % UNITS.d) / UNITS.h);
    const m = Math.floor((ms % UNITS.h) / UNITS.m);
    return [d && `${d}d`, h && `${h}h`, (m || (!d && !h)) && `${m}m`].filter(Boolean).join(' ');
}

/** 6-char invite code without look-alike characters (0/O, 1/I). */
function makeCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(crypto.randomBytes(6), b => alphabet[b % alphabet.length]).join('');
}

function eventStatus(event, now = Date.now()) {
    if (!event) return 'none';
    if (event.ended) return 'ended';
    if (now < event.startsAt) return 'upcoming';
    if (now < event.endsAt) return 'live';
    return 'judging';
}

function createEvent(state, { name, description, startsAt, endsAt, maxTeamSize, createdBy }) {
    state.event = {
        id: makeCode(), name, description, startsAt, endsAt, maxTeamSize, createdBy,
        ended: false,
        reminders: { start: false, day: false, hour: false, end: false }
    };
    state.teams = {};
    state.scores = {};
    return state.event;
}

const findTeamOf = (state, userId) => Object.values(state.teams).find(t => t.members.includes(userId)) || null;
const findTeamByName = (state, name) =>
    Object.values(state.teams).find(t => t.name.toLowerCase() === String(name).trim().toLowerCase()) || null;
const findTeamByCode = (state, code) =>
    Object.values(state.teams).find(t => t.code === String(code).trim().toUpperCase()) || null;

function createTeam(state, { name, leaderId }) {
    const clean = String(name).trim().replace(/\s+/g, ' ');
    if (clean.length < 2 || clean.length > 32) throw new ArenaError('Team name must be 2–32 characters.');
    if (findTeamOf(state, leaderId)) throw new ArenaError('You are already in a team. Use `/team leave` first.');
    if (findTeamByName(state, clean)) throw new ArenaError('A team with that name already exists.');

    const id = makeCode();
    state.teams[id] = { id, name: clean, code: makeCode(), leaderId, members: [leaderId], createdAt: Date.now(), submission: null, channelId: null };
    return state.teams[id];
}

function joinTeam(state, { code, userId }) {
    const team = findTeamByCode(state, code);
    if (!team) throw new ArenaError('Invalid invite code.');
    if (findTeamOf(state, userId)) throw new ArenaError('You are already in a team. Use `/team leave` first.');
    if (team.members.length >= state.event.maxTeamSize) throw new ArenaError(`**${team.name}** is full (${state.event.maxTeamSize}/${state.event.maxTeamSize}).`);
    team.members.push(userId);
    return team;
}

/** Returns { team, disbanded } */
function leaveTeam(state, userId) {
    const team = findTeamOf(state, userId);
    if (!team) throw new ArenaError('You are not in a team.');
    team.members = team.members.filter(id => id !== userId);
    if (!team.members.length) {
        delete state.teams[team.id];
        delete state.scores[team.id];
        return { team, disbanded: true };
    }
    if (team.leaderId === userId) team.leaderId = team.members[0]; // promote next member
    return { team, disbanded: false };
}

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

function submitProject(state, { userId, repo, demo, title, description }) {
    const team = findTeamOf(state, userId);
    if (!team) throw new ArenaError('Join or create a team before submitting.');
    if (!URL_RE.test(repo)) throw new ArenaError('Repository must be a valid http(s) URL.');
    if (demo && !URL_RE.test(demo)) throw new ArenaError('Demo must be a valid http(s) URL.');
    const isUpdate = Boolean(team.submission);
    team.submission = { title, repo, demo: demo || null, description, by: userId, at: Date.now() };
    return { team, isUpdate };
}

function scoreTeam(state, { teamId, judgeId, scores, feedback }) {
    const team = state.teams[teamId];
    if (!team) throw new ArenaError('Team not found.');
    if (!team.submission) throw new ArenaError(`**${team.name}** has not submitted a project yet.`);
    for (const c of judging.criteria) {
        const v = scores[c];
        if (!Number.isInteger(v) || v < judging.min || v > judging.max) throw new ArenaError(`${c} must be ${judging.min}–${judging.max}.`);
    }
    state.scores[teamId] ??= {};
    state.scores[teamId][judgeId] = { ...scores, feedback: feedback || null, at: Date.now() };
    return team;
}

/** Average total score per team (out of criteria.length * max). */
function rankings(state) {
    return Object.values(state.teams)
        .filter(t => t.submission)
        .map(t => {
            const judges = Object.values(state.scores[t.id] || {});
            const totals = judges.map(s => judging.criteria.reduce((sum, c) => sum + s[c], 0));
            const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
            const perCriteria = Object.fromEntries(judging.criteria.map(c => [
                c, judges.length ? judges.reduce((a, s) => a + s[c], 0) / judges.length : 0
            ]));
            return { team: t, average: Math.round(avg * 100) / 100, judges: judges.length, perCriteria };
        })
        .sort((a, b) => b.average - a.average || a.team.submission.at - b.team.submission.at);
}

/** Normalises answers so "  12 " == "12" and "Hello World" == "hello world". */
const normalise = s => String(s).trim().toLowerCase().replace(/\s+/g, ' ').replace(/^["'`]|["'`]$/g, '');

module.exports = {
    ArenaError, parseDuration, formatDuration, makeCode, eventStatus, createEvent,
    findTeamOf, findTeamByName, findTeamByCode, createTeam, joinTeam, leaveTeam,
    submitProject, scoreTeam, rankings, normalise
};
