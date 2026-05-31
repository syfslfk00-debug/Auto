module.exports = {
  name: 'messageCreate',
  eventType: 'game_play',
  gameName: 'روليت',
  async execute(message) {
    // التحقق من أن المرسل بوت وأن الرسالة تحتوي على أزرار
    if (!message.author.bot) return { handled: false };
    if (!message.components || message.components.length === 0) return { handled: false };

    // التحقق من أن الدور الحالي هو دور حسابنا
    const myUserId = message.client.user.id;
    if (!message.content.includes(`<@${myUserId}>`) && !message.content.includes(`<@!${myUserId}>`)) {
      return { handled: false };
    }

    // تهيئة نظام القائمة البيضاء في الذاكرة المشتركة
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

    // الحساب الحالي يسجل نفسه تلقائياً لتعرفه بقية الحسابات
    global.whitelistConfig.botAccounts.add(myUserId);
    if (message.client.user.username) {
      global.whitelistConfig.botAccounts.add(message.client.user.username.toLowerCase());
    }

    // تجميع كافة الأزرار في مصفوفة واحدة
    const allButtons = message.components.flatMap(row => row.components);

    // تصفية الأزرار الصالحة للعب (غير معطلة وليست انسحاب أو طرد مرتين)
    const playableButtons = allButtons.filter(button => {
      if (button.disabled) return false;
      const label = button.label || '';
      if (label.includes('انسحب') || label.includes('طرد مرتين')) return false;
      return true;
    });

    if (playableButtons.length === 0) return { handled: false };

    // 📊 تصنيف الأزرار المتوفرة إلى 3 مستويات بناءً على طلبك
    const strangers = [];       // المستوى 1: الأعداء والغرباء (خارج كل القوائم)
    const manualWhitelist = [];  // المستوى 2: القائمة المضافة يدوياً (الأصدقاء)
    const botWhitelist = [];     // المستوى 3: القائمة المشتركة تلقائياً (حساباتك الـ 3)

    playableButtons.forEach(button => {
      const label = (button.label || '').toLowerCase();
      const customId = (button.customId || '').toLowerCase();

      // فحص هل الزر يخص أحد حسابات البوت؟
      const isBot = Array.from(global.whitelistConfig.botAccounts).some(bot => 
        customId.includes(String(bot).toLowerCase()) || label.includes(String(bot).toLowerCase())
      );

      // فحص هل الزر يخص صديق مضاف يدوياً؟
      const isManual = Array.from(global.whitelistConfig.customUsers).some(user => 
        customId.includes(String(user).toLowerCase()) || label.includes(String(user).toLowerCase())
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
      // 1. الهدف الأول: طرد الأعداء فوراً طالما هم متواجدون
      targetButton = strangers[Math.floor(Math.random() * strangers.length)];
      strategyLog = `⚔️ [هجوم] تم استهداف لاعب عدو خارج القائمة البيضاء: [${targetButton.label}]`;
    } 
    else if (manualWhitelist.length > 0) {
      // 2. الهدف الثاني: إذا اختفى الأعداء، يتم التضحية بالقائمة اليدوية أولاً لحماية التوكنات الأساسية
      targetButton = manualWhitelist[Math.floor(Math.random() * manualWhitelist.length)];
      strategyLog = `⚠️ [تضحية حليفة] الأعداء انتهوا! تم طرد حساب من القائمة اليدوية لحماية حسابات البوت: [${targetButton.label}]`;
    } 
    else if (botWhitelist.length > 0) {
      // 3. الهدف الأخير: لم يتبق سوى حساباتك الـ 3، يطردون بعضهم لتستمر اللعبة ويضمن أحدها الفوز
      targetButton = botWhitelist[Math.floor(Math.random() * botWhitelist.length)];
      strategyLog = `💥 [حرب داخلية] لم يتبق غيرنا على الطاولة! الحسابات تطرد بعضها للاستمرار: [${targetButton.label}]`;
    }

    // إذا لم يتم تحديد زر كإجراء وقائي
    if (!targetButton) return { handled: false };

    // تنفيذ الضغط المباشر
    console.log(strategyLog);
    await message.clickButton(targetButton.customId);

    return {
      handled: true,
      type: 'game_play',
      result: 'play',
      gameName: 'روليت',
      message: strategyLog,
    };
  },
};