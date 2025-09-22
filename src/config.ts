// src/config.ts
import { chromium } from "playwright";
import type { Step } from "./llm.js";

/**
 * Executes parsed steps with Playwright.
 * Launches a Chromium browser, performs actions, then closes.
 */
export async function runSteps(steps: Step[]) {
    const browser = await chromium.launch({ headless: false, slowMo: 500 });
    const page = await browser.newPage();

    for (const step of steps) {
        if (step.action.toLowerCase() === "launch" && step.target) {
            console.log(`🌐 Launching ${step.target}`);
            await page.goto(step.target);
        } else if (step.action.toLowerCase() === "click" && step.target) {
            console.log(`🖱️ Clicking "${step.target}"`);
            try {
                await page.getByText(step.target, { exact: false }).first().click();
            } catch (e) {
                console.warn(`⚠️ Could not click "${step.target}"`);
            }
        }
    }

    await browser.close();
    console.log("✅ Done running config steps");
}