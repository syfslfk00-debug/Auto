const { Client } = require('discord.js-selfbot-v13');
const path = require('path');
const fs = require('fs');
const { QuantumDB } = require('qd.db');
const db = new QuantumDB('replka-tokens.json');
const activeClients = new Map();

async function stopAllTokens() {
  for (const [token, client] of activeClients) {
    try {
      await client.destroy();
      console.log(`Replka token ${token.substring(0, 10)}... stopped`);
      activeClients.delete(token);
    } catch (error) {
      console.error(`Error stopping token ${token.substring(0, 10)}...:`, error);
    }
  }
}

async function startTokens() {
  try {
    const tokens = await db.get('tokens') || [];
     for (const token of tokens) {
       try {
    const client = new Client(); 
       await client.login(token).then(async () => {
    const eventsFolder = path.join(__dirname, '..', 'tokensHandler', 'Replka', 'events');
    const eventFiles = fs.readdirSync(eventsFolder).filter(file => file.endsWith('.js')); 
         for (const file of eventFiles) {
      const event = require(`${eventsFolder}/${file}`);
         if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
        } else {
      client.on(event.name, (...args) => event.execute(...args, client));
        }
      }
      activeClients.set(token, client);
      console.log(`Replka token ${token.substring(0, 10)}... started successfully`);
       }).catch(error => {
      console.error(`Failed to login with token ${token.substring(0, 10)}...:`, error.message);
          });    
        } catch (error) {
                console.error(`Error initializing token ${token.substring(0, 10)}...:`, error);
        }
      }
        console.log('Replka tokens loading process completed!');
    } catch (error) {
        console.error('Error in startTokens:', error);
  }
}

activeClients.forEach(client => {
    client.on('error', console.error);
});

module.exports = {
    startTokens,
    stopAllTokens,
    activeClients
};

startTokens().catch(console.error);