const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, Modal, TextInputComponent } = require('discord.js');
const { na3san } = require('../config.json');
const { getEngines } = require('../services/engineRegistry');
const tokenService = require('../services/tokenService');
const gamePolicyService = require('../services/gamePolicyService');
const eventBus = require('../services/eventBus');
const { statusEmbed, embed, COLORS } = require('../utils/ui');

const modalPayloads = new Map();

function engineOption(required = true) {
  return option => getEngines().slice(0, 25).reduce((o, e) => o.addChoices({ name: `${e.displayName} (${e.id})`, value: e.id }), option.setName('المحرك').setDescription('اختر المحرك').setRequired(required));
}
function accountOption(required = true) { return option => option.setName('الحساب').setDescription('اختر الحساب من قاعدة البيانات').setRequired(required).setAutocomplete(true); }
function scopeOption() { return option => option.setName('النطاق').setDescription('مستوى الإعداد').setRequired(true).addChoices({ name: 'عام', value: 'general' }, { name: 'محرك', value: 'engine' }, { name: 'حساب', value: 'account' }); }
function opOption() { return option => option.setName('العملية').setDescription('طريقة تعديل القائمة').setRequired(true).addChoices({ name: 'استبدال', value: 'set' }, { name: 'إضافة', value: 'add' }, { name: 'حذف', value: 'remove' }, { name: 'إعادة ضبط', value: 'reset' }); }
async function autocompleteAccounts(interaction) { const focused = interaction.options.getFocused().toLowerCase(); const accounts = await tokenService.getAllTokens(); return interaction.respond(accounts.filter(a => a.name.toLowerCase().includes(focused)).slice(0, 25).map(a => ({ name: a.name, value: a.name }))); }
function idsFromText(text) { return gamePolicyService.uniqueList(text || ''); }
function resolveGuildName(client, id) { const guild = client.guilds && client.guilds.cache ? client.guilds.cache.get(String(id)) : null; return guild ? guild.name : 'غير معروف/غير متاح للبوت'; }
function listLines(ids, client) { return ids.length ? ids.map(id => `• \`${id}\` — ${resolveGuildName(client, id)}`) : ['لا توجد قيود محفوظة.']; }
function botLines(ids, client) { return ids.length ? ids.map(id => { const user = client.users && client.users.cache ? client.users.cache.get(String(id)) : null; return `• \`${id}\` — ${user ? user.tag : 'بوت غير موجود في الكاش'}`; }) : ['لا توجد بوتات مسموحة؛ سيتم تجاهل رسائل النتائج لهذا المحرك حتى تضيف بوتًا.']; }
async function accountByName(name) { return name ? tokenService.getToken(name) : null; }
function modalFor(kind, payload, label) {
  const id = `policy-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  modalPayloads.set(id, payload);
  const modal = new Modal().setCustomId(`policy-modal:${kind}:${id}`).setTitle(label);
  const input = new TextInputComponent().setCustomId('ids').setLabel('ضع المعرفات مفصولة بمسافة أو سطر جديد').setStyle('PARAGRAPH').setRequired(true);
  modal.addComponents(new MessageActionRow().addComponents(input));
  return modal;
}
async function applyServerChange({ scope, op, ids, engineId, accountName }) {
  if (scope === 'engine' && !engineId) throw new Error('يلزم تحديد المحرك لإعداد سيرفرات المحرك.');
  if (scope === 'account') {
    const account = await accountByName(accountName);
    if (!account || !engineId) throw new Error('يلزم تحديد الحساب والمحرك لإعداد سيرفرات الحساب.');
    const current = gamePolicyService.uniqueList(account.engineSettings[engineId] && account.engineSettings[engineId].allowedServers || []);
    const next = op === 'reset' ? [] : op === 'add' ? gamePolicyService.uniqueList([...current, ...ids]) : op === 'remove' ? current.filter(id => !ids.includes(id)) : ids;
    await tokenService.updateEngineSetting(account.token, engineId, 'allowedServers', next);
    return next;
  }
  const policy = await gamePolicyService.getPolicy();
  const current = scope === 'engine' ? gamePolicyService.uniqueList(policy.engineAllowedServers[engineId] || []) : policy.allowedServers;
  const next = op === 'reset' ? [] : op === 'add' ? gamePolicyService.uniqueList([...current, ...ids]) : op === 'remove' ? current.filter(id => !ids.includes(id)) : ids;
  await gamePolicyService.setAllowedServers(scope, next, engineId);
  return next;
}
async function applyBotChange({ op, ids, engineId }) {
  if (!engineId) throw new Error('يلزم تحديد المحرك لإعداد بوتات اللعبة.');
  const policy = await gamePolicyService.getPolicy();
  const current = gamePolicyService.uniqueList(policy.engineAllowedBots[engineId] || []);
  const next = op === 'reset' ? [] : op === 'add' ? gamePolicyService.uniqueList([...current, ...ids]) : op === 'remove' ? current.filter(id => !ids.includes(id)) : ids;
  await gamePolicyService.setAllowedBots(engineId, next);
  return next;
}
module.exports = {
  category: 'سياسة اللعب',
  data: new SlashCommandBuilder()
    .setName('سياسة-اللعب')
    .setDescription('إدارة منع التداخل، السيرفرات المسموحة، بوتات اللعبة، وربط اللاعب')
    .addSubcommand(sc => sc.setName('قفل').setDescription('تفعيل/تعطيل قفل منع تداخل الحسابات').addBooleanOption(o => o.setName('مفعل').setDescription('حالة القفل').setRequired(true)).addStringOption(engineOption(false)))
    .addSubcommand(sc => sc.setName('قفل-الحالة').setDescription('عرض حالة القفل والحسابات المالكة للأقفال الحالية'))
    .addSubcommand(sc => sc.setName('قفل-تفريغ').setDescription('تفريغ الأقفال الحالية يدويًا').addStringOption(engineOption(false)))
    .addSubcommand(sc => sc.setName('سيرفرات').setDescription('عرض السيرفرات المسموحة').addStringOption(scopeOption()).addStringOption(engineOption(false)).addStringOption(accountOption(false)))
    .addSubcommand(sc => sc.setName('سيرفرات-ضبط').setDescription('تعديل السيرفرات المسموحة بقائمة أو Modal').addStringOption(scopeOption()).addStringOption(opOption()).addStringOption(engineOption(false)).addStringOption(accountOption(false)).addStringOption(o => o.setName('المعرفات').setDescription('معرفات السيرفرات، ويمكن تركها لفتح Modal').setRequired(false)))
    .addSubcommand(sc => sc.setName('بوتات').setDescription('عرض بوتات اللعبة المسموحة لمحرك').addStringOption(engineOption(true)))
    .addSubcommand(sc => sc.setName('بوتات-ضبط').setDescription('تعديل بوتات اللعبة المسموحة لمحرك').addStringOption(engineOption(true)).addStringOption(opOption()).addStringOption(o => o.setName('المعرفات').setDescription('معرفات البوتات، ويمكن تركها لفتح Modal').setRequired(false)))
    .addSubcommand(sc => sc.setName('لاعب-ضبط').setDescription('تخزين معرف اللاعب للحساب داخل محرك').addStringOption(accountOption(true)).addStringOption(engineOption(true)).addStringOption(o => o.setName('playerid').setDescription('معرف/منشن/اسم اللاعب كما يظهر في رسالة النتيجة').setRequired(true)))
    .addSubcommand(sc => sc.setName('اعدادات').setDescription('عرض إعدادات حساب داخل محرك').addStringOption(accountOption(true)).addStringOption(engineOption(true))),
  async autocomplete(interaction) { if (interaction.options.getFocused(true).name === 'الحساب') return autocompleteAccounts(interaction); },
  async execute(interaction, client) {
    if (!na3san.includes(interaction.user.id)) return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['هذا الأمر للمشرفين فقط.'])], ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const policy = await gamePolicyService.getPolicy();
    if (sub === 'قفل') {
      const engineId = interaction.options.getString('المحرك'); const enabled = interaction.options.getBoolean('مفعل');
      await gamePolicyService.setOverlapLock(enabled, engineId);
      await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId, result: 'overlap_lock_changed', message: 'تم تغيير قفل منع التداخل.' });
      return interaction.reply({ embeds: [statusEmbed(enabled ? 'success' : 'warning', 'تم تحديث قفل التداخل', [`النطاق: **${engineId || 'عام'}**`, `الحالة: **${enabled ? 'مفعل' : 'معطل'}**`])], ephemeral: true });
    }
    if (sub === 'قفل-الحالة') {
      const locks = gamePolicyService.getLocks();
      return interaction.reply({ embeds: [statusEmbed('info', 'حالة قفل التداخل', [`العام: **${policy.overlapLockEnabled ? 'مفعل' : 'معطل'}**`, `تخصيص المحركات: ${Object.entries(policy.engineOverlapLocks).map(([k, v]) => `${k}=${v ? 'on' : 'off'}`).join(' • ') || 'لا يوجد'}`, `الأقفال الحالية:\n${locks.length ? locks.map(l => `• ${l.engineId}/${l.serverId || 'unknown'} — ${l.gameName} — ${l.accountName || 'حساب'}`).join('\n') : '• لا توجد أقفال نشطة'}`])], ephemeral: true });
    }
    if (sub === 'قفل-تفريغ') { const count = gamePolicyService.clearLocks(interaction.options.getString('المحرك')); return interaction.reply({ embeds: [statusEmbed('warning', 'تم تفريغ الأقفال', [`عدد الأقفال المحذوفة: **${count}**`])], ephemeral: true }); }
    if (sub === 'سيرفرات') {
      const scope = interaction.options.getString('النطاق'); const engineId = interaction.options.getString('المحرك'); const accountName = interaction.options.getString('الحساب');
      let ids = [];
      if (scope === 'account') { const account = await accountByName(accountName); ids = gamePolicyService.uniqueList(account && account.engineSettings[engineId] && account.engineSettings[engineId].allowedServers || []); }
      else if (scope === 'engine') ids = gamePolicyService.uniqueList(policy.engineAllowedServers[engineId] || []); else ids = policy.allowedServers;
      return interaction.reply({ embeds: [embed({ title: '📍 السيرفرات المسموحة', color: COLORS.info, description: listLines(ids, client).join('\n') })], ephemeral: true });
    }
    if (sub === 'سيرفرات-ضبط') {
      const payload = { scope: interaction.options.getString('النطاق'), op: interaction.options.getString('العملية'), engineId: interaction.options.getString('المحرك'), accountName: interaction.options.getString('الحساب') };
      const raw = interaction.options.getString('المعرفات');
      if (payload.op !== 'reset' && !raw) return interaction.showModal(modalFor('servers', payload, 'تعديل السيرفرات المسموحة'));
      const next = await applyServerChange({ ...payload, ids: idsFromText(raw) });
      await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId: payload.engineId, accountName: payload.accountName, result: 'allowed_servers_changed', message: 'تم تعديل السيرفرات المسموحة.' });
      return interaction.reply({ embeds: [statusEmbed('success', 'تم تحديث السيرفرات', listLines(next, client))], ephemeral: true });
    }
    if (sub === 'بوتات') { const engineId = interaction.options.getString('المحرك'); return interaction.reply({ embeds: [embed({ title: '🤖 بوتات اللعبة المسموحة', color: COLORS.info, description: botLines(gamePolicyService.uniqueList(policy.engineAllowedBots[engineId] || []), client).join('\n') })], ephemeral: true }); }
    if (sub === 'بوتات-ضبط') {
      const payload = { engineId: interaction.options.getString('المحرك'), op: interaction.options.getString('العملية') }; const raw = interaction.options.getString('المعرفات');
      if (payload.op !== 'reset' && !raw) return interaction.showModal(modalFor('bots', payload, 'تعديل بوتات اللعبة'));
      const next = await applyBotChange({ ...payload, ids: idsFromText(raw) });
      await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId: payload.engineId, result: 'allowed_bots_changed', message: 'تم تعديل بوتات اللعبة المسموحة.' });
      return interaction.reply({ embeds: [statusEmbed('success', 'تم تحديث بوتات اللعبة', botLines(next, client))], ephemeral: true });
    }
    if (sub === 'لاعب-ضبط') {
      const account = await accountByName(interaction.options.getString('الحساب')); const engineId = interaction.options.getString('المحرك'); const playerId = interaction.options.getString('playerid');
      if (!account) return interaction.reply({ embeds: [statusEmbed('error', 'الحساب غير موجود', ['اختر حسابًا من الإكمال التلقائي.'])], ephemeral: true });
      await tokenService.updateEngineSetting(account.token, engineId, 'playerId', playerId);
      await eventBus.publish({ type: 'admin_action', level: 'إداري', engineId, accountName: account.name, result: 'player_id_changed', message: 'تم تعديل معرف اللاعب.' });
      return interaction.reply({ embeds: [statusEmbed('success', 'تم ربط اللاعب', [`الحساب: **${account.name}**`, `المحرك: **${engineId}**`, `Player ID: \`${playerId}\``])], ephemeral: true });
    }
    if (sub === 'اعدادات') {
      const account = await accountByName(interaction.options.getString('الحساب')); const engineId = interaction.options.getString('المحرك');
      const settings = account && account.engineSettings ? account.engineSettings[engineId] || {} : {};
      return interaction.reply({ embeds: [statusEmbed('info', 'إعدادات اللعب للحساب', [`الحساب: **${account ? account.name : 'غير موجود'}**`, `المحرك: **${engineId}**`, `منع التداخل: **${gamePolicyService.isOverlapLockEnabled(policy, engineId) ? 'مفعل' : 'معطل'}**`, `السيرفرات المسموحة للحساب: ${gamePolicyService.uniqueList(settings.allowedServers || []).join(', ') || 'يرث من المحرك/العام'}`, `Player ID: ${settings.playerId ? `\`${settings.playerId}\`` : 'غير محدد'}`])], ephemeral: true });
    }
  },
  applyServerChange,
  applyBotChange,
  idsFromText,
  modalPayloads,
};
