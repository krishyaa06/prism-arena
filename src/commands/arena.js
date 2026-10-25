const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../lib/db');
const embeds = require('../lib/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('arena')
        .setDescription('Configure Prism Arena (admins)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s.setName('config').setDescription('Set channels and roles')
            .addChannelOption(o => o.setName('announcements').setDescription('Channel for announcements and reminders').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
            .addRoleOption(o => o.setName('judge_role').setDescription('Role allowed to score projects'))
            .addRoleOption(o => o.setName('organizer_role').setDescription('Role allowed to manage events'))
            .addChannelOption(o => o.setName('team_category').setDescription('Category for private team channels (optional)').addChannelTypes(ChannelType.GuildCategory)))
        .addSubcommand(s => s.setName('view').setDescription('Show the current configuration'))
        .addSubcommand(s => s.setName('history').setDescription('Past events and their winners')),

    async execute(interaction) {
        const state = db.guild(interaction.guild.id);
        const sub = interaction.options.getSubcommand();

        if (sub === 'config') {
            const patch = {
                announceChannelId: interaction.options.getChannel('announcements')?.id,
                judgeRoleId: interaction.options.getRole('judge_role')?.id,
                organizerRoleId: interaction.options.getRole('organizer_role')?.id,
                teamCategoryId: interaction.options.getChannel('team_category')?.id
            };
            for (const [k, v] of Object.entries(patch)) if (v) state.config[k] = v;
            db.save();
        }

        if (sub === 'history') {
            const lines = state.history.slice(-10).reverse().map(h =>
                `**${h.name}** · ${embeds.ts(h.endedAt, 'D')} · ${h.teams} teams\n` +
                (h.podium.map((p, i) => `${['🥇', '🥈', '🥉'][i]} ${p.team} (${p.score.toFixed(1)})`).join('  ') || 'No winners')
            );
            return interaction.reply({ embeds: [embeds.base().setTitle('📜 Hall of Fame').setDescription(lines.join('\n\n') || 'No past events yet.')] });
        }

        const c = state.config;
        const show = (id, kind) => (id ? (kind === 'role' ? `<@&${id}>` : `<#${id}>`) : '`not set`');
        await interaction.reply({
            embeds: [embeds.base().setTitle(sub === 'config' ? '⚙️ Configuration saved' : '⚙️ Arena configuration').addFields(
                { name: '📢 Announcements', value: show(c.announceChannelId), inline: true },
                { name: '🧑‍⚖️ Judges', value: show(c.judgeRoleId, 'role'), inline: true },
                { name: '🛠️ Organizers', value: show(c.organizerRoleId, 'role'), inline: true },
                { name: '🗂️ Team channels', value: show(c.teamCategoryId), inline: true }
            )],
            ephemeral: true
        });
    }
};
