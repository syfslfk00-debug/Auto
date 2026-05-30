module.exports = {
  name: 'messageCreate',
  eventType: 'game_join',
  gameName: 'كراسي',
  async execute(message) {
    if (!message.author.bot) return { handled: false };
    if (message.embeds.length === 0) return { handled: false };

    const embed = message.embeds[0];
    if (embed.title !== 'كراسي') return { handled: false };

    const components = message.components;
    if (!components || components.length === 0) return { handled: false };

    const jb = components[0].components[0];
    if (!jb) return { handled: false };

    await message.clickButton(jb.customId);
    return {
      handled: true,
      type: 'game_join',
      result: 'join',
      gameName: 'كراسي',
      message: 'تم دخول لعبة كراسي.',
    };
  },
};
