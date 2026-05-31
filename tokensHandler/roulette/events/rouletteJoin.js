module.exports = {
  name: 'messageCreate',
  eventType: 'game_join',
  gameName: 'روليت',
  async execute(message) {
    if (!message.author.bot) return { handled: false };

    // تجميع النصوص من محتوى الرسالة العادي
    let allTexts = [];
    if (message.content) allTexts.push(message.content);

    // تجميع النصوص من الإيمبد إن وجد
    if (message.embeds.length > 0) {
      const embed = message.embeds[0];
      if (embed.title) allTexts.push(embed.title);
      if (embed.description) allTexts.push(embed.description);
      if (embed.fields) {
        for (const field of embed.fields) {
          if (field.name) allTexts.push(field.name);
          if (field.value) allTexts.push(field.value);
        }
      }
      if (embed.footer && embed.footer.text) allTexts.push(embed.footer.text);
      if (embed.author && embed.author.name) allTexts.push(embed.author.name);
    }

    // البحث عن "روليت" أو "العجلة" في جميع النصوص
    const hasGameName = allTexts.some(text =>
      text.includes('روليت') || text.includes('العجلة')
    );
    if (!hasGameName) return { handled: false };

    const components = message.components;
    if (!components || components.length === 0) return { handled: false };

    // محاولة العثور على زر انضمام يحمل كلمة "دخول" أو "عشوائي"
    let targetButton = null;
    for (const row of components) {
      for (const button of row.components) {
        if (button.disabled) continue;
        const label = button.label || '';
        if (label.includes('دخول') || label.includes('عشوائي')) {
          targetButton = button;
          break;
        }
      }
      if (targetButton) break;
    }

    // إذا لم نجد، نأخذ أول زر غير معطل في الصف الأول
    if (!targetButton) {
      const firstRow = components[0];
      if (firstRow && firstRow.components.length > 0) {
        for (const button of firstRow.components) {
          if (!button.disabled) {
            targetButton = button;
            break;
          }
        }
      }
    }

    if (!targetButton) return { handled: false };

    await message.clickButton(targetButton.customId);
    return {
      handled: true,
      type: 'game_join',
      result: 'join',
      gameName: 'روليت',
      message: 'تم دخول لعبة روليت.',
    };
  },
};