module.exports = {
  name: 'messageCreate',
  eventType: 'game_join',
  gameName: 'روليت',
  async execute(arg1, arg2) {
    // محاولة استخراج كائن الرسالة من المعاملات
    let message = [arg1, arg2].find(arg => arg && arg.author && arg.author.bot);

    if (!message) return { handled: false };

    // التحقق من أن الرسالة تحتوي على المكونات التفاعلية (الأزرار)
    if (!message.components || message.components.length === 0) {
      // لا توجد أزرار، إذن هي ليست رسالة اللوبي
      return { handled: false };
    }

    // التحقق من وجود زر "join" (دخول) وزر "exit" (خروج) لتأكيد أنها لعبة الروليت
    const allButtons = message.components.flatMap(row => row.components);
    const joinButton = allButtons.find(btn => btn.customId === 'join' && !btn.disabled);
    const exitButton = allButtons.find(btn => btn.customId === 'exit');

    if (!joinButton || !exitButton) {
      // لا تحتوي على أزرار الدخول والخروج معاً، إذن ليست رسالة اللوبي المستهدفة
      return { handled: false };
    }

    // التحقق من محتوى النص (يحتوي على "اللاعبين:")
    if (!message.content || !message.content.includes('اللاعبين:')) {
      // المحتوى لا يتطابق، ربما تكون رسالة أخرى لنفس البوت
      return { handled: false };
    }

    console.log("🎯 [نجاح] تم رصد رسالة لوبي لعبة الروليت! جاري الضغط على زر الدخول...");

    // تأخير عشوائي لمحاكاة السلوك البشري
    const delayMs = Math.floor(Math.random() * 1000) + 1000; // بين 1000 و 2000 مللي ثانية
    console.log(`⏱️ انتظار ${delayMs}ms قبل الضغط...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));

    try {
      await message.clickButton('join');
      console.log("🚀 [ممتاز] تم الدخول إلى لعبة الروليت بنجاح!");
      return {
        handled: true,
        type: 'game_join',
        result: 'join',
        gameName: 'روليت',
        message: 'تم الدخول إلى لعبة الروليت بنجاح.',
      };
    } catch (error) {
      console.error("❌ فشل الضغط على زر الدخول:", error.message);
      return { handled: false };
    }
  },
};