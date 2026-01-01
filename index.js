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
    app.listen(port, "0.0.0.0", () => console.log(chalk.green(`🌐 Port: ${port}`)));
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

    if (!client.authState.creds.registered) {
        await delay(15000); 
        try {
            const code = await client.requestPairingCode("212701458617");
            console.log(chalk.magenta(`\n PAIRING CODE: ${code} \n`));
        } catch { startHisoka(); }
    }

    client.ev.on("creds.update", saveCreds);
    client.ev.on("connection.update", async (up) => {
        const { connection, lastDisconnect } = up; 
        if (connection === "open") console.log(chalk.green("✅ CONNECTED"));
        if (connection === "close") {
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code !== 401) { await delay(10000); startHisoka(); }
        }
    });

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

            switch (command) {
                case 'menu':
                    const time = new Date().toLocaleTimeString();
                    const date = new Date().toLocaleDateString();
                    const uptime = process.uptime();
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    let menuMsg = `┏━━━〔 *${botName}* 〕━━━┓
┃ Hi 👋
┃ 🤖 *RK BOT*
┗━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━┓
┃ 🌅 *System Status* 🌇
┗━━━━━━━━━━━━━━┛

┏━━━〔 *Bot Info* 〕━━━┓
┃ *Bot Name :* ${botName}
┃ *Owner Name :* ${ownerName}
┃ *Prefix :* .
┃ *Uptime :* ${hours}h ${minutes}m ${seconds}s
┃ *Mode :* Public
┗━━━━━━━━━━━━━━┛

┏━━━〔 *User Info* 〕━━━┓
┃ *Name :* ${mek.pushName || "User"}
┃ *Number :* @${sender.split('@')[0]}
┃ *Rank :* ${isOwner ? "Owner" : "User"}
┃ *Premium :* ✅
┗━━━━━━━━━━━━━━┛

┏━━━〔 *Time Info* 〕━━━┓
┃ *Time :* ${time}
┃ *Date :* ${date}
┗━━━━━━━━━━━━━━┛

┏━━━〔 *Owner Manual* 〕━━━┓
┃ .vv (Reply ViewOnce)
┃ .quoted (Reply Deleted)
┃ .kickall | .bc
┗━━━━━━━━━━━━━━┛

┏━━━〔 *Group Admin* 〕━━━┓
┃ .add [number] | .kick
┃ .promote | .demote
┃ .mute | .unmute
┃ .tagall | .hidetag
┃ .antilink on/off
┗━━━━━━━━━━━━━━┛

┏━━━〔 *Public* 〕━━━┓
┃ .ping | .owner | .ai
┗━━━━━━━━━━━━━━┛

*...Read more*`;

                    await client.sendMessage(from, { 
                        video: { url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJueXF4ZzR4ZzR4ZzR4ZzR4ZzR4ZzR4ZzR4ZzR4ZzR4ZzR4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKMGpxx5J1fP44M/giphy.gif" }, 
                        caption: menuMsg, gifPlayback: true, mentions: [sender]
                    }, { quoted: mek });
                    break;

                case 'hidetag':
                    if (!isGroup || !isOwner) return;
                    client.sendMessage(from, { text: q ? q : "📢 Attention Everyone!", mentions: participants.map(a => a.id) });
                    break;

                case 'tagall':
                    if (!isGroup || !isOwner) return;
                    let t = `*📢 ATTENTION ALL*\n\n`;
                    for (let m of participants) { t += ` @${m.id.split('@')[0]}\n`; }
                    await client.sendMessage(from, { text: t, mentions: participants.map(a => a.id) });
                    break;

                case 'vv':
                    if (!isOwner || !quoted) return;
                    const vType = Object.keys(quoted)[0];
                    if (vType === 'viewOnceMessageV2' || vType === 'viewOnceMessage') {
                        const vo = quoted.viewOnceMessageV2 || quoted.viewOnceMessage;
                        const mType = Object.keys(vo.message)[0];
                        const stream = await downloadContentFromMessage(vo.message[mType], mType === 'imageMessage' ? 'image' : 'video');
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                        await client.sendMessage(from, { [mType === 'imageMessage' ? 'image' : 'video']: buffer, caption: "🔓 Decrypted" }, { quoted: mek });
                    }
                    break;

                case 'quoted':
                    if (!isOwner || !quoted) return;
                    await client.sendMessage(from, { forward: { key: mek.message.extendedTextMessage.contextInfo.quotedMessage ? mek : null, message: quoted } });
                    break;

                case 'add':
                    if (!isGroup || !isBotAdmin || !isOwner) return;
                    await client.groupParticipantsUpdate(from, [q.replace(/[^0-9]/g, '') + '@s.whatsapp.net'], "add");
                    break;

                case 'kick':
                    if (!isGroup || !isBotAdmin || !isOwner) return;
                    let target = mek.message.extendedTextMessage?.contextInfo?.mentionedJid[0] || (q.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                    await client.groupParticipantsUpdate(from, [target], "remove");
                    break;

                case 'kickall':
                    if (!isGroup || !isBotAdmin || !isOwner) return;
                    const others = participants.filter(v => v.admin === null).map(v => v.id);
                    for (let m of others) {
                        await client.groupParticipantsUpdate(from, [m], "remove");
                        await delay(1500);
                    }
                    break;

                case 'mute':
                case 'unmute':
                    if (isGroup && isBotAdmin && isOwner) await client.groupSettingUpdate(from, command === 'mute' ? 'announcement' : 'not_announcement');
                    break;

                case 'ping': await client.sendMessage(from, { text: "⚡ Online" }); break;
                case 'owner': await client.sendMessage(from, { text: isOwner ? "✅ Authenticated" : "❌ Denied" }); break;
            }
        } catch (e) { console.log(e); }
    });
}
startHisoka().catch(e => console.log(e));
