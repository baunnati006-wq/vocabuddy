# VocaBuddy — NVIDIA AI Voice Coach (V3.2)

VocaBuddy is an interactive AI English speaking coach powered by NVIDIA NIM microservices. It helps learners master everyday conversations, workplace communication, job interviews, presentations, and business meetings with instant synthetic speech and polite grammar coaching.

---

## Key Capabilities & Architecture

- **Reasoning & Coaching:** NVIDIA Nemotron 3.5 Lightning (`nvidia/nemotron-3.5-lightning-30b-a3b`) via NVIDIA NIM Chat Completions API with low-latency direct generation.
- **Voice Synthesis:** NVIDIA Magpie Multilingual TTS (`/v1/audio/synthesize`) featuring high-fidelity natural speech (`Magpie-Multilingual.EN-US.Aria` and `Magpie-Multilingual.HI-IN.Leo`).
- **Multilingual Support:** English learning with native explanations in **Hindi, Gujarati, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, and Punjabi**.
- **Voice Recognition:** Web Speech API with live interim transcript display and automatic text fallback.
- **Turn-Based Voice Interaction:** Audio interrupt and instant stop capabilities so the learner can speak or interrupt at any moment.
- **8 Dedicated Practice Tracks:**
  1. Everyday Conversations
  2. Workplace & Professional English
  3. Job Interview Simulation (STAR method coaching)
  4. Agile & Team Meeting Simulations
  5. Slide Presentations & Pitch Coaching
  6. Real-Life Roleplay Scenarios (Cafe, Hotel, Client, Airport)
  7. Grammar & Sentence Polish
  8. Vocabulary Booster
- **End-of-Session Learning Reports:**
  - Communication Strengths
  - Areas for Improvement
  - Common Grammar Mistakes & Natural Alternatives
  - Words Learned & Key Vocabulary
  - Recommended Next Practice Activity
  - One-click copy and text file download

---

## Local Setup & Development

### 1. Prerequisites
- **Node.js 20+** (`node -v`)
- **npm** (`npm -v`)
- An NVIDIA API Catalog Key from [build.nvidia.com](https://build.nvidia.com)

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root of the project (copy from `.env.example`):
```bash
cp .env.example .env
```

Ensure `.env` contains:
```env
NVIDIA_API_KEY=your_nvidia_api_key_here
NVIDIA_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
NVIDIA_MAGPIE_EN_VOICE=Magpie-Multilingual.EN-US.Aria
NVIDIA_MAGPIE_HI_VOICE=Magpie-Multilingual.HI-IN.Leo
PORT=3000
```
*(Never commit `.env` to version control. It is already included in `.gitignore`.)*

### 4. Run the Server
```bash
npm start
```
Open **`http://localhost:3000`** in Google Chrome or any modern browser.

---

## Deployment to Render (Production)

Render provides free or low-cost hosting for Node.js web services with automatic HTTPS, which is required for microphone access in production.

### Step 1: Initialize Git Repository
In your local project folder:
```bash
git init
git add .
git commit -m "feat: VocaBuddy NVIDIA V3.2 deployment ready"
```
*(Verify with `git status` that `.env` and `node_modules/` are NOT staged).*

### Step 2: Push to Private GitHub Repository
1. Go to [github.com/new](https://github.com/new) and create a **Private** repository (e.g., `vocabuddy-nvidia-v3_2`).
2. Link your local project and push:
```bash
git remote add origin https://github.com/YOUR_USERNAME/vocabuddy-nvidia-v3_2.git
git branch -M main
git push -u origin main
```

### Step 3: Create Web Service on Render
1. Log in to [render.com](https://render.com) and click **New + > Web Service**.
2. Connect your GitHub account and select your `vocabuddy-nvidia-v3_2` repository.
3. Configure the service settings:
   - **Name:** `vocabuddy-ai` (or your preferred name)
   - **Region:** Choose closest region (e.g. Frankfurt, Oregon, Singapore)
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free` or `Starter`

### Step 4: Configure Environment Variables on Render
Under the **Environment Variables** section on Render, add:
- `NVIDIA_API_KEY`: Your NVIDIA API Catalog key (starts with `nvapi-...`)
- `NVIDIA_MODEL`: `nvidia/nemotron-3.5-lightning-30b-a3b`
- `NVIDIA_MAGPIE_EN_VOICE`: `Magpie-Multilingual.EN-US.Aria`
- `NVIDIA_MAGPIE_HI_VOICE`: `Magpie-Multilingual.HI-IN.Leo`
- `NODE_ENV`: `production`

*(Note: Render automatically assigns the `PORT` variable, and `server.js` automatically binds to `process.env.PORT || 3000` on `0.0.0.0`).*

### Step 5: Deploy & Verify
1. Click **Create Web Service**. Render will install dependencies and start the app.
2. Once the deploy completes, open your HTTPS URL (e.g., `https://vocabuddy-ai.onrender.com`).
3. Click "Allow" when the browser requests microphone permissions over HTTPS.
4. Test conversational speech, Magpie audio generation, and the end-of-session report.

---

## API Endpoints Reference

- **`GET /api/health`** — Service health, active model, TTS engine, supported tracks, and configured status.
- **`POST /api/chat`** — Conversation completions via NVIDIA Nemotron with context history, learning tracks, and multilingual guidance.
- **`POST /api/speech`** — Text-to-speech synthesis using NVIDIA Magpie Multilingual endpoint with audio/wav streaming and browser fallback negotiation.

---

## Security & Best Practices

- **Zero-Leak Server Architecture:** The NVIDIA API key is strictly stored server-side in `.env` and never exposed to the frontend or browser DevTools.
- **Safe Rate Limiting:** Built-in rate limiting (150 requests / 10 min window per IP) prevents abuse while ensuring uninterrupted speaking sessions.
- **Input Sanitization:** Text inputs and lengths are strictly bounded to protect against denial of service or excessive token consumption.
- **Clean Audio Normalization:** Markdown asterisks, backticks, emojis, and symbols are automatically stripped prior to TTS synthesis to guarantee natural pronunciation.
