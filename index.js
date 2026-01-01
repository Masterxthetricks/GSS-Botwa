require("dotenv").config();
const { 
    default: goutamConnect, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    delay,
    DisconnectReason,
    jidDecode
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require('path');
const chalk = require("chalk");
const pino = require("pino");
const os = require('os');
const express = require('express');

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

const badWords = ["fuck", "porn", "pussy", "dick", "nigger", "bitch", "masisi", "bouzen", "langet manman w", "gyet manman w", "pouri", "santi", "bouda fon", "trip pouri", "kalanbe"]; 
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath);

// Koyeb Health Check
app.get('/', (req, res) => res.send('GSS-BETA System Online'));
app.listen(port, "0.0.0.0");

async function startHisoka() {
    // 🛡️ SESSION CLEANER: Fixes "Stuck on Generating" & "Invalid Code"
    if (fs.existsSync(path.join(sessionPath, 'creds.json'))) {
        const creds = JSON.parse(fs.readFileSync(path.join(sessionPath, 'creds.json')));
        if (!creds.registered && !creds.pairingCode) {
            console.log(chalk.red("Detected corrupted session. Purging for fresh start..."));
            fs.unlinkSync(path.join(sessionPath, 'creds.json'));
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const client = goutamConnect({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        mobile: false, // 🚀 FORCE DESKTOP LOGIC (Prevents Spinner)
        browser: ["GSS-BETA", "Chrome", "1.0.0"], 
        auth: state,
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000
    });

    // 🔑 OPTIMIZED PAIRING LOGIC
    if (!client.authState.creds.registered) {
        await delay(8000); 
        try {
            let phoneNumber = "212701458617".replace(/[^0-9]/g, '');
            const code = await client.requestPairingCode(phoneNumber);
            console.log(chalk.black.bgCyan(`\n\n 📲 YOUR PAIRING CODE: ${code} \n\n`));
        } catch (err) { 
            console.error("Pairing Error (Retrying...):", err);
            setTimeout(() => { startHisoka(); }, 15000);
            return;
        }
    }

    // 🛡️ CONNECTION RECOVERY
    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            let reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                startHisoka();
            }
        } else if (connection === "open") {
            console.log(chalk.green.bold("\n✅ SUCCESS: GSS-BETA IS LINKED!\n"));
            await client.sendMessage(global.owner[0] + "@s.whatsapp.net", { text: "🚀 *GSS-BETA SYSTEM ONLINE*" });
        }
    });

    client.ev.on("creds.update", saveCreds);

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            const from = mek.key.remoteJid;

            if (!global.deletedMessages[from]) global.deletedMessages[from] = [];
            global.deletedMessages[from].push(mek);
            if (global.deletedMessages[from].length > 50) global.deletedMessages[from].shift();

            if (mek.key.fromMe) return;

            const type = Object.keys(mek.message)[0];
            const sender = mek.key.participant || mek.key.remoteJid;
            const senderNumber = sender.split('@')[0];
            const isOwner = global.owner.includes(senderNumber);

            const body = (type === 'conversation') ? mek.message.conversation : 
                         (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : 
                         (type === 'imageMessage') ? mek.message.imageMessage.caption : 
                         (type === 'videoMessage') ? mek.message.videoMessage.caption : '';

            // Passive Security
            if (!isOwner && from.endsWith('@g.us')) {
                if (global.db.antibadword && badWords.some(word => body.toLowerCase().includes(word))) {
                    await client.sendMessage(from, { delete: mek.key });
                }
                if (global.db.antilink && (body.includes("chat.whatsapp.com") || (global.db.antiwame && body.includes("wa.me/")))) {
                    await client.sendMessage(from, { delete: mek.key });
                    await client.groupParticipantsUpdate(from, [sender], "remove");
                }
                if (global.db.antibot && (mek.key.id.startsWith('BAE5') || (mek.key.id.length < 20 && mek.key.id.startsWith('3EB0')))) {
                   await client.groupParticipantsUpdate(from, [sender], "remove");
                }
            }

            if (!body.startsWith(".")) return;
            const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(" ");

            const groupMetadata = from.endsWith('@g.us') ? await client.groupMetadata(from) : null;
            const participants = groupMetadata ? groupMetadata.participants : [];
            const botNumber = client.user.id.split(':')[0] + '@s.whatsapp.net';
            const isBotAdmin = participants.find(u => u.id === botNumber)?.admin ? true : false;
            const reply = (text) => client.sendMessage(from, { text: text }, { quoted: mek });

            switch (command) {
                case 'menu':
                    const uptime = process.uptime();
                    const h = Math.floor(uptime / 3600);
                    const m = Math.floor((uptime % 3600) / 60);
                    const s = Math.floor(uptime % 60);

                    // 🌅 YOUR RESTORED GSS-BETA MENU 🌇
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

┏━━━〔 *Elite Commands* 〕━━━┓
┃ .add | .kick | .kickall
┃ .mute | .unmute | .quoted
┃ .promote | .demote | .vv
┃ .antilink | .antibot | .antiwame
┃ .antibadword | .antitagall
┃ .settings | .ping | .status
┗━━━━━━━━━━━━━━┛`;

                    await client.sendMessage(from, { 
                        video: { url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3h6Z3RyejR6Z3RyejR6Z3RyejR6Z3RyejR6Z3RyejR6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/vA07zct9tyTLO/giphy.gif" }, 
                        caption: menuMsg, gifPlayback: true, mimetype: 'video/mp4' 
                    }, { quoted: mek });
                    break;

                case 'quoted':
                    if (!isOwner) return reply("❌ Elite Owner Only.");
                    if (!global.deletedMessages[from] || global.deletedMessages[from].length === 0) return reply("Cache empty.");
                    let lastMsg = global.deletedMessages[from][global.deletedMessages[from].length - 1];
                    await client.sendMessage(from, { forward: lastMsg }, { quoted: mek });
                    break;

                case 'add': case 'kick': case 'promote': case 'demote': case 'mute': 
                case 'unmute': case 'kickall': case 'antilink': case 'antibot': 
                case 'antiwame': case 'antitagall': case 'antibadword': case 'settings':
                    if (!isOwner) return reply("❌ Elite Owner Only.");
                    if (command === 'mute') {
                        if (!isBotAdmin) return reply("❌ Admin Required.");
                        await client.groupSettingUpdate(from, 'announcement');
                        reply("🔒 Group Locked.");
                    } else if (command === 'unmute') {
                        if (!isBotAdmin) return reply("❌ Admin Required.");
                        await client.groupSettingUpdate(from, 'not_announcement');
                        reply("🔓 Group Opened.");
                    } else if (command === 'settings') {
                        let status = `⚙️ *ELITE SYSTEM STATUS*\n\n`;
                        for (let key in global.db) { 
                            if (typeof global.db[key] === 'boolean') status += `• ${key.toUpperCase()}: ${global.db[key] ? '✅' : '❌'}\n`; 
                        }
                        reply(status);
                    } else if (global.db.hasOwnProperty(command)) {
                        global.db[command] = q.toLowerCase() === 'on';
                        reply(`🛡️ ${command.toUpperCase()}: ${global.db[command] ? 'ON' : 'OFF'}`);
                    } else if (['add', 'kick', 'promote', 'demote'].includes(command)) {
                        if (!isBotAdmin) return reply("❌ Admin Required.");
                        let t = mek.message.extendedTextMessage?.contextInfo?.mentionedJid[0] || (q.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                        await client.groupParticipantsUpdate(from, [t], command === 'kick' ? 'remove' : command === 'add' ? 'add' : command);
                        reply(`✅ ${command} done.`);
                    }
                    break;

                case 'ping': reply("⚡ Status: Active"); break;
                case 'status': reply(`RAM: ${(os.freemem()/1024/1024/1024).toFixed(2)}GB Free`); break;
            }
        } catch (e) { console.error(e); }
    });
}

startHisoka().catch(e => console.log(e));
