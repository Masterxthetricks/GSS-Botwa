require("dotenv").config();
const fs = require("fs");
const path = require('path');
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;
const {
    default: goutamConnect,
    useMultiFileAuthState,
    Browsers,
} = require("@whiskeysockets/baileys");
const chalk = require("chalk");
const pino = require("pino");
const qrcode = require('qrcode-terminal'); // Matches your package.json

// 1. CLEAR SESSION TO PREVENT 405/401 ERRORS
const sessionPath = path.join(__dirname, 'session');
if (fs.existsSync(sessionPath)) {
    console.log(chalk.yellow("🧹 Clearing old session for fresh QR..."));
    fs.rmSync(sessionPath, { recursive: true, force: true });
}

async function startBot() {
    console.log(chalk.blue("\n--- INITIALIZING BOT ---"));
    
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false, // We handle this manually for Koyeb
       browser: Browsers.ubuntu('Chrome'), 
        auth: state
     });

    // 2. CONNECTION HANDLER
    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log(chalk.magenta("\n📸 SCAN THE QR CODE BELOW:"));
            // This 'small: true' is vital for Koyeb logs
            qrcode.generate(qr, { small: true });
            console.log(chalk.cyan("Note: Zoom out your browser (Ctrl -) if the QR looks messy.\n"));
        }

        if (connection === "open") {
            console.log(chalk.green("\n✅ SUCCESS: BOT IS LINKED AND ONLINE"));
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red(`⚠️ Connection closed. Code: ${reason}`));
            // Auto-restart logic
            if (reason !== 401) {
                console.log(chalk.yellow("🔄 Restarting..."));
                startBot();
            }
        }
    });

    client.ev.on("creds.update", saveCreds);

    // 3. MESSAGE HANDLER
    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            let mek = chatUpdate.messages[0];
            if (!mek.message) return;
            // This links to your bot.js file
            require("./bot")(client, mek, chatUpdate);
        } catch (err) {
            console.log(chalk.red("Error in bot.js: "), err.message);
        }
    });
}

// 4. START
startBot().catch(err => console.log("Start Error: ", err));

// Health Check for Koyeb
app.get('/', (req, res) => res.send('Bot is Alive'));
app.listen(port, "0.0.0.0", () => console.log(`Server running on port ${port}`));
