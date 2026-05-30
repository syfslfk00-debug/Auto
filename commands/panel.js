const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const { na3san } = require('../config.json');
const { getEngines } = require('../services/engineRegistry');

module.exports = {
  aliases: ['panel'],
  category: 'لوحة الإدارة',
  data: new SlashCommandBuilder()
    .setName('لوحة')
    .setDescription('لوحة الإدارة والمراقبة للحسابات والمحركات'),
  async execute(interaction) {
    if (!na3san.includes(interaction.user.id)) {
      return interaction.reply({ content: 'ليست لديك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }

    const embed = new MessageEmbed()
      .setTitle('لوحة الإدارة والمراقبة')
      .setDescription('اختر إجراءً لإدارة المحركات أو مراقبة الحسابات والسجلات والإحصائيات.');

    const engineButtons = getEngines().flatMap(engine => [
      new MessageButton()
        .setCustomId(`engine:${engine.id}:on`)
        .setLabel(`تشغيل ${engine.displayName}`)
        .setStyle('SUCCESS'),
      new MessageButton()
        .setCustomId(`engine:${engine.id}:off`)
        .setLabel(`إيقاف ${engine.displayName}`)
        .setStyle('DANGER'),
    ]);

    const monitorButtons = [
      new MessageButton().setCustomId('monitor:status').setLabel('الحالة').setStyle('PRIMARY'),
      new MessageButton().setCustomId('monitor:stats').setLabel('الإحصائيات').setStyle('PRIMARY'),
      new MessageButton().setCustomId('monitor:logs').setLabel('آخر السجلات').setStyle('SECONDARY'),
      new MessageButton().setCustomId('monitor:accounts').setLabel('الحسابات').setStyle('SECONDARY'),
    ];

    const rows = [];
    const buttons = [...engineButtons, ...monitorButtons];
    for (let index = 0; index < buttons.length; index += 5) {
      rows.push(new MessageActionRow().addComponents(buttons.slice(index, index + 5)));
    }

    await interaction.channel.send({ embeds: [embed], components: rows });
    return interaction.reply({ content: 'تم إرسال لوحة الإدارة والمراقبة بنجاح.', ephemeral: true });
  },
};
