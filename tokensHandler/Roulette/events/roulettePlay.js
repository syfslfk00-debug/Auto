module.exports = {
  name: 'messageCreate',
  eventType: 'game_play',
  gameName: 'روليت',
  async execute(message) {
    // 1. التحقق المبدئي السريع قبل استهلاك الـ API
    if (!message.author.bot) return { handled: false };
    if (!message.components || message.components.length === 0) return { handled: false };

    // التحقق من أن الدور الحالي هو دور حسابنا
    const myUserId = message.client.user.id;
    if (!message.content.includes(`<@${myUserId}>`) && !message.content.includes(`<@!${myUserId}>`)) {
      return { handled: false };
    }

    // 2. تحديث بيانات الرسالة فوراً من السيرفر لضمان قراءة الأزرار المتبقية الحقيقية فقط
    const freshMessage = await message.channel.messages.fetch(message.id).catch(() => null);
    if (!freshMessage || !freshMessage.components || freshMessage.components.length === 0) {
      console.log("⚠️ تعذر جلب تحديث الرسالة الحية من السيرفر أو أن الأزرار اختفت بالكامل.");
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

    // 3. تجميع كافة الأزرار الحية الحالية من الرسالة المحدثة
    const allButtons = freshMessage.components.flatMap(row => row.components);

    // 4. تصفية الأزرار الصالحة للعب (تأكيد صارم على وجود الأزرار والمعرفات)
    const playableButtons = allButtons.filter(button => {
      if (!button || button.disabled || !button.customId) return false;
      const label = button.label || '';
      if (label.includes('انسحب') || label.includes('طرد مرتين')) return false;
      return true;
    });

    if (playableButtons.length === 0) {
      console.log("⚠️ لا توجد أزرار صالحة للعب في هذه الجولة المحدثة.");
      return { handled: false };
    }

    // 📊 تصنيف الأزرار المتوفرة إلى 3 مستويات بناءً على طلبك
    const strangers = [];       // المستوى 1: الأعداء والغرباء
    const manualWhitelist = [];  // المستوى 2: القائمة المضافة يدوياً (الأصدقاء)
    const botWhitelist = [];     // المستوى 3: القائمة المشتركة تلقائياً (حساباتك)

    playableButtons.forEach(button => {
      const label = (button.label || '').toLowerCase();
      const customId = (button.customId || '').toLowerCase();

      // فحص هل الزر يخص أحد حسابات البوت؟
      const isBot = Array.from(global.whitelistConfig.botAccounts).some(bot => 
        customId.includes(String(bot).toLowerCase()) || label.includes(String(bot).toLowerCase())
      );

      // فحص هل الزر يخص صديق مضاف يدوياً?
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
      targetButton = strangers[Math.floor(Math.random() * strangers.length)];
      strategyLog = `⚔️ [هجوم] تم استهداف لاعب عدو متاح حالياً: [${targetButton.label || 'بدون اسم'}]`;
    } 
    else if (manualWhitelist.length > 0) {
      targetButton = manualWhitelist[Math.floor(Math.random() * manualWhitelist.length)];
      strategyLog = `⚠️ [تضحية حليفة] تم طرد حساب من القائمة اليدوية المتاحة: [${targetButton.label || 'بدون اسم'}]`;
    } 
    else if (botWhitelist.length > 0) {
      targetButton = botWhitelist[Math.floor(Math.random() * botWhitelist.length)];
      strategyLog = `💥 [حرب داخلية] لم يتبق غيرنا! الحساب يطرد توكن حليف متاح: [${targetButton.label || 'بدون اسم'}]`;
    }

    // 5. حماية قصوى: التوقف فوراً إذا كان الهدف غير صالح أو الـ customId مفقود لمنع الـ Timeout
    if (!targetButton || !targetButton.customId) {
      console.log("❌ خطأ حرج: تم اختيار زر هدف فارغ أو لا يحتوي على معرف ملموس.");
      return { handled: false };
    }

    // تنفيذ الضغط المباشر على الرسالة المحدثة
    console.log(strategyLog);
    await freshMessage.clickButton(targetButton.customId).catch(err => {
      console.error(`❌ فشل إرسال التفاعل للزر المختار: ${err.message}`);
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