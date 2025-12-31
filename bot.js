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

// Clean session on start
const sessionPath = path.join(__dirname, 'session');
if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
}

async function startHisoka() {
    console.log(chalk.blue("\n--- BOT STARTING ---"));
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./session');

        const client = goutamConnect({
            logger: pino({ level: "silent" }),
            printQRInTerminal: false,
            browser: Browsers.macOS('Desktop'),
            auth: state
        });

        client.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log(chalk.magenta("\n📸 QR CODE DETECTED:"));
                try {
                    qrcode.generate(qr, { small: true });
                } catch (qrErr) {
                    console.log("Error displaying QR: ", qrErr);
                }
            }

            if (connection === "open") {
                console.log(chalk.green("\n✅ CONNECTED TO WHATSAPP"));
            }

            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log(chalk.red(`⚠️ Connection closed. Code: ${reason}`));
                if (reason !== 401) startHisoka();
            }
        });

        client.ev.on("creds.update", saveCreds);

        client.ev.on("messages.upsert", async (chatUpdate) => {
            try {
                let mek = chatUpdate.messages[0];
                if (!mek.message) return;
                require("./bot")(client, mek, chatUpdate);
            } catch (err) { console.log(err); }
        });

    } catch (criticalErr) {
        console.log(chalk.bgRed("CRITICAL ERROR:"), criticalErr);
    }
}

startHisoka();

app.get('/', (req, res) => res.send('Bot Active'));
app.listen(port, "0.0.0.0", () => console.log(`Server: ${port}`));
