require("dotenv").config();
const fs = require("fs");
const path = require('path');
const express = require('express');
const {
    default: goutamConnect,
    useMultiFileAuthState,
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
    app.get('/', (req, res) => res.send('Bot Status: Online'));
    app.listen(port, "0.0.0.0", () => console.log(chalk.green(`🌐 Server running on port: ${port}`)));
    global.serverStarted = true;
}

async function startHisoka() {
    console.log(chalk.blue.bold("\n--- 🤖 WHATSAPP BOT STARTING ---"));

    // 🧹 AUTO-CLEAN: Deletes old broken session files before starting
    if (fs.existsSync(sessionPath)) {
        console.log(chalk.yellow("Cleaning old session data..."));
        fs.rmSync(sessionPath, { recursive: true, force: true });
    }
    
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const client = goutamConnect({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        // ✅ High-stability browser identity
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"], 
        auth: state
    });

    // --- 🔑 PAIRING CODE LOGIC ---
    if (!client.authState.creds.registered) {
        console.log(chalk.cyan.bold(`\n📲 Requesting Pairing Code for: ${phoneNumber}...`));
        await delay(7000); // Wait for connection to stabilize
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
            
            // Avoid loops if logged out or stream conflict
            if (reason === 401) {
                console.log(chalk.bgRed("LOGGED OUT: Please delete session folder and re-pair."));
            } else {
                await delay(5000);
                startHisoka();
            }
        }
    });

    client.ev.on("creds.update", saveCreds);

    // --- 📩 MESSAGE HANDLER ---
    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;

            const from = mek.key.remoteJid;
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || "").trim();
            const isCmd = body.startsWith(".");
            const command = isCmd ? body.slice(1).trim().split(/ +/).shift().toLowerCase() : "";
            const args = body.trim().split(/ +/).slice(1);

            const sender = mek.key.participant || mek.key.remoteJid;
            const isOwner = global.owner.some(num => sender.includes(num.replace(/\D/g, '')));

            if (!isCmd) return;

            switch (command) {
                case 'menu':
                case 'ping':
                    await client.sendMessage(from, { text: "Bot is Online! 🚀" }, { quoted: mek });
                    break;
                case 'owner':
                    if (!isOwner) return await client.sendMessage(from, { text: "❌ Denied." });
                    await client.sendMessage(from, { text: "✅ Confirmed: You are the Owner." });
                    break;
            }
        } catch (err) { console.log(err); }
    });
}

startHisoka().catch(err => console.log(err));
