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
const express = require('express');
const axios = require('axios');
const moment = require("moment-timezone");

const app = express();
const port = process.env.PORT || 8080;
const sessionPath = path.join(__dirname, 'session');

if (!fs.existsSync(sessionPath)) { 
    fs.mkdirSync(sessionPath, { recursive: true }); 
}

// 🔒 HARDCODED CONFIGURATION
const PAIRING_NUMBER = "212701458617"; 
global.owner = ["212701458617", "85182757527702"]; 
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

global.db = {
    antilink: false, antibot: false, antiwame: false, antitagall: false,
    antibadword: false, antibadwordnokick: false, antispam: false, 
    antiban: true, antifake: false, antidelete: false
};

const badWords = ["fuck you", "djol santi", "pussy", "bouda santi", "bitch", "masisi", "bouzen", "langet manman w", "santi kk", "gyet manman w", "pouri", "bouda fon", "trip pouri", "koko santi", "kalanbe"];
let badWordStrikes = {}; 
let warnings = {};
let blacklist = [];
let deletedMessages = {}; 

app.get('/', (req, res) => res.status(200).send('GSS-BETA Status: Active'));
app.listen(port, "0.0.0.0");

async function startHisoka() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    
    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        // 🛠️ FIXED BROWSER STRING FOR VALID PAIRING
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        version,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        printQRInTerminal: false,
        mobile: false
    });

    // 📲 PAIRING LOGIC
    if (!client.authState.creds.registered) {
        await delay(5000); 
        let code = await client.requestPairingCode(PAIRING_NUMBER);
        console.log(chalk.white.bgRed.bold(`\n 📲 PAIRING CODE FOR ${PAIRING_NUMBER}: ${code} \n`));
    }

    client.ev.on("messages.update", async (chatUpdate) => {
        if (!global.db.antidelete) return;
        for (const { key, update } of chatUpdate) {
            if (update.protocolMessage?.type === 0) {
                deletedMessages[key.remoteJid] = { key, participant: key.participant, message: update.protocolMessage };
            }
        }
    });

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startHisoka();
        } else if (connection === "open") {
            console.log(chalk.green.bold("✅ GSS-BETA ONLINE"));
        }
    });

    client.ev.on("creds.update", saveCreds);

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;

            const from = mek.key.remoteJid;
            const sender = mek.key.participant || from;
            const senderNumber = sender.replace(/[^0-9]/g, '');
            const isOwner = global.owner.includes(senderNumber);
            const isGroup = from.endsWith('@g.us');
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || mek.message.imageMessage?.caption || "").trim();
            const lowerBody = body.toLowerCase();
            const reply = (text) => client.sendMessage(from, { text }, { quoted: mek });

            if (blacklist.includes(senderNumber) && !isOwner) {
                return await client.groupParticipantsUpdate(from, [sender], "remove");
            }

            if (isGroup && global.db.antibadword && !isOwner) {
                if (badWords.some(word => lowerBody.includes(word))) {
                    await client.sendMessage(from, { delete: mek.key });
                    if (!global.db.antibadwordnokick) {
                        badWordStrikes[senderNumber] = (badWordStrikes[senderNumber] || 0) + 1;
                        if (badWordStrikes[senderNumber] >= 3) {
                            reply("🚫 Auto-Kick: 3 strikes reached.");
                            await client.groupParticipantsUpdate(from, [sender], "remove");
                            delete badWordStrikes[senderNumber];
                        } else { reply(`⚠️ Warning @${senderNumber} [${badWordStrikes[senderNumber]}/3]`); }
                    }
                    return;
                }
            }

            if (!body.startsWith(".")) return;
            if (!isOwner && !lowerBody.startsWith(".menu") && !lowerBody.startsWith(".owner")) return;

            const args = body.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const q = args.join(" ");
            const mentioned = mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (q.replace(/[^0-9]/g, '') + '@s.whatsapp.net');

            switch (command) {
                case 'menu':
                case 'help':
                    const uptime = process.uptime();
                    const hours = Math.floor(uptime / 3600);
                    const mins = Math.floor((uptime % 3600) / 60);
                    const time = moment.tz('America/Port-au-Prince').format('HH:mm:ss');
                    const date = moment.tz('America/Port-au-Prince').format('DD/MM/YYYY');
                    
                    let menuMsg = `╭───『 *${botName}* 』───
│ Hi 👋
│ ✨ *${ownerName}*
│
├─『 *Good Morning* 🌇 😊 』
│
├─『 *Bot Info* 』
│ Bot Name : ${botName}
│ Owner Name : ${ownerName}
│ Prefix : .
│ Uptime : ${hours}h ${mins}m
│ Mode : Public
│
├─『 *User Info* 』
│ Name : ${mek.pushName || 'User'}
│ Number : @${senderNumber}
│ Premium : ${isOwner ? '✅' : '❌'}
│
├─『 *Time Info* 』
│ Time : ${time}
│ Date : ${date}
│
├─『 *Commands* 』
│ .ping | .ai | .vv | .owner
│ .tagall | .hidetag | .kick
│ .promote | .demote | .add
│ .mute | .unmute | .kickall
│ .settings | .antidelete
│ .antilink | .antibot | .antiwame
│ .antitagall | .antispam | .antifake
│ .antibadword | .antibadwordnokick
│ .warn | .unwarn | .blacklist
╰───────────────────
> 💡 Please Type .help for info`;

                    await client.sendMessage(from, { 
                        video: { url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJueXF4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/vA07zct9tyTLO/giphy.gif' }, 
                        caption: menuMsg, gifPlayback: true, mentions: [sender]
                    }, { quoted: mek });
                    break;

                case 'owner': reply(isOwner ? "✅ Status: Recognized Master." : "❌ Status: Unknown User."); break;
                
                case 'kickall':
                    if (q === 'confirm') {
                        const meta = await client.groupMetadata(from);
                        const targets = meta.participants.filter(p => !global.owner.includes(p.id.replace(/[^0-9]/g, '')) && !p.admin);
                        for (let t of targets) { await client.groupParticipantsUpdate(from, [t.id], "remove"); await delay(1000); }
                        reply("✅ Group Cleaned.");
                    } else { reply("🛑 Safety: Type `.kickall confirm` to wipe."); }
                    break;

                case 'warn':
                    warnings[mentioned] = (warnings[mentioned] || 0) + 1;
                    if (warnings[mentioned] >= 3) {
                        await client.groupParticipantsUpdate(from, [mentioned], "remove");
                        delete warnings[mentioned];
                        reply("🚫 Removed.");
                    } else { reply(`⚠️ Warning @${mentioned.split('@')[0]} [${warnings[mentioned]}/3]`); }
                    break;

                case 'blacklist':
                    if (args[0] === 'add') { blacklist.push(mentioned.replace(/[^0-9]/g, '')); reply("🚫 Added."); }
                    else if (args[0] === 'del') { blacklist = blacklist.filter(u => u !== mentioned.replace(/[^0-9]/g, '')); reply("✅ Removed."); }
                    break;

                case 'antilink':
                case 'antibot':
                case 'antiwame':
                case 'antitagall':
                case 'antibadword':
                case 'antibadwordnokick':
                case 'antispam':
                case 'antifake':
                case 'antidelete':
                    global.db[command] = q === 'on';
                    reply(`🛡️ ${command.toUpperCase()} -> ${q.toUpperCase()}`);
                    break;

                case 'ping': reply("⚡ Online."); break;
                case 'bc':
                case 'broadcast':
                    if (!q) return reply("Text required.");
                    const groups = Object.keys(await client.groupFetchAllParticipating());
                    for (let i of groups) { await client.sendMessage(i, { text: `📢 *BROADCAST*\n\n${q}` }); }
                    reply(`✅ Sent to ${groups.length} groups.`);
                    break;
            }
        } catch (e) { console.error(e); }
    });
}
startHisoka();
