import express from "express";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b";
const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MAGPIE_BASE = "https://877104f7-e885-42b9-8de8-f6e4c6303969.invocation.api.nvcf.nvidia.com/v1/audio";

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=(self)");
  next();
});
app.use(express.json({ limit: "50kb" }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// Generous rate limiting for back-and-forth speech conversations
const sessionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 150,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Session rate limit reached. Please pause for a moment and try again." }
});
app.use("/api/", sessionLimiter);

const languages = new Set([
  "English", "Hindi", "Gujarati", "Marathi", "Bengali",
  "Tamil", "Telugu", "Kannada", "Malayalam", "Punjabi"
]);

const tracks = new Set([
  "everyday", "professional", "both", "interview",
  "meeting", "presentation", "roleplay", "grammar_vocab"
]);

const levels = new Set(["beginner", "intermediate", "advanced"]);

function getPreferences(body = {}) {
  return {
    language: languages.has(body.language) ? body.language : "Hindi",
    track: tracks.has(body.track) ? body.track : "both",
    level: levels.has(body.level) ? body.level : "beginner"
  };
}

function buildInstructions({ language, track, level }) {
  const languageInstruction = language === "English"
    ? "Explain exclusively in clear, natural English."
    : `Speak primarily in English. When explaining difficult vocabulary, grammar subtleties, or corrections, give a brief, natural explanation in ${language}. Do not translate every sentence; encourage the learner to think and speak in English.`;

  let trackInstruction = "";
  switch (track) {
    case "interview":
      trackInstruction = "Act as an experienced, supportive job interviewer. Ask realistic interview questions one by one (behavioral, technical, or situational). Coach the learner to structure answers effectively (e.g. using the STAR method), speak with confidence, and use professional vocabulary.";
      break;
    case "meeting":
      trackInstruction = "Simulate an agile corporate workplace meeting. Practice leading updates, agreeing or disagreeing diplomatically, clarifying action items, and expressing business ideas clearly.";
      break;
    case "presentation":
      trackInstruction = "Coach the learner on presentation and pitch delivery. Focus on clear signposting ('First, let's look at...'), engaging hooks, smooth vocal transitions, and handling Q&A gracefully.";
      break;
    case "roleplay":
      trackInstruction = "Engage in vivid real-life role-play scenarios (e.g., negotiating with a client, ordering at a busy cafe, resolving customer disputes, checking into a hotel). Stay in character while subtly guiding English usage.";
      break;
    case "grammar_vocab":
      trackInstruction = "Act as an attentive language coach. Gently highlight grammatical errors, suggest more natural collocations and idioms, and teach high-impact vocabulary words in practical contexts.";
      break;
    case "professional":
      trackInstruction = "Focus on workplace and professional English: meetings, client communications, presentations, career discussions, and polite business tone.";
      break;
    case "everyday":
      trackInstruction = "Focus on practical daily conversations: making friends, small talk, ordering food, travel, hobbies, and casual storytelling.";
      break;
    default:
      trackInstruction = "Blend everyday communication with practical professional English. Adapt dynamically to the learner's conversational topics.";
  }

  const levelInstruction = level === "beginner"
    ? "The learner is a beginner. Use simple sentence structures, clear common vocabulary, and a warm, patient pace. Offer gentle sentence starters when they seem unsure."
    : level === "advanced"
      ? "The learner is advanced. Encourage sophisticated vocabulary, nuanced idiomatic expressions, varied sentence variety, and executive presence."
      : "The learner is intermediate. Use natural conversational pacing, introduce useful idiomatic collocations, and refine awkward phrasing.";

  return `You are VocaBuddy, a warm, encouraging, human-like AI English speaking coach.
VOICE & CONVERSATIONAL STYLE:
- Sound like a friendly, attentive speaking partner, never an academic lecturer or robotic IVR.
- Use natural contractions (I'm, that's, let's, don't) and conversational rhythm.
- Spoken responses MUST be concise: 1 to 3 short sentences, then ask exactly ONE engaging question to keep the conversation flowing.
- Never write long paragraphs during back-and-forth turns. The response will be spoken aloud via text-to-speech.
- Avoid robotic flattery (e.g. don't start every sentence with "Great job!"). Be genuine, warm, and specific.

TEACHING METHODOLOGY:
- Understand the learner's intended message first.
- If they make a grammar or word choice error, gently acknowledge their idea, provide the natural phrase, and move forward seamlessly.
- Highlight sentence improvements without interrupting the flow of conversation.
- When introducing a new vocabulary word, use it in context with an immediate example.

END-OF-SESSION LEARNING REPORT:
- Whenever the user asks for a session review, learning report, or feedback summary, format your response clearly into these exact sections:
  1. 🌟 Communication Strengths (2 specific things the learner did well)
  2. 🔍 Areas for Improvement (key points to focus on next)
  3. ✏️ Common Grammar & Sentence Improvements (original mistake vs natural alternative and why)
  4. 📚 Words Learned & Key Vocabulary (2-3 words/phrases with clear meanings and examples)
  5. 🎯 Recommended Next Practice Activity (a concrete action for their next session)
- Never fabricate numerical pronunciation accuracy scores because evaluation is transcript-based. Base your feedback strictly on grammar, word choice, fluency, and conversational clarity.

LEARNING CONTEXT:
- Track: ${trackInstruction}
- Level: ${levelInstruction}
- Language: ${languageInstruction}`;
}

