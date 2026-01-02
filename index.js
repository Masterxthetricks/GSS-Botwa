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
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        printQRInTerminal: false,
    });

    if (!client.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await client.requestPairingCode(PAIRING_NUMBER);
                console.log(chalk.black.bgGreen.bold(`\n 📲 PAIRING CODE: ${code} \n`));
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

            // 🛡️ ANTIBAN DELAY
            if (global.db.antiban && !isOwner) { await delay(500); }

            // 🛡️ ENHANCED SECURITY AUTO-LOGIC (KICKS)
            if (isGroup && isBotAdmin) {
                if (global.db.antilink && lowerBody.includes("chat.whatsapp.com") && !isSenderAdmin && !isOwner) {
                    await client.sendMessage(from, { delete: mek.key });
                    return await client.groupParticipantsUpdate(from, [sender], "remove");
                }
                if (global.db.antibot && (sender.includes('bot') || mek.key.id.startsWith('BAE5')) && !isOwner) {
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
                // ────『 Admin & Group 』────
                case 'menu':
                    let menuMsg = `╭───『 *${botName}* 』───
│ Hi 👋 ${mek.pushName || 'User'}
│ ✨ *${ownerName}*
│ Prefix : .
│ Uptime : ${process.uptime().toFixed(0)}s
╰───────────────────${readMore}
├─『 *Admin & Group* 』
│ .add [tag/number]
│ .kick [tag/reply]
│ .tagall | .hidetag
│ .kickall | .mute | .unmute
│ .promote | .demote
│
├─『 *Security/Auto* 』
│ .antilink | .antibot | .antifake
│ .antibadword | .antiban | .status
│ .blockcountry | .addanime | .automute
│ .whitelist [tag/reply]
│
├──『 *Utility & Fun* 』
│ .ping | .ai | .owner | .backup`;
                    await client.sendMessage(from, { video: { url: "https://media.giphy.com/media/Uau9JUChC8FdZnmVmX/giphy.gif" }, caption: menuMsg, gifPlayback: true }, { quoted: mek });
                    break;

                case 'add':
                case 'promote':
                case 'demote':
                    if (!isGroup || !isBotAdmin || (!isOwner && !isSenderAdmin)) return reply("❌ Unauthorized.");
                    let userAction = command === 'add' ? q.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : target;
                    await client.groupParticipantsUpdate(from, [userAction], command === 'add' ? 'add' : command);
                    reply(`✅ Done.`);
                    break;

                case 'kick':
                    if (!isGroup || !isBotAdmin || (!isOwner && !isSenderAdmin)) return reply("❌ Unauthorized.");
                    if (!target) return reply("❓ Tag/Reply to someone.");
                    await client.groupParticipantsUpdate(from, [target], "remove");
                    break;

                case 'tagall':
                case 'hidetag':
                    if (!isGroup || (!isOwner && !isSenderAdmin)) return reply("❌ Admin only.");
                    client.sendMessage(from, { text: q || "📢 Attention!", mentions: groupMetadata.participants.map(v => v.id) });
                    break;

                case 'kickall':
                    if (!isOwner) return reply("❌ Owner only.");
                    if (!kickAllConfirm[from]) {
                        kickAllConfirm[from] = true;
                        reply("⚠️ Confirm in 10s by typing .kickall again.");
                        setTimeout(() => delete kickAllConfirm[from], 10000);
                    } else {
                        const all = groupMetadata.participants.filter(v => !global.owner.includes(v.id.split('@')[0]) && v.id !== botNumber);
                        for (let mem of all) { await client.groupParticipantsUpdate(from, [mem.id], "remove"); await delay(700); }
                        delete kickAllConfirm[from];
                        reply("✅ Group Cleared.");
                    }
                    break;

                case 'mute':
                case 'unmute':
                    if (!isGroup || !isBotAdmin || (!isOwner && !isSenderAdmin)) return reply("❌ Unauthorized.");
                    await client.groupUpdateSubject(from, command === 'mute' ? 'announcement' : 'not_announcement');
                    reply(`✅ Group ${command}d.`);
                    break;

                // ────『 Security/Auto 』────
                case 'antilink':
                case 'antibot':
                case 'antifake':
                case 'antibadword':
                case 'antiban':
                case 'automute':
                    if (!isOwner) return reply("❌ Owner only.");
                    global.db[command] = !global.db[command];
                    saveDB();
                    reply(`🛡️ ${command.toUpperCase()} is now ${global.db[command] ? "ON" : "OFF"}`);
                    break;

                case 'status':
                    let s = `⚙️ *SYSTEM STATUS*\n\n`;
                    for (let key in global.db) { if (typeof global.db[key] === 'boolean') s += `${global.db[key] ? '✅' : '❌'} ${key.toUpperCase()}\n`; }
                    reply(s);
                    break;

                case 'blockcountry':
                    if (!isOwner) return reply("❌ Owner only.");
                    global.db.blockedCountries.push(q);
                    saveDB();
                    reply(`✅ Added +${q} to blocklist.`);
                    break;

                case 'addanime':
                    if (!isOwner) return reply("❌ Owner only.");
                    global.db.animeBlacklist.push(q.toLowerCase());
                    saveDB();
                    reply(`✅ Added ${q} to anime filter.`);
                    break;

                case 'whitelist':
                    if (!isOwner) return reply("❌ Owner only.");
                    if (!target) return reply("❓ Tag/Reply to user.");
                    global.db.whitelist.push(target.replace(/[^0-9]/g, ''));
                    saveDB();
                    reply("✅ User whitelisted.");
                    break;

                // ────『 Utility & Fun 』────
                case 'ping':
                    reply(`⚡ Speed: ${Date.now() - mek.messageTimestamp * 1000}ms`);
                    break;

                case 'ai':
                    const aiRes = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                    reply(`🤖 ${aiRes.data.success}`);
                    break;

                case 'owner':
                    client.sendMessage(from, { contact: { displayName: ownerName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${ownerName}\nTEL;waid=${global.owner[0]}:${global.owner[0]}\nEND:VCARD` } });
                    break;

                case 'backup':
                    if (!isOwner) return;
                    await client.sendMessage(from, { document: fs.readFileSync(dbPath), fileName: 'database.json', mimetype: 'application/json' });
                    break;
            }
        } catch (e) { console.error(e); }
    });
}
startHisoka();
