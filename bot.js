require("dotenv").config();
const fs = require("fs");
const path = require('path');
const express = require('express');
const {
    default: goutamConnect,
    useMultiFileAuthState,
    Browsers,
    delay,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const chalk = require("chalk");
const pino = require("pino");
const util = require("util");

const app = express();
const port = process.env.PORT || 8080;
const sessionPath = path.join(__dirname, 'session');

// 📝 CONFIGURATION
const phoneNumber = "212701458617"; 
global.owner = ["212701458617"]; 

// --- 🌐 WEB SERVER (Prevents Koyeb Port Error) ---
if (!global.serverStarted) {
    app.get('/', (req, res) => res.send('Bot Status: Online & Healthy'));
    app.listen(port, "0.0.0.0", () => console.log(chalk.green(`🌐 Server running on port: ${port}`)));
    global.serverStarted = true;
}

async function startHisoka() {
    console.log(chalk.blue.bold("\n--- 🤖 WHATSAPP BOT STARTING ---"));
    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const client = goutamConnect({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser:["Ubuntu", "Chrome", "110.0.5481.177"],
        auth: state
    });

    // --- 🔑 PAIRING CODE LOGIC ---
    if (!client.authState.creds.registered) {
        console.log(chalk.cyan.bold(`\n📲 Requesting Pairing Code for: ${phoneNumber}...`));
        await delay(5000); 
        try {
            const code = await client.requestPairingCode(phoneNumber);
            console.log(chalk.white.bgMagenta.bold(`\n YOUR PAIRING CODE: ${code} \n`));
        } catch (err) {
            console.log(chalk.red("Pairing error: "), err);
        }
    }

    // --- 📡 CONNECTION UPDATES ---
  client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log(chalk.green.bold("\n✅ SUCCESS: CONNECTED TO WHATSAPP"));
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red(`⚠️ Connection closed (Code: ${reason}).`));
            
            // If the code is 440, wait longer before restarting to avoid a loop
            if (reason === 440) {
                console.log(chalk.yellow("Stream Conflict detected. Waiting 15 seconds..."));
                await delay(15000);
                startHisoka();
            } else if (reason !== 401) {
                startHisoka();
            }
        }
    });

    client.ev.on("creds.update", saveCreds);

    // --- 📩 MESSAGE HANDLER (Combined bot.js logic) ---
    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;

            const from = mek.key.remoteJid;
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || "").trim();
            const isCmd = body.startsWith(".");
            const command = isCmd ? body.slice(1).trim().split(/ +/).shift().toLowerCase() : "";
            const args = body.trim().split(/ +/).slice(1);

            // 👑 OWNER VERIFICATION
            const sender = mek.key.participant || mek.key.remoteJid;
            const isOwner = global.owner.some(num => sender.includes(num.replace(/\D/g, '')));

            if (!isCmd) return;

            console.log(chalk.yellow(`[CMD] ${command} from ${sender}`));

            switch (command) {
                case 'menu':
                case 'help':
                    await client.sendMessage(from, { 
                        text: `*🤖 BOT MENU*\n\n*Public:* .ping\n*Owner:* .owner, .broadcast, .eval` 
                    }, { quoted: mek });
                    break;

                case 'ping':
                    await client.sendMessage(from, { text: "Pong! 🏓" }, { quoted: mek });
                    break;

                case 'owner':
                    if (!isOwner) return await client.sendMessage(from, { text: "❌ Access Denied. Only the commander can use this." });
                    await client.sendMessage(from, { text: "✅ Access Granted. You are recognized as the Owner." });
                    break;

                case 'broadcast':
                    if (!isOwner) return;
                    const bcText = args.join(" ");
                    if (!bcText) return await client.sendMessage(from, { text: "Provide text after the command." });
                    await client.sendMessage(from, { text: `📢 *BROADCAST*\n\n${bcText}` });
                    break;

                case 'eval':
                    if (!isOwner) return;
                    try {
                        let evaled = await eval(args.join(" "));
                        if (typeof evaled !== "string") evaled = util.inspect(evaled);
                        await client.sendMessage(from, { text: evaled });
                    } catch (err) {
                        await client.sendMessage(from, { text: String(err) });
                    }
                    break;
            }
        } catch (err) { 
            console.log(chalk.red("Error in handler: "), err); 
        }
    });
}

startHisoka().catch(err => console.log(chalk.red("Start error: "), err));
