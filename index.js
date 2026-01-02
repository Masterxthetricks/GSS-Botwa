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

const app = express();
const port = process.env.PORT || 8080;
const sessionPath = path.join(__dirname, 'session');

if (!fs.existsSync(sessionPath)) { fs.mkdirSync(sessionPath, { recursive: true }); }

// 🔒 HARDCODED CONFIG
const PAIRING_NUMBER = "212701458617"; 
global.owner = ["212701458617", "85182757527702"]; 
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

// 🚫 BAD WORDS LIST
const badWords = ["fuck you", "djol santi", "pussy", "bouda santi", "bitch", "masisi", "bouzen", "langet manman w", "santi kk", "gyet manman w", "pouri", "bouda fon", "trip pouri", "koko santi", "kalanbe"];

global.db = {
    antilink: false, antibot: false, antiwame: false, antitagall: false,
    antibadword: false, antibadwordnokick: false, antispam: false, 
    antiban: true, antifake: false, antidelete: false
};

let warnings = {};
let blacklist = [];

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

    // 📲 FORCED PAIRING CODE FOR HARDCODED NUMBER
    if (!client.authState.creds.registered) {
        await delay(5000); 
        let code = await client.requestPairingCode(PAIRING_NUMBER);
        console.log(chalk.white.bgRed.bold(`\n 📲 PAIRING CODE FOR ${PAIRING_NUMBER}: ${code} \n`));
    }

    client.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startHisoka();
        else if (connection === "open") console.log(chalk.green.bold("✅ GSS-BETA CONNECTED"));
    });

    client.ev.on("creds.update", saveCreds);

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;

            const from = mek.key.remoteJid;
            const sender = mek.key.participant || from;
            const senderNumber = sender.replace(/[^0-9]/g, '');
            const isOwner = global.owner.includes(senderNumber);
            const isGroup = from.endsWith('@g.us');
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || mek.message.imageMessage?.caption || "").trim();
            const lowerBody = body.toLowerCase();
            const reply = (text) => client.sendMessage(from, { text }, { quoted: mek });

            // 🛡️ ANTI-BADWORD SYSTEM
            if (isGroup && global.db.antibadword && !isOwner) {
                if (badWords.some(word => lowerBody.includes(word))) {
                    await client.sendMessage(from, { delete: mek.key });
                    if (!global.db.antibadwordnokick) {
                        await client.groupParticipantsUpdate(from, [sender], "remove");
                        reply("🚫 Bad word detected. User removed.");
                    } else {
                        reply("🚫 Watch your language!");
                    }
                }
            }

            if (!body.startsWith(".")) return;
            const args = body.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const q = args.join(" ");
            const mentioned = mek.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

            switch (command) {
                case 'menu':
                case 'help':
                    const uptime = process.uptime();
                    const hours = Math.floor(uptime / 3600);
                    const mins = Math.floor((uptime % 3600) / 60);
                    const time = moment.tz('America/Port-au-Prince').format('HH:mm:ss');
                    const date = moment.tz('America/Port-au-Prince').format('DD/MM/YYYY');
                    let menuMsg = `╭───『 *${botName}* 』───
│ Hi 👋
│ ✨ *${ownerName}*
│
├─『 *Good Morning* 🌇 😊 』
│
├─『 *Bot Info* 』
│ Bot Name : ${botName}
│ Owner Name : ${ownerName}
│ Prefix : .
│ Total Users : 8
│ Uptime : ${hours}h ${mins}m
│ Mode : Public
│
├─『 *User Info* 』
│ Name : ${mek.pushName || 'User'}
│ Number : @${senderNumber}
│ Premium : ${isOwner ? '✅' : '❌'}
│
├─『 *Time Info* 』
│ Time : ${time}
│ Date : ${date}
│
├─『 *Commands* 』
│ .ping | .ai | .vv | .owner | .steal
│ .tagall | .hidetag | .kick
│ .promote | .demote | .add
│ .mute | .unmute | .kickall
│ .settings | .antidelete
│ .antilink | .antibot | .antiwame
│ .antitagall | .antispam | .antifake
│ .antibadword | .antibadwordnokick
│ .warn | .unwarn | .blacklist
╰───────────────────
> 💡 Please Type .help for info`;
                    await client.sendMessage(from, { 
                        video: { url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3NueXF4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/vA07zct9tyTLO/giphy.gif' }, 
                        caption: menuMsg, gifPlayback: true, mentions: [sender]
                    }, { quoted: mek });
                    break;

                case 'ping': reply(`⚡ Pong! ${Date.now() - mek.messageTimestamp * 1000}ms`); break;
                case 'owner': reply(`Owner: wa.me/${global.owner[0]}`); break;
                case 'steal':
                    const quoted = mek.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (!quoted?.stickerMessage) return reply("Reply to a sticker.");
                    const stream = await downloadContentFromMessage(quoted.stickerMessage, 'sticker');
                    let buffer = Buffer.from([]);
                    for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                    await client.sendMessage(from, { sticker: buffer }, { quoted: mek });
                    break;

                case 'tagall':
                    if (!isGroup || !isOwner) return;
                    const meta = await client.groupMetadata(from);
                    const users = meta.participants.map(u => u.id);
                    client.sendMessage(from, { text: q ? q : "@everyone", mentions: users }, { quoted: mek });
                    break;

                case 'kick': if (isOwner && isGroup) await client.groupParticipantsUpdate(from, mentioned, "remove"); break;
                case 'add': if (isOwner && isGroup) await client.groupParticipantsUpdate(from, [q + "@s.whatsapp.net"], "add"); break;
                case 'promote': case 'demote': if (isOwner && isGroup) await client.groupParticipantsUpdate(from, mentioned, command); break;
                case 'mute': case 'unmute': if (isOwner && isGroup) await client.groupSettingUpdate(from, command === 'mute' ? 'announcement' : 'not_announcement'); break;
                
                case 'antilink': case 'antibot': case 'antibadword': case 'antibadwordnokick':
                    if (!isOwner) return;
                    global.db[command] = q === 'on';
                    reply(`🛡️ ${command.toUpperCase()} set to ${q.toUpperCase()}`);
                    break;

                case 'kickall':
                    if (!isOwner || q !== 'confirm') return reply("Type .kickall confirm");
                    const fullMeta = await client.groupMetadata(from);
                    for (let mem of fullMeta.participants) { if (!mem.admin && !global.owner.includes(mem.id.split('@')[0])) await client.groupParticipantsUpdate(from, [mem.id], "remove"); }
                    break;
            }
        } catch (e) { console.log(e); }
    });
}
startHisoka();
