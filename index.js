require("dotenv").config();
const {
    default: goutamConnect,
    useMultiFileAuthState,
    Browsers,
    delay,
    disconnectReason
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require('path');
const pino = require("pino");
const chalk = require("chalk");
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
const port = process.env.PORT || 8080;

// --- 1. SESSION CLEANER (FIXES 405 ERROR) ---
const sessionPath = path.join(__dirname, 'session');
if (fs.existsSync(sessionPath)) {
    console.log(chalk.yellow("🧹 Cleaning old session files to prevent 405 loop..."));
    fs.rmSync(sessionPath, { recursive: true, force: true });
}

async function startBot() {
    console.log(chalk.blue.bold("\n🚀 INITIALIZING GSS-BOTWA..."));

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false, // We handle this manually below
        // Browser identity changed to prevent WhatsApp rejection
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        auth: state,
        patchMessageBeforeSending: (message) => {
            const requiresPatch = !!(
                message.buttonsMessage ||
                message.templateMessage ||
                message.listMessage
            );
            if (requiresPatch) {
                message = {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadata: {},
                                deviceListMetadataVersion: 2,
                            },
                            ...message,
                        },
                    },
                };
            }
            return message;
        },
    });

    // --- 2. CONNECTION HANDLER ---
    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log(chalk.magenta.bold("\n📸 SCAN THE QR CODE BELOW:"));
            qrcode.generate(qr, { small: true });
            console.log(chalk.cyan("Note: Zoom out (Ctrl -) if the QR looks distorted.\n"));
        }

        if (connection === "open") {
            console.log(chalk.green.bold("\n✅ SUCCESS: BOT IS ONLINE AND CONNECTED"));
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red(`⚠️ Connection closed. Reason Code: ${reason}`));

            // If the code is 405 or 401, we need a full restart
            if (reason === 405 || reason === 401) {
                console.log(chalk.red("CRITICAL ERROR: Browser rejected. Restarting fresh..."));
                startBot();
            } else {
                startBot();
            }
        }
    });

    client.ev.on("creds.update", saveCreds);

    // --- 3. MESSAGE HANDLER ---
    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            
            // This links to your bot.js file logic
            // Ensure bot.js exists in your main folder!
            if (fs.existsSync('./bot.js')) {
                require("./bot")(client, mek, chatUpdate);
            }
        } catch (err) {
            console.log(chalk.red("Error in message handler: "), err);
        }
    });

    return client;
}

// --- 4. START & HEALTH CHECK ---
startBot().catch(err => console.log("Startup Error: ", err));

app.get('/', (req, res) => res.send('Bot is Running!'));
app.listen(port, "0.0.0.0", () => {
    console.log(chalk.green(`📡 Health Check Server running on port ${port}`));
});
