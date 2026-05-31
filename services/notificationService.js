const eventBus = require('./eventBus');
const channelConfigService = require('./channelConfigService');
const { statusEmbed, COLORS, ICONS, fmtDate, truncate } = require('../utils/ui');

const IMPORTANT_TYPES = new Set([
  'game_join', 'game_play', 'game_result', 'game_timeout',
  'engine_token_started', 'engine_token_stopped', 'engine_token_restarted',
  'engine_login_failed', 'engine_client_error', 'engine_event_error',
  'admin_action', 'admin_action_error', 'startup_failed', 'uncaught_exception', 'unhandled_rejection', 'client_unhandled_rejection'
]);
const noisyAdminResults = new Set(['logs_viewed', 'stats_viewed']);
let unsubscribe = null;

function isImportant(event) {
  if (!event || !IMPORTANT_TYPES.has(event.type)) return false;
  if (event.type === 'admin_action' && noisyAdminResults.has(event.result)) return false;
  if (event.level === 'تشخيصي') return false;
  return true;
}
function kind(event) {
  if (event.status === 'error' || event.level === 'خطأ' || String(event.type).includes('error') || String(event.type).includes('failed')) return 'error';
  if (event.result === 'win' || event.level === 'نجاح') return 'success';
  if (event.result === 'loss' || event.level === 'خسارة' || event.type === 'game_timeout') return 'warning';
  if (event.type.startsWith('game_')) return 'live';
  return 'info';
}
function eventTitle(event) {
  const titles = {
    game_join: 'دخول لعبة', game_play: 'بدء اللعب', game_result: event.result === 'win' ? 'فوز' : 'خسارة', game_timeout: 'انتهاء مهلة الجولة',
    engine_token_started: 'تشغيل حساب', engine_token_stopped: 'إيقاف حساب', engine_token_restarted: 'إعادة تشغيل حساب',
    engine_login_failed: 'فشل تسجيل الدخول', engine_client_error: 'خطأ حساب', engine_event_error: 'خطأ حدث', admin_action: 'تغيير إداري', admin_action_error: 'خطأ إداري'
  };
  return titles[event.type] || event.type || 'حدث مهم';
}
function buildEventEmbed(event, route) {
  const rows = [
    `**${ICONS.account} الحساب:** ${event.accountName || 'غير محدد'}`,
    `**${ICONS.engine} المحرك:** ${event.engineName || event.engineId || 'عام'}`,
    `**📌 النوع:** ${eventTitle(event)}`,
    event.result ? `**🏁 النتيجة:** ${event.result === 'win' ? 'فوز' : event.result === 'loss' ? 'خسارة' : event.result}` : null,
    event.serverName ? `**🖥️ السيرفر:** ${event.serverName}` : null,
    event.channelName ? `**#️⃣ قناة المصدر:** ${event.channelName}` : null,
    event.gameName ? `**🎲 اللعبة:** ${event.gameName}` : null,
    event.message ? `**📝 ملخص:** ${truncate(event.message, 220)}` : null,
    `**🕒 الوقت:** ${fmtDate(event.createdAt)}`,
    `**📡 مسار العرض:** ${route.scope === 'account' ? 'قناة الحساب' : route.scope === 'engine' ? 'قناة المحرك' : 'القناة العامة'}`,
  ].filter(Boolean);
  const emb = statusEmbed(kind(event), eventTitle(event), rows, { footer: 'Live Operations Stream' });
  if (event.type.startsWith('game_')) emb.setColor(event.result === 'win' ? COLORS.success : event.result === 'loss' ? COLORS.warning : COLORS.live);
  return emb;
}
async function deliver(client, event) {
  if (!isImportant(event) || !client || !client.guilds) return;
  const guilds = client.guilds.cache ? [...client.guilds.cache.values()] : [];
  for (const guild of guilds) {
    const settings = await channelConfigService.getSettings(guild.id).catch(() => null);
    if (!settings) continue;
    const route = channelConfigService.resolveChannel(settings, event);
    if (!route) continue;
    const channel = await client.channels.fetch(route.channelId).catch(() => null);
    if (!channel || typeof channel.send !== 'function') continue;
    await channel.send({ embeds: [buildEventEmbed(event, route)] }).catch(error => console.error('[NotificationService] Failed to send live event:', error.message));
  }
}
function start(client) { if (unsubscribe) unsubscribe(); unsubscribe = eventBus.subscribe(event => deliver(client, event)); return unsubscribe; }
module.exports = { start, isImportant, buildEventEmbed };
