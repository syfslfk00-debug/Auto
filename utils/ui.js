const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');

const COLORS = {
  primary: '#5865F2', success: '#57F287', danger: '#ED4245', warning: '#FEE75C', info: '#3498DB', dark: '#2B2D31', live: '#9B59B6'
};
const ICONS = { ok: '✅', err: '⛔', warn: '⚠️', info: 'ℹ️', live: '📡', engine: '🎮', account: '👤', stats: '📊', logs: '📜', settings: '⚙️', channel: '📺', panel: '🧭' };
function line() { return '━━━━━━━━━━━━━━━━━━━━'; }
function fmtDate(value) { if (!value) return 'لا يوجد'; const d = new Date(value); return Number.isNaN(d.getTime()) ? 'لا يوجد' : d.toLocaleString('ar'); }
function value(v) { if (v === true) return 'مفعل'; if (v === false) return 'غير مفعل'; if (v === 'auto') return 'تلقائي'; if (v == null || v === '') return 'لا يوجد'; if (String(v).match(/^\d{4}-\d{2}-\d{2}T/)) return fmtDate(v); return String(v); }
function embed({ title, description, color = COLORS.primary, footer = 'Auto Control Center' }) { return new MessageEmbed().setColor(color).setTitle(title).setDescription(description || '—').setFooter({ text: footer }).setTimestamp(); }
function statusEmbed(kind, title, rows = [], extra = {}) {
  const map = { success: [COLORS.success, ICONS.ok], error: [COLORS.danger, ICONS.err], warning: [COLORS.warning, ICONS.warn], info: [COLORS.info, ICONS.info], live: [COLORS.live, ICONS.live] };
  const [color, icon] = map[kind] || map.info;
  return embed({ title: `${icon} ${title}`, color, description: [line(), ...rows, line()].filter(Boolean).join('\n'), ...extra });
}
function chunkButtons(buttons) { const rows = []; for (let i = 0; i < buttons.length; i += 5) rows.push(new MessageActionRow().addComponents(buttons.slice(i, i + 5))); return rows; }
function button(id, label, style = 'PRIMARY', emoji) { const b = new MessageButton().setCustomId(id).setLabel(label).setStyle(style); if (emoji) b.setEmoji(emoji); return b; }
function truncate(text, max = 900) { const s = String(text || ''); return s.length > max ? `${s.slice(0, max - 1)}…` : s; }
module.exports = { COLORS, ICONS, line, fmtDate, value, embed, statusEmbed, chunkButtons, button, truncate };
