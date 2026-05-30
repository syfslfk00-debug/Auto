const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');

function uniqueCommands(client) {
  return [...new Set(client.commands.map(command => command))]
    .filter(command => command && command.data)
    .sort((first, second) => first.data.name.localeCompare(second.data.name, 'ar'));
}

function commandDescription(command) {
  const json = command.data.toJSON();
  const lines = [`• /${json.name}`, json.description || 'لا يوجد وصف.'];
  const subcommands = (json.options || []).filter(option => option.type === 1);
  if (subcommands.length > 0) {
    lines.push(subcommands.map(option => `  ◦ /${json.name} ${option.name}: ${option.description || 'لا يوجد وصف.'}`).join('\n'));
  }
  return lines.join('\n');
}

function buildPages(commands) {
  const groups = new Map();
  for (const command of commands) {
    const category = command.category || 'أوامر عامة';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(command);
  }

  const pages = [];
  for (const [category, items] of groups.entries()) {
    let chunk = [];
    let size = 0;
    for (const command of items) {
      const description = commandDescription(command);
      if (size + description.length > 3500 && chunk.length > 0) {
        pages.push(new MessageEmbed().setTitle(`المساعدة — ${category}`).setDescription(chunk.join('\n\n')));
        chunk = [];
        size = 0;
      }
      chunk.push(description);
      size += description.length;
    }
    if (chunk.length > 0) pages.push(new MessageEmbed().setTitle(`المساعدة — ${category}`).setDescription(chunk.join('\n\n')));
  }
  return pages;
}

module.exports = {
  category: 'المساعدة',
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('عرض دليل أوامر البوت'),
  async execute(interaction, client) {
    const commands = uniqueCommands(client || interaction.client);
    const pages = buildPages(commands);
    let index = 0;

    const row = () => new MessageActionRow().addComponents(
      new MessageButton().setCustomId('help:prev').setLabel('السابق').setStyle('SECONDARY').setDisabled(index === 0),
      new MessageButton().setCustomId('help:next').setLabel('التالي').setStyle('PRIMARY').setDisabled(index === pages.length - 1)
    );

    await interaction.reply({ embeds: [pages[index]], components: pages.length > 1 ? [row()] : [], ephemeral: true });

    if (pages.length <= 1) return;

    const collector = interaction.channel.createMessageComponentCollector({
      filter: item => item.user.id === interaction.user.id && ['help:prev', 'help:next'].includes(item.customId),
      time: 60_000,
    });

    collector.on('collect', async item => {
      if (item.customId === 'help:prev') index = Math.max(index - 1, 0);
      if (item.customId === 'help:next') index = Math.min(index + 1, pages.length - 1);
      await item.update({ embeds: [pages[index]], components: [row()] });
    });
  },
};
