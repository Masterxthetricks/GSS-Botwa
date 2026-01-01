require("dotenv").config();
const { 
    default: goutamConnect, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    delay,
    DisconnectReason,
    jidDecode,
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

// 📝 CONFIGURATION & DATABASE
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
    warns: {},
    blacklist: [],
    tagCounts: {},
    badWordCounts: {}
};

const badWords = ["fuck", "porn", "pussy", "dick", "nigger", "bitch", "masisi", "bouzen", "langet manman w", "gyet manman w", "pouri", "santi", "bouda fon", "trip pouri", "kalanbe"]; 
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath);

// Koyeb Health Check
app.get('/', (req, res) => res.send('GSS-BETA System Online'));
app.listen(port, "0.0.0.0");

async function startHisoka() {
    // 🛡️ 1. SESSION CLEANER: Fixes "Stuck on Generating"
    if (fs.existsSync(path.join(sessionPath, 'creds.json'))) {
        try {
            const creds = JSON.parse(fs.readFileSync(path.join(sessionPath, 'creds.json')));
            if (!creds.registered && !creds.pairingCode) {
                console.log(chalk.red("Detected corrupted session. Purging..."));
                fs.unlinkSync(path.join(sessionPath, 'creds.json'));
            }
        } catch (e) {
            fs.unlinkSync(path.join(sessionPath, 'creds.json'));
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const client = goutamConnect({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        mobile: false, // 🚀 FORCE DESKTOP LOGIC
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"], 
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // 🚀 VITAL ADJUSTMENT: Keep connection alive during pairing
        maxRetries: 10,
        defaultQueryTimeoutMs: 0, 
        connectTimeout
