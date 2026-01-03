require("dotenv").config();
const { 
    default: goutamConnect, 
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

// 💾 DATABASE INIT
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({
        antilink: false, antibot: false, antiwame: false, antitagall: false,
        antibadword: false, antispam: false, antifake: false, antidelete: false,
        automute: false, antiban: true, whitelist: [], 
        blockedCountries: ['994', '48', '1', '44'], 
        blacklist: []
    }, null, 2));
}
global.db = JSON.parse(fs.readFileSync(dbPath));
const saveDB = () => fs.writeFileSync(dbPath, JSON.stringify(global.db, null, 2));

// 🔒 CONFIG
const badWords = ["fuck you", "djol santi", "pussy", "bouda santi", "bitch", "masisi", "bouzen", "langet manman w", "santi kk", "gyet manman w", "pouri", "bouda fon", "trip pouri", "koko santi", "kalanbe"];
global.owner = ["212701458617", "85182757527702"]; 
const botName = "GSS-BETA";
const ownerName = "AYANOKOBOT";

async function startHisoka() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    
    const client = goutamConnect({
        version,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "110.0.5481.177"], 
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        markOnlineOnConnect: true
    });

    client.ev.on("creds.update", saveCreds);

    client.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message || mek.key.remoteJid === 'status@broadcast') return;
            
            const from = mek.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const sender = mek.key.participant || from;
            const senderNumber = sender.replace(/[^0-9]/g, '');
            
            // 🔑 OWNER RECOGNITION (TRIPLE CHECKED)
            const isOwner = global.owner.includes(senderNumber) || global.db.whitelist.includes(senderNumber);
            
            const body = (mek.message.conversation || mek.message.extendedTextMessage?.text || mek.message.imageMessage?.caption || "").trim();
            const lowerBody = body.toLowerCase();
            const prefix = ".";
            const isCmd = body.startsWith(prefix);
            const command = isCmd ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : "";
            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(" ");
            const readMore = String.fromCharCode(8206).repeat(4001);

            // 📋 LOGGING UTILITY (KOYEB + WA)
            const logCommand = (status, err = "") => {
                const logMsg = `[ ${status} ] .${command} | User: ${senderNumber}`;
                console.log(status === "EXEC" ? chalk.green.bold(logMsg) : chalk.red.bold(`${logMsg} | Error: ${err}`));
                if (status === "FAIL" && isOwner) client.sendMessage(from, { text: `❌ *FAILED:* ${err}` }, { quoted: mek });
            };

            // 🛡️ AUTO-SECURITY
            if (isGroup && !isOwner) {
                if (global.db.antibadword && badWords.some(word => lowerBody.includes(word))) {
                    return await client.sendMessage(from, { delete: mek.key });
                }
            }

            if (!isCmd) return;
            if (!isOwner) return logCommand("DENIED", "Not Owner");

            const groupMetadata = isGroup ? await client.groupMetadata(from) : null;
            const participants = isGroup ? groupMetadata.participants : [];
            const botNumber = client.user.id.split(':')[0] + '@s.whatsapp.net';
            const isBotAdmin = isGroup ? participants.find(v => v.id == botNumber)?.admin : false;
            const quotedMsg = mek.message.extendedTextMessage?.contextInfo?.quotedMessage;
            let target = mek.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (quotedMsg ? mek.message.extendedTextMessage.contextInfo.participant : null);

            // ⚡ SWITCH CASES FOR ALL COMMANDS
            switch (command) {
                case 'menu':
                    logCommand("EXEC");
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

                // --- ADMIN & GROUP ---
                case 'add':
                case 'kick':
                case 'promote':
                case 'demote':
                    if (!isGroup || !isBotAdmin) return logCommand("FAIL", "Missing Admin Perms");
                    let action = command === 'kick' ? 'remove' : (command === 'add' ? 'add' : command);
                    let user = command === 'add' ? q.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : target;
                    await client.groupParticipantsUpdate(from, [user], action);
                    logCommand("EXEC");
                    break;

                case 'mute':
                case 'unmute':
                    if (!isGroup || !isBotAdmin) return logCommand("FAIL", "Not Admin");
                    await client.groupSettingUpdate(from, command === 'mute' ? 'announcement' : 'not_announcement');
                    logCommand("EXEC");
                    break;

                case 'tagall':
                    if (!isGroup) return;
                    let txt = `*📢 TAG ALL*\n\n${q}\n\n`;
                    for (let mem of participants) { txt += ` @${mem.id.split('@')[0]}\n`; }
                    client.sendMessage(from, { text: txt, mentions: participants.map(a => a.id) });
                    logCommand("EXEC");
                    break;

                case 'hidetag':
                    if (!isGroup) return;
                    client.sendMessage(from, { text: q ? q : '', mentions: participants.map(a => a.id) });
                    logCommand("EXEC");
                    break;

                case 'kickall':
                    if (!isGroup || !isBotAdmin) return logCommand("FAIL", "Admin required");
                    let members = participants.filter(v => v.id !== botNumber && !global.owner.includes(v.id.replace(/[^0-9]/g, '')));
                    for (let m of members) { await client.groupParticipantsUpdate(from, [m.id], "remove"); }
                    logCommand("EXEC");
                    break;

                // --- SECURITY & AUTO ---
                case 'status':
                    let s = `⚙️ *SYSTEM STATUS*\n\n`;
                    for (let key in global.db) { if (typeof global.db[key] === 'boolean') s += `${global.db[key] ? '✅' : '❌'} ${key.toUpperCase()}\n`; }
                    client.sendMessage(from, { text: s });
                    logCommand("EXEC");
                    break;

                case 'antilink': case 'antibot': case 'antifake': case 'antibadword': case 'antiban': case 'automute':
                    global.db[command] = !global.db[command];
                    saveDB();
                    client.sendMessage(from, { text: `✅ ${command.toUpperCase()} is now ${global.db[command] ? 'ON' : 'OFF'}` });
                    logCommand("EXEC");
                    break;

                case 'whitelist':
                    if (!target) return logCommand("FAIL", "Tag someone");
                    let wlNum = target.replace(/[^0-9]/g, '');
                    if (global.db.whitelist.includes(wlNum)) {
                        global.db.whitelist = global.db.whitelist.filter(x => x !== wlNum);
                    } else {
                        global.db.whitelist.push(wlNum);
                    }
                    saveDB();
                    client.sendMessage(from, { text: `✅ Whitelist updated for ${wlNum}` });
                    logCommand("EXEC");
                    break;

                // --- UTILITY ---
                case 'ping':
                    client.sendMessage(from, { text: `⚡ Speed: ${Date.now() - mek.messageTimestamp * 1000}ms` });
                    logCommand("EXEC");
                    break;

                case 'owner':
                    const vcard = 'BEGIN:VCARD\nVERSION:3.0\nFN:' + ownerName + '\nTEL;waid=' + global.owner[0] + ':+' + global.owner[0] + '\nEND:VCARD';
                    client.sendMessage(from, { contacts: { displayName: ownerName, contacts: [{ vcard }] } });
                    logCommand("EXEC");
                    break;

                case 'backup':
                    await client.sendMessage(from, { document: fs.readFileSync(dbPath), fileName: 'database.json', mimetype: 'application/json' });
                    logCommand("EXEC");
                    break;

                default:
                    logCommand("FAIL", "Command not found in system");
            }
        } catch (e) { 
            console.error(e); 
            console.log(chalk.red("CRITICAL ERROR IN UPSERT"));
        }
    });
}
startHisoka();
