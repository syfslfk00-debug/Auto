module.exports = {
    name: 'messageCreate',
    async execute(message) {
     if (!message.author.bot) return;
      if (message.embeds.length > 0) {
        const embed = message.embeds[0];
      if (embed.title === 'ريبلكا') {
        const components = message.components;
      if (!components) return;
      if (components.length > 0) {
        const jb = components[0].components[0];
         try {
            await message.clickButton(jb.customId);
          } catch (error) {
                        console.error('Error clicking the button: ', error);
          }
        }
      }
    }
  },
};