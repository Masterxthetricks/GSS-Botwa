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

app.get('/', (req, res) => res.status(200).send('GSS-BETA Online'));
app.listen(port, "0.0.0.0");

async function startHisoka() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    
    // 🛠️ OPTIMIZED CONNECTION SETTINGS
    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        version,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000, // Wait 60s for connection
        defaultQueryTimeoutMs: 0, // Disable timeout for queries to prevent 408
        keepAliveIntervalMs: 10000
    });

    // 📲 SMART PAIRING LOGIC WITH RETRY
    if (!client.authState.creds.registered) {
        await delay(3000); 
        const phoneNumber = PAIRING_NUMBER.replace(/[^0-9]/g, '');
        
        try {
            let code = await client.requestPairingCode(phoneNumber);
            console.log(chalk.white.bgRed.bold(`\n 📲 NEW PAIRING CODE FOR ${phoneNumber}: ${code} \n`));
        } catch (err) {
            console.log(chalk.red.bold("❌ Pairing Request Failed. Retrying..."));
            await delay(10000);
            let code = await client.requestPairingCode(phoneNumber);
            console.log(chalk.white.bgRed.bold(`\n 📲 RETRY PAIRING CODE: ${code} \n`));
        }
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
            const isGroup = from.endsWith('@g.us');
            const sender = mek.key.participant || from;
            const senderNumber = sender.replace(/[^0-9]/g, '');
            const isOwner = global.owner.includes(senderNumber);
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || mek.message.imageMessage?.caption || "").trim();
            const lowerBody = body.toLowerCase();
            const reply = (text) => client.sendMessage(from, { text }, { quoted: mek });

            // Logger Function
            const logCmd = (cmd, success, err = "") => {
                const time = moment().format('HH:mm:ss');
                if (success) console.log(chalk.black.bgGreen(`[${time}]`) + chalk.green(` .${cmd} executed successfully`));
                else console.log(chalk.black.bgRed(`[${time}]`) + chalk.red(` .${cmd} failed: ${err}`));
            };

            const groupMetadata = isGroup ? await client.groupMetadata(from) : null;
            const groupAdmins = isGroup ? groupMetadata.participants.filter(v => v.admin !== null).map(v => v.id) : [];
            const isBotAdmin = isGroup ? groupAdmins.includes(client.user.id.split(':')[0] + '@s.whatsapp.net') : false;

            // Anti-Badword Logic
            if (isGroup && global.db.antibadword && !isOwner) {
                if (badWords.some(word => lowerBody.includes(word))) {
                    await client.sendMessage(from, { delete: mek.key });
                    if (!global.db.antibadwordnokick && isBotAdmin) {
                        await client.groupParticipantsUpdate(from, [sender], "remove");
                    }
                    return;
                }
            }

            if (!body.startsWith(".")) return;
            const args = body.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const q = args.join(" ");
            const mentioned = mek.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const quotedMsg = mek.message.extendedTextMessage?.contextInfo?.quotedMessage;

            let target = mentioned[0] || mek.message.extendedTextMessage?.contextInfo?.participant;
            if (!target && q) {
                let cleanNum = q.replace(/[^0-9]/g, '');
                if (cleanNum.length > 8) target = cleanNum + "@s.whatsapp.net";
            }

            const readMore = String.fromCharCode(8206).repeat(4001);

            switch (command) {
                case 'menu':
                case 'help':
                    const uptime = process.uptime();
                    const h = Math.floor(uptime / 3600);
                    const m = Math.floor((uptime % 3600) / 60);
                    const timeNow = moment.tz('America/Port-au-Prince').format('HH:mm:ss');
                    const dateNow = moment.tz('America/Port-au-Prince').format('DD/MM/YYYY');
                    
                    let menuMsg = `╭───『 *${botName}* 』───
│ Hi 👋 ${mek.pushName || 'User'}
│ ✨ *${ownerName}*
│ Prefix : .
│ Uptime : ${h}h ${m}m
│ Time : ${timeNow} | Date : ${dateNow}
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
│ .warn | .unwarn | .blacklist | .settings
╰───────────────────`;
                    await client.sendMessage(from, { 
                        video: { url: 'https://media.tenor.com/7bA_B60h2fAAAAAC/ayanokouji-kiyotaka-classroom-of-the-elite.gif' }, 
                        caption: menuMsg, gifPlayback: true, mentions: [sender] 
                    }, { quoted: mek });
                    logCmd(command, true);
                    break;

                case 'status':
                    if (!isOwner) return logCmd(command, false, "Unauthorized");
                    let st = `*BOT SETTINGS*\n\n`;
                    for (let key in global.db) { st += `• ${key.toUpperCase()}: ${global.db[key] ? '✅' : '❌'}\n`; }
                    reply(st);
                    logCmd(command, true);
                    break;

                case 'add':
                    if (!isOwner || !isGroup) return logCmd(command, false, "Auth/Group");
                    if (!isBotAdmin) return reply("I am not admin.");
                    await client.groupParticipantsUpdate(from, [target], "add")
                        .then(() => { reply("✅ Added"); logCmd(command, true); })
                        .catch((e) => logCmd(command, false, e));
                    break;

                case 'kick':
                    if (!isOwner || !isGroup || !isBotAdmin) return logCmd(command, false, "Auth/Admin");
                    await client.groupParticipantsUpdate(from, [target], "remove");
                    reply("✅ Kicked");
                    logCmd(command, true);
                    break;

                case 'tagall':
                    if (!isOwner || !isGroup) return;
                    let teks = `*📢 TAG ALL*\n\n`;
                    let ms = groupMetadata.participants.map(mem => {
                        teks += `🔘 @${mem.id.split('@')[0]}\n`;
                        return mem.id;
                    });
                    client.sendMessage(from, { text: teks, mentions: ms });
                    logCmd(command, true);
                    break;

                case 'hidetag':
                    if (!isOwner || !isGroup) return;
                    client.sendMessage(from, { text: q, mentions: groupMetadata.participants.map(a => a.id) });
                    logCmd(command, true);
                    break;

                case 'mute': case 'unmute':
                    if (!isOwner || !isBotAdmin) return;
                    await client.groupSettingUpdate(from, command === 'mute' ? 'announcement' : 'not_announcement');
                    reply(`✅ Group ${command}d`);
                    logCmd(command, true);
                    break;

                case 'promote': case 'demote':
                    if (!isOwner || !isBotAdmin) return;
                    await client.groupParticipantsUpdate(from, [target], command);
                    reply(`✅ Success ${command}`);
                    break;

                case 'groupinfo':
                    if (!isGroup) return;
                    reply(`*Group:* ${groupMetadata.subject}\n*Members:* ${groupMetadata.participants.length}\n*Admins:* ${groupAdmins.length}`);
                    break;

                case 'time':
                    reply(`🕒 Time: ${moment.tz('America/Port-au-Prince').format('HH:mm:ss')}`);
                    break;

                case 'ping':
                    reply(`⚡ Pong! ${Date.now() - mek.messageTimestamp * 1000}ms`);
                    break;

                case 'ai':
                    if (!q) return reply("Need query.");
                    try {
                        const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                        reply(res.data.success);
                        logCmd(command, true);
                    } catch { logCmd(command, false, "API Error"); }
                    break;

                case 'steal':
                    if (!quotedMsg?.stickerMessage) return reply("Reply to a sticker.");
                    const buff = await downloadContentFromMessage(quotedMsg.stickerMessage, 'sticker');
                    let buffer = Buffer.from([]);
                    for await(const chunk of buff) { buffer = Buffer.concat([buffer, chunk]); }
                    await client.sendMessage(from, { sticker: buffer }, { quoted: mek });
                    logCmd(command, true);
                    break;

                case 'vv':
                    if (!quotedMsg?.viewOnceMessageV2) return reply("Not a view-once.");
                    const type = Object.keys(quotedMsg.viewOnceMessageV2.message)[0];
                    const stream = await downloadContentFromMessage(quotedMsg.viewOnceMessageV2.message[type], type.split('Message')[0]);
                    let vBuff = Buffer.from([]);
                    for await(const chunk of stream) { vBuff = Buffer.concat([vBuff, chunk]); }
                    client.sendMessage(from, { [type.split('Message')[0]]: vBuff, caption: 'Done' }, { quoted: mek });
                    break;

                case 'antilink': case 'antibot': case 'antiwame': case 'antibadword': case 'antidelete':
                    if (!isOwner) return;
                    global.db[command] = !global.db[command];
                    reply(`🛡️ ${command.toUpperCase()} set to ${global.db[command]}`);
                    logCmd(command, true);
                    break;

                case 'owner':
                    reply(`Owner: wa.me/${global.owner[0]}`);
                    break;
            }
        } catch (e) { console.log(e); }
    });
}
startHisoka();
