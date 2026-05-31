const { SlashCommandBuilder } = require('@discordjs/builders');
const { na3san } = require('../config.json');
const monitorService = require('../services/monitorService');
const channelConfigService = require('../services/channelConfigService');
const { getEngines } = require('../services/engineRegistry');
const { COLORS, ICONS, statusEmbed, chunkButtons, button } = require('../utils/ui');

module.exports = {
  aliases: ['panel'],
  category: 'لوحة العمليات',
  data: new SlashCommandBuilder()
    .setName('لوحة')
    .setDescription('إرسال لوحة عمليات حيّة بتصميم احترافي'),
  async execute(interaction) {
    if (!na3san.includes(interaction.user.id)) {
      return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['لا يمكنك نشر لوحة العمليات.'])], ephemeral: true });
    }

    const overview = await monitorService.getSystemOverview();
    const channels = await channelConfigService.getSettings(interaction.guildId).catch(() => null);
    const rows = [
      `**${ICONS.account} الحسابات:** ${overview.totalAccounts} | عاملة: ${overview.activeAccounts} | متوقفة: ${overview.stoppedAccounts}`,
      `**${ICONS.engine} المحركات:** ${overview.engines.map(e => `${e.name} ${e.activeCount}/${e.enabledCount}`).join(' • ') || 'لا يوجد'}`,
      `**⚠️ أخطاء آخر ساعة:** ${overview.recentErrors}`,
      `**${ICONS.channel} قناة عامة:** ${channels && channels.channels.general ? `<#${channels.channels.general}>` : 'غير محددة'}`,
      'استخدم الأزرار لفتح عروض خاصة، وتشغيل/إيقاف المحركات يتم عبر قائمة حسابات ذكية.'
    ];
    const emb = statusEmbed('live', 'مركز العمليات الحي', rows, { footer: 'لوحة مصممة للعرض الإداري — الأحداث المهمة فقط' }).setColor(COLORS.live);

    const buttons = [
      button('monitor:status', 'الحالة', 'PRIMARY', '🖥️'),
      button('monitor:stats', 'الإحصائيات', 'PRIMARY', '📊'),
      button('monitor:logs', 'السجلات', 'SECONDARY', '📜'),
      button('monitor:accounts', 'الحسابات', 'SECONDARY', '👥'),
      ...getEngines().flatMap(engine => [
        button(`engine:${engine.id}:on`, `تشغيل ${engine.displayName}`, 'SUCCESS', '▶️'),
        button(`engine:${engine.id}:off`, `إيقاف ${engine.displayName}`, 'DANGER', '⏹️'),
      ]),
    ];

    await interaction.channel.send({ embeds: [emb], components: chunkButtons(buttons) });
    return interaction.reply({ embeds: [statusEmbed('success', 'تم نشر لوحة العمليات', ['تم إرسال لوحة احترافية في القناة الحالية.', 'رد الإدارة هذا مخفي لتقليل الضجيج.'])], ephemeral: true });
  },
};
