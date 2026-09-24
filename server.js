const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// Auto-install dependencies if missing on the server
try {
  require.resolve('next');
  require.resolve('node-cron');
} catch (e) {
  console.log('Deployer: Missing dependencies. Running npm install on server...');
  try {
    execSync('npm install --production=false', { stdio: 'inherit' });
    console.log('Deployer: npm install completed successfully!');
  } catch (installErr) {
    console.error('Deployer: npm install failed:', installErr);
  }
}

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
let app = null;
let handle = null;
let isBuilding = false;
let buildError = null;

function runBuildCheck() {
  const nextDir = path.join(__dirname, '.next');
  const hasExistingBuild = fs.existsSync(nextDir);
  
  if (hasExistingBuild) {
    prepareNextApp();
  }
  
  if (dev) return;
  
  if (!hasExistingBuild) {
    isBuilding = true;
    console.log('--- STARTING NEXT.JS BUILD ---');
    const buildProcess = exec('npx next build', (err, stdout, stderr) => {
      isBuilding = false;
      if (err) {
        console.error('Deployer Error during auto-build:', err);
        buildError = err;
      } else {
        console.log('--- NEXT.JS BUILD COMPLETED SUCCESSFULLY ---');
        prepareNextApp();
      }
    });
  }
}

function prepareNextApp() {
  if (app) return; // Prevent multiple initializations
  app = next({ dev });
  handle = app.getRequestHandler();
  app.prepare().then(() => {
    console.log('Next.js app prepared and ready to handle requests.');
    
    // --- START CRON SCHEDULER ---
    console.log("🕒 Initializing Auto-Scheduler for Daily Posts...");
    
    // Extract CRON time from constants.ts (so it doesn't break CommonJS server)
    let cronTime = '0 7 * * *';
    try {
      const constantsContent = fs.readFileSync(path.join(__dirname, 'src/lib/constants.ts'), 'utf-8');
      const match = constantsContent.match(/DAILY_POST_TIME\s*=\s*["']([^"']+)["']/);
      if (match && match[1]) {
        cronTime = match[1];
      }
    } catch (e) {
      console.warn("Could not read constants.ts for CRON time, defaulting to 7 AM.");
    }
    
    console.log(`⏰ Cron Scheduled for: ${cronTime}`);
    cron.schedule(cronTime, async () => {
        console.log(`[${new Date().toISOString()}] Triggering daily post generation...`);
        try {
            // Since this runs within the same server, we can hit localhost:PORT
            // Or better yet, we can hit localhost:3000 if not using passenger, but passenger uses a pipe
            // For simplicity, we just hit the Next.js API route via http://127.0.0.1:3000 if numeric, else we just use the public URL or standard localhost
            const targetUrl = isNumeric ? `http://localhost:${parsedPort}/api/daily-post` : `http://127.0.0.1:3000/api/daily-post`;
            const res = await fetch(targetUrl);
            const data = await res.json();
            console.log("✅ Auto-Post Result:", data);
        } catch (e) {
            console.error("❌ Auto-Post Error:", e.message);
        }
    });
    // --- END CRON SCHEDULER ---
    
  }).catch((err) => {
    console.error('Failed to prepare Next.js app:', err);
    buildError = err;
  });
}

// Hostinger / cPanel Passenger config
const port = process.env.PORT || 3000;
const isNumeric = !isNaN(port) && !isNaN(parseFloat(port));
const parsedPort = isNumeric ? parseInt(port, 10) : port;

const server = createServer(async (req, res) => {
  if (isBuilding) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/html');
    res.end('<h2>Updating Platform... Please refresh in 30 seconds.</h2>');
    return;
  }
  
  if (buildError) {
    res.statusCode = 500;
    res.end(`Build Error: ${buildError.message}`);
    return;
  }

  if (!handle) {
    res.statusCode = 503;
    res.end('Server initializing. Please refresh shortly.');
    return;
  }

  try {
    const parsedUrl = parse(req.url, true);
    await handle(req, res, parsedUrl);
  } catch (err) {
    console.error('Error handling', req.url, err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

server.listen(parsedPort, () => {
  console.log(`> Ready on ${isNumeric ? `http://localhost:${parsedPort}` : `socket/pipe ${parsedPort}`}`);
  runBuildCheck();
});
