const { SlashCommandBuilder } = require('discord.js');
const db = require('../lib/db');
const embeds = require('../lib/embeds');
const { leaderboardEmbed } = require('../lib/announce');

module.exports = {
    data: new SlashCommandBuilder().setName('leaderboard').setDescription('Live hackathon leaderboard'),
    async execute(interaction) {
        const state = db.guild(interaction.guild.id);
        if (!state.event) return interaction.reply({ embeds: [embeds.info('No event yet.')] });
        await interaction.reply({ embeds: [leaderboardEmbed(state, `📊 ${state.event.name} • Leaderboard`)] });
    }
};
