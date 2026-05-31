const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageSelectMenu, Modal, TextInputComponent } = require('discord.js');
const { na3san } = require('../config.json');
const { getEngines } = require('../services/engineRegistry');
const tokenService = require('../services/tokenService');
const { statusEmbed } = require('../utils/ui');

function engineOption(required = true) {
  return option => getEngines().slice(0, 25).reduce((o, e) => o.addChoices({ name: `${e.displayName} (${e.id})`, value: e.id }), option.setName('المحرك').setDescription('اختر المحرك').setRequired(required));
}
function shortId(token) { return token ? `${token.slice(0, 6)}…${token.slice(-4)}` : 'no-token'; }
function confirmRow(id, danger = true) {
  return new MessageActionRow().addComponents(
    new MessageButton().setCustomId(`${id}:confirm`).setLabel('تأكيد التعطيل').setStyle(danger ? 'DANGER' : 'PRIMARY').setEmoji('⚠️'),
    new MessageButton().setCustomId(`${id}:cancel`).setLabel('إلغاء').setStyle('SECONDARY')
  );
}
module.exports = {
  category: 'تعطيل جماعي',
  data: new SlashCommandBuilder()
    .setName('تعطيل-حسابات')
    .setDescription('تعطيل عدة حسابات أو محرك كامل أو كل المحركات بأمان')
    .addSubcommand(sc => sc.setName('حسب-المحرك').setDescription('اختيار عدة حسابات نشطة في محرك وتعطيلها').addStringOption(engineOption(true)))
    .addSubcommand(sc => sc.setName('المحرك-بالكامل').setDescription('تعطيل جميع حسابات محرك بعد تأكيد').addStringOption(engineOption(true)))
    .addSubcommand(sc => sc.setName('الكل').setDescription('تعطيل كل الحسابات في كل المحركات بتأكيد مشدد')),
  async execute(interaction) {
    if (!na3san.includes(interaction.user.id)) return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['هذا الأمر للمشرفين فقط.'])], ephemeral: true });
    const sub = interaction.options.getSubcommand();
    if (sub === 'حسب-المحرك') {
      const engineId = interaction.options.getString('المحرك');
      const accounts = (await tokenService.getAccountsByEngine(engineId)).slice(0, 25);
      if (accounts.length === 0) return interaction.reply({ embeds: [statusEmbed('warning', 'لا توجد حسابات', ['لا توجد حسابات مفعلة لهذا المحرك.'])], ephemeral: true });
      const menu = new MessageSelectMenu().setCustomId(`bulk-disable-select:${engineId}`).setPlaceholder('اختر الحسابات المطلوب تعطيلها').setMinValues(1).setMaxValues(accounts.length).addOptions(accounts.map(a => ({ label: a.name.slice(0, 100), value: a.token, description: `ID: ${shortId(a.token)}` })));
      return interaction.reply({ embeds: [statusEmbed('info', 'تعطيل حسابات حسب المحرك', [`المحرك: **${engineId}**`, 'اختر حسابًا واحدًا أو أكثر من القائمة، ثم أكد العملية.'])], components: [new MessageActionRow().addComponents(menu)], ephemeral: true });
    }
    if (sub === 'المحرك-بالكامل') {
      const engineId = interaction.options.getString('المحرك');
      const count = (await tokenService.getAccountsByEngine(engineId)).length;
      return interaction.reply({ embeds: [statusEmbed('warning', 'تأكيد تعطيل محرك بالكامل', [`المحرك: **${engineId}**`, `عدد الحسابات المتأثرة: **${count}**`, 'لن يتم حذف الحسابات، سيتم تعطيل المحرك وإيقافه فقط.'])], components: [confirmRow(`bulk-disable-engine:${engineId}`)], ephemeral: true });
    }
    const modal = new Modal().setCustomId('bulk-disable-all-modal').setTitle('تأكيد تعطيل كل المحركات');
    const input = new TextInputComponent().setCustomId('confirm').setLabel('اكتب: تعطيل الكل').setStyle('SHORT').setRequired(true);
    modal.addComponents(new MessageActionRow().addComponents(input));
    return interaction.showModal(modal);
  },
};
