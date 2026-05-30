const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { na3san } = require('../config.json');
const tokenService = require('../services/tokenService');
const engineRuntime = require('../services/engineRuntime');
const monitorService = require('../services/monitorService');
const logService = require('../services/logService');
const { getEngines, getEngine } = require('../services/engineRegistry');
const eventBus = require('../services/eventBus');

const settingKeys = {
  'التفعيل': 'enabled',
  'التأخير': 'delay',
  'السلوك': 'behavior',
};

function formatDate(value) {
  if (!value) return 'لا يوجد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'لا يوجد';
  return date.toLocaleString('ar');
}

function translateStatus(value) {
  if (value === 'active') return 'نشط';
  if (value === 'disabled') return 'معطل';
  if (value === 'running') return 'يعمل';
  if (value === 'stopped') return 'متوقف';
  if (value === 'error') return 'خطأ';
  return value || 'غير معروف';
}

function settingLabel(key) {
  const labels = {
    enabled: 'التفعيل',
    delay: 'التأخير',
    behavior: 'السلوك',
    events: 'الأحداث',
    starts: 'مرات التشغيل',
    stops: 'مرات الإيقاف',
    loginFailures: 'فشل تسجيل الدخول',
    errors: 'الأخطاء',
    wins: 'الانتصارات',
    losses: 'الخسائر',
    joins: 'مرات الدخول',
    plays: 'مرات اللعب',
    timeouts: 'انتهاء المهلة',
    lastActivityAt: 'آخر نشاط',
    lastEventType: 'آخر نوع حدث',
    lastGame: 'آخر لعبة',
    lastServer: 'آخر سيرفر',
    lastError: 'آخر خطأ',
    lastErrorAt: 'وقت آخر خطأ',
  };
  return labels[key] || key;
}

