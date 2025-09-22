// scripts/test-llm.ts
import { docToSteps } from "../src/llm.js";

const sampleDoc = `
Step1 :- launch :- https://automationexercise.com/
Step2 :- click on Signup / Login
Step3 :- Click on POLO
Step4 :- Click on Test cases
Step5 :- Done
`;

(async () => {
    const steps = await docToSteps(sampleDoc);
    console.log("Parsed steps:", steps);
})();
