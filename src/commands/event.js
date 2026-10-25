const { SlashCommandBuilder } = require('discord.js');
const db = require('../lib/db');
const embeds = require('../lib/embeds');
const A = require('../lib/arena');
const { isOrganizer } = require('../lib/perms');
const { announceChannel, eventEmbed, leaderboardEmbed, MEDALS } = require('../lib/announce');
const { colors } = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('event')
        .setDescription('Create and manage the hackathon')
        .addSubcommand(s => s.setName('create').setDescription('Create a new hackathon (organizers)')
            .addStringOption(o => o.setName('name').setDescription('Event name').setRequired(true).setMaxLength(80))
            .addStringOption(o => o.setName('duration').setDescription('How long it runs, e.g. 24h, 48h, 1w').setRequired(true))
            .addStringOption(o => o.setName('starts_in').setDescription('Start after e.g. 30m, 2h, 1d (default: now)'))
            .addIntegerOption(o => o.setName('max_team_size').setDescription('Members per team (default 4)').setMinValue(1).setMaxValue(10))
            .addStringOption(o => o.setName('description').setDescription('Theme, rules, prizes...').setMaxLength(1500)))
        .addSubcommand(s => s.setName('info').setDescription('Show the current event, timer and stats'))
        .addSubcommand(s => s.setName('extend').setDescription('Extend the deadline (organizers)')
            .addStringOption(o => o.setName('by').setDescription('e.g. 30m, 2h').setRequired(true)))
        .addSubcommand(s => s.setName('end').setDescription('Finish judging and announce winners (organizers)')),

    async execute(interaction) {
        const state = db.guild(interaction.guild.id);
        const sub = interaction.options.getSubcommand();

        if (sub === 'info') {
            if (!state.event) return interaction.reply({ embeds: [embeds.info('No event yet. Organizers can start one with `/event create`.')] });
            return interaction.reply({ embeds: [eventEmbed(state)] });
        }

        if (!isOrganizer(interaction, state)) {
            return interaction.reply({ embeds: [embeds.error('Only organizers can do that.')], ephemeral: true });
        }

        if (sub === 'create') {
            const status = A.eventStatus(state.event);
            if (['upcoming', 'live', 'judging'].includes(status)) {
                return interaction.reply({ embeds: [embeds.error(`**${state.event.name}** is still ${status}. Finish it with \`/event end\` first.`)], ephemeral: true });
            }
            const duration = A.parseDuration(interaction.options.getString('duration'));
            const startsIn = interaction.options.getString('starts_in');
            const delay = startsIn ? A.parseDuration(startsIn) : 0;
            if (!duration || duration < 600_000) return interaction.reply({ embeds: [embeds.error('Duration must be at least `10m` (e.g. `24h`, `2d`).')], ephemeral: true });
            if (delay === null) return interaction.reply({ embeds: [embeds.error('Invalid `starts_in`. Use e.g. `30m`, `2h`, `1d`.')], ephemeral: true });

            const startsAt = Date.now() + delay;
            A.createEvent(state, {
                name: interaction.options.getString('name'),
                description: interaction.options.getString('description'),
                startsAt,
                endsAt: startsAt + duration,
                maxTeamSize: interaction.options.getInteger('max_team_size') ?? 4,
                createdBy: interaction.user.id
            });
            if (!delay) state.event.reminders.start = true; // we announce right now
            db.save();

            const channel = announceChannel(interaction.guild, state, interaction.channel);
            const embed = eventEmbed(state).setTitle(`🏆 ${state.event.name} • ${delay ? 'Announced' : 'LIVE NOW'}`);
            if (channel.id !== interaction.channelId) await channel.send({ embeds: [embed] });
            return interaction.reply({ embeds: channel.id === interaction.channelId ? [embed] : [embeds.success(`Event created and announced in ${channel}.`)] });
        }

        if (!state.event || state.event.ended) {
            return interaction.reply({ embeds: [embeds.error('There is no active event.')], ephemeral: true });
        }

        if (sub === 'extend') {
            const ms = A.parseDuration(interaction.options.getString('by'));
            if (!ms) return interaction.reply({ embeds: [embeds.error('Invalid duration. Use e.g. `30m`, `2h`.')], ephemeral: true });
            state.event.endsAt += ms;
            // allow reminders to fire again for the new deadline
            Object.assign(state.event.reminders, { day: false, hour: false, end: false });
            db.save();
            const msg = `⏳ Deadline extended by **${A.formatDuration(ms)}**. New end: ${embeds.ts(state.event.endsAt, 'f')}`;
            const channel = announceChannel(interaction.guild, state, interaction.channel);
            if (channel.id !== interaction.channelId) await channel.send({ embeds: [embeds.info(msg)] });
            return interaction.reply({ embeds: [embeds.success(msg)] });
        }

        // sub === 'end'
        const ranking = A.rankings(state);
        state.event.ended = true;
        state.event.endsAt = Math.min(state.event.endsAt, Date.now());
        state.history.push({
            name: state.event.name,
            endedAt: Date.now(),
            teams: Object.keys(state.teams).length,
            podium: ranking.slice(0, 3).map(r => ({ team: r.team.name, members: r.team.members, score: r.average }))
        });
        db.save();

        const podium = ranking.slice(0, 3).map((r, i) =>
            `${MEDALS[i]} **${r.team.name}** · ${r.average.toFixed(1)}/40\n${r.team.members.map(id => `<@${id}>`).join(' ')}\n[${r.team.submission.title}](${r.team.submission.repo})`
        );
        const winners = embeds.base(colors.gold)
            .setTitle(`🎉 ${state.event.name} • Winners`)
            .setDescription(podium.join('\n\n') || 'No projects were scored.')
            .addFields({ name: 'Thank you', value: `${Object.keys(state.teams).length} teams built something awesome. See you at the next one!` });

        const channel = announceChannel(interaction.guild, state, interaction.channel);
        await channel.send({ embeds: [winners, leaderboardEmbed(state, '📊 Final standings')] });
        if (channel.id !== interaction.channelId) {
            return interaction.reply({ embeds: [embeds.success(`Winners announced in ${channel}.`)], ephemeral: true });
        }
        return interaction.reply({ embeds: [embeds.success('Event closed.')], ephemeral: true });
    }
};
