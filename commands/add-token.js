const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, Modal, TextInputComponent } = require('discord.js');
const { na3san } = require('../config.json');

module.exports = {
  aliases: ['add-token'],
  data: new SlashCommandBuilder()
    .setName('اضافة-حساب')
    .setDescription('إضافة حساب جديد'),
  async execute(interaction) {
    if (!na3san.includes(interaction.user.id)) {
      return interaction.reply({ content: 'ليست لديك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }

    try {
      const modal = new Modal()
        .setCustomId('add-token-modal')
        .setTitle('إضافة حساب');

      const tokenForm = new TextInputComponent()
        .setCustomId('token')
        .setLabel('أدخل رمز الحساب')
        .setStyle('SHORT')
        .setRequired(true);

      const nameForm = new TextInputComponent()
        .setCustomId('name')
        .setLabel('أدخل اسم الحساب')
        .setStyle('SHORT')
        .setRequired(true);

      const row = new MessageActionRow().addComponents(tokenForm);
      const row2 = new MessageActionRow().addComponents(nameForm);
      modal.addComponents(row, row2);

      await interaction.showModal(modal);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'حدث خطأ أثناء استخدام الأمر.', ephemeral: true });
    }
  },
};
