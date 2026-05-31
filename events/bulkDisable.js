const { MessageActionRow, MessageButton } = require('discord.js');
const { na3san } = require('../config.json');
const tokenService = require('../services/tokenService');
const engineRuntime = require('../services/engineRuntime');
const eventBus = require('../services/eventBus');
const { getEngines } = require('../services/engineRegistry');
const { statusEmbed } = require('../utils/ui');

const pending = new Map();
function pendingId() { return `bulk-${Date.now()}-${Math.floor(Math.random() * 10000)}`; }
function row(id) { return new MessageActionRow().addComponents(new MessageButton().setCustomId(`bulk-confirm:${id}`).setLabel('تأكيد').setStyle('DANGER'), new MessageButton().setCustomId(`bulk-cancel:${id}`).setLabel('إلغاء').setStyle('SECONDARY')); }
async function disableTokens(engineId, tokens) {
  let count = 0;
  for (const token of tokens) {
    await tokenService.disableEngine(token, engineId);
    await engineRuntime.stopEngineToken(engineId, token);
    count += 1;
  }
  return count;
}
async function disableEngine(engineId) {
  const accounts = await tokenService.getAccountsByEngine(engineId);
  return disableTokens(engineId, accounts.map(a => a.token));
}
async function disableAll() {
  let count = 0;
  for (const engine of getEngines()) count += await disableEngine(engine.id);
  return count;
}
module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!((interaction.isSelectMenu && interaction.isSelectMenu()) || (interaction.isButton && interaction.isButton()) || (interaction.isModalSubmit && interaction.isModalSubmit()))) return;
    if (interaction.customId && interaction.customId.startsWith('bulk-disable-select:')) {
      if (!na3san.includes(interaction.user.id)) return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['هذه القائمة للمشرفين فقط.'])], ephemeral: true });
      const engineId = interaction.customId.split(':')[1];
      const id = pendingId();
      pending.set(id, { type: 'tokens', engineId, tokens: interaction.values, userId: interaction.user.id });
      return interaction.update({ embeds: [statusEmbed('warning', 'تأكيد تعطيل الحسابات', [`المحرك: **${engineId}**`, `عدد الحسابات المحددة: **${interaction.values.length}**`, 'اضغط تأكيد لإيقافها وتعطيلها من هذا المحرك.'])], components: [row(id)] });
    }
    if (interaction.customId && interaction.customId.startsWith('bulk-disable-engine:')) {
      if (!na3san.includes(interaction.user.id)) return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['هذا الزر للمشرفين فقط.'])], ephemeral: true });
      const [, engineId, action] = interaction.customId.split(':');
      if (action === 'cancel') return interaction.update({ embeds: [statusEmbed('info', 'تم الإلغاء', ['لم يتم تغيير أي حساب.'])], components: [] });
      const count = await disableEngine(engineId);
      await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId, result: 'bulk_engine_disabled', message: 'تم تعطيل محرك بالكامل.', details: { count } });
      return interaction.update({ embeds: [statusEmbed('success', 'تم تعطيل المحرك بالكامل', [`المحرك: **${engineId}**`, `الحسابات المتأثرة: **${count}**`])], components: [] });
    }
    if (interaction.customId && interaction.customId.startsWith('bulk-confirm:')) {
      const id = interaction.customId.split(':')[1]; const item = pending.get(id);
      if (!item || item.userId !== interaction.user.id) return interaction.reply({ embeds: [statusEmbed('error', 'طلب غير صالح', ['انتهى الطلب أو ليس مخصصًا لك.'])], ephemeral: true });
      const count = await disableTokens(item.engineId, item.tokens);
      pending.delete(id);
      await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId: item.engineId, result: 'bulk_accounts_disabled', message: 'تم تعطيل حسابات متعددة.', details: { count } });
      return interaction.update({ embeds: [statusEmbed('success', 'تم تعطيل الحسابات المختارة', [`المحرك: **${item.engineId}**`, `الحسابات المتأثرة: **${count}**`])], components: [] });
    }
    if (interaction.customId && interaction.customId.startsWith('bulk-cancel:')) { pending.delete(interaction.customId.split(':')[1]); return interaction.update({ embeds: [statusEmbed('info', 'تم الإلغاء', ['لم يتم تغيير أي حساب.'])], components: [] }); }
    if (interaction.customId === 'bulk-disable-all-modal') {
      if (!na3san.includes(interaction.user.id)) return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['هذا النموذج للمشرفين فقط.'])], ephemeral: true });
      const confirm = interaction.fields.getTextInputValue('confirm');
      if (confirm !== 'تعطيل الكل') return interaction.reply({ embeds: [statusEmbed('error', 'تأكيد غير مطابق', ['لم يتم تنفيذ أي تغيير.'])], ephemeral: true });
      const count = await disableAll();
      await eventBus.publish({ type: 'admin_action', level: 'إداري', result: 'bulk_all_disabled', message: 'تم تعطيل كل المحركات لكل الحسابات.', details: { count } });
      return interaction.reply({ embeds: [statusEmbed('success', 'تم تعطيل كل المحركات', [`إجمالي عمليات التعطيل: **${count}**`])], ephemeral: true });
    }
  },
};
