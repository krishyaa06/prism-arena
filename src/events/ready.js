const { Events, ActivityType } = require('discord.js');
const log = require('../lib/logger');
const scheduler = require('../lib/scheduler');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        log.ok(`Logged in as ${client.user.tag} • ${client.guilds.cache.size} servers`);
        client.user.setActivity('hackathons 🏆 /help', { type: ActivityType.Watching });
        scheduler.start(client);
        log.info('Event scheduler running');
    }
};
