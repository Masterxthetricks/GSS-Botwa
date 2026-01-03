require("dotenv").config();
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore, 
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require('path');
const chalk = require("chalk");
const pino = require("pino");

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
const badWords = ["fuck you", "djol santi", "pussy", "bouda santi", "bitch", "masisi", "bouzen", "langet manman w", "santi kk", "gyet manman w", "pouri", "bouda fon", "trip pouri", "koko santi", "kalanbe"];

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
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        printQRInTerminal: false
    });

    // 🔑 PAIRING CODE LOGIC WITH CONNECTION CHECK
    if (!client.authState.creds.registered) {
        client.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                // Connection is stable, now request the code
                setTimeout(async () => {
                    let code = await client.requestPairingCode(pairingNumber);
                    console.log(chalk.black.bgGreen.bold(`\n [LINKING CODE] : ${code?.match(/.{1,4}/g)?.join("-") || code} \n`));
                }, 3000);
            }
        });
    }

    client.ev.on("creds.update", saveCreds);
    
    client.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log(chalk.green("✅ Bot is online and connected!"));
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
            const isBotAdmin = isGroup ? groupMetadata.participants.find(p => p.id === (client.user.id.split(':')[0] + '@s.whatsapp.net'))?.admin : false;
            const isOwner = global.owner.includes(senderNumber) || global.db.whitelist.includes(senderNumber);

            // 🛡️ SECURITY ACTIONS
            if (isGroup && isBotAdmin && !isOwner) {
                if (combinedSecurity.some(code => senderNumber.startsWith(code)) || global.db.blacklist.includes(senderNumber)) {
                    return await client.groupParticipantsUpdate(from, [sender], "remove");
                }
                if (global.db.antilink && (body.includes("chat.whatsapp.com") || body.includes("wa.me/"))) {
                    await client.sendMessage(from, { delete: mek.key });
                    return await client.groupParticipantsUpdate(from, [sender], "remove");
                }
            }

            if (!body.startsWith(".")) return;
            if (!isOwner) return;

            const args = body.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const q = args.join(" ");

            switch (command) {
                case 'menu':
                    const readMore = String.fromCharCode(8206).repeat(4001);
                    let menuTxt = `╭───『 *${botName}* 』───\n│ ✨ *${ownerName}*\n╰───────────────────${readMore}\n├─『 Admin 』: .kick, .tagall, .mute\n├─『 Security 』: .antilink, .blacklist, .status\n└─『 Utility 』: .ping, .vv, .backup`;
                    await client.sendMessage(from, { 
                        video: { url: "https://media.tenor.com/2PzXp9vY15kAAAAC/ayanokoji-kiyotaka.mp4" }, 
                        caption: menuTxt, 
                        gifPlayback: true 
                    }, { quoted: mek });
                    break;
                
                case 'ping':
                    client.sendMessage(from, { text: `🚀 Speed: ${Date.now() - mek.messageTimestamp * 1000}ms` });
                    break;

                case 'status':
                    let stat = "⚙️ *SYSTEM STATUS*\n\n";
                    for (let k in global.db) if (typeof global.db[k] === 'boolean') stat += `${global.db[k] ? '✅' : '❌'} ${k.toUpperCase()}\n`;
                    client.sendMessage(from, { text: stat });
                    break;
            }
        } catch (e) { console.error(e); }
    });
}

startBot();
