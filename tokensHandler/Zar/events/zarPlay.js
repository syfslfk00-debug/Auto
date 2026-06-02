function textFromMessage(message) {
  const parts = [];
  if (message.content) parts.push(message.content);
  if (Array.isArray(message.embeds)) {
    for (const embed of message.embeds) {
      if (embed.title) parts.push(embed.title);
      if (embed.description) parts.push(embed.description);
      if (Array.isArray(embed.fields)) {
        for (const field of embed.fields) {
          if (field.name) parts.push(field.name);
          if (field.value) parts.push(field.value);
        }
      }
      if (embed.footer && embed.footer.text) parts.push(embed.footer.text);
      if (embed.author && embed.author.name) parts.push(embed.author.name);
    }
  }
  return parts.join(' ');
}

function isGreenButton(button) {
  const style = button && button.style;
  const styleText = String(style || '').toUpperCase();
  return style === 3 || styleText === 'SUCCESS' || styleText === 'GREEN';
}

function collectButtons(message) {
  if (!message.components || message.components.length === 0) return [];
  return message.components.flatMap(row => row.components || []).filter(button => button && button.customId && !button.disabled);
}

module.exports = {
  name: 'messageUpdate',
  eventType: 'game_play',
  gameName: 'زر',
  async execute(oldMessage, newMessage, client) {
    // 1. تسجيل فوري عند حدوث أي تعديل أو تحديث لرسالة داخل السيرفر
    console.log(`[ZAR-LOG] 🟡 تم رصد تحديث (تعديل) لرسالة في القناة: ${newMessage?.channel?.id || 'غير معروف'}`);

    // 2. فحص وجود بيانات الكاتب وهل هو بوت
    if (!newMessage.author) {
      console.log(`[ZAR-LOG] ⚠️ تم التجاهل: بيانات كاتب الرسالة غائبة في هذا التحديث (Partial Message).`);
      return { handled: false };
    }

    if (!newMessage.author.bot) {
      console.log(`[ZAR-LOG] ❌ تم التجاهل: الرسالة المعدلة ليست من بوت، بل من مستخدم حقيقي.`);
      return { handled: false };
    }
    console.log(`[ZAR-LOG] 🤖 الرسالة المعدلة قادمة من بوت: ${newMessage.author.tag}`);

    // 3. فحص تطابق القناة المخصصة للعبة
    const context = client?.engineContext || {};
    const zarChannel = context.settings && context.settings.zarChannel;
    if (zarChannel && zarChannel.channelId && newMessage.channel && newMessage.channel.id !== zarChannel.channelId) {
      console.log(`[ZAR-LOG] ❌ تم التجاهل: التحديث حصل في روم أخرى (${newMessage.channel.id}) وليس روم اللعبة المبرمجة (${zarChannel.channelId})`);
      return { handled: false };
    }
    console.log(`[ZAR-LOG] 📍 القناة صحيحة ومطابقة لإعدادات اللعبة.`);

    // 4. تجميع وفحص الأزرار في الرسالة المعدلة
    const buttons = collectButtons(newMessage);
    console.log(`[ZAR-LOG] 🔘 عدد الأزرار المكتشفة في الرسالة المعدلة: ${buttons.length}`);
    if (buttons.length === 0) {
      console.log(`[ZAR-LOG] ❌ تم التجاهل: لا توجد أزرار تفاعلية في هذه الرسالة حتى الآن.`);
      return { handled: false };
    }

    // 5. فحص نص الرسالة والكلمات الدليلية
    const text = textFromMessage(newMessage);
    console.log(`[ZAR-LOG] 📝 النص المستخرج بالكامل من الرسالة المعدلة: "${text}"`);
    
    const hasZarText = text.includes('زر') || text.toLowerCase().includes('zar') || buttons.length >= 12;
    console.log(`[ZAR-LOG] 🔍 نتيجة فحص الكلمات الدليليلة أو عدد الأزرار (>=12): ${hasZarText}`);
    if (!hasZarText) {
      console.log(`[ZAR-LOG] ❌ تم التجاهل: الرسالة المعدلة لا تخص لعبة الزر.`);
      return { handled: false };
    }

    // 6. تصفية الأزرار الخضراء
    const greenButtons = buttons.filter(isGreenButton);
    console.log(`[ZAR-LOG] 🟢 عدد الأزرار الخضراء المكتشفة حالياً: ${greenButtons.length}`);
    if (greenButtons.length !== 1) {
      console.log(`[ZAR-LOG] ❌ تم التجاهل: شرط الزر الأخضر الوحيد لم يتحقق (مطلوب 1 زر أخضر، والموجود حالياً: ${greenButtons.length})`);
      return { handled: false };
    }

    // 7. مرحلة النقر التلقائي
    const targetButton = greenButtons[0];
    console.log(`[ZAR-LOG] 🎯 تم رصد الزر الأخضر بنجاح! جاري محاولة الضغط على معرف: ${targetButton.customId}`);
    
    await newMessage.clickButton(targetButton.customId);
    console.log(`[ZAR-LOG] ✅ تم إرسال أمر النقر بنجاح إلى ديسكورد.`);
    
    return {
      handled: true,
      type: 'game_play',
      result: 'play',
      gameName: 'زر',
      message: 'تم اكتشاف الزر الأخضر من رسالة Zar والضغط عليه.',
      details: { buttonLabel: targetButton.label || null, buttonStyle: targetButton.style, buttonsCount: buttons.length },
    };
  },
};