/**
 * scripts/dev.ts
 *
 * Usage: npm run dev
 *
 * What it does:
 *  - loads .env
 *  - starts localtunnel (port from PORT env or 3000)
 *  - deletes existing Webex webhooks for this bot
 *  - creates a new webhook pointing to <tunnel>/webhook
 *  - spawns the server (npm run start or tsx src/server.ts)
 *
 * Notes:
 *  - Requires WEBEX_BOT_TOKEN in .env
 *  - This uses localtunnel (no ngrok required)
 */

import dotenv from "dotenv";
dotenv.config();

import localtunnel from "localtunnel";
import fetch from "node-fetch";
import { spawn } from "child_process";

const BOT_TOKEN = process.env.WEBEX_BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error("Missing WEBEX_BOT_TOKEN in .env — please add it and re-run.");
    process.exit(1);
}
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function webexApi(path: string, opts: { method?: string; body?: any } = {}) {
    const base = "https://webexapis.com/v1";
    const headers: any = {
        Authorization: `Bearer ${BOT_TOKEN}`,
    };
    if (opts.body) headers["Content-Type"] = "application/json";
    const res = await fetch(`${base}${path}`, {
        method: opts.method || "GET",
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = text; }
    if (!res.ok) {
        throw new Error(`Webex API ${res.status} ${res.statusText}: ${text}`);
    }
    return json;
}

async function resetWebhooks(tunnelUrl: string) {
    console.log("Listing existing webhooks...");
    const list = await webexApi("/webhooks");
    const items = list?.items ?? [];
    if (items.length === 0) {
        console.log("No webhooks to delete.");
    } else {
        for (const wh of items) {
            console.log(`Deleting webhook: ${wh.id} -> ${wh.targetUrl}`);
            await webexApi(`/webhooks/${wh.id}`, { method: "DELETE" });
        }
    }

    console.log("Creating new webhook...");
    const newWh = await webexApi("/webhooks", {
        method: "POST",
        body: {
            name: "webex-ai-agents-dev-webhook",
            targetUrl: `${tunnelUrl}/webhook`,
            resource: "messages",
            event: "created",
        },
    });

    console.log("✅ New webhook created:", newWh.id);
    console.log("   Target URL:", newWh.targetUrl);
    return newWh;
}

async function main() {
    console.log(`Starting localtunnel for port ${PORT}... (this may take 1-2s)`);
    // start localtunnel programmatically
    const tunnel = await localtunnel({ port: PORT });
    // localtunnel returns an object with `url` property like 'https://abc.loca.lt'
    console.log("Tunnel URL:", tunnel.url);

    try {
        await resetWebhooks(tunnel.url);
    } catch (err) {
        console.error("Failed to reset webhooks:", err);
        await tunnel.close();
        process.exit(1);
    }

    // spawn the server via tsx (assumes npm script 'start' or direct tsx)
    console.log("Launching server (tsx src/server.ts) ...");
    const serverProc = spawn("npx", ["tsx", "src/server.ts"], {
        stdio: "inherit",
        shell: true,
        env: { ...process.env, PORT: String(PORT) },
    });

    // handle clean shutdown
    const cleanup = async () => {
        console.log("\nShutting down...");
        try {
            await tunnel.close();
            console.log("Tunnel closed.");
        } catch (e) { /* ignore */ }
        if (!serverProc.killed) {
            serverProc.kill();
        }
        process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // if server process exits unexpectedly, close tunnel and exit
    serverProc.on("exit", async (code) => {
        console.log(`Server process exited with code ${code}. Closing tunnel...`);
        try { await tunnel.close(); } catch (e) { }
        process.exit(code ?? 0);
    });
}

main().catch((err) => {
    console.error("Fatal error in dev script:", err);
    process.exit(1);
});