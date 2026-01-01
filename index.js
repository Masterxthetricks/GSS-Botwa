require("dotenv").config();
const { 
    default: goutamConnect, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore, 
    downloadContentFromMessage, 
    delay 
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

// 🛡️ SESSION WIPE: Deletes old files so the pairing code is ALWAYS fresh
if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
}
fs.mkdirSync(sessionPath);

// 📝 CONFIGURATION & DATABASE
global.owner = ["212701458617", "85182757527702"]; 
global.db = {
    antilink: false,
    antibadword: false,
    antitagall: false
};

// 🚫 BAD WORDS LIST
const badWords = ["fuck you", "djol santi", "pussy", "bouda santi", "bitch", "masisi", "bouzen", "langet manman w", "santi kk", "gyet manman w", "pouri", "bouda fon", "trip pouri", "koko santi", "kalanbe"];

const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

app.get('/', (req, res) => res.send('GSS-BETA Status: Active'));
app.listen(port, "0.0.0.0");

async function startHisoka() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        browser: ["Chrome (Linux)", "GSS-BETA", "1.0.0"],
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        connectTimeoutMs: 120000
    });

    // 📲 PAIRING CODE LOGIC
    if (!client.authState.creds.registered) {
        await delay(10000); 
        try {
            const code = await client.requestPairingCode("212701458617");
            console.log(chalk.black.bgMagenta(`\n\n 📲 PAIRING CODE: ${code} \n\n`));
        } catch (err) { 
            console.error("Pairing Error, retrying...", err);
            setTimeout(() => startHisoka(), 10000); 
            return; 
        }
    }

    client.ev.on("creds.update", saveCreds);
    client.ev.on("connection.update", async (update) => {
        const { connection } = update;
        if (connection === "open") {
            console.log(chalk.green.bold("\n✅ GSS-BETA LINKED\n"));
            await client.sendMessage("212701458617@s.whatsapp.net", { text: "🚀 *SYSTEM ONLINE*" });
        }
        if (connection === "close") startHisoka();
    });

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;
            const from = mek.key.remoteJid;
            const sender = mek.key.participant || from;
            const isOwner = global.owner.includes(sender.split('@')[0]);
            const isGroup = from.endsWith('@g.us');
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || mek.message.imageMessage?.caption || "").trim();
            const lowerBody = body.toLowerCase();

           // 🛡️ ANTIBADWORD LOGIC
            if (isGroup && global.db.antibadword && !isOwner) {
                if (badWords.some(word => lowerBody.includes(word))) {
                    return await client.sendMessage(from, { delete: mek.key });
                }
            }

            if (!body.startsWith(".")) return;
            const args = body.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const q = args.join(" ");
            const reply = (text) => client.sendMessage(from, { text }, { quoted: mek });
            const mentioned = mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (q.replace(/[^0-9]/g, '') + '@s.whatsapp.net');

            switch (command) {
                case 'menu':
                    const uptime = process.uptime();
                    const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = Math.floor(uptime % 60);
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
┃ .vv | .quoted | .status | .ping 
┃ .ai | .hidetag | .tagall 
┃ .kickall | .promote | .demote 
┃ .kick | .mute | .unmute | .add
┃ .antibadword on/off
┃ .antilink on/off
┃ .settings
┗━━━━━━━━━━━━━━┛`;
                    client.sendMessage(from, { 
                        video: { url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3h6Z3RyejR6Z3RyejR6Z3RyejR6Z3RyejR6Z3RyejR6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/vA07zct9tyTLO/giphy.gif" }, 
                        caption: menuMsg, 
                        gifPlayback: true 
                    }, { quoted: mek });
                    break;

                case 'quoted': 
                case 'vv':
                    const qmsg = mek.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    const vo = qmsg?.viewOnceMessageV2 || qmsg?.viewOnceMessage;
                    if (vo) {
                        const type = Object.keys(vo.message)[0];
                        const stream = await downloadContentFromMessage(vo.message[type], type === 'imageMessage' ? 'image' : 'video');
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                        client.sendMessage(from, { [type === 'imageMessage' ? 'image' : 'video']: buffer, caption: "✅ Decrypted" }, { quoted: mek });
                    } else {
                        reply("Please reply to a view-once message.");
                    }
                    break;

                case 'hidetag':
                    if (!isOwner || !isGroup) return;
                    const meta = await client.groupMetadata(from);
                    client.sendMessage(from, { text: q ? q : '', mentions: meta.participants.map(a => a.id) });
                    break;

                case 'add':
                    if (!isOwner || !isGroup) return;
                    if (!q) return reply("Provide a number.");
                    await client.groupParticipantsUpdate(from, [q.replace(/[^0-9]/g, '') + '@s.whatsapp.net'], "add");
                    reply("✅ User add request sent.");
                    break;

                case 'mute': 
                case 'unmute':
                    if (!isOwner || !isGroup) return;
                    await client.groupSettingUpdate(from, command === 'mute' ? 'announcement' : 'not_announcement');
                    reply(command === 'mute' ? "🔒 Group Locked" : "🔓 Group Opened");
                    break;

                case 'ai':
                    if (!q) return reply("Ask me something.");
                    try {
                        const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                        reply(`🤖 *Gemini:* ${res.data.success}`);
                    } catch { reply("AI is currently busy."); }
                    break;

                case 'antibadword': 
                case 'antilink':
                    if (!isOwner) return;
                    global.db[command] = q === 'on';
                    reply(`${command.toUpperCase()} is now ${global.db[command] ? 'ON' : 'OFF'}`);
                    break;
                
                case 'settings':
                    if (!isOwner) return;
                    reply(`⚙️ *SETTINGS*\n\n• Antibadword: ${global.db.antibadword ? '✅' : '❌'}\n• Antilink: ${global.db.antilink ? '✅' : '❌'}`);
                    break;

                case 'ping': reply("⚡ Active"); break;
                case 'status': reply(`RAM: ${(os.freemem()/1024/1024).toFixed(2)}MB Free`); break;
            }
        } catch (e) { console.log("Error logic:", e); }
    });
}

// Start the bot
startHisoka();
