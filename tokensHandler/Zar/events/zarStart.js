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

    await channel.send('-زر');
    return {
      handled: true,
      type: 'game_join',
      result: 'start',
      gameName: 'زر',
      message: 'تم إرسال أمر بدء لعبة Zar في القناة المرتبطة.',
      details: { channelId: zarChannel.channelId, guildId: zarChannel.guildId },
    };
  },
};