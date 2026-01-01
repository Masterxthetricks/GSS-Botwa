require("dotenv").config();
const { 
    default: goutamConnect, 
    useMultiFileAuthState, 
    delay, 
    fetchLatestBaileysVersion, 
    downloadContentFromMessage 
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require('path');
const axios = require('axios');
const chalk = require("chalk");
const pino = require("pino");
const os = require('os');
const express = require('express');

const app = express();
const port = process.env.PORT || 8080;
const sessionPath = path.join(__dirname, 'session');

// 📝 CONFIGURATION
global.owner = ["212701458617", "85182757527702"]; 
global.antilink = false;
global.deletedMessages = {}; 
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

if (!global.serverStarted) {
    app.get('/', (req, res) => res.send('Bot Online'));
    app.listen(port, "0.0.0.0");
    global.serverStarted = true;
}

async function startHisoka() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const client = goutamConnect({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"], 
        auth: state
    });

    client.ev.on("creds.update", saveCreds);

    // 🕵️ ANTI-DELETE CACHE
    client.ev.on("messages.upsert", async (chatUpdate) => {
        const mek = chatUpdate.messages[0];
        if (!mek.message) return;
        const from = mek.key.remoteJid;
        if (!global.deletedMessages[from]) global.deletedMessages[from] = [];
        global.deletedMessages[from].push(mek);
        if (global.deletedMessages[from].length > 50) global.deletedMessages[from].shift(); 
    });

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;

            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(mek.message)[0];
            const body = (type === 'conversation') ? mek.message.conversation : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : (type === 'imageMessage') ? mek.message.imageMessage.caption : (type === 'videoMessage') ? mek.message.videoMessage.caption : '';
            const sender = mek.key.participant || mek.key.remoteJid;
            const isOwner = global.owner.some(num => sender.includes(num));

            if (!body.startsWith(".")) return;
            const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(" ");

            const groupMetadata = isGroup ? await client.groupMetadata(from) : null;
            const participants = isGroup ? groupMetadata.participants : [];
            const botNumber = client.user.id.split(':')[0] + '@s.whatsapp.net';
            const isBotAdmin = isGroup ? participants.find(u => u.id === botNumber)?.admin : false;
            const quoted = mek.message.extendedTextMessage?.contextInfo?.quotedMessage;

            const reply = (text) => client.sendMessage(from, { text: text }, { quoted: mek });

            switch (command) {
                case 'menu':
                    const uptime = process.uptime();
                    const h = Math.floor(uptime / 3600);
                    const m = Math.floor((uptime % 3600) / 60);
                    const s = Math.floor(uptime % 60);

                    let menuMsg = `┏━━━〔 *${botName}* 〕━━━┓
┃ Hi 👋
┃ 🤖 *RK BOT*
┗━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━┓
┃ 🌅 *Ayanokoji System* 🌇
┗━━━━━━━━━━━━━━┛

┏━━━〔 *Bot Info* 〕━━━┓
┃ *Owner :* ${ownerName}
┃ *Uptime :* ${h}h ${m}m ${s}s
┃ *Antilink :* ${global.antilink ? '✅ ON' : '❌ OFF'}
┗━━━━━━━━━━━━━━┛

┏━━━〔 *User Info* 〕━━━┓
┃ *Name :* ${mek.pushName || "User"}
┃ *Number :* @${sender.split('@')[0]}
┃ *Rank :* ${isOwner ? "Elite Owner" : "Student"}
┗━━━━━━━━━━━━━━┛

┏━━━〔 *Commands* 〕━━━┓
┃ .vv | .quoted | .status
┃ .hidetag | .tagall | .kickall
┃ .add | .kick | .mute
┃ .antilink on/off | .ping
┗━━━━━━━━━━━━━━┛`;

                    await client.sendMessage(from, { 
                        video: { url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3h6Z3RyejR6Z3RyejR6Z3RyejR6Z3RyejR6Z3RyejR6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/vA07zct9tyTLO/giphy.gif" }, 
                        caption: menuMsg, 
                        gifPlayback: true, 
                        mimetype: 'video/mp4',
                        mentions: [sender]
                    }, { quoted: mek });
                    break;

                case 'status':
                    const ram = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
                    const freeRam = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2);
                    reply(`💻 *Server Status*:\n\nTotal RAM: ${ram}GB\nFree RAM: ${freeRam}GB\nPlatform: ${os.platform()}\nUptime: ${process.uptime().toFixed(0)}s`);
                    break;

                case 'antilink':
                    if (!isGroup || !isOwner) return reply("❌ This is an Elite-level command.");
                    global.antilink = q.toLowerCase() === 'on';
                    reply(`🛡️ *Antilink is now ${global.antilink ? 'Active' : 'Inactive'}*`);
                    break;

                case 'hidetag':
                    if (!isGroup || !isOwner) return reply("❌ Only the Master can use this.");
                    await client.sendMessage(from, { text: q ? q : "📢 Observe.", mentions: participants.map(a => a.id) });
                    reply("✅ *Command executed silently.*");
                    break;

                case 'vv':
                    if (!isOwner || !quoted) return reply("❌ Reply to a ViewOnce.");
                    const vType = Object.keys(quoted)[0];
                    if (vType.includes('viewOnce')) {
                        const vo = quoted.viewOnceMessageV2 || quoted.viewOnceMessage;
                        const mType = Object.keys(vo.message)[0];
                        const stream = await downloadContentFromMessage(vo.message[mType], mType.split('Message')[0]);
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                        await client.sendMessage(from, { [mType.split('Message')[0]]: buffer, caption: "🔓 Observation Complete." }, { quoted: mek });
                    }
                    break;

                case 'kick':
                    if (!isGroup || !isBotAdmin || !isOwner) return reply("❌ Insufficient permissions.");
                    let target = mek.message.extendedTextMessage?.contextInfo?.mentionedJid[0] || (q.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                    await client.groupParticipantsUpdate(from, [target], "remove");
                    reply("❌ *Subject Expelled.*");
                    break;

                case 'ping': reply("⚡ *Response Time:* Elite."); break;
            }
        } catch (e) { console.error(e); }
    });
}
startHisoka().catch(e => console.log(e));
