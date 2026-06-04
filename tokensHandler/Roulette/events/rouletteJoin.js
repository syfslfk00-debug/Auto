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
      console.log("❌ لم يتم العثور على كائن الرسالة الصحيح في المعاملات.");
      return { handled: false };
    }

    if (!message.author.bot) {
      console.log("⏭️ الرسالة ليست من بوت، تم التخطي.");
      return { handled: false };
    }

    // التحقق من محتوى النص أولاً (يحتوي على "اللاعبين:")
    const hasLobbyText = message.content && message.content.includes("اللاعبين:");
    if (!hasLobbyText) {
      console.log("⏭️ الرسالة لا تحتوي على 'اللاعبين:'، تم التخطي.");
      return { handled: false };
    }

    console.log("🎯 [نجاح] تم رصد رسالة لوبي لعبة الروليت! جاري التأكد من المكونات...");

    // في حالة عدم وجود components، نحاول إعادة جلب الرسالة بعد تأخير قصير
    if (!message.components || message.components.length === 0) {
      console.log("⚠️ الرسالة لا تحتوي على مكونات تفاعلية حالياً، جاري إعادة جلبها...");
      try {
        // تأخير بسيط لإعطاء وقت لمعالجة الرسالة من قبل ديسكورد
        await new Promise(resolve => setTimeout(resolve, 500));
        // إعادة جلب الرسالة من القناة
        message = await message.channel.messages.fetch(message.id);
        if (!message) {
          console.log("❌ فشل جلب الرسالة بعد إعادة المحاولة.");
          return { handled: false };
        }
        // التأكد مرة أخرى من وجود المكونات
        if (!message.components || message.components.length === 0) {
          console.log("❌ لا تزال المكونات مفقودة بعد إعادة الجلب، تخطي.");
          return { handled: false };
        }
        console.log("✅ تم جلب الرسالة بنجاح مع المكونات التفاعلية.");
      } catch (err) {
        console.error("❌ خطأ أثناء إعادة جلب الرسالة:", err.message);
        return { handled: false };
      }
    }

    // البحث عن زر الدخول (join) والتأكد من أنه غير معطل
    const joinButton = message.components
      .flatMap(row => row.components)
      .find(button => button.customId === "join" && !button.disabled);

    if (!joinButton) {
      console.log("⏭️ زر الدخول غير موجود أو معطل.");
      return { handled: false };
    }

    console.log("🎲 جاري الضغط على زر الدخول...");

    // الضغط على زر الدخول بعد تأخير عشوائي
    return await clickWithHumanDelay(message, joinButton);
  },
};

// دالة الضغط بنظام التوقيت العشوائي (التمويه البشري)
async function clickWithHumanDelay(message, button) {
  // توليد تأخير عشوائي بين 1000 ملي ثانية (1 ثانية) و 2000 ملي ثانية (2 ثانية)
  const minDelay = 1000;
  const maxDelay = 2000;
  const delayMs = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  
  console.log(`⏱️ محاكاة حركة البشر: سينتظر البوت مدة عشوائية قدرها ${delayMs}ms قبل إرسال الضغطة...`);
  
  await new Promise(resolve => setTimeout(resolve, delayMs));

  try {
    // إرسال الضغطة إلى ديسكورد
    await message.clickButton(button.customId);
    console.log(`🚀 [ممتاز] تم الدخول إلى لعبة الروليت بنجاح تمويهي كامل!`);
    return {
      handled: true,
      type: 'game_join',
      result: 'join',
      gameName: 'روليت',
      message: `تم الدخول إلى لعبة الروليت بنجاح.`,
    };
  } catch (error) {
    console.error("❌ فشلت محاولة الضغط على زر الدخول، السبب:", error.message);
    return { handled: false };
  }
}