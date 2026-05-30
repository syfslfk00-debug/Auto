const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { na3san } = require('../config.json');
const tokenService = require('../services/tokenService');
const engineRuntime = require('../services/engineRuntime');
const { getEngine } = require('../services/engineRegistry');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('engine:')) return;

    if (!na3san.includes(interaction.user.id)) {
      return interaction.reply({ content: 'ليست لديك صلاحية استخدام هذا الزر.', ephemeral: true });
    }

    const [, engineId, action] = interaction.customId.split(':');
    const engine = getEngine(engineId);
    if (!engine || !['on', 'off'].includes(action)) {
      return interaction.reply({ content: 'الإجراء المطلوب غير معروف.', ephemeral: true });
    }

    const tokens = await tokenService.getAllTokensForSelectMenu();
    if (tokens.length === 0) return interaction.reply({ content: 'لا توجد حسابات محفوظة.', ephemeral: true });

    const menuId = `menu-${Math.floor(Math.random() * 9000000) + 1000000}`;
    const menu = new MessageSelectMenu()
      .setCustomId(menuId)
      .setPlaceholder('اختر حسابًا')
      .addOptions(tokens.map(token => ({ label: token.key, value: token.value })));

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
  },
};
