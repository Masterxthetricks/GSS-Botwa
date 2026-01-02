require("dotenv").config();
const { 
    default: goutamConnect, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore, 
    delay, 
    fetchLatestBaileysVersion 
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require('path');
const chalk = require("chalk");
const pino = require("pino");
const express = require('express');
const axios = require("axios");

const app = express();
const port = process.env.PORT || 8080;
const sessionPath = path.join(__dirname, 'session');
const dbPath = path.join(__dirname, 'database.json');

if (!fs.existsSync(sessionPath)) { fs.mkdirSync(sessionPath, { recursive: true }); }

// 💾 DATABASE INITIALIZATION
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({
        antilink: false, antibot: false, antiwame: false, antitagall: false,
        antibadword: false, antispam: false, antifake: false, antidelete: false,
        automute: false, antiban: true, whitelist: [], 
        blockedCountries: ['994', '48', '1', '44'], 
        animeBlacklist: ['ayanokoji', 'kiyotaka', 'sasuke', 'sukuna', 'itadori', 'gojo', 'naruto'],
        blacklist: []
    }, null, 2));
}
global.db = JSON.parse(fs.readFileSync(dbPath));
const saveDB = () => fs.writeFileSync(dbPath, JSON.stringify(global.db, null, 2));

// 🔒 CONFIG
const PAIRING_NUMBER = "212701458617"; 
global.owner = ["212701458617", "85182757527702"]; 
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";
const badWords = ["fuck you", "djol santi", "pussy", "bouda santi", "bitch", "masisi", "bouzen", "langet manman w", "santi kk", "gyet manman w", "pouri", "bouda fon", "trip pouri", "koko santi", "kalanbe"];

app.get('/', (req, res) => res.status(200).send('GSS-BETA Online'));
app.listen(port, "0.0.0.0");