let cachedMagpieVoices = null;
let cachedMagpieVoicesAt = 0;
async function getMagpieVoices() {
  if (cachedMagpieVoices && Date.now() - cachedMagpieVoicesAt < 60 * 60 * 1000) return cachedMagpieVoices;
  try {
    const response = await fetch(`${MAGPIE_BASE}/list_voices`, {
      headers: { Authorization: `Bearer ${NVIDIA_API_KEY}` }
    });
    if (!response.ok) return [];
    const data = await response.json();
    const found = new Set();
    const walk = (value) => {
      if (typeof value === "string" && /Magpie-Multilingual\./i.test(value)) found.add(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    walk(data);
    cachedMagpieVoices = [...found];
    cachedMagpieVoicesAt = Date.now();
    return cachedMagpieVoices;
  } catch {
    return [];
  }
}

// Cleans text for natural Text-To-Speech pronunciation (removes markdown, emojis, asterisks)
function cleanTextForTTS(text) {
  if (!text) return "";
  let clean = text
    .replace(/[*#_~`>]/g, "") // markdown characters
    .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "") // emojis
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // markdown links
    .replace(/\s+/g, " ")
    .trim();

  // If text is a long report (over 380 chars), speak a friendly summary introductory sentence so TTS stays crisp
  if (clean.length > 380) {
    const sentences = clean.split(/(?<=[.?!])\s+/);
    if (sentences.length > 1 && sentences[0].length < 200) {
      return sentences.slice(0, 2).join(" ") + " You can read your complete report on screen!";
    }
    return clean.slice(0, 300) + "... You can view the full details on your screen!";
  }
  return clean;
}

async function chooseMagpieVoice(text, requestedLanguage) {
  // Check for non-Hindi Indic scripts (Bengali, Gujarati, Gurmukhi, Tamil, Telugu, Kannada, Malayalam, Oriya)
  // Magpie multilingual supports en-US and hi-IN, but does not support other Indic scripts.
  const nonHindiIndicPattern = /[\u0980-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/;
  if (nonHindiIndicPattern.test(text)) {
    return null; // Fall back to browser regional voice
  }

  const voices = await getMagpieVoices();

  // If text contains Devanagari (Hindi) and user selected Hindi:
  if (/[\u0900-\u097F]/.test(text) && requestedLanguage === "Hindi") {
    const preferredHindi = process.env.NVIDIA_MAGPIE_HI_VOICE || "Magpie-Multilingual.HI-IN.Leo";
    const hindiVoice = voices.includes(preferredHindi) ? preferredHindi
      : voices.find(v => /HI-IN/i.test(v)) || preferredHindi;
    return { language: "hi-IN", voice: hindiVoice };
  }

  // English default voice (English is primary learning medium)
  const preferredEnglish = process.env.NVIDIA_MAGPIE_EN_VOICE || "Magpie-Multilingual.EN-US.Aria";
  const englishVoice = voices.includes(preferredEnglish) ? preferredEnglish
    : voices.find(v => /EN-US/i.test(v)) || preferredEnglish;
  return { language: "en-US", voice: englishVoice };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "VocaBuddy NVIDIA Edition",
    version: "3.2.0",
    nvidiaConfigured: Boolean(NVIDIA_API_KEY && NVIDIA_API_KEY.length > 10),
    model: NVIDIA_MODEL,
    tts: "NVIDIA Magpie Multilingual (en-US, hi-IN) + Browser fallback",
    tracks: Array.from(tracks),
    languages: Array.from(languages)
  });
});

app.post("/api/chat", async (req, res) => {
  if (!NVIDIA_API_KEY) {
    return res.status(503).json({
      error: "NVIDIA_API_KEY is missing. Please add your NVIDIA API key to the .env file and restart the server."
    });
  }

  const preferences = getPreferences(req.body?.preferences);
  const userMessage = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 3000) : "";
  if (!userMessage) {
    return res.status(400).json({ error: "Please speak or enter a message first." });
  }

  const rawHistory = Array.isArray(req.body?.history) ? req.body.history.slice(-18) : [];
  const history = rawHistory
    .filter(item => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
    .map(item => ({ role: item.role, content: item.content.slice(0, 3000) }));

  const messages = [
    { role: "system", content: buildInstructions(preferences) },
    ...history,
    { role: "user", content: userMessage }
  ];

  try {
    const response = await fetch(NVIDIA_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.65,
        top_p: 0.9,
        chat_template_kwargs: { enable_thinking: false },
        stream: false
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || data?.detail || `NVIDIA Nemotron request failed (${response.status}).`;
      console.error("NVIDIA chat error:", response.status, message);
      return res.status(response.status).json({ error: message });
    }

    let reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({ error: "NVIDIA returned an empty response. Please try again." });
    }

    return res.json({ reply: reply.trim(), model: NVIDIA_MODEL });
  } catch (error) {
    console.error("NVIDIA chat connection error:", error.message);
    return res.status(502).json({ error: "Could not connect to NVIDIA API. Check your internet connection." });
  }
});

