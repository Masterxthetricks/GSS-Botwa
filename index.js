require("dotenv").config();
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require('path');
const chalk = require("chalk");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

const sessionPath = path.join(__dirname, 'session');
const dbPath = path.join(__dirname, 'database.json');

// 💾 DATABASE INITIALIZATION
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({
        antilink: false, antibot: false, antiwame: false, antitagall: false,
        antibadword: false, antispam: false, antifake: false, antidelete: false,
        automute: false, antiban: true, whitelist: [], 
        blockedCountries: ['994', '48', '44'],
        blacklist: []
    }, null, 2));
}
global.db = JSON.parse(fs.readFileSync(dbPath));
const saveDB = () => fs.writeFileSync(dbPath, JSON.stringify(global.db, null, 2));

const africaCodes = ["211", "212", "213", "216", "218", "220", "221", "222", "223", "224", "225", "226", "227", "228", "229", "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244", "245", "246", "247", "248", "249", "250", "251", "252", "253", "254", "255", "256", "257", "258", "260", "261", "262", "263", "264", "265", "266", "267", "268", "269", "27", "290", "291", "297", "298", "299"];
const europeCodes = ["30", "31", "32", "33", "34", "350", "351", "352", "353", "354", "355", "356", "357", "358", "359", "36", "370", "371", "372", "373", "374", "375", "376", "377", "378", "380", "381", "382", "383", "385", "386", "387", "389", "39", "40", "41", "420", "421", "423", "43", "44", "45", "46", "47", "48", "49", "7"];
const combinedSecurity = [...africaCodes, ...europeCodes];
const badWords = ["fuck you", "djol santi", "pussy", "bouda santi", "bitch", "masisi", "bouzen", "langet manman w", "santi kk", "gyet manman w", "pouri", "bouda fon", "trip pouri", "koko santi", "kalanbe"];

global.owner = ["212701458617", "85182757527702"]; 
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    
    const client = makeWASocket({
        version,
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"],
        markOnlineOnConnect: true
    });

    // 📱 IMPROVED CONNECTION HANDLER
    client.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log(chalk.magenta.bold("\n📢 [ACTION] SCAN THE QR BELOW TO START:"));
            qrcode.generate(qr, { small: true });
        }

        if (connection === "close") {
            let reason = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.yellow(`Connection Closed. Reason Code: ${reason}`));

            if (reason === DisconnectReason.restartRequired || reason === DisconnectReason.connectionLost) {
                console.log(chalk.blue("🔄 Restarting in 5 seconds..."));
                setTimeout(() => startBot(), 5000);
            } else if (reason === DisconnectReason.loggedOut) {
                console.log(chalk.red("❌ Logged out. Delete session folder and scan again."));
                process.exit();
            } else {
                console.log(chalk.cyan("🔄 Attempting Reconnect..."));
                startBot();
            }
        } else if (connection === "open") {
            console.log(chalk.green.bold("\n✅ SUCCESS: GSS-BETA IS CONNECTED AND ONLINE\n"));
            client.sendMessage(global.owner[0] + "@s.whatsapp.net", { text: `🚀 *${botName}* is now active on Koyeb!` });
        }
    });

    client.ev.on("creds.update", saveCreds);

    // 📩 MESSAGE HANDLER
    client.ev.on("messages.upsert", async ({ messages }) => {
        const mek = messages[0];
        if (!mek.message || mek.key.remoteJid === 'status@broadcast') return;
        
        try {
            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const sender = mek.key.participant || from;
            const senderNumber = sender.replace(/\D/g, "");
            
            const groupMetadata = isGroup ? await client.groupMetadata(from) : null;
            const isCreator = isGroup ? (groupMetadata.owner === sender) : false;
            const isOwner = global.owner.includes(senderNumber) || global.db.whitelist.includes(senderNumber) || isCreator;
            const botNumber = client.user.id.split(':')[0] + '@s.whatsapp.net';
            const isBotAdmin = isGroup ? groupMetadata.participants.find(p => p.id === botNumber)?.admin : false;

            // 🛡️ SECURITY LAYER
            if (isGroup && !isOwner && isBotAdmin) {
                const isBlocked = combinedSecurity.some(code => senderNumber.startsWith(code)) || 
                                  global.db.blockedCountries.some(code => senderNumber.startsWith(code));
                
                if (isBlocked) {
                    await client.groupParticipantsUpdate(from, [sender], "remove");
                    return;
                }
                const bodyText = (mek.message.conversation || mek.message.extendedTextMessage?.text || "").toLowerCase();
                if (global.db.antibadword && badWords.some(w => bodyText.includes(w))) {
                    await client.sendMessage(from, { delete: mek.key });
                }
            }

            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || mek.message.imageMessage?.caption || "");
            if (!body.startsWith(".")) return;
            if (!isOwner) return;

            const args = body.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const q = args.join(" ");
            const readMore = String.fromCharCode(8206).repeat(4001);

            // ⚡ EXECUTION SWITCH
            switch (command) {
                case 'menu':
                    let menuMsg = `╭───『 *${botName}* 』───
│ Hi 👋 ${mek.pushName || 'User'}
│ ✨ *${ownerName}*
╰───────────────────${readMore}
├─『 *Admin & Group* 』
│ .add | .kick | .tagall
│ .hidetag | .kickall | .mute
│ .unmute | .promote | .demote
│
├─『 *Security/Auto* 』
│ .antilink | .antibot | .antifake
│ .antibadword | .antiban | .status
│ .blockcountry | .whitelist
│
├──『 *Utility & Fun* 』
│ .ping | .ai | .owner | .backup`;

                    await client.sendMessage(from, { 
                        video: { url: "https://media.tenor.com/2PzXp9vY15kAAAAC/ayanokoji-kiyotaka.mp4" }, 
                        caption: menuMsg, 
                        gifPlayback: true 
                    }, { quoted: mek });
                    break;

                case 'ping':
                    client.sendMessage(from, { text: `⚡ Speed: ${Date.now() - mek.messageTimestamp * 1000}ms` });
                    break;

                case 'tagall':
                    let s = `📢 *TAG ALL*\n\n${q}\n\n`;
                    for (let m of groupMetadata.participants) s += `@${m.id.split('@')[0]}\n`;
                    client.sendMessage(from, { text: s, mentions: groupMetadata.participants.map(a => a.id) });
                    break;

                case 'kickall':
                    for (let m of groupMetadata.participants) {
                        if (!global.owner.includes(m.id.replace(/\D/g, '')) && m.id !== botNumber) {
                            await client.groupParticipantsUpdate(from, [m.id], "remove");
                        }
                    }
                    break;
            }
        } catch (e) { console.error(e); }
    });
}

startBot();
