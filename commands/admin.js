const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, Modal, TextInputComponent } = require('discord.js');
const { na3san } = require('../config.json');
const tokenService = require('../services/tokenService');
const engineRuntime = require('../services/engineRuntime');
const monitorService = require('../services/monitorService');
const logService = require('../services/logService');
const channelConfigService = require('../services/channelConfigService');
const { getEngines, getEngine } = require('../services/engineRegistry');
const eventBus = require('../services/eventBus');
const { COLORS, ICONS, fmtDate, value, statusEmbed, embed, truncate } = require('../utils/ui');

const settingKeys = { 'التفعيل': 'enabled', 'التأخير': 'delay', 'السلوك': 'behavior' };
const labels = { enabled: 'التفعيل', delay: 'التأخير', behavior: 'السلوك', events: 'الأحداث', starts: 'مرات التشغيل', stops: 'مرات الإيقاف', errors: 'الأخطاء', wins: 'الفوز', losses: 'الخسارة', joins: 'الدخول', plays: 'اللعب', timeouts: 'المهل', lastActivityAt: 'آخر نشاط', lastError: 'آخر خطأ' };
function label(k) { return labels[k] || k; }
function parseSetting(k, v) { if (k === 'enabled') return ['نعم', 'مفعل', 'تشغيل', 'true', '1'].includes(String(v).trim()); if (k === 'delay') return Math.max(0, Number(v) || 0); return String(v).trim() === 'تلقائي' ? 'auto' : String(v).trim(); }
function engineChoices(option) { return getEngines().slice(0, 25).reduce((o, e) => o.addChoices({ name: `${e.displayName} (${e.id})`, value: e.id }), option); }
function accountOption(required = true) { return option => option.setName('الاسم').setDescription('اختر اسم الحساب من قاعدة البيانات').setRequired(required).setAutocomplete(true); }
function engineOption(required = true) { return option => engineChoices(option.setName('المحرك').setDescription('اختر المحرك من سجل engineRegistry').setRequired(required)); }
function logFilters(sc) { return sc.addStringOption(accountOption(false)).addStringOption(engineOption(false)).addStringOption(o => o.setName('النوع').setDescription('نوع الحدث').setRequired(false)).addStringOption(o => o.setName('المستوى').setDescription('مستوى السجل').setRequired(false)); }
function lineLog(log) { return `• **${fmtDate(log.createdAt)}** — ${log.level || 'تشغيلي'} — ${log.engineName || log.engineId || 'عام'} — ${log.accountName || '—'} — ${log.type || 'حدث'}${log.result ? ` — ${log.result}` : ''}`; }
async function findAccount(interaction) { const name = interaction.options.getString('الاسم'); const a = await tokenService.getToken(name); if (!a) await interaction.reply({ embeds: [statusEmbed('error', 'الحساب غير موجود', [`لم يتم العثور على حساب باسم **${name || 'غير محدد'}**.`, 'استخدم الإكمال التلقائي لاختيار اسم موجود.'])], ephemeral: true }); return a; }
function noPerm(interaction) { return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['هذا المركز الإداري مخصص للمستخدمين المصرح لهم فقط.', 'الرسالة مخفية لحماية الإعدادات الحساسة.'])], ephemeral: true }); }
async function autocompleteAccounts(interaction) { const focused = interaction.options.getFocused().toLowerCase(); const accounts = await tokenService.getAllTokens(); await interaction.respond(accounts.filter(a => a.name.toLowerCase().includes(focused)).slice(0, 25).map(a => ({ name: a.name, value: a.name }))); }

