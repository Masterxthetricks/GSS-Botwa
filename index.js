require("dotenv").config();
const { 
    default: goutamConnect, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore, 
    downloadContentFromMessage, 
    delay,
    DisconnectReason
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
    antilink: false, antibot: false, antiwame: false, antitagall: false,
    antibadword: false, antispam: false, antiban: true, warns: {},
    blacklist: [], tagCounts: {}, badWordCounts: {}
};

const badWords = ["fuck you", "djol santi", "pussy", "bouda santi", "bitch", "masisi", "bouzen", "langet manman w", "santi kk", "gyet manman w", "pouri", "bouda fon", "trip pouri", "koko santi", "kalanbe"];
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";
const pairingNumber = "212701458617";

app.get('/', (req, res) => res.send('GSS-BETA Status: Active'));
app.listen(port, "0.0.0.0");

let isPairing = false; // Lock to prevent pairing loop

async function startHisoka() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        connectTimeoutMs: 120000,
        printQRInTerminal: false
    });

    // 📲 STABILIZED PAIRING LOGIC FOR KOYEB
    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log(chalk.red("⚠️ Connection lost. Restarting in 5s..."));
                setTimeout(() => startHisoka(), 5000);
            }
        } else if (connection === "open") {
            console.log(chalk.green.bold("\n✅ GSS-BETA LINKED SUCCESSFULLY\n"));
            isPairing = false; 
            await client.sendMessage(`${pairingNumber}@s.whatsapp.net`, { text: "🚀
