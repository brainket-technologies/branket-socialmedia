import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { google } from "googleapis";
import { COMPANY_NAME, SERVICES, GEMINI_API_KEY, SPREADSHEET_ID } from "@/lib/constants";
import path from "path";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export async function POST(req: Request) {
    try {
        // 1. Get current month details
        const date = new Date();
        const monthName = date.toLocaleString('en-US', { month: 'long' });
        const shortMonth = date.toLocaleString('en-US', { month: 'short' });
        const year = date.getFullYear();
        const shortYear = year.toString().slice(-2);
        
        // Let's generate for next month as this runs on the 1st usually, or just current month.
        // For testing we generate current month.
        const tabName = `${shortMonth} ${shortYear}`;
        
        // Days in month
        const daysInMonth = new Date(year, date.getMonth() + 1, 0).getDate();
        
        // 2. Call Gemini API
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" }); 
        const prompt = `
        You are a professional Social Media Manager for '${COMPANY_NAME}'.
        Create a ${daysInMonth}-day daily content calendar for the month of ${monthName}.
        
        The company offers the following services:
        ${SERVICES.join(', ')}
        
        IMPORTANT: Vary the post formats! Mix it up using:
        - Single Image Post
        - Carousel Post (3-5 slides)
        - Short Video / Reel Concept
        - Infographic
        
        OUTPUT FORMAT INSTRUCTIONS:
        Output the data strictly as a CSV format using a pipe '|' character as the delimiter. Do not include any markdown formatting, code blocks, or extra text.
        Do NOT output a header row. Start directly with the first date's row.
        
        IMPORTANT: Combine the Caption Hook, Description, Visual Concept, and at least 15-20 relevant Hashtags into a single cohesive 'Post Content' string. Do NOT use newlines/line breaks inside the cell data, format it simply as one continuous text block or separate parts with spaces/dashes.
        
        Each row MUST have exactly 4 columns:
        Date|Format|Service/Topic|Post Content
        `;

        console.log("Calling Gemini API...");
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        const rawCsv = responseText.replace(/```csv/g, '').replace(/```/g, '').trim();
        const lines = rawCsv.split('\n').filter(line => line.trim().length > 0);
        
        const sheetData = [];
        // Add headers
        sheetData.push(["Date", "Format", "Service/Topic", "Post Content", "Design Status", "Upload Status"]);
        
        for (const line of lines) {
            let row = line.split('|');
            row = row.slice(0, 4);
            while (row.length < 4) row.push("");
            row.push("Pending", "Pending");
            sheetData.push(row);
        }

        // 3. Connect to Google Sheets
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(process.cwd(), 'src/lib/credentials.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        
        const sheets = google.sheets({ version: 'v4', auth });
        
        // Check if tab exists, if not create it
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        let sheetId = null;
        const exists = spreadsheet.data.sheets?.find(s => s.properties?.title === tabName);
        
        if (!exists) {
            console.log(`Creating new tab: ${tabName}`);
            const addSheetResponse = await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    requests: [{ addSheet: { properties: { title: tabName } } }]
                }
            });
            sheetId = addSheetResponse.data.replies?.[0].addSheet?.properties?.sheetId;
        } else {
            console.log(`Tab ${tabName} exists. Clearing it...`);
            sheetId = exists.properties?.sheetId;
            await sheets.spreadsheets.values.clear({
                spreadsheetId: SPREADSHEET_ID,
                range: tabName
            });
        }
        
        // 4. Update data
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${tabName}!A1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: sheetData }
        });
        
        // 5. Add Dropdowns
        if (sheetId != null) {
            try {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: SPREADSHEET_ID,
                    requestBody: {
                        requests: [
                            {
                                setDataValidation: {
                                    range: {
                                        sheetId: sheetId,
                                        startRowIndex: 1,
                                        startColumnIndex: 4,
                                        endColumnIndex: 6
                                    },
                                    rule: {
                                        condition: {
                                            type: "ONE_OF_LIST",
                                            values: [
                                                { userEnteredValue: "Pending" },
                                                { userEnteredValue: "In Progress" },
                                                { userEnteredValue: "Completed" },
                                                { userEnteredValue: "Uploaded" }
                                            ]
                                        },
                                        showCustomUi: true,
                                        strict: true
                                    }
                                }
                            }
                        ]
                    }
                });
            } catch (err) {
                console.log("Could not add dropdowns", err);
            }
        }

        return NextResponse.json({ success: true, message: `Calendar generated for ${tabName}` });

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