module.exports = {
  category: 'مركز التحكم',
  data: new SlashCommandBuilder()
    .setName('ادارة')
    .setDescription('مركز تحكم احترافي للحسابات، المحركات، القنوات، السجلات والإحصائيات')
    .addSubcommand(sc => sc.setName('الحسابات').setDescription('عرض حسابات النظام بشكل منظم'))
    .addSubcommand(sc => sc.setName('حساب').setDescription('تفاصيل حساب واحد').addStringOption(accountOption(true)))
    .addSubcommand(sc => sc.setName('المحركات').setDescription('عرض المحركات المسجلة وحالتها'))
    .addSubcommand(sc => sc.setName('محرك').setDescription('تفاصيل محرك محدد').addStringOption(engineOption(true)))
    .addSubcommand(sc => sc.setName('تشغيل').setDescription('تفعيل وتشغيل محرك لحساب').addStringOption(accountOption(true)).addStringOption(engineOption(true)))
    .addSubcommand(sc => sc.setName('ايقاف').setDescription('إيقاف وتعطيل محرك لحساب').addStringOption(accountOption(true)).addStringOption(engineOption(true)))
    .addSubcommand(sc => sc.setName('اعادة-تشغيل').setDescription('إعادة تشغيل محرك لحساب').addStringOption(accountOption(true)).addStringOption(engineOption(true)))
    .addSubcommand(sc => sc.setName('اعدادات').setDescription('عرض إعدادات محرك لحساب').addStringOption(accountOption(true)).addStringOption(engineOption(true)))
    .addSubcommand(sc => sc.setName('ضبط').setDescription('تعديل إعداد لمحرك حساب').addStringOption(accountOption(true)).addStringOption(engineOption(true)).addStringOption(o => o.setName('المفتاح').setDescription('التفعيل / التأخير / السلوك').setRequired(true).addChoices({ name: 'التفعيل', value: 'التفعيل' }, { name: 'التأخير', value: 'التأخير' }, { name: 'السلوك', value: 'السلوك' })).addStringOption(o => o.setName('القيمة').setDescription('القيمة الجديدة').setRequired(true)))
    .addSubcommand(sc => sc.setName('اعادة-ضبط').setDescription('إعادة ضبط إعدادات محرك حساب').addStringOption(accountOption(true)).addStringOption(engineOption(true)))
    .addSubcommand(sc => logFilters(sc.setName('السجلات').setDescription('عرض السجلات بفلترة ذكية')).addIntegerOption(o => o.setName('العدد').setDescription('عدد النتائج').setRequired(false)).addIntegerOption(o => o.setName('الصفحة').setDescription('رقم الصفحة').setRequired(false)))
    .addSubcommand(sc => sc.setName('احصائيات').setDescription('إحصائيات عامة أو لحساب/محرك').addStringOption(accountOption(false)).addStringOption(engineOption(false)))
    .addSubcommand(sc => sc.setName('مراقبة').setDescription('ملخص حي لحالة النظام'))
    .addSubcommand(sc => sc.setName('قناة-تعيين').setDescription('تعيين قناة عامة أو قناة محرك أو حساب').addStringOption(o => o.setName('النطاق').setDescription('نوع مسار الأحداث').setRequired(true).addChoices({ name: 'عام', value: 'general' }, { name: 'محرك', value: 'engine' }, { name: 'حساب', value: 'account' })).addChannelOption(o => o.setName('القناة').setDescription('قناة عرض الأحداث المهمة').setRequired(true)).addStringOption(engineOption(false)).addStringOption(accountOption(false)))
    .addSubcommand(sc => sc.setName('قنوات').setDescription('عرض قنوات العرض الحي الحالية'))
    .addSubcommand(sc => sc.setName('ربط-zar').setDescription('فتح نموذج ربط قناة Zar بحساب محفوظ'))
    .addSubcommand(sc => sc.setName('قناة-حذف').setDescription('إزالة قناة عرض حي').addStringOption(o => o.setName('النطاق').setDescription('النطاق المراد حذفه').setRequired(true).addChoices({ name: 'عام', value: 'general' }, { name: 'محرك', value: 'engine' }, { name: 'حساب', value: 'account' })).addStringOption(engineOption(false)).addStringOption(accountOption(false)))
    .addSubcommand(sc => sc.setName('تنظيف-سجلات').setDescription('أرشفة أو حذف سجلات قديمة')
      .addIntegerOption(o => o.setName('العمر').setDescription('أقدم من عدد أيام').setRequired(true))
      .addStringOption(accountOption(false))
      .addStringOption(engineOption(false))
      .addStringOption(o => o.setName('النوع').setDescription('نوع الحدث').setRequired(false))
      .addStringOption(o => o.setName('المستوى').setDescription('مستوى السجل').setRequired(false))
      .addStringOption(o => o.setName('الوضع').setDescription('أرشفة أو حذف').setRequired(false).addChoices({ name: 'أرشفة', value: 'archive' }, { name: 'حذف', value: 'delete' }))),
  async autocomplete(interaction) { if (interaction.options.getFocused(true).name === 'الاسم') return autocompleteAccounts(interaction); },
  async execute(interaction) {
    if (!na3san.includes(interaction.user.id)) return noPerm(interaction);
    const sub = interaction.options.getSubcommand();

    if (sub === 'الحسابات') {
      const accounts = await tokenService.getAllTokens();
      const rows = accounts.length ? accounts.slice(0, 20).map((a, i) => `**${i + 1}. ${a.name}** — ${a.status === 'active' ? '🟢 نشط' : '🔴 معطل'} — محركات مفعلة: ${Object.values(a.engines || {}).filter(Boolean).length}`) : ['لا توجد حسابات محفوظة.'];
      return interaction.reply({ embeds: [statusEmbed('info', 'الحسابات المحفوظة', rows, { footer: `إجمالي الحسابات: ${accounts.length}` })], ephemeral: true });
    }

    if (sub === 'حساب') {
      const account = await findAccount(interaction); if (!account) return;
      const details = await monitorService.getAccountDetails(account.name);
      const emb = statusEmbed('info', `ملف الحساب: ${account.name}`, [`الحالة العامة: **${account.status}**`, `الأحداث: **${details.totals.events}** | الأخطاء: **${details.totals.errors}** | الفوز: **${details.totals.wins}** | الخسارة: **${details.totals.losses}**`]);
      details.engines.forEach(e => emb.addField(`${e.running ? '🟢' : e.enabled ? '🟡' : '⚫'} ${e.engineName}`, `الحالة: **${e.status}**\nآخر نشاط: ${fmtDate(e.runtime.lastActivityAt || e.stats.lastActivityAt)}\nآخر خطأ: ${truncate(e.runtime.lastError || e.stats.lastError || 'لا يوجد', 120)}`, true));
      return interaction.reply({ embeds: [emb], ephemeral: true });
    }

    if (sub === 'المحركات' || sub === 'مراقبة') {
      const overview = await monitorService.getSystemOverview();
      const emb = statusEmbed('live', sub === 'المحركات' ? 'المحركات المسجلة' : 'مراقبة النظام', [`الحسابات: **${overview.totalAccounts}** | العاملة: **${overview.activeAccounts}** | المتوقفة: **${overview.stoppedAccounts}**`, `الأخطاء خلال آخر ساعة: **${overview.recentErrors}**`]);
      overview.engines.forEach(e => emb.addField(`${ICONS.engine} ${e.name}`, `عاملة: **${e.activeCount}**\nمفعلة: **${e.enabledCount}**\nمتوقفة: **${e.stoppedCount}**`, true));
      return interaction.reply({ embeds: [emb], ephemeral: true });
    }

    if (sub === 'محرك') {
      const details = await monitorService.getEngineDetails(interaction.options.getString('المحرك'));
      if (!details) return interaction.reply({ embeds: [statusEmbed('error', 'محرك غير معروف', ['اختر محركًا من القائمة.'])], ephemeral: true });
      const emb = statusEmbed('info', `محرك ${details.engine.displayName}`, [`المعرف: \`${details.engine.id}\``, `الحسابات المفعلة: **${details.enabledCount}** | العاملة: **${details.activeCount}** | المتوقفة: **${details.stoppedCount}**`]);
      if (details.accounts.length) emb.addField('الحسابات', details.accounts.slice(0, 15).map(a => `${a.running ? '🟢' : '⚫'} ${a.name} — ${fmtDate(a.runtime.lastActivityAt || a.stats.lastActivityAt)}`).join('\n'));
      return interaction.reply({ embeds: [emb], ephemeral: true });
    }

    if (['تشغيل', 'ايقاف', 'اعادة-تشغيل'].includes(sub)) {
      const account = await findAccount(interaction); if (!account) return;
      const engine = getEngine(interaction.options.getString('المحرك')); if (!engine) return interaction.reply({ embeds: [statusEmbed('error', 'محرك غير معروف', ['اختر محركًا من القائمة.'])], ephemeral: true });
      if (sub === 'تشغيل') { await tokenService.enableEngine(account.token, engine.id); await engineRuntime.startEngineToken(engine.id, account.token); }
      else if (sub === 'ايقاف') { await tokenService.disableEngine(account.token, engine.id); await engineRuntime.stopEngineToken(engine.id, account.token); }
      else { await tokenService.enableEngine(account.token, engine.id); await engineRuntime.restartEngineToken(engine.id, account.token); }
      await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId: engine.id, engineName: engine.displayName, accountName: account.name, result: sub, message: `تم تنفيذ ${sub} من مركز التحكم.` });
      return interaction.reply({ embeds: [statusEmbed(sub === 'ايقاف' ? 'warning' : 'success', 'تم تنفيذ العملية', [`الحساب: **${account.name}**`, `المحرك: **${engine.displayName}**`, `الإجراء: **${sub}**`, 'سيظهر الحدث المهم في قناة العرض المحددة إن وُجدت.'])], ephemeral: true });
    }

    if (sub === 'اعدادات' || sub === 'ضبط' || sub === 'اعادة-ضبط') {
      const account = await findAccount(interaction); if (!account) return;
      const engine = getEngine(interaction.options.getString('المحرك')); if (!engine) return interaction.reply({ embeds: [statusEmbed('error', 'محرك غير معروف', ['اختر محركًا من القائمة.'])], ephemeral: true });
      if (sub === 'ضبط') { const key = settingKeys[interaction.options.getString('المفتاح')] || interaction.options.getString('المفتاح'); const val = parseSetting(key, interaction.options.getString('القيمة')); await tokenService.updateEngineSetting(account.token, engine.id, key, val); await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId: engine.id, engineName: engine.displayName, accountName: account.name, result: 'setting_updated', message: `تم تعديل ${label(key)}.`, details: { key, value: val } }); return interaction.reply({ embeds: [statusEmbed('success', 'تم تعديل الإعداد', [`الحساب: **${account.name}**`, `المحرك: **${engine.displayName}**`, `${label(key)} ← **${value(val)}**`])], ephemeral: true }); }
      if (sub === 'اعادة-ضبط') { await tokenService.resetEngineSettings(account.token, engine.id); await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId: engine.id, engineName: engine.displayName, accountName: account.name, result: 'settings_reset', message: 'تمت إعادة ضبط الإعدادات.' }); return interaction.reply({ embeds: [statusEmbed('warning', 'إعادة ضبط الإعدادات', [`الحساب: **${account.name}**`, `المحرك: **${engine.displayName}**`, 'تمت العودة إلى القيم الافتراضية.'])], ephemeral: true }); }
      const settings = await tokenService.getEngineSettings(account.token, engine.id);
      const emb = statusEmbed('info', `إعدادات ${engine.displayName}`, [`الحساب: **${account.name}**`]); Object.entries(settings || {}).forEach(([k, v]) => emb.addField(label(k), value(v), true)); return interaction.reply({ embeds: [emb], ephemeral: true });
    }

    if (sub === 'السجلات') {
      const logs = await logService.getLogs({ accountName: interaction.options.getString('الاسم') || undefined, engineId: interaction.options.getString('المحرك') || undefined, type: interaction.options.getString('النوع') || undefined, level: interaction.options.getString('المستوى') || undefined, limit: interaction.options.getInteger('العدد') || 10, page: interaction.options.getInteger('الصفحة') || 1 });
      return interaction.reply({ embeds: [embed({ title: `${ICONS.logs} السجلات`, color: COLORS.dark, description: logs.length ? logs.map(lineLog).join('\n') : 'لا توجد سجلات مطابقة.', footer: 'Logs Viewer' })], ephemeral: true });
    }

    if (sub === 'احصائيات') {
      const name = interaction.options.getString('الاسم'); const engineId = interaction.options.getString('المحرك');
      if (name) { const d = await monitorService.getAccountDetails(name); if (!d) return interaction.reply({ embeds: [statusEmbed('error', 'الحساب غير موجود', ['اختر حسابًا من الإكمال التلقائي.'])], ephemeral: true }); const stats = engineId ? (d.account.engineStats[engineId] || {}) : d.totals; const emb = statusEmbed('info', `إحصائيات ${name}`, []); Object.entries(stats).slice(0, 20).forEach(([k, v]) => emb.addField(label(k), value(v), true)); return interaction.reply({ embeds: [emb], ephemeral: true }); }
      const stats = await monitorService.getGeneralStats(); return interaction.reply({ embeds: [statusEmbed('info', 'الإحصائيات العامة', [`الأحداث: **${stats.events}**`, `الأخطاء: **${stats.errors}**`, `الفوز: **${stats.wins}** | الخسارة: **${stats.losses}**`, `الحسابات العاملة: **${stats.activeAccounts}**`])], ephemeral: true });
    }

    if (sub === 'قناة-تعيين') {
      const scope = interaction.options.getString('النطاق'); const channel = interaction.options.getChannel('القناة'); const engineId = interaction.options.getString('المحرك'); const account = interaction.options.getString('الاسم');
      const key = scope === 'engine' ? engineId : scope === 'account' ? account : undefined;
      if ((scope === 'engine' || scope === 'account') && !key) return interaction.reply({ embeds: [statusEmbed('warning', 'بيانات ناقصة', ['عند اختيار نطاق محرك يجب تحديد المحرك، وعند اختيار نطاق حساب يجب تحديد الحساب.'])], ephemeral: true });
      await channelConfigService.setChannel(interaction.guildId, scope, channel.id, key);
      await eventBus.publish({ type: 'admin_action', level: 'إداري', result: 'channel_set', engineId: scope === 'engine' ? key : undefined, accountName: scope === 'account' ? key : undefined, message: 'تم تعيين قناة عرض حي.' });
      return interaction.reply({ embeds: [statusEmbed('success', 'تم تعيين قناة العرض الحي', [`النطاق: **${scope === 'general' ? 'عام' : scope === 'engine' ? 'محرك' : 'حساب'}**`, `القناة: <#${channel.id}>`, key ? `المفتاح: **${key}**` : null, 'سيتم إرسال الأحداث المهمة فقط إلى هذا المسار.'].filter(Boolean))], ephemeral: true });
    }

    if (sub === 'قنوات') {
      const settings = await channelConfigService.getSettings(interaction.guildId);
      const rows = [`العامة: ${settings.channels.general ? `<#${settings.channels.general}>` : 'غير محددة'}`];
      rows.push(`المحركات:\n${Object.entries(settings.channels.engines).length ? Object.entries(settings.channels.engines).map(([k, v]) => `• ${k}: <#${v}>`).join('\n') : '• لا يوجد'}`);
      rows.push(`الحسابات:\n${Object.entries(settings.channels.accounts).length ? Object.entries(settings.channels.accounts).map(([k, v]) => `• ${k}: <#${v}>`).join('\n') : '• لا يوجد'}`);
      rows.push(`Zar:\n${Object.entries(settings.channels.zarAccounts || {}).length ? Object.entries(settings.channels.zarAccounts).map(([k, v]) => `• ${k}: <#${v}>`).join('\n') : '• لا يوجد'}`);
      return interaction.reply({ embeds: [statusEmbed('info', 'قنوات العرض الحي', rows)], ephemeral: true });
    }

    if (sub === 'ربط-zar') {
      const modal = new Modal().setCustomId('zar-channel-modal').setTitle('ربط حساب Zar بقناة');
      const channelId = new TextInputComponent().setCustomId('channelId').setLabel('Channel ID').setStyle('SHORT').setRequired(true);
      const accountName = new TextInputComponent().setCustomId('accountName').setLabel('اسم الحساب من قاعدة البيانات').setStyle('SHORT').setRequired(true);
      modal.addComponents(new MessageActionRow().addComponents(channelId), new MessageActionRow().addComponents(accountName));
      return interaction.showModal(modal);
    }

    if (sub === 'قناة-حذف') {
      const scope = interaction.options.getString('النطاق'); const key = scope === 'engine' ? interaction.options.getString('المحرك') : scope === 'account' ? interaction.options.getString('الاسم') : undefined;
      if ((scope === 'engine' || scope === 'account') && !key) return interaction.reply({ embeds: [statusEmbed('warning', 'بيانات ناقصة', ['حدد المحرك أو الحساب قبل حذف القناة.'])], ephemeral: true });
      await channelConfigService.removeChannel(interaction.guildId, scope, key); await eventBus.publish({ type: 'admin_action', level: 'إداري', result: 'channel_removed', message: 'تم حذف قناة عرض حي.' });
      return interaction.reply({ embeds: [statusEmbed('warning', 'تم حذف القناة', [`النطاق: **${scope}**`, key ? `المفتاح: **${key}**` : 'القناة العامة'])], ephemeral: true });
    }

    if (sub === 'تنظيف-سجلات') {
      const count = await logService.cleanupLogs({ accountName: interaction.options.getString('الاسم') || undefined, engineId: interaction.options.getString('المحرك') || undefined, level: interaction.options.getString('المستوى') || undefined, type: interaction.options.getString('النوع') || undefined, olderThanDays: interaction.options.getInteger('العمر'), mode: interaction.options.getString('الوضع') || 'archive' });
      await eventBus.publish({ type: 'admin_action', level: 'إداري', result: 'logs_cleanup', message: 'تم تنظيف السجلات.', details: { count } });
      return interaction.reply({ embeds: [statusEmbed('success', 'تنظيف السجلات', [`عدد السجلات المتأثرة: **${count}**`])], ephemeral: true });
    }
  },
};