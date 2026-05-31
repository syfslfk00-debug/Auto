const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');

// دالة مساعدة لحفظ القائمة اليدوية في ملف خارجي للحفاظ عليها عند ريستارت البوت
function saveToFile() {
  if (!global.whitelistConfig) return;
  const arrayData = Array.from(global.whitelistConfig.customUsers);
  fs.writeFileSync('./whitelist.json', JSON.stringify(arrayData, null, 2), 'utf8');
}

module.exports = {
  category: 'الحماية',
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('إدارة القائمة البيضاء لمنع الحسابات من طرد بعضها أو طرد الأصدقاء')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('إضافة حساب أو معرف للقائمة البيضاء لمنع طرده')
        .addStringOption(opt => opt.setName('target').setDescription('اكتب معرف الحساب (ID) أو اسم المستخدم بدقة').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('إزالة حساب من القائمة البيضاء')
        .addStringOption(opt => opt.setName('target').setDescription('اكتب المعرف أو الاسم المراد إزالته').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('عرض الحسابات المحمية حالياً في القائمة البيضاء')
    ),

  async execute(interaction) {
    // التأكد من تهيئة القائمة في الذاكرة في حال تم استدعاء الأمر قبل بدء أي لعبة
    if (!global.whitelistConfig) {
      global.whitelistConfig = { botAccounts: new Set(), customUsers: new Set() };
    }

    const subcommand = interaction.options.getSubcommand();
    const target = interaction.options.getString('target')?.trim();

    // ➕ إضافة حساب للقائمة
    if (subcommand === 'add') {
      const lowerTarget = target.toLowerCase();
      global.whitelistConfig.customUsers.add(lowerTarget);
      saveToFile();
      return await interaction.reply({ content: `✅ تم إضافة **${target}** إلى القائمة البيضاء. لن تقوم الحسابات بطرده بعد الآن.`, ephemeral: true });
    }

    // 🗑️ إزالة حساب من القائمة
    if (subcommand === 'remove') {
      const lowerTarget = target.toLowerCase();
      if (global.whitelistConfig.customUsers.has(lowerTarget)) {
        global.whitelistConfig.customUsers.delete(lowerTarget);
        saveToFile();
        return await interaction.reply({ content: `🗑️ تم إزالة **${target}** من القائمة البيضاء بنجاح.`, ephemeral: true });
      } else {
        return await interaction.reply({ content: `❌ لم يتم العثور على **${target}** في القائمة اليدوية.`, ephemeral: true });
      }
    }

    // 📋 عرض القائمة الحالية
    if (subcommand === 'list') {
      const bots = Array.from(global.whitelistConfig.botAccounts);
      const customs = Array.from(global.whitelistConfig.customUsers);

      const responseLines = [
        `🛡️ **تقرير نظام الحماية والقائمة البيضاء:**`,
        `\n🤖 **حسابات البوت الحالية (اكتشاف تلقائي نشط):**`,
        bots.length ? bots.map(b => `• \`${b}\``).join('\n') : '• لم تقم الحسابات بتسجيل نفسها بعد (انتظر دخولها أول لعبة).',
        `\n👤 **الحسابات والأصدقاء المضافين يدوياً:**`,
        customs.length ? customs.map(c => `• \`${c}\``).join('\n') : '• لا يوجد أي صديق مضاف يدوياً حالياً.'
      ];

      return await interaction.reply({ content: responseLines.join('\n'), ephemeral: true });
    }
  },
};