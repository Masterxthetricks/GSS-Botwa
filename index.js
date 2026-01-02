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

// 💾 PERSISTENT DATABASE INITIALIZATION
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
const badWords = ["fuck you", "bitch", "pussy", "bouzen", "masisi"];

app.get('/', (req, res) => res.status(200).send('GSS-BETA Online'));
app.listen(port, "0.0.0.0");

async function startHisoka() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    
    const client = goutamConnect({
        version,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        printQRInTerminal: false,
    });

    // 📲 FIXED PAIRING LOGIC
    if (!client.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await client.requestPairingCode(PAIRING_NUMBER.replace(/[^0-9]/g, ''));
                console.log(chalk.black.bgGreen.bold(`\n 📲 PAIRING CODE FOR ${PAIRING_NUMBER}: ${code} \n`));
            } catch (e) { console.log("Pairing Error", e); }
        }, 10000);
    }

    client.ev.on("creds.update", saveCreds);

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.remoteJid === 'status@broadcast') return;
            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const sender = mek.key.participant || from;
            const senderNumber = sender.replace(/[^0-9]/g, '');
            const isOwner = global.owner.includes(senderNumber) || global.db.whitelist.includes(senderNumber);
            const botNumber = client.user.id.split(':')[0] + '@s.whatsapp.net';

            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || mek.message.imageMessage?.caption || "").trim();
            const lowerBody = body.toLowerCase();
            const reply = (text) => client.sendMessage(from, { text }, { quoted: mek });

            const groupMetadata = isGroup ? await client.groupMetadata(from) : null;
            const groupAdmins = isGroup ? groupMetadata.participants.filter(v => v.admin !== null).map(v => v.id) : [];
            const isBotAdmin = groupAdmins.includes(botNumber);
            const isSenderAdmin = groupAdmins.includes(sender);

            // 🛡️ ANTIBAN & SECURITY FILTERS
            if (global.db.antiban && !isOwner) { await delay(500); }
            if (isGroup && isBotAdmin) {
                if (global.db.antilink && lowerBody.includes("chat.whatsapp.com") && !isSenderAdmin && !isOwner) {
                    await client.sendMessage(from, { delete: mek.key });
                    return await client.groupParticipantsUpdate(from, [sender], "remove");
                }
                if (global.db.antibot && mek.key.id.startsWith('BAE5') && !isOwner) {
                    return await client.groupParticipantsUpdate(from, [sender], "remove");
                }
            }

            if (!body.startsWith(".")) return;
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
│ Prefix : .
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
                        caption: menuMsg, gifPlayback: true 
                    }, { quoted: mek });
                    break;

                // --- ADMIN COMMANDS ---
                case 'add':
                case 'promote':
                case 'demote':
                    if (!isGroup || !isBotAdmin || (!isOwner && !isSenderAdmin)) return;
                    let u = command === 'add' ? q.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : target;
                    await client.groupParticipantsUpdate(from, [u], command === 'add' ? 'add' : command);
                    break;

                case 'kick':
                    if (!isGroup || !isBotAdmin || (!isOwner && !isSenderAdmin)) return;
                    await client.groupParticipantsUpdate(from, [target], "remove");
                    break;

                case 'mute':
                case 'unmute':
                    if (!isGroup || !isBotAdmin || (!isOwner && !isSenderAdmin)) return;
                    await client.groupUpdateSubject(from, command === 'mute' ? 'announcement' : 'not_announcement');
                    break;

                // --- SECURITY TOGGLES ---
                case 'antiban':
                case 'antilink':
                case 'antibot':
                case 'antifake':
                    if (!isOwner) return;
                    global.db[command] = !global.db[command];
                    saveDB();
                    reply(`🛡️ ${command.toUpperCase()} is ${global.db[command] ? "ON" : "OFF"}`);
                    break;

                case 'status':
                    let stat = `⚙️ *SYSTEM STATUS*\n\nANTIBAN: ${global.db.antiban ? '✅' : '❌'}\nANTILINK: ${global.db.antilink ? '✅' : '❌'}`;
                    reply(stat);
                    break;

                case 'ai':
                    const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                    reply(`🤖 ${res.data.success}`);
                    break;
                
                case 'ping':
                    reply(`⚡ Speed: ${Date.now() - mek.messageTimestamp * 1000}ms`);
                    break;
            }
        } catch (e) { console.error(e); }
    });
}
startHisoka();
