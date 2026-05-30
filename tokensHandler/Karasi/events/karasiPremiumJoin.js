module.exports = {
  name: 'messageCreate',
  eventType: 'game_join',
  gameName: 'كراسي',
  async execute(message) {
    if (!message.content.includes('كراسي')) return { handled: false };

    const collector = message.channel.createMessageCollector({ filter: (msg) => msg.author.bot && msg.components && msg.components.length > 0, time: 5000 });
    collector.on('collect', async msg => {
      const button = msg.components[0].components[0];
      if (button && button.type === 'BUTTON') {
        await msg.clickButton(button.customId);
        collector.stop();
      }
    });
    collector.on('end', (collected) => {
      console.log(`Collected ${collected.size} messages on karasi`);
    });

    const messages = await message.channel.messages.fetch({ limit: 10 });
    for (const msg of messages.values()) {
      if (msg.author.bot && msg.components && msg.components.length > 0) {
        const button = msg.components[0].components[0];
        if (button && button.type === 'BUTTON') await msg.clickButton(button.customId);
      }
    }

    return {
      handled: true,
      type: 'game_join',
      result: 'join',
      gameName: 'كراسي',
      message: 'تم دخول لعبة كراسي من رسالة مميزة.',
    };
  },
};
