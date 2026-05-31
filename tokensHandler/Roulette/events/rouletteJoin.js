module.exports = {
  name: 'messageCreate', 
  eventType: 'game_join',
  gameName: 'روليت',
  async execute(arg1, arg2) {
    console.log("====================================");
    console.log("🤖 [روليت] تم استدعاء ملف الدخول، جاري الفحص...");

    // نظام فحص ذكي لتحديد كائن الرسالة الصحيح مهما كانت طريقة تمرير الأحداث
    let message = [arg1, arg2].find(arg => arg && (arg.components || arg.embeds || arg.content) && arg.author?.bot);
    
    if (!message) {
      console.log("❌ لم يتم العثور على كائن الرسالة الصحيح في المعاملات (تأكد من الـ index.js).");
      return { handled: false };
    }

    if (!message.author.bot) {
      console.log("⏭️ الرسالة ليست من بوت، تم التخطي.");
      return { handled: false };
    }

    // تجميع النصوص للتأكد من اسم اللعبة
    let allTexts = [];
    if (message.content) allTexts.push(message.content);

    if (message.embeds && message.embeds.length > 0) {
      const embed = message.embeds[0];
      const embedData = embed.data || embed;
      if (embedData.title) allTexts.push(embedData.title);
      if (embedData.description) allTexts.push(embedData.description);
    }

    const hasGameName = allTexts.some(text =>
      text.includes('روليت') || text.includes('العجلة')
    );

    if (!hasGameName) {
      console.log("⏭️ النصوص لا تحتوي على كلمة (روليت أو العجلة)، تم التخطي.");
      return { handled: false };
    }

    console.log("🎯 [نجاح] تم رصد رسالة لعبة الروليت! جاري فحص الأزرار...");

    if (!message.components || message.components.length === 0) {
      console.log("⚠️ غريب! تم رصد الرسالة ولكن لا توجد أزرار (ربما لم تُحمل بعد).");
      return { handled: false };
    }

    // تسطيح جميع الأزرار من كافة الصفوف في مصفوفة واحدة
    const allButtons = message.components.flatMap(row => row.components);
    console.log(`📊 إجمالي الأزرار المكتشفة في الرسالة: ${allButtons.length} زر.`);

    // البحث عن أول زر متاح (رقمي) مع استبعاد أزرار التحكم الخاطئة
    const targetButton = allButtons.find(button => {
      if (button.disabled) return false;
      const label = button.label || '';
      // استبعاد أزرار الخروج والمتجر لضمان الضغط على رقم مباشر
      if (label.includes('اخرج') || label.includes('متجر')) return false;
      return true;
    });

    if (!targetButton) {
      console.log("❌ لم يتم العثور على أي زر متاح للضغط (قد تكون الغرفة ممتلئة بالكامل).");
      return { handled: false };
    }

    console.log(`✅ تم اختيار الزر بنجاح! النص عليه هو: [${targetButton.label || 'رقم'}]`);

    // استدعاء دالة الضغط مع التأخير الزمني لحل مشكلة الـ Click المرفوض
    return await clickWithDelay(message, targetButton);
  },
};

// دالة تفصل الضغط وتمنحه وقتاً للاستقرار
async function clickWithDelay(message, button) {
  const delayMs = 700; // تأخير 700 ملي ثانية لضمان استقرار الرسالة في ديسكورد
  console.log(`⏱️ جاري الانتظار لمدة ${delayMs}ms قبل الضغط لضمان قبول العملية...`);
  
  await new Promise(resolve => setTimeout(resolve, delayMs));

  try {
    // محاولة الضغط السحرية
    await message.clickButton(button.customId);
    console.log(`🚀 [مبهر] تم إرسال ضغطة الزر بنجاح إلى ديسكورد!`);
    return {
      handled: true,
      type: 'game_join',
      result: 'join',
      gameName: 'روليت',
      message: `تم الانضمام للعبة عبر زر الرقم المتاح.`,
    };
  } catch (error) {
    console.error("❌ فشلت مكتبة السيلف بوت في الضغط على الزر، السبب:", error.message);
    return { handled: false };
  }
}