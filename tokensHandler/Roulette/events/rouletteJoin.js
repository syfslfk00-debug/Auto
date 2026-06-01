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

    // تجميع النصوص للتأكد من اسم اللعبة
    let allTexts = [];
    if (message.content) allTexts.push(message.content);

    if (message.embeds && message.embeds.length > 0) {
      const embed = message.embeds[0];
      const embedData = embed.data || embed;
      if (embedData.title) allTexts.push(embedData.title);
      if (embedData.description) allTexts.push(embedData.description);
    }

    // معرف البوت الجديد الثابت (يُستبدل بالمعرف الحقيقي)
    const NEW_BOT_ID = '1367554285037948948'; // ←   

    // تحديد الكلمات المفتاحية المناسبة لكل بوت
    const isNewBot = message.author.id === NEW_BOT_ID;
    const keywordChecks = isNewBot
      ? ['اللعبة', 'العجلة', 'المشاركين'] // الكلمات الخاصة بالبوت الجديد
      : ['روليت', 'العجلة'];              // الكلمات الخاصة بفيزبو (القديم)

    const hasGameName = allTexts.some(text =>
      keywordChecks.some(keyword => text.includes(keyword))
    );

    if (!hasGameName) {
      console.log("⏭️ النصوص لا تحتوي على الكلمات المطلوبة، تم التخطي.");
      return { handled: false };
    }

    console.log("🎯 [نجاح] تم رصد رسالة لعبة الروليت! جاري فرز الخانات الشاغرة...");
    console.log(`🆔 [معلومة] مرسل الرسالة ID: ${message.author.id} | NEW_BOT_ID: ${NEW_BOT_ID} | isNewBot: ${isNewBot}`);

    // تحقق أولي من وجود الأزرار
    if (!message.components || message.components.length === 0) {
      if (isNewBot) {
        console.log("⏳ [بوت جديد] الأزرار لم تظهر بعد، جاري الانتظار حتى 9 ثوانٍ مع إعادة الجلب...");
        // ننتظر بحد أقصى 3 مرات * 3 ثوانٍ
        for (let attempt = 1; attempt <= 3; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          try {
            if (message.channel && message.id) {
              const updatedMessage = await message.channel.messages.fetch(message.id).catch(() => null);
              if (updatedMessage && updatedMessage.components && updatedMessage.components.length > 0) {
                message = updatedMessage;
                console.log(`🔄 [بوت جديد] تم تحديث الرسالة وظهرت الأزرار بعد المحاولة ${attempt}.`);
                break;
              }
            }
          } catch (e) {
            console.log(`⚠️ محاولة ${attempt} لجلب التحديث فشلت، نتابع...`);
          }
        }
      }
      
      // فحص مجدد بعد المحاولات
      if (!message.components || message.components.length === 0) {
        console.log("⚠️ لا توجد أزرار متوفرة في الرسالة بعد.");
        return { handled: false };
      }
    }

    // تسطيح جميع الأزرار من كافة الصفوف في مصفوفة واحدة
    const allButtons = message.components.flatMap(row => row.components);

    // تجميع كاااافة الأزرار المتاحة (غير المعطلة والتي ليست أزرار خروج أو متجر)
    const availableButtons = allButtons.filter(button => {
      if (button.disabled) return false;
      const label = button.label || '';
      // استبعاد أزرار التحكم الخاطئة
      if (label.includes('اخرج') || label.includes('متجر')) return false;
      return true;
    });

    if (availableButtons.length === 0) {
      console.log("❌ لم يتم العثور على أي زر متاح للضغط (اللوبي ممتلئ بالكامل).");
      return { handled: false };
    }

    // إذا كان البوت الجديد، نضغط على أول زر متاح (زر الدخول)
    if (isNewBot) {
      const joinButton = availableButtons[0]; // الزر الوحيد المتاح
      console.log(`🎯 [بوت جديد] سيتم الضغط على زر الدخول: [${joinButton.label || 'بدون نص'}]`);
      return await clickWithHumanDelay(message, joinButton);
    }

    // ==== باقي الكود خاص ببوت فيزبو (الاستراتيجية العشوائية) ====
    console.log(`📊 عدد الأرقام الشاغرة المتاحة حالياً: ${availableButtons.length} خانة.`);

    // 🎲 التمويه العشوائي: اختيار زر عشوائي تماماً من قائمة الخانات المتاحة
    const randomIndex = Math.floor(Math.random() * availableButtons.length);
    const targetButton = availableButtons[randomIndex];

    console.log(`🎲 نظام الحماية اختار لك الرقم: [${targetButton.label}] بشكل عشوائي.`);

    // استدعاء دالة الضغط التلقائي مع التأخير البشري المتغير
    return await clickWithHumanDelay(message, targetButton);
  },
};

// دالة الضغط بنظام التوقيت العشوائي (التمويه البشري)
async function clickWithHumanDelay(message, button) {
  // توليد تأخير عشوائي بين 500 ملي ثانية (نصف ثانية) و 1200 ملي ثانية (ثانية وربع)
  const minDelay = 500;
  const maxDelay = 1200;
  const delayMs = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  
  console.log(`⏱️ محاكاة حركة البشر: سينتظر البوت مدة عشوائية قدرها ${delayMs}ms قبل إرسال الضغطة...`);
  
  await new Promise(resolve => setTimeout(resolve, delayMs));

  try {
    // إرسال الضغطة إلى ديسكورد
    await message.clickButton(button.customId);
    console.log(`🚀 [ممتاز] تم حجز الرقم/الدخول [${button.label || 'بدون نص'}] بنجاح تمويهي كامل!`);
    return {
      handled: true,
      type: 'game_join',
      result: 'join',
      gameName: 'روليت',
      message: `تم الدخول بنجاح: ${button.label || 'زر الدخول'}`,
    };
  } catch (error) {
    console.error("❌ فشلت محاولة الضغط، السبب:", error.message);
    return { handled: false };
  }
}