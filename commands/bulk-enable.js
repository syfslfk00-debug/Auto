const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageSelectMenu, Modal, TextInputComponent } = require('discord.js');
const { na3san } = require('../config.json');
const { getEngines } = require('../services/engineRegistry');
const tokenService = require('../services/tokenService');
const { statusEmbed, button } = require('../utils/ui');

function engineOption(required = true) {
  return option => getEngines().slice(0, 25).reduce((o, e) => o.addChoices({ name: `${e.displayName} (${e.id})`, value: e.id }), option.setName('المحرك').setDescription('اختر المحرك').setRequired(required));
}
function accountId(account) { return String(account._id || account.name || 'unknown'); }
function confirmRow(id) {
  return new MessageActionRow().addComponents(
    button(`${id}:confirm`, 'تأكيد التفعيل', 'SUCCESS', '✅'),
    button(`${id}:cancel`, 'إلغاء', 'SECONDARY')
  );
}
async function disabledAccountsForEngine(engineId) {
  const accounts = await tokenService.getAllTokens();
  return accounts.filter(account => !(account.engines && account.engines[engineId]));
}
module.exports = {
  category: 'تفعيل جماعي',
  data: new SlashCommandBuilder()
    .setName('تفعيل-حسابات')
    .setDescription('تفعيل عدة حسابات أو محرك كامل أو كل المحركات بأمان')
    .addSubcommand(sc => sc.setName('حسب-المحرك').setDescription('اختيار عدة حسابات معطلة في محرك وتفعيلها').addStringOption(engineOption(true)))
    .addSubcommand(sc => sc.setName('المحرك-بالكامل').setDescription('تفعيل جميع حسابات محرك معطلة بعد تأكيد').addStringOption(engineOption(true)))
    .addSubcommand(sc => sc.setName('الكل').setDescription('تفعيل كل الحسابات المعطلة في كل المحركات بتأكيد مشدد')),
  async execute(interaction) {
    if (!na3san.includes(interaction.user.id)) return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['هذا الأمر للمشرفين فقط.'])], ephemeral: true });
    const sub = interaction.options.getSubcommand();
    if (sub === 'حسب-المحرك') {
      const engineId = interaction.options.getString('المحرك');
      const accounts = (await disabledAccountsForEngine(engineId)).slice(0, 25);
      if (accounts.length === 0) return interaction.reply({ embeds: [statusEmbed('info', 'لا توجد حسابات معطلة', ['كل حسابات هذا المحرك مفعلة بالفعل أو لا توجد حسابات محفوظة.'])], ephemeral: true });
      const menu = new MessageSelectMenu()
        .setCustomId(`bulk-enable-select:${engineId}`)
        .setPlaceholder('اختر الحسابات المطلوب تفعيلها')
        .setMinValues(1)
        .setMaxValues(accounts.length)
        .addOptions(accounts.map(account => ({ label: account.name.slice(0, 100), value: account.token, description: `ID: ${accountId(account).slice(0, 95)}` })));
      return interaction.reply({ embeds: [statusEmbed('info', 'تفعيل حسابات حسب المحرك', [`المحرك: **${engineId}**`, 'اختر حسابًا واحدًا أو أكثر من القائمة، ثم أكد العملية.'])], components: [new MessageActionRow().addComponents(menu)], ephemeral: true });
    }
    if (sub === 'المحرك-بالكامل') {
      const engineId = interaction.options.getString('المحرك');
      const count = (await disabledAccountsForEngine(engineId)).length;
      return interaction.reply({ embeds: [statusEmbed('warning', 'تأكيد تفعيل محرك بالكامل', [`المحرك: **${engineId}**`, `الحسابات المعطلة التي سيتم تفعيلها: **${count}**`, 'لن يتم إنشاء حسابات جديدة؛ سيتم تفعيل المحرك للحسابات الموجودة فقط.'])], components: [confirmRow(`bulk-enable-engine:${engineId}`)], ephemeral: true });
    }
    const modal = new Modal().setCustomId('bulk-enable-all-modal').setTitle('تأكيد تفعيل كل المحركات');
    const input = new TextInputComponent().setCustomId('confirm').setLabel('اكتب: تأكيد').setStyle('SHORT').setRequired(true);
    modal.addComponents(new MessageActionRow().addComponents(input));
    return interaction.showModal(modal);
  },
  disabledAccountsForEngine,
};
