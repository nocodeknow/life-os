const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const supabaseUrl = 'https://pnpnpuscbmtuaggvvcdx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucG5wdXNjYm10dWFnZ3Z2Y2R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDA0NzgsImV4cCI6MjA5NjgxNjQ3OH0._uN3TiU5E5AIXtKba7FPmNlcTHobkGMB0ZBgTcm4DYM';

const email = process.env.SUPABASE_EMAIL;
const password = process.env.SUPABASE_PASSWORD;
const encryptionPassword = process.env.BACKUP_PASSWORD;

if (!email || !password || !encryptionPassword) {
    console.error("Error: Missing required environment variables: SUPABASE_EMAIL, SUPABASE_PASSWORD, BACKUP_PASSWORD");
    process.exit(1);
}

function encrypt(text, password) {
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(password, salt, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
}

async function runBackup() {
    console.log("Logging into Supabase...");
    try {
        const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!loginRes.ok) {
            console.error("Authentication failed:", loginRes.status, await loginRes.text());
            process.exit(1);
        }

        const loginData = await loginRes.json();
        const accessToken = loginData.access_token;
        const userId = loginData.user.id;
        console.log("Authenticated successfully. Fetching user data...");

        const dbRes = await fetch(`${supabaseUrl}/rest/v1/user_data?user_id=eq.${userId}&select=state,updated_at`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!dbRes.ok) {
            console.error("Fetch data failed:", dbRes.status, await dbRes.text());
            process.exit(1);
        }

        const dbData = await dbRes.json();
        if (!dbData || dbData.length === 0) {
            console.log("No data found in cloud database to backup.");
            process.exit(0);
        }

        const record = dbData[0];
        console.log("Data retrieved. Encrypting...");

        const rawData = JSON.stringify({
            state: record.state,
            updated_at: record.updated_at
        });

        const encryptedData = encrypt(rawData, encryptionPassword);

        const backupsDir = path.join(__dirname, '..', 'backups');
        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
        }

        const backupFilePath = path.join(backupsDir, 'lifeos-backup.enc');
        fs.writeFileSync(backupFilePath, encryptedData, 'utf8');
        console.log(`Backup completed successfully! Encrypted file saved to: ${backupFilePath}`);
    } catch (err) {
        console.error("Backup execution failed:", err);
        process.exit(1);
    }
}

runBackup();
