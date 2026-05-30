const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { na3san } = require('../config.json');
const tokenService = require('../services/tokenService');
const engineRuntime = require('../services/engineRuntime');
const monitorService = require('../services/monitorService');
const logService = require('../services/logService');
const { getEngines, getEngine } = require('../services/engineRegistry');
const eventBus = require('../services/eventBus');

// ألوان الإمبيد الموحدة
const COLORS = {
  PRIMARY: '#5865F2',   // أزرق ديسكورد
  SUCCESS: '#57F287',   // أخضر
  DANGER: '#ED4245',    // أحمر
  WARNING: '#FEE75C',   // أصفر
  INFO: '#5865F2',      // أزرق
  SECONDARY: '#2F3136', // رمادي غامق (للخلفيات)
};

// رموز تعبيرية (إيموجي) موحدة
const EMOJI = {
  ACTIVE: '🟢',
  DISABLED: '🔴',
  RUNNING: '▶️',
  STOPPED: '⏹️',
  ERROR: '⚠️',
  SETTINGS: '⚙️',
  LOGS: '📋',
  STATS: '📊',
  MONITOR: '🖥️',
  SUCCESS: '✅',
  WARNING: '⚠️',
  INFO: 'ℹ️',
};

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
      const embed = new MessageEmbed()
        .setColor(COLORS.DANGER)
        .setTitle(`${EMOJI.ERROR} صلاحية مرفوضة`)
        .setDescription('ليست لديك صلاحية استخدام هذا الأمر.')
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    // ─── عرض جميع الحسابات ───────────────────────────
    if (subcommand === 'الحسابات') {
      const accounts = await tokenService.getAllTokens();
      const embed = new MessageEmbed()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJI.INFO} الحسابات المحفوظة`)
        .setDescription(
          accounts.length > 0
            ? accounts.map((account, idx) => {
                const statusEmoji = account.status === 'active' ? EMOJI.ACTIVE : EMOJI.DISABLED;
                return `**${idx + 1}.** ${statusEmoji} **${account.name}** — ${translateStatus(account.status)}`;
              }).join('\n')
            : 'لا توجد حسابات محفوظة.'
        )
        .setFooter({ text: `العدد الإجمالي: ${accounts.length} حساب` })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── تفاصيل حساب محدد ────────────────────────────
    if (subcommand === 'حساب') {
      const account = await findAccount(interaction);
      if (!account) return;
      const details = await monitorService.getAccountDetails(account.name);
      const statusEmoji = account.status === 'active' ? EMOJI.ACTIVE : EMOJI.DISABLED;
      const embed = new MessageEmbed()
        .setColor(account.status === 'active' ? COLORS.SUCCESS : COLORS.DANGER)
        .setTitle(`${statusEmoji} تفاصيل الحساب: ${account.name}`)
        .addField('الحالة العامة', translateStatus(account.status), true)
        .addField('إجمالي الأحداث', String(details.totals.events), true)
        .addField('الأخطاء', String(details.totals.errors), true);

      details.engines.forEach(item => {
        const engineStatusEmoji = item.status === 'running' ? EMOJI.RUNNING : EMOJI.STOPPED;
        embed.addField(
          `${engineStatusEmoji} ${item.engineName}`,
          `الحالة: ${item.status}\n` +
          `التفعيل: ${item.enabled ? 'مفعل' : 'غير مفعل'}\n` +
          `آخر نشاط: ${formatDate(item.runtime.lastActivityAt || item.stats.lastActivityAt)}\n` +
          `آخر خطأ: ${item.runtime.lastError || item.stats.lastError || 'لا يوجد'}`,
          true
        );
      });

      embed.setFooter({ text: `آخر تحديث` }).setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── عرض المحركات المسجلة ────────────────────────
    if (subcommand === 'المحركات') {
      const overview = await monitorService.getSystemOverview();
      const embed = new MessageEmbed()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJI.MONITOR} المحركات المسجلة`)
        .setDescription(
          overview.engines.length > 0
            ? overview.engines.map(engine =>
                `**${engine.name}**\n` +
                `> مفعلة: ${engine.enabledCount} | عاملة: ${engine.activeCount} | متوقفة: ${engine.stoppedCount}`
              ).join('\n\n')
            : 'لا توجد محركات مسجلة.'
        )
        .setFooter({ text: `إجمالي المحركات: ${overview.engines.length}` })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── تفاصيل محرك محدد ────────────────────────────
    if (subcommand === 'محرك') {
      const engineId = interaction.options.getString('المحرك');
      const details = await monitorService.getEngineDetails(engineId);
      if (!details) return interaction.reply({ content: 'لم يتم العثور على المحرك.', ephemeral: true });
      const embed = new MessageEmbed()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJI.INFO} تفاصيل المحرك: ${details.engine.displayName}`)
        .addField('الحسابات المفعلة', String(details.enabledCount), true)
        .addField('العاملة', String(details.activeCount), true)
        .addField('المتوقفة', String(details.stoppedCount), true);

      if (details.accounts.length > 0) {
        const accountsPreview = details.accounts.slice(0, 10)
          .map(account => `${account.running ? EMOJI.RUNNING : EMOJI.STOPPED} **${account.name}**`)
          .join('\n');
        embed.addField('الحسابات (أول 10)', accountsPreview);
      }
      embed.setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── تشغيل / إيقاف / إعادة تشغيل ─────────────────
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

      const actionMap = {
        'تشغيل': { emoji: EMOJI.SUCCESS, color: COLORS.SUCCESS },
        'ايقاف': { emoji: EMOJI.WARNING, color: COLORS.WARNING },
        'اعادة-تشغيل': { emoji: EMOJI.INFO, color: COLORS.INFO },
      };
      const embed = new MessageEmbed()
        .setColor(actionMap[subcommand].color)
        .setTitle(`${actionMap[subcommand].emoji} تم تنفيذ الإجراء`)
        .setDescription(`**${subcommand}** لمحرك **${engine.displayName}** على الحساب **${account.name}**`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── عرض الإعدادات ───────────────────────────────
    if (subcommand === 'اعدادات') {
      const account = await findAccount(interaction);
      if (!account) return;
      const engineId = interaction.options.getString('المحرك');
      const engine = getEngine(engineId);
      if (!engine) return interaction.reply({ content: 'لم يتم العثور على المحرك.', ephemeral: true });
      const settings = await tokenService.getEngineSettings(account.token, engine.id);

      const embed = new MessageEmbed()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJI.SETTINGS} إعدادات ${engine.displayName}`)
        .setDescription(`الحساب: **${account.name}**`);

      if (settings && Object.keys(settings).length > 0) {
        Object.entries(settings).forEach(([key, value]) => {
          embed.addField(settingLabel(key), settingValue(value), true);
        });
      } else {
        embed.addField('ملاحظة', 'لا توجد إعدادات محفوظة.', false);
      }

      embed.setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── تعديل إعداد ─────────────────────────────────
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

      const embed = new MessageEmbed()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJI.SUCCESS} تم تعديل الإعداد`)
        .setDescription(
          `**المحرك:** ${engine.displayName}\n` +
          `**الحساب:** ${account.name}\n` +
          `**الإعداد:** ${settingLabel(key)}\n` +
          `**القيمة الجديدة:** ${settingValue(value)}`
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── إعادة ضبط الإعدادات ─────────────────────────
    if (subcommand === 'اعادة-ضبط') {
      const account = await findAccount(interaction);
      if (!account) return;
      const engineId = interaction.options.getString('المحرك');
      const engine = getEngine(engineId);
      if (!engine) return interaction.reply({ content: 'لم يتم العثور على المحرك.', ephemeral: true });
      await tokenService.resetEngineSettings(account.token, engine.id);
      await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId: engine.id, engineName: engine.displayName, accountName: account.name, result: 'settings_reset', message: 'تمت إعادة ضبط إعدادات المحرك.' });

      const embed = new MessageEmbed()
        .setColor(COLORS.WARNING)
        .setTitle(`${EMOJI.WARNING} إعادة ضبط الإعدادات`)
        .setDescription(`تمت إعادة ضبط إعدادات **${engine.displayName}** للحساب **${account.name}** إلى الافتراضيات.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── عرض السجلات ─────────────────────────────────
    if (subcommand === 'السجلات') {
      const name = interaction.options.getString('الاسم');
      const logs = await logService.getLogs({
        accountName: name || undefined,
        engineId: interaction.options.getString('المحرك') || undefined,
        type: interaction.options.getString('النوع') || undefined,
        limit: interaction.options.getInteger('العدد') || 10,
      });

      const embed = new MessageEmbed()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJI.LOGS} السجلات`)
        .setTimestamp();

      if (logs.length > 0) {
        const logText = logs.map(logLine).join('\n');
        embed.setDescription(`\`\`\`\n${logText}\n\`\`\``);
      } else {
        embed.setDescription('لا توجد سجلات مطابقة.');
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── الإحصائيات ──────────────────────────────────
    if (subcommand === 'احصائيات') {
      const name = interaction.options.getString('الاسم');
      const engineId = interaction.options.getString('المحرك');

      if (name) {
        const details = await monitorService.getAccountDetails(name);
        if (!details) return interaction.reply({ content: 'لم يتم العثور على الحساب.', ephemeral: true });
        const stats = engineId ? (details.account.engineStats[engineId] || {}) : details.totals;
        const embed = new MessageEmbed()
          .setColor(COLORS.INFO)
          .setTitle(`${EMOJI.STATS} إحصائيات ${name}`)
          .setTimestamp();

        if (Object.keys(stats).length > 0) {
          Object.entries(stats).forEach(([key, value]) => {
            embed.addField(settingLabel(key), settingValue(value), true);
          });
        } else {
          embed.setDescription('لا توجد إحصائيات لهذا الحساب.');
        }
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (engineId) {
        const details = await monitorService.getEngineDetails(engineId);
        if (!details) return interaction.reply({ content: 'لم يتم العثور على المحرك.', ephemeral: true });
        const events = details.accounts.reduce((sum, account) => sum + Number(account.stats.events || 0), 0);
        const errors = details.accounts.reduce((sum, account) => sum + Number(account.stats.errors || 0), 0);
        const embed = new MessageEmbed()
          .setColor(COLORS.INFO)
          .setTitle(`${EMOJI.STATS} إحصائيات ${details.engine.displayName}`)
          .addField('الأحداث', String(events), true)
          .addField('الأخطاء', String(errors), true)
          .addField('الحسابات العاملة', String(details.activeCount), true)
          .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const stats = await monitorService.getGeneralStats();
      const embed = new MessageEmbed()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJI.STATS} الإحصائيات العامة`)
        .addField('الأحداث', String(stats.events), true)
        .addField('الأخطاء', String(stats.errors), true)
        .addField('الانتصارات', String(stats.wins), true)
        .addField('الخسائر', String(stats.losses), true)
        .addField('الحسابات العاملة', String(stats.activeAccounts), true)
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── مراقبة النظام (الوضع الافتراضي) ─────────────
    const overview = await monitorService.getSystemOverview();
    const embed = new MessageEmbed()
      .setColor(COLORS.PRIMARY)
      .setTitle(`${EMOJI.MONITOR} مراقبة النظام`)
      .setDescription(
        `**الحسابات:** ${overview.totalAccounts}\n` +
        `**العاملة:** ${overview.activeAccounts}\n` +
        `**المتوقفة:** ${overview.stoppedAccounts}\n` +
        `**الأخطاء الأخيرة:** ${overview.recentErrors}`
      );

    overview.engines.forEach(engine => {
      embed.addField(
        `🔹 ${engine.name}`,
        `> عاملة: ${engine.activeCount}\n` +
        `> مفعلة: ${engine.enabledCount}`,
        true
      );
    });

    embed.setFooter({ text: 'نظام الإدارة المتقدمة' }).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};