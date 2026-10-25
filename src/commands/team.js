const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../lib/db');
const embeds = require('../lib/embeds');
const A = require('../lib/arena');

function requireOpenEvent(state) {
    const status = A.eventStatus(state.event);
    if (status === 'none' || status === 'ended') throw new A.ArenaError('There is no active event right now.');
    if (status === 'judging') throw new A.ArenaError('The event is in judging. Teams are locked.');
}

function teamEmbed(team, event) {
    return embeds.base()
        .setTitle(`👥 ${team.name}`)
        .addFields(
            { name: 'Leader', value: `<@${team.leaderId}>`, inline: true },
            { name: 'Members', value: `${team.members.length}/${event.maxTeamSize}`, inline: true },
            { name: 'Submitted', value: team.submission ? '✅ Yes' : '⏳ Not yet', inline: true },
            { name: 'Roster', value: team.members.map(id => `<@${id}>`).join('\n') }
        );
}

/** Optional private team channel inside the configured category. */
async function syncTeamChannel(guild, state, team) {
    const categoryId = state.config.teamCategoryId;
    if (!categoryId) return;
    const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] },
        ...team.members.map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
    ];
    if (state.config.judgeRoleId) overwrites.push({ id: state.config.judgeRoleId, allow: [PermissionFlagsBits.ViewChannel] });

    const existing = team.channelId && guild.channels.cache.get(team.channelId);
    if (existing) return existing.permissionOverwrites.set(overwrites).catch(() => {});
    const channel = await guild.channels.create({
        name: `team-${team.name}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 90),
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: overwrites
    }).catch(() => null);
    if (channel) {
        team.channelId = channel.id;
        await channel.send({ embeds: [embeds.info(`Welcome, **${team.name}**! This is your private team HQ. 🚀`)] }).catch(() => {});
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('team')
        .setDescription('Create, join and manage your hackathon team')
        .addSubcommand(s => s.setName('create').setDescription('Create a team and get an invite code')
            .addStringOption(o => o.setName('name').setDescription('Team name').setRequired(true).setMinLength(2).setMaxLength(32)))
        .addSubcommand(s => s.setName('join').setDescription('Join a team with its invite code')
            .addStringOption(o => o.setName('code').setDescription('6-character code').setRequired(true).setMinLength(6).setMaxLength(6)))
        .addSubcommand(s => s.setName('leave').setDescription('Leave your team'))
        .addSubcommand(s => s.setName('info').setDescription('Show a team')
            .addStringOption(o => o.setName('name').setDescription('Team name (default: yours)').setAutocomplete(true)))
        .addSubcommand(s => s.setName('list').setDescription('List every team')),

    async autocomplete(interaction) {
        const state = db.guild(interaction.guild.id);
        const q = interaction.options.getFocused().toLowerCase();
        await interaction.respond(
            Object.values(state.teams).filter(t => t.name.toLowerCase().includes(q)).slice(0, 25).map(t => ({ name: t.name, value: t.name }))
        );
    },

    async execute(interaction) {
        const state = db.guild(interaction.guild.id);
        const sub = interaction.options.getSubcommand();
        const uid = interaction.user.id;

        if (sub === 'create') {
            requireOpenEvent(state);
            const team = A.createTeam(state, { name: interaction.options.getString('name'), leaderId: uid });
            await syncTeamChannel(interaction.guild, state, team);
            db.save();
            await interaction.reply({
                embeds: [teamEmbed(team, state.event).setDescription(`🎉 Team created! Share this invite code with your teammates:\n# \`${team.code}\`\nThey can join with \`/team join code:${team.code}\``)],
                ephemeral: true
            });
            return interaction.channel.send({ embeds: [embeds.info(`🆕 **${team.name}** entered the arena, led by ${interaction.user}!`)] }).catch(() => {});
        }

        if (sub === 'join') {
            requireOpenEvent(state);
            const team = A.joinTeam(state, { code: interaction.options.getString('code'), userId: uid });
            await syncTeamChannel(interaction.guild, state, team);
            db.save();
            return interaction.reply({ embeds: [embeds.success(`${interaction.user} joined **${team.name}** (${team.members.length}/${state.event.maxTeamSize}).`)] });
        }

        if (sub === 'leave') {
            requireOpenEvent(state);
            const { team, disbanded } = A.leaveTeam(state, uid);
            if (disbanded && team.channelId) await interaction.guild.channels.cache.get(team.channelId)?.delete('Team disbanded').catch(() => {});
            else await syncTeamChannel(interaction.guild, state, team);
            db.save();
            return interaction.reply({ embeds: [embeds.success(disbanded ? `You left and **${team.name}** was disbanded.` : `You left **${team.name}**. New leader: <@${team.leaderId}>.`)], ephemeral: true });
        }

        if (!state.event) return interaction.reply({ embeds: [embeds.info('No event yet.')], ephemeral: true });

        if (sub === 'info') {
            const name = interaction.options.getString('name');
            const team = name ? A.findTeamByName(state, name) : A.findTeamOf(state, uid);
            if (!team) return interaction.reply({ embeds: [embeds.error(name ? 'Team not found.' : 'You are not in a team.')], ephemeral: true });
            const embed = teamEmbed(team, state.event);
            if (team.submission) embed.addFields({ name: '📦 Project', value: `[${team.submission.title}](${team.submission.repo})${team.submission.demo ? ` · [Demo](${team.submission.demo})` : ''}` });
            if (team.members.includes(uid)) embed.addFields({ name: '🔑 Invite code', value: `\`${team.code}\`` });
            return interaction.reply({ embeds: [embed], ephemeral: team.members.includes(uid) });
        }

        // list
        const teams = Object.values(state.teams).sort((a, b) => a.createdAt - b.createdAt);
        const lines = teams.map((t, i) => `\`${String(i + 1).padStart(2, '0')}\` **${t.name}** · ${t.members.length}/${state.event.maxTeamSize} ${t.submission ? '✅' : '⏳'}`);
        return interaction.reply({
            embeds: [embeds.base().setTitle(`👥 Teams • ${state.event.name}`).setDescription(lines.join('\n').slice(0, 4000) || 'No teams yet. Be the first with `/team create`!')]
        });
    }
};
