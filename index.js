require("dotenv").config();
const { 
    default: goutamConnect, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    delay,
    DisconnectReason,
    makeCacheableSignalKeyStore
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
app.get('/', (req, res) => res.send('GSS-BETA Status: Online'));
app.listen(port, "0.0.0.0");

async function startHisoka() {
    // 🛡️ SESSION PURGE (Fixes Pairing Loop)
    if (fs.existsSync(path.join(sessionPath, 'creds.json'))) {
        try {
            const creds = JSON.parse(fs.readFileSync(path.join(sessionPath, 'creds.json')));
            if (!creds.registered) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                fs.mkdirSync(sessionPath);
            }
        } catch (e) { fs.rmSync(sessionPath, { recursive: true, force: true }); fs.mkdirSync(sessionPath); }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const client = goutamConnect({
        version,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        connectTimeoutMs: 120000,
        maxRetries: 20
    });

    // 🔑 STABILIZED PAIRING
    if (!client.authState.creds.registered) {
        console.log(chalk.yellow("Waiting 15s for cloud stabilization..."));
        await delay(15000); 
        try {
            const code = await client.requestPairingCode("212701458617");
            console.log(chalk.black.bgMagenta(`\n\n 📲 PAIRING CODE: ${code} \n\n`));
        } catch (err) { setTimeout(() => startHisoka(), 10000); return; }
    }

    client.ev.on("creds.update", saveCreds);

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startHisoka();
        } else if (connection === "open") {
            console.log(chalk.green.bold("\n✅ GSS-BETA LINKED!\n"));
            await client.sendMessage("212701458617@s.whatsapp.net", { text: "🚀 *SYSTEM ONLINE*" });
        }
    });

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;
            const from = mek.key.remoteJid;
            const sender = mek.key.participant || mek.key.remoteJid;
            const isOwner = global.owner.includes(sender.split('@')[0]);
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || "").trim();

            // 🛡️ ANTILINK LOGIC
            if (global.db.antilink && body.includes("chat.whatsapp.com") && !isOwner) {
                await client.sendMessage(from, { delete: mek.key });
                await client.groupParticipantsUpdate(from, [sender], "remove");
            }

            if (!body.startsWith(".")) return;
            const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
            const args = body.trim().split(/ +/).slice(1);

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

┏━━━〔 *Elite Commands* 〕━━━┓
┃ .add | .kick | .kickall
┃ .mute | .unmute | .quoted
┃ .promote | .demote | .vv
┃ .antilink | .antibot | .antiwame
┃ .antibadword | .antitagall
┃ .settings | .ping | .status
┗━━━━━━━━━━━━━━┛`;
                    await client.sendMessage(from, { video: { url: "https://media.giphy.com/media/vA07zct9tyTLO/giphy.gif" }, caption: menuMsg, gifPlayback: true, mimetype: 'video/mp4' }, { quoted: mek });
                    break;

                case 'settings':
                    if (!isOwner) return;
                    if (!args[0]) {
                        let st = `⚙️ *SYSTEM STATUS*\n\n`;
                        for (let key in global.db) if (typeof global.db[key] === 'boolean') st += `• ${key.toUpperCase()}: ${global.db[key] ? '✅' : '❌'}\n`;
                        return client.sendMessage(from, { text: st }, { quoted: mek });
                    }
                    let feat = args[0].toLowerCase();
                    if (global.db.hasOwnProperty(feat)) {
                        global.db[feat] = args[1] === 'on';
                        client.sendMessage(from, { text: `🛡️ ${feat.toUpperCase()} set to ${global.db[feat] ? 'ON' : 'OFF'}` }, { quoted: mek });
                    }
                    break;

                case 'kick':
                    if (!isOwner) return;
                    let users = mek.message.extendedTextMessage?.contextInfo?.mentionedJid[0] || args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                    await client.groupParticipantsUpdate(from, [users], "remove");
                    break;

                case 'ping': client.sendMessage(from, { text: "⚡ Status: Active" }, { quoted: mek }); break;
            }
        } catch (e) { console.log(e); }
    });
}
startHisoka();
