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
        await interaction.reply({ content: 'Done! You can use your bot now.', embeds: [] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'An error occurred while using the command.', ephemeral: true });
      }
    }
  },
};
