require("dotenv").config();
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion 
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require('path');
const chalk = require("chalk");
const pino = require("pino");

const sessionPath = path.join(__dirname, 'session');
const dbPath = path.join(__dirname, 'database.json');

// 💾 DATABASE (INTEGRATED EXACTLY AS REQUESTED)
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

// 🌍 REGIONAL SECURITY LISTS
const africaCodes = ["211", "212", "213", "216", "218", "220", "221", "222", "223", "224", "225", "226", "227", "228", "229", "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244", "245", "246", "247", "248", "249", "250", "251", "252", "253", "254", "255", "256", "257", "258", "260", "261", "262", "263", "264", "265", "266", "267", "268", "269", "27", "290", "291", "297", "298", "299"];
const europeCodes = ["30", "31", "32", "33", "34", "350", "351", "352", "353", "354", "355", "356", "357", "358", "359", "36", "370", "371", "372", "373", "374", "375", "376", "377", "378", "380", "381", "382", "383", "385", "386", "387", "389", "39", "40", "41", "420", "421", "423", "43", "44", "45", "46", "47", "48", "49", "7"];
const combinedSecurity = [...africaCodes, ...europeCodes];

const badWords = ["fuck you", "djol santi", "pussy", "bouda santi", "bitch", "masisi", "bouzen", "langet manman w", "santi kk", "gyet manman w", "pouri", "bouda fon", "trip pouri", "koko santi", "kalanbe"];
global.owner = ["212701458617", "85182757527702"]; 
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const client = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) },
        printQRInTerminal: true,
        logger: pino({ level: "silent" }),
        browser: ["GSS-BETA", "Safari", "1.0.0"]
    });

    client.ev.on("creds.update", saveCreds);

    client.ev.on("messages.upsert", async ({ messages }) => {
        const mek = messages[0];
        if (!mek.message || mek.key.remoteJid === 'status@broadcast') return;
        
        try {
            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const sender = mek.key.participant || from;
            const senderNumber = sender.replace(/\D/g, "");
            
            // 🔓 RECOGNITION: OWNER, WHITELIST, OR GROUP CREATOR
            const groupMetadata = isGroup ? await client.groupMetadata(from) : null;
            const isCreator = isGroup ? (groupMetadata.owner === sender) : false;
            const isOwner = global.owner.includes(senderNumber) || global.db.whitelist.includes(senderNumber) || isCreator;
            const botNumber = client.user.id.split(':')[0] + '@s.whatsapp.net';
            const isBotAdmin = isGroup ? groupMetadata.participants.find(p => p.id === botNumber)?.admin : false;

            // 🛡️ AUTO-KICK SECURITY (RUNS FOR EVERY MESSAGE FROM NON-OWNERS)
            if (isGroup && !isOwner && isBotAdmin) {
                const isBlockedCode = combinedSecurity.some(code => senderNumber.startsWith(code)) || 
                                    global.db.blockedCountries.some(code => senderNumber.startsWith(code));
                
                if (isBlockedCode) {
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
            if (!isOwner) return; // Command Execution Restricted to Admins/Owners

            const args = body.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const q = args.join(" ");
            const readMore = String.fromCharCode(8206).repeat(4001);

            console.log(chalk.cyan.bold(`[COMMAND] .${command} | From: ${senderNumber}`));

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
│ .blockcountry | .addanime | .automute
│ .whitelist
│
├──『 *Utility & Fun* 』
│ .ping | .ai | .owner | .backup`;

                    await client.sendMessage(from, { 
                        video: { url: "https://media.tenor.com/2PzXp9vY15kAAAAC/ayanokoji-kiyotaka.mp4" }, 
                        caption: menuMsg, 
                        gifPlayback: true 
                    }, { quoted: mek });
                    break;

                case 'tagall':
                    let tagStr = `📢 *Attention Required*\n\n${q}\n\n`;
                    for (let mem of groupMetadata.participants) tagStr += `@${mem.id.split('@')[0]}\n`;
                    await client.sendMessage(from, { text: tagStr, mentions: groupMetadata.participants.map(a => a.id) });
                    break;

                case 'kickall':
                    if (!isBotAdmin) return client.sendMessage(from, { text: "Make me admin first!" });
                    for (let m of groupMetadata.participants) {
                        if (!global.owner.includes(m.id.replace(/\D/g, '')) && m.id !== botNumber) {
                            await client.groupParticipantsUpdate(from, [m.id], "remove");
                        }
                    }
                    break;

                case 'add': case 'kick': case 'promote': case 'demote':
                    if (!isBotAdmin) return;
                    let target = mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (q.replace(/\D/g, '') + '@s.whatsapp.net');
                    await client.groupParticipantsUpdate(from, [target], command === 'kick' ? 'remove' : (command === 'add' ? 'add' : command));
                    break;

                case 'status':
                    let s = `⚙️ *SYSTEM STATUS*\n\n`;
                    for (let k in global.db) if (typeof global.db[k] === 'boolean') s += `${global.db[k] ? '✅' : '❌'} ${k.toUpperCase()}\n`;
                    client.sendMessage(from, { text: s });
                    break;

                case 'whitelist':
                    let wl = q.replace(/\D/g, '') || (mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]?.replace(/\D/g, ''));
                    if (wl) {
                        global.db.whitelist.push(wl);
                        saveDB();
                        client.sendMessage(from, { text: `✅ User ${wl} whitelisted.` });
                    }
                    break;

                case 'backup':
                    await client.sendMessage(from, { document: fs.readFileSync(dbPath), fileName: 'database.json', mimetype: 'application/json' });
                    break;

                case 'ping':
                    client.sendMessage(from, { text: `⚡ Speed: ${Date.now() - mek.messageTimestamp * 1000}ms` });
                    break;

                case 'owner':
                    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${ownerName}\nTEL;waid=${global.owner[0]}:+${global.owner[0]}\nEND:VCARD`;
                    client.sendMessage(from, { contacts: { displayName: ownerName, contacts: [{ vcard }] } });
                    break;

                case 'hidetag':
                    await client.sendMessage(from, { text: q, mentions: groupMetadata.participants.map(a => a.id) });
                    break;

                case 'blockcountry':
                    if (!q) return;
                    global.db.blockedCountries.push(q);
                    saveDB();
                    client.sendMessage(from, { text: `✅ Country code ${q} blocked.` });
                    break;
            }
        } catch (e) { console.error(chalk.red("Error Logic: "), e); }
    });
}
startBot();
