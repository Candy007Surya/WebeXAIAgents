// src/parser.ts
/**
 * Simple document parsing helpers.
 * Supports: .docx (via mammoth), .pdf (via pdf-parse), .md/.txt (plain text).
 *
 * Exports: parseFileToText(filePath)
 *
 * Usage: const text = await parseFileToText("/path/to/tmp/upload-123.docx")
 */

import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import pdf from "pdf-parse";

export async function parseFileToText(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".docx") {
        // mammoth extracts clean text from docx
        const buffer = await fs.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer });
        return result.value || "";
    }

    if (ext === ".pdf") {
        const buffer = await fs.readFile(filePath);
        // import pdf only when needed
        const pdf = (await import("pdf-parse")).default;
        const data = await pdf(buffer);
        return data.text || "";
    }

    // fallback for .md, .txt or unknown: read as utf-8
    try {
        const txt = await fs.readFile(filePath, "utf8");
        return txt;
    } catch (e) {
        // last-resort: return empty string
        console.warn("parseFileToText: failed to read file as text", e);
        return "";
    }
}