function settingValue(value) {
  if (value === true) return 'مفعل';
  if (value === false) return 'غير مفعل';
  if (value === 'auto') return 'تلقائي';
  if (value instanceof Date) return formatDate(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDate(value);
  return value === undefined || value === null || value === '' ? 'لا يوجد' : String(value);
}

function parseSettingValue(key, value) {
  if (key === 'enabled') return ['نعم', 'مفعل', 'تشغيل', 'true', '1'].includes(String(value).trim());
  if (key === 'delay') {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }
  if (String(value).trim() === 'تلقائي') return 'auto';
  return String(value).trim();
}

function addAccountOptions(subcommand) {
  return subcommand
    .addStringOption(option => option.setName('الاسم').setDescription('اسم الحساب').setRequired(true));
}

function addEngineOptions(subcommand) {
  return subcommand
    .addStringOption(option => option.setName('المحرك').setDescription('معرف المحرك داخل السجل').setRequired(true));
}

function addLogFilterOptions(subcommand) {
  return subcommand
    .addStringOption(option => option.setName('الاسم').setDescription('اسم الحساب').setRequired(false))
    .addStringOption(option => option.setName('المحرك').setDescription('معرف المحرك').setRequired(false))
    .addStringOption(option => option.setName('النوع').setDescription('نوع الحدث').setRequired(false))
    .addStringOption(option => option.setName('المستوى').setDescription('مستوى السجل').setRequired(false));
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
  return `• ${log.level || 'تشغيلي'} — ${log.engineName || log.engineId || 'محرك'} — ${log.accountName || 'حساب غير معروف'} — ${translateEventType(log.type)} — ${log.result || 'لا يوجد'} — ${formatDate(log.createdAt)}`;
}

async function findAccount(interaction) {
  const name = interaction.options.getString('الاسم');
  const account = await tokenService.getToken(name);
  if (!account) await interaction.reply({ content: 'لم يتم العثور على الحساب.', ephemeral: true });
  return account;
}

module.exports = {
  category: 'الإدارة المتقدمة',
  data: new SlashCommandBuilder()
    .setName('ادارة')
    .setDescription('إدارة الحسابات والمحركات والسجلات والإحصائيات')
    .addSubcommand(subcommand => subcommand.setName('الحسابات').setDescription('عرض الحسابات المحفوظة'))
    .addSubcommand(subcommand => addAccountOptions(subcommand.setName('حساب').setDescription('عرض تفاصيل حساب محدد')))
    .addSubcommand(subcommand => subcommand.setName('المحركات').setDescription('عرض المحركات المسجلة وحالتها'))
    .addSubcommand(subcommand => addEngineOptions(subcommand.setName('محرك').setDescription('عرض تفاصيل محرك محدد')))
    .addSubcommand(subcommand => addEngineOptions(addAccountOptions(subcommand.setName('تشغيل').setDescription('تشغيل محرك لحساب'))))
    .addSubcommand(subcommand => addEngineOptions(addAccountOptions(subcommand.setName('ايقاف').setDescription('إيقاف محرك لحساب'))))
    .addSubcommand(subcommand => addEngineOptions(addAccountOptions(subcommand.setName('اعادة-تشغيل').setDescription('إعادة تشغيل محرك لحساب'))))
    .addSubcommand(subcommand => addEngineOptions(addAccountOptions(subcommand.setName('اعدادات').setDescription('عرض إعدادات محرك لحساب'))))
    .addSubcommand(subcommand => addEngineOptions(addAccountOptions(subcommand.setName('ضبط').setDescription('تعديل إعداد لمحرك حساب')))
      .addStringOption(option => option.setName('المفتاح').setDescription('التفعيل أو التأخير أو السلوك أو أي مفتاح مستقبلي').setRequired(true))
      .addStringOption(option => option.setName('القيمة').setDescription('القيمة الجديدة').setRequired(true)))
    .addSubcommand(subcommand => addEngineOptions(addAccountOptions(subcommand.setName('اعادة-ضبط').setDescription('إعادة ضبط إعدادات محرك حساب'))))
    .addSubcommand(subcommand => addLogFilterOptions(subcommand.setName('السجلات').setDescription('عرض السجلات'))
      .addIntegerOption(option => option.setName('العدد').setDescription('عدد النتائج').setRequired(false))
      .addIntegerOption(option => option.setName('الصفحة').setDescription('رقم الصفحة').setRequired(false)))
    .addSubcommand(subcommand => addLogFilterOptions(subcommand.setName('حذف-سجلات').setDescription('حذف سجلات يدويًا'))
      .addIntegerOption(option => option.setName('العمر').setDescription('أقدم من عدد أيام').setRequired(false)))
    .addSubcommand(subcommand => addLogFilterOptions(
      subcommand.setName('تنظيف-سجلات').setDescription('أرشفة أو حذف سجلات قديمة')
        .addIntegerOption(option => option.setName('العمر').setDescription('أقدم من عدد أيام').setRequired(true))
    ).addStringOption(option => option.setName('الوضع').setDescription('أرشفة أو حذف').setRequired(false)))
    .addSubcommand(subcommand => subcommand.setName('سياسة-السجلات').setDescription('عرض أو تعديل سياسة الاحتفاظ بالسجلات')
      .addStringOption(option => option.setName('المستوى').setDescription('مستوى السجل').setRequired(false))
      .addIntegerOption(option => option.setName('الايام').setDescription('عدد أيام الاحتفاظ').setRequired(false)))
    .addSubcommand(subcommand => subcommand.setName('احصائيات').setDescription('عرض الإحصائيات')
      .addStringOption(option => option.setName('الاسم').setDescription('اسم الحساب').setRequired(false))
      .addStringOption(option => option.setName('المحرك').setDescription('معرف المحرك').setRequired(false)))
    .addSubcommand(subcommand => subcommand.setName('مراقبة').setDescription('عرض الحالة الحالية للنظام')),
  async execute(interaction) {
    if (!na3san.includes(interaction.user.id)) {
      return interaction.reply({ content: 'ليست لديك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'الحسابات') {
      const accounts = await tokenService.getAllTokens();
      const embed = new MessageEmbed()
        .setTitle('الحسابات المحفوظة')
        .setDescription(accounts.length > 0 ? accounts.map(account => `• ${account.name} — ${translateStatus(account.status)}`).join('\n') : 'لا توجد حسابات محفوظة.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'حساب') {
      const account = await findAccount(interaction);
      if (!account) return;
      const details = await monitorService.getAccountDetails(account.name);
      const embed = new MessageEmbed()
        .setTitle(`تفاصيل الحساب: ${account.name}`)
        .setDescription([
          `الحالة: ${translateStatus(account.status)}`,
          `إجمالي الأحداث: ${details.totals.events}`,
          `الأخطاء: ${details.totals.errors}`,
        ].join('\n'));
      for (const item of details.engines) {
        embed.addField(item.engineName, `الحالة: ${item.status}\nالتفعيل: ${item.enabled ? 'مفعل' : 'غير مفعل'}\nآخر نشاط: ${formatDate(item.runtime.lastActivityAt || item.stats.lastActivityAt)}\nآخر خطأ: ${item.runtime.lastError || item.stats.lastError || 'لا يوجد'}`, true);
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'المحركات') {
      const overview = await monitorService.getSystemOverview();
      const embed = new MessageEmbed()
        .setTitle('المحركات المسجلة')
        .setDescription(overview.engines.map(engine => `• ${engine.name}: مفعلة ${engine.enabledCount}، عاملة ${engine.activeCount}، متوقفة ${engine.stoppedCount}`).join('\n') || 'لا توجد محركات.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'محرك') {
      const engineId = interaction.options.getString('المحرك');
      const details = await monitorService.getEngineDetails(engineId);
      if (!details) return interaction.reply({ content: 'لم يتم العثور على المحرك.', ephemeral: true });
      const embed = new MessageEmbed()
        .setTitle(`تفاصيل المحرك: ${details.engine.displayName}`)
        .setDescription(`الحسابات المفعلة: ${details.enabledCount}\nالحسابات العاملة: ${details.activeCount}\nالحسابات المتوقفة: ${details.stoppedCount}`);
      if (details.accounts.length > 0) {
        embed.addField('الحسابات', details.accounts.slice(0, 10).map(account => `• ${account.name} — ${account.running ? 'يعمل' : 'متوقف'}`).join('\n'));
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (['تشغيل', 'ايقاف', 'اعادة-تشغيل'].includes(subcommand)) {
      const account = await findAccount(interaction);
      if (!account) return;
      const engineId = interaction.options.getString('المحرك');
      const engine = getEngine(engineId);
      if (!engine) return interaction.reply({ content: 'لم يتم العثور على المحرك.', ephemeral: true });

      if (subcommand === 'تشغيل') {
        await tokenService.enableEngine(account.token, engine.id);
        await engineRuntime.startEngineToken(engine.id, account.token);
      } else if (subcommand === 'ايقاف') {
        await tokenService.disableEngine(account.token, engine.id);
        await engineRuntime.stopEngineToken(engine.id, account.token);
      } else {
        await tokenService.enableEngine(account.token, engine.id);
        await engineRuntime.restartEngineToken(engine.id, account.token);
      }

      await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId: engine.id, engineName: engine.displayName, accountName: account.name, result: subcommand, message: `تم تنفيذ إجراء ${subcommand} من ديسكورد.` });
      return interaction.reply({ content: `تم تنفيذ إجراء ${subcommand} لمحرك ${engine.displayName} على الحساب ${account.name}.`, ephemeral: true });
    }

    if (subcommand === 'اعدادات') {
      const account = await findAccount(interaction);
      if (!account) return;
      const engineId = interaction.options.getString('المحرك');
      const engine = getEngine(engineId);
      if (!engine) return interaction.reply({ content: 'لم يتم العثور على المحرك.', ephemeral: true });
      const settings = await tokenService.getEngineSettings(account.token, engine.id);
      const embed = new MessageEmbed()
        .setTitle(`إعدادات ${engine.displayName} للحساب ${account.name}`)
        .setDescription(Object.entries(settings || {}).map(([key, value]) => `• ${settingLabel(key)}: ${settingValue(value)}`).join('\n') || 'لا توجد إعدادات.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'ضبط') {
      const account = await findAccount(interaction);
      if (!account) return;
      const engineId = interaction.options.getString('المحرك');
      const engine = getEngine(engineId);
      if (!engine) return interaction.reply({ content: 'لم يتم العثور على المحرك.', ephemeral: true });
      const rawKey = interaction.options.getString('المفتاح');
      const key = settingKeys[rawKey] || rawKey;
      const value = parseSettingValue(key, interaction.options.getString('القيمة'));
      await tokenService.updateEngineSetting(account.token, engine.id, key, value);
      await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId: engine.id, engineName: engine.displayName, accountName: account.name, result: 'setting_updated', message: `تم تعديل إعداد ${settingLabel(key)}.`, details: { key, value } });
      return interaction.reply({ content: `تم تعديل إعداد ${settingLabel(key)} للحساب ${account.name}.`, ephemeral: true });
    }

    if (subcommand === 'اعادة-ضبط') {
      const account = await findAccount(interaction);
      if (!account) return;
      const engineId = interaction.options.getString('المحرك');
      const engine = getEngine(engineId);
      if (!engine) return interaction.reply({ content: 'لم يتم العثور على المحرك.', ephemeral: true });
      await tokenService.resetEngineSettings(account.token, engine.id);
      await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId: engine.id, engineName: engine.displayName, accountName: account.name, result: 'settings_reset', message: 'تمت إعادة ضبط إعدادات المحرك.' });
      return interaction.reply({ content: `تمت إعادة ضبط إعدادات ${engine.displayName} للحساب ${account.name}.`, ephemeral: true });
    }

    if (subcommand === 'السجلات') {
      const name = interaction.options.getString('الاسم');
      const logs = await logService.getLogs({
        accountName: name || undefined,
        engineId: interaction.options.getString('المحرك') || undefined,
        type: interaction.options.getString('النوع') || undefined,
        limit: interaction.options.getInteger('العدد') || 10,
      });
      const embed = new MessageEmbed()
        .setTitle('السجلات')
        .setDescription(logs.length > 0 ? logs.map(logLine).join('\n') : 'لا توجد سجلات مطابقة.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'احصائيات') {
      const name = interaction.options.getString('الاسم');
      const engineId = interaction.options.getString('المحرك');
      if (name) {
        const details = await monitorService.getAccountDetails(name);
        if (!details) return interaction.reply({ content: 'لم يتم العثور على الحساب.', ephemeral: true });
        const stats = engineId ? (details.account.engineStats[engineId] || {}) : details.totals;
        const embed = new MessageEmbed()
          .setTitle(`إحصائيات ${name}`)
          .setDescription(Object.entries(stats).map(([key, value]) => `• ${settingLabel(key)}: ${settingValue(value)}`).join('\n') || 'لا توجد إحصائيات.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (engineId) {
        const details = await monitorService.getEngineDetails(engineId);
        if (!details) return interaction.reply({ content: 'لم يتم العثور على المحرك.', ephemeral: true });
        const events = details.accounts.reduce((sum, account) => sum + Number(account.stats.events || 0), 0);
        const errors = details.accounts.reduce((sum, account) => sum + Number(account.stats.errors || 0), 0);
        return interaction.reply({ content: `إحصائيات ${details.engine.displayName}: الأحداث ${events}، الأخطاء ${errors}، الحسابات العاملة ${details.activeCount}.`, ephemeral: true });
      }

      const stats = await monitorService.getGeneralStats();
      return interaction.reply({ content: `الإحصائيات العامة: الأحداث ${stats.events}، الأخطاء ${stats.errors}، الانتصارات ${stats.wins}، الخسائر ${stats.losses}، الحسابات العاملة ${stats.activeAccounts}.`, ephemeral: true });
    }

    const overview = await monitorService.getSystemOverview();
    const embed = new MessageEmbed()
      .setTitle('مراقبة النظام')
      .setDescription(`الحسابات: ${overview.totalAccounts}\nالعاملة: ${overview.activeAccounts}\nالمتوقفة: ${overview.stoppedAccounts}\nالأخطاء الأخيرة: ${overview.recentErrors}`);
    for (const engine of overview.engines) {
      embed.addField(engine.name, `عاملة: ${engine.activeCount}\nمفعلة: ${engine.enabledCount}`, true);
    }
    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};