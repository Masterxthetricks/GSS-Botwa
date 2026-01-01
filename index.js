require("dotenv").config();
const { 
    default: goutamConnect, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    delay,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    downloadContentFromMessage
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require('path');
const chalk = require("chalk");
const pino = require("pino");
const os = require('os');
const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 8080;
const sessionPath = path.join(__dirname, 'session');

// 📝 CONFIGURATION & DATABASE
global.owner = ["212701458617", "85182757527702"]; 
global.deletedMessages = {}; 
global.db = {
    antilink: false,
    antibot: false,
    antiwame: false,
    antitagall: false,
    antibadword: false,
    antispam: false,
    antiban: true,
    warns: {},
    blacklist: [],
    tagCounts: {},
    badWordCounts: {}
};

const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath);
app.get('/', (req, res) => res.send('GSS-BETA Status: Active'));
app.listen(port, "0.0.0.0");

async function startHisoka() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        connectTimeoutMs: 60000,
        maxRetries: 10
    });

    if (!client.authState.creds.registered) {
        await delay(5000); // Vital Adjustment: 5s
        try {
            const code = await client.requestPairingCode("212701458617");
            console.log(chalk.black.bgMagenta(`\n\n 📲 PAIRING CODE: ${code} \n\n`));
        } catch (err) { setTimeout(() => startHisoka(), 10000); return; }
    }

    client.ev.on("creds.update", saveCreds);
    client.ev.on("connection.update", async (update) => {
        const { connection } = update;
        if (connection === "open") await client.sendMessage("212701458617@s.whatsapp.net", { text: "🚀 *SYSTEM ONLINE*" });
        if (connection === "close") startHisoka();
    });

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;
            const from = mek.key.remoteJid;
            const sender = mek.key.participant || mek.key.remoteJid;
            const isOwner = global.owner.includes(sender.split('@')[0]);
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || mek.message.imageMessage?.caption || "").trim();
            const isGroup = from.endsWith('@g.us');

            if (!body.startsWith(".")) return;
            const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(" ");
            const reply = (text) => client.sendMessage(from, { text: text }, { quoted: mek });

            switch (command) {
                case 'menu':
                    const uptime = process.uptime();
                    const h = Math.floor(uptime / 3600);
                    const m = Math.floor((uptime % 3600) / 60);
                    const s = Math.floor(uptime % 60);
                    let menuMsg = `┏━━━〔 *${botName}* 〕━━━┓
┃ Master: ${ownerName}
┗━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━┓
┃ 🌅 *Ayanokoji System* 🌇
┗━━━━━━━━━━━━━━┛

┏━━━〔 *Bot Info* 〕━━━┓
┃ *Uptime :* ${h}h ${m}m ${s}s
┃ *Status :* ${global.db.antilink ? '✅ Protected' : '❌ Vulnerable'}
┗━━━━━━━━━━━━━━┛

┏━━━〔 *User Info* 〕━━━┓
┃ *Name :* ${mek.pushName || "User"}
┃ *Rank :* ${isOwner ? "Elite Owner" : "Student"}
┗━━━━━━━━━━━━━━┛

┏━━━〔 *Commands* 〕━━━┓
┃ .vv | .status | .ping | .ai
┃ .hidetag | .tagall | .kickall
┃ .promote | .demote | .kick
┃ .antibadword on/off
┃ .antilink on/off
┃ .settings
┗━━━━━━━━━━━━━━┛`;
                    await client.sendMessage(from, { video: { url: "https://media.giphy.com/media/vA07zct9tyTLO/giphy.gif" }, caption: menuMsg, gifPlayback: true, mimetype: 'video/mp4' }, { quoted: mek });
                    break;

                case 'ai':
                    if (!q) return reply("Please provide a question.");
                    try {
                        const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                        reply(`🤖 *Gemini-AI:* ${res.data.success}`);
                    } catch { reply("AI Server is busy. Try again."); }
                    break;

                case 'tagall':
                    if (!isOwner || !isGroup) return;
                    const groupMetadata = await client.groupMetadata(from);
                    let teks = `📣 *TAG ALL*\n\n${q}\n\n`;
                    for (let mem of groupMetadata.participants) teks += `@${mem.id.split('@')[0]} `;
                    client.sendMessage(from, { text: teks, mentions: groupMetadata.participants.map(a => a.id) });
                    break;

                case 'kick':
                    if (!isOwner || !isGroup) return;
                    let users = mek.message.extendedTextMessage?.contextInfo?.mentionedJid[0] || q.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                    await client.groupParticipantsUpdate(from, [users], "remove");
                    reply("Eliminated.");
                    break;

                case 'settings':
                    if (!isOwner) return;
                    let st = `⚙️ *SYSTEM STATUS*\n\n`;
                    for (let key in global.db) if (typeof global.db[key] === 'boolean') st += `• ${key.toUpperCase()}: ${global.db[key] ? '✅' : '❌'}\n`;
                    reply(st);
                    break;

                case 'ping': reply("⚡ Status: Active"); break;
                case 'status': reply(`RAM: ${(os.freemem()/1024/1024).toFixed(2)}MB Free`); break;
            }
        } catch (e) { console.log(e); }
    });
}
startHisoka();
