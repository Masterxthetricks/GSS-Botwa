require("dotenv").config();
const fs = require("fs");
const path = require('path');
const express = require('express');
const {
    default: goutamConnect,
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const chalk = require("chalk");
const pino = require("pino");

const app = express();
const port = process.env.PORT || 8080;
const sessionPath = path.join(__dirname, 'session');

// 📝 CONFIGURATION
const phoneNumber = "212701458617"; 
global.owner = ["212701458617"]; 

if (!global.serverStarted) {
    app.get('/', (req, res) => res.send('Bot Status: Online'));
    app.listen(port, "0.0.0.0", () => console.log(chalk.green(`🌐 Server running on port: ${port}`)));
    global.serverStarted = true;
}

async function startHisoka() {
    console.log(chalk.blue.bold("\n--- 🤖 WHATSAPP BOT STARTING ---"));

    // 🧹 SMART-CLEAN: Only wipes if the session is totally broken
    const credsPath = path.join(sessionPath, 'creds.json');
    if (fs.existsSync(sessionPath) && !fs.existsSync(credsPath)) {
        console.log(chalk.yellow("Cleaning incomplete session data to prevent 408 error..."));
        fs.rmSync(sessionPath, { recursive: true, force: true });
    }
    
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const client = goutamConnect({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"], 
        auth: state
    });

    // --- 🔑 STABILIZED PAIRING LOGIC ---
    if (!client.authState.creds.registered) {
        // Higher delay (15s) to ensure Koyeb network is fully ready
        console.log(chalk.cyan.bold(`\n📲 Waiting 15s for network stability before requesting code...`));
        await delay(15000); 
        
        try {
            const code = await client.requestPairingCode(phoneNumber);
            console.log(chalk.white.bgMagenta.bold(`\n YOUR PAIRING CODE: ${code} \n`));
            console.log(chalk.yellow("Type this into your phone NOW."));
        } catch (err) {
            console.log(chalk.red("Pairing request failed. Restarting..."));
            await delay(5000);
            startHisoka();
        }
    }

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect }
