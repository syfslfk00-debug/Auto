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
    // نعتمد على message.client.user.id الذي يمثل الحساب المُشغّل
    const myUserId = message.client.user.id;
    if (!message.content.includes(`<@${myUserId}>`) && !message.content.includes(`<@!${myUserId}>`)) {
      return { handled: false };
    }

    // جمع كل الأزرار من جميع صفوف المكونات
    const allButtons = message.components.flatMap(row => row.components);

    // تصفية الأزرار المسموحة فقط: غير معطلة، وليست "انسحب" أو "طرد مرتين"
    const allowedButtons = allButtons.filter(button => {
      if (button.disabled) return false;
      const label = button.label || '';
      // استبعاد الأزرار الخطيرة بأسمائها
      if (label.includes('انسحب') || label.includes('طرد مرتين')) return false;
      return true;
    });

    // إذا لم تبق أزرار صالحة، نغادر دون فعل
    if (allowedButtons.length === 0) return { handled: false };

    // اختيار زر عشوائي
    const randomButton = allowedButtons[Math.floor(Math.random() * allowedButtons.length)];

    // النقر على الزر المختار
    await message.clickButton(randomButton.customId);

    return {
      handled: true,
      type: 'game_play',
      result: 'play',
      gameName: 'روليت',
      message: 'تم التفاعل داخل جولة روليت (اختيار لاعب للطرد).',
    };
  },
};