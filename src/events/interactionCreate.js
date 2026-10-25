const { Events } = require('discord.js');
const embeds = require('../lib/embeds');
const log = require('../lib/logger');

async function reply(interaction, payload) {
    if (interaction.deferred || interaction.replied) return interaction.followUp(payload).catch(() => {});
    return interaction.reply(payload).catch(() => {});
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            // Buttons / modals are routed by customId prefix: "<command>:<action>:..."
            if (interaction.isButton() || interaction.isModalSubmit()) {
                const [commandName] = interaction.customId.split(':');
                const command = client.commands.get(commandName);
                return await command?.handleComponent?.(interaction, client);
            }
            if (interaction.isAutocomplete()) {
                return await client.commands.get(interaction.commandName)?.autocomplete?.(interaction);
            }
            if (!interaction.isChatInputCommand()) return;
            if (!interaction.inGuild()) {
                return reply(interaction, { embeds: [embeds.error('Commands only work inside a server.')], ephemeral: true });
            }
            await client.commands.get(interaction.commandName)?.execute(interaction, client);
        } catch (err) {
            const msg = err?.userFacing ? err.message : 'Something went wrong. Please try again.';
            if (!err?.userFacing) log.error(`Interaction failed (${interaction.commandName || interaction.customId}):`, err);
            await reply(interaction, { embeds: [embeds.error(msg)], ephemeral: true });
        }
    }
};
