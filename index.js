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

    const credsPath = path.join(sessionPath, 'creds.json');
    if (fs.existsSync(sessionPath) && !fs.existsSync(credsPath)) {
        console.log(chalk.yellow("Cleaning incomplete session data..."));
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

    if (!client.authState.creds.registered) {
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
        const { connection, lastDisconnect } = update; 
        if (connection === "open") {
            console.log(chalk.green.bold("\n✅ SUCCESS: CONNECTED TO WHATSAPP"));
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red(`⚠️ Connection closed (Code: ${reason}).`));
            if (reason !== 401) { 
                await delay(10000);
                startHisoka();
            }
        }
    });

    client.ev.on("creds.update", saveCreds);

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;

            const from = mek.key.remoteJid;
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || "").trim();
            const sender = mek.key.participant || mek.key.remoteJid;

            // 🔍 SUPER-LOG: This shows us exactly how the sender ID looks
            console.log(chalk.magenta(`[DEBUG] Message from: ${sender} | Content: ${body}`));

            // Updated Owner Check: Looks for your number anywhere in that ID
            const isOwner = global.owner.some(num => sender.includes(num));

            if (body.startsWith(".ping")) {
                await client.sendMessage(from, { text: "Bot is Online! 🚀" }, { quoted: mek });
            }

            if (body.startsWith(".owner")) {
                if (!isOwner) {
                    await client.sendMessage(from, { text: `❌ Denied. Your ID is: ${sender}` }, { quoted: mek });
                } else {
                    await client.sendMessage(from, { text: "✅ Access Granted, Commander." }, { quoted: mek });
                }
            }
        } catch (err) { console.log(err); }
    });
}

startHisoka().catch(err => console.log(err));
