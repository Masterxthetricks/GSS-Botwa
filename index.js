require("dotenv").config();
const { 
    default: goutamConnect, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    delay,
    DisconnectReason,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require('path');
const chalk = require("chalk");
const pino = require("pino");
const os = require('os');
const express = require('express');

const app = express();
const port = process.env.PORT || 8080;
const sessionPath = path.join(__dirname, 'session');

// 📝 UPDATED CONFIGURATION & DATABASE
global.owner = ["212701458617", "85182757527702"]; 
global.deletedMessages = {}; 
global.db = {
    antilink: false,
    antibot: false,
    antiwame: false,
    antitagall: false,
    antibadword: false,
    antispam: false,
    antiban: true,
    warns: {},        // Added
    blacklist: [],    // Added
    tagCounts: {},    // Added
    badWordCounts: {} // Added
};

const badWords = ["fuck", "porn", "pussy", "dick", "nigger", "bitch", "masisi", "bouzen", "langet manman w", "gyet manman w", "pouri", "santi", "bouda fon", "trip pouri", "kalanbe"]; 
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath);

app.get('/', (req, res) => res.send('GSS-BETA Status: Active'));
app.listen(port, "0.0.0.0");

async function startHisoka() {
    // 🛡️ SESSION PURGE: Prevents the "Multiple Invalid Code" Loop
    if (fs.existsSync(path.join(sessionPath, 'creds.json'))) {
        const creds = JSON.parse(fs.readFileSync(path.join(sessionPath, 'creds.json')));
        if (!creds.registered) {
            console.log(chalk.red("Purging unlinked session to ensure fresh pairing..."));
            fs.rmSync(sessionPath, { recursive: true, force: true });
            fs.mkdirSync(sessionPath);
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const client = goutamConnect({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        mobile: false,
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // 🚀 KOYEB STABILITY PARAMETERS
        connectTimeoutMs: 120000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 30000,
        maxRetries: 20
    });

    // 🔑 STABILIZED PAIRING LOGIC
    if (!client.authState.creds.registered) {
        console.log(chalk.yellow("Waiting 15s for cloud network stabilization..."));
        await delay(15000); 
        
        try {
            const phoneNumber = "212701458617";
            const code = await client.requestPairingCode(phoneNumber);
            console.log(chalk.black.bgMagenta(`\n\n 📲 PAIRING CODE FOR ${phoneNumber}: ${code} \n\n`));
        } catch (err) { 
            console.error("Pairing Error:", err);
            await delay(10000);
            return startHisoka();
        }
    }

    client.ev.on("creds.update", saveCreds);

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log("Restarting connection...");
                setTimeout(() => startHisoka(), 5000);
            }
        } else if (connection === "open") {
            console.log(chalk.green.bold("\n✅ GSS-BETA SUCCESSFULLY LINKED!\n"));
            await client.sendMessage("212701458617@s.whatsapp.net", { text: "🚀 *GSS-BETA SYSTEM ONLINE*" });
        }
    });

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;
            const from = mek.key.remoteJid;
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || "");

            if (body.startsWith(".")) {
                const command
