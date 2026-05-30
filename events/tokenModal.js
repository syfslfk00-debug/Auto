const { QuantumDB } = require('qd.db');
const db = new QuantumDB('tokens.json');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
      if (!interaction.isModalSubmit()) return;
      if (interaction.customId.startsWith('add-token-modal')) {
        try {
      const token = interaction.fields.getTextInputValue('token');
      const name = interaction.fields.getTextInputValue('name');
        await db.set(name, token);
        await interaction.reply({ content: 'Done! You can use your bot now.', embeds: [] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'An error occurred while using the command.', ephemeral: true });
      }
    }
  },
};