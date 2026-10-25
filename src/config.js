require('dotenv').config();

const color = parseInt((process.env.EMBED_COLOR || '00FFAA').replace('#', ''), 16);

module.exports = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID || null,
    colors: {
        brand: Number.isNaN(color) ? 0x00ffaa : color,
        success: 0x00ffaa,
        warning: 0xffb020,
        danger: 0xff3366,
        info: 0x00d2ff,
        gold: 0xffd166
    },
    judging: {
        criteria: ['innovation', 'execution', 'design', 'impact'],
        min: 1,
        max: 10
    },
    challenge: {
        basePoints: 10,
        firstBlood: 5 // bonus for the first correct answer
    },
    schedulerMs: 60_000
};
