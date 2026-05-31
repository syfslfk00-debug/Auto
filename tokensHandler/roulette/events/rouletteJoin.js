module.exports = {
  name: 'messageCreate',
  eventType: 'game_join',
  gameName: 'روليت',
  async execute(message) {
    if (!message.author.bot) return { handled: false };
    if (message.embeds.length === 0) return { handled: false };

    const embed = message.embeds[0];
    // تجميع النصوص من كل أجزاء الإيمبد للبحث عن الكلمات المميزة
    let embedTexts = [];
    if (embed.title) embedTexts.push(embed.title);
    if (embed.description) embedTexts.push(embed.description);
    if (embed.fields) {
      for (const field of embed.fields) {
        if (field.name) embedTexts.push(field.name);
        if (field.value) embedTexts.push(field.value);
      }
    }
    if (embed.footer && embed.footer.text) embedTexts.push(embed.footer.text);
    if (embed.author && embed.author.name) embedTexts.push(embed.author.name);

    // البحث عن "روليت" أو "العجلة" في أي من النصوص المجمعة
    const hasGameName = embedTexts.some(text =>
      text.includes('روليت') || text.includes('العجلة')
    );
    if (!hasGameName) return { handled: false };

    const components = message.components;
    if (!components || components.length === 0) return { handled: false };

    const jb = components[0].components[0];
    if (!jb) return { handled: false };

    await message.clickButton(jb.customId);
    return {
      handled: true,
      type: 'game_join',
      result: 'join',
      gameName: 'روليت',
      message: 'تم دخول لعبة روليت.',
    };
  },
};