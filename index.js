require("dotenv").config();
const { 
    default: goutamConnect, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    delay,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    downloadContentFromMessage
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

const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath);
app.get('/', (req, res) => res.send('GSS-BETA Elite System: Online'));
app.listen(port, "0.0.0.0");

async function startHisoka() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const client = goutamConnect({
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        connectTimeoutMs: 120000,
        maxRetries: 20
    });

    if (!client.authState.creds.registered) {
        await delay(15000); 
        try {
            const code = await client.requestPairingCode("212701458617");
            console.log(chalk.black.bgMagenta(`\n\n 📲 PAIRING CODE: ${code} \n\n`));
        } catch (err) { setTimeout(() => startHisoka(), 10000); return; }
    }

    client.ev.on("creds.update", saveCreds);
    client.ev.on("connection.update", async (update) => {
        const { connection } = update;
        if (connection === "open") await client.sendMessage("212701458617@s.whatsapp.net", { text: "🚀 *SYSTEM FULLY OPERATIONAL*" });
        if (connection === "close") startHisoka();
    });

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;
            const from = mek.key.remoteJid;
            const type = Object.keys(mek.message)[0];
            const sender = mek.key.participant || mek.key.remoteJid;
            const isOwner = global.owner.includes(sender.
