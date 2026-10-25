/**
 * Checks every guild once per minute and posts lifecycle announcements:
 *   kick-off · 24h left · 1h left · submissions closed
 * Flags are persisted so restarts never double-post.
 */
const db = require('./db');
const embeds = require('./embeds');
const log = require('./logger');
const { announceChannel, eventEmbed } = require('./announce');
const { colors, schedulerMs } = require('../config');

const HOUR = 3_600_000;

async function tick(client) {
    const now = Date.now();
    for (const guild of client.guilds.cache.values()) {
        const state = db.guild(guild.id);
        const e = state.event;
        if (!e || e.ended) continue;
        const channel = announceChannel(guild, state);
        if (!channel) continue;

        const send = async (flag, embed) => {
            e.reminders[flag] = true;
            db.save();
            await channel.send({ embeds: [embed] }).catch(err => log.warn(`Announce failed in ${guild.name}: ${err.message}`));
        };

        if (!e.reminders.start && now >= e.startsAt && now < e.endsAt) {
            await send('start', eventEmbed(state, now).setTitle(`🚀 ${e.name} has STARTED!`));
        }
        if (!e.reminders.day && e.endsAt - now <= 24 * HOUR && e.endsAt - now > HOUR && e.endsAt - e.startsAt > 24 * HOUR) {
            await send('day', embeds.base(colors.warning).setTitle('⏰ 24 hours left').setDescription(`**${e.name}** ends ${embeds.ts(e.endsAt)}. Start polishing your demo!`));
        }
        if (!e.reminders.hour && e.endsAt - now <= HOUR && now < e.endsAt) {
            await send('hour', embeds.base(colors.danger).setTitle('🔥 Final hour!').setDescription(`Submissions close ${embeds.ts(e.endsAt)}. Use \`/submit\` now.`));
        }
        if (!e.reminders.end && now >= e.endsAt) {
            await send('end', embeds.base(colors.info).setTitle('🔒 Submissions closed').setDescription(`Thanks for building at **${e.name}**! Judges are now reviewing projects.`));
        }
    }
}

function start(client) {
    const run = () => tick(client).catch(err => log.error('Scheduler error:', err));
    run();
    return setInterval(run, schedulerMs);
}

module.exports = { start, tick };
