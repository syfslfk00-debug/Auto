const { Client, Collection } = require('discord.js');
const client = new Client({ intents: ['GUILDS', 'GUILD_MEMBERS', 'GUILD_MESSAGES'] });

const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId } = require('./config.json');
const { connectDatabase } = require('./handlers/database');
const engineRuntime = require('./services/engineRuntime');
const eventBus = require('./services/eventBus');
const notificationService = require('./services/notificationService');

const token = process.env.TOKEN;

client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

// 🚀 الميزة الضرورية المقررة: تعريف المصفوفة لتجميع بيانات السلاش كوماند لإرسالها لـ Discord API
const commands = [];

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
    
    // تحويل بيانات أمر السلاش إلى تنسيق JSON مسموح وإضافته للمصفوفة تلقائياً
    if (command.data && typeof command.data.toJSON === 'function') {
        commands.push(command.data.toJSON());
    }
    
    if (Array.isArray(command.aliases)) {
        for (const alias of command.aliases) client.commands.set(alias, command);
    }
}

const eventsFolder = './events';
const eventFiles = fs.readdirSync(eventsFolder).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        // الربط الطبيعي للأحداث
        client.on(event.name, (...args) => event.execute(...args, client));

        // إشراك حدث التعديل (messageUpdate) إذا كان الملف مهتماً بـ messageCreate
        if (event.name === 'messageCreate') {
            client.on('messageUpdate', async (oldMessage, newMessage) => {
                // نمرر الرسالة الجديدة المحدثة ليتم فحصها بنفس كود الـ messageCreate
                // مع تمرير كائن client كمعامل أخير كما هو في ملفك الرئيسي
                await event.execute(newMessage, client); 
            });
        }
    }
}

client.once('ready', async () => {
  console.log('تم تسجيل الدخول باسم ' + client.user.tag);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() && !(interaction.isAutocomplete && interaction.isAutocomplete())) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        if (interaction.isAutocomplete && interaction.isAutocomplete()) {
            if (typeof command.autocomplete === 'function') await command.autocomplete(interaction, client);
            return;
        }

        await command.execute(interaction, client);
    } catch (error) {
        console.error(error);
        await eventBus.publish({ type: 'admin_action_error', level: 'خطأ', status: 'error', message: error.message, details: { command: interaction.commandName, stack: error.stack } }).catch(() => {});
        const payload = { content: 'حدث خطأ أثناء تنفيذ هذا الأمر.', ephemeral: true };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
        else await interaction.reply(payload).catch(() => {});
    }
});

client.on('unhandledRejection', reason => {
  eventBus.publish({ type: 'client_unhandled_rejection', level: 'خطأ', status: 'error', message: reason && reason.message ? reason.message : String(reason), details: { stack: reason && reason.stack } }).catch(() => {});
});

process.on('uncaughtException', error => {
  eventBus.publish({ type: 'uncaught_exception', level: 'خطأ', status: 'error', message: error.message, details: { stack: error.stack } }).catch(() => {});
});

process.on('unhandledRejection', reason => {
  eventBus.publish({ type: 'unhandled_rejection', level: 'خطأ', status: 'error', message: reason && reason.message ? reason.message : String(reason), details: { stack: reason && reason.stack } }).catch(() => {});
});

async function startApplication() {
    await connectDatabase();

    if (!token) {
        console.error('متغير بيئة رمز البوت مفقود. تم تخطي تسجيل الدخول.');
        return;
    }

    const rest = new REST({ version: '9' }).setToken(token);

    try {
    console.log('بدأ تحديث أوامر التطبيق.');
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );
    console.log('تم تحديث أوامر التطبيق بنجاح.');
    } catch (error) {
        console.error(error);
        await eventBus.publish({ type: 'admin_action_error', level: 'خطأ', status: 'error', message: error.message, details: { action: 'refresh_commands', stack: error.stack } }).catch(() => {});
    }

    await client.login(token);
    notificationService.start(client);

    await engineRuntime.startAllEngines();
}

startApplication().catch(error => {
    console.error('فشل بدء التطبيق:', error);
    eventBus.publish({ type: 'startup_failed', level: 'خطأ', status: 'error', message: error.message, details: { stack: error.stack } }).catch(() => {});
});