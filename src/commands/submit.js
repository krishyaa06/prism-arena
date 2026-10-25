const { SlashCommandBuilder } = require('discord.js');
const db = require('../lib/db');
const embeds = require('../lib/embeds');
const A = require('../lib/arena');
const { announceChannel } = require('../lib/announce');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('submit')
        .setDescription('Submit (or update) your team’s project')
        .addStringOption(o => o.setName('title').setDescription('Project name').setRequired(true).setMaxLength(80))
        .addStringOption(o => o.setName('repo').setDescription('GitHub / source code URL').setRequired(true))
        .addStringOption(o => o.setName('description').setDescription('What does it do? (1–3 sentences)').setRequired(true).setMaxLength(1000))
        .addStringOption(o => o.setName('demo').setDescription('Live demo or video URL')),

    async execute(interaction) {
        const state = db.guild(interaction.guild.id);
        const status = A.eventStatus(state.event);
        if (status !== 'live') {
            const why = { none: 'There is no event.', upcoming: 'The event has not started yet.', judging: 'Submissions are closed.', ended: 'The event has ended.' }[status];
            return interaction.reply({ embeds: [embeds.error(why)], ephemeral: true });
        }

        const { team, isUpdate } = A.submitProject(state, {
            userId: interaction.user.id,
            title: interaction.options.getString('title'),
            repo: interaction.options.getString('repo'),
            demo: interaction.options.getString('demo'),
            description: interaction.options.getString('description')
        });
        db.save();

        const s = team.submission;
        const card = embeds.base()
            .setAuthor({ name: `${team.name} ${isUpdate ? 'updated their' : 'submitted a'} project`, iconURL: interaction.user.displayAvatarURL() })
            .setTitle(`📦 ${s.title}`)
            .setURL(s.repo)
            .setDescription(s.description)
            .addFields(
                { name: 'Source', value: s.repo, inline: false },
                ...(s.demo ? [{ name: 'Demo', value: s.demo, inline: false }] : []),
                { name: 'Team', value: team.members.map(id => `<@${id}>`).join(' ') }
            );

        await interaction.reply({ embeds: [card] });
        const channel = announceChannel(interaction.guild, state);
        if (channel && channel.id !== interaction.channelId && !isUpdate) await channel.send({ embeds: [card] }).catch(() => {});
    }
};
