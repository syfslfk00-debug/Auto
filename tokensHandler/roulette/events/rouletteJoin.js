module.exports = {
  name: 'messageCreate', 
  eventType: 'game_join',
  gameName: 'روليت',
  async execute(arg1, arg2) {
    // نظام فحص ذكي لتحديد كائن الرسالة الصحيح مهما كانت طريقة ربط الحدث في الـ index.js
    let message = [arg1, arg2].find(arg => arg && (arg.components || arg.embeds || arg.content) && arg.author?.bot);
    
    if (!message) {
      // فحص احتياطي في حال كانت الرسالة فارغة تماماً في البداية
      message = [arg1, arg2].find(arg => arg && arg.author && arg.id);
    }

    if (!message || !message.author || !message.author.bot) return { handled: false };

    // تجميع النصوص للتأكد من أن اللعبة هي روليت
    let allTexts = [];
    if (message.content) allTexts.push(message.content);

    if (message.embeds && message.embeds.length > 0) {
      const embed = message.embeds[0];
      const embedData = embed.data || embed;

      if (embedData.title) allTexts.push(embedData.title);
      if (embedData.description) allTexts.push(embedData.description);
      if (embedData.fields) {
        for (const field of embedData.fields) {
          if (field.name) allTexts.push(field.name);
          if (field.value) allTexts.push(field.value);
        }
      }
    }

    const hasGameName = allTexts.some(text =>
      text.includes('روليت') || text.includes('العجلة')
    );
    if (!hasGameName) return { handled: false };

    if (!message.components || message.components.length === 0) return { handled: false };

    // تسطيح (Flat) جميع الأزرار من كافة الصفوف الـ 5 لتصبح في مصفوفة واحدة مرتبة من الأعلى للأسفل
    const allButtons = message.components.flatMap(row => row.components);

    // العثور على أول زر متاح (غير معطل) مع استبعاد أزرار التحكم لتجنب المشاكل
    const firstAvailableButton = allButtons.find(button => {
      if (button.disabled) return false;
      const label = button.label || '';
      // استبعاد زر الخروج أو المتجر لضمان الضغط على رقم وحجز مكان فوراً
      if (label.includes('اخرج') || label.includes('متجر')) return false;
      return true;
    });

    if (!firstAvailableButton) return { handled: false };

    try {
      // تنفيذ الضغط السريع المباشر
      await message.clickButton(firstAvailableButton.customId);
      return {
        handled: true,
        type: 'game_join',
        result: 'join',
        gameName: 'روليت',
        message: `تم الانضمام بنجاح عبر الضغط السريع على الزر المتاح: (${firstAvailableButton.label || 'رقم'}).`,
      };
    } catch (error) {
      console.error("خطأ أثناء محاولة الضغط السريع والمباشر على الزر:", error);
      return { handled: false };
    }
  },
};