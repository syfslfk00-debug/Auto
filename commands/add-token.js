const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, Modal, TextInputComponent } = require('discord.js');
const { na3san } = require('../config.json');
const { statusEmbed } = require('../utils/ui');

module.exports = {
  category: 'إدارة الحسابات',
  aliases: ['add-token'],
  data: new SlashCommandBuilder()
    .setName('اضافة-حساب')
    .setDescription('فتح نموذج آمن لإضافة حساب جديد'),
  async execute(interaction) {
    if (!na3san.includes(interaction.user.id)) return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['إضافة الحسابات متاحة للمشرفين فقط.'])], ephemeral: true });
    const modal = new Modal().setCustomId('add-token-modal').setTitle('إضافة حساب إلى مركز التحكم');
    const nameForm = new TextInputComponent().setCustomId('name').setLabel('اسم الحساب داخل لوحة الإدارة').setStyle('SHORT').setPlaceholder('مثال: main-account').setRequired(true);
    const tokenForm = new TextInputComponent().setCustomId('token').setLabel('توكن الحساب (لن يظهر في أي رد)').setStyle('SHORT').setRequired(true);
    modal.addComponents(new MessageActionRow().addComponents(nameForm), new MessageActionRow().addComponents(tokenForm));
    return interaction.showModal(modal);
  },
};
