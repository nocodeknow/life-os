const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');

async function main() {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error('\x1b[31mError: config.json not found!\x1b[0m');
        console.log('\nPlease create a \x1b[33mconfig.json\x1b[0m file in this directory with the following structure:');
        console.log(JSON.stringify({
            github_token: "YOUR_GITHUB_PERSONAL_ACCESS_TOKEN",
            github_owner: "YOUR_GITHUB_USERNAME",
            github_repo: "YOUR_GITHUB_REPOSITORY_NAME"
        }, null, 2));
        console.log('\nGet a Personal Access Token (PAT) with "repo" permissions from GitHub (Settings -> Developer Settings -> Personal Access Tokens -> Tokens (classic)).');
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const token = config.github_token;
    const owner = config.github_owner;
    const repo = config.github_repo;
    const filePath = 'index.html';

    if (!token || !owner || !repo) {
        console.error('\x1b[31mError: github_token, github_owner, and github_repo are all required in config.json!\x1b[0m');
        process.exit(1);
    }

    console.log(`Preparing to deploy Life OS to \x1b[36mhttps://${owner}.github.io/${repo}/\x1b[0m ...`);

    const localHtmlPath = path.join(__dirname, 'Life OS.html');
    if (!fs.existsSync(localHtmlPath)) {
        console.error('\x1b[31mError: Life OS.html not found locally!\x1b[0m');
        process.exit(1);
    }

    const localContent = fs.readFileSync(localHtmlPath, 'utf8');
    const base64Content = Buffer.from(localContent, 'utf8').toString('base64');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Antigravity-LifeOS-Deployer'
    };

    let sha = null;

    // 1. Check if the file already exists on GitHub to get its SHA
    try {
        const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
        const response = await fetch(getUrl, { headers });
        if (response.status === 200) {
            const data = await response.json();
            sha = data.sha;
            console.log(`Existing file found on GitHub. SHA: ${sha}`);
        } else if (response.status === 404) {
            console.log('No existing file found on GitHub. Creating a new file.');
        } else {
            const errText = await response.text();
            console.error(`\x1b[31mFailed to inspect file on GitHub: Status ${response.status} - ${errText}\x1b[0m`);
            process.exit(1);
        }
    } catch (err) {
        console.error('\x1b[31mError checking file status on GitHub:\x1b[0m', err);
        process.exit(1);
    }

    // 2. Upload the updated file content
    console.log('Uploading updated Life OS HTML...');
    try {
        const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
        const body = {
            message: `Deploy Life OS updates at ${new Date().toISOString()}`,
            content: base64Content
        };
        if (sha) {
            body.sha = sha;
        }

        const response = await fetch(putUrl, {
            method: 'PUT',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (response.status === 200 || response.status === 201) {
            console.log('\n\x1b[32mDeployment successful!\x1b[0m');
            console.log(`Your app will be live shortly at: \x1b[34mhttps://${owner}.github.io/${repo}/\x1b[0m`);
            console.log('\n\x1b[33mNote:\x1b[0m Make sure GitHub Pages is enabled in your repository settings:');
            console.log('  Settings -> Pages -> Build and deployment -> Source: Deploy from a branch -> Branch: main, Folder: / (root).');
        } else {
            const errText = await response.text();
            console.error(`\x1b[31mDeployment failed: Status ${response.status} - ${errText}\x1b[0m`);
            process.exit(1);
        }
    } catch (err) {
        console.error('\x1b[31mError deploying file to GitHub:\x1b[0m', err);
        process.exit(1);
    }
}

main();
