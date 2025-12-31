require("dotenv").config();
const fs = require("fs");
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;
const {
    default: goutamConnect,
    useMultiFileAuthState,
    Browsers,
    pino,
} = require("@whiskeysockets/baileys");
const chalk = require("chalk");

// --- CONFIGURATION ---
const PHONE_NUMBER = "212701458617"; // Your number is now fixed here
// ---------------------

if (!fs.existsSync('./antilink.json')) {
    fs.writeFileSync('./antilink.json', JSON.stringify([]));
}

async function startHisoka() {
    console.log(chalk.blue("--- BOT STARTING ---"));
    
    // Auth State
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    const client = goutamConnect({
        logger: require("pino")({ level: "silent" }),
        printQRInTerminal: false, // We are using pairing code
        browser: Browsers.ubuntu('Chrome'),
        auth: state
    });

    // Handle Incoming Messages
    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            let mek = chatUpdate.messages[0];
            if (!mek.message) return;
            // This calls your bot.js logic
            require("./bot")(client, mek, chatUpdate);
        } catch (err) {
            console.log(chalk.red("Error in messages.upsert: "), err);
        }
    });

    // Handle Connection Updates
    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "open") {
            console.log(chalk.green("✅ CONNECTED TO WHATSAPP SUCCESSFULY"));
        }

        if (connection === "connecting") {
            console.log(chalk.cyan("🔄 Connecting to WhatsApp..."));
        }

        // REQUEST PAIRING CODE LOGIC
        if (connection === "connecting" && !client.authState.creds.registered) {
            console.log(chalk.yellow(`📢 Requesting pairing code for: ${PHONE_NUMBER}`));
            
            // Wait 10 seconds to ensure the socket is ready
            setTimeout(async () => {
                try {
                    let code = await client.requestPairingCode(PHONE_NUMBER);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(chalk.black.bgGreen(`\n\n  --- YOUR PAIRING CODE: ${code} ---  \n`));
                    console.log(chalk.white("Steps: Open WhatsApp > Linked Devices > Link with Phone Number > Enter the code above.\n"));
                } catch (e) {
                    console.log(chalk.red("❌ Pairing error: "), e.message);
                }
            }, 10000);
        }

        if (connection === "close") {
            const shouldRestart = lastDisconnect?.error?.output?.statusCode !== 401;
            console.log(chalk.red(`⚠️ Connection closed. Reason: ${lastDisconnect?.error?.message}`));
            if (shouldRestart) {
                console.log(chalk.yellow("🔄 Restarting bot..."));
                startHisoka();
            } else {
                console.log(chalk.bgRed("❌ Session logged out. Delete 'session' folder and restart."));
            }
        }
    });

    client.ev.on("creds.update", saveCreds);
}

// Start the Bot
startHisoka();

// Web Server for Koyeb Health Checks
app.get('/', (req, res) => res.send('Bot Status: Online'));
app.listen(port, "0.0.0.0", () => {
    console.log(chalk.magenta(`📡 Health-check server running on port ${port}`));
});
