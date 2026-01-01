require("dotenv").config();
const fs = require("fs");
const path = require('path');
const express = require('express');
const {
    default: goutamConnect,
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    jidDecode
} = require("@whiskeysockets/baileys");
const chalk = require("chalk");
const pino = require("pino");

const app = express();
const port = process.env.PORT || 8080;
const sessionPath = path.join(__dirname, 'session');

// 📝 CONFIGURATION
global.owner = ["212701458617", "85182757527702"]; 
global.antilink = false; // Default off

// --- 🌐 WEB SERVER ---
if (!global.serverStarted) {
    app.get('/', (req, res) => res.send('Bot Status: Running'));
    app.listen(port, "0.0.0.0", () => console.log(chalk.green(`🌐 Port: ${port}`)));
    global.serverStarted = true;
}

async function startHisoka() {
    console.log(chalk.blue.bold("\n--- 🤖 WHATSAPP BOT SYSTEM STARTING ---"));

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

    // --- 🔑 PAIRING ---
    if (!client.authState.creds.registered) {
        console.log(chalk.cyan.bold(`\n📲 Waiting for network...`));
        await delay(15000); 
        try {
            const code = await client.requestPairingCode("212701458617");
            console.log(chalk.white.bgMagenta.bold(`\n YOUR CODE: ${code} \n`));
        } catch (err) { console.log("Pairing Error, Restarting..."); startHisoka(); }
    }

    client.ev.on("creds.update", saveCreds);

    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update; 
        if (connection === "open") console.log(chalk.green.bold("\n✅ SUCCESS: CONNECTED"));
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== 401) { await delay(10000); startHisoka(); }
        }
    });

    // --- 📩 MESSAGE HANDLER ---
    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;

            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || "").trim();
            const sender = mek.key.participant || mek.key.remoteJid;
            
            // 👑 OWNER & ADMIN LOGIC
            const isOwner = global.owner.some(num => sender.includes(num));
            
            // 🛡️ ANTI-LINK LOGIC
            if (isGroup && global.antilink && body.includes("chat.whatsapp.com") && !isOwner) {
                const groupMetadata = await client.groupMetadata(from);
                const botNumber = client.user.id.split(':')[0] + '@s.whatsapp.net';
                const isBotAdmin = groupMetadata.participants.find(u => u.id === botNumber)?.admin;
                
                if (isBotAdmin) {
                    await client.sendMessage(from, { text: "🚫 *Link Detected!* Removing user..." });
                    await client.groupParticipantsUpdate(from, [sender], "remove");
                    return;
                }
            }

            if (!body.startsWith(".")) return;
            const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(" ");

            // GROUP METADATA FOR COMMANDS
            const groupMetadata = isGroup ? await client.groupMetadata(from) : null;
            const participants = isGroup ? groupMetadata.participants : [];
            const botNumber = client.user.id.split(':')[0] + '@s.whatsapp.net';
            const isBotAdmin = isGroup ? participants.find(u => u.id === botNumber)?.admin : false;

            switch (command) {
                case 'menu':
                    const menu = `*🤖 COMMAND CENTER*
                    
*👑 Owner Commands*
• .antilink [on/off]
• .kickall
• .bc [text]

*🛡️ Admin Commands*
• .tagall [msg]
• .hidetag [msg]
• .mute / .unmute
• .promote / .demote

*👤 Public*
• .ping
• .owner`;
                    await client.sendMessage(from, { text: menu }, { quoted: mek });
                    break;

                case 'ping':
                    await client.sendMessage(from, { text: "Active ⚡" }, { quoted: mek });
                    break;

                case 'owner':
                    await client.sendMessage(from, { text: isOwner ? "✅ You are the Boss." : "❌ You are not Owner." }, { quoted: mek });
                    break;

                case 'tagall':
                    if (!isGroup || !isOwner) return;
                    let tMsg = `*📢 TAG ALL*\n\n${q}\n\n`;
                    for (let mem of participants) { tMsg += ` @${mem.id.split('@')[0]}\n`; }
                    await client.sendMessage(from, { text: tMsg, mentions: participants.map(a => a.id) }, { quoted: mek });
                    break;

                case 'hidetag':
                    if (!isGroup || !isOwner) return;
                    await client.sendMessage(from, { text: q, mentions: participants.map(a => a.id) });
                    break;

                case 'mute':
                    if (!isGroup || !isBotAdmin || !isOwner) return;
                    await client.groupSettingUpdate(from, 'announcement');
                    await client.sendMessage(from, { text: "🔒 Group Closed." });
                    break;

                case 'unmute':
                    if (!isGroup || !isBotAdmin || !isOwner) return;
                    await client.groupSettingUpdate(from, 'not_announcement');
                    await client.sendMessage(from, { text: "🔓 Group Opened." });
                    break;

                case 'promote':
                case 'demote':
                    if (!isGroup || !isBotAdmin || !isOwner) return;
                    let users = mek.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    if (users.length === 0) return await client.sendMessage(from, { text: "Tag the user first!" });
                    await client.groupParticipantsUpdate(from, users, command === 'promote' ? "promote" : "demote");
                    await client.sendMessage(from, { text: `Done! User ${command}d.` });
                    break;

                case 'antilink':
                    if (!isOwner) return;
                    global.antilink = args[0] === 'on';
                    await client.sendMessage(from, { text: `🚫 Antilink: *${global.antilink ? "ON" : "OFF"}*` });
                    break;

                case 'kickall':
                    if (!isGroup || !isBotAdmin || !isOwner) return;
                    const nonAdmins = participants.filter(v => v.admin === null).map(v => v.id);
                    await client.sendMessage(from, { text: `🚨 Kicking ${nonAdmins.length} users...` });
                    for (let mem of nonAdmins) {
                        await
