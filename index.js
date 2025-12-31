require("dotenv").config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    Browsers,
    DisconnectReason,
    fetchLatestBaileysVersion
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

// Clean session on critical failures
function clearSession() {
    if (fs.existsSync(sessionPath)) {
        console.log(chalk.yellow("🧹 Clearing session to fix connection..."));
        fs.rmSync(sessionPath, { recursive: true, force: true });
    }
}

async function startBot() {
    console.log(chalk.blue.bold("\n🚀 INITIALIZING GSS-BOTWA..."));

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const client = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false, // Custom handling below
        browser: Browsers.ubuntu('Chrome'), 
        auth: state,
    });

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Clear the console so the QR is at the very top
            console.clear(); 
            console.log(chalk.magenta.bold("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
            console.log(chalk.magenta.bold("📸 SCAN THE QR CODE BELOW:"));
            console.log(chalk.magenta.bold("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
            
            // Using small: false makes the QR code significantly larger
            // This prevents lines from merging in the Koyeb console.
            qrcode.generate(qr, { small: false });
            
            console.log(chalk.cyan("\n💡 TIP: If it's too big, use (Ctrl and -) to zoom out."));
            console.log(chalk.cyan("💡 TIP: Ensure your terminal is in DARK MODE.\n"));
        }

        if (connection === "open") {
            console.log(chalk.green.bold("\n✅ SUCCESS: BOT IS ONLINE"));
        }

        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode === 405 || statusCode === 401) {
                clearSession();
                setTimeout(() => startBot(), 5000);
            } else if (statusCode !== DisconnectReason.loggedOut) {
                startBot();
            }
        }
    });

    client.ev.on("creds.update", saveCreds);

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;
            if (fs.existsSync('./bot.js')) {
                require("./bot")(client, mek, chatUpdate);
            }
        } catch (err) {
            console.log(chalk.red("Error: "), err);
        }
    });

    return client;
}

startBot().catch(err => console.log(err));
app.get('/', (req, res) => res.send('Bot Active'));
app.listen(port, "0.0.0.0");