async function startHisoka() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    
    const client = goutamConnect({
        version,
        logger: pino({ level: "silent" }),
        browser: ["Linux", "Chrome", "1.0.0"], 
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        printQRInTerminal: false,
        mobile: false, 
        connectTimeoutMs: 60000, 
        keepAliveIntervalMs: 30000,
    });

    if (!client.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await client.requestPairingCode(PAIRING_NUMBER.replace(/[^0-9]/g, ''));
                console.log(chalk.black.bgGreen.bold(`\n 📲 PAIRING CODE FOR ${PAIRING_NUMBER}: ${code} \n`));
            } catch (e) { console.log("Pairing Error", e); }
        }, 10000);
    }

    client.ev.on("creds.update", saveCreds);

    client.ev.on("connection.update", (update) => {
        const { connection } = update;
        if (connection === "open") console.log(chalk.green.bold("\n ✅ GSS-BETA CONNECTED SUCCESSFULLY \n"));
    });

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.remoteJid === 'status@broadcast') return;
            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const sender = mek.key.participant || from;
            const senderNumber = sender.replace(/[^0-9]/g, '');
            
            // 🔒 OWNER CHECK
            const isOwner = global.owner.includes(senderNumber) || global.db.whitelist.includes(senderNumber);
            const botNumber = client.user.id.split(':')[0] + '@s.whatsapp.net';
            
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || mek.message.imageMessage?.caption || "").trim();
            const lowerBody = body.toLowerCase();
            const reply = (text) => client.sendMessage(from, { text }, { quoted: mek });

            const groupMetadata = isGroup ? await client.groupMetadata(from) : null;
            const isBotAdmin = isGroup ? groupMetadata.participants.find(v => v.id == botNumber)?.admin : false;

            // 🛡️ SECURITY AUTO-LOGIC
            if (global.db.antiban && !isOwner) { await delay(500); }
            if (isGroup && isBotAdmin && !isOwner) {
                if (global.db.antilink && lowerBody.includes("chat.whatsapp.com")) {
                    await client.sendMessage(from, { delete: mek.key });
                    return await client.groupParticipantsUpdate(from, [sender], "remove");
                }
                if (global.db.antibadword && badWords.some(word => lowerBody.includes(word))) {
                    return await client.sendMessage(from, { delete: mek.key });
                }
            }

            // 🛑 COMMAND LOCK
            if (!body.startsWith(".") || !isOwner) return;

            const args = body.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const q = args.join(" ");
            const readMore = String.fromCharCode(8206).repeat(4001);
            
            const quotedMsg = mek.message.extendedTextMessage?.contextInfo?.quotedMessage;
            let target = mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                         (quotedMsg ? mek.message.extendedTextMessage.contextInfo.participant : null);

            switch (command) {
                case 'menu':
                    let menuMsg = `╭───『 *${botName}* 』───
│ Hi 👋 ${mek.pushName || 'User'}
│ ✨ *${ownerName}*
╰───────────────────${readMore}
├─『 *Admin & Group* 』
│ .add | .kick | .tagall
│ .hidetag | .kickall | .mute
│ .unmute | .promote | .demote
│
├─『 *Security/Auto* 』
│ .antilink | .antibot | .antifake
│ .antibadword | .antiban | .status
│ .blockcountry | .addanime | .automute
│ .whitelist
│
├──『 *Utility & Fun* 』
│ .ping | .ai | .owner | .backup`;
                    
                    await client.sendMessage(from, { 
                        video: { url: "https://media.giphy.com/media/Uau9JUChC8FdZnmVmX/giphy.gif" }, 
                        caption: menuMsg, 
                        gifPlayback: true 
                    }, { quoted: mek });
                    break;

                // ────『 Admin & Group (EXECUTABLE) 』────
                case 'add':
                case 'promote':
                case 'demote':
                    if (!isGroup || !isBotAdmin) return reply("Bot must be Admin.");
                    let u = command === 'add' ? q.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : target;
                    if (!u) return reply("Target missing.");
                    await client.groupParticipantsUpdate(from, [u], command === 'add' ? 'add' : command);
                    reply(`✅ Done.`);
                    break;

                case 'kick':
                    if (!isGroup || !isBotAdmin) return;
                    if (!target) return reply("Reply or tag.");
                    await client.groupParticipantsUpdate(from, [target], "remove");
                    break;

                case 'mute':
                case 'unmute':
                    if (!isGroup || !isBotAdmin) return;
                    await client.groupSettingUpdate(from, command === 'mute' ? 'announcement' : 'not_announcement');
                    reply(`✅ Group ${command}d.`);
                    break;

                case 'kickall':
                    const all = groupMetadata.participants.filter(v => !global.owner.includes(v.id.split('@')[0]) && v.id !== botNumber);
                    reply("🚀 Cleaning group...");
                    for (let mem of all) { 
                        await client.groupParticipantsUpdate(from, [mem.id], "remove"); 
                        await delay(500); 
                    }
                    break;

                case 'tagall':
                case 'hidetag':
                    let teks = q ? q : "📢 Attention!";
                    client.sendMessage(from, { text: teks, mentions: groupMetadata.participants.map(a => a.id) });
                    break;

                // ────『 Security (EXECUTABLE TOGGLES) 』────
                case 'antilink':
                case 'antibot':
                case 'antifake':
                case 'antibadword':
                case 'antiban':
                case 'automute':
                    global.db[command] = !global.db[command];
                    saveDB();
                    reply(`✅ ${command.toUpperCase()}: ${global.db[command] ? 'ON' : 'OFF'}`);
                    break;

                case 'status':
                    let stat = `⚙️ *SYSTEM STATUS*\n\n`;
                    for (let key in global.db) { if (typeof global.db[key] === 'boolean') stat += `${global.db[key] ? '✅' : '❌'} ${key.toUpperCase()}\n`; }
                    reply(stat);
                    break;

                // ────『 Utility 』────
                case 'ping':
                    reply(`⚡ Speed: ${Date.now() - mek.messageTimestamp * 1000}ms`);
                    break;

                case 'ai':
                    const aiRes = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                    reply(`🤖 AI: ${aiRes.data.success}`);
                    break;

                case 'owner':
                    const vcard = 'BEGIN:VCARD\nVERSION:3.0\nFN:' + ownerName + '\nTEL;type=CELL;type=VOICE;waid=' + global.owner[0] + ':+' + global.owner[0] + '\nEND:VCARD';
                    client.sendMessage(from, { contacts: { displayName: ownerName, contacts: [{ vcard }] } });
                    break;

                case 'backup':
                    await client.sendMessage(from, { document: fs.readFileSync(dbPath), fileName: 'database.json', mimetype: 'application/json' });
                    break;
            }
        } catch (e) { console.error(e); }
    });
}
startHisoka();
