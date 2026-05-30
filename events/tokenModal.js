const tokenService = require('../services/tokenService');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId.startsWith('add-token-modal')) {
      try {
        const token = interaction.fields.getTextInputValue('token');
        const name = interaction.fields.getTextInputValue('name');
        await tokenService.addToken(name, token);
        await interaction.reply({ content: 'تم حفظ الحساب بنجاح، ويمكنك التحكم بمحركاته من لوحة التحكم.', embeds: [], ephemeral: true });
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'حدث خطأ أثناء استخدام الأمر.', ephemeral: true });
      }
    }
  },
};
