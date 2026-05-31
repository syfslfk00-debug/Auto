const { SlashCommandBuilder } = require('@discordjs/builders');
const { na3san } = require('../config.json');
const { getEngines } = require('../services/engineRegistry');
const gamePolicyService = require('../services/gamePolicyService');
const eventBus = require('../services/eventBus');
const { statusEmbed } = require('../utils/ui');

function engineOption(option) {
  return getEngines().slice(0, 25).reduce(
    (builder, engine) => builder.addChoices({ name: `${engine.displayName} (${engine.id})`, value: engine.id }),
    option.setName('engine').setDescription('Choose the engine to toggle bot filtering for').setRequired(true)
  );
}

module.exports = {
  category: 'سياسة اللعب',
  data: new SlashCommandBuilder()
    .setName('toggle_bot_filter')
    .setDescription('Toggle allowed-bot filtering for one engine without deleting its saved bot list')
    .addStringOption(engineOption),
  async execute(interaction) {
    if (!na3san.includes(interaction.user.id)) {
      return interaction.reply({ embeds: [statusEmbed('error', 'صلاحية مرفوضة', ['هذا الأمر للمشرفين فقط.'])], ephemeral: true });
    }

    const engineId = interaction.options.getString('engine');
    const result = await gamePolicyService.toggleBotFilter(engineId);
    const allowedBots = (result.policy.engineAllowedBots && result.policy.engineAllowedBots[engineId]) || [];
    await eventBus.publish({
      type: 'admin_action',
      level: 'إداري',
      engineId,
      result: 'bot_filter_toggled',
      message: 'تم تبديل فلترة بوتات اللعبة لمحرك.',
      details: { botFilterEnabled: result.enabled, savedBots: allowedBots.length },
    });

    return interaction.reply({
      embeds: [statusEmbed(result.enabled ? 'success' : 'warning', 'تم تبديل فلترة البوتات', [
        `المحرك: **${engineId}**`,
        result.enabled ? 'فلترة البوتات الآن: **مفعّلة**' : 'فلترة البوتات الآن: **معطّلة – المحرك يستجيب لكل البوتات**',
        `قائمة البوتات المحفوظة لم تُحذف: **${allowedBots.length}** بوت`,
      ])],
      ephemeral: true,
    });
  },
};
