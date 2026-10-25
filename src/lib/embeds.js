const { EmbedBuilder } = require('discord.js');
const { colors } = require('../config');

const FOOTER = { text: 'Prism Arena • Build. Create. Compete.' };
const base = (color = colors.brand) => new EmbedBuilder().setColor(color).setFooter(FOOTER).setTimestamp();

module.exports = {
    base,
    success: d => base(colors.success).setDescription(`✅ ${d}`),
    error: d => base(colors.danger).setDescription(`❌ ${d}`),
    warning: d => base(colors.warning).setDescription(`⚠️ ${d}`),
    info: d => base(colors.info).setDescription(d),
    bar(current, total, size = 14) {
        const ratio = total > 0 ? Math.min(Math.max(current / total, 0), 1) : 0;
        const filled = Math.round(ratio * size);
        return '█'.repeat(filled) + '░'.repeat(size - filled);
    },
    ts: (ms, style = 'R') => `<t:${Math.floor(ms / 1000)}:${style}>`
};
