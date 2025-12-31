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

// --- CONFIGURATION ---
const PHONE_NUMBER = "212701458617"; 
// ---------------------

if (!fs.existsSync('./antilink.json')) {
    fs.writeFileSync('./antilink.json', JSON.stringify([]));
}

async function startHisoka() {
    console.log(chalk.blue("--- BOT STARTING ---"));
    
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        auth: state
    });

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            let mek = chatUpdate.messages[0];
            if (!mek.message) return;
            require("./bot")(client, mek, chatUpdate);
        } catch (err) {
            console.log(chalk.red("Error in messages.upsert: "), err);
        }
    });

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "open") {
            console.log(chalk.green("✅ CONNECTED TO WHATSAPP"));
        }

        if (connection === "connecting") {
            console.log(chalk.cyan("🔄 Connecting to WhatsApp..."));
        }

        if (connection === "connecting" && !client.authState.creds.registered) {
            console.log(chalk.yellow(`📢 Requesting pairing code for: ${PHONE_NUMBER}`));
            
            // 20-second delay to prevent "Connection Failure"
            setTimeout(async () => {
                try {
                    let code = await client.requestPairingCode(PHONE_NUMBER);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(chalk.black.bgGreen(`\n\n  --- YOUR PAIRING CODE: ${code} ---  \n`));
                } catch (e) {
                    console.log(chalk.red("❌ Pairing error: "), e.message);
                }
            }, 20000); 
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red(`⚠️ Connection closed. Reason Code: ${reason}`));
            
            // Restart if it wasn't a manual logout
            if (reason !== 401) {
                console.log(chalk.yellow("🔄 Restarting bot..."));
                startHisoka();
            }
        }
    });

    client.ev.on("creds.update", saveCreds);
}

startHisoka();

app.get('/', (req, res) => res.send('Bot Online'));
app.listen(port, "0.0.0.0", () => {
    console.log(chalk.magenta(`📡 Server running on port ${port}`));
});
