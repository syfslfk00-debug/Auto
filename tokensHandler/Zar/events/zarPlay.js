function textFromEmbed(message) {
  const parts = [];
  if (message.content) parts.push(message.content);
  if (Array.isArray(message.embeds)) {
    for (const embed of message.embeds) {
      if (embed.title) parts.push(embed.title);
      if (embed.description) parts.push(embed.description);
      if (Array.isArray(embed.fields)) {
        for (const field of embed.fields) {
          if (field.name) parts.push(field.name);
          if (field.value) parts.push(field.value);
        }
      }
      if (embed.footer && embed.footer.text) parts.push(embed.footer.text);
      if (embed.author && embed.author.name) parts.push(embed.author.name);
    }
  }
  return parts.join(' ');
}

function isGreenButton(button) {
  const style = button && button.style;
  return style === 3; // SUCCESS = أخضر
}

function collectButtons(message) {
  if (!message.components || message.components.length === 0) return [];
  return message.components.flatMap(row => row.components || []).filter(btn => btn && btn.customId && !btn.disabled);
}

module.exports = {
  name: 'messageUpdate',
  eventType: 'game_play',
  gameName: 'زر',
  async execute(oldMessage, newMessage) {
    // 1. فقط رسائل البوت
    if (!newMessage.author || !newMessage.author.bot) return { handled: false };

    // 2. استخراج النص من الـ Embed والمحتوى
    const fullText = textFromEmbed(newMessage);
    console.log(`[ZAR] النص الكامل: ${fullText}`);

    // 3. التحقق من أن الرسالة تخص لعبة زر (العنوان يحتوي "زر" والوصف يحتوي "أسرع شخص" أو "يفوز")
    const hasZarTitle = fullText.includes('زر');
    const hasGameDesc = fullText.includes('أسرع شخص') || fullText.includes('يفوز');
    if (!hasZarTitle || !hasGameDesc) {
      console.log(`[ZAR] ليست رسالة زر: titleContainsZar=${hasZarTitle}, descContainsGame=${hasGameDesc}`);
      return { handled: false };
    }

    // 4. جمع الأزرار غير المعطلة
    const buttons = collectButtons(newMessage);
    console.log(`[ZAR] عدد الأزرار النشطة: ${buttons.length}`);

    // 5. البحث عن الزر الأخضر الوحيد
    const greenButtons = buttons.filter(isGreenButton);
    if (greenButtons.length !== 1) {
      console.log(`[ZAR] لم يتم العثور على زر أخضر واحد (الموجود: ${greenButtons.length})`);
      return { handled: false };
    }

    // 6. الضغط على الزر الأخضر
    const target = greenButtons[0];
    console.log(`[ZAR] جاري الضغط على الزر الأخضر: ${target.customId}`);
    await newMessage.clickButton(target.customId);
    console.log(`[ZAR] تم الضغط بنجاح`);

    return {
      handled: true,
      type: 'game_play',
      result: 'play',
      gameName: 'زر',
      message: 'تم الضغط على الزر الأخضر في لعبة زر.',
      details: { buttonId: target.customId }
    };
  },
};