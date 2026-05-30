module.exports = {
    name: 'messageCreate',
    async execute(message) {
      if (message.content.includes('كراسي')) {
        const collector = message.channel.createMessageCollector({ filter: (msg) => msg.author.bot && msg.components && msg.components.length > 0, time: 5000 });
        collector.on('collect', async msg => {
          try {
         const button = msg.components[0].components[0];
           if (button && button.type === 'BUTTON') {
         await msg.clickButton(button.customId);
         collector.stop();
             }
           } catch (error) {
            console.error('Error clicking the button: ', error);
           }
         }); 
        collector.on('end', (collected) => {
          console.log(`Collected ${collected.size} messages on karasi`);
        });
        const messages = await message.channel.messages.fetch({ limit: 10 });
        messages.forEach(async msg => {
         if (msg.author.bot && msg.components && msg.components.length > 0) {
           const button = msg.components[0].components[0];
         if (button && button.type === 'BUTTON') {
           await msg.clickButton(button.customId).catch(error => {
                  console.error('Error clicking button in fetched message: ', error);
            });
          }
        }
      });
    }
  },
};