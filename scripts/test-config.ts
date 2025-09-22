// scripts/test-config.ts
import { docToSteps } from "../src/llm.js";
import { runSteps } from "../src/config.js";

const sampleDoc = ``;

(async () => {
    console.log("📄 Input doc:\n", sampleDoc);

    // 1. Parse doc with Ollama
    const steps = await docToSteps(sampleDoc);
    console.log("🤖 Parsed steps:", steps);

    // 2. Run steps in Playwright
    await runSteps(steps);

    console.log("✅ Config automation finished");
})();