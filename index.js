require("dotenv").config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require('path');
const pino = require("pino");
const chalk = require("chalk");
const express = require('express');

const app = express();
const port = process.env.PORT || 8080;
const sessionPath = path.join(__dirname, 'session');

// 📝 CONFIGURATION
const phoneNumber = "212701458617"; 
global.owner = ["212701458617"]; // Added for owner verification

// Prevent EADDRINUSE by checking if server is already running
if (!global.serverStarted) {
    app.get('/', (req, res) => res.send('Bot is Running'));
    app.listen(port, "0.0.0.0", () => {
        console.log(chalk.green(`🌐 Web Server running on port ${port}`));
    });
    global.serverStarted = true;
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const client = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
    });

    // --- 🔑 PAIRING CODE LOGIC ---
    if (!client.authState.creds.registered) {
        console.log(chalk.cyan.bold(`\n📲 Requesting Pairing Code for: ${phoneNumber}...`));
        await delay(5000); // Increased delay for stability
        try {
            const code = await client.requestPairingCode(phoneNumber);
            console.log(chalk.white.bgMagenta.bold(`\n YOUR PAIRING CODE: ${code} \n`));
            console.log(chalk.yellow("Step 1: Open WhatsApp > Linked Devices"));
            console.log(chalk.yellow("Step 2: Link a Device > Link with phone number instead"));
            console.log(chalk.yellow(`Step 3: Type the code above [${code}] into your phone.\n`));
        } catch (error) {
            console.error("Failed to request pairing code:", error);
        }
    }

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log(chalk.green.bold("\n✅ SUCCESS: BOT IS ONLINE"));
            // Self-message to confirm ownership
            await client.sendMessage(phoneNumber + "@s.whatsapp.net", { text: "🛡️ Bot is now connected and you are recognized as Owner." });
        }
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(chalk.red(`Connection closed. Reconnecting: ${shouldReconnect}`));
            if (shouldReconnect) startBot();
        }
    });

    client.ev.on("creds.update", saveCreds);

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;

            // Log messages to see if they arrive
            const mText = mek.message.conversation || mek.message.extendedTextMessage?.text;
            console.log(chalk.blue(`📩 Message from ${mek.key.remoteJid}: ${mText}`));

            // Safe Handler execution
            if (fs.existsSync('./bot.js')) {
                const handler = require("./bot");
                if (typeof handler === 'function') {
                    handler(client, mek, chatUpdate);
                } else if (handler.default && typeof handler.default === 'function') {
                    handler.default(client, mek, chatUpdate);
                }
            }
        } catch (err) {
            console.log(chalk.red("Error in message handler:"), err);
        }
    });

    return client;
}

// Start with error handling
startBot().catch(err => {
    console.error("Critical error starting bot:", err);
});
