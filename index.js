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
global.warns = {}; 

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
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000
    });

    // 📲 PAIRING CODE LOGIC (Locked to PAIRING_NUMBER)
    if (!client.authState.creds.registered) {
        await delay(3000); 
        const phoneNumber = PAIRING_NUMBER.replace(/[^0-9]/g, '');
        try {
            let code = await client.requestPairingCode(phoneNumber);
            console.log(chalk.white.bgRed.bold(`\n 📲 PAIRING CODE FOR ${phoneNumber}: ${code} \n`));
        } catch (err) { console.log("Pairing error: Check internet connection."); }
    }

    // 🛡️ REFINED ANTI-FAKE/BOT PROTECTION
    client.ev.on("group-participants.update", async (anu) => {
        if (!global.db.antifake || anu.action !== 'add') return;
        for (let num of anu.participants) {
            const userId = num.split('@')[0];
            
            // Logic: Kick USA/UK virtuals (+1/+44) OR IDs with bot keywords OR IDs longer than standard phones
            const isVirtual = userId.startsWith("1") || userId.startsWith("44");
            const isBotId = userId.length > 15 || /bot/i.test(userId);

            if ((isVirtual || isBotId) && !global.owner.includes(userId)) {
                try {
                    await client.groupParticipantsUpdate(anu.id, [num], "remove");
                    client.sendMessage(anu.id, { text: `🛡️ *Virtual/Bot Detected*: @${userId} removed.`, mentions: [num] });
                } catch (e) { console.log("Security Kick Failed."); }
            }
        }
    });

    client.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startHisoka();
        } else if (connection === "open") {
            console.log(chalk.green.bold("✅ GSS-BETA CONNECTED"));
        }
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

            const groupMetadata = isGroup ? await client.groupMetadata(from) : null;
            const groupAdmins = isGroup ? groupMetadata.participants.filter(v => v.admin !== null).map(v => v.id) : [];
            const isBotAdmin = isGroup ? groupAdmins.includes(client.user.id.split(':')[0] + '@s.whatsapp.net') : false;

            // 🛡️ AUTO-SECURITY CHECK
            if (isGroup && isBotAdmin && !isOwner) {
                if (global.db.antilink && (lowerBody.includes("http://") || lowerBody.includes("chat.whatsapp.com"))) {
                    await client.sendMessage(from, { delete: mek.key });
                    return await client.groupParticipantsUpdate(from, [sender], "remove");
                }
                if (global.db.antibadword && badWords.some(word => lowerBody.includes(word))) {
                    await client.sendMessage(from, { delete: mek.key });
                    if (!global.db.antibadwordnokick) await client.groupParticipantsUpdate(from, [sender], "remove");
                    return;
                }
            }

            if (!body.startsWith(".")) return;
            const args = body.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const q = args.join(" ");
            const mentioned = mek.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const quotedMsg = mek.message.extendedTextMessage?.contextInfo?.quotedMessage;

            let target = mentioned[0] || (quotedMsg ? mek.message.extendedTextMessage.contextInfo.participant : null);
            if (!target && q) target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";

            const readMore = String.fromCharCode(8206).repeat(4001);

            switch (command) {
                case 'menu': case 'help':
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
                    
                    try {
                        await client.sendMessage(from, { 
                            video: { url: 'https://media.giphy.com/media/Uau9JUChC8FdZnmVmX/giphy.mp4' }, 
                            caption: menuMsg, gifPlayback: true, mentions: [sender] 
                        }, { quoted: mek });
                    } catch (e) {
                        reply(menuMsg); // Fallback if video URL fails
                    }
                    break;

                case 'kickall':
                    if (!isOwner || !isGroup || !isBotAdmin) return reply("Access Denied.");
                    reply("🧹 Cleaning group members...");
                    for (let mem of groupMetadata.participants) {
                        if (mem.id !== client.user.id.split(':')[0] + '@s.whatsapp.net' && !global.owner.includes(mem.id.split('@')[0])) {
                            await client.groupParticipantsUpdate(from, [mem.id], "remove");
                            await delay(400); 
                        }
                    }
                    reply("✅ Group Cleared.");
                    break;

                case 'tagall':
                    if (!isGroup || !isOwner) return;
                    let teks = `*📢 TAG ALL*\n\n`;
                    let ms = groupMetadata.participants.map(mem => { teks += `🔘 @${mem.id.split('@')[0]}\n`; return mem.id; });
                    client.sendMessage(from, { text: teks, mentions: ms });
                    break;

                case 'hidetag':
                    if (!isGroup || !isOwner) return;
                    client.sendMessage(from, { text: q ? q : '', mentions: groupMetadata.participants.map(a => a.id) });
                    break;

                case 'add': case 'kick': case 'promote': case 'demote':
                    if (!isBotAdmin || !isOwner) return reply("Requires Admin/Owner.");
                    if (!target) return reply("Tag/Reply/Number needed.");
                    let act = (command === 'kick') ? 'remove' : (command === 'add') ? 'add' : command;
                    await client.groupParticipantsUpdate(from, [target], act).then(() => reply("✅ Done"));
                    break;

                case 'mute': case 'unmute':
                    if (!isBotAdmin || !isOwner) return;
                    await client.groupSettingUpdate(from, command === 'mute' ? 'announcement' : 'not_announcement');
                    reply("✅ Group status updated.");
                    break;

                case 'antilink': case 'antibot': case 'antiwame': case 'antitagall': case 'antispam': case 'antifake': case 'antibadword': case 'antidelete':
                    if (!isOwner) return;
                    global.db[command] = !global.db[command];
                    reply(`🛡️ ${command.toUpperCase()}: ${global.db[command] ? 'ON ✅' : 'OFF ❌'}`);
                    break;

                case 'status': case 'settings':
                    if (!isOwner) return;
                    let st = `⚙️ *SYSTEM SETTINGS*\n\n`;
                    for (let key in global.db) { st += `• ${key.toUpperCase()}: ${global.db[key] ? '✅' : '❌'}\n`; }
                    reply(st);
                    break;

                case 'warn':
                    if (!isBotAdmin || !isOwner) return;
                    if (!target) return reply("Tag user.");
                    global.warns[target] = (global.warns[target] || 0) + 1;
                    if (global.warns[target] >= 3) {
                        await client.groupParticipantsUpdate(from, [target], "remove");
                        delete global.warns[target];
                        reply("Kicked: 3 warnings.");
                    } else reply(`⚠️ Warning ${global.warns[target]}/3`);
                    break;

                case 'unwarn':
                    if (!isOwner) return;
                    delete global.warns[target];
                    reply("✅ User warnings cleared.");
                    break;

                case 'ai':
                    if (!q) return reply("Ask me something.");
                    try {
                        const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                        reply(res.data.success);
                    } catch { reply("AI Error."); }
                    break;

                case 'ping':
                    reply(`⚡ Latency: ${Date.now() - mek.messageTimestamp * 1000}ms`);
                    break;

                case 'owner':
                    reply(`Owner Contact: wa.me/${global.owner[0]}`);
                    break;

                case 'time':
                    reply(`🕒 Time: ${moment.tz('America/Port-au-Prince').format('HH:mm:ss')}`);
                    break;

                case 'steal':
                    if (!quotedMsg?.stickerMessage) return reply("Reply to a sticker.");
                    const sB = await downloadContentFromMessage(quotedMsg.stickerMessage, 'sticker');
                    let sBuffer = Buffer.from([]);
                    for await(const chunk of sB) { sBuffer = Buffer.concat([sBuffer, chunk]); }
                    client.sendMessage(from, { sticker: sBuffer }, { quoted: mek });
                    break;

                case 'vv':
                    if (!quotedMsg?.viewOnceMessageV2) return reply("Not view-once.");
                    const t = Object.keys(quotedMsg.viewOnceMessageV2.message)[0];
                    const s = await downloadContentFromMessage(quotedMsg.viewOnceMessageV2.message[t], t.split('Message')[0]);
                    let vB = Buffer.from([]);
                    for await(const chunk of s) { vB = Buffer.concat([vB, chunk]); }
                    client.sendMessage(from, { [t.split('Message')[0]]: vB, caption: '✅ Retreived' }, { quoted: mek });
                    break;
            }
        } catch (e) { console.log(e); }
    });
}

startHisoka();
Ready to Go:
