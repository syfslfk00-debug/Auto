module.exports = {
  name: 'messageCreate', 
  eventType: 'game_join',
  gameName: 'روليت',
  async execute(arg1, arg2) {
    console.log("====================================");
    console.log("🤖 [روليت] تم استدعاء ملف الدخول، جاري الفحص...");

    let message = [arg1, arg2].find(arg => arg && (arg.components || arg.embeds || arg.content) && arg.author?.bot);
    
    if (!message || !message.author.bot) return { handled: false };

    let allTexts = [message.content || ""];
    if (message.embeds?.[0]) {
      const e = message.embeds[0].data || message.embeds[0];
      allTexts.push(e.title || "", e.description || "");
    }

    if (!allTexts.some(t => t.includes('روليت') || t.includes('العجلة'))) return { handled: false };

    console.log("🎯 [نجاح] تم رصد رسالة لعبة الروليت!");

    // --- 🔄 نظام المحاولات المتكررة لجلب الأزرار ---
    let retries = 3; 
    let buttonsFound = false;

    while (retries > 0 && !buttonsFound) {
      const currentButtons = message.components?.flatMap(row => row.components) || [];
      
      if (currentButtons.length > 0) {
        buttonsFound = true;
        break;
      }

      console.log(`⏳ الأزرار لم تظهر (محاولة ${4 - retries}/3)، جاري الانتظار 800ms...`);
      await new Promise(res => setTimeout(res, 800));
      
      try {
        message = await message.channel.messages.fetch(message.id);
      } catch (err) {
        console.log("❌ فشل تحديث الرسالة:", err.message);
        break;
      }
      retries--;
    }

    if (!buttonsFound) {
      console.log("⚠️ فشل العثور على الأزرار بعد 3 محاولات. قد تكون الرسالة قديمة أو معطلة.");
      return { handled: false };
    }

    const allButtons = message.components.flatMap(row => row.components);
    const isNumberedLobby = allButtons.some(b => /^\d+$/.test((b.label || '').trim()));

    if (isNumberedLobby) {
      console.log("📝 نظام اللوبي الرقمي رُصد.");
      const available = allButtons.filter(b => !b.disabled && !['اخرج', 'متجر'].some(s => b.label?.includes(s)));
      if (available.length === 0) return { handled: false };
      
      const target = available[Math.floor(Math.random() * available.length)];
      return await clickWithHumanDelay(message, target, `الخانة ${target.label}`);
    } else {
      console.log("🟢 نظام الانضمام المباشر رُصد.");
      const joinBtn = allButtons[0];
      if (!joinBtn || joinBtn.disabled) return { handled: false };
      return await clickWithHumanDelay(message, joinBtn, "زر الانضمام");
    }
  },
};

async function clickWithHumanDelay(message, button, label) {
  const delay = Math.floor(Math.random() * 500) + 400; // تأخير بين 400ms و 900ms
  await new Promise(res => setTimeout(res, delay));
  try {
    await message.clickButton(button.customId);
    console.log(`🚀 تم الدخول عبر [${label}] بنجاح!`);
    return { handled: true, result: 'join', gameName: 'روليت' };
  } catch (e) {
    console.error("❌ فشل الضغط:", e.message);
    return { handled: false };
  }
}