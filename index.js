require("dotenv").config();
const { 
    default: goutamConnect, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore, 
    delay,
    DisconnectReason, 
    fetchLatestBaileysVersion,
    downloadContentFromMessage
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require('path');
const chalk = require("chalk");
const pino = require("pino");
const express = require('express');
const moment = require("moment-timezone");
const axios = require("axios");

const app = express();
const port = process.env.PORT || 8080;
const sessionPath = path.join(__dirname, 'session');
const dbPath = path.join(__dirname, 'database.json');

if (!fs.existsSync(sessionPath)) { fs.mkdirSync(sessionPath, { recursive: true }); }

// 💾 PERSISTENT DATABASE
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({
        antilink: false, antibot: false, antiwame: false, antitagall: false,
        antibadword: false, antibadwordnokick: false, antispam: false, 
        antiban: true, antifake: false, antidelete: false
    }));
}
global.db = JSON.parse(fs.readFileSync(dbPath));
const saveDB = () => fs.writeFileSync(dbPath, JSON.stringify(global.db, null, 2));

// 🔒 HARDCODED CONFIG
const PAIRING_NUMBER = "212701458617"; 
global.owner = ["212701458617", "85182757527702"]; 
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

const badWords = ["fuck you", "djol santi", "pussy", "bouda santi", "bitch", "masisi", "bouzen", "langet manman w", "santi kk", "gyet manman w", "pouri", "bouda fon", "trip pouri", "koko santi", "kalanbe"];
global.warns = {}; 
let kickAllConfirm = {}; 

app.get('/', (req, res) => res.status(200).send('GSS-BETA Online'));
app.listen(port, "0.0.0.0");

async function startHisoka() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    
    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        version,
        markOnlineOnConnect: true
    });

    // 📲 PAIRING LOGIC (Hardcoded to your number)
    if (!client.authState.creds.registered) {
        await delay(3000); 
        try {
            let code = await client.requestPairingCode(PAIRING_NUMBER);
            console.log(chalk.white.bgRed.bold(`\n 📲 PAIRING CODE FOR ${PAIRING_NUMBER}: ${code} \n`));
        } catch (err) { console.log("Pairing error."); }
    }

    client.ev.on("creds.update", saveCreds);

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;

            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const sender = mek.key.participant || from;
            const senderNumber = sender.replace(/[^0-9]/g, '');
            const isOwner = global.owner.includes(senderNumber);

            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || mek.message.imageMessage?.caption || "").trim();
            const lowerBody = body.toLowerCase();
            const reply = (text) => client.sendMessage(from, { text }, { quoted: mek });

            const groupMetadata = isGroup ? await client.groupMetadata(from) : null;
            const groupAdmins = isGroup ? groupMetadata.participants.filter(v => v.admin !== null).map(v => v.id) : [];
            const isBotAdmin = groupAdmins.includes(client.user.id.split(':')[0] + '@s.whatsapp.net');
            const isSenderAdmin = groupAdmins.includes(sender);

            // 🛡️ SECURITY EXECUTOR (OWNER/ADMINS IMMUNE)
            if (isGroup && isBotAdmin) {
                if (isOwner || isSenderAdmin) { 
                    /* Immune */ 
                } else {
                    if (global.db.antilink && (lowerBody.includes("http://") || lowerBody.includes("chat.whatsapp.com"))) {
                        await client.sendMessage(from, { delete: mek.key });
                        return await client.groupParticipantsUpdate(from, [sender], "remove");
                    }
                    if (global.db.antibadword && badWords.some(w => lowerBody.includes(w))) {
                        await client.sendMessage(from, { delete: mek.key });
                        return await client.groupParticipantsUpdate(from, [sender], "remove");
                    }
                }
            }

            // ⌨️ COMMANDS
            if (!body.startsWith(".")) return;
            const args = body.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const q = args.join(" ");
            const mentioned = mek.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const quotedMsg = mek.message.extendedTextMessage?.contextInfo?.quotedMessage;
            let target = mentioned[0] || (quotedMsg ? mek.message.extendedTextMessage.contextInfo.participant : null);

            const readMore = String.fromCharCode(8206).repeat(4001);

            switch (command) {
                case 'menu':
                    let menuMsg = `╭───『 *${botName}* 』───
│ Hi 👋 ${mek.pushName || 'User'}
│ ✨ *${ownerName}*
│ Prefix : .
│ Uptime : ${process.uptime().toFixed(0)}s
╰───────────────────
${readMore}
├─『 *Admin & Group* 』
│ .add [tag/number]
│ .kick [tag/reply]
│ .tagall | .hidetag
│ .kickall | .mute | .unmute
│ .promote | .demote
│ .groupinfo | .time
│
├─『 *Security/Auto* 』
│ .antilink | .antibot | .antiwame
│ .antitagall | .antispam | .antifake
│ .antibadword | .antidelete | .status
│
├─『 *Utility & Fun* 』
│ .ping | .ai | .vv | .owner | .steal
│ .warn | .unwarn | .blacklist | .settings | .backup
╰───────────────────`;
                    await client.sendMessage(from, { 
                        video: { url: 'https://media.giphy.com/media/Uau9JUChC8FdZnmVmX/giphy.mp4' }, 
                        caption: menuMsg, 
                        gifPlayback: true 
                    });
                    break;

                case 'kickall':
                    if (!isOwner) return reply("Owner Only.");
                    kickAllConfirm[from] = true;
                    reply("⚠️ Type *.confirm* to wipe the group.");
                    setTimeout(() => { delete kickAllConfirm[from]; }, 30000);
                    break;

                case 'confirm':
                    if (!isOwner || !kickAllConfirm[from]) return;
                    for (let mem of groupMetadata.participants) {
                        if (!global.owner.includes(mem.id.split('@')[0]) && mem.id !== client.user.id.split(':')[0] + '@s.whatsapp.net') {
                            await client.groupParticipantsUpdate(from, [mem.id], "remove");
                            await delay(500);
                        }
                    }
                    delete kickAllConfirm[from];
                    reply("✅ Group Cleared.");
                    break;

                case 'kick': case 'add': case 'promote': case 'demote':
                    if (!isOwner) return reply("Owner Only.");
                    if (!isBotAdmin) return reply("Bot is not Admin.");
                    let user = command === 'add' ? q.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : target;
                    let action = command === 'kick' ? 'remove' : (command === 'add' ? 'add' : command);
                    await client.groupParticipantsUpdate(from, [user], action);
                    reply("✅ Done.");
                    break;

                case 'backup':
                    if (!isOwner) return;
                    await client.sendMessage(sender, { document: fs.readFileSync(dbPath), fileName: 'database.json', mimetype: 'application/json' });
                    reply("📂 Database sent to your private chat.");
                    break;

                case 'status':
                    let s = `⚙️ *SETTINGS*\n\n`;
                    for (let key in global.db) { s += `${global.db[key] ? '✅' : '❌'} ${key.toUpperCase()}\n`; }
                    reply(s);
                    break;

                case 'ping':
                    reply(`⚡ Speed: ${Date.now() - mek.messageTimestamp * 1000}ms`);
                    break;
            }
        } catch (e) { console.log(e); }
    });

    client.ev.on("connection.update", (up) => {
        if (up.connection === "open") console.log(chalk.green("✅ DEPLOYED"));
        if (up.connection === "close") startHisoka();
    });
}
startHisoka();
