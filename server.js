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
  "meeting", "presentation", "roleplay", "grammar_vocab",
  "power_vocab", "idioms_phrases"
]);

const levels = new Set(["beginner", "intermediate", "advanced"]);

function getPreferences(body = {}) {
  return {
    language: languages.has(body.language) ? body.language : "Hindi",
    track: tracks.has(body.track) ? body.track : "both",
    level: levels.has(body.level) ? body.level : "intermediate"
  };
}

function buildInstructions({ language, track, level }) {
  const languageInstruction = language === "English"
    ? "Explain exclusively in clear, natural English."
    : `Speak primarily in English. When explaining difficult vocabulary, power words, idioms, or corrections, give a brief, natural explanation in ${language}. Do not translate full sentences; help the learner think in English.`;

  let trackInstruction = "";
  switch (track) {
    case "power_vocab":
      trackInstruction = "Deep focus on VOCABULARY MASTERY. Whenever the learner speaks, introduce 1-2 powerful, sophisticated, or natural alternative words/expressions (e.g., upgrading basic words like 'very tired' to 'exhausted' or 'drained'). Explain the word briefly in " + language + ", give a crisp example, and challenge the learner to use it.";
      break;
    case "idioms_phrases":
      trackInstruction = "Deep focus on NATIVE IDIOMS, PHRASAL VERBS, & COLLOCATIONS. Help the learner sound natural and conversational rather than textbook-formal. Teach common spoken expressions with brief context and meaning in " + language + ".";
      break;
    case "interview":
      trackInstruction = "Act as an experienced executive interviewer. Ask realistic interview questions one by one. Coach the learner on high-impact professional vocabulary, structuring answers (STAR method), and sounding confident and articulate.";
      break;
    case "meeting":
      trackInstruction = "Simulate an agile corporate team meeting. Teach executive workplace vocabulary (e.g. leverage, bandwidth, bottleneck, pivot, streamline), diplomatic disagreement, and clear status updates.";
      break;
    case "presentation":
      trackInstruction = "Coach the learner on presentation delivery and storytelling. Teach signposting vocabulary, engaging rhetorical hooks, vocal transitions, and handling questions with authority.";
      break;
    case "roleplay":
      trackInstruction = "Immerse in interactive real-life role-play scenarios (client negotiation, hotel, airport, cafe, job offer negotiation). Stay in character while subtly infusing rich conversational vocabulary.";
      break;
    case "grammar_vocab":
      trackInstruction = "Act as an elite English language and vocabulary coach. Point out subtle grammar slip-ups gently, offer superior sentence alternatives, and upgrade the learner's vocabulary choice on every turn.";
      break;
    case "professional":
      trackInstruction = "Focus on workplace and professional English: meetings, client communications, presentations, career discussions, and polished corporate vocabulary.";
      break;
    case "everyday":
      trackInstruction = "Focus on practical daily conversations: making friends, small talk, travel, storytelling, and casual native spoken expressions.";
      break;
    default:
      trackInstruction = "Blend rich vocabulary acquisition with practical everyday and professional communication.";
  }

  const levelInstruction = level === "beginner"
    ? "The learner is a beginner. Keep sentences short, warm, and approachable. Introduce one new vocabulary word at a time with simple definitions."
    : level === "advanced"
      ? "The learner is advanced. Introduce nuanced C1/C2 vocabulary, complex collocations, rhetorical flair, and executive polish."
      : "The learner is intermediate. Use natural conversational pacing, introduce high-utility idiomatic expressions, and refine awkward phrasing.";

  return `You are VocaBuddy, a badass, supportive, high-energy AI English & Vocabulary Coach.
PRIMARY MISSION:
Transform the learner into a confident, articulate English speaker with an impressive, natural vocabulary.

VOICE & CONVERSATIONAL STYLE:
- Sound like an engaging, sharp, friendly speaking mentor. Never sound like a dusty textbook or scripted robot.
- Use natural contractions (I'm, that's, let's, don't) and authentic conversational cadence.
- Spoken responses MUST be concise: 1 to 3 short sentences, then ask exactly ONE engaging question to keep the learner talking.
- Never write long essays during conversational turns. The response will be voiced aloud via text-to-speech.

ACTIVE VOCABULARY ACCELERATION:
- Spot whenever the learner uses simple, overused words (e.g. "good", "bad", "happy", "problem", "very") and proactively suggest a more vivid, powerful word (e.g. "exceptional", "setback", "thrilled", "bottleneck").
- When introducing a new word, give its brief definition or equivalent in ${language}, and show how natives use it.

TEACHING METHODOLOGY:
- Understand the learner's intended message first.
- If they make a grammar or word choice error, gently acknowledge their idea, provide the natural phrase, and move forward seamlessly.

END-OF-SESSION LEARNING REPORT:
- Whenever the user asks for a session review, learning report, or feedback summary, format your response clearly into these exact sections:
  1. 🌟 Communication Strengths (2 specific things the learner did well)
  2. 🔍 Areas for Improvement (key points to focus on next)
  3. ✏️ Common Grammar & Sentence Improvements (original mistake vs natural alternative and why)
  4. 📚 Words Learned & Key Vocabulary (3-4 powerful words/phrases introduced, clear meanings in ${language}, and example usage)
  5. 🎯 Recommended Next Practice Activity (a concrete action for their next session)
- Never fabricate numerical pronunciation accuracy scores because evaluation is transcript-based. Base your feedback strictly on grammar, vocabulary, fluency, and conversational clarity.

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

  // English default voice
  const preferredEnglish = process.env.NVIDIA_MAGPIE_EN_VOICE || "Magpie-Multilingual.EN-US.Aria";
  const englishVoice = voices.includes(preferredEnglish) ? preferredEnglish
    : voices.find(v => /EN-US/i.test(v)) || preferredEnglish;
  return { language: "en-US", voice: englishVoice };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "VocaBuddy AI Coach",
    version: "3.2.0",
    nvidiaConfigured: Boolean(NVIDIA_API_KEY && NVIDIA_API_KEY.length > 10),
    tracks: Array.from(tracks),
    languages: Array.from(languages)
  });
});

app.post("/api/chat", async (req, res) => {
  if (!NVIDIA_API_KEY) {
    return res.status(503).json({
      error: "Service API key is missing on the server. Please check environment configuration."
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
      const message = data?.error?.message || data?.detail || `AI chat request failed (${response.status}).`;
      console.error("Chat error:", response.status, message);
      return res.status(response.status).json({ error: message });
    }

    let reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({ error: "AI returned an empty response. Please try again." });
    }

    return res.json({ reply: reply.trim() });
  } catch (error) {
    console.error("Chat connection error:", error.message);
    return res.status(502).json({ error: "Could not connect to AI service. Please check your internet connection." });
  }
});

app.post("/api/speech", async (req, res) => {
  if (!NVIDIA_API_KEY) {
    return res.status(503).json({ error: "Speech service is not configured on server." });
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
      return res.json({
        fallbackToBrowser: true,
        reason: "Neural voice endpoint unavailable. Falling back to browser speech synthesis."
      });
    }

    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", String(audio.length));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Voice-Engine", "Neural");
    return res.send(audio);
  } catch (error) {
    return res.json({
      fallbackToBrowser: true,
      reason: "Could not reach neural voice service. Using browser speech synthesis."
    });
  }
});

app.get(/.*/, (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`VocaBuddy AI Coach (V3.2) running on http://localhost:${PORT}`);
  console.log(`API Key configured: ${Boolean(NVIDIA_API_KEY)}`);
});
