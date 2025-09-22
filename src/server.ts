// src/server.ts
import express from "express";
import dotenv from "dotenv";
import { triggerJenkinsJob, waitForBuildFromQueue, waitForBuildResult } from "./jenkins.js";
import { downloadFile } from "./files.js";
import { parseFileToText } from "./parser.js";
import { docToSteps } from "./llm.js";
import { runSteps } from "./config.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const BOT_TOKEN = process.env.WEBEX_BOT_TOKEN || "";
const BOT_ID = process.env.WEBEX_BOT_ID || "";

/**
 * Helper to call Webex REST API (uses global fetch in modern Node)
 */
async function webexFetch(path: string, options: RequestInit = {}) {
    const base = "https://webexapis.com/v1";
    const headers = {
        Authorization: `Bearer ${BOT_TOKEN}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };
    const res = await fetch(`${base}${path}`, { ...options, headers });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Webex API error ${res.status}: ${text}`);
    }
    return res.json();
}

/**
 * When Webex creates a message, it POSTs an event with data.id (the message id).
 * We must fetch the message to get full text and personId.
 */
async function fetchMessageById(messageId: string) {
    // GET /v1/messages/{messageId}
    return webexFetch(`/messages/${messageId}`);
}

/**
 * Send a message into a room
 */
async function sendMessage(roomId: string, text: string) {
    return webexFetch("/messages", {
        method: "POST",
        body: JSON.stringify({ roomId, text }),
    });
}

// --- basic parser for Jenkins commands ---
function parseJenkinsCommand(text: string) {
    const result: { jobName?: string; instanceUrl?: string; version?: string } = {};

    // find URL
    const urlMatch = text.match(/https?:\/\/[^\s)]+/i);
    if (urlMatch) result.instanceUrl = urlMatch[0];

    // find version
    const versionMatch = text.match(/version\s*[:=]?\s*([A-Za-z0-9._-]+)/i)
        || text.match(/\bv(\d+\.\d+\.\d+)\b/i)
        || text.match(/\b(\d{2,})\b/);
    if (versionMatch) result.version = versionMatch[1] || versionMatch[0];

    // crude job name guess: word "TestPR" or "TESTCDH" present
    if (/testpr/i.test(text)) result.jobName = "TestPR";
    else if (/testcdh/i.test(text)) result.jobName = "TESTCDH";

    return result;
}

/**
 * /webhook endpoint receives events from Webex
 */
