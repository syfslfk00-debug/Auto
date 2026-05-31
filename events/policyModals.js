const { na3san } = require('../config.json');
const policyCommand = require('../commands/game-policy');
const eventBus = require('../services/eventBus');
const { statusEmbed } = require('../utils/ui');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isModalSubmit() || !interaction.customId.startsWith('policy-modal:')) return;
    if (!na3san.includes(interaction.user.id)) return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['هذا النموذج للمشرفين فقط.'])], ephemeral: true });
    const [, kind, id] = interaction.customId.split(':');
    const payload = policyCommand.modalPayloads.get(id);
    policyCommand.modalPayloads.delete(id);
    if (!payload) return interaction.reply({ embeds: [statusEmbed('error', 'انتهت صلاحية النموذج', ['افتح الأمر مرة أخرى ثم أرسل القائمة.'])], ephemeral: true });
    const ids = policyCommand.idsFromText(interaction.fields.getTextInputValue('ids'));
    try {
      if (kind === 'servers') {
        const next = await policyCommand.applyServerChange({ ...payload, ids });
        await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId: payload.engineId, accountName: payload.accountName, result: 'allowed_servers_changed', message: 'تم تعديل السيرفرات المسموحة عبر Modal.' });
        return interaction.reply({ embeds: [statusEmbed('success', 'تم تحديث السيرفرات', next.length ? next.map(id => `• \`${id}\``) : ['لا توجد سيرفرات محفوظة.'])], ephemeral: true });
      }
      if (kind === 'bots') {
        const next = await policyCommand.applyBotChange({ ...payload, ids });
        await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId: payload.engineId, result: 'allowed_bots_changed', message: 'تم تعديل بوتات اللعبة عبر Modal.' });
        return interaction.reply({ embeds: [statusEmbed('success', 'تم تحديث بوتات اللعبة', next.length ? next.map(id => `• \`${id}\``) : ['لا توجد بوتات محفوظة.'])], ephemeral: true });
      }
    } catch (error) {
      console.error(error);
      return interaction.reply({ embeds: [statusEmbed('error', 'فشل تحديث السياسة', [error.message])], ephemeral: true });
    }
  },
};
