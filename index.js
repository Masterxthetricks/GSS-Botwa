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

if (!fs.existsSync(sessionPath)) { 
    fs.mkdirSync(sessionPath, { recursive: true }); 
}

// 📝 CONFIGURATION
const PAIRING_NUMBER = "212701458617"; 
global.owner = [PAIRING_NUMBER, "85182757527702"]; 
global.db = {
    antilink: false, antibot: false, antiwame: false, antitagall: false,
    antibadword: false, antispam: false, antiban: true
};

const badWords = ["fuck you", "djol santi", "pussy", "bouda santi", "bitch", "masisi", "bouzen", "langet manman w", "santi kk", "gyet manman w", "pouri", "bouda fon", "trip pouri", "koko santi", "kalanbe"];
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";
let kickallSafety = {}; 

app.get('/', (req, res) => res.status(200).send('GSS-BETA Status: Active'));
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
        connectTimeoutMs: 60000,
        printQRInTerminal: false,
        markOnlineOnConnect: true
    });

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startHisoka();
        } else if (connection === "open") {
            console.log(chalk.green.bold("✅ GSS-BETA ONLINE"));
            await client.sendMessage(PAIRING_NUMBER + "@s.whatsapp.net", { text: "🚀 *MASTER BUILD DEPLOYED: ALL SYSTEMS ACTIVE*" });
        }

        if (!client.authState.creds.registered && !update.qr) {
            await delay(15000); 
            try {
                const code = await client.requestPairingCode(PAIRING_NUMBER);
                console.log(chalk.black.bgMagenta(`\n 📲 YOUR PAIRING CODE: ${code} \n`));
            } catch { console.log("Pairing request failed, retrying..."); }
        }
    });

    client.ev.on("creds.update", saveCreds);

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;

            const from = mek.key.remoteJid;
            const sender = mek.key.participant || from;
            const isOwner = global.owner.some(num => sender.includes(num));
            const isGroup = from.endsWith('@g.us');
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || mek.message.imageMessage?.caption || "").trim();
            const lowerBody = body.toLowerCase();

            // 🛡️ ANTI-BADWORD LOGIC
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
┃ Uptime: ${h}h ${m}m ${s}s
┗━━━━━━━━━━━━━━┛
┏━━━〔 *Commands* 〕━━━┓
┃ .ping | .status | .ai
┃ .hidetag | .tagall | .kick
┃ .promote | .demote | .add
┃ .mute | .unmute | .vv | .quoted
┃ .antilink on/off
┃ .antibadword on/off
┃ .antitagall on/off
┃ .kickall | .settings
┗━━━━━━━━━━━━━━┛`;
                    reply(menuMsg);
                    break;

                case 'settings':
                    if (!isOwner) return;
                    let setText = `⚙️ *SYSTEM SETTINGS*\n\n`;
                    for (let key in global.db) setText += `➤ ${key.toUpperCase()}: ${global.db[key] ? '✅' : '❌'}\n`;
                    reply(setText);
                    break;

                case 'kickall':
                    if (!isOwner || !isGroup) return reply("❌ Master Only.");
                    if (q === 'confirm') {
                        reply("⚠️ *CLEANING GROUP IN 3 SECONDS...*");
                        const groupMeta = await client.groupMetadata(from);
                        const participants = groupMeta.participants.filter(p => !global.owner.some(o => p.id.includes(o)) && !p.admin);
                        for (let mem of participants) {
                            await client.groupParticipantsUpdate(from, [mem.id], "remove");
                            await delay(1000); 
                        }
                        reply("✅ Group cleaning complete.");
                        delete kickallSafety[from];
                    } else {
                        kickallSafety[from] = true;
                        reply("🛑 *WARNING:* You are about to kick everyone. Type `.kickall confirm` within 30s to proceed.");
                        setTimeout(() => delete kickallSafety[from], 30000);
                    }
                    break;

                case 'promote':
                case 'demote':
                    if (!isOwner || !isGroup) return reply("❌ Master Only.");
                    reply(`🔄 Executing ${command}...`);
                    await client.groupParticipantsUpdate(from, [mentioned], command);
                    break;

                case 'mute':
                case 'unmute':
                    if (!isOwner || !isGroup) return reply("❌ Master Only.");
                    await client.groupSettingUpdate(from, command === 'mute' ? 'announcement' : 'not_announcement');
                    reply(`✅ Group is now ${command}d.`);
                    break;

                case 'kick':
                case 'add':
                    if (!isOwner || !isGroup) return;
                    reply(`🔄 Processing ${command}...`);
                    await client.groupParticipantsUpdate(from, [mentioned], command === 'add' ? "add" : "remove");
                    break;

                case 'vv':
                case 'quoted':
                    const qmsg = mek.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    const vo = qmsg?.viewOnceMessageV2?.message || qmsg?.viewOnceMessage?.message;
                    if (!vo) return reply("⚠️ Quote a View-Once message.");
                    const type = Object.keys(vo)[0];
                    const stream = await downloadContentFromMessage(vo[type], type === 'imageMessage' ? 'image' : 'video');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    client.sendMessage(from, { [type === 'imageMessage' ? 'image' : 'video']: buffer, caption: "✅ Decrypted" }, { quoted: mek });
                    break;

                case 'antilink':
                case 'antibadword':
                case 'antitagall':
                    if (!isOwner) return;
                    global.db[command] = args[0] === 'on';
                    reply(`🛡️ ${command.toUpperCase()} set to ${args[0].toUpperCase()}`);
                    break;

                case 'ping': reply("⚡ Status: Active"); break;

                case 'status':
                    reply(`📊 *System Status*\nOS: ${os.platform()}\nRAM: ${Math.round(os.freemem()/1024/1024)}MB Free\nUptime: ${Math.round(process.uptime())}s`);
                    break;

                case 'ai':
                    if (!q) return;
                    try {
                        const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                        reply(`🤖: ${res.data.success}`);
                    } catch { reply("⚠️ AI Error."); }
                    break;
            }
        } catch (e) { console.error(e); }
    });
}

startHisoka();
