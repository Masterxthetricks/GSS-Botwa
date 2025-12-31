require("dotenv").config();
const fs = require("fs");
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;
const {
    default: goutamConnect,
    useMultiFileAuthState,
    Browsers,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    getContentType,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const chalk = require("chalk");

// Ensure antilink file exists
if (!fs.existsSync('./antilink.json')) {
    fs.writeFileSync('./antilink.json', JSON.stringify([]));
}

async function startHisoka() {
    console.log(chalk.blue("--- BOT STARTING ---"));
    
    // FIXED: Added quotes around path
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        printQRInTerminal: !process.env.PAIRING_CODE,
        browser: Browsers.ubuntu('Chrome'),
        auth: state
    });

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            let mek = chatUpdate.messages[0];
            if (!mek.message) return;
            require("./bot")(client, mek, chatUpdate);
        } catch (err) {
            console.log(err);
        }
    });

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "open") {
            console.log(chalk.green("CONNECTED TO WHATSAPP"));
        }

        if (connection === "connecting" && process.env.PAIRING_CODE === "true" && !client.authState.creds.registered) {
            console.log(chalk.yellow("Requesting pairing code for: " + process.env.PHONE_NUMBER));
            setTimeout(async () => {
                try {
                    let code = await client.requestPairingCode(process.env.PHONE_NUMBER);
                    // FIXED: Added backticks for template literal
                    console.log(chalk.black.bgGreen(`\n--- YOUR CODE: ${code} ---\n`));
                } catch (e) {
                    console.log("Pairing error: ", e.message);
                }
            }, 7000);
        }

        if (connection === "close") {
            console.log(chalk.red("Connection closed. Restarting..."));
            startHisoka();
        }
    });

    client.ev.on("creds.update", saveCreds);
}

startHisoka();

// Web Server for Koyeb/Healthchecks
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(port, "0.0.0.0", () => {
    // FIXED: Added backticks for template literal
    console.log(`Server on port ${port}`);
});
