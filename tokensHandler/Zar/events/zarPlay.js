module.exports = {
  name: 'messageUpdate',
  eventType: 'game_play',
  gameName: 'زر',
  async execute(oldMessage, newMessage) {
    // 1. نفس شروط الكراسي: بوت، وفيه أزرار، والنص يحتوي 'اضغط على الزر'
    if (!newMessage.author.bot) return { handled: false };
    if (!newMessage.components || newMessage.components.length === 0) return { handled: false };
    if (!newMessage.content.includes('اضغط على الزر')) return { handled: false };

    // 2. جمع جميع الأزرار غير المعطلة من جميع الصفوف
    const allButtons = newMessage.components.flatMap(row => row.components || []).filter(btn => btn && btn.customId && !btn.disabled);
    if (allButtons.length === 0) return { handled: false };

    // 3. البحث عن الزر الأخضر (style === 3)
    const greenButton = allButtons.find(btn => btn.style === 3);
    if (!greenButton) return { handled: false };

    // 4. الضغط عليه
    await newMessage.clickButton(greenButton.customId);
    return {
      handled: true,
      type: 'game_play',
      result: 'play',
      gameName: 'زر',
      message: 'تم الضغط على الزر الأخضر في لعبة زر.',
    };
  },
};