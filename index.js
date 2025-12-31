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
const qrcode = require('qrcode-terminal');

// 1. CLEAN START: Auto-delete old session to prevent loops
const sessionFolder = path.join(__dirname, 'session');
if (fs.existsSync(sessionFolder)) {
    console.log(chalk.yellow("🧹 Cleaning old session files for a fresh QR..."));
    fs.rmSync(sessionFolder, { recursive: true, force: true });
}

if (!fs.existsSync('./antilink.json')) {
    fs.writeFileSync('./antilink.json', JSON.stringify([]));
}

async function startHisoka() {
    console.log(chalk.blue("\n--- BOT STARTING (QR MODE) ---"));
    
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false, // We will handle this manually below
        browser: Browsers.macOS('Desktop'),
        auth: state
    });

    // 2. CONNECTION MONITOR
    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // Manual QR Display
        if (qr) {
            console.log(chalk.magenta("\n📸 NEW QR CODE DETECTED:"));
            console.log(chalk.white("Scan this with WhatsApp > Linked Devices > Link a Device\n"));
            qrcode.generate(qr, { small: true }); 
            console.log(chalk.cyan("\nTip: If the QR looks broken, zoom out (Ctrl + -) in your browser.\n"));
        }

        if (connection === "open") {
            console.log(chalk.green("\n✅ SUCCESS: CONNECTED TO WHATSAPP"));
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red(`⚠️ Connection closed. Reason: ${reason}`));
            
            // Restart if not a manual logout
            if (reason !== 401) {
                console.log(chalk.yellow("🔄 Restarting bot..."));
                startHisoka();
            } else {
                console.log(chalk.bgRed("❌ Logged out. Delete 'session' and restart manually."));
            }
        }
    });

    // 3. MESSAGE HANDLER
    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            let mek = chatUpdate.messages[0];
            if (!mek.message) return;
            // Ensure bot.js exists in your directory
            require("./bot")(client, mek, chatUpdate);
        } catch (err) {
            console.log(chalk.red("Error in messages: "), err);
        }
    });

    client.ev.on("creds.update", saveCreds);
}

// Start the process
startHisoka();

// 4. WEB SERVER (Health Check)
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(port, "0.0.0.0", () => {
    console.log(chalk.magenta(`📡 Server listening on port ${port}`));
});
