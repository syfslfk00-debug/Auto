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
  name: 'messageCreate',
  eventType: 'game_play',
  gameName: 'زر',
  async execute(message, client) {
    // 1. تسجيل عند استقبال أي رسالة جديدة
    console.log(`[ZAR-LOG] تم استقبال رسالة جديدة | معرف القناة: ${message?.channel?.id || 'غير معروف'}`);

    // 2. فحص كاتب الرسالة
    if (!message.author || !message.author.bot) {
      console.log(`[ZAR-LOG] تم التجاهل: الرسالة ليست من بوت أو بيانات الكاتب ناقصة.`);
      return { handled: false };
    }
    console.log(`[ZAR-LOG] الرسالة قادمة من بوت: ${message.author.tag}`);

    // 3. فحص تطابق القناة
    const context = client.engineContext || {};
    const zarChannel = context.settings && context.settings.zarChannel;
    if (zarChannel && zarChannel.channelId && message.channel && message.channel.id !== zarChannel.channelId) {
      console.log(`[ZAR-LOG] تم التجاهل: الرسالة في روم أخر (${message.channel.id}) وليس روم اللعبة المبرمج (${zarChannel.channelId})`);
      return { handled: false };
    }
    console.log(`[ZAR-LOG] القناة صحيحة ومطابقة لإعدادات اللعبة.`);

    // 4. تجميع وفحص الأزرار
    const buttons = collectButtons(message);
    console.log(`[ZAR-LOG] عدد الأزرار المكتشفة القابلة للتفاعل: ${buttons.length}`);
    if (buttons.length === 0) {
      console.log(`[ZAR-LOG] تم التجاهل: لا توجد أزرار تفاعلية ونشطة في هذه الرسالة.`);
      return { handled: false };
    }

    // 5. فحص نص الرسالة والكلمات الدليليلة
    const text = textFromMessage(message);
    console.log(`[ZAR-LOG] النص المستخرج بالكامل من الرسالة: "${text}"`);
    
    const hasZarText = text.includes('زر') || text.toLowerCase().includes('zar') || buttons.length >= 12;
    console.log(`[ZAR-LOG] نتيجة فحص الكلمات الدليليلة أو عدد الأزرار (>=12): ${hasZarText}`);
    if (!hasZarText) {
      console.log(`[ZAR-LOG] تم التجاهل: الرسالة لا تحتوي على كلمات اللعبة وشروطها.`);
      return { handled: false };
    }

    // 6. تصفية الأزرار الخضراء
    const greenButtons = buttons.filter(isGreenButton);
    console.log(`[ZAR-LOG] عدد الأزرار الخضراء المكتشفة حالياً: ${greenButtons.length}`);
    if (greenButtons.length !== 1) {
      console.log(`[ZAR-LOG] تم التجاهل: شرط الزر الأخضر الوحيد لم يتحقق (مطلوب 1، والموجود: ${greenButtons.length})`);
      return { handled: false };
    }

    // 7. مرحلة النقر التلقائي
    const targetButton = greenButtons[0];
    console.log(`[ZAR-LOG] 🎯 تم العثور على الزر بنجاح! جاري محاولة الضغط على معرف: ${targetButton.customId}`);
    
    await message.clickButton(targetButton.customId);
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