require("dotenv").config();   
require("./config");
const { exec } = require("child_process");
const fs = require("fs");

// --- NEW: LOCKFILE & DEPENDENCY LOGIC ---
// This checks if node_modules exists. If not, it forces an install to prevent lockfile errors.
if (!fs.existsSync('./node_modules')) {
    console.log("Modules missing or Lockfile error. Fixing environment...");
    exec("npm install", (error, stdout, stderr) => {
        if (error) {
            console.error(`Error fixing lockfile: ${error}`);
            return;
        }
        console.log("Environment fixed. Restarting...");
    });
}

// Ensure antilink.json exists
if (!fs.existsSync('./antilink.json')) {
    fs.writeFileSync('./antilink.json', JSON.stringify([]));
}

const express = require('express') 
const app = express() 
const port = process.env.PORT || 8080;
const { 
   default: goutamConnect, 
   useMultiFileAuthState, 
   Browsers,
   fetchLatestBaileysVersion, 
   makeInMemoryStore, 
   proto, 
   getContentType, 
} = require("@whiskeysockets/baileys"); 
const pino = require("pino"); 
const axios = require("axios"); 
const chalk = require("chalk"); 

const store = makeInMemoryStore({ 
   logger: pino().child({ level: "silent", stream: "store" }), 
}); 

async function startHisoka() { 
   // We use 'session' folder for persistence
   const { state, saveCreds } = await useMultiFileAuthState(`./session`); 
   const { version } = await fetchLatestBaileysVersion(); 

   const client = goutamConnect({ 
      logger: pino({ level: "silent" }), 
      printQRInTerminal: true, 
      browser: Browsers.macOS('Desktop'),
      auth: state 
   }); 

   client.ev.on("messages.upsert", async (chatUpdate) => { 
     try { 
       let mek = chatUpdate.messages[0]; 
       if (!mek.message) return; 
       
       // Basic message parsing (simplified for the new logic)
       const m = mek;
       const mtype = getContentType(m.message);
       const body = (mtype === 'conversation') ? m.message.conversation : (mtype === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (mtype == 'imageMessage') ? m.message.imageMessage.caption : (mtype == 'videoMessage') ? m.message.videoMessage.caption : '';
       const prefix = process.env.PREFIX || ".";
       const isCmd = body.startsWith(prefix);
       const command = isCmd ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : "";
       const args = body.trim().split(/ +/).slice(1);
       const q = args.join(" ");
       const chat = m.key.remoteJid;
       const isGroup = chat.endsWith('@g.us');

       // --- ALL NEW COMMANDS LOGIC ---
       if (isCmd) {
           switch (command) {
               case 'menu':
                   let menu = `*GSS MULTI-FUNCTION BOT*\n\n` +
                              `🔹 .antilink [on/off]\n` +
                              `🔹 .translate [lang] [text]\n` +
                              `🔹 .quiz (Web Game)\n` +
                              `🔹 .owner / .setsudo\n` +
                              `🔹 .setppgroup (Reply Image)`;
                   await client.sendMessage(chat, { text: menu });
                   break;

               case 'antilink':
                   if (!isGroup) return;
                   let antilinkDB = JSON.parse(fs.readFileSync('./antilink.json'));
                   if (q === 'on') {
                       if (!antilinkDB.includes(chat)) antilinkDB.push(chat);
                       fs.writeFileSync('./antilink.json', JSON.stringify(antilinkDB));
                       client.sendMessage(chat, { text: "✅ Antilink Activated." });
                   } else if (q === 'off') {
                       antilinkDB = antilinkDB.filter(x => x !== chat);
                       fs.writeFileSync('./antilink.json', JSON.stringify(antilinkDB));
                       client.sendMessage(chat, { text: "❌ Antilink Deactivated." });
                   }
                   break;

               case 'translate':
                   if (!args[1]) return client.sendMessage(chat, { text: "Use: .translate en Hello" });
                   const tr = await axios.get(`https://api.popcat.xyz/translate?to=${args[0]}&text=${encodeURIComponent(args.slice(1).join(" "))}`);
                   client.sendMessage(chat, { text: `*Translation:* ${tr.data.translated}` });
                   break;

               case 'quiz':
                   const res = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple');
                   const data = res.data.results[0];
                   client.sendMessage(chat, { text: `*QUIZ*\n\nCategory: ${data.category}\nQuestion: ${data.question}` });
                   break;
           }
       }

       // Link to existing repository logic (bot.js)
       require("./bot")(client, m, chatUpdate, store); 

     } catch (err) { console.log(err); } 
   }); 

   client.ev.on("connection.update", (update) => {
       const { connection } = update;
       if (connection === "open") console.log(chalk.green("CONNECTED TO WHATSAPP"));
       if (connection === "close") startHisoka();
   });

   client.ev.on("creds.update", saveCreds); 
} 

startHisoka(); 
app.get('/', (req, res) => res.send('Bot Status: Online'));
app.listen(port);
