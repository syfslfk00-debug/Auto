module.exports = {
  // تم تغيير الاسم ليعبر عن الوظيفة، ولكن يفضل ربطه بحدثين في ملف التشغيل الرئيسي لديك
  name: 'messageCreate', 
  eventType: 'game_join',
  gameName: 'روليت',
  async execute(oldMessage, newMessage) {
    // لدعم حدث messageUpdate و messageCreate معاً
    // في حال كان الحدث messageCreate سيكون oldMessage هو الرسالة الحقيقية
    // في حال كان messageUpdate سيكون newMessage هو الرسالة المحدثة
    const message = newMessage || oldMessage;

    if (!message || !message.author) return { handled: false };
    if (!message.author.bot) return { handled: false };

    // تجميع النصوص من محتوى الرسالة العادي
    let allTexts = [];
    if (message.content) allTexts.push(message.content);

    // تجميع النصوص من الإيمبد مع دعم v13 و v14
    if (message.embeds && message.embeds.length > 0) {
      const embed = message.embeds[0];
      const embedData = embed.data || embed; // يضمن التوافق مع الإصدارين

      if (embedData.title) allTexts.push(embedData.title);
      if (embedData.description) allTexts.push(embedData.description);
      if (embedData.fields) {
        for (const field of embedData.fields) {
          if (field.name) allTexts.push(field.name);
          if (field.value) allTexts.push(field.value);
        }
      }
      if (embedData.footer && embedData.footer.text) allTexts.push(embedData.footer.text);
      if (embedData.author && embedData.author.name) allTexts.push(embedData.author.name);
    }

    // البحث عن "روليت" أو "العجلة" في جميع النصوص المجموعة
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

    try {
      // التأكد من أن مكتبة السيلف بوت تدعم هذه الدالة على كائن الرسالة
      await message.clickButton(targetButton.customId);
      return {
        handled: true,
        type: 'game_join',
        result: 'join',
        gameName: 'روليت',
        message: 'تم دخول لعبة روليت بنجاح.',
      };
    } catch (error) {
      console.error("خطأ أثناء محاولة الضغط على الزر:", error);
      return { handled: false };
    }
  },
};