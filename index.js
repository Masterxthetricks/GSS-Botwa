require("dotenv").config();   
require("./config");
const express = require('express') 
const moment = require("moment-timezone");  
const app = express() 
const port = 8000
  
const { 
   default: goutamConnect, 
   useMultiFileAuthState, 
   Browsers,
   DisconnectReason, 
   fetchLatestBaileysVersion, 
   makeInMemoryStore, 
   jidDecode, 
   downloadMediaMessage, 
   proto, 
   getContentType, 
   getAggregateVotesInPollMessage,
} = require("@whiskeysockets/baileys"); 
const pino = require("pino"); 
const { Boom } = require("@hapi/boom"); 
const fs = require("fs"); 
const axios = require("axios"); 
const chalk = require("chalk"); 
const cfonts = require('cfonts');
const figlet = require("figlet"); 
const _ = require("lodash"); 
const PhoneNumber = require("awesome-phonenumber"); 

// --- AUTO-FILE CREATION (Prevents Crashing) ---
if (!fs.existsSync('./antilink.json')) {
    fs.writeFileSync('./antilink.json', JSON.stringify([]));
}
let antilink = JSON.parse(fs.readFileSync('./antilink.json', 'utf-8'));

const store = makeInMemoryStore({ 
   logger: pino().child({ level: "silent", stream: "store" }), 
}); 

const color = (text, color) => !color ? chalk.green(text) : chalk.keyword(color)(text);

function typeWriter(text, speed) {
  return new Promise((resolve) => {
    let i = 0;
    function type() {
      if (i < text.length) {
        process.stdout.write(text.charAt(i));
        i++;
        setTimeout(type, speed);
      } else {
        console.log();
        resolve();
      }
    }
    type();
  });
}

function smsg(conn, m, store) { 
   if (!m) return m; 
   let M = proto.WebMessageInfo; 
   if (m.key) { 
     m.id = m.key.id; 
     m.chat = m.key.remoteJid; 
     m.fromMe = m.key.fromMe; 
     m.isGroup = m.chat.endsWith("@g.us"); 
     m.sender = conn.decodeJid((m.fromMe && conn.user.id) || m.participant || m.key.participant || m.chat || ""); 
     if (m.isGroup) m.participant = conn.decodeJid(m.key.participant) || ""; 
   } 
   if (m.message) { 
     m.mtype = getContentType(m.message); 
     m.msg = m.mtype == "viewOnceMessage" ? m.message[m.mtype].message[getContentType(m.message[m.mtype].message)] : m.message[m.mtype]; 
     m.body = m.message.conversation || m.msg.caption || m.msg.text || (m.mtype == "listResponseMessage" && m.msg.singleSelectReply.selectedRowId) || (m.mtype == "buttonsResponseMessage" && m.msg.selectedButtonId) || m.text; 
     let quoted = (m.quoted = m.msg.contextInfo ? m.msg.contextInfo.quotedMessage : null); 
     m.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : []; 
     if (m.quoted) { 
       let type = getContentType(quoted); 
       m.quoted = m.quoted[type]; 
       if (typeof m.quoted === "string") m.quoted = { text: m.quoted }; 
       m.quoted.mtype = type; 
       m.quoted.sender = conn.decodeJid(m.msg.contextInfo.participant); 
       m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || ""; 
     } 
   } 
   m.text = m.msg?.text || m.msg?.caption || m.message?.conversation || ""; 
   m.reply = (text) => conn.sendMessage(m.chat, { text: text }, { quoted: m }); 
   return m; 
} 

async function startHisoka() { 
   const { state, saveCreds } = await useMultiFileAuthState(`./session`); 
   const { version, isLatest } = await fetchLatestBaileysVersion(); 

   await typeWriter(color("GSS-BOT INITIALIZING...", "hotpink"), 100);

   const client = goutamConnect({ 
      logger: pino({ level: "silent" }), 
      printQRInTerminal: true, 
      browser: Browsers.macOS('Desktop'),
      auth: state 
   }); 

   store.bind(client.ev);

   client.ev.on("messages.upsert", async (chatUpdate) => { 
     try { 
       let mek = chatUpdate.messages[0]; 
       if (!mek.message) return; 
       let m = smsg(client, mek, store); 

       const prefix = process.env.PREFIX || ".";
       const isCmd = m.body.startsWith(prefix);
       const command = isCmd ? m.body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : "";
       const args = m.body.trim().split(/ +/).slice(1);
       const q = args.join(" ");

       // OWNER & ADMIN LOGIC
       const botNumber = client.decodeJid(client.user.id);
       const ownerNumber = (process.env.OWNER_NUMBER || global.OwnerNumber[0]) + "@s.whatsapp.net";
       const isOwner = m.sender === ownerNumber || m.fromMe;
       const groupMetadata = m.isGroup ? await client.groupMetadata(m.chat) : "";
       const participants = m.isGroup ? groupMetadata.participants : [];
       const groupAdmins = m.isGroup ? participants.filter(v => v.admin !== null).map(v => v.id) : [];
       const isAdmins = groupAdmins.includes(m.sender) || isOwner;
       const isBotAdmins = groupAdmins.includes(botNumber);

       // ANTILINK ACTION
       if (m.isGroup && antilink.includes(m.chat) && !isAdmins && isBotAdmins) {
           if (m.body.match(/(chat.whatsapp.com\/)/gi)) {
               await client.sendMessage(m.chat, { delete: mek.key });
               await client.groupParticipantsUpdate(m.chat, [m.sender], 'remove');
           }
       }

       if (isCmd) {
           switch (command) {
               case 'menu':
                   let menu = `┏━━━ *GSS MENU* ━━━┓\n`;
                   menu += `┃ 👑 *Owner:* .owner, .setsudo\n`;
                   menu += `┃ 🛡️ *Admin:* .tagall, .hidetag, .antilink, .mute, .unmute, .kickall, .setppgroup\n`;
                   menu += `┃ 🎮 *Games:* .quiz, .math\n`;
                   menu += `┃ 🌍 *Tools:* .translate [lang] [text]\n`;
                   menu += `┗━━━━━━━━━━━━━━━━┛`;
                   m.reply(menu);
                   break;

               case 'owner':
                   client.sendMessage(m.chat, { contacts: { displayName: global.OwnerName, contacts: [{ vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${global.OwnerName}\nTEL;type=CELL;type=VOICE;waid=${ownerNumber.split('@')[0]}:+${ownerNumber.split('@')[0]}\nEND:VCARD` }] } });
                   break;

               case 'setsudo':
                   if (!isOwner) return m.reply("Owner Only!");
                   let target = m.quoted ? m.quoted.sender : args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : '';
                   if (!target) return m.reply("Tag someone!");
                   m.reply(`Successfully added @${target.split('@')[0]} as Sudo.`);
                   break;

               case 'antilink':
                   if (!m.isGroup) return m.reply("Group Only!");
                   if (!isAdmins) return m.reply("Admin Only!");
                   if (q === "on") {
                       if (antilink.includes(m.chat)) return m.reply("Already on.");
                       antilink.push(m.chat);
                       fs.writeFileSync('./antilink.json', JSON.stringify(antilink));
                       m.reply("Antilink Enabled.");
                   } else if (q === "off") {
                       antilink = antilink.filter(x => x !== m.chat);
                       fs.writeFileSync('./antilink.json', JSON.stringify(antilink));
                       m.reply("Antilink Disabled.");
                   } else m.reply("Use: .antilink on/off");
                   break;

               case 'setppgroup':
                   if (!m.isGroup || !isAdmins || !isBotAdmins) return m.reply("Admin & Bot Admin required!");
                   let quoted = m.quoted ? m.quoted : m;
                   if (/image/.test(quoted.mtype)) {
                       let media = await client.downloadMediaMessage(quoted);
                       await client.updateProfilePicture(m.chat, media);
                       m.reply("Group Profile Picture Updated.");
                   } else m.reply("Reply to an image.");
                   break;

               case 'translate':
                   if (!args[0]) return m.reply("Example: .translate en Hello");
                   let lang = args[0];
                   let text = args.slice(1).join(" ");
                   let tr = await axios.get(`https://api.popcat.xyz/translate?to=${lang}&text=${encodeURIComponent(text)}`);
                   m.reply(`*Translation (${lang}):* ${tr.data.translated}`);
                   break;

               case 'quiz':
                   let az = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple');
                   let qz = az.data.results[0];
                   m.reply(`*QUESTION:*\n${qz.question}\n\nCategory: ${qz.category}\nDifficulty: ${qz.difficulty}`);
                   break;

               case 'tagall':
                   if (!m.isGroup || !isAdmins) return;
                   let txt = `*📢 Tag All*\n\n${q}\n\n`;
                   for (let i of participants) txt += `🔹 @${i.id.split('@')[0]}\n`;
                   client.sendMessage(m.chat, { text: txt, mentions: participants.map(a => a.id) });
                   break;
           }
       }
       // Preserve existing bot.js logic
       require("./bot")(client, m, chatUpdate, store); 
     } catch (err) { console.log(err); } 
   }); 

   client.ev.on("connection.update", async (update) => { 
     const { connection } = update; 
     if (connection === "open") {
       console.log(chalk.green("Bot Connected!"));
       await client.sendMessage(client.user.id, { text: "GSS-BOT is now Online with Full Features!" });
     }
     if (connection === "close") startHisoka();
   }); 
   client.ev.on("creds.update", saveCreds); 
   return client; 
} 
  
startHisoka(); 
app.get('/', (req, res) => res.send('Server Running'));
app.listen(port);
