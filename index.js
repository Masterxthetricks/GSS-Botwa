require("dotenv").config();
const { 
    default: goutamConnect, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore, 
    delay, 
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
        antibadword: false, antispam: false, antifake: false, antidelete: false
    }));
}
global.db = JSON.parse(fs.readFileSync(dbPath));
const saveDB = () => fs.writeFileSync(dbPath, JSON.stringify(global.db, null, 2));

// 🔒 CONFIG
const PAIRING_NUMBER = "212701458617"; 
global.owner = ["212701458617", "85182757527702"]; 
global.warns = {}; 
let kickAllConfirm = {};
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";
const badWords = ["fuck you", "djol santi", "pussy", "bouda santi", "bitch", "masisi", "bouzen", "langet manman w", "santi kk", "gyet manman w", "pouri", "bouda fon", "trip pouri", "koko santi", "kalanbe"];

app.get('/', (req, res) => res.status(200).send('GSS-BETA Online'));
app.listen(port, "0.0.0.0");

async function startHisoka() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        }
    });

    client.store = {}; // For Anti-Delete

    // 📲 IMPROVED PAIRING LOGIC (INTEGRATED)
    if (!client.authState.creds.registered) {
        console.log(chalk.yellow("⏳ Waiting 10 seconds for stable connection before requesting code..."));
        await delay(10000); // Increased delay for Koyeb network stability
        
        let retryCount = 0;
        const maxRetries = 5;

        async function getPairingCode() {
            try {
                let code = await client.requestPairingCode(PAIRING_NUMBER);
                console.log(chalk.white.bgRed.bold(`\n 📲 PAIRING CODE: ${code} \n`));
            } catch (err) {
                if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(chalk.red(`❌ Pairing failed (Attempt ${retryCount}/${maxRetries}). Retrying in 5s...`));
                    await delay(5000);
                    return getPairingCode();
                } else {
                    console.log(chalk.bgRed("🚨 Max retries reached. Please restart the Koyeb service."));
                }
            }
        }
        await getPairingCode();
    }

    client.ev.on("creds.update", saveCreds);

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            const from = mek.key.remoteJid;
            client.store[mek.key.id] = mek; 

            if (mek.key.fromMe) return;

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

            // 🛡️ SECURITY
            if (isGroup && isBotAdmin && !isOwner && !isSenderAdmin) {
                if (global.db.antilink && lowerBody.includes("chat.whatsapp.com")) {
                    await client.sendMessage(from, { delete: mek.key });
                    return client.groupParticipantsUpdate(from, [sender], "remove");
                }
            }

            if (!body.startsWith(".")) return;
            const args = body.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const q = args.join(" ");
            const readMore = String.fromCharCode(8206).repeat(4001);
            const quotedMsg = mek.message.extendedTextMessage?.contextInfo?.quotedMessage;
            const mentioned = mek.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            let target = mentioned[0] || (quotedMsg ? mek.message.extendedTextMessage.contextInfo.participant : null);

            console.log(chalk.cyan(`[COMMAND] .${command} | User: ${senderNumber}`));

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
│ .warn | .unwarn | .blacklist | .settings | .backup`;
                    reply(menuMsg);
                    break;

                case 'tagall': case 'hidetag':
                    if (!isGroup || !isSenderAdmin) return reply("❌ Admin only.");
                    client.sendMessage(from, { text: q ? q : '📢 Attention', mentions: groupMetadata.participants.map(v => v.id) });
                    break;

                case 'kick': case 'add': case 'promote': case 'demote':
                    if (!isBotAdmin) return reply("❌ Bot is not Admin.");
                    if (!isSenderAdmin && !isOwner) return reply("❌ Admin only.");
                    let u = command === 'add' ? q.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : target;
                    if (!u) return reply("❓ Reply or Tag user.");
                    await client.groupParticipantsUpdate(from, [u], command === 'kick' ? 'remove' : (command === 'add' ? 'add' : command));
                    reply("✅ Done.");
                    break;

                case 'mute': case 'unmute':
                    if (!isSenderAdmin) return reply("❌ Admin only.");
                    await client.groupUpdateSubject(from, command === 'mute' ? "announcement" : "not_announcement");
                    reply(`✅ Group ${command}d.`);
                    break;

                case 'steal': case 'vv':
                    if (!quotedMsg) return reply("❌ Reply to a View-Once.");
                    const type = Object.keys(quotedMsg)[0];
                    const stream = await downloadContentFromMessage(quotedMsg[type], type.replace('Message', ''));
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                    client.sendMessage(from, { [type.replace('Message', '')]: buffer, caption: "✅ Stolen" }, { quoted: mek });
                    break;

                case 'ai':
                    if (!q) return reply("❓ Ask something.");
                    const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                    reply(`🤖 ${res.data.success}`);
                    break;

                case 'status':
                    let s = `⚙️ *CONFIG*\n`;
                    for (let key in global.db) s += `${global.db[key] ? '✅' : '❌'} ${key.toUpperCase()}\n`;
                    reply(s);
                    break;

                case 'antilink': case 'antidelete': case 'antibot':
                    if (!isOwner) return reply("❌ Owner only.");
                    global.db[command] = !global.db[command];
                    saveDB();
                    reply(`✅ ${command} is ${global.db[command] ? "ON" : "OFF"}`);
                    break;

                case 'ping':
                    reply(`⚡ ${Date.now() - mek.messageTimestamp * 1000}ms`);
                    break;
            }
        } catch (e) { console.log(chalk.red(e)); }
    });

    // 🕵️ ANTI-DELETE HANDLER
    client.ev.on("messages.update", async (chatUpdate) => {
        for (const { key, update } of chatUpdate) {
            if (update.protocolMessage?.type === 3 && global.db.antidelete) {
                const msg = client.store[update.protocolMessage.key.id];
                if (!msg) return;
                const sender = msg.key.participant || msg.key.remoteJid;
                let report = `🕵️ *ANTI-DELETE*\n👤 From: @${sender.split('@')[0]}`;
                await client.sendMessage(client.user.id, { text: report, mentions: [sender] });
                await client.sendMessage(client.user.id, { forward: msg });
            }
        }
    });

    client.ev.on("connection.update", (up) => {
        if (up.connection === "open") console.log(chalk.green("✅ GSS-BETA ONLINE"));
        if (up.connection === "close") startHisoka();
    });
}
startHisoka();
