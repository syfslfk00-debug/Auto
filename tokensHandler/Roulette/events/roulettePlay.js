module.exports = {
  name: 'messageCreate',
  eventType: 'game_play',
  gameName: 'روليت',
  async execute(message) {
    // التحقق الأساسي من بنية الرسالة
    if (!message.author.bot) return { handled: false };
    if (!message.components || message.components.length === 0) return { handled: false };

    // 1. 🌟 تسجيل الحسابات الفوري (قبل الفلترة والوعود) لتبادل المعرفة
    if (!global.whitelistConfig) {
      global.whitelistConfig = { botAccounts: new Set(), customUsers: new Set() };
      try {
        const fs = require('fs');
        if (fs.existsSync('./whitelist.json')) {
          const data = JSON.parse(fs.readFileSync('./whitelist.json', 'utf8'));
          data.forEach(item => global.whitelistConfig.customUsers.add(String(item).toLowerCase()));
        }
      } catch (e) {
        console.log("⚠️ لم يتم العثور على ملف whitelist.json مسبق.");
      }
    }

    // كل حساب يصله الحدث يسجل بياناته كاملة فوراً (ID، اسم المستخدم، اسم العرض)
    const myUserId = message.client.user.id;
    global.whitelistConfig.botAccounts.add(myUserId);
    if (message.client.user.username) {
      global.whitelistConfig.botAccounts.add(message.client.user.username.toLowerCase());
    }
    if (message.client.user.displayName) {
      global.whitelistConfig.botAccounts.add(message.client.user.displayName.toLowerCase());
    }
    if (message.client.user.globalName) {
      global.whitelistConfig.botAccounts.add(message.client.user.globalName.toLowerCase());
    }

    // 2. الفرز الآن: هل الدور الحالي هو دور هذا الحساب بالذات؟
    if (!message.content.includes(`<@${myUserId}>`) && !message.content.includes(`<@!${myUserId}>`)) {
      return { handled: false };
    }

    // 3. تجميع الأزرار الحالية الحية وتصفيتها
    const allButtons = message.components.flatMap(row => row.components);
    const playableButtons = allButtons.filter(button => {
      if (!button || button.disabled || !button.customId) return false;
      const label = button.label || '';
      if (label.includes('انسحب') || label.includes('طرد مرتين')) return false;
      return true;
    });

    if (playableButtons.length === 0) return { handled: false };

    // 📊 تصنيف الأزرار المتوفرة بناءً على القائمة الكاملة والمحدثة
    const strangers = [];       
    const manualWhitelist = [];  
    const botWhitelist = [];     

    playableButtons.forEach(button => {
      const label = (button.label || '').toLowerCase();
      const customId = (button.customId || '').toLowerCase();

      // فحص شامل لضمان عدم مباغتة الحسابات الشقيقة
      const isBot = Array.from(global.whitelistConfig.botAccounts).some(bot => 
        customId.includes(String(bot)) || label.includes(String(bot))
      );

      const isManual = Array.from(global.whitelistConfig.customUsers).some(user => 
        customId.includes(String(user)) || label.includes(String(user))
      );

      if (isBot) {
        botWhitelist.push(button);
      } else if (isManual) {
        manualWhitelist.push(button);
      } else {
        strangers.push(button);
      }
    });

    // 🎯 نظام فرز واختيار الهدف حسب سلم الأولويات التنازلي
    let targetButton = null;
    let strategyLog = '';

    if (strangers.length > 0) {
      targetButton = strangers[Math.floor(Math.random() * strangers.length)];
      strategyLog = `⚔️ [هجوم] تم استهداف لاعب عدو: [${targetButton.label || 'بدون اسم'}]`;
    } 
    else if (manualWhitelist.length > 0) {
      targetButton = manualWhitelist[Math.floor(Math.random() * manualWhitelist.length)];
      strategyLog = `⚠️ [تضحية حليفة] الأعداء انتهوا! طرد حساب من القائمة اليدوية: [${targetButton.label || 'بدون اسم'}]`;
    } 
    else if (botWhitelist.length > 0) {
      targetButton = botWhitelist[Math.floor(Math.random() * botWhitelist.length)];
      strategyLog = `💥 [حرب داخلية] لم يتبق غيرنا! الحسابات تطرد بعضها للاستمرار: [${targetButton.label || 'بدون اسم'}]`;
    }

    if (!targetButton || !targetButton.customId) return { handled: false };

    // ============ 🔁 آليات محاكاة البشر (التعديلات المطلوبة) ============
    // ثوابت قابلة للتعديل
    const MIN_DELAY_MS = 800;                // الحد الأدنى للتأخير الطبيعي
    const MAX_DELAY_MS = 2500;               // الحد الأقصى للتأخير الطبيعي
    const SKIP_PROBABILITY = 0.01;           // احتمال تخطي الدور (5%)
    const EXTRA_LONG_DELAY_PROB = 0.10;      // احتمال إضافة تأخير أطول (10%)
    const EXTRA_LONG_DELAY_MS_MIN = 3000;
    const EXTRA_LONG_DELAY_MS_MAX = 6000;

    // احتمال التخطي الكامل للدور (محاكاة التردد أو الانشغال)
    if (Math.random() < SKIP_PROBABILITY) {
      console.log(`🧑 [محاكاة بشرية] تخطي الدور: ${strategyLog}`);
      return { handled: false }; // لا يتم الضغط على الزر كأن البوت لم يلاحظ
    }

    // حساب التأخير الأساسي العشوائي
    let delay = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;

    // أحياناً إضافة تأخير أطول (محاكاة التشتت أو كتابة رد)
    if (Math.random() < EXTRA_LONG_DELAY_PROB) {
      const extra = Math.floor(Math.random() * (EXTRA_LONG_DELAY_MS_MAX - EXTRA_LONG_DELAY_MS_MIN + 1)) + EXTRA_LONG_DELAY_MS_MIN;
      delay += extra;
      console.log(`⏳ [محاكاة بشرية] إضافة تأخير أطول بمقدار ${extra}ms`);
    }

    console.log(`⏱️ [محاكاة بشرية] انتظار ${delay}ms قبل الضغط على الزر: ${strategyLog}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    // ================================================================

    // تنفيذ الضغط بعد الانتهاء من المحاكاة البشرية
    await message.clickButton(targetButton.customId).catch(err => {
      console.log(`❌ فشل إرسال الضغطة المباشرة للزر: ${err.message}`);
    });

    return {
      handled: true,
      type: 'game_play',
      result: 'play',
      gameName: 'روليت',
      message: strategyLog,
    };
  },
};