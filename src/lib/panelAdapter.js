/**
 * Prism Arena hooks for the panel API (live event overview + settings in the web panel).
 */
const db = require('./db');
const { eventStatus, rankings } = require('./arena');
const pkg = require('../../package.json');

const SCHEMA = [
    { key: 'announceChannelId', type: 'channel', label: 'Announcements channel', help: 'Event start, reminders and winners are posted here.' },
    { key: 'organizerRoleId', type: 'role', label: 'Organizer role', help: 'Can create and end events.' },
    { key: 'judgeRoleId', type: 'role', label: 'Judge role', help: 'Can score submitted projects with /judge.' },
    { key: 'teamCategoryId', type: 'category', label: 'Team channels category', help: 'Private team channels are created inside this category.' }
];

const ID = /^\d{17,20}$/;

module.exports = client => ({
    botId: 'arena',
    version: pkg.version,
    schema: SCHEMA,
    commands: () => [...client.commands.values()].map(c => ({ name: c.data.name, description: c.data.description })),
    getSettings: id => ({ ...db.guild(id).config }),
    updateSettings(id, patch) {
        const state = db.guild(id);
        for (const [key, value] of Object.entries(patch || {})) {
            if (!SCHEMA.some(f => f.key === key)) throw new Error(`Unknown setting "${key}"`);
            if (value !== null && !ID.test(String(value))) throw new Error(`${key} is invalid.`);
            state.config[key] = value;
        }
        db.save();
        return { ...state.config };
    },
    guildExtra: id => {
        const state = db.guild(id);
        const e = state.event;
        return {
            event: e ? { name: e.name, status: eventStatus(e), startsAt: e.startsAt, endsAt: e.endsAt, maxTeamSize: e.maxTeamSize } : null,
            teams: Object.keys(state.teams).length,
            submissions: Object.values(state.teams).filter(t => t.submission).length,
            rankings: rankings(state).slice(0, 10).map(r => ({ team: r.team.name, average: r.average, judges: r.judges })),
            challengeLeaders: Object.entries(state.points).sort((a, b) => b[1] - a[1]).slice(0, 10)
                .map(([userId, points]) => ({ userId, points, name: client.users.cache.get(userId)?.username || userId })),
            pastEvents: state.history.length
        };
    }
});