app.post("/webhook", async (req, res) => {
    // Acknowledge quickly so Webex doesn't retry
    res.sendStatus(200);

    try {
        const event = req.body;
        if (!event || !event.data || !event.data.id) {
            console.log("Webhook payload missing data.id:", event);
            return;
        }

        const messageId = event.data.id;

        // Fetch the full message (text, roomId, personId, personEmail)
        const message = await fetchMessageById(messageId);

        // Ignore messages from the bot itself (prevents loops)
        if (message.personId === BOT_ID || message.personEmail?.includes("webex.bot")) {
            console.log("Ignoring message from bot itself:", messageId);
            return;
        }

        const roomId: string = message.roomId;
        const originalText: string = message.text || "";

        // 1) Clean the message by removing mentions like "@CandyAI" or other @something tokens
        //    This leaves the human-readable instruction only.
        const cleanedText = originalText.replace(/@\S+/g, "").trim();

        // normalized forms for command detection (case-insensitive)
        const normalizedOriginal = originalText.toLowerCase();
        const normalizedClean = cleanedText.toLowerCase();

        // 2) Single-line concise log for easy scanning
        console.log(`[MSG] id=${messageId} room=${roomId} from=${message.personEmail} text="${cleanedText}"`);

        // 3) Command detection: check either the original (with @) or the cleaned text
        if (normalizedOriginal.includes("@jenkins") || normalizedClean.includes("jenkins")) {
            // parse jobName, INSTANCE_URL and VERSION (your existing parseJenkinsCommand)
            const parsed = parseJenkinsCommand(originalText + " " + cleanedText);
            const jobName = parsed.jobName;
            const params: Record<string, string> = {};
            if (parsed.instanceUrl) params["INSTANCE_URL"] = parsed.instanceUrl;
            if (parsed.version) params["VERSION"] = parsed.version;

            if (!jobName) {
                await sendMessage(roomId, "🔧 I couldn't identify the job name. Try: `@jenkins run TestPR version 123 on https://...`");
                return;
            }

            // safety whitelist (keep it)
            const KNOWN = ["TestPR", "TESTCDH"];
            if (!KNOWN.map(k => k.toLowerCase()).includes(jobName.toLowerCase())) {
                await sendMessage(roomId, `❗ Job "${jobName}" not allowed. Allowed: ${KNOWN.join(", ")}`);
                return;
            }

            await sendMessage(roomId, `🔧 Triggering Jenkins job ${jobName} with ${JSON.stringify(params)}`);
            try {
                const queueUrl = await triggerJenkinsJob(jobName, params);
                await sendMessage(roomId, `🔁 Job queued: ${queueUrl}`);
                // Optional wait and report:
                const { buildUrl, buildNumber } = await waitForBuildFromQueue(queueUrl);
                await sendMessage(roomId, `▶️ Build started: ${buildUrl}`);
                const build = await waitForBuildResult(jobName, buildNumber);
                await sendMessage(roomId, `✅ Build finished: result=${build.result}`);
            } catch (e: any) {
                console.error("Jenkins error:", e);
                await sendMessage(roomId, `❌ Jenkins error: ${e.message}`);
            }
            return;
        }

        // === robust @config handler (paste into your webhook handler) ===
        if (normalizedOriginal.includes("@config") || normalizedClean.includes("config")) {
            try {
                // fetch the full message again (we need the message object to get files)
                const message = await fetchMessageById(event.data.id);
                const files = message.files || event.data.files || [];

                if (!files || files.length === 0) {
                    await sendMessage(roomId, "⚠️ Please attach a .docx or .pdf file and try again.");
                    return;
                }

                const fileUrl = files[0];
                console.log("[CONFIG] message.files:", files);
                console.log("[CONFIG] using fileUrl:", fileUrl);

                await sendMessage(roomId, `📥 Got file: ${fileUrl}`);

                // 1) download file (downloadFile expects fileUrl and bot token)
                const localPath = await downloadFile(fileUrl, BOT_TOKEN);
                console.log("[CONFIG] downloaded to:", localPath);

                // 2) parse to text
                let text = await parseFileToText(localPath);
                console.log("[CONFIG] raw parsed text (first 500 chars):", text.slice(0, 500));

                // 2b) quick normalize: ensure steps are on separate lines and URLs are separated from 'Step'
                // Insert newline before occurrences of "Step" that follow other text
                text = text.replace(/Step(?=\d)/g, "\nStep");
                // Ensure URLs followed by 'Step' get a newline between them
                text = text.replace(/(https?:\/\/\S+)(?=\s*Step)/g, "$1\n");

                console.log("[CONFIG] normalized text (first 500 chars):", text.slice(0, 500));

                // 3) send to LLM to get steps
                const steps = await docToSteps(text);
                console.log("[CONFIG] parsed steps from LLM:", steps);

                if (!steps || steps.length === 0) {
                    await sendMessage(roomId, "❌ Could not parse any steps from the document.");
                    return;
                }

                // 4) run steps with Playwright
                await sendMessage(roomId, `▶️ Running ${steps.length} step(s) from the document... (this may take a few seconds)`);
                await runSteps(steps);

                // 5) done
                await sendMessage(roomId, `✅ Config completed successfully with ${steps.length} steps.`);
            } catch (err: any) {
                console.error("Config error:", err);
                await sendMessage(roomId, `❌ Config failed: ${err?.message || err}`);
            }
            return;
        }


        if (normalizedOriginal.includes("@test") || normalizedClean.includes("test")) {
            await sendMessage(roomId, "🧪 Got @test command — will run tests when implemented.");
            return;
        }

        // Default: echo the cleaned message (without the mention)
        await sendMessage(roomId, `👋 Hello — I received your message: "${cleanedText || originalText}"`);
    } catch (err) {
        console.error("Error handling webhook:", err);
    }
});

/**
 * Healthcheck
 */
app.get("/", (_req, res) => res.send("Webex AI Agents webhook running ✅"));

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
