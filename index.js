require("dotenv").config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    Browsers,
    delay,
    fetchLatestBaileysVersion
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
const phoneNumber = "YOUR_PHONE_NUMBER_HERE"; // Example: "2348012345678"

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const client = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        auth: state,
    });

    // --- 🔑 PAIRING CODE LOGIC ---
    if (!client.authState.creds.registered) {
        if (!phoneNumber) {
            console.log(chalk.red.bold("❌ ERROR: No phone number provided in index.js for pairing!"));
        } else {
            console.log(chalk.cyan.bold(`\n📲 Requesting Pairing Code for: ${phoneNumber}...`));
            await delay(3000); // Wait for socket to stabilize
            const code = await client.requestPairingCode(phoneNumber);
            console.log(chalk.white.bgMagenta.bold(`\n YOUR PAIRING CODE: ${code} \n`));
            console.log(chalk.yellow("Step 1: Open WhatsApp > Linked Devices"));
            console.log(chalk.yellow("Step 2: Link a Device > Link with phone number instead"));
            console.log(chalk.yellow(`Step 3: Type the code above [${code}] into your phone.\n`));
        }
    }

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log(chalk.green.bold("\n✅ SUCCESS: BOT IS ONLINE"));
        }
        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode !== 401) startBot();
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
            console.log(err);
        }
    });

    return client;
}

startBot().catch(err => console.log(err));
app.get('/', (req, res) => res.send('Pairing Mode Active'));
app.listen(port, "0.0.0.0");
