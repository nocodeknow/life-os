const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function decrypt(encryptedText, password) {
    const parts = encryptedText.split(':');
    const salt = Buffer.from(parts[0], 'hex');
    const iv = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const key = crypto.scryptSync(password, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

const args = process.argv.slice(2);
const backupPassword = args[0];

if (!backupPassword) {
    console.log("\x1b[33mUsage: node decrypt-backup.js <your_backup_password>\x1b[0m");
    process.exit(1);
}

const backupPath = path.join(__dirname, '..', 'backups', 'lifeos-backup.enc');
const outputPath = path.join(__dirname, '..', 'backups', 'lifeos-recovered.json');

if (!fs.existsSync(backupPath)) {
    console.error("\x1b[31mError: Backup file 'backups/lifeos-backup.enc' not found!\x1b[0m");
    process.exit(1);
}

try {
    const encryptedContent = fs.readFileSync(backupPath, 'utf8').trim();
    console.log("Decrypting backup file...");
    const decryptedJson = decrypt(encryptedContent, backupPassword);
    
    fs.writeFileSync(outputPath, decryptedJson, 'utf8');
    console.log(`\n\x1b[32mSuccess! Decrypted file saved to:\x1b[0m \x1b[34mbackups/lifeos-recovered.json\x1b[0m`);
} catch (err) {
    console.error("\x1b[31mDecryption failed! Please ensure the password is correct.\x1b[0m");
    console.error("Details:", err.message);
    process.exit(1);
}
