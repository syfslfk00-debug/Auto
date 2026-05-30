const { Client, Collection } = require('discord.js');
const client = new Client({ intents: ['GUILDS', 'GUILD_MEMBERS', 'GUILD_MESSAGES'] });

const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId } = require('./config.json');
const { connectDatabase } = require('./handlers/database');

const token = process.env.TOKEN;

client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
    if (Array.isArray(command.aliases)) {
        for (const alias of command.aliases) client.commands.set(alias, command);
    }
}

const commands = [...new Set(client.commands.map(command => command))].map(command => command.data.toJSON());

const eventsFolder = './events';
const eventFiles = fs.readdirSync(eventsFolder).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

client.once('ready', async () => {
  console.log('تم تسجيل الدخول باسم ' + client.user.tag);
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'حدث خطأ أثناء تنفيذ هذا الأمر.', ephemeral: true });
	}
});

client.on('unhandledRejection', (reason, promise) => {
  return;
});

process.on('uncaughtException', error => {
  return;
});

process.on('unhandledRejection', (reason, promise) => {
  return;
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
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );
    console.log('تم تحديث أوامر التطبيق بنجاح.');
    } catch (error) {
        console.error(error);
    }

    fs.readdirSync('./bots').forEach(file => {
        if (file.endsWith('.js')) {
            require(`./bots/${file}`);
        }
    });

    await client.login(token);
}

startApplication().catch(error => {
    console.error('فشل بدء التطبيق:', error);
});
