const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const path = require('path');
const { na3san } = require('../config.json');
const tokenService = require('../services/tokenService');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
     if (!interaction.isButton()) return;
      if (['replkaS', 'replkaO', 'karasiS', 'karasiO'].includes(interaction.customId)) {
       if (!na3san.includes(interaction.user.id)) return interaction.reply({ content: 'You are not allowed to use this button!', ephemeral: true });
        const CI = interaction.customId;
        const tokens = await tokenService.getAllTokensForSelectMenu();
         if (tokens.length === 0) return interaction.reply({ content: 'No tokens found!', ephemeral: true });
        const menuId = `menu-${Math.floor(Math.random() * 9000000) + 1000000}`;
        const menu = new MessageSelectMenu()
         .setCustomId(menuId)
         .setPlaceholder('Select a token')
         .addOptions(tokens.map(token => ({ label: token.key, value: token.value })))
        const row = new MessageActionRow()
         .addComponents(menu);
        await interaction.reply({ components: [row] });
        const filter = i => i.customId === menuId;
        const collector = await interaction.channel.createMessageComponentCollector({ filter, componentType: 'SELECT_MENU', time: 15_000 });

    collector.on('collect', async i => {
      if (i.user.id === interaction.user.id) {
       const refresh = path.join(__dirname, '..', 'bots');
       const type = CI.replaceAll('S', '').replaceAll('O', '');
	      switch (CI) {
          case 'replkaS':
           await tokenService.enableReplka(i.values[0]);
           break;
        case 'replkaO':
           await tokenService.disableReplka(i.values[0]);
           break;
        case 'karasiS':
           await tokenService.enableKarasi(i.values[0]);
           break;
        case 'karasiO':
           await tokenService.disableKarasi(i.values[0]);
           break;
           }
        const { stopAllTokens, startTokens } = require(refresh + '/' + type + '.js');
        await i.update({ content: 'The operation was successfully completed.', components: [] });
        setTimeout(async () => {
          await i.deleteReply();
           }, 5000);
        await stopAllTokens();
        await startTokens();
      	 } else {
		i.reply({ content: `This menu isn't for you!`, ephemeral: true });
	       }
       });
    collector.on('end', async collected => {
      if (collected.size === 0) {
        await interaction.editReply({ content: 'You didn\'t select any token!', components: [] });
        setTimeout(async () => {
          await interaction.deleteReply();
          }, 5000);
        }
      });
    }
  },
};