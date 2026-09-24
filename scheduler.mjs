import cron from 'node-cron';

console.log("🚀 Next.js Auto-Scheduler Started.");
console.log("🕒 The post will automatically generate every day at 7:00 AM.");

// Schedule to run every day at 07:00 AM
cron.schedule('0 7 * * *', async () => {
    console.log("-----------------------------------------");
    console.log(`[${new Date().toISOString()}] Triggering daily post generation...`);
    
    try {
        // Assuming Next.js app is running on localhost:3000
        const res = await fetch('http://localhost:3000/api/daily-post');
        const data = await res.json();
        
        if (res.ok) {
            console.log("✅ Auto-Post Success:", data.message);
        } else {
            console.error("❌ Auto-Post Error:", data.error);
        }
    } catch (e) {
        console.error("❌ Failed to reach Next.js API. Is the server running?", e.message);
    }
});
