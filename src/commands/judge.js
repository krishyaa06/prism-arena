const { SlashCommandBuilder } = require('discord.js');
const db = require('../lib/db');
const embeds = require('../lib/embeds');
const A = require('../lib/arena');
const { isJudge } = require('../lib/perms');
const { judging } = require('../config');

const score = (o, name, desc) => o.setName(name).setDescription(desc).setRequired(true).setMinValue(judging.min).setMaxValue(judging.max);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('judge')
        .setDescription('Judge tools')
        .addSubcommand(s => s.setName('score').setDescription('Score a team (1–10 per criterion)')
            .addStringOption(o => o.setName('team').setDescription('Team').setRequired(true).setAutocomplete(true))
            .addIntegerOption(o => score(o, 'innovation', 'How original is the idea?'))
            .addIntegerOption(o => score(o, 'execution', 'How well does it work?'))
            .addIntegerOption(o => score(o, 'design', 'UI / UX and polish'))
            .addIntegerOption(o => score(o, 'impact', 'Usefulness and potential'))
            .addStringOption(o => o.setName('feedback').setDescription('Private feedback sent to the team').setMaxLength(1000)))
        .addSubcommand(s => s.setName('queue').setDescription('Submissions you have not scored yet')),

    async autocomplete(interaction) {
        const state = db.guild(interaction.guild.id);
        const q = interaction.options.getFocused().toLowerCase();
        await interaction.respond(
            Object.values(state.teams).filter(t => t.submission && t.name.toLowerCase().includes(q))
                .slice(0, 25).map(t => ({ name: `${t.name} · ${t.submission.title}`.slice(0, 100), value: t.id }))
        );
    },

    async execute(interaction) {
        const state = db.guild(interaction.guild.id);
        if (!isJudge(interaction, state)) {
            return interaction.reply({ embeds: [embeds.error('Only judges can use this. Ask an admin to run `/arena config judge_role`.')], ephemeral: true });
        }
        if (!state.event) return interaction.reply({ embeds: [embeds.error('There is no event.')], ephemeral: true });

        if (interaction.options.getSubcommand() === 'queue') {
            const pending = Object.values(state.teams).filter(t => t.submission && !state.scores[t.id]?.[interaction.user.id]);
            const lines = pending.map(t => `• **${t.name}** · [${t.submission.title}](${t.submission.repo})`);
            return interaction.reply({
                embeds: [embeds.base().setTitle(`🧑‍⚖️ Your queue • ${pending.length} left`).setDescription(lines.join('\n').slice(0, 4000) || 'All caught up! 🎉')],
                ephemeral: true
            });
        }

        const value = interaction.options.getString('team');
        const team = state.teams[value] || A.findTeamByName(state, value);
        if (!team) return interaction.reply({ embeds: [embeds.error('Team not found.')], ephemeral: true });

        const scores = Object.fromEntries(judging.criteria.map(c => [c, interaction.options.getInteger(c)]));
        const feedback = interaction.options.getString('feedback');
        A.scoreTeam(state, { teamId: team.id, judgeId: interaction.user.id, scores, feedback });
        db.save();

        const total = Object.values(scores).reduce((a, b) => a + b, 0);
        await interaction.reply({
            embeds: [embeds.success(`Scored **${team.name}**: **${total}/40**\n${judging.criteria.map(c => `${c}: \`${scores[c]}\``).join(' · ')}`)],
            ephemeral: true
        });

        if (feedback) {
            const dm = embeds.base().setTitle(`📝 Judge feedback • ${team.submission.title}`).setDescription(feedback);
            for (const id of team.members) {
                await interaction.client.users.send(id, { embeds: [dm] }).catch(() => {});
            }
        }
    }
};
