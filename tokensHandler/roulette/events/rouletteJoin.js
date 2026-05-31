module.exports = {
  name: 'messageCreate', 
  eventType: 'game_join',
  gameName: 'روليت',
  async execute(arg1, arg2) {
    // حل مشكلة تداخل الأحداث (Create & Update) وضمان جلب الرسالة الصحيحة دائماً
    let message;
    if (arg2 && arg2.author) {
      message = arg2; // في حال حدث messageUpdate (الوسيط الثاني هو الرسالة الجديدة)
    } else {
      message = arg1; // في حال حدث messageCreate (الوسيط الأول هو الرسالة)
    }

    if (!message || !message.author) return { handled: false };
    if (!message.author.bot) return { handled: false };

    // تجميع النصوص من محتوى الرسالة العادي والإيمبد
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

    // التأكد من أن الرسالة تخص لعبة الروليت
    const hasGameName = allTexts.some(text =>
      text.includes('روليت') || text.includes('العجلة')
    );
    if (!hasGameName) return { handled: false };

    if (!message.components || message.components.length === 0) return { handled: false };

    // تجميع كاااافة الأزرار من جميع الصفوف (الأول وحتى الخامس) في مصفوفة واحدة مسطحة
    const allButtons = message.components.flatMap(row => row.components);

    // البحث عن زر "دخول عشوائي" أو "دخول" في كامل الأزرار المتاحة وغير المعطلة
    const targetButton = allButtons.find(button => {
      if (button.disabled) return false;
      const label = button.label || '';
      return label.includes('دخول') || label.includes('عشوائي');
    });

    // إذا لم يجد زر الدخول العشوائي، يتأكد من عدم وجود اسمك في قائمة اللاعبين، ثم يضغط أول زر متاح كبديل
    if (!targetButton) {
      return { handled: false };
    }

    try {
      // ضغط الزر السحري للدخول
      await message.clickButton(targetButton.customId);
      return {
        handled: true,
        type: 'game_join',
        result: 'join',
        gameName: 'روليت',
        message: 'تم رصد اللوبي والضغط على زر دخول عشوائي بنجاح!',
      };
    } catch (error) {
      console.error("خطأ أثناء محاولة الضغط على زر الدخول:", error);
      return { handled: false };
    }
  },
};