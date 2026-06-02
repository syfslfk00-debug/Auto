module.exports = {
  name: 'messageUpdate',
  eventType: 'game_play',
  gameName: 'زر',
  async execute(oldMessage, newMessage) {
    if (!newMessage.author.bot) return { handled: false };
    if (!newMessage.components || newMessage.components.length === 0) return { handled: false };
    if (!newMessage.content.includes('اضغط على الزر')) return { handled: false };

    const randomRow = newMessage.components[Math.floor(Math.random() * newMessage.components.length)];
    const rb = randomRow.components[Math.floor(Math.random() * randomRow.components.length)];
    if (!rb || rb.disabled) return { handled: false };

    await newMessage.clickButton(rb.customId);
    return {
      handled: true,
      type: 'game_play',
      result: 'play',
      gameName: 'زر',
      message: 'بدأ الحساب التفاعل داخل جولة زر.',
    };
  },
};