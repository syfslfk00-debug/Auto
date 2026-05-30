const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, Modal, TextInputComponent } = require('discord.js');
const { na3san } = require('../config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('add-token')
		.setDescription('Add new account token'),
	async execute(interaction) {
		 if (!na3san.includes(interaction.user.id)) return interaction.reply({ content: 'You are not allowed to use this command!', ephemeral: true });
        try {
    const modal = new Modal()
			.setCustomId('add-token-modal')
			.setTitle('Account Token');
		const tokenForm = new TextInputComponent()
		  .setCustomId('token')
			.setLabel("Push account token here")
			.setStyle('SHORT')
      .setRequired(true);
    const nameForm = new TextInputComponent()
		  .setCustomId('name')
			.setLabel("Push account name here")
			.setStyle('SHORT')
      .setRequired(true);
    const row = new MessageActionRow()
      .addComponents(tokenForm)
		const row2 = new MessageActionRow()
			.addComponents(nameForm)
   modal.addComponents(row, row2);
     await interaction.showModal(modal);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'An error occurred while using the command.', ephemeral: true });
    }
	},
};