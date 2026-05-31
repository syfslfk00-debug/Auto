const { SlashCommandBuilder } = require('@discordjs/builders');
const { na3san } = require('../config.json');
const tokenService = require('../services/tokenService');
const engineRuntime = require('../services/engineRuntime');
const eventBus = require('../services/eventBus');
const { statusEmbed } = require('../utils/ui');

module.exports = {
  category: 'إدارة الحسابات',
  aliases: ['remove-token'],
  data: new SlashCommandBuilder()
    .setName('حذف-حساب')
    .setDescription('حذف حساب محفوظ بعد إيقافه من كل المحركات')
    .addStringOption(option => option.setName('الاسم').setDescription('اختر الحساب من قاعدة البيانات').setRequired(true).setAutocomplete(true)),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const accounts = await tokenService.getAllTokens();
    await interaction.respond(accounts.filter(a => a.name.toLowerCase().includes(focused)).slice(0, 25).map(a => ({ name: a.name, value: a.name })));
  },
  async execute(interaction) {
    if (!na3san.includes(interaction.user.id)) return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['ليست لديك صلاحية حذف الحسابات.'])], ephemeral: true });
    try {
      const name = interaction.options.getString('الاسم');
      const account = await tokenService.getToken(name);
      if (!account) return interaction.reply({ embeds: [statusEmbed('error', 'الحساب غير موجود', ['استخدم الإكمال التلقائي لاختيار حساب محفوظ.'])], ephemeral: true });
      await engineRuntime.stopTokenEverywhere(account.token);
      await tokenService.removeToken(name);
      await eventBus.publish({ type: 'admin_action', level: 'إداري', accountName: account.name, result: 'account_deleted', message: 'تم حذف حساب من ديسكورد.' });
      return interaction.reply({ embeds: [statusEmbed('warning', 'تم حذف الحساب', [`الحساب: **${account.name}**`, 'تم إيقافه من كل المحركات قبل الحذف.', 'لن تُعرض أي بيانات حساسة.'])], ephemeral: true });
    } catch (error) {
      console.error(error);
      return interaction.reply({ embeds: [statusEmbed('error', 'فشل حذف الحساب', [error.message])], ephemeral: true });
    }
  },
};
