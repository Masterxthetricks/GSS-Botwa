require("dotenv").config();
const { 
    default: goutamConnect, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore, 
    downloadContentFromMessage, 
    delay,
    DisconnectReason,
    fetchLatestBaileysVersion
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

// 🛡️ SESSION CLEANUP
if (fs.existsSync(sessionPath)) { 
    fs.rmSync(sessionPath, { recursive: true, force: true }); 
}
fs.mkdirSync(sessionPath);

// 📝 CONFIGURATION
const pairingNumber = process.env.PAIRING_NUMBER || "212701458617";
global.owner = [pairingNumber, "85182757527702"]; 
global.db = {
    antilink: false, antibot: false, antiwame: false, antitagall: false,
    antibadword: false, antispam: false, antiban: true, warns: {},
    blacklist: [], tagCounts: {}, badWordCounts: {}
};

const badWords = ["fuck you", "djol santi", "pussy", "bouda santi", "bitch", "masisi", "bouzen", "langet manman w", "santi kk", "gyet manman w", "pouri", "bouda fon", "trip pouri", "koko santi", "kalanbe"];
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

app.get('/', (req, res) => res.send('GSS-BETA Status: Active'));
app.listen(port, "0.0.0.0");

let isPairing = false;

async function startHisoka() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    // 🛠️ FETCH LATEST WA VERSION (Bypasses 405 Handshake rejection)
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(chalk.cyan(`🌐 WA Version: ${version.join('.')} (Latest: ${isLatest})`));

    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        // 🛠️ MOBILE MASK: Bypass cloud IP blacklists
        browser: ["Chrome (Android)", "Android", "12.0.0"], 
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        version,
        connectTimeoutMs: 60000, 
        keepAliveIntervalMs: 25000,
        printQRInTerminal: false,
        markOnlineOnConnect: true
    });

    // 📲 CONNECTION HANDLER
    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red(`⚠️ Connection Error: ${statusCode}. Retrying...`));
            isPairing = false;
            // Cooldown for 405 error
            const cooldown = statusCode === 405 ? 25000 : 10000;
            setTimeout(() => startHisoka(), cooldown); 
        } else if (connection === "open") {
            console.log(chalk.green.bold("\n✅ GSS-BETA LINKED SUCCESSFULLY\n"));
            isPairing = false; 
            await client.sendMessage(pairingNumber + "@s.whatsapp.net", { text: "🚀 *AYANOKOJI SYSTEM ONLINE*" });
        }

        if (!client.authState.creds.registered && !isPairing) {
            isPairing = true;
            console.log(chalk.blue(`⏳ Mode: Pairing Code | Number: ${pairingNumber}`));
            await delay(15000); 

            try {
                console.log(chalk.magenta("📲 Generating Code (Mobile Mask)..."));
                const code = await client.requestPairingCode(pairingNumber);
                console.log(chalk.black.bgMagenta(`\n\n 📲 YOUR PAIRING CODE: ${code} \n\n`));
            } catch (err) {
                console.log(chalk.red("❌ Handshake Rejected. Re-attempting..."));
                isPairing = false; 
            }
        }
    });

    client.ev.on("creds.update", saveCreds);

    // 📩 MESSAGE HANDLER
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

            // 🛡️ Bad Word Shield
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
            
            const mentioned = mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                              mek.message.extendedTextMessage?.contextInfo?.participant || 
                              (q.replace(/[^0-9]/g, '') + '@s.whatsapp.net');

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
                        caption: menuMsg, gifPlayback: true 
                    }, { quoted: mek });
                    break;

                case 'ping': reply("⚡ Status: Active"); break;
                case 'status': reply(`📊 RAM: ${(os.freemem()/1024/1024).toFixed(2)}MB Free`); break;

                case 'vv': case 'quoted':
                    const qmsg = mek.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    const vo = qmsg?.viewOnceMessageV2 || qmsg?.viewOnceMessage;
                    if (vo) {
                        const type = Object.keys(vo.message)[0];
                        const stream = await downloadContentFromMessage(vo.message[type], type === 'imageMessage' ? 'image' : 'video');
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                        client.sendMessage(from, { [type === 'imageMessage' ? 'image' : 'video']: buffer, caption: "✅ Decrypted" }, { quoted: mek });
                    }
                    break;

                case 'ai':
                    if (!q) return reply("How can I assist you?");
                    try {
                        const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                        reply(`🤖 *Gemini:* ${res.data.success}`);
                    } catch { reply("AI system is currently overloaded."); }
                    break;

                case 'hidetag':
                    if (!isOwner || !isGroup) return;
                    const gMeta = await client.groupMetadata(from);
                    client.sendMessage(from, { text: q, mentions: gMeta.participants.map(a => a.id) });
                    break;

                case 'tagall':
                    if (!isOwner || !isGroup) return;
                    const tagMeta = await client.groupMetadata(from);
                    let tagTxt = "📣 *Announcement*\n\n" + q + "\n\n";
                    for (let mem of tagMeta.participants) tagTxt += "@" + mem.id.split('@')[0] + " ";
                    client.sendMessage(from, { text: tagTxt, mentions: tagMeta.participants.map(a => a.id) });
                    break;

                case 'kickall':
                    if (!isOwner || !isGroup) return;
                    const kickMeta = await client.groupMetadata(from);
                    for (let mem of kickMeta.participants) {
                        if (mem.id !== client.user.id && !global.owner.includes(mem.id.split('@')[0])) {
                            await client.groupParticipantsUpdate(from, [mem.id], "remove");
                        }
                    }
                    break;

                case 'promote': case 'demote':
                    if (!isOwner || !isGroup) return;
                    await client.groupParticipantsUpdate(from, [mentioned], command);
                    reply("✅ Student rank updated.");
                    break;

                case 'kick':
                    if (!isOwner || !isGroup) return;
                    await client.groupParticipantsUpdate(from, [mentioned], "remove");
                    break;

                case 'mute': case 'unmute':
                    if (!isOwner || !isGroup) return;
                    await client.groupSettingUpdate(from, command === 'mute' ? 'announcement' : 'not_announcement');
                    reply(command === 'mute' ? "🔒 Group Muted" : "🔓 Group Unmuted");
                    break;

                case 'add':
                    if (!isOwner || !isGroup) return;
                    await client.groupParticipantsUpdate(from, [q.replace(/[^0-9]/g, '') + '@s.whatsapp.net'], "add");
                    break;

                case 'antilink': case 'antibadword':
                    if (!isOwner) return;
                    global.db[command] = args[0] === 'on';
                    reply(`🛡️ ${command.toUpperCase()} is now ${global.db[command] ? 'ENABLED' : 'DISABLED'}`);
                    break;

                case 'settings':
                    if (!isOwner) return;
                    let setTxt = "⚙️ *SYSTEM CONFIG*\n\n";
                    for (let key in global.db) if (typeof global.db[key] === 'boolean') setTxt += `• ${key.toUpperCase()}: ${global.db[key] ? '✅' : '❌'}\n`;
                    reply(setTxt);
                    break;
            }
        } catch (e) { console.log(e); }
    });
}

startHisoka();
