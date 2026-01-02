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
        antibadword: false, antispam: false, antifake: false, antidelete: false,
        autotyping: false, autorecord: false, autoread: false,
        onlygroup: false, onlypc: false, welcome: false, goodbye: false,
        blacklist: []
    }, null, 2));
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
    const { version } = await fetchLatestBaileysVersion();
    
    const client = goutamConnect({
        version,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "110.0.5481.178"], 
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        printQRInTerminal: false,
        connectTimeoutMs: 120000,
        keepAliveIntervalMs: 20000,
    });

    client.store = {}; 

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log(chalk.green.bold("\n✅ GSS-BETA SYSTEM ONLINE\n"));
            if (!client.authState.creds.registered) {
                console.log(chalk.yellow(`📡 Requesting Pairing Code for: ${PAIRING_NUMBER}`));
                try {
                    await delay(15000); 
                    let code = await client.requestPairingCode(PAIRING_NUMBER);
                    if (code) console.log(chalk.white.bgRed.bold(`\n 📲 PAIRING CODE: ${code} \n`));
                } catch (err) { console.log(chalk.red("❌ Pairing failed.")); }
            }
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                startHisoka();
            }
        }
    });

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

            // 🛡️ SECURITY AUTO-LOGIC
            if (isGroup && isBotAdmin && !isOwner && !isSenderAdmin) {
                // Anti-Link
                if (global.db.antilink && lowerBody.includes("chat.whatsapp.com")) {
                    await client.sendMessage(from, { delete: mek.key });
                    return client.groupParticipantsUpdate(from, [sender], "remove");
                }
                // Anti-Badword
                if (global.db.antibadword && badWords.some(word => lowerBody.includes(word))) {
                    await client.sendMessage(from, { delete: mek.key });
                    reply("🚫 Bad word detected. Warned.");
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
├──『 *Utility & Fun* 』
│ .ping | .ai | .vv | .owner | .steal
│ .warn | .unwarn | .blacklist | .settings | .backup`;
                    reply(menuMsg);
                    break;

                // --- ADMIN & GROUP COMMANDS ---
                case 'add':
                    if (!isGroup || !isBotAdmin || !isSenderAdmin) return reply("❌ Error: Admin only.");
                    let users = q.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                    await client.groupParticipantsUpdate(from, [users], "add");
                    reply("✅ User Added.");
                    break;

                case 'kick':
                    if (!isGroup || !isBotAdmin || !isSenderAdmin) return reply("❌ Error: Admin only.");
                    if (!target) return reply("❓ Tag or reply to user.");
                    await client.groupParticipantsUpdate(from, [target], "remove");
                    reply("✅ User Removed.");
                    break;

                case 'tagall': case 'hidetag':
                    if (!isGroup || !isSenderAdmin) return reply("❌ Admin only.");
                    client.sendMessage(from, { text: q ? q : '📢 Attention Everyone', mentions: groupMetadata.participants.map(v => v.id) });
                    break;

                case 'kickall':
                    if (!isGroup || !isOwner) return reply("❌ Owner only.");
                    if (!kickAllConfirm[from]) {
                        kickAllConfirm[from] = true;
                        reply("⚠️ Safety: Type `.kickall` again within 10s to confirm wiping this group.");
                        setTimeout(() => delete kickAllConfirm[from], 10000);
                    } else {
                        const all = groupMetadata.participants.filter(v => !global.owner.includes(v.id.split('@')[0]));
                        for (let mem of all) { await client.groupParticipantsUpdate(from, [mem.id], "remove"); await delay(500); }
                        delete kickAllConfirm[from];
                    }
                    break;

                case 'mute': case 'unmute':
                    if (!isGroup || !isBotAdmin || !isSenderAdmin) return reply("❌ Admin only.");
                    await client.groupUpdateSubject(from, command === 'mute' ? "announcement" : "not_announcement");
                    reply(`✅ Group ${command}d.`);
                    break;

                case 'promote': case 'demote':
                    if (!isGroup || !isBotAdmin || !isSenderAdmin) return reply("❌ Admin only.");
                    if (!target) return reply("❓ Tag/Reply to user.");
                    await client.groupParticipantsUpdate(from, [target], command);
                    reply("✅ Done.");
                    break;

                case 'groupinfo':
                    if (!isGroup) return;
                    reply(`*Group:* ${groupMetadata.subject}\n*Members:* ${groupMetadata.participants.length}\n*Admins:* ${groupAdmins.length}`);
                    break;

                case 'time':
                    reply(`🕒 Current Time: ${new Date().toLocaleString()}`);
                    break;

                // --- SECURITY & TOGGLES ---
                case 'antilink': case 'antibot': case 'antiwame': case 'antitagall':
                case 'antispam': case 'antifake': case 'antibadword': case 'antidelete':
                    if (!isOwner) return reply("❌ Owner only.");
                    global.db[command] = !global.db[command];
                    saveDB();
                    reply(`✅ ${command.toUpperCase()} is now ${global.db[command] ? "ON" : "OFF"}`);
                    break;

                case 'status':
                    let stats = `⚙️ *SYSTEM STATUS*\n\n`;
                    for (let key in global.db) {
                        if (typeof global.db[key] === 'boolean') stats += `${global.db[key] ? '✅' : '❌'} ${key.toUpperCase()}\n`;
                    }
                    reply(stats);
                    break;

                // --- UTILITY & FUN ---
                case 'ping':
                    reply(`⚡ Speed: ${Date.now() - mek.messageTimestamp * 1000}ms`);
                    break;

                case 'ai':
                    if (!q) return reply("❓ Say something.");
                    const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                    reply(`🤖 ${res.data.success || "AI Error"}`);
                    break;

                case 'vv': case 'steal':
                    if (!quotedMsg) return reply("❌ Reply to a View-Once.");
                    const type = Object.keys(quotedMsg)[0];
                    const stream = await downloadContentFromMessage(quotedMsg[type], type.replace('Message', ''));
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                    client.sendMessage(from, { [type.replace('Message', '')]: buffer, caption: "✅ Stolen" }, { quoted: mek });
                    break;

                case 'owner':
                    client.sendMessage(from, { contact: { displayName: ownerName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${ownerName}\nTEL;waid=${global.owner[0]}:${global.owner[0]}\nEND:VCARD` } });
                    break;

                case 'warn':
                    if (!isSenderAdmin) return reply("❌ Admin only.");
                    if (!target) return reply("❓ Tag/Reply.");
                    global.warns[target] = (global.warns[target] || 0) + 1;
                    reply(`⚠️ Warning added [${global.warns[target]}/3]`);
                    if (global.warns[target] >= 3) {
                        await client.groupParticipantsUpdate(from, [target], "remove");
                        delete global.warns[target];
                    }
                    break;

                case 'unwarn':
                    if (!isSenderAdmin) return reply("❌ Admin only.");
                    delete global.warns[target];
                    reply("✅ Warnings reset.");
                    break;

                case 'blacklist':
                    if (!isOwner) return reply("❌ Owner only.");
                    if (!target) return reply("❓ Tag/Reply.");
                    global.db.blacklist.push(target);
                    saveDB();
                    reply("✅ User Blacklisted.");
                    break;

                case 'settings':
                    reply(`To toggle settings, use .antilink, .antibot, etc. View current with .status`);
                    break;

                case 'backup':
                    if (!isOwner) return;
                    await client.sendMessage(from, { document: fs.readFileSync(dbPath), fileName: 'database.json', mimetype: 'application/json' });
                    break;
            }
        } catch (e) { console.log(e); }
    });
}
startHisoka();
