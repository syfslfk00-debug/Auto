const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const { na3san } = require('../config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('panel')
		.setDescription('Tokens control panel'),
	async execute(interaction) {
	 if (!na3san.includes(interaction.user.id)) return interaction.reply({ content: 'You are not allowed to use this command!', ephemeral: true });
		const embed = new MessageEmbed()
		  .setDescription('Choose action')
		const replkaS = new MessageButton()
		  .setCustomId('replkaS')
		  .setLabel('Replka On')
		  .setStyle('SUCCESS')
		const replkaO = new MessageButton()
		  .setCustomId('replkaO')
		  .setLabel('Replka Off')
		  .setStyle('DANGER')
			const karasiS = new MessageButton()
		  .setCustomId('karasiS')
		  .setLabel('Karasi On')
		  .setStyle('SUCCESS')
		const karasiO = new MessageButton()
		  .setCustomId('karasiO')
		  .setLabel('Karasi Off')
		  .setStyle('DANGER')
		const row = new MessageActionRow()
		  .addComponents(replkaS, replkaO, karasiS, karasiO)
		  await interaction.channel.send({ embeds: [embed], components: [row] });
		  await interaction.reply({ content: 'Done!', ephemeral: true});
	},
};