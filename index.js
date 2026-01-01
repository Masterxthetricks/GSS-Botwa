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
global.db = {
    antilink: false, antibot: false, antiwame: false, antitagall: false,
    antibadword: false, antispam: false, antiban: true, warns: {},
    blacklist: [], tagCounts: {}, badWordCounts: {}
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
        browser: ["Chrome (Linux)", "GSS-BETA", "1.0.0"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        connectTimeoutMs: 120000
    });

    // 🔑 PAIRING LOGIC
    if (!client.authState.creds.registered) {
        await delay(10000); 
        try {
            const code = await client.requestPairingCode("212701458617");
            console.log(chalk.black.bgMagenta(`\n\n 📲 PAIRING CODE: ${code} \n\n`));
        } catch (err) { setTimeout(() => startHisoka(), 10000); return; }
    }

    client.ev.on("creds.update", saveCreds);

    client.ev.on("connection.update", async (update) => {
        const { connection } = update;
        if (connection === "open") {
            await client.sendMessage("212701458617@s.whatsapp.net", { text: "🚀 *SYSTEM ONLINE*" });
        }
        if (connection === "close") startHisoka();
    });

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;
            const from = mek.key.remoteJid;
            const sender = mek.key.participant || mek.key.remoteJid;
            const isOwner = global.owner.includes(sender.split('@')[0]);
            const isGroup = from.endsWith('@g.us');
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || mek.message.imageMessage?.caption || "").trim();

            if (!body.startsWith(".")) return;
            const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(" ");
            const reply = (text) => client.sendMessage(from, { text: text }, { quoted: mek });
            const mentioned = mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (q.replace(/[^0-9]/g, '') + '@s.whatsapp.net');

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
                    await client.sendMessage(from, { 
                        video: { url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3h6Z3RyejR6Z3RyejR6Z3RyejR6Z3RyejR6Z3RyejR6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/vA07zct9tyTLO/giphy.gif" }, 
                        caption: menuMsg, gifPlayback: true, mimetype: 'video/mp4' 
                    }, { quoted: mek });
                    break;

                case 'vv': // View Once Bypass
                    if (!isOwner) return;
                    let qmsg = mek.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (qmsg?.viewOnceMessageV2) {
                        let type = Object.keys(qmsg.viewOnceMessageV2.message)[0];
                        let media = await downloadContentFromMessage(qmsg.viewOnceMessageV2.message[type], type === 'imageMessage' ? 'image' : 'video');
                        let buffer = Buffer.from([]);
                        for await (const chunk of media) buffer = Buffer.concat([buffer, chunk]);
                        client.sendMessage(from, { [type === 'imageMessage' ? 'image' : 'video']: buffer, caption: "✅ View Once Bypassed" }, { quoted: mek });
                    }
                    break;

                case 'ai':
                    if (!q) return reply("What is your question?");
                    const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                    reply(`🤖 *Gemini:* ${res.data.success}`);
                    break;

                case 'hidetag': // Ghost Mention
                    if (!isOwner || !isGroup) return;
                    const groupMetadata = await client.groupMetadata(from);
                    client.sendMessage(from, { text: q ? q : '', mentions: groupMetadata.participants.map(a => a.id) });
                    break;

                case 'tagall': // Visible Mention
                    if (!isOwner || !isGroup) return;
                    const meta = await client.groupMetadata(from);
                    let txt = `📣 *TAG ALL*\n\n${q}\n\n`;
                    for (let i of meta.participants) txt += ` @${i.id.split('@')[0]}`;
                    client.sendMessage(from, { text: txt, mentions: meta.participants.map(a => a.id) });
                    break;

                case 'kickall':
                    if (!isOwner || !isGroup) return;
                    const gmeta = await client.groupMetadata(from);
                    for (let i of gmeta.participants) {
                        if (!i.admin && i.id !== client.user.id) await client.groupParticipantsUpdate(from, [i.id], "remove");
                    }
                    break;

                case 'kick':
                    if (!isOwner || !isGroup) return;
                    await client.groupParticipantsUpdate(from, [mentioned], "remove");
                    break;

                case 'promote':
                    if (!isOwner || !isGroup) return;
                    await client.groupParticipantsUpdate(from, [mentioned], "promote");
                    reply("✅ Promoted.");
                    break;

                case 'demote':
                    if (!isOwner || !isGroup) return;
                    await client.groupParticipantsUpdate(from, [mentioned], "demote");
                    reply("✅ Demoted.");
                    break;

                case 'antilink':
                case 'antibadword':
                    if (!isOwner) return;
                    global.db[command] = args[0] === 'on';
                    reply(`🛡️ ${command.toUpperCase()}: ${global.db[command] ? 'ON' : 'OFF'}`);
                    break;

                case 'settings':
                    if (!isOwner) return;
                    let s_txt = `⚙️ *SYSTEM STATUS*\n\n`;
                    for (let key in global.db) if (typeof global.db[key] === 'boolean') s_txt += `• ${key.toUpperCase()}: ${global.db[key] ? '✅' : '❌'}\n`;
                    reply(s_txt);
                    break;

                case 'ping': reply("⚡ Status: Active"); break;
                case 'status': reply(`RAM: ${(os.freemem()/1024/1024).toFixed(2)}MB Free`); break;
            }
        } catch (e) { console.error("Error:", e); }
    });
}
start
