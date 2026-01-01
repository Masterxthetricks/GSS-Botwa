require("dotenv").config();
const fs = require("fs");
const path = require('path');
const express = require('express');
const { default: goutamConnect, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
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
        await delay(15000); 
        try {
            const code = await client.requestPairingCode("212701458617");
            console.log(chalk.magenta(`\n CODE: ${code} \n`));
        } catch { startHisoka(); }
    }

    client.ev.on("creds.update", saveCreds);
    client.ev.on("connection.update", async (up) => {
        const { connection, lastDisconnect } = up; 
        if (connection === "open") console.log(chalk.green("✅ SUCCESS"));
        if (connection === "close") {
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code !== 401) { await delay(10000); startHisoka(); }
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

            console.log(chalk.blue(`[LOG] From: ${sender} | Msg: ${body}`));

            if (isGroup && global.antilink && body.includes("chat.whatsapp.com") && !isOwner) {
                const groupMetadata = await client.groupMetadata(from);
                const botNumber = client.user.id.split(':')[0] + '@s.whatsapp.net';
                const isBotAdmin = groupMetadata.participants.find(u => u.id === botNumber)?.admin;
                if (isBotAdmin) return await client.groupParticipantsUpdate(from, [sender], "remove");
            }

            if (!body.startsWith(".")) return;
            const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(" ");

            const groupMetadata = isGroup ? await client.groupMetadata(from) : null;
            const participants = isGroup ? groupMetadata.participants : [];
            const botNumber = client.user.id.split(':')[0] + '@s.whatsapp.net';
            const isBotAdmin = isGroup ? participants.find(u => u.id === botNumber)?.admin : false;

            switch (command) {
                case 'menu':
                    await client.sendMessage(from, { text: "*BOT MENU*\n\n.tagall\n.kickall\n.mute\n.unmute\n.antilink on/off\n.promote\n.demote\n.owner\n.ping" });
                    break;
                case 'ping': await client.sendMessage(from, { text: "Online ⚡" }); break;
                case 'owner': await client.sendMessage(from, { text: isOwner ? "✅ Boss" : "❌ No" }); break;
                case 'tagall':
                    if (!isGroup || !isOwner) return;
                    let t = "*📢 TAG ALL*\n\n";
                    for (let m of participants) { t += ` @${m.id.split('@')[0]}\n`; }
                    await client.sendMessage(from, { text: t, mentions: participants.map(a => a.id) });
                    break;
                case 'mute':
                    if (isGroup && isBotAdmin && isOwner) await client.groupSettingUpdate(from, 'announcement');
                    break;
                case 'unmute':
                    if (isGroup && isBotAdmin && isOwner) await client.groupSettingUpdate(from, 'not_announcement');
                    break;
                case 'promote':
                case 'demote':
                    if (!isGroup || !isBotAdmin || !isOwner) return;
                    let u = mek.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    await client.groupParticipantsUpdate(from, u, command);
                    break;
                case 'antilink':
                    if (isOwner) global.antilink = args[0] === 'on';
                    await client.sendMessage(from, { text: `Antilink: ${global.antilink}` });
                    break;
                case 'kickall':
                    if (!isGroup || !isBotAdmin || !isOwner) return;
                    const others = participants.filter(v => v.admin === null).map(v => v.id);
                    for (let m of others) {
                        await client.groupParticipantsUpdate(from, [m], "remove");
                        await delay(1500);
                    }
                    break;
            }
        } catch (e) { console.log(e); }
    });
}
startHisoka().catch(e => console.log(e));
