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
    if (!message.author || !message.author.bot) return { handled: false };
    const context = client.engineContext || {};
    const zarChannel = context.settings && context.settings.zarChannel;
    if (zarChannel && zarChannel.channelId && message.channel && message.channel.id !== zarChannel.channelId) return { handled: false };

    const buttons = collectButtons(message);
    if (buttons.length === 0) return { handled: false };

    const text = textFromMessage(message);
    const hasZarText = text.includes('زر') || text.toLowerCase().includes('zar') || buttons.length >= 12;
    if (!hasZarText) return { handled: false };

    const greenButtons = buttons.filter(isGreenButton);
    if (greenButtons.length !== 1) return { handled: false };

    const targetButton = greenButtons[0];
    await message.clickButton(targetButton.customId);
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
