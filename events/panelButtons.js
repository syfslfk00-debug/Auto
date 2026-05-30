const { MessageActionRow, MessageSelectMenu, MessageEmbed } = require('discord.js');
const { na3san } = require('../config.json');
const tokenService = require('../services/tokenService');
const engineRuntime = require('../services/engineRuntime');
const monitorService = require('../services/monitorService');
const { getEngine } = require('../services/engineRegistry');

function formatDate(value) {
  if (!value) return 'لا يوجد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'لا يوجد';
  return date.toLocaleString('ar');
}


function translateEventType(type) {
  const types = {
    engine_token_started: 'تشغيل حساب',
    engine_token_stopped: 'إيقاف حساب',
    engine_login_failed: 'فشل تسجيل الدخول',
    engine_client_error: 'خطأ في الحساب',
    engine_event: 'حدث محرك',
    engine_event_error: 'خطأ حدث',
  };
  return types[type] || type || 'حدث';
}

function logLine(log) {
  return `• ${log.engineName || log.engineId || 'محرك'} — ${log.accountName || 'حساب غير معروف'} — ${translateEventType(log.type)} — ${formatDate(log.createdAt)}`;
}

async function buildMonitorEmbed(type) {
  const overview = await monitorService.getSystemOverview();
  const embed = new MessageEmbed();

  if (type === 'status') {
    embed.setTitle('حالة النظام الحالية')
      .setDescription([
        `إجمالي الحسابات: ${overview.totalAccounts}`,
        `الحسابات العاملة: ${overview.activeAccounts}`,
        `الحسابات المتوقفة: ${overview.stoppedAccounts}`,
        `الأخطاء خلال آخر ساعة: ${overview.recentErrors}`,
      ].join('\n'));
    for (const engine of overview.engines) {
      embed.addField(engine.name, `مفعلة: ${engine.enabledCount}\nعاملة: ${engine.activeCount}\nمتوقفة: ${engine.stoppedCount}`, true);
    }
    return embed;
  }

  if (type === 'stats') {
    const totals = overview.accounts.reduce((sum, account) => {
      sum.events += account.totals.events;
      sum.starts += account.totals.starts;
      sum.stops += account.totals.stops;
      sum.errors += account.totals.errors;
      sum.wins += account.totals.wins;
      sum.losses += account.totals.losses;
      return sum;
    }, { events: 0, starts: 0, stops: 0, errors: 0, wins: 0, losses: 0 });
    embed.setTitle('الإحصائيات العامة')
      .setDescription([
        `الأحداث: ${totals.events}`,
        `مرات التشغيل: ${totals.starts}`,
        `مرات الإيقاف: ${totals.stops}`,
        `الأخطاء: ${totals.errors}`,
        `الانتصارات: ${totals.wins}`,
        `الخسائر: ${totals.losses}`,
      ].join('\n'));
    return embed;
  }

  if (type === 'logs') {
    embed.setTitle('آخر السجلات')
      .setDescription(overview.recentLogs.length > 0 ? overview.recentLogs.map(logLine).join('\n') : 'لا توجد سجلات بعد.');
    return embed;
  }

  embed.setTitle('الحسابات')
    .setDescription(overview.accounts.length > 0
      ? overview.accounts.slice(0, 15).map(account => `• ${account.name} — ${account.activeEngines > 0 ? 'يعمل' : 'متوقف'} — آخر نشاط: ${formatDate(account.lastActivity)}`).join('\n')
      : 'لا توجد حسابات محفوظة.');
  return embed;
}

async function handleMonitor(interaction) {
  if (!interaction.customId.startsWith('monitor:')) return false;
  if (!na3san.includes(interaction.user.id)) {
    await interaction.reply({ content: 'ليست لديك صلاحية استخدام هذا الزر.', ephemeral: true });
    return true;
  }

  const [, type] = interaction.customId.split(':');
  const embed = await buildMonitorEmbed(type);
  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

async function handleEngine(interaction) {
  if (!interaction.customId.startsWith('engine:')) return false;

  if (!na3san.includes(interaction.user.id)) {
    await interaction.reply({ content: 'ليست لديك صلاحية استخدام هذا الزر.', ephemeral: true });
    return true;
  }

  const [, engineId, action] = interaction.customId.split(':');
  const engine = getEngine(engineId);
  if (!engine || !['on', 'off'].includes(action)) {
    await interaction.reply({ content: 'الإجراء المطلوب غير معروف.', ephemeral: true });
    return true;
  }

  const tokens = await tokenService.getAllTokensForSelectMenu();
  if (tokens.length === 0) {
    await interaction.reply({ content: 'لا توجد حسابات محفوظة.', ephemeral: true });
    return true;
  }

  const menuId = `menu-${Math.floor(Math.random() * 9000000) + 1000000}`;
  const menu = new MessageSelectMenu()
    .setCustomId(menuId)
    .setPlaceholder('اختر حسابًا')
    .addOptions(tokens.slice(0, 25).map(token => ({ label: token.key, value: token.value })));

  const row = new MessageActionRow().addComponents(menu);
  await interaction.reply({ components: [row], ephemeral: true });

  const filter = i => i.customId === menuId;
  const collector = interaction.channel.createMessageComponentCollector({ filter, componentType: 'SELECT_MENU', time: 15_000 });

  collector.on('collect', async i => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({ content: 'هذه القائمة مخصصة لمن طلبها فقط.', ephemeral: true });
    }

    const selectedToken = i.values[0];

    if (action === 'on') {
      await tokenService.enableEngine(selectedToken, engine.id);
      await engineRuntime.startEngineToken(engine.id, selectedToken);
    } else {
      await tokenService.disableEngine(selectedToken, engine.id);
      await engineRuntime.stopEngineToken(engine.id, selectedToken);
    }

    const actionText = action === 'on' ? 'تشغيل' : 'إيقاف';
    await i.update({ content: `تم ${actionText} محرك ${engine.displayName} للحساب المحدد بنجاح.`, components: [] });

    setTimeout(async () => {
      await i.deleteReply().catch(() => {});
    }, 5000);
  });

  collector.on('end', async collected => {
    if (collected.size === 0) {
      await interaction.editReply({ content: 'لم يتم اختيار أي حساب.', components: [] }).catch(() => {});
      setTimeout(async () => {
        await interaction.deleteReply().catch(() => {});
      }, 5000);
    }
  });

  return true;
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (await handleMonitor(interaction)) return;
    await handleEngine(interaction);
  },
};
