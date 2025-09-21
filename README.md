# 🤖 Webex AI Agents

## 🎯 Project Goal
Showcase how **free/local LLMs + Webex bots** can automate DevOps/SDET workflows with simple chat commands.

- **Motivation**: Replace manual effort with natural chat (`@jenkins`, `@config`, `@test`) in Webex.  
- **Principle**: Use **local or free-tier tools** (no paid APIs/services).

---

## 🏗️ High-Level Architecture
Webex (user message)
│
▼
Webhook → Node.js backend (Express)
│
├── LLM Layer (free/local: Ollama, HF free API, OpenRouter free tier)
│
├── @jenkins → Jenkins (running locally in Docker)
│
├── @config → Doc Parser + LLM → Playwright (browser automation)
│
└── @test → Doc Parser + LLM → Playwright (test runner)


---

## 🔑 Core Flows

### 🟢 `@jenkins`
- **Trigger**: `@jenkins jobName version=1.2.3`
- **Flow**:
  1. Backend receives command  
  2. Calls local **Jenkins REST API**  
  3. Jenkins runs job → reports back  
  4. Bot posts build status & log summary to Webex  
- **LLM role**: optional → parse natural language variations  

---

### 🟡 `@config`
- **Trigger**: `@config setup.docx`
- **Flow**:
  1. Backend extracts text from `.docx`, `.pdf`, `.md`  
  2. Sends text → **LLM**  
  3. LLM outputs structured steps (open browser, click, fill, etc.)  
  4. Backend → Playwright executes these steps  
  5. Bot posts success/failure summary to Webex  
- **LLM role**: core → convert doc into automation plan  

---

### 🔵 `@test`
- **Trigger**: `@test testcases.xlsx`
- **Flow**:
  1. Backend extracts test steps  
  2. Sends them → **LLM**  
  3. LLM outputs Playwright test steps or script  
  4. Backend runs Playwright  
  5. Bot posts results back to Webex  
- **LLM role**: core → transform test cases into runnable automation  

---

## 📦 Infrastructure & Tools
- 🤖 **Bot Framework**: Webex Developer Bot + Express.js backend  
- 🌐 **Automation**: Playwright (TypeScript)  
- 🔧 **CI/CD Trigger**: Jenkins (Docker container, local)  
- 🧠 **LLM Layer (Free)**: Ollama, Hugging Face Free API, OpenRouter free-tier models  
- 📑 **Doc Parsing**: `mammoth`, `docx`, `pdf-parse`, `xlsx`  

---

## 🛠️ Development Milestones

### ✅ Level 0 — Infra Ready
- [x] Create Webex Bot  
- [x] Install Node.js + Playwright  
- [ ] Run Jenkins locally (Docker)  
- [ ] Install ngrok  
- [ ] Initialize git repo  

### 🚀 Level 1 — Minimal Bot
- [ ] Webhook receiver working  
- [ ] Parse Webex messages  
- [ ] Hardcode flows for `@jenkins`, `@config`, `@test`  

### ⚡ Level 2 — Real Jenkins Trigger
- [ ] Start Jenkins job from `@jenkins`  
- [ ] Get build status & logs  
- [ ] Post summary back to Webex  

### 🖥️ Level 3 — Doc Parsing + Playwright
- [ ] Extract text from docs  
- [ ] LLM parses doc → generate steps  
- [ ] Run via Playwright  
- [ ] Post results to Webex  

### 🧪 Level 4 — Test Runner (`@test`)
- [ ] Extract test cases from `.xlsx`  
- [ ] LLM → Playwright steps/tests  
- [ ] Run and post reports  

### 🌟 Level 5 — Nice-to-Have Features
- [ ] Upload reports to Webex  
- [ ] Bot remembers last state  
- [ ] Containerize bot for easy sharing  

---

## 🎯 Showcase Value
- 🆓 100% free stack → runs on **local infra** or free APIs  
- 🤖 Demonstrates **how LLMs + bots accelerate DevOps/SDET workflows**  
- 📊 Useful **demo project for interviews or portfolio**  

---
