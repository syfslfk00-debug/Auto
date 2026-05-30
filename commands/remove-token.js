const { SlashCommandBuilder } = require('@discordjs/builders');
const { na3san } = require('../config.json');
const tokenService = require('../services/tokenService');
const engineRuntime = require('../services/engineRuntime');

module.exports = {
  category: 'إدارة الحسابات',
  aliases: ['remove-token'],
  data: new SlashCommandBuilder()
    .setName('حذف-حساب')
    .setDescription('حذف حساب محفوظ')
    .addStringOption(option =>
      option.setName('الاسم')
        .setDescription('اسم الحساب المراد حذفه')
        .setRequired(true)
    ),
  async execute(interaction) {
    if (!na3san.includes(interaction.user.id)) {
      return interaction.reply({ content: 'ليست لديك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }

    try {
      const name = interaction.options.getString('الاسم') || interaction.options.getString('name');
      const token = await tokenService.getToken(name);
      if (!token) return interaction.reply({ content: 'لم يتم العثور على الحساب.', ephemeral: true });

      await engineRuntime.stopTokenEverywhere(token.token);
      await tokenService.removeToken(name);
      await interaction.reply('تم حذف الحساب بنجاح.');
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'حدث خطأ أثناء استخدام الأمر.', ephemeral: true });
    }
  },
};
