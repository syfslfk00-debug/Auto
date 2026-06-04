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

    // ⚠️ تعديل هام: البحث عن زر "join" ونص "اللاعبين:" بدلاً من الأزرار الرقمية
    if (!message.components || message.components.length === 0) {
      console.log("⏭️ لا توجد مكونات تفاعلية في الرسالة.");
      return { handled: false };
    }

    // البحث عن زر الدخول المخصص للعبة الروليت (customId === "join")
    const joinButton = message.components
      .flatMap(row => row.components)
      .find(button => button.customId === "join" && !button.disabled);

    // التأكد من أن الرسالة تحتوي على "اللاعبين:" لضمان أنها لوبي الروليت
    const hasLobbyText = message.content && message.content.includes("اللاعبين:");

    if (!joinButton || !hasLobbyText) {
      console.log("⏭️ الرسالة لا تحتوي على زر دخول نشط أو لا تحتوي 'اللاعبين:'، تم التخطي.");
      return { handled: false };
    }

    console.log("🎯 [نجاح] تم رصد رسالة لوبي لعبة الروليت! جاري الضغط على زر الدخول...");

    // 🎲 الضغط على زر الدخول بعد تأخير عشوائي
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