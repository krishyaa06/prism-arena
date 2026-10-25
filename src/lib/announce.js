const embeds = require('./embeds');
const { rankings, eventStatus, formatDuration } = require('./arena');
const { colors } = require('../config');

const MEDALS = ['🥇', '🥈', '🥉'];
const STATUS = {
    upcoming: '🟡 Upcoming',
    live: '🟢 LIVE',
    judging: '🟣 Judging',
    ended: '⚫ Ended',
    none: '—'
};

/** Resolve the channel where announcements should go. */
function announceChannel(guild, state, fallback) {
    const ch = state.config.announceChannelId && guild.channels.cache.get(state.config.announceChannelId);
    return ch?.isTextBased() ? ch : fallback || null;
}

function eventEmbed(state, now = Date.now()) {
    const e = state.event;
    const status = eventStatus(e, now);
    const total = e.endsAt - e.startsAt;
    const elapsed = Math.min(Math.max(now - e.startsAt, 0), total);
    const teams = Object.values(state.teams);
    const submitted = teams.filter(t => t.submission).length;
    const hackers = teams.reduce((n, t) => n + t.members.length, 0);

    const embed = embeds.base(status === 'live' ? colors.success : colors.info)
        .setTitle(`🏆 ${e.name}`)
        .setDescription(e.description || 'Build something amazing.')
        .addFields(
            { name: 'Status', value: STATUS[status], inline: true },
            { name: 'Starts', value: embeds.ts(e.startsAt, 'f'), inline: true },
            { name: 'Ends', value: embeds.ts(e.endsAt, 'f'), inline: true },
            { name: 'Teams', value: `${teams.length}`, inline: true },
            { name: 'Hackers', value: `${hackers}`, inline: true },
            { name: 'Submitted', value: `${submitted}/${teams.length}`, inline: true }
        );

    if (status === 'live') {
        embed.addFields({
            name: `⏳ ${formatDuration(e.endsAt - now)} left`,
            value: `\`${embeds.bar(elapsed, total, 20)}\` ${Math.floor((elapsed / total) * 100)}%`
        });
    } else if (status === 'upcoming') {
        embed.addFields({ name: '🚀 Kick-off', value: `Starts ${embeds.ts(e.startsAt)}` });
    }
    embed.addFields({ name: 'How to join', value: '`/team create` → share the invite code → `/team join` → `/submit` before the deadline' });
    return embed;
}

function leaderboardEmbed(state, title = '📊 Live Leaderboard') {
    const rows = rankings(state);
    const max = 40; // 4 criteria × 10
    const lines = rows.slice(0, 10).map((r, i) =>
        `${MEDALS[i] ?? `\`#${i + 1}\``} **${r.team.name}** · ${r.average.toFixed(1)}/${max}\n` +
        `\`${embeds.bar(r.average, max, 16)}\` ${r.judges} judge${r.judges === 1 ? '' : 's'}`
    );
    return embeds.base(colors.gold)
        .setTitle(title)
        .setDescription(lines.join('\n\n') || 'No scored submissions yet.');
}

module.exports = { announceChannel, eventEmbed, leaderboardEmbed, MEDALS };
