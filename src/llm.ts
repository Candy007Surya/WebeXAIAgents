// src/llm.ts
/**
 * Calls Ollama (local LLM) to parse doc text into structured steps.
 * Requires Ollama running locally (default port 11434).
 */

export type Step = { action: string; target?: string };

export async function docToSteps(docText: string): Promise<Step[]> {
    const prompt = `
You are an automation planner.
Convert the following document into a JSON array of steps.
Each step must be an object: { "action": string, "target": string? }.
Valid actions: "launch", "click", "done".
Doc:
${docText}
`;

    const res = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "gemma3:1b", // the model you pulled
            prompt,
            stream: false,
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama error: ${text}`);
    }

    const data = await res.json();

    // Ollama responses have { response: "..." }
    const raw = data.response.trim();

    // Try to extract JSON array from the response
    try {
        const jsonStart = raw.indexOf("[");
        const jsonEnd = raw.lastIndexOf("]");
        const json = raw.substring(jsonStart, jsonEnd + 1);
        return JSON.parse(json);
    } catch (e) {
        console.error("Failed to parse LLM output:", raw);
        throw new Error("Could not parse JSON steps from LLM");
    }
}
