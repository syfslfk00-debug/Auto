module.exports = {
  name: 'ready',
  eventType: 'engine_start',
  gameName: 'زر',
  async execute(client) {
    const context = client.engineContext || {};
    const settings = context.settings || {};
    const zarChannel = settings.zarChannel || null;
    if (!zarChannel || !zarChannel.channelId) {
      return {
        handled: true,
        type: 'engine_event_error',
        level: 'خطأ',
        status: 'error',
        result: 'missing_zar_channel',
        gameName: 'زر',
        message: 'لم يتم العثور على قناة Zar مرتبطة بهذا الحساب.',
      };
    }

    const channel = await client.channels.fetch(zarChannel.channelId).catch(() => null);
    if (!channel || typeof channel.send !== 'function') {
      return {
        handled: true,
        type: 'engine_event_error',
        level: 'خطأ',
        status: 'error',
        result: 'zar_channel_unavailable',
        gameName: 'زر',
        message: 'تعذر الوصول إلى قناة Zar المرتبطة بهذا الحساب.',
        details: { channelId: zarChannel.channelId, guildId: zarChannel.guildId },
      };
    }

    // تسجيل مستمع الرسائل مرة واحدة فقط لتجنب التكرار
    if (!client._rouletteListenerRegistered) {
      client._rouletteListenerRegistered = true;
      client._rouletteChannelId = zarChannel.channelId; // نخزن معرف القناة

      client.on('messageCreate', async (message) => {
        // تجاهل رسائل البوت نفسه أو أي رسالة ليس في القناة المستهدفة
        if (message.author.id === client.user.id) return;
        if (message.channel.id !== client._rouletteChannelId) return;
        // التحقق من أن الرسالة من بوت (لتجنب رسائل المستخدمين العاديين إن أردت)
        if (!message.author.bot) return; // يمكن إزالة هذا السطر إذا كنت تريد المراقبة لأي رسالة
        // البحث عن عبارة الفوز
        if (message.content.includes('فاز باللعبة')) {
          // إرسال أمر جديد
          await message.channel.send('-روليت').catch(() => {});
        }
      });
    }

    // إرسال أول أمر لبدء الدورة
    await channel.send('-روليت');

    return {
      handled: true,
      type: 'game_join',
      result: 'start',
      gameName: 'زر',
      message: 'تم بدء دورة الروليت التلقائية، سيتم إعادة الإرسال عند كل فوز.',
      details: { channelId: zarChannel.channelId, guildId: zarChannel.guildId },
    };
  },
};