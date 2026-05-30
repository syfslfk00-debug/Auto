const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const { na3san } = require('../config.json');
const { getEngines } = require('../services/engineRegistry');

module.exports = {
  aliases: ['panel'],
  data: new SlashCommandBuilder()
    .setName('لوحة')
    .setDescription('لوحة التحكم في الحسابات والمحركات'),
  async execute(interaction) {
    if (!na3san.includes(interaction.user.id)) {
      return interaction.reply({ content: 'ليست لديك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }

    const embed = new MessageEmbed()
      .setDescription('اختر المحرك والإجراء المطلوب للحساب المقصود.');

    const buttons = getEngines().flatMap(engine => [
      new MessageButton()
        .setCustomId(`engine:${engine.id}:on`)
        .setLabel(`تشغيل ${engine.displayName}`)
        .setStyle('SUCCESS'),
      new MessageButton()
        .setCustomId(`engine:${engine.id}:off`)
        .setLabel(`إيقاف ${engine.displayName}`)
        .setStyle('DANGER'),
    ]);

    const rows = [];
    for (let index = 0; index < buttons.length; index += 5) {
      rows.push(new MessageActionRow().addComponents(buttons.slice(index, index + 5)));
    }

    await interaction.channel.send({ embeds: [embed], components: rows });
    return interaction.reply({ content: 'تم إرسال لوحة التحكم بنجاح.', ephemeral: true });
  },
};
