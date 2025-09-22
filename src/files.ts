// src/files.ts
import fs from "fs/promises";
import fetch from "node-fetch"; // already available in Node 18+ but safer for compat
import path from "path";

export async function downloadFile(fileUrl: string, token: string): Promise<string> {
    const res = await fetch(fileUrl, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error(`Failed to download file: ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // save to tmp folder
    const tmpPath = path.join(process.cwd(), "tmp", `upload-${Date.now()}.docx`);
    await fs.mkdir(path.dirname(tmpPath), { recursive: true });
    await fs.writeFile(tmpPath, buffer);

    return tmpPath;
}