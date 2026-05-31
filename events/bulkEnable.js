const { MessageActionRow } = require('discord.js');
const { na3san } = require('../config.json');
const tokenService = require('../services/tokenService');
const engineRuntime = require('../services/engineRuntime');
const eventBus = require('../services/eventBus');
const { getEngines } = require('../services/engineRegistry');
const { statusEmbed, button } = require('../utils/ui');
const bulkEnableCommand = require('../commands/bulk-enable');

const pending = new Map();
function pendingId() { return `enable-${Date.now()}-${Math.floor(Math.random() * 10000)}`; }
function row(id) { return new MessageActionRow().addComponents(button(`bulk-enable-confirm:${id}`, 'تأكيد', 'SUCCESS', '✅'), button(`bulk-enable-cancel:${id}`, 'إلغاء', 'SECONDARY')); }
async function enableTokens(engineId, tokens) {
  let count = 0;
  for (const token of tokens) {
    await tokenService.enableEngine(token, engineId);
    await engineRuntime.startEngineToken(engineId, token);
    count += 1;
  }
  return count;
}
async function enableEngine(engineId) {
  const accounts = await bulkEnableCommand.disabledAccountsForEngine(engineId);
  return enableTokens(engineId, accounts.map(account => account.token));
}
async function enableAll() {
  let count = 0;
  for (const engine of getEngines()) count += await enableEngine(engine.id);
  return count;
}
module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!((interaction.isSelectMenu && interaction.isSelectMenu()) || (interaction.isButton && interaction.isButton()) || (interaction.isModalSubmit && interaction.isModalSubmit()))) return;
    if (interaction.customId && interaction.customId.startsWith('bulk-enable-select:')) {
      if (!na3san.includes(interaction.user.id)) return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['هذه القائمة للمشرفين فقط.'])], ephemeral: true });
      const engineId = interaction.customId.split(':')[1];
      const id = pendingId();
      pending.set(id, { engineId, tokens: interaction.values, userId: interaction.user.id });
      return interaction.update({ embeds: [statusEmbed('warning', 'تأكيد تفعيل الحسابات', [`المحرك: **${engineId}**`, `عدد الحسابات المحددة: **${interaction.values.length}**`, 'اضغط تأكيد لتفعيلها وتشغيلها ضمن هذا المحرك.'])], components: [row(id)] });
    }
    if (interaction.customId && interaction.customId.startsWith('bulk-enable-engine:')) {
      if (!na3san.includes(interaction.user.id)) return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['هذا الزر للمشرفين فقط.'])], ephemeral: true });
      const [, engineId, action] = interaction.customId.split(':');
      if (action === 'cancel') return interaction.update({ embeds: [statusEmbed('info', 'تم الإلغاء', ['لم يتم تغيير أي حساب.'])], components: [] });
      const count = await enableEngine(engineId);
      await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId, result: 'bulk_engine_enabled', message: 'تم تفعيل محرك بالكامل.', details: { count } });
      return interaction.update({ embeds: [statusEmbed('success', 'تم تفعيل المحرك بالكامل', [`المحرك: **${engineId}**`, `الحسابات المتأثرة: **${count}**`])], components: [] });
    }
    if (interaction.customId && interaction.customId.startsWith('bulk-enable-confirm:')) {
      const id = interaction.customId.split(':')[1];
      const item = pending.get(id);
      if (!item || item.userId !== interaction.user.id) return interaction.reply({ embeds: [statusEmbed('error', 'طلب غير صالح', ['انتهى الطلب أو ليس مخصصًا لك.'])], ephemeral: true });
      const count = await enableTokens(item.engineId, item.tokens);
      pending.delete(id);
      await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId: item.engineId, result: 'bulk_accounts_enabled', message: 'تم تفعيل حسابات متعددة.', details: { count } });
      return interaction.update({ embeds: [statusEmbed('success', 'تم تفعيل الحسابات المختارة', [`المحرك: **${item.engineId}**`, `الحسابات المتأثرة: **${count}**`])], components: [] });
    }
    if (interaction.customId && interaction.customId.startsWith('bulk-enable-cancel:')) { pending.delete(interaction.customId.split(':')[1]); return interaction.update({ embeds: [statusEmbed('info', 'تم الإلغاء', ['لم يتم تغيير أي حساب.'])], components: [] }); }
    if (interaction.customId === 'bulk-enable-all-modal') {
      if (!na3san.includes(interaction.user.id)) return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['هذا النموذج للمشرفين فقط.'])], ephemeral: true });
      const confirm = interaction.fields.getTextInputValue('confirm');
      if (confirm !== 'تأكيد') return interaction.reply({ embeds: [statusEmbed('error', 'تأكيد غير مطابق', ['لم يتم تنفيذ أي تغيير.'])], ephemeral: true });
      const count = await enableAll();
      await eventBus.publish({ type: 'admin_action', level: 'إداري', result: 'bulk_all_enabled', message: 'تم تفعيل كل المحركات للحسابات المعطلة.', details: { count } });
      return interaction.reply({ embeds: [statusEmbed('success', 'تم تفعيل كل المحركات', [`إجمالي عمليات التفعيل: **${count}**`])], ephemeral: true });
    }
  },
};
