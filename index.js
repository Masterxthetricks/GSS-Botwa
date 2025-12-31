require("dotenv").config();
const fs = require("fs");
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;
const {
    default: goutamConnect,
    useMultiFileAuthState,
    Browsers,
    fetchLatestBaileysVersion, // Added this
} = require("@whiskeysockets/baileys");
const chalk = require("chalk");
const pino = require("pino");

const PHONE_NUMBER = "212701458617"; 

async function startHisoka() {
    console.log(chalk.blue("--- BOT STARTING ---"));
    
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    
    // FIX for 405 error: Get latest version
    const { version } = await fetchLatestBaileysVersion();

    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: Browsers.macOS('Desktop'),
        version: version, // Apply the latest version
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

        if (connection === "connecting" && !client.authState.creds.registered) {
            console.log(chalk.yellow(`📢 Requesting pairing code for: ${PHONE_NUMBER}`));
            setTimeout(async () => {
                try {
                    let code = await client.requestPairingCode(PHONE_NUMBER);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(chalk.black.bgGreen(`\n\n --- PAIRING CODE: ${code} --- \n`));
                } catch (e) {
                    console.log(chalk.red("❌ Pairing error: "), e.message);
                }
            }, 15000); 
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red(`⚠️ Connection closed. Reason: ${reason}`));
            if (reason !== 401) startHisoka();
        }
    });

    client.ev.on("creds.update", saveCreds);
}

startHisoka();

app.get('/', (req, res) => res.send('Bot Online'));
app.listen(port, "0.0.0.0", () => console.log(`Server on port ${port}`));
