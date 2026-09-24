import { NextResponse } from "next/server";
import { google } from "googleapis";
import { SPREADSHEET_URL, GEMINI_API_KEY, COMPANY_NAME } from "@/lib/constants";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

const SPREADSHEET_ID = SPREADSHEET_URL.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] || SPREADSHEET_URL;

export async function GET(req: Request) {
    try {
        // 1. Determine today's date and find the current month's tab
        const date = new Date();
        const shortMonth = date.toLocaleString('en-US', { month: 'short' });
        const shortYear = date.getFullYear().toString().slice(-2);
        const tabName = `${shortMonth} ${shortYear}`;
        
        // Format today's date to match exactly how the AI generated it (e.g. 2026-09-24 or similar)
        // Since we didn't enforce a strict date format in the AI prompt previously, we'll fetch all rows and do a partial match.
        const todayStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const dayOnly = date.getDate().toString();

        console.log(`Starting Daily Post Generation for ${todayStr}`);

        // 2. Fetch data from Google Sheets
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(process.cwd(), 'src/lib/credentials.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });
        
        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${tabName}!A2:D35` // Skip header
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return NextResponse.json({ success: false, error: "No data found in today's calendar." }, { status: 404 });
        }

        // Find today's row
        const todayRow = rows.find(row => {
            const rowDate = row[0] || "";
            return rowDate.includes(todayStr) || rowDate.startsWith(dayOnly) || rowDate.includes(shortMonth); // basic matching
        });

        if (!todayRow) {
            return NextResponse.json({ success: false, error: "Today's date not found in the calendar." }, { status: 404 });
        }

        const format = todayRow[1];
        const topic = todayRow[2];
        const postContent = todayRow[3];

        console.log(`Found Topic: ${topic}`);

        // 3. Generate Image using Gemini (Imagen 3 API via REST)
        // We will construct a highly detailed prompt based on Brainket Brand Rules
        const imagePrompt = `
        A professional, modern, and high-quality social media graphic for '${COMPANY_NAME}'.
        Topic: ${topic}.
        Brand Colors: Primary is Teal/Cyan (#006567), Secondary is Lime Green (#B0D400), with white and dark backgrounds.
        Style: Premium technology agency, clean UI/UX style, glassmorphism, 3d minimal elements.
        Text on image: '${topic}'. Use bold, clean typography (like Josefin Sans).
        Do not use any other company logos or colors. Keep it highly professional and aesthetic.
        `;

        console.log("Calling Gemini Imagen API...");
        const geminiImageResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instances: [
                        { prompt: imagePrompt }
                    ],
                    parameters: {
                        sampleCount: 1
                    }
                })
            }
        );

        if (!geminiImageResponse.ok) {
            const errText = await geminiImageResponse.text();
            throw new Error(`Gemini Image API Error: ${errText}`);
        }

        const imageData = await geminiImageResponse.json();
        const base64Image = imageData.predictions?.[0]?.bytesBase64Encoded;

        if (!base64Image) {
            throw new Error("No image data returned from Gemini API.");
        }

        // 4. Save Image and Text Locally
        const folderName = todayStr;
        const targetDir = path.join(process.cwd(), 'public', 'generated_posts', folderName);
        
        if (!existsSync(targetDir)) {
            await fs.mkdir(targetDir, { recursive: true });
        }

        const safeTopic = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const imagePath = path.join(targetDir, `${safeTopic}.png`);
        const textPath = path.join(targetDir, `${safeTopic}.txt`);

        // Write Image
        await fs.writeFile(imagePath, Buffer.from(base64Image, 'base64'));
        
        // Write Text
        await fs.writeFile(textPath, `Topic: ${topic}\nFormat: ${format}\n\n${postContent}`);

        console.log(`✅ Success! Post saved to ${targetDir}`);

        return NextResponse.json({ 
            success: true, 
            message: `Successfully generated and saved post for ${todayStr}`,
            files: {
                image: `/generated_posts/${folderName}/${safeTopic}.png`,
                text: `/generated_posts/${folderName}/${safeTopic}.txt`
            }
        });

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
