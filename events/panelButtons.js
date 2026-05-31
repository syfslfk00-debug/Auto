const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { na3san } = require('../config.json');
const tokenService = require('../services/tokenService');
const engineRuntime = require('../services/engineRuntime');
const monitorService = require('../services/monitorService');
const { getEngine } = require('../services/engineRegistry');
const eventBus = require('../services/eventBus');
const { COLORS, ICONS, fmtDate, statusEmbed, embed, truncate } = require('../utils/ui');

function logLine(log) {
  return `• **${fmtDate(log.createdAt)}** — ${log.level || 'تشغيلي'} — ${log.engineName || log.engineId || 'عام'} — ${log.accountName || '—'} — ${log.type || 'حدث'}${log.result ? ` — ${log.result}` : ''}`;
}
async function buildMonitorEmbed(type) {
  const overview = await monitorService.getSystemOverview();
  if (type === 'stats') {
    const totals = overview.accounts.reduce((sum, account) => {
      sum.events += account.totals.events; sum.starts += account.totals.starts; sum.stops += account.totals.stops; sum.errors += account.totals.errors; sum.wins += account.totals.wins; sum.losses += account.totals.losses; return sum;
    }, { events: 0, starts: 0, stops: 0, errors: 0, wins: 0, losses: 0 });
    return statusEmbed('info', 'الإحصائيات العامة', [`الأحداث: **${totals.events}**`, `تشغيل/إيقاف: **${totals.starts}/${totals.stops}**`, `الأخطاء: **${totals.errors}**`, `الفوز/الخسارة: **${totals.wins}/${totals.losses}**`]);
  }
  if (type === 'logs') return embed({ title: `${ICONS.logs} آخر السجلات المهمة`, color: COLORS.dark, description: overview.recentLogs.length ? overview.recentLogs.map(logLine).join('\n') : 'لا توجد سجلات بعد.' });
  if (type === 'accounts') return embed({ title: `${ICONS.account} الحسابات`, color: COLORS.info, description: overview.accounts.length ? overview.accounts.slice(0, 15).map(a => `• **${a.name}** — ${a.activeEngines > 0 ? '🟢 يعمل' : '⚫ متوقف'} — آخر نشاط: ${fmtDate(a.lastActivity)}`).join('\n') : 'لا توجد حسابات محفوظة.' });
  const emb = statusEmbed('live', 'حالة النظام الحالية', [`الحسابات: **${overview.totalAccounts}** | العاملة: **${overview.activeAccounts}** | المتوقفة: **${overview.stoppedAccounts}**`, `أخطاء آخر ساعة: **${overview.recentErrors}**`]);
  for (const engine of overview.engines) emb.addField(`${ICONS.engine} ${engine.name}`, `مفعلة: **${engine.enabledCount}**\nعاملة: **${engine.activeCount}**\nمتوقفة: **${engine.stoppedCount}**`, true);
  return emb;
}
async function handleMonitor(interaction) {
  if (!interaction.customId.startsWith('monitor:')) return false;
  if (!na3san.includes(interaction.user.id)) { await interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['هذا الزر مخصص للمشرفين.'])], ephemeral: true }); return true; }
  const [, type] = interaction.customId.split(':');
  await interaction.reply({ embeds: [await buildMonitorEmbed(type)], ephemeral: true });
  return true;
}
async function handleEngine(interaction) {
  if (!interaction.customId.startsWith('engine:')) return false;
  if (!na3san.includes(interaction.user.id)) { await interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['هذا الزر مخصص للمشرفين.'])], ephemeral: true }); return true; }
  const [, engineId, action] = interaction.customId.split(':');
  const engine = getEngine(engineId);
  if (!engine || !['on', 'off'].includes(action)) { await interaction.reply({ embeds: [statusEmbed('error', 'إجراء غير معروف', ['تعذر فهم الزر المطلوب.'])], ephemeral: true }); return true; }
  const tokens = await tokenService.getAllTokensForSelectMenu();
  if (tokens.length === 0) { await interaction.reply({ embeds: [statusEmbed('warning', 'لا توجد حسابات', ['أضف حسابًا أولًا عبر /اضافة-حساب.'])], ephemeral: true }); return true; }
  const menuId = `engine-account-${engine.id}-${action}-${Date.now()}`;
  const menu = new MessageSelectMenu().setCustomId(menuId).setPlaceholder(`اختر حسابًا لـ ${action === 'on' ? 'تشغيل' : 'إيقاف'} ${engine.displayName}`).addOptions(tokens.slice(0, 25).map(t => ({ label: t.key, value: t.value, description: `حساب محفوظ في قاعدة البيانات` })));
  await interaction.reply({ embeds: [statusEmbed('info', 'اختر الحساب', [`المحرك: **${engine.displayName}**`, `الإجراء: **${action === 'on' ? 'تشغيل' : 'إيقاف'}**`])], components: [new MessageActionRow().addComponents(menu)], ephemeral: true });
  const collector = interaction.channel.createMessageComponentCollector({ filter: i => i.customId === menuId, componentType: 'SELECT_MENU', time: 20_000 });
  collector.on('collect', async i => {
    if (i.user.id !== interaction.user.id) return i.reply({ embeds: [statusEmbed('error', 'قائمة خاصة', ['هذه القائمة لمن طلبها فقط.'])], ephemeral: true });
    const selectedToken = i.values[0];
    if (action === 'on') { await tokenService.enableEngine(selectedToken, engine.id); await engineRuntime.startEngineToken(engine.id, selectedToken); }
    else { await tokenService.disableEngine(selectedToken, engine.id); await engineRuntime.stopEngineToken(engine.id, selectedToken); }
    const account = await tokenService.getTokenByValue(selectedToken).catch(() => null);
    await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId: engine.id, engineName: engine.displayName, accountName: account ? account.name : undefined, result: action === 'on' ? 'engine_enabled' : 'engine_disabled', message: 'تم تغيير حالة محرك من لوحة العمليات.' });
    await i.update({ embeds: [statusEmbed(action === 'on' ? 'success' : 'warning', 'تم تنفيذ العملية', [`الحساب: **${account ? account.name : 'غير معروف'}**`, `المحرك: **${engine.displayName}**`, `الإجراء: **${action === 'on' ? 'تشغيل' : 'إيقاف'}**`, truncate('تم نشر حدث إداري مهم إلى قناة العرض إن كانت محددة.', 120)])], components: [] });
  });
  collector.on('end', async c => { if (c.size === 0) await interaction.editReply({ embeds: [statusEmbed('warning', 'انتهت المهلة', ['لم يتم اختيار أي حساب.'])], components: [] }).catch(() => {}); });
  return true;
}
module.exports = { name: 'interactionCreate', async execute(interaction) { if (!interaction.isButton()) return; if (await handleMonitor(interaction)) return; await handleEngine(interaction); } };
