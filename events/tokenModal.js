const tokenService = require('../services/tokenService');
const eventBus = require('../services/eventBus');
const { statusEmbed } = require('../utils/ui');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('add-token-modal')) return;
    try {
      const token = interaction.fields.getTextInputValue('token');
      const name = interaction.fields.getTextInputValue('name');
      const account = await tokenService.addToken(name, token);
      await eventBus.publish({ type: 'admin_action', level: 'إداري', accountName: account.name, result: 'account_added', message: 'تمت إضافة حساب من ديسكورد.' });
      return interaction.reply({ embeds: [statusEmbed('success', 'تم حفظ الحساب بأمان', [`الحساب: **${account.name}**`, 'لم يتم عرض التوكن في أي مكان.', 'يمكنك الآن تفعيل المحركات من /ادارة أو لوحة العمليات.'])], ephemeral: true });
    } catch (error) {
      console.error(error);
      return interaction.reply({ embeds: [statusEmbed('error', 'فشل حفظ الحساب', [error.message || 'حدث خطأ غير معروف.'])], ephemeral: true });
    }
  },
};