app.post("/api/speech", async (req, res) => {
  if (!NVIDIA_API_KEY) {
    return res.status(503).json({ error: "NVIDIA_API_KEY is missing on server." });
  }

  const rawText = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 2000) : "";
  if (!rawText) return res.status(400).json({ error: "No text provided for speech synthesis." });

  const textToSpeak = cleanTextForTTS(rawText);
  const preferences = getPreferences(req.body?.preferences);

  const tts = await chooseMagpieVoice(textToSpeak, preferences.language);
  if (!tts) {
    return res.json({
      fallbackToBrowser: true,
      reason: `Regional text detected. Using browser voice fallback for natural ${preferences.language} pronunciation.`
    });
  }

  try {
    const form = new FormData();
    form.append("text", textToSpeak);
    form.append("language", tts.language);
    form.append("voice", tts.voice);
    form.append("encoding", "LINEAR_PCM");
    form.append("sample_rate_hz", "22050");

    const response = await fetch(`${MAGPIE_BASE}/synthesize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NVIDIA_API_KEY}` },
      body: form
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn("Magpie TTS non-200 response:", response.status, detail.slice(0, 300));
      return res.json({
        fallbackToBrowser: true,
        reason: `Magpie endpoint returned ${response.status}. Falling back to browser speech synthesis.`
      });
    }

    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", String(audio.length));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-VocaBuddy-Voice", tts.voice);
    return res.send(audio);
  } catch (error) {
    console.warn("Magpie TTS fetch error:", error.message);
    return res.json({
      fallbackToBrowser: true,
      reason: "Could not reach NVIDIA Magpie TTS. Using browser speech synthesis fallback."
    });
  }
});

app.get(/.*/, (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`VocaBuddy NVIDIA Edition (V3.2) running on http://localhost:${PORT}`);
  console.log(`NVIDIA API Key configured: ${Boolean(NVIDIA_API_KEY)}`);
  console.log(`Model: ${NVIDIA_MODEL}`);
});
