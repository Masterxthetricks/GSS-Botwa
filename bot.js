const { getContentType } = require("@whiskeysockets/baileys");
const chalk = require("chalk");
const moment = require("moment-timezone");

module.exports = async (client, mek, chatUpdate) => {
    try {
        const type = getContentType(mek.message);
        const from = mek.key.remoteJid;
        const pushname = mek.pushName || "User";
        
        // Body extraction
        const body = (type === 'conversation') ? mek.message.conversation : 
                     (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : 
                     (type === 'imageMessage') ? mek.message.imageMessage.caption : 
                     (type === 'videoMessage') ? mek.message.videoMessage.caption : '';

        // Prefix and Command logic
        const prefix = /^[\\/!#.]/gi.test(body) ? body.match(/^[\\/!#.]/gi)[0] : '/';
        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : "";
        const args = body.trim().split(/ +/).slice(1);
        const text = args.join(" ");

        // Time Greeting Logic
        const time = moment.tz('Asia/Kolkata').format('HH:mm:ss');
        let greeting = "Good Day";
        if (time < "12:00:00") greeting = "Good Morning 🌄";
        else if (time < "17:00:00") greeting = "Good Afternoon 🌅";
        else if (time < "21:00:00") greeting = "Good Evening 🌃";
        else greeting = "Good Night 🌌";

        if (isCmd) {
            console.log(chalk.black.bgWhite('[ COMMAND ]'), chalk.green(command), 'from', chalk.cyan(pushname));
        }

        switch (command) {
            case 'ping':
                const start = new Date().getTime();
                await client.sendMessage(from, { text: "Pinging..." }, { quoted: mek }).then(async (res) => {
                    const end = new Date().getTime();
                    await client.sendMessage(from, { text: `*Response Speed:* ${end - start}ms`, edit: res.key });
                });
                break;

            case 'alive':
                await client.sendMessage(from, { 
                    text: `*Hi ${pushname}!* \n\nI am alive and active. \n\n*Time:* ${time}\n*Greeting:* ${greeting}`,
                    contextInfo: { 
                        externalAdReply: { 
                            title: "BOT STATUS: ONLINE", 
                            body: "WhatsApp-GPT Beta", 
                            previewType: "PHOTO", 
                            thumbnailUrl: "https://github.com/favicon.ico", 
                            sourceUrl: "https://github.com" 
                        } 
                    }
                }, { quoted: mek });
                break;

            case 'owner':
                await client.sendMessage(from, { text: `Hello ${pushname}, my owner is currently unavailable. You can leave a message here!` }, { quoted: mek });
                break;

            case 'menu':
            case 'help':
                const menuText = `╭––『 *Bot Menu* 』
┆ 
┆ ❏ ${prefix}ping
┆ ❏ ${prefix}alive
┆ ❏ ${prefix}owner
┆ ❏ ${prefix}ai <query>
┆
╰–––––––––––––––༓`;
                await client.sendMessage(from, { text: menuText }, { quoted: mek });
                break;
        }

    } catch (err) {
        console.error("Error in bot.js:", err);
    }
};
