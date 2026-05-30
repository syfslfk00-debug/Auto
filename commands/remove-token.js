const { SlashCommandBuilder } = require('@discordjs/builders');
const { na3san } = require('../config.json');
const { QuantumDB } = require('qd.db');
const aTokens = new QuantumDB('tokens.json');
const rTokens = new QuantumDB('replka-tokens.json');
const kTokens = new QuantumDB('karasi-tokens.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('remove-token')
		.setDescription('Remove account token')
	  .addStringOption(option => 
      option.setName('name')
        .setDescription('Put the token name')
				.setRequired(true)
			),
	async execute(interaction) {
		 if (!na3san.includes(interaction.user.id)) return interaction.reply({ content: 'You are not allowed to use this command!', ephemeral: true });
        try {
      const name = interaction.options.getString('name');
			const token = await aTokens.get(name);
			await aTokens.delete(name);
			await rTokens.pull("tokens", token);
			await kTokens.pull("tokens", token);
			await interaction.reply('The token has been removed successfully!');
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'An error occurred while using the command.', ephemeral: true });
    }
	},
};