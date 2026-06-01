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

    const hasGameName = allTexts.some(text =>
      text.includes('روليت') || text.includes('العجلة')
    );

    if (!hasGameName) {
      console.log("⏭️ النصوص لا تحتوي على كلمة (روليت أو العجلة)، تم التخطي.");
      return { handled: false };
    }

    console.log("🎯 [نجاح] تم رصد رسالة لعبة الروليت! جاري فرز الخانات الشاغرة...");

    if (!message.components || message.components.length === 0) {
      console.log("⚠️ غريب! لا توجد أزرار متوفرة في الرسالة.");
      return { handled: false };
    }

    // تسطيح جميع الأزرار من كافة الصفوف في مصفوفة واحدة
    const allButtons = message.components.flatMap(row => row.components);

    // 🔍 الفحص الفاصل: هل اللوبي يعتمد على أرقام خانات (فيزبو) أم أزرار تحكم مباشرة (كلوفر)؟
    const isNumberedLobby = allButtons.some(button => {
      const label = (button.label || '').trim();
      return /^\d+$/.test(label);
    });

    if (isNumberedLobby) {
      // =============================================================
      // 1. نظام بوت فيزبو الحالي (متروك تماماً كما هو دون أي تغيير)
      // =============================================================
      console.log("📝 [روليت] تم رصد لوبي يعتمد على الأرقام (بوت فيزبو الحالي).");

      const availableButtons = allButtons.filter(button => {
        if (button.disabled) return false;
        const label = button.label || '';
        if (label.includes('اخرج') || label.includes('متجر')) return false;
        return true;
      });

      if (availableButtons.length === 0) {
        console.log("❌ لم يتم العثور على أي رقم شاغر للضغط (اللوبي ممتلئ بالكامل).");
        return { handled: false };
      }

      console.log(`📊 عدد الأرقام الشاغرة المتاحة حالياً: ${availableButtons.length} خانة.`);

      const randomIndex = Math.floor(Math.random() * availableButtons.length);
      const targetButton = availableButtons[randomIndex];

      console.log(`🎲 نظام الحماية اختار لك الرقم: [${targetButton.label}] بشكل عشوائي.`);

      return await clickWithHumanDelay(message, targetButton);

    } else {
      // =============================================================
      // 2. النظام المخصص لبوت كلوفر (الاعتماد على أول زر في الصف كما في IMG_6361.jpg)
      // =============================================================
      console.log("🟢 [روليت] تم رصد لوبي انضمام مباشر (بوت كلوفر).");

      // الاعتماد المباشر على أول زر متاح في المصفوفة (الزر الأخضر في أقصى اليسار بالصورة)
      const joinButton = allButtons[0];

      if (!joinButton || joinButton.disabled) {
        console.log("❌ زر الانضمام الأول غير موجود أو معطل حالياً.");
        return { handled: false };
      }

      console.log("🎲 تم اختيار أول زر في الصف للانضمام (زر الايموجي الأخضر).");
      return await clickWithHumanDelay(message, joinButton);
    }
  },
};

// دالة الضغط بنظام التوقيت العشوائي (التمويه البشري)
async function clickWithHumanDelay(message, button) {
  const minDelay = 500;
  const maxDelay = 1200;
  const delayMs = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  
  console.log(`⏱️ محاكاة حركة البشر: سينتظر البوت مدة عشوائية قدرها ${delayMs}ms قبل إرسال الضغطة...`);
  
  await new Promise(resolve => setTimeout(resolve, delayMs));

  try {
    await message.clickButton(button.customId);
    console.log(`🚀 [ممتاز] تم الضغط على زر الدخول [${button.label || 'Emoji Button'}] بنجاح!`);
    return {
      handled: true,
      type: 'game_join',
      result: 'join',
      gameName: 'روليت',
      message: `تم الدخول بنجاح عبر الزر الأول.`,
    };
  } catch (error) {
    console.error("❌ فشلت محاولة الضغط، السبب:", error.message);
    return { handled: false };
  }
}