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
}

const commands = client.commands.map(command => command.data.toJSON());

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
  console.log('Logged as ' + client.user.tag);
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
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
        console.error('TOKEN environment variable is missing. Discord bot login was skipped.');
        return;
    }

    const rest = new REST({ version: '9' }).setToken(token);

    try {
    console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );
    console.log('Successfully reloaded application (/) commands.');
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
    console.error('Failed to start application:', error);
});
