require("dotenv").config();
const { 
    default: goutamConnect, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore, 
    downloadContentFromMessage, 
    delay 
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require('path');
const chalk = require("chalk");
const pino = require("pino");
const os = require('os');
const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 8080;
const sessionPath = path.join(__dirname, 'session');

// 🛡️ SESSION WIPE: Deletes old files so the pairing code is ALWAYS fresh
if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
}
fs.mkdirSync(sessionPath);

// 📝 CONFIGURATION & DATABASE
global.owner = ["212701458617", "85182757527702"]; 
global.db = {
    antilink: false,
    antibadword: false,
    antitagall: false
};

// 🚫 BAD WORDS LIST
const badWords = ["fuck you", "djol santi", "pussy", "bouda santi", "bitch", "masisi", "bouzen", "langet manman w", "santi kk", "gyet manman w", "pouri", "bouda fon", "trip pouri", "koko santi", "kalanbe"];

const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

app.get('/', (req, res) => res.send('GSS-BETA Status: Active'));
app.listen(port, "0.0.0.0");

async function startHisoka() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        browser: ["Chrome (Linux)", "GSS-BETA", "1.0.0"],
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        connectTimeoutMs: 120000
    });

    // 📲 PAIRING CODE LOGIC
    if (!client.authState.creds.registered) {
        await delay(10000); 
        try {
            const code = await client.requestPairingCode("212701458617");
            console.log(chalk.black.bgMagenta(`\n\n 📲 PAIRING CODE: ${code} \n\n`));
        } catch (err) { 
            console.error("Pairing Error, retrying...", err);
            setTimeout(() => startHisoka(), 10000); 
            return; 
        }
    }

    client.ev.on("creds.update", saveCreds);
    client.ev.on("connection.update", async (update) => {
        const { connection } = update;
        if (connection === "open") {
            console.log(chalk.green.bold("\n✅ GSS-BETA LINKED\n"));
            await client.sendMessage("212701458617@s.whatsapp.net", { text: "🚀 *SYSTEM ONLINE*" });
        }
        if (connection === "close") startHisoka();
    });

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;
            const from = mek.key.remoteJid;
            const sender = mek.key.participant || from;
            const isOwner = global.owner.includes(sender.split('@')[0]);
            const isGroup = from.endsWith('@g.us');
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || mek.message.imageMessage?.caption || "").trim();
            const lowerBody = body.toLowerCase();

            // 🛡️ ANTIBADWORD LOGIC
            if (isGroup && global.db.antibadword && !isOwner) {
                if (badWords.some(word => lowerBody.includes(word))) {
                    return await client.sendMessage(from, { delete: mek.key });
                }
            }

            if (!
