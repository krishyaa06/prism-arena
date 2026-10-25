const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../lib/embeds');

module.exports = {
    data: new SlashCommandBuilder().setName('help').setDescription('How Prism Arena works'),
    async execute(interaction, client) {
        await interaction.reply({
            embeds: [embeds.base()
                .setTitle('⚔️ Prism Arena • Hackathon HQ')
                .setDescription('Run hackathons and coding challenges right inside Discord.\n[Join Prism Protocol](https://dc.gg/prismprotocol)')
                .setThumbnail(client.user.displayAvatarURL())
                .addFields(
                    { name: '🧑‍💻 Hackers', value: '`/event info` · `/team create` · `/team join` · `/team info` · `/team list` · `/submit` · `/leaderboard`' },
                    { name: '🧑‍⚖️ Judges', value: '`/judge queue` · `/judge score`' },
                    { name: '🛠️ Organizers', value: '`/event create` · `/event extend` · `/event end` · `/challenge post`' },
                    { name: '🧠 Challenges', value: '`/challenge points`: click **Submit answer** on any challenge to earn points' },
                    { name: '⚙️ Admins', value: '`/arena config` · `/arena view` · `/arena history`' }
                )]
        });
    }
};
