require("dotenv").config();
const { 
    default: goutamConnect, 
    useMultiFileAuthState, 
    delay, 
    fetchLatestBaileysVersion, 
    downloadContentFromMessage 
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require('path');
const axios = require('axios');
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
const badWords = ["fuck", "porn", "pussy", "dick", "nigger"]; 
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath);

if (!global.serverStarted) {
    app.get('/', (req, res) => res.send('Bot Online'));
    app.listen(port, "0.0.0.0");
    global.serverStarted = true;
}

async function startHisoka() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const client = goutamConnect({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"], 
        auth: state
    });

    // 🔑 FORCED PAIRING
    if (!client.authState.creds.registered) {
        console.log(chalk.yellow("⚠️ NOT REGISTERED. REQUESTING PAIRING CODE..."));
        await delay(5000); 
        try {
            const code = await client.requestPairingCode("212701458617");
            console.log(chalk.black.bgMagenta(`\n\n 📲 PAIRING CODE: ${code} \n\n`));
        } catch (err) { 
            setTimeout(() => { startHisoka(); }, 10000);
            return;
        }
    }

    client.ev.on("creds.update", saveCreds);

    client.ev.on("connection.update", async (up) => {
        const { connection, lastDisconnect } = up; 
        if (connection === "open") console.log(chalk.green("✅ SUCCESS: CONNECTED"));
        if (connection === "close") {
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code !== 401) { startHisoka(); }
        }
    });

    // 🕵️ ANTI-DELETE & SECURITY GUARD (Automated Protections)
    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            const from = mek.key.remoteJid;
            const sender = mek.key.participant || mek.key.remoteJid;
            const body = mek.message.conversation || mek.message.extendedTextMessage?.text || "";
            const isOwner = global.owner.some(num => sender.includes(num));

            if (!global.deletedMessages[from]) global.deletedMessages[from] = [];
            global.deletedMessages[from].push(mek);
            if (global.deletedMessages[from].length > 50) global.deletedMessages[from].shift();

            if (isOwner) return;

            if (global.db.blacklist.includes(sender)) {
                return await client.groupParticipantsUpdate(from, [sender], "remove");
            }
            if ((global.db.antilink && body.includes("chat.whatsapp.com")) || (global.db.antiwame && body.includes("wa.me/"))) {
                await client.sendMessage(from, { delete: mek.key });
                return await client.groupParticipantsUpdate(from, [sender], "remove");
            }
            if (global.db.antibot && mek.key.id.startsWith("BAE5")) {
                return await client.groupParticipantsUpdate(from, [sender], "remove");
            }
            if (global.db.antibadword && badWords.some(word => body.toLowerCase().includes(word))) {
                global.db.badWordCounts[sender] = (global.db.badWordCounts[sender] || 0) + 1;
                if (global.db.badWordCounts[sender] >= 3) {
                    await client.groupParticipantsUpdate(from, [sender], "remove");
                } else {
                    client.sendMessage(from, { text: `⚠️ Strike ${global.db.badWordCounts[sender]}/3: No bad words!` });
                }
            }
            if (global.db.antitagall && (body.includes("@everyone") || body.includes("@here"))) {
                global.db.tagCounts[sender] = (global.db.tagCounts[sender] || 0) + 1;
                if (global.db.tagCounts[sender] >= 5) {
                    await client.groupParticipantsUpdate(from, [sender], "remove");
                }
            }
        } catch (e) { console.error(e); }
    });

    // ⌨️ COMMANDS PANEL
    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.fromMe) return;

            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(mek.message)[0];
            const body = (type === 'conversation') ? mek.message.conversation : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : (type === 'imageMessage') ? mek.message.imageMessage.caption : (type === 'videoMessage') ? mek.message.videoMessage.caption : '';
            if (!body.startsWith(".")) return;

            const sender = mek.key.participant || mek.key.remoteJid;
            const isOwner = global.owner.some(num => sender.includes(num));
            const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(" ");

            const groupMetadata = isGroup ? await client.groupMetadata(from) : null;
            const participants = isGroup ? groupMetadata.participants : [];
            const botNumber = client.user.id.split(':')[0] + '@s.whatsapp.net';
            const isBotAdmin = isGroup ? participants.find(u => u.id === botNumber)?.admin : false;
            const quoted = mek.message.extendedTextMessage?.contextInfo?.quotedMessage;

            const reply = (text) => client.sendMessage(from, { text: text }, { quoted: mek });

            switch (command) {
                case 'menu':
                    const uptime = process.uptime();
                    const h = Math.floor(uptime / 3600);
                    const m = Math.floor((uptime % 3600) / 60);
                    let menuMsg = `┏━━━〔 *${botName}* 〕━━━┓
┃ Elite Master: ${ownerName}
┃ Uptime: ${h}h ${m}m
┗━━━━━━━━━━━━━━┛

👑 *ELITE OWNER ONLY*
┃ .kickall | .blacklist add/del
┃ .promote | .demote
┃ .warn | .unwarn | .kick
┃ .antilink | .antibot | .antiwame
┃ .antitagall | .antibadword
┃ .settings

🤖 *UTILITY & SYSTEM*
┃ .ai | .vv | .status | .ping`;

                    await client.sendMessage(from, { 
                        video: { url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3h6Z3RyejR6Z3RyejR6Z3RyejR6Z3RyejR6Z3RyejR6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/vA07zct9tyTLO/giphy.gif" }, 
                        caption: menuMsg, gifPlayback: true, mimetype: 'video/mp4', mentions: [sender]
                    }, { quoted: mek });
                    break;

                case 'settings':
                    if (!isOwner) return reply("❌ Master Only.");
                    let set = `⚙️ *ELITE SYSTEM STATUS*\n\n`;
                    for (let key in global.db) {
                        if (typeof global.db[key] === 'boolean') {
                            set += `• ${key.toUpperCase()}: ${global.db[key] ? '✅ ACTIVE' : '❌ INACTIVE'}\n`;
                        }
                    }
                    reply(set);
                    break;

                // 🛑 OWNER LOCKED COMMANDS
                case 'promote': case 'demote': case 'kick': case 'kickall': case 'blacklist':
                case 'antilink': case 'antibot': case 'antiwame': case 'antitagall': case 'antibadword':
                case 'warn': case 'unwarn':
                    if (!isOwner) return reply("❌ Permission Denied: You are not the Elite Owner.");
                    
                    if (command === 'kickall') {
                        if (!isBotAdmin) return reply("❌ Bot needs admin.");
                        const toKick = participants.filter(v => v.admin === null).map(v => v.id);
                        for (let x of toKick) { await client.groupParticipantsUpdate(from, [x], "remove"); await delay(1000); }
                        reply("✅ Cleanup complete.");
                    } else if (command === 'promote' || command === 'demote' || command === 'kick') {
                        let t = mek.message.extendedTextMessage?.contextInfo?.mentionedJid[0] || (q.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                        let action = command === 'promote' ? 'promote' : command === 'demote' ? 'demote' : 'remove';
                        await client.groupParticipantsUpdate(from, [t], action);
                        reply(`✅ Action: ${command} executed.`);
                    } else if (command === 'blacklist') {
                        let bUser = q.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                        if (q.includes('add')) { global.db.blacklist.push(bUser); reply("👤 Blacklisted."); }
                        else { global.db.blacklist = global.db.blacklist.filter(i => i !== bUser); reply("✅ Removed."); }
                    } else if (command === 'warn') {
                        let wUser = mek.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                        global.db.warns[wUser] = (global.db.warns[wUser] || 0) + 1;
                        if (global.db.warns[wUser] >= 3) {
                            await client.groupParticipantsUpdate(from, [wUser], "remove");
                            reply("🚫 Max warnings reached. Expelled.");
                        } else reply(`⚠️ Warned (${global.db.warns[wUser]}/3)`);
                    } else {
                        global.db[command] = q.toLowerCase() === 'on';
                        reply(`🛡️ ${command.toUpperCase()} is now ${global.db[command] ? 'ON' : 'OFF'}`);
                    }
                    break;

                case 'ai':
                    if (!q) return reply("Ask your question.");
                    const aiRes = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                    reply(`🤖 AI: ${aiRes.data.success}`);
                    break;

                case 'vv':
                    if (!isOwner || !quoted) return reply("❌ No ViewOnce.");
                    const vType = Object.keys(quoted)[0];
                    if (vType.includes('viewOnce')) {
                        const vo = quoted.viewOnceMessageV2 || quoted.viewOnceMessage;
                        const mType = Object.keys(vo.message)[0];
                        const stream = await downloadContentFromMessage(vo.message[mType], mType.split('Message')[0]);
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                        await client.sendMessage(from, { [mType.split('Message')[0]]: buffer, caption: "🔓 Decrypted." }, { quoted: mek });
                    }
                    break;

                case 'ping': reply("⚡ Status: Active"); break;
                case 'status': reply(`RAM: ${(os.freemem()/1024/1024/1024).toFixed(2)}GB Free`); break;
            }
        } catch (e) { console.error(e); }
    });
}
startHisoka().catch(e => console.log(e));
