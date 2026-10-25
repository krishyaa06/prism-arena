const { PermissionFlagsBits } = require('discord.js');

const isAdmin = i => i.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

module.exports = {
    isOrganizer: (i, state) => isAdmin(i) || Boolean(state.config.organizerRoleId && i.member.roles.cache.has(state.config.organizerRoleId)),
    isJudge: (i, state) => isAdmin(i) || Boolean(state.config.judgeRoleId && i.member.roles.cache.has(state.config.judgeRoleId))
};
