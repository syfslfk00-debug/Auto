const { na3san } = require('../config.json');
const tokenService = require('../services/tokenService');
const channelConfigService = require('../services/channelConfigService');
const eventBus = require('../services/eventBus');
const { statusEmbed } = require('../utils/ui');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== 'zar-channel-modal') return;
    if (!na3san.includes(interaction.user.id)) return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['ربط Zar متاح للمشرفين فقط.'])], ephemeral: true });

    try {
      const channelId = interaction.fields.getTextInputValue('channelId').trim();
      const accountName = interaction.fields.getTextInputValue('accountName').trim();
      const account = await tokenService.getToken(accountName);
      if (!account) return interaction.reply({ embeds: [statusEmbed('error', 'الحساب غير موجود', [`لم يتم العثور على حساب باسم **${accountName || 'غير محدد'}**.`])], ephemeral: true });

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || typeof channel.send !== 'function') return interaction.reply({ embeds: [statusEmbed('error', 'القناة غير متاحة', ['تعذر العثور على القناة أو لا يستطيع البوت الوصول إليها.', 'يمكن استخدام قناة من أي سيرفر يوجد فيه البوت.'])], ephemeral: true });
      if (!channel.guild || !channel.guild.id) return interaction.reply({ embeds: [statusEmbed('error', 'قناة غير صالحة', ['يجب أن تكون القناة داخل سيرفر يستطيع البوت الوصول إليه.'])], ephemeral: true });

      await channelConfigService.setZarChannel(channel.guild.id, account.name, channel.id);
      await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId: 'zar', engineName: 'زر', accountName: account.name, result: 'zar_channel_set', serverId: channel.guild.id, serverName: channel.guild.name, channelId: channel.id, channelName: channel.name, message: 'تم ربط قناة Zar بحساب.' });
      return interaction.reply({ embeds: [statusEmbed('success', 'تم ربط قناة Zar', [`الحساب: **${account.name}**`, `القناة: <#${channel.id}>`, `السيرفر: **${channel.guild.name}**`, 'سيستخدم محرك Zar هذه القناة عند التشغيل.'])], ephemeral: true });
    } catch (error) {
      console.error(error);
      return interaction.reply({ embeds: [statusEmbed('error', 'فشل ربط Zar', [error.message || 'حدث خطأ غير معروف.'])], ephemeral: true });
    }
  },
};