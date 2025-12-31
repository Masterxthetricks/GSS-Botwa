require("dotenv").config();
const fs = require("fs");
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

// Clean session on start to ensure a fresh QR is generated
if (fs.existsSync('./session')) {
    fs.rmSync('./session', { recursive: true, force: true });
}

async function startHisoka() {
    console.log(chalk.blue("--- BOT STARTING (QR MODE) ---"));
    
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        printQRInTerminal: true, // This prints the QR in Koyeb logs
        browser: Browsers.macOS('Desktop'),
        auth: state
    });

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            let mek = chatUpdate.messages[0];
            if (!mek.message) return;
            require("./bot")(client, mek, chatUpdate);
        } catch (err) { console.log(err); }
    });

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "open") {
            console.log(chalk.green("✅ SUCCESS: CONNECTED TO WHATSAPP"));
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== 401) startHisoka();
        }
    });

    client.ev.on("creds.update", saveCreds);
}

startHisoka();

app.get('/', (req, res) => res.send('Bot Online'));
app.listen(port, "0.0.0.0", () => console.log(`Server on port ${port}`));
