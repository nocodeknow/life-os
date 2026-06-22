const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function decrypt(encryptedText, password) {
    const parts = encryptedText.split(':');
    if (parts.length < 3) {
        throw new Error("Invalid encrypted format. Make sure the backup file is correct.");
    }
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
const commitHash = args[1] || 'bf4bba9'; // Default to June 21 backup commit

if (!backupPassword) {
    console.log("\x1b[33mUsage: node scripts/restore-helper.js <your_backup_password> [optional_commit_hash]\x1b[0m");
    console.log("\x1b[33mExample: node scripts/restore-helper.js myPassword123 bf4bba9\x1b[0m\n");
    process.exit(1);
}

const backupsDir = path.join(__dirname, '..', 'backups');
const importReadyPath = path.join(backupsDir, 'lifeos-import-ready.json');

try {
    let encryptedContent = '';
    
    // Check if we should read from a specific git commit or from the local file
    if (commitHash && commitHash !== 'local') {
        console.log(`Retrieving backup from git commit: ${commitHash}...`);
        try {
            encryptedContent = execSync(`git show ${commitHash}:backups/lifeos-backup.enc`, { encoding: 'utf8' }).trim();
        } catch (gitErr) {
            console.error(`\x1b[31mError: Could not retrieve backup from git commit ${commitHash}.\x1b[0m`);
            console.error("Make sure the commit hash is valid and the file existed in that commit.");
            process.exit(1);
        }
    } else {
        const backupPath = path.join(backupsDir, 'lifeos-backup.enc');
        console.log(`Reading backup from local file: ${backupPath}...`);
        if (!fs.existsSync(backupPath)) {
            console.error(`\x1b[31mError: Local backup file not found at ${backupPath}!\x1b[0m`);
            process.exit(1);
        }
        encryptedContent = fs.readFileSync(backupPath, 'utf8').trim();
    }

    console.log("Decrypting backup...");
    const decryptedJson = decrypt(encryptedContent, backupPassword);
    
    // Parse the decrypted data
    const parsed = JSON.parse(decryptedJson);
    
    // Extract the state (which contains projects, tasks, notes, etc.)
    const stateData = parsed.state || parsed;
    
    // Save to the import-ready JSON file
    fs.writeFileSync(importReadyPath, JSON.stringify(stateData, null, 2), 'utf8');
    
    console.log(`\n\x1b[32mSuccess! Decrypted and unwrapped data saved to:\x1b[0m`);
    console.log(`\x1b[36mbackups/lifeos-import-ready.json\x1b[0m\n`);
    console.log(`You can now import this file in the Life OS Web UI:`);
    console.log(`1. Open Life OS in your browser.`);
    console.log(`2. Click the 'Import Backup' / 'Import' button.`);
    console.log(`3. Select the file 'backups/lifeos-import-ready.json'.`);
    console.log(`4. Verify your tasks have been restored!`);
} catch (err) {
    console.error(`\n\x1b[31mDecryption failed!\x1b[0m`);
    console.error("Please double-check your backup password.");
    console.error("Details:", err.message);
    process.exit(1);
}
