module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage) {
    if (!newMessage.author.bot) return;
    if (newMessage.components && newMessage.components.length > 0) {
     if (newMessage.content.includes('اضغط على الزر')) {
      try {
        const randomRow = newMessage.components[Math.floor(Math.random() * newMessage.components.length)];
        const rb = randomRow.components[Math.floor(Math.random() * randomRow.components.length)];
          if (rb.disabled) return;
       await newMessage.clickButton(rb.customId);
        } catch (error) {
         console.error(error);
        }
      }
    }
  },
};