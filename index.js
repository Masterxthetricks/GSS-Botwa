require("dotenv").config();
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore, 
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require('path');
const chalk = require("chalk");
const pino = require("pino");
const axios = require("axios");

const sessionPath = path.join(__dirname, 'session');
const dbPath = path.join(__dirname, 'database.json');

// 💾 DATABASE INITIALIZATION
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({
        antilink: false, antibot: false, antiwame: false, antitagall: false,
        antibadword: false, antibadwordnokick: false, antispam: false, antifake: false, 
        antidelete: false, automute: false, antiban: true, whitelist: [], 
        blockedCountries: ['994', '48', '44'], blacklist: [], warns: {}
    }, null, 2));
}
global.db = JSON.parse(fs.readFileSync(dbPath));
const saveDB = () => fs.writeFileSync(dbPath, JSON.stringify(global.db, null, 2));

// 👑 CONFIG
const pairingNumber = "212701458617"; 
global.owner = [pairingNumber, "85182757527702"]; 
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

// 🌍 SECURITY LISTS
const africaCodes = ["211", "212", "213", "216", "218", "220", "221", "222", "223", "224", "225", "226", "227", "228", "229", "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244", "245", "246", "247", "248", "249", "250", "251", "252", "253", "254", "255", "256", "257", "258", "260", "261", "262", "263", "264", "265", "266", "267", "268", "269", "27", "290", "291", "297", "298", "299"];
const europeCodes = ["30", "31", "32", "33", "34", "350", "351", "352", "353", "354", "355", "356", "357", "358", "359", "36", "370", "371", "372", "373", "374", "375", "376", "377", "378", "380", "381", "382", "383", "385", "386", "387", "389", "39", "40", "41", "420", "421", "423", "43", "44", "45", "46", "47", "48", "49", "7"];
const combinedSecurity = [...africaCodes, ...europeCodes];

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    
    const client = makeWASocket({
        version,
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) 
        },
        logger: pino({ level: "fatal" }),
        browser: Browsers.ubuntu("Chrome"),
        printQRInTerminal: false
    });

    if (!client.authState.creds.registered) {
        console.log(chalk.yellow("🕒 Generating pairing code..."));
        setTimeout(async () => {
            try {
                let code = await client.requestPairingCode(pairingNumber);
                console.log(chalk.black.bgGreen.bold(`\n [LINKING CODE] : ${code?.match(/.{1,4}/g)?.join("-")} \n`));
            } catch (err) { startBot(); }
        }, 10000); 
    }

    client.ev.on("creds.update", saveCreds);

    // 🛡️ ANTI-DELETE
    client.ev.on("messages.upsert", async ({ messages, type }) => {
        const mek = messages[0];
        if (type === 'append' || type === 'notify') {
            if (mek.message?.protocolMessage?.type === 0 && global.db.antidelete) {
                await client.sendMessage(global.owner[0] + "@s.whatsapp.net", { 
                    text: `🕵️ *ANTI-DELETE REPORT*\n*User:* @${mek.key.participant?.split('@')[0] || 'Unknown'}\n*Chat:* ${mek.key.remoteJid}`,
                    mentions: [mek.key.participant]
                });
            }
        }
    });

    client.ev.on("connection.update", (u) => { 
        if (u.connection === "close") {
            const shouldReconnect = u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    client.ev.on("messages.upsert", async ({ messages }) => {
        const mek = messages[0];
        if (!mek.message || mek.key.remoteJid === 'status@broadcast') return;
        
        try {
            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const sender = mek.key.participant || from;
            const senderNumber = sender.replace(/\D/g, "");
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || mek.message.imageMessage?.caption || "").toLowerCase();
            const groupMetadata = isGroup ? await client.groupMetadata(from) : null;
            const botNumber = client.user.id.split(':')[0] + '@s.whatsapp.net';
            const isBotAdmin = isGroup ? groupMetadata.participants.find(p => p.id === botNumber)?.admin : false;
            const isOwner = global.owner.includes(senderNumber) || global.db.whitelist.includes(senderNumber);

            // 🛡️ AUTOMATIC SECURITY
            if (isGroup && isBotAdmin && !isOwner) {
                if (global.db.antifake && combinedSecurity.some(code => senderNumber.startsWith(code))) return client.groupParticipantsUpdate(from, [sender], "remove");
                if (global.db.blacklist.includes(senderNumber)) return client.groupParticipantsUpdate(from, [sender], "remove");
                if (global.db.antibot && (mek.key.id.startsWith("BAE5") || mek.key.id.length > 21)) return client.groupParticipantsUpdate(from, [sender], "remove");
                
                if (global.db.antilink && (body.includes("chat.whatsapp.com") || body.includes("wa.me/"))) {
                    await client.sendMessage(from, { delete: mek.key });
                    return client.groupParticipantsUpdate(from, [sender], "remove");
                }
            }

            if (!body.startsWith(".")) return;
            if (!isOwner) return;

            const args = body.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const q = args.join(" ");
            const mentioned = mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || mek.message.extendedTextMessage?.contextInfo?.participant || (q.replace(/\D/g, '') + '@s.whatsapp.net');

            switch (command) {
                case 'menu':
                    const readMore = String.fromCharCode(8206).repeat(4001);
                    let menuTxt = `╭───『 *${botName}* 』───
│ Hi 👋 ${mek.pushName || 'User'}
│ ✨ *${ownerName}*
╰───────────────────${readMore}
├─『 *Admin & Group* 』
│ .add | .kick | .tagall | .hidetag
│ .kickall | .mute | .unmute
│ .promote | .demote | .warn | .unwarn
│
├─『 *Security/Auto* 』
│ .antilink | .antibot | .antifake
│ .antidelete | .antiban | .status
│ .blockcountry | .whitelist | .blacklist
│
├──『 *Utility & Fun* 』
│ .ping | .ai | .owner | .backup | .vv`;
                    await client.sendMessage(from, { video: { url: "https://media.tenor.com/2PzXp9vY15kAAAAC/ayanokoji-kiyotaka.mp4" }, caption: menuTxt, gifPlayback: true }, { quoted: mek });
                    break;

                case 'add': case 'kick': case 'promote': case 'demote':
                    if (!isGroup || !isBotAdmin) return client.sendMessage(from, { text: "❌ Command failed: Either not a group or I am not Admin." });
                    if (command === 'kick' && global.owner.includes(mentioned.replace(/\D/g, ''))) return;
                    await client.groupParticipantsUpdate(from, [mentioned], command === 'add' ? 'add' : (command === 'kick' ? 'remove' : command));
                    break;

                case 'mute': case 'unmute':
                    if (!isGroup || !isBotAdmin) return;
                    await client.groupSettingUpdate(from, command === 'mute' ? 'announcement' : 'not_announcement');
                    break;

                case 'tagall': case 'hidetag':
                    if (!isGroup) return;
                    let pings = command === 'tagall' ? `📢 *TAG ALL*\n\n${q}\n\n` : q;
                    if (command === 'tagall') groupMetadata.participants.forEach(m => pings += `@${m.id.split('@')[0]} `);
                    client.sendMessage(from, { text: pings, mentions: groupMetadata.participants.map(a => a.id) });
                    break;

                case 'kickall':
                    if (!isGroup || !isBotAdmin) return;
                    if (q !== 'confirm') return client.sendMessage(from, { text: "⚠️ Type `.kickall confirm`" });
                    let victims = groupMetadata.participants.filter(m => m.id !== botNumber && !global.owner.includes(m.id.replace(/\D/g, '')));
                    for (let v of victims) await client.groupParticipantsUpdate(from, [v.id], "remove");
                    break;

                case 'warn': case 'unwarn':
                    if (!isGroup || !isBotAdmin) return;
                    global.db.warns[mentioned] = command === 'warn' ? (global.db.warns[mentioned] || 0) + 1 : 0;
                    saveDB();
                    client.sendMessage(from, { text: `User @${mentioned.split('@')[0]} warnings: ${global.db.warns[mentioned]}/3`, mentions: [mentioned] });
                    if (global.db.warns[mentioned] >= 3) await client.groupParticipantsUpdate(from, [mentioned], "remove");
                    break;

                case 'antilink': case 'antibot': case 'antifake': case 'antidelete': case 'antiban':
                    global.db[command] = !global.db[command];
                    saveDB();
                    client.sendMessage(from, { text: `🛡️ ${command.toUpperCase()} is ${global.db[command] ? 'ON ✅' : 'OFF ❌'}` });
                    break;

                case 'status':
                    let st = `⚙️ *SYSTEM STATUS*\n\n`;
                    for (let k in global.db) if (typeof global.db[k] === 'boolean') st += `${global.db[k] ? '✅' : '❌'} ${k.toUpperCase()}\n`;
                    client.sendMessage(from, { text: st });
                    break;

                case 'ai':
                    if (!q) return;
                    try {
                        const response = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(q)}&lc=en`);
                        const result = response.data.success || response.data.result || "I couldn't process that.";
                        client.sendMessage(from, { text: result }, { quoted: mek });
                    } catch { client.sendMessage(from, { text: "❌ AI API Error." }); }
                    break;

                case 'ping':
                    client.sendMessage(from, { text: `🚀 Speed: ${Date.now() - mek.messageTimestamp * 1000}ms` });
                    break;

                case 'vv':
                    const quoted = mek.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    const viewOnce = quoted?.viewOnceMessageV2?.message || quoted?.viewOnceMessage?.message;
                    if (viewOnce) {
                        const type = Object.keys(viewOnce)[0];
                        await client.sendMessage(from, { forward: { key: mek.key, message: viewOnce }, force: true }, { quoted: mek });
                    } else {
                        client.sendMessage(from, { text: "⚠️ Please reply to a ViewOnce message." });
                    }
                    break;

                case 'owner':
                    client.sendMessage(from, { text: `👑 *Owner:* ${ownerName}\n📱 *Number:* ${global.owner[0]}` });
                    break;

                case 'backup':
                    await client.sendMessage(from, { document: fs.readFileSync(dbPath), fileName: 'database.json', mimetype: 'application/json' });
                    break;
            }
        } catch (e) { console.error(e); }
    });
}
startBot();
