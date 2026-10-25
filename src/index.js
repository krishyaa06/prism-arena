const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const log = require('./lib/logger');
const { loadCommands, loadEvents } = require('./lib/loader');
const pkg = require('../package.json');

if (!config.token) {
    log.error('DISCORD_TOKEN is missing. Copy .env.example to .env and fill it in.');
    process.exit(1);
}

log.banner('Prism Arena', pkg.version);

// Only the Guilds intent is needed: everything runs on slash commands.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = loadCommands();
log.info(`Loaded ${client.commands.size} commands`);
loadEvents(client);

process.on('unhandledRejection', err => log.error('Unhandled rejection:', err));

client.login(config.token);
