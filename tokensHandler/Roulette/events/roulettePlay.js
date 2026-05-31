module.exports = {
  name: 'messageCreate',
  eventType: 'game_play',
  gameName: 'روليت',
  async execute(message) {
    // التحقق من أن المرسل بوت
    if (!message.author.bot) return { handled: false };

    // التحقق من وجود أزرار في الرسالة
    if (!message.components || message.components.length === 0) return { handled: false };

    // التحقق من أن الرسالة تحتوي على منشن حسابنا (صاحب الدور)
    const myUserId = message.client.user.id;
    if (!message.content.includes(`<@${myUserId}>`) && !message.content.includes(`<@!${myUserId}>`)) {
      return { handled: false };
    }

    // 🧠 [تهيئة نظام القائمة البيضاء المشترك في الذاكرة]
    if (!global.whitelistConfig) {
      global.whitelistConfig = {
        botAccounts: new Set(), // للحسابات التي تكتشف نفسها تلقائياً
        customUsers: new Set()  // للحسابات المضافة عبر أمر السلاش
      };
      
      // محاولة قراءة القائمة اليدوية المحفوظة من ملف لتجنب ضياعها عند إعادة التشغيل الموقت
      try {
        const fs = require('fs');
        if (fs.existsSync('./whitelist.json')) {
          const data = JSON.parse(fs.readFileSync('./whitelist.json', 'utf8'));
          data.forEach(item => global.whitelistConfig.customUsers.add(String(item).toLowerCase()));
        }
      } catch (e) {
        console.log("⚠️ لم يتم العثور على ملف whitelist.json أو أنه فارغ.");
      }
    }

    // ✨ [الاكتشاف التلقائي الذكي] 
    // الحساب الحالي يسجل نفسه فوراً بـ معرّفه واسمه لكي تراه الحسابات الأخرى
    global.whitelistConfig.botAccounts.add(myUserId);
    if (message.client.user.username) {
      global.whitelistConfig.botAccounts.add(message.client.user.username.toLowerCase());
    }

    // جمع كل الأزرار من جميع صفوف المكونات
    const allButtons = message.components.flatMap(row => row.components);

    // تصفية الأزرار المسموحة (استبعاد الأزرار الخطيرة + استبعاد أعضاء القائمة البيضاء)
    const allowedButtons = allButtons.filter(button => {
      if (button.disabled) return false;
      const label = (button.label || '').toLowerCase();
      const customId = (button.customId || '').toLowerCase();
      
      // استبعاد الأزرار الخطيرة بأسمائها
      if (label.includes('انسحب') || label.includes('طرد مرتين')) return false;

      // 🛡️ دمج كل عناصر الحماية (التلقائية واليدوية) في مصفوفة واحدة للفحص
      const allSafeItems = [
        ...global.whitelistConfig.botAccounts,
        ...global.whitelistConfig.customUsers
      ].map(item => String(item).toLowerCase());

      // التحقق مما إذا كان الزر يخص حساباً صديقاً (عبر الاسم أو الـ ID الكامن في الـ customId)
      const isFriendly = allSafeItems.some(safeItem => 
        customId.includes(safeItem) || label.includes(safeItem)
      );

      if (isFriendly) {
        console.log(`🛡️ [حماية التحالف] تم تخطي الزر [${button.label}] لأنه يخص حساباً في القائمة البيضاء.`);
        return false; // لا تضعه في الأزرار المتاحة للطرد
      }

      return true;
    });

    // إذا لم تبق أزرار صالحة (مثلاً لم يتبق في اللعبة سوى حساباتك الثلاثة!)
    if (allowedButtons.length === 0) {
      console.log("⚠️ طاولة الروليت نظيفة! لم يتبق أي لاعب عدو لطرده (كل المتواجدين حلفاء).");
      return { handled: false }; // يتوقف الحساب عن اللعب لحماية بقية حساباتك
    }

    // اختيار لاعب عدو عشوائي لطره
    const randomButton = allowedButtons[Math.floor(Math.random() * allowedButtons.length)];

    // النقر على الزر المختار (طرد الهدف)
    await message.clickButton(randomButton.customId);

    return {
      handled: true,
      type: 'game_play',
      result: 'play',
      gameName: 'روليت',
      message: `تم طرد لاعب عدو بنجاح واجتناب الحسابات الحليفة (${randomButton.label}).`,
    };
  },
};