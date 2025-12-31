require("dotenv").config();   
require("./config");
const { exec } = require("child_process");
const fs = require("fs");
const express = require('express'); 
const app = express(); 
const port = process.env.PORT || 8080;
const { 
   default: goutamConnect, 
   useMultiFileAuthState, 
   Browsers,
   fetchLatestBaileysVersion, 
   makeInMemoryStore, 
   getContentType, 
} = require("@whiskeysockets/baileys"); 
const pino = require("pino"); 
const axios = require("axios"); 
const chalk = require("chalk"); 

// Ensure antilink.json exists
if (!fs.existsSync('./antilink.json')) {
    fs.writeFileSync('./antilink.json', JSON.stringify([]));
}

const store = makeInMemoryStore({ 
   logger: pino().child({ level: "silent", stream: "store" }), 
}); 

async function startHisoka() { 
   console.log(chalk.blue("--- BOT INITIALIZING ---"));
   
   // We use 'session' folder for persistence
   const { state, saveCreds } = await useMultiFileAuthState(`./session`); 
   const { version } = await fetchLatestBaileysVersion(); 

   const client = goutamConnect({ 
      logger: pino({ level: "silent" }), 
      printQRInTerminal: !process.env.PAIRING_CODE, 
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      auth: state 
   }); 

   // MESSAGE LOGIC
   client.ev.on("messages.upsert", async (chatUpdate) => { 
     try { 
        let mek = chatUpdate.messages[0]; 
        if (!mek.message) return; 
        
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

        if (isCmd) {
            switch (command) {
                case 'menu':
                    let menu = `*GSS MULTI-FUNCTION BOT*\n\n` +
                               `🔹 .antilink [on/off]\n` +
                               `🔹 .translate [lang] [text]\n` +
                               `🔹 .quiz\n` +
                               `🔹 .owner`;
                    await client.sendMessage(chat, { text: menu });
                    break;
            }
        }
        require("./bot")(client, m, chatUpdate, store); 
     } catch (err) { console.log(err); } 
   }); 

   // CONNECTION LOGIC (Pairing Code is here)
   client.ev.on("connection.update", async (update) => {
       const { connection } = update;
       
       if (connection === "open") {
           console.log(chalk.green("CONNECTED TO WHATSAPP"));
       }

       if (connection === "connecting" && process.env.PAIRING_CODE === "true" && !client.authState.creds.registered) {
           console.log(chalk.yellow("Connection established. Requesting pairing code..."));
           setTimeout(async () => {
               try {
                   let code = await client.requestPairingCode(process.env.PHONE_NUMBER);
                   code = code?.match(/.{1,4}/g)?.join("-") || code;
                   console.log(chalk.black.bgGreen(`\n--- YOUR PAIRING CODE: ${code} ---\n`));
               } catch (e) {
                   console.error(chalk.red("Pairing Request Failed:"), e.message);
               }
           }, 5000);
       }

       if (connection === "close") {
           console.log(chalk.red("Connection closed. Restarting..."));
           startHisoka();
       }
   });

   client.ev.on("creds.update", saveCreds);
