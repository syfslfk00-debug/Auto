module.exports = {
  name: 'messageCreate', 
  eventType: 'game_join',
  gameName: 'روليت',
  async execute(arg1, arg2) {
    console.log("====================================");
    console.log("🤖 [روليت] تم استدعاء ملف الدخول، جاري الفحص...");

    // نظام فحص ذكي لتحديد كائن الرسالة الصحيح
    let message = [arg1, arg2].find(arg => arg && (arg.components || arg.embeds || arg.content) && arg.author?.bot);
    
    if (!message) {
      console.log("❌ لم يتم العثور على كائن الرسالة الصحيح في المعاملات.");
      return { handled: false };
    }

    if (!message.author.bot) {
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
      return { handled: false };
    }

    console.log("🎯 [نجاح] تم رصد رسالة لعبة الروليت!");

    // 🔄 تأمين جلب الأزرار في حال تأخر ظهورها بالرسالة
    if (!message.components || message.components.length === 0) {
      console.log("⏳ الأزرار لم تظهر بعد في الكاش، جاري الانتظار (500ms) وتحديث الرسالة...");
      await new Promise(resolve => setTimeout(resolve, 500)); 
      try {
        message = await message.channel.messages.fetch(message.id);
      } catch (error) {
        console.log("❌ فشل تحديث الرسالة من السيرفر:", error.message);
        return { handled: false };
      }
    }

    if (!message.components || message.components.length === 0) {
      console.log("⚠️ لا توجد أزرار متوفرة للتفاعل في هذه الرسالة حالياً.");
      return { handled: false };
    }

    // تسطيح جميع الأزرار من كافة الصفوف
    const allButtons = message.components.flatMap(row => row.components);

    // 🔍 الفحص البرمجي: هل اللوبي يعتمد على أرقام خانات أم زر دخول مباشر؟
    const isNumberedLobby = allButtons.some(button => {
      const label = (button.label || '').trim();
      return /^\d+$/.test(label);
    });

    if (isNumberedLobby) {
      // =============================================================
      // 1. نظام اللوبي المعتمد على الأرقام والخانات
      // =============================================================
      console.log("📝 [روليت] تم رصد نظام اللوبي الرقمي (خانات شاغرة).");

      const availableButtons = allButtons.filter(button => {
        if (button.disabled) return false;
        const label = button.label || '';
        if (label.includes('اخرج') || label.includes('متجر')) return false;
        return true;
      });

      if (availableButtons.length === 0) {
        console.log("❌ اللوبي ممتلئ بالكامل (لا توجد أرقام شاغرة).");
        return { handled: false };
      }

      const randomIndex = Math.floor(Math.random() * availableButtons.length);
      const targetButton = availableButtons[randomIndex];

      console.log(`🎲 تم اختيار الخانة الرقمية: [${targetButton.label}] عشوائياً.`);
      return await clickWithHumanDelay(message, targetButton, `الخانة الرقمية ${targetButton.label}`);

    } else {
      // =============================================================
      // 2. نظام اللوبي المعتمد على زر الانضمام المباشر (أول زر في الصف)
      // =============================================================
      console.log("🟢 [روليت] تم رصد نظام الانضمام المباشر (عبر زر التفاعل الأول).");

      const joinButton = allButtons[0];

      if (!joinButton || joinButton.disabled) {
        console.log("❌ زر الانضمام المباشر غير متاح أو معطل.");
        return { handled: false };
      }

      console.log("🎲 جاري الضغط على زر الدخول الأول في الصف.");
      return await clickWithHumanDelay(message, joinButton, "زر الانضمام المباشر");
    }
  },
};

// دالة الضغط بنظام التمويه والتوقيت البشري العشوائي
async function clickWithHumanDelay(message, button, buttonTypeLabel) {
  const minDelay = 400;
  const maxDelay = 950;
  const delayMs = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  
  console.log(`⏱️ محاكاة حركة بشرية: الانتظار لمدة ${delayMs}ms قبل الضغط...`);
  await new Promise(resolve => setTimeout(resolve, delayMs));

  try {
    await message.clickButton(button.customId);
    console.log(`🚀 [ممتاز] تم الدخول بنجاح عبر (${buttonTypeLabel})!`);
    return {
      handled: true,
      type: 'game_join',
      result: 'join',
      gameName: 'روليت',
      message: `تم الدخول بنجاح عبر ${buttonTypeLabel}.`,
    };
  } catch (error) {
    console.error("❌ فشلت محاولة الضغط على الزر، السبب:", error.message);
    return { handled: false };
  }
}