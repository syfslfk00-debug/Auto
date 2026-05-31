const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const { COLORS, line } = require('../utils/ui');

function uniqueCommands(client) {
  return [...new Set(client.commands.map(command => command))].filter(command => command && command.data).sort((a, b) => a.data.name.localeCompare(b.data.name, 'ar'));
}
function optionSummary(option) {
  const req = option.required ? 'مطلوب' : 'اختياري';
  return `\`${option.name}\` (${req}) — ${option.description || 'بدون وصف'}`;
}
function commandBlock(command) {
  const json = command.data.toJSON();
  const blocks = [`### /${json.name}\n${json.description || 'بدون وصف'}`];
  const subcommands = (json.options || []).filter(o => o.type === 1);
  if (subcommands.length) {
    blocks.push(subcommands.map(sc => {
      const opts = (sc.options || []).map(optionSummary).join('\n      ');
      return `**/${json.name} ${sc.name}**\n> ${sc.description || 'بدون وصف'}${opts ? `\n      ${opts}` : ''}`;
    }).join('\n'));
  } else {
    const opts = (json.options || []).map(optionSummary).join('\n');
    if (opts) blocks.push(opts);
  }
  return blocks.join('\n');
}
function buildPages(commands) {
  const groups = new Map();
  for (const command of commands) {
    const category = command.category || 'أوامر عامة';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(command);
  }
  const pages = [new MessageEmbed().setColor(COLORS.primary).setTitle('🧭 دليل مركز التحكم').setDescription([line(), '**مرحبًا بك في دليل الأوامر الحي.**', 'هذا الدليل يقرأ أوامر السلاش المسجلة فعليًا ويعرض الفئات والـ subcommands والخيارات.', '', 'استخدم الأزرار للتنقل بين الصفحات.', line()].join('\n')).setFooter({ text: `الفئات: ${groups.size} • الأوامر: ${commands.length}` }).setTimestamp()];
  for (const [category, items] of groups.entries()) {
    let chunk = [];
    let size = 0;
    for (const command of items) {
      const block = commandBlock(command);
      if (size + block.length > 3400 && chunk.length) {
        pages.push(new MessageEmbed().setColor(COLORS.info).setTitle(`📚 ${category}`).setDescription(chunk.join('\n\n')).setTimestamp());
        chunk = []; size = 0;
      }
      chunk.push(block); size += block.length;
    }
    if (chunk.length) pages.push(new MessageEmbed().setColor(COLORS.info).setTitle(`📚 ${category}`).setDescription(chunk.join('\n\n')).setTimestamp());
  }
  return pages;
}
module.exports = {
  category: 'المساعدة',
  data: new SlashCommandBuilder().setName('help').setDescription('دليل تفاعلي احترافي يقرأ الأوامر الحالية تلقائيًا'),
  async execute(interaction, client) {
    const pages = buildPages(uniqueCommands(client || interaction.client));
    let index = 0;
    const row = () => new MessageActionRow().addComponents(
      new MessageButton().setCustomId('help:first').setLabel('الأولى').setStyle('SECONDARY').setDisabled(index === 0),
      new MessageButton().setCustomId('help:prev').setLabel('السابق').setStyle('SECONDARY').setDisabled(index === 0),
      new MessageButton().setCustomId('help:next').setLabel('التالي').setStyle('PRIMARY').setDisabled(index === pages.length - 1),
      new MessageButton().setCustomId('help:last').setLabel('الأخيرة').setStyle('SECONDARY').setDisabled(index === pages.length - 1),
    );
    const decorate = () => pages[index].setFooter({ text: `صفحة ${index + 1} من ${pages.length} • دليل حي من التسجيل الحالي` });
    await interaction.reply({ embeds: [decorate()], components: pages.length > 1 ? [row()] : [], ephemeral: true });
    if (pages.length <= 1) return;
    const collector = interaction.channel.createMessageComponentCollector({ filter: item => item.user.id === interaction.user.id && item.customId.startsWith('help:'), time: 90_000 });
    collector.on('collect', async item => {
      if (item.customId === 'help:first') index = 0;
      if (item.customId === 'help:prev') index = Math.max(0, index - 1);
      if (item.customId === 'help:next') index = Math.min(pages.length - 1, index + 1);
      if (item.customId === 'help:last') index = pages.length - 1;
      await item.update({ embeds: [decorate()], components: [row()] });
    });
  },
};
