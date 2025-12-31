require("dotenv").config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    Browsers,
    delay,
    DisconnectReason,
    fetchLatestBaileysVersion // Critical for fixing 405
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require('path');
const pino = require("pino");
const chalk = require("chalk");
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
const port = process.env.PORT || 8080;
const sessionPath = path.join(__dirname, 'session');

// --- 1. SESSION CLEANER ---
// If the bot gets stuck in a 405 loop, we clear the folder to force a new QR
function clearSession() {
    if (fs.existsSync(sessionPath)) {
        console.log(chalk.yellow("🧹 Clearing corrupted session to bypass 405..."));
        fs.rmSync(sessionPath, { recursive: true, force: true });
    }
}

async function startBot() {
    console.log(chalk.blue.bold("\n🚀 INITIALIZING GSS-BOTWA..."));

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    // --- 2. GET LATEST WA VERSION ---
    // This tells WhatsApp we are using the most current web client
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(chalk.cyan(`📡 Using WA Version: ${version.join('.')} (Latest: ${isLatest})`));

    const client = makeWASocket({
        version, // Dynamic versioning bypasses 405
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        // Using a generic Linux browser signature
        browser: Browsers.ubuntu('Chrome'), 
        auth: state,
    });

    // --- 3. CONNECTION HANDLER ---
    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log(chalk.magenta.bold("\n📸 SCAN THE QR CODE BELOW:"));
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log(chalk.green.bold("\n✅ SUCCESS: BOT IS ONLINE"));
        }

        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red(`⚠️ Connection closed. Code: ${statusCode}`));

            if (statusCode === 405 || statusCode === 401) {
                console.log(chalk.red("CRITICAL: 405 Detected. Resetting session in 5s..."));
                clearSession();
                setTimeout(() => startBot(), 5000);
            } else if (statusCode !== DisconnectReason.loggedOut) {
                startBot();
            }
        }
    });

    client.ev.on("creds.update", saveCreds);

    // --- 4. MESSAGE HANDLER ---
    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;
            
            // Log incoming message for debugging
            console.log(chalk.gray(`📩 Message from ${mek.key.remoteJid}`));

            if (fs.existsSync('./bot.js')) {
                require("./bot")(client, mek, chatUpdate);
            }
        } catch (err) {
            console.log(chalk.red("Error: "), err);
        }
    });

    return client;
}

// Start & Health Check
startBot().catch(err => console.log(err));
app.get('/', (req, res) => res.send('GSS-Bot is Active'));
app.listen(port, "0.0.0.0");
