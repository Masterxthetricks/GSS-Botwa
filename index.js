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

global.owner = ["212701458617", "85182757527702"]; 
global.antilink = false;

if (!global.serverStarted) {
    app.get('/', (req, res) => res.send('Bot Online'));
    app.listen(port, "0.0.0.0", () => console.log(chalk.green(`🌐 Port: ${port}`)));
    global.serverStarted = true;
}

async function startHisoka() {
    console.log(chalk.blue.bold("\n--- BOT STARTING ---"));

    const credsPath = path.join(sessionPath, 'creds.json');
    if (fs.existsSync(sessionPath) && !fs.existsSync(credsPath)) {
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
        console.log(chalk.cyan("📲 Waiting for stability..."));
        await delay(15000); 
        try {
            const code = await client.requestPairingCode("212701458617");
            console.log(chalk.white.bgMagenta.bold(`\n CODE: ${code} \n`));
        } catch { startHisoka(); }
    }

    client.ev.on("creds.update", saveCreds);
    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update; 
        if (connection === "open") console.log(chalk.green("✅ CONNECTED"));
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== 401) { await delay(10000); startHisoka(); }
        }
    });

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;

            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || "").trim();
            const sender = mek.key.participant || mek.key.remoteJid;
            const isOwner = global.owner.some(num => sender.includes(num));

            console.log(chalk.magenta(`[DEBUG] From: ${sender} | Text: ${body}`));

            if (isGroup && global.antilink && body.includes("chat.whatsapp.com") && !isOwner) {
                const groupMetadata = await client.groupMetadata(from);
                const botNumber = client.user.id.split(':')[0] + '@s.whatsapp.net';
                const isBotAdmin = groupMetadata.participants.find(u => u.id === botNumber)?.admin;
                if (isBotAdmin) {
                    await client.groupParticipantsUpdate(from, [sender], "remove");
                    return;
                }
            }

            if (!body.startsWith("
