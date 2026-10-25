const {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const db = require('../lib/db');
const embeds = require('../lib/embeds');
const bank = require('../lib/challenges');
const { normalise } = require('../lib/arena');
const { isOrganizer } = require('../lib/perms');
const { challenge: cfg, colors } = require('../config');

const LEVEL_COLOR = { Easy: colors.success, Medium: colors.warning, Hard: colors.danger };
const LEVEL_POINTS = { Easy: 1, Medium: 2, Hard: 3 };

function card(ch, solvers = []) {
    return embeds.base(LEVEL_COLOR[ch.level])
        .setTitle(`⚔️ Coding Challenge • ${ch.level}`)
        .setDescription(ch.question)
        .addFields(
            { name: 'Topic', value: ch.lang, inline: true },
            { name: 'Reward', value: `${cfg.basePoints * LEVEL_POINTS[ch.level]} pts (+${cfg.firstBlood} first solve)`, inline: true },
            { name: `Solved by (${solvers.length})`, value: solvers.slice(0, 15).map(id => `<@${id}>`).join(' ') || 'No one yet. Be the first! 🩸' }
        );
}

const answerRow = () => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('challenge:answer').setLabel('Submit answer').setEmoji('🧠').setStyle(ButtonStyle.Success)
);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('challenge')
        .setDescription('Coding challenges')
        .addSubcommand(s => s.setName('post').setDescription('Post a challenge (organizers)')
            .addStringOption(o => o.setName('level').setDescription('Difficulty (default: random)')
                .addChoices({ name: 'Easy', value: 'Easy' }, { name: 'Medium', value: 'Medium' }, { name: 'Hard', value: 'Hard' })))
        .addSubcommand(s => s.setName('points').setDescription('Challenge points leaderboard')),

    async execute(interaction) {
        const state = db.guild(interaction.guild.id);

        if (interaction.options.getSubcommand() === 'points') {
            const top = Object.entries(state.points).sort((a, b) => b[1] - a[1]).slice(0, 10);
            const medals = ['🥇', '🥈', '🥉'];
            const lines = top.map(([id, pts], i) => `${medals[i] ?? `\`#${i + 1}\``} <@${id}> · **${pts}** pts`);
            return interaction.reply({ embeds: [embeds.base(colors.gold).setTitle('🧠 Challenge Points').setDescription(lines.join('\n') || 'No points yet. Solve a `/challenge`!')] });
        }

        if (!isOrganizer(interaction, state)) {
            return interaction.reply({ embeds: [embeds.error('Only organizers can post challenges.')], ephemeral: true });
        }
        const level = interaction.options.getString('level');
        const usedIds = new Set(Object.values(state.challenges).map(c => c.challengeId));
        let pool = bank.filter(c => !level || c.level === level);
        const unused = pool.filter(c => !usedIds.has(c.id));
        if (unused.length) pool = unused; // avoid repeats until the bank is exhausted
        const ch = pool[Math.floor(Math.random() * pool.length)];

        const message = await interaction.reply({ embeds: [card(ch)], components: [answerRow()], fetchReply: true });
        state.challenges[message.id] = { challengeId: ch.id, solvers: [], attempts: {}, postedAt: Date.now() };
        db.save();
    },

    async handleComponent(interaction) {
        const state = db.guild(interaction.guild.id);

        if (interaction.isButton()) {
            const entry = state.challenges[interaction.message.id];
            if (!entry) return interaction.reply({ embeds: [embeds.warning('This challenge is no longer active.')], ephemeral: true });
            if (entry.solvers.includes(interaction.user.id)) {
                return interaction.reply({ embeds: [embeds.info('You already solved this one. 😎')], ephemeral: true });
            }
            const modal = new ModalBuilder()
                .setCustomId(`challenge:submit:${interaction.message.id}`)
                .setTitle('Submit your answer')
                .addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('answer').setLabel('Your answer').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
                ));
            return interaction.showModal(modal);
        }

        // Modal submit
        const messageId = interaction.customId.split(':')[2];
        const entry = state.challenges[messageId];
        const ch = entry && bank.find(c => c.id === entry.challengeId);
        if (!ch) return interaction.reply({ embeds: [embeds.warning('This challenge is no longer active.')], ephemeral: true });
        if (entry.solvers.includes(interaction.user.id)) return interaction.reply({ embeds: [embeds.info('Already solved.')], ephemeral: true });

        entry.attempts[interaction.user.id] = (entry.attempts[interaction.user.id] || 0) + 1;
        const correct = ch.answers.includes(normalise(interaction.fields.getTextInputValue('answer')));
        if (!correct) {
            db.save();
            return interaction.reply({ embeds: [embeds.error(`Not quite. Attempt #${entry.attempts[interaction.user.id]}. Try again!`)], ephemeral: true });
        }

        const first = entry.solvers.length === 0;
        const pts = cfg.basePoints * LEVEL_POINTS[ch.level] + (first ? cfg.firstBlood : 0);
        entry.solvers.push(interaction.user.id);
        state.points[interaction.user.id] = (state.points[interaction.user.id] || 0) + pts;
        db.save();

        await interaction.reply({ embeds: [embeds.success(`${first ? '🩸 **First solve!** ' : ''}Correct! **+${pts} pts** (total ${state.points[interaction.user.id]}).`)], ephemeral: true });
        await interaction.message?.edit({ embeds: [card(ch, entry.solvers)] }).catch(() => {});
    }
};
