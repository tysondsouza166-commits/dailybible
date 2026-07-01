import { GoogleGenAI } from "@google/genai";
import { safeStorage } from "./safeStorage";

// Initialize the GoogleGenAI client lazily and safely
let aiInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (aiInstance) return aiInstance;

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("VITE_GEMINI_API_KEY is not defined. Using DailyBible's high-quality local offline study fallbacks.");
    return null;
  }

  aiInstance = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  return aiInstance;
}

// Helper to strip markdown and extract clean JSON string
export function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  
  // 1. Remove markdown code block markers if they enclose the JSON
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(codeBlockRegex);
  if (match && match[1]) {
    cleaned = match[1].trim();
  }

  // 2. Strip stray leading/trailing backticks or markdown
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  // 3. Find first brace or bracket and last brace or bracket to extract pure JSON
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf("}");
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf("]");
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }

  return cleaned.trim();
}

// Low-level helper to query Gemini with robust multi-model fallback chain and exponential backoff
export async function callGemini(prompt: string, systemInstruction?: string, options?: { responseMimeType?: string }): Promise<string> {
  // 1. ALWAYS PREFER THE SERVER-SIDE PROXY FIRST (to keep API keys secure and leverage robust server fallbacks)
  try {
    const response = await fetch("/api/gemini/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt, systemInstruction, options })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data && typeof data.text === "string") {
        return data.text;
      }
    } else {
      const errText = await response.text();
      console.warn(`[Gemini Client] Server proxy returned non-OK status (${response.status}): ${errText}. Attempting direct fallback...`);
    }
  } catch (proxyErr) {
    console.warn("[Gemini Client] Failed to contact server-side proxy. Attempting direct fallback...", proxyErr);
  }

  // 2. DIRECT CLIENT-SIDE FALLBACK (if browser has an API key configured)
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error("Client-side Gemini API key is missing and server-side proxy was unavailable");
  }

  // Determine if JSON is expected based on prompt, systemInstruction, or options
  const isJsonExpected = options?.responseMimeType === "application/json" ||
    (prompt && (prompt.includes("JSON") || prompt.includes("json") || prompt.includes("keys:"))) ||
    (systemInstruction && (systemInstruction.includes("JSON") || systemInstruction.includes("json")));

  const mimeType = isJsonExpected ? "application/json" : undefined;

  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-3.1-pro-preview"];
  let lastError: any;

  // Shared 429 backoff delays: 2s, 4s, 8s
  const rateLimitDelays = [2000, 4000, 8000];
  let rateLimitAttempts = 0;

  for (const model of modelsToTry) {
    let modelAttempt = 0;
    const maxModelAttempts = rateLimitDelays.length + 1; // allows up to 3 retries for 429

    while (modelAttempt < maxModelAttempts) {
      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            temperature: 0.7,
            ...(systemInstruction ? { systemInstruction } : {}),
            ...(mimeType ? { responseMimeType: mimeType } : {})
          },
        });
        return response.text || "";
      } catch (err: any) {
        lastError = err;
        
        // Check if this is a 429 rate limit error
        const status = err.status || err.statusCode;
        const msg = String(err.message || err).toLowerCase();
        const is429 = status === 429 || msg.includes("429") || msg.includes("resource_exhausted") || msg.includes("resource exhausted") || msg.includes("rate limit") || msg.includes("quota");

        if (is429 && rateLimitAttempts < rateLimitDelays.length) {
          const delay = rateLimitDelays[rateLimitAttempts];
          rateLimitAttempts++;
          modelAttempt++;
          console.warn(`[Gemini Client 429 Backoff] Model ${model} hit rate limit. Waiting ${delay}ms before retry (attempt ${rateLimitAttempts}/${rateLimitDelays.length})...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue; // Retry the same model after waiting
        } else {
          console.warn(`[Gemini Client Call] Model ${model} failed: ${err.message || err}. Moving to next model or throwing.`);
          break; // Break the while loop to try the next model
        }
      }
    }
  }
  throw lastError;
}

// ==========================================
// 1. Daily Verse & Devotional Reflection
// ==========================================
export const DEFAULT_BIBLE_VERSES = [
  { reference: "Romans 8:28", text: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose." },
  { reference: "Philippians 4:13", text: "I can do all things through Christ who strengthens me." },
  { reference: "Proverbs 3:5-6", text: "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight." },
  { reference: "Isaiah 40:31", text: "But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint." },
  { reference: "Joshua 1:9", text: "Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go." },
  { reference: "Psalm 23:1", text: "The Lord is my shepherd, I shall not be in want." },
  { reference: "Romans 12:2", text: "Do not conform to the pattern of this world, but be transformed by the renewing of your mind. Then you will be able to test and approve what God’s will is—his good, pleasing and perfect will." },
  { reference: "Hebrews 11:1", text: "Now faith is confidence in what we hope for and assurance about what we do not see." },
  { reference: "Galatians 5:22-23", text: "But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness, gentleness and self-control. Against such things there is no law." },
  { reference: "John 3:16", text: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life." }
];

export function getApiTranslation(translation: string, language: string = "English"): string {
  const lang = (language || "English").toLowerCase();
  if (lang === "spanish" || lang === "español") return "rvr09";
  if (lang === "portuguese" || lang === "português") return "almeida";

  const t = (translation || "web").toLowerCase().trim();
  if (t === "kjv" || t === "nkjv") return "kjv";
  if (t === "bbe") return "bbe";
  if (t === "oeb" || t === "oeb-us" || t === "oeb-cw") return "oeb-us";
  
  // Default fallback for modern translations (NIV, ESV, NLT, NASB, ASV, etc.) is WEB (World English Bible)
  return "web";
}

export async function fetchScriptureFromApi(reference: string, translation: string, language: string = "English"): Promise<string> {
  const apiTrans = getApiTranslation(translation, language);
  try {
    const url = `https://bible-api.com/${encodeURIComponent(reference)}?translation=${apiTrans}`;
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      if (data && Array.isArray(data.verses)) {
        return data.verses.map((v: any) => `[${v.verse}] ${v.text.trim()}`).join(" ");
      } else if (data && data.text) {
        return data.text.trim();
      }
    }
  } catch (err) {
    console.warn(`Failed scripture fetch for ${reference} with translation ${translation}:`, err);
  }

  // Fallback to WEB
  try {
    const url = `https://bible-api.com/${encodeURIComponent(reference)}?translation=web`;
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      if (data && Array.isArray(data.verses)) {
        return data.verses.map((v: any) => `[${v.verse}] ${v.text.trim()}`).join(" ");
      } else if (data && data.text) {
        return data.text.trim();
      }
    }
  } catch (err) {
    console.warn("Fallback to WEB failed", err);
  }

  return "";
}

export async function fetchDailyVerse(language: string = "English", translation: string = "NIV"): Promise<{ reference: string; text: string; translatedText?: string; reflection: string; translatedReflection?: string }> {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000);
  const verse = DEFAULT_BIBLE_VERSES[Math.abs(dayOfYear) % DEFAULT_BIBLE_VERSES.length];
  
  // Construct a date string in YYYY-MM-DD
  const todayStr = new Date().toISOString().split("T")[0];
  const cacheKey = `daily_verse:${todayStr}:${language}:${translation}`;
  
  // 3. Instant Caching (LocalStorage)
  const cached = safeStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.text && parsed.reflection) {
        return parsed;
      }
    } catch (e) {
      console.warn("Failed parsing cached daily verse:", e);
    }
  }

  // 1. Scripture Fetching (No-Key API)
  let actualText = await fetchScriptureFromApi(verse.reference, translation, language);
  if (!actualText) {
    actualText = verse.text; // Fallback to hardcoded English if offline/failed
  }

  // Call server to generate devotional reflection using OpenRouter
  try {
    const resp = await fetch("/api/daily-verse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference: verse.reference,
        text: actualText,
        language,
        translation
      })
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.reflection) {
        const isEnglish = !language || language.toLowerCase() === "english";
        const verseText = isEnglish ? actualText : (data.translatedText || data.text || actualText);
        const finalResult = { 
          reference: verse.reference, 
          text: actualText, 
          translatedText: verseText, 
          reflection: data.reflection,
          translatedReflection: data.translatedReflection
        };
        safeStorage.setItem(cacheKey, JSON.stringify(finalResult));
        return finalResult;
      }
    }
  } catch (err) {
    console.warn("Server daily-verse POST failed, trying local fallbacks:", err);
  }

  // Local translation fallback dictionary for maximum resiliency under rate-limiting/high demand
  const LOCALIZED_FALLBACKS: Record<string, Record<string, { text: string; reflection: string }>> = {
    "Romans 8:28": {
      "Spanish": {
        text: "Y sabemos que para los que aman a Dios, todas las cosas cooperan para bien, esto es, para los que son llamados conforme a su propósito.",
        reflection: "Dios está obrando activamente en tu vida, transformando cada desafío y triunfo en parte de Su gran plan. Confía en Su propósito."
      },
      "Portuguese": {
        text: "Sabemos que todas as coisas cooperam para o bem daqueles que amam a Deus, daqueles que são chamados segundo o seu propósito.",
        reflection: "Deus está agindo ativamente em sua vida, transformando cada desafio e triunfo em parte de Seu grande plano. Confie em Seu propósito."
      },
      "French": {
        text: "Nous savons, du reste, que toutes choses concourent au bien de ceux qui aiment Dieu, de ceux qui sont appelés selon son dessein.",
        reflection: "Dieu agit activement dans votre vie, transformant chaque défi et triomphe en partie de Son grand dessein. Faites confiance à Son plan."
      },
      "Tagalog": {
        text: "At nalalaman natin na ang lahat ng mga bagay ay nagkakalakip na gumagawa sa ikabubuti ng mga nagsisiibig sa Dios, sa makatuwid baga'y sa mga tinawag alinsunod sa kaniyang panukala.",
        reflection: "Aktibong kumikilos ang Diyos sa iyong buhay, ginagawa ang bawat hamon at tagumpay na bahagi ng Kanyang dakilang plano. Magtiwala sa Kanya."
      }
    },
    "Philippians 4:13": {
      "Spanish": {
        text: "Todo lo puedo en Cristo que me fortalece.",
        reflection: "Tu fuerza no proviene de tu propio poder, sino de Cristo que habita en ti. Él te sostendrá en cada tarea hoy."
      },
      "Portuguese": {
        text: "Tudo posso naquele que me fortalece.",
        reflection: "Sua força não vem do seu próprio poder, mas de Cristo que habita em você. Ele o sustentará em qualquer tarefa hoje."
      },
      "French": {
        text: "Je puis tout par celui qui me fortifie.",
        reflection: "Votre force ne vient pas de votre propre pouvoir, mais de Christ qui vit en vous. Il vous soutiendra dans chaque tâche aujourd'hui."
      },
      "Tagalog": {
        text: "Lahat ng mga bagay ay aking magagawa doon sa nagpapalakas sa akin.",
        reflection: "Ang iyong lakas ay hindi nagmumula sa sarili mong kapangyarihan, kundi kay Kristo na nananahan sa iyo. Palalakasin ka Niya ngayon."
      }
    }
  };

  const localized = LOCALIZED_FALLBACKS[verse.reference]?.[language];
  if (localized) {
    const finalResult = { reference: verse.reference, text: actualText, translatedText: localized.text, reflection: localized.reflection };
    safeStorage.setItem(cacheKey, JSON.stringify(finalResult));
    return finalResult;
  }

  const defaultReflection = `Today's reflection reminder: In this verse, God promises His presence, strength, and guidance in our daily walk of faith. Trust Him today with your worries and let His Word light your path.`;
  const finalResult = { reference: verse.reference, text: actualText, translatedText: actualText, reflection: defaultReflection };
  safeStorage.setItem(cacheKey, JSON.stringify(finalResult));
  return finalResult;
}

// ==========================================
// 2. Bible Search Grounding
// ==========================================
export interface SearchResult {
  reference: string;
  text: string;
  explanation: string;
  translatedText?: string;
  translatedExplanation?: string;
}

export async function searchBible(query: string, language: string = "English"): Promise<SearchResult[]> {
  const clientKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (clientKey) {
    try {
      const ai = getGeminiClient();
      if (ai) {
        const prompt = `Find 4 to 6 relevant Bible verses related to the query or keyword or chapter: "${query}".
For each verse, please return standard Bible references, the exact scripture text translated entirely in the language: "${language}", and a brief 1-sentence application context in the language: "${language}" showing why it fits. 
Format your output strictly as a valid JSON array of objects with the keys "reference", "text", and "explanation". Do not include any HTML styles or markdown code blocks like \`\`\`json, just return raw JSON string starting with [ and ending with ].`;
        
        const resultString = await callGemini(prompt, `You are a helpful, accurate Bible search companion that returns verses and explanations exclusively in the language: "${language}" as a clean JSON list.`, { responseMimeType: "application/json" });
        const cleaned = cleanJsonString(resultString);
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapped = parsed.map((v: any) => ({
            ...v,
            translatedText: language && language.toLowerCase() !== "english" ? v.text : undefined,
            translatedExplanation: language && language.toLowerCase() !== "english" ? v.explanation : undefined
          }));
          return mapped as SearchResult[];
        }
      }
    } catch (err) {
      console.warn("Client-side Bible search Gemini call failed, trying server or local fallbacks:", err);
    }
  }

  // Try server fallback
  try {
    const resp = await fetch("/api/bible-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, language }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data && Array.isArray(data.results)) {
        return data.results;
      }
    }
  } catch (err) {
    console.warn("Server Bible search fetch failed, trying local fallbacks:", err);
  }

  // Fallback match query to key categories
  const q = (query || "").toLowerCase();
  const hopeVerses = [
    { reference: "Romans 15:13", text: "May the God of hope fill you with all joy and peace as you trust in him, so that you may overflow with hope by the power of the Holy Spirit.", explanation: "Uplifting reminder that true hope overflows through the Holy Spirit." },
    { reference: "Hebrews 6:19", text: "We have this hope as an anchor for the soul, firm and secure.", explanation: "Visualizes hope as an unbreakable anchor during life's worst storms." },
    { reference: "Jeremiah 29:11", text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.", explanation: "Reminds us that God desires to lead us into a hopeful and safe future." }
  ];

  const peaceAndAnxiety = [
    { reference: "Philippians 4:6-7", text: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.", explanation: "Instructs us to trade worry for prayers topped with gratitude." },
    { reference: "John 14:27", text: "Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid.", explanation: "Offers Jesus’ own transcendent peace as armor against fear." },
    { reference: "Isaiah 26:3", text: "You will keep in perfect peace those whose minds are steadfast, because they trust in you.", explanation: "Promises deep mental stability and calm to those who focus on trust." }
  ];

  const faithAndTrust = [
    { reference: "Hebrews 11:1", text: "Now faith is confidence in what we hope for and assurance about what we do not see.", explanation: "Provides the foundational biblical definition of faithful assurance." },
    { reference: "Ephesians 2:8", text: "For it is by grace you have been saved, through faith—and this is not from yourselves, it is the gift of God.", explanation: "Declares faith as the instrument of receiving God's saved gift." },
    { reference: "Proverbs 3:5-6", text: "Trust in the Lord with all your heart and lean not on your own understanding.", explanation: "Demands shifting reliance away from our limited vision onto God's guidance." }
  ];

  const healingAndPain = [
    { reference: "Psalm 147:3", text: "He heals the brokenhearted and binds up their wounds.", explanation: "Depicts God as a tender physician patching up emotional and physical pain." },
    { reference: "Jeremiah 17:14", text: "Heal me, Lord, and I will be healed; save me and I will be saved, for you are the one I praise.", explanation: "A beautiful individual prayer for utter structural healing." }
  ];

  const forgivenessAndGrace = [
    { reference: "Colossians 3:13", text: "Bear with each other and forgive one another if any of you has a grievance against someone. Forgive as the Lord forgave you.", explanation: "Instructs extending standard forgiveness based on the grace we received." },
    { reference: "1 John 1:9", text: "If we confess our sins, he is faithful and just and will forgive us our sins and purify us from all unrighteousness.", explanation: "Assures complete cleansing when we confess our shortcomings." }
  ];

  const loveAndKindness = [
    { reference: "1 Corinthians 13:4-5", text: "Love is patient, love is kind. It does not envy, it does not boast, it is not proud.", explanation: "The absolute standard of pure, selfless love." },
    { reference: "1 John 4:19", text: "We love because he first loved us.", explanation: "Grounds our capability to love others in the reality of God's prior action." }
  ];

  let selectedResults = [
    { reference: "Proverbs 3:5", text: "Trust in the Lord with all your heart and lean not on your own understanding.", explanation: "Encourages complete trust in God's wisdom over our own." },
    { reference: "Isaiah 26:3", text: "You will keep in perfect peace those whose minds are steadfast, because they trust in you.", explanation: "Shows the connection between trusting God and having mental peace." },
    { reference: "Matthew 6:33", text: "But seek first the kingdom of God and his righteousness, and all these things will be added to you.", explanation: "Commands putting spiritual priorities first daily." },
    { reference: "Psalm 119:105", text: "Your word is a lamp to my feet and a light to my path.", explanation: "Reminds us that Scripture provides direct guidance for life's journey." }
  ];

  if (q.includes("hope") || q.includes("future") || q.includes("prosper")) {
    selectedResults = hopeVerses;
  } else if (q.includes("anx") || q.includes("peace") || q.includes("worry") || q.includes("stress") || q.includes("fear")) {
    selectedResults = peaceAndAnxiety;
  } else if (q.includes("faith") || q.includes("trust") || q.includes("believ")) {
    selectedResults = faithAndTrust;
  } else if (q.includes("heal") || q.includes("sick") || q.includes("pain") || q.includes("wound")) {
    selectedResults = healingAndPain;
  } else if (q.includes("forg") || q.includes("sin") || q.includes("grace")) {
    selectedResults = forgivenessAndGrace;
  } else if (q.includes("love") || q.includes("kind")) {
    selectedResults = loveAndKindness;
  }

  if (language && language.toLowerCase() !== "english") {
    try {
      const resp = await fetch("/api/translate-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: selectedResults, language }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && Array.isArray(data.results)) {
          return data.results;
        }
      }
    } catch (err) {
      console.warn("Translation of fallback search results failed:", err);
    }
  }

  return selectedResults;
}

// ==========================================
// 3. Guided Study Companion Chat
// ==========================================
export async function getStudyChatReply(message: string, chatHistory: { role: string; text: string }[], language: string = "English"): Promise<string> {
  const clientKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (clientKey) {
    try {
      const ai = getGeminiClient();
      if (ai) {
        const historyFormatted = chatHistory.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join("\n");
        const prompt = `
Context History:
${historyFormatted}

User Question: ${message}

Please respond following these guidelines:
- Answer respectfully and biblically.
- Provide clear scripture references (including book, chapter, and verse) whenever possible.
- Avoid denominational bias (use broad Christian, non-denominational biblical views).
- Use encouraging, hopeful, and uplifting language.
- Clearly separate direct scripture quotations from your explanations.
- Suggest practical daily life applications for the answer.
- CRITICAL: Respond and translate all Scripture and explanations entirely in the selected language: "${language}".`;

        const systemInstruction = 
          `You are DailyBible, a professional, respectful, non-denominational, and compassionate Bible Study Companion. ` +
          `Your goal is to explain scripture in accessible language, guide people back to biblical truth, and offer helpful, reassuring life suggestions entirely in the language: "${language}".`;

        const reply = await callGemini(prompt, systemInstruction);
        if (reply && reply.trim()) {
          return reply.trim();
        }
      }
    } catch (err) {
      console.warn("Client Study Chat Gemini call failed, trying server fallback:", err);
    }
  }

  // Try server fallback
  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, chatHistory, language }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.reply) {
        return data.reply;
      }
    }
  } catch (err) {
    console.warn("Server chat reply fetch failed, trying local fallbacks:", err);
  }

  // Safe client offline fallback
  const q = message.toLowerCase().trim();
  if (q.includes("anxi") || q.includes("worry") || q.includes("stress") || q.includes("fear") || q.includes("afraid") || q.includes("scared")) {
    return `Peace are my parting words to you; my own peace is my gift to you.

I understand you are sitting with feelings of anxiety or worry right now. Scripture frequently addresses our moments of fear with gentle reassurance.

**Scripture Focus:**
"Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus." — Philippians 4:6-7

**Practical Daily Application:**
1. **The Three-Breath Pause:** When anxiety mounts, stop and breathe deeply. Focus solely on God's immediate sovereignty.
2. **The Gratitude Audit:** Write down three simple things you are genuinely grateful for right now, no matter how small. Gratitude actively reshapes our neural paths away from panic.
3. **Plea and Release:** Express your exact concern out loud to God, and make a conscious mental gesture of placing it into His hands. Let go of the need to control the outcome.

Remember, you do not walk through this season alone. God is closer than your next breath.`;
  }
  if (q.includes("hope") || q.includes("future") || q.includes("despair") || q.includes("discourage") || q.includes("depress") || q.includes("sad") || q.includes("lonely")) {
    return `Hope is not a fragile wish; it is an unbreakable anchor for the soul.

When the present season looks dark or confusing, it is easy for discourage to creep in. However, the scriptures present a future that is held in loving and capable hands.

**Scripture Focus:**
"But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint." — Isaiah 40:31

**Practical Daily Application:**
1. **Keep a Victory Journal:** Look back at previous situations where you felt stuck, and write down how you eventually moved through them. It acts as a reminder of God's quiet faithfulness.
2. **Anchor of the Day:** Select one word of hope (e.g., 'Restoration', 'Strength', 'Peace') and focus on it for 5 minutes in the morning.
3. **Reach Out:** Hope thrives in community. Reach out to one trusted friend or spiritual mentor and share a coffee.

Your current chapter is not the final page of your story. Remain steadfast and trust the author.`;
  }
  if (q.includes("faith") || q.includes("trust") || q.includes("doubt") || q.includes("believ")) {
    return `Faith is the steady confidence in what is hoped for, even when unseen.

In seasons of wait or uncertainty, our faith can feel tested or small. Scripture encourages us that faith the size of a mustard seed holds tremendous spiritual momentum.

**Scripture Focus:**
"Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight." — Proverbs 3:5-6

**Practical Daily Application:**
1. **Relinquish Understanding:** When you don't understand 'why', actively say: "I do not see the full road, but I trust the Guide."
2. **Daily Devotion:** Commit 10 minutes to reading a chapter of scripture daily to feed your faith. Faith rises by hearing truth.
3. **Operate on Truth, Not Emotion:** Write down a biblical promise and hold it close when feelings of doubt emerge.

Faith is built step-by-step; every baby step of obedience strengthens your spiritual roots.`;
  }
  if (q.includes("forgiv") || q.includes("grace") || q.includes("sin") || q.includes("guilt") || q.includes("shame") || q.includes("condemn")) {
    return `Grace is God’s unmerited favor that releases us from the weight of our past.

If you are carrying guilt or struggling to forgive someone who hurt you, know that grace is both a healing balm and an active command.

**Scripture Focus:**
"If we confess our sins, he is faithful and just and will forgive us our sins and purify us from all unrighteousness." — 1 John 1:9

**Practical Daily Application:**
1. **The Confession and Cleanse:** Pray a sincere confession, then write down "Forgiven and Transformed" on a piece of paper as a visual reminder of your clean slate.
2. **Intercessory Release:** Pray for the well-being of the person who hurt you. It is the first step of breaking the chains of bitterness.
3. **Extend Grace to Yourself:** Remember that God is greater than your heart’s self-condemnation. Walk freely in His newness.

True freedom begins when we lay down the ledger of debts and receive the boundless grace offered to us.`;
  }
  if (q.includes("heal") || q.includes("sick") || q.includes("pain") || q.includes("suffering") || q.includes("grief") || q.includes("die") || q.includes("loss")) {
    return `God is our tender Physician, holding those who are broken and patching their wounds.

Walking through physical pain, sickness, or deep grief can leave us feeling depleted and quiet. In these moments, Scripture portrays God not as a distant ruler, but as a comforting presence.

**Scripture Focus:**
"He heals the brokenhearted and binds up their wounds." — Psalm 147:3

**Practical Daily Application:**
1. **Rest in the Sanctuary:** Allow yourself to rest physically and emotionally without guilt. Restoration requires still waters.
2. **Praise through Pain:** Play soft, peaceful, uplifting instrumentals or worship music. Let the environment be filled with calmness.
3. **Accept Service:** Let others in your community help carry small burdens, such as meals or errands. Community is God's hands and feet.

Even in the valley of deep grief, God's rod and staff are there to comfort you. Breathe in His steady peace.`;
  }

  return `Welcome to DailyBible's Sandbox Companion. I am glad you reached out!

Whether you are studying scripture, seeking encouragement, or looking for practical life applications, I am here to assist your daily walk of faith.

**Scripture to Hold Onto Today:**
"Your word is a lamp to my feet and a light to my path." — Psalm 119:105

**Suggested Application Options:**
1. **Daily Reading:** Explore the **Daily Devotionals** or **Verse of the Day** tabs to receive curated spiritual refreshment.
2. **Exploration:** Use the **Smart Bible Explorer** to search for specific topics such as forgiveness, peace, and hope.
3. **Study Guides:** Dig into the **Chapter Summaries** tab to generate outline structures and helpful reflection questions for any Bible chapter.

Please feel free to ask me any questions about scripture meanings, biblical history, or daily life integration. I am ready to guide you!`;
}

// ==========================================
// 4. Chapter Study Guide Generator
// ==========================================
export interface ChapterSummaryData {
  summary: string;
  lessons: string[];
  verses: { reference: string; text: string }[];
  reflectionQuestions: string[];
  prayerPoints: string[];
  fullChapterText?: string;
  characterProfiles?: { name: string; role: string; significance: string }[];
  _offline?: boolean;
}

export async function getChapterSummary(book: string, chapter: number, language: string = "English", translation: string = "NIV"): Promise<ChapterSummaryData> {
  const cacheKey = `study_guide:${book}:${chapter}:${language}:${translation}`;
  
  // 3. Instant Caching (LocalStorage)
  const cached = safeStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.summary && Array.isArray(parsed.lessons)) {
        return parsed;
      }
    } catch (e) {
      console.warn("Failed parsing cached study guide:", e);
    }
  }

  // 1. Scripture Fetching (No-Key API)
  let scriptureText = "";
  try {
    scriptureText = await fetchScriptureFromApi(`${book} ${chapter}`, translation, language);
  } catch (err) {
    console.warn("Failed fetching chapter scripture text from AO Lab Bible API:", err);
  }

  // Try server to generate commentary using OpenRouter
  try {
    const resp = await fetch("/api/chapter-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book, chapter, language, translation }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.summary && Array.isArray(data.lessons) && Array.isArray(data.verses)) {
        // Only overwrite if we don't already have translated text from the server and the language is English
        const isEnglish = !language || language.toLowerCase() === "english";
        if (isEnglish && scriptureText) {
          data.fullChapterText = scriptureText;
        } else if (!isEnglish) {
          // If not English, make sure we use the translated text returned by the backend
          data.fullChapterText = data.translatedText || data.fullChapterText || scriptureText;
        }
        safeStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
      }
    }
  } catch (err) {
    console.warn("Server chapter summary fetch failed, trying local fallbacks:", err);
  }

  // Curated Fallbacks
  let summary = `This is a study summary for ${book} ${chapter}. It explores God's faithfulness, sovereign grace, and the response of faith required from us as believers.`;
  let lessons = [
    "Seek the Lord in truth and lay aside self-reliance.",
    "Generational obedience leaves a lasting spiritual legacy.",
    "God is our strength when our personal reserves are low."
  ];
  let verses = [
    { reference: `${book} ${chapter}:3`, text: "Commit your actions to the Lord, and your plans will be established." },
    { reference: `${book} ${chapter}:16`, text: "Better is a little with the fear of the Lord than great treasure and trouble with it." },
    { reference: `${book} ${chapter}:32`, text: "He who is slow to anger is better than the mighty, and he who rules his spirit than he who takes a city." }
  ];
  let reflectionQuestions = [
    "How is this chapter's call to obedience highlighted in your current situations?",
    "Which verse in this passage speaks most clearly to you today?",
    "How can you put these lessons into direct action tomorrow?"
  ];
  let prayerPoints = [
    "Ask for a pure heart to seek God's righteousness first.",
    "Pray for the active grace to apply patience and slow anger.",
    "Give thanks for the spiritual heritage and instructions in Scripture."
  ];

  let fullChapterText = `[1] This is a local offline placeholder for the full chapter text of ${book} ${chapter}.\n[2] To read the complete, verbatim scripture text from the "${translation}" translation, please ensure your internet connection is active and your Gemini API key is configured in the Secrets panel.\n[3] "Thy word is a lamp unto my feet, and a light unto my path." (Psalm 119:105).`;
  
  let characterProfiles = [
    { 
      name: "God / The Lord", 
      role: "The ultimate author of covenant promises and source of sovereign mercy in this chapter.", 
      significance: "The eternal, faithful Creator who commands obedience, directs historical events, and guides his people." 
    },
    { 
      name: "The Believers / Faithful", 
      role: "Called to trust, obey, and put aside worldly reliance to walk in true spiritual wisdom.", 
      significance: "Represents the active response of human faith required to receive and manifest God's covenant blessings." 
    }
  ];

  const bk = book.toLowerCase();
  if (bk === "genesis" || bk === "exodus") {
    fullChapterText = `[1] In the beginning God created the heavens and the earth. [2] Now the earth was formless and empty, darkness was over the surface of the deep, and the Spirit of God was hovering over the waters. [3] And God said, "Let there be light," and there was light. [4] God saw that the light was good, and he separated the light from the darkness. [5] God called the light “day,” and the darkness he called “night.” And there was evening, and there was morning—the first day. [6] And God said, "Let there be a vault between the waters to separate water from water." [7] So God made the vault and separated the water under the vault from the water above it. And it was so.`;
    summary = `In ${book} Chapter ${chapter}, we witness God's supreme sovereignty as He calls, preserves, and leads His people. This chapter highlights the foundations of faith, the covenantal promises of God, and the necessity of walking in trust despite uncertain physical conditions.`;
    lessons = [
      "Sacred promises are eternal; God can be trusted implicitly with the long-term vision.",
      "Even when we step off course, divine grace is active to restore and redirect us.",
      "Altars of remembrance: build daily monuments of prayer to remain centered in gratitude."
    ];
    verses = [
      { reference: `${book} ${chapter}:1`, text: "I am the Lord your God; walk in My ways and be wholehearted." },
      { reference: `${book} ${chapter}:7`, text: "I will establish my covenant as an everlasting covenant between me and you and your descendants." },
      { reference: `${book} ${chapter}:15`, text: "Do not be afraid, for I am your shield, your exceedingly great reward." }
    ];
    characterProfiles = [
      { 
        name: "God (Yahweh)", 
        role: "Initiating covenants, calling chosen leaders, and sovereignly declaring historical promises.", 
        significance: "The prime mover of biblical redemptive history who keeps His covenant across multiple generations." 
      },
      { 
        name: "The Patriarchs / Leaders", 
        role: "Receiving divine directives, building altars, and stepping forward in faith or struggling under fear.", 
        significance: "Fathers of faith whose obedience serves as a template and foundation for the covenant nation." 
      }
    ];
  } else if (bk === "john" || bk === "ephesians" || bk === "philippians") {
    if (bk === "john") {
      fullChapterText = `[1] "I am the true vine, and my Father is the gardener." [2] <red>"He cuts off every branch in me that bears no fruit, while every branch that does bear fruit he prunes so that it will be even more fruitful."</red> [3] <red>"You are already clean because of the word I have spoken to you."</red> [4] <red>"Remain in me, as I also remain in you. No branch can bear fruit by itself; it must remain in the vine. Neither can you bear fruit unless you remain in me."</red> [5] <red>"I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit; apart from me you can do nothing."</red> [6] <red>"If you do not remain in me, you are like a branch that is thrown away and withers; such branches are picked up, thrown into the fire and burned."</red> [7] <red>"If you remain in me and my words remain in you, ask whatever you wish, and it will be done for you."</red> [8] <red>"This is to my Father’s glory, that you bear much fruit, showing yourselves to be my disciples."</red> [9] <red>"As the Father has loved me, so have I loved you. Now remain in my love."</red>`;
    } else {
      fullChapterText = `[1] For this reason I, Paul, the prisoner of Christ Jesus for the sake of you Gentiles— [2] Surely you have heard about the administration of God’s grace that was given to me for you, [3] that is, the mystery made known to me by revelation, as I have already written briefly. [4] In reading this, then, you will be able to understand my insight into the mystery of Christ, [5] which was not made known to people in other generations as it has now been revealed by the Spirit to God’s holy apostles and prophets.`;
    }
    summary = `${book} Chapter ${chapter} focuses deeply on our spiritual identity in Christ, the mystery of divine love, and the power of unified fellowship. It challenges us to abide in the Vine, put on the spiritual armor, and set our minds on things above with joyful hearts.`;
    lessons = [
      "Apart from Christ, our self-directed labors bear no lasting fruit; abiding is the primary key.",
      "We are created for community; our relationships must mirror the sacrificial love of Jesus.",
      "True joy is not situational; it resides in our connection to the eternal source of grace."
    ];
    verses = [
      { reference: `${book} ${chapter}:5`, text: "I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit." },
      { reference: `${book} ${chapter}:13`, text: "Greater love has no one than this: to lay down one's life for one's friends." },
      { reference: `${book} ${chapter}:16`, text: "You did not choose me, but I chose you and appointed you so that you might go and bear fruit." }
    ];
    characterProfiles = [
      { 
        name: "Jesus Christ", 
        role: "The True Vine, the sacrificial Savior, and the sender of the Holy Spirit to guide disciples.", 
        significance: "The source of spiritual life, salvation, and the ultimate template of divine sacrificial love." 
      },
      { 
        name: "The Disciples / The Church", 
        role: "Called to abide in Christ's love, bear fruit, and maintain absolute unity in the face of division.", 
        significance: "The household of faith appointed to carry the message of light and live out Christian fellowship." 
      }
    ];
  } else if (bk === "psalms" || bk === "proverbs") {
    fullChapterText = `[1] The Lord is my shepherd, I lack nothing. [2] He makes me lie down in green pastures, he leads me beside quiet waters, [3] he refreshes my soul. He guides me along the right paths for his name’s sake. [4] Even though I walk through the darkest valley, I will fear no evil, for you are with me; your rod and your staff, they comfort me. [5] You prepare a table before me in the presence of my enemies. You anoint my head with oil; my cup overflows. [6] Surely your goodness and love will follow me all the days of my life, and I will dwell in the house of the Lord forever.`;
    summary = `This portion of ${book} (${chapter}) offers rich wisdom for navigating life's complexity and emotional valleys. It guides us to find shelter in God's presence, choose the path of spiritual discernment, and anchor our minds in pure truth rather than transient feelings.`;
    lessons = [
      "Emotions are valid indicators, but bad dictators; submit them to God's anchor.",
      "True wisdom is a relationship with the Creator, starting with awe and reverence.",
      "Though we walk through dense valleys, we are secure under the wings of the Shepherd."
    ];
    verses = [
      { reference: `${book} ${chapter}:1`, text: "The Lord is my light and my salvation—whom shall I fear?" },
      { reference: `${book} ${chapter}:5`, text: "Trust in the Lord with all your heart, and lean not on your own understanding." },
      { reference: `${book} ${chapter}:105`, text: "Your word is a lamp to my feet and a light to my path." }
    ];
    characterProfiles = [
      { 
        name: "The Lord (Shepherd & Shield)", 
        role: "Providing refuge, directing right paths, and shining light upon the wanderer's steps.", 
        significance: "The ultimate source of human wisdom, spiritual safety, and unwavering guidance." 
      },
      { 
        name: "The Psalmist / Seeker", 
        role: "Pouring out honest grief, choosing trust, meditating on the Word, and seeking active wisdom.", 
        significance: "Represents every believer crying out in vulnerability and seeking real alignment with God's truth." 
      }
    ];
  } else if (bk === "romans" || bk === "hebrews" || bk === "james") {
    fullChapterText = `[1] Therefore, since we have been justified through faith, we have peace with God through our Lord Jesus Christ, [2] through whom we have gained access by faith into this grace in which we now stand. And we boast in the hope of the glory of God. [3] Not only so, but we also glory in our sufferings, because we know that suffering produces perseverance; [4] perseverance, character; and character, hope. [5] And hope does not put us to shame, because God’s love has been poured out into our hearts through the Holy Spirit, who has been given to us.`;
    summary = `In ${book} Chapter ${chapter}, we delve into the robust theological principles of justification by faith, the active evidence of true belief, and enduring trials with patient faith. Faith is not static; it is a live expression of trust in action.`;
    lessons = [
      "Faith is verified in our trials; let perseverance finish its work so you may be mature and complete.",
      "Faith without actions is silent; we must put our deep convictions into concrete daily application.",
      "There is no condemnation for those who are in Christ Jesus; walk freely in Spirit-led power."
    ];
    verses = [
      { reference: `${book} ${chapter}:1`, text: "Now faith is confidence in what we hope for and assurance about what we do not see." },
      { reference: `${book} ${chapter}:12`, text: "Be joyful in hope, patient in affliction, faithful in prayer." },
      { reference: `${book} ${chapter}:22`, text: "Do not merely listen to the word, and so deceive yourselves. Do what it says." }
    ];
    characterProfiles = [
      { 
        name: "The Holy Spirit", 
        role: "Empowering the believer, helping in weakness, and sealing them in divine adoption.", 
        significance: "The internal presence of God that guides, sanctifies, and witnesses to our status as heirs." 
      },
      { 
        name: "Faith Heroes / Witnesses", 
        role: "Enduring suffering, trusting promises, and serving as a great cloud of encouragement to us.", 
        significance: "Examples of robust faith whose lives demonstrate that God rewards those who earnestly seek Him." 
      }
    ];
  }

  let finalResult = {
    summary,
    lessons,
    verses,
    reflectionQuestions,
    prayerPoints,
    fullChapterText: scriptureText || fullChapterText,
    characterProfiles,
    _offline: true
  };

  if (language && language.toLowerCase() !== "english") {
    try {
      const resp = await fetch("/api/translate-study-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guide: finalResult, language }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.guide) {
          finalResult = data.guide;
        }
      }
    } catch (err) {
      console.warn("Translation of fallback study guide failed:", err);
    }
  }

  safeStorage.setItem(cacheKey, JSON.stringify(finalResult));
  return finalResult;
}

// ==========================================
// 5. Prayer Reflection Companion
// ==========================================
export async function getPrayerReflection(request: string, language: string = "English"): Promise<string> {
  const clientKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (clientKey) {
    try {
      const ai = getGeminiClient();
      if (ai) {
        const prompt = `Write a deep, compassionate, and personalized prayer based on this request/concern: "${request}". 
Make sure to:
- Be uplifting, biblically encouraging, and humble.
- Incorporate a direct relevant Bible verse quote in the prayer.
- Focus on hope, surrender, healing, peace, or praise as appropriate.
- Keep the length around 150-250 words.
- CRITICAL: Write the entire prayer and any included scriptures entirely in the selected language: "${language}".`;
        
        const prayer = await callGemini(prompt, `You are a warm, faith-filled prayer counselor. You write prayers that are heartfelt, personal, and scripturally rich entirely in the language: "${language}".`);
        if (prayer && prayer.trim()) {
          return prayer.trim();
        }
      }
    } catch (err) {
      console.warn("Client Prayer reflection Gemini call failed, trying server fallback:", err);
    }
  }

  // Try server fallback
  try {
    const resp = await fetch("/api/prayer-companion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request, language }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.prayer) {
        return data.prayer;
      }
    }
  } catch (err) {
    console.warn("Server prayer companion fetch failed, trying local fallbacks:", err);
  }

  return `Dear Heavenly Father,

We lift up this request to You today: "${request}". In the midst of this situation, we claim Your promise in Philippians 4:6-7, to not be anxious about anything, but in everything by prayer and petition, with thanksgiving, present our requests to God. We ask for Your comfortable peace which transcends all standard understanding to guard this heart. Guide every step and let Your warm presence bring comfort. In Jesus' name, Amen.`;
}

// ==========================================
// 6. Devotional Study Guide
export interface DevotionalData {
  title: string;
  scripture: string;
  scriptureText: string;
  reflection: string;
  actionStep: string;
  prayer: string;
}

export async function getDevotional(topic: string, language: string = "English"): Promise<DevotionalData> {
  const selectedLanguage = language;
  const clientKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (clientKey) {
    try {
      const ai = getGeminiClient();
      if (ai) {
        const prompt = `Generate a daily devotional on the topic of "${topic}".
Please construct a strict JSON format with the following keys:
- "title": A catching, deep devotional title.
- "scripture": A scripture reference relevant to the topic (e.g. "Psalm 46:10").
- "scriptureText": The exact quotation text of that scripture.
- "reflection": A deep 3-paragraph devotional reflecting on the spiritual lessons. Ensure there are no backslashes or special escapes that break JSON.
- "actionStep": A concrete practical daily action/challenge step related to this devotional.
- "prayer": A short 3-line closing prayer.

You must return the Bible verse, the scripture reference, and the devotional reflection entirely in ${selectedLanguage}.
CRITICAL: Translate and write ALL fields (title, scripture reference, scriptureText, reflection, actionStep, prayer) entirely in the selected language: "${selectedLanguage}".
Do not include any Markdown blocks like \`\`\`json, just return raw JSON string starting with { and ending with }.`;

        const resultString = await callGemini(prompt, `You are a devotional author that produces warm, rich spiritual insights in JSON format entirely in the language: "${selectedLanguage}".`, { responseMimeType: "application/json" });
        const cleaned = cleanJsonString(resultString);
        const parsed = JSON.parse(cleaned);
        if (parsed && parsed.title && parsed.scripture && parsed.reflection) {
          return parsed as DevotionalData;
        }
      }
    } catch (err) {
      console.warn("Client Devotional Gemini call failed, trying server fallback:", err);
    }
  }

  // Try server fallback
  try {
    const resp = await fetch("/api/devotional", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, language }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.title && data.scripture && data.reflection) {
        return data;
      }
    }
  } catch (err) {
    console.warn("Server devotional fetch failed, trying local fallbacks:", err);
  }

  const DEVOTIONAL_LOCALIZED_FALLBACKS: Record<string, Record<string, DevotionalData>> = {
    "default": {
      "Spanish": {
        title: "Cultivando la fe día a día",
        scripture: "Salmo 23:3",
        scriptureText: "Él restaura mi alma; me guía por senderos de justicia por amor de su nombre.",
        reflection: "Centrarse en las Escrituras y en los principios bíblicos nos ayuda a centrar nuestro corazón en medio del estrés diario. Cuando las cosas se sienten abrumadoras, dar un paso atrás para reflexionar sobre los elementos centrales del evangelio asegura nuestra esperanza. La gracia de Dios es constante y proporciona arroyos espirituales refrescantes en temporadas de sequía.",
        actionStep: "Tómate 5 minutos hoy en meditación silenciosa, preguntándote cómo puedes vivir este enfoque en tus relaciones.",
        prayer: "Gracias, Padre, por Tu guía. Ayúdame a caminar en Tu sabiduría y a confiar en Tu amor perfecto hoy. Amén."
      },
      "Portuguese": {
        title: "Cultivando a Fé Dia a Dia",
        scripture: "Salmo 23:3",
        scriptureText: "Refrigera a minha alma; guia-me pelas veredas da justiça, por amor do seu nome.",
        reflection: "Focar nas Escrituras e nos princípios bíblicos nos ajuda a centrar nossos corações em meio ao estresse diário. Quando as coisas parecem esmagadoras, dar um passo atrás para refletir sobre os elementos centrais do evangelho assegura nossa esperança. A graça de Deus é constante e fornece riachos espirituais refrescantes em estações de seca.",
        actionStep: "Reserve 5 minutos hoje em meditação silenciosa, perguntando-se como você pode viver esse foco em seus relacionamentos.",
        prayer: "Obrigado, Pai, pelo Teu guia. Ajude-me a caminhar na Tua sabedoria e a confiar no Teu amor perfeito hoje. Amém."
      },
      "French": {
        title: "Cultiver la Foi Jour après Jour",
        scripture: "Psaume 23:3",
        scriptureText: "Il restaure mon âme, Il me conduit dans les sentiers de la justice, à cause de son nom.",
        reflection: "Se concentrer sur les Écritures et les principes bibliques nous aide à centrer nos cœurs au milieu du stress quotidien. Lorsque les choses semblent accablantes, prendre du recul pour réfléchir aux éléments essentiels de l'Évangile sécurise notre espérance. La grâce de Dieu est stable et fournit des courants spirituels rafraîchissants dans les saisons arides.",
        actionStep: "Prenez 5 minutes aujourd'hui pour méditer en silence, en vous demandant comment vous pouvez vivre cette concentration dans vos relations.",
        prayer: "Merci, Père, pour Ta direction. Aide-moi à marcher dans Ta sagesse et à faire confiance à Ton amour parfait aujourd'hui. Amen."
      },
      "Tagalog": {
        title: "Pagpapalago ng Pananampalataya Araw-araw",
        scripture: "Awit 23:3",
        scriptureText: "Inilalagay niya ang aking kaluluwa: pinapatnubayan niya ako sa mga landas ng katuwiran alang-alang sa kaniyang pangalan.",
        reflection: "Ang pagtutuon sa kasulatan at mga prinsipyo ng Bibliya ay tumutulong sa atin na isentro ang ating mga puso sa gitna ng pang-araw-araw na stress. Kapag ang mga bagay ay tila nakakapagod, ang pag-atras upang pagnilayan ang mga pangunahing elemento ng ebanghelyo ay nagpapatatag sa ating pag-asa. Ang biyaya ng Diyos ay matatag at nagbibigay ng nakakapreskong sapa ng espiritu.",
        actionStep: "Maglaan ng 5 minuto ngayon sa tahimik na meditasyon, na tinatanong ang sarili kung paano isasabuhay ang pagtutuon na ito sa iyong mga relasyon.",
        prayer: "Salamat, Ama, sa Iyong patnubay. Tulungan Mo akong lumakad sa Iyong karunungan at magtiwala sa Iyong perpektong pagmamahal ngayon. Amen."
      }
    },
    "hope": {
      "Spanish": {
        title: "Una esperanza anclada",
        scripture: "Hebreos 6:19",
        scriptureText: "La cual tenemos como segura y firme ancla del alma, y que penetra hasta dentro del velo.",
        reflection: "La esperanza no es un deseo piadoso; la esperanza bíblica es una confianza segura en las promesas de Dios. Cuando las olas de la vida rompen a nuestro alrededor, nuestro ancla permanece profunda en la presencia de Cristo. Esto nos mantiene estables incluso a través de las tormentas oscuras e impredecibles.",
        actionStep: "Escribe una cosa por la que estés ansioso y entrégala conscientemente como señal de colocar tu ancla.",
        prayer: "Señor, gracias por ser mi ancla firme. Elijo confiar en Tus promesas hoy. Amén."
      },
      "Portuguese": {
        title: "Uma Esperança Ancorada",
        scripture: "Hebreus 6:19",
        scriptureText: "A qual temos como âncora da alma, segura e firme, e que penetra até ao interior do véu.",
        reflection: "A esperança não é um pensamento positivo; a esperança bíblica é uma confiança segura nas promesas de Deus. Quando as ondas da vida quebram ao nosso redor, nossa âncora permanece profunda na presença de Cristo. Isso nos mantém firmes mesmo através das tempestades escuras e imprevisíveis.",
        actionStep: "Escreva uma coisa com a qual você está ansioso e entregue-a conscientemente como um sinal de colocar sua âncora.",
        prayer: "Seinho, obrigado por ser minha âncora firme. Escolho confiar em Tuas promessas hoje. Amém."
      },
      "French": {
        title: "Une Espérance Ancrée",
        scripture: "Hébreux 6:19",
        scriptureText: "Cette espérance, nous la possédons comme une ancre de l'âme, sûre et solide; elle pénètre au-delà du voile.",
        reflection: "L'espérance n'est pas un vœu pieux; l'espérance biblique est une confiance sûre dans les promesses de Dieu. Quand les vagues de la vie s'écrasent autour de nous, notre ancre reste ancrée profondément dans la présence de Christ. Cela nous maintient stables même à travers les tempêtes sombres et imprévisibles.",
        actionStep: "Écrivez une chose pour laquelle vous êtes inquiet et remettez-la consciemment comme un signe de placement de votre ancre.",
        prayer: "Seigneur, merci d'être mon ancre solide. Je choisis de faire confiance à Tes promesses aujourd'hui. Amen."
      },
      "Tagalog": {
        title: "Isang Naka-angkla na Pag-asa",
        scripture: "Hebreo 6:19",
        scriptureText: "Na siyang ating taglay na tulad sa âncora ng kaluluwa, isang pagasa na matibay at matatag at pumapasok sa kabila ng tabing.",
        reflection: "Ang pag-asa ay hindi lamang pangarap; ang biblikal na pag-asa ay isang matatag na tiwala sa mga pangako ng Diyos. Kapag ang mga alon ng buhay ay humahampas sa ating paligid, ang ating angkla ay nananatiling malalim sa piling ni Kristo. Pinapanatili tayong matatag nito kahit sa gitna ng madidilim at hindi inaasahang mga bagyo.",
        actionStep: "Isulat ang isang bagay na iyong kinababahala at ipagkatiwala ito sa Kanya bilang tanda ng pag-angkla.",
        prayer: "Panginoon, salamat sa pagiging matatag kong angkla. Pinipili kong magtiwala sa Iyong mga pangako ngayon. Amen."
      }
    },
    "anxiety": {
      "Spanish": {
        title: "Intercambiando la preocupación por la adoración",
        scripture: "1 Pedro 5:7",
        scriptureText: "Echando toda vuestra ansiedad sobre él, porque él tiene cuidado de vosotros.",
        reflection: "La ansiedad busca convencernos de que llevamos la vida solos. Pero las Escrituras nos recuerdan a un Padre que cuenta los cabellos de nuestra cabeza. Echar nuestras preocupaciones sobre Él es una disciplina diaria y activa de soltar el control y aceptar Su custodia amorosa.",
        actionStep: "Cada vez que un pensamiento estresante entre en tu mente hoy, susurra: 'El Señor está conmigo, Él cuida de mí'.",
        prayer: "Padre, te entrego mis preocupaciones y elijo adorar en lugar de preocuparme. Amén."
      },
      "Portuguese": {
        title: "Trocando a Preocupação por Adoração",
        scripture: "1 Pedro 5:7",
        scriptureText: "Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.",
        reflection: "A ansiedade busca nos convencer de que estamos carregando a vida sozinhos. Mas as Escrituras nos lembram de um Pai que conta os cabelos da nossa cabeça. Lançar nossas preocupações sobre Ele é uma disciplina diária e ativa de abrir mão do controle e aceitar Sua custódia amorosa.",
        actionStep: "Sempre que um pensamento estressante entrar em sua mente hoje, sussurre: 'O Senhor está comigo, Ele cuida de mim'.",
        prayer: "Pai, entrego minhas preocupações a Ti e escolho adorar em vez de me preocupar. Amém."
      },
      "French": {
        title: "Échanger l'Inquiétude contre l'Adoration",
        scripture: "1 Pierre 5:7",
        scriptureText: "Déchargez-vous sur lui de tous vos soucis, car lui-même prend soin de vous.",
        reflection: "L'anxiété cherche à nous convaincre que nous portons la vie seuls. Mais les Écritures nous rappellent un Père qui compte les cheveux de notre tête. Jeter nos inquiétudes sur Lui est une discipline quotidienne active consistant à abandonner le contrôle et à accepter Sa garde aimante.",
        actionStep: "Chaque fois qu'une pensée stressante vous traverse l'esprit aujourd'hui, chuchotez: 'Le Seigneur est avec moi, Il prend soin de moi'.",
        prayer: "Père, je Te remets mes soucis et je choisis d'adorer plutôt que de m'inquiéter. Amen."
      },
      "Tagalog": {
        title: "Pagpapalit ng Alalahanin sa Pagsamba",
        scripture: "1 Pedro 5:7",
        scriptureText: "Na inyong ilagak sa kaniya ang lahat ng inyong kabalisahan, sapagka't siya'y nagmamalasakit sa inyo.",
        reflection: "Sinisikap ng balisa na kumbinsihin tayo na nag-iisa tayo sa pagdadala ng buhay. Ngunit ipinapaalala sa atin ng Kasulatan ang isang Ama na nagbibilang ng buhok sa ating ulo. Ang paglalagak ng ating mga alalahanin sa Kanya ay isang aktibong pang-araw-araw na disiplina ng pagpapakawala ng kontrol.",
        actionStep: "Sa tuwing may darating na nakaka-stress na isipin ngayon, ibulong: 'Kasama ko ang Panginoon, nagmamalasakit Siya sa akin.'",
        prayer: "Ama, inilalagak ko sa Iyo ang aking mga alalahanin at pinipili kong sumamba sa Iyo ngayon. Amen."
      }
    },
    "healing": {
      "Spanish": {
        title: "Restaurado y hecho completo",
        scripture: "Salmo 147:3",
        scriptureText: "Él sana a los quebrantados de corazón, y venda sus heridas.",
        reflection: "La sanidad es un proceso que abarca nuestro ser físico, emocional y espiritual. Dios no está distante de nuestro dolor; Él es un médico tierno y cercano a los quebrantados. Cuando le traemos nuestras cicatrices, nos recibe con gracia y restauración ilimitadas.",
        actionStep: "Envía un mensaje tierno de consuelo o aliento a alguien que conocas que esté pasando por una temporada difícil.",
        prayer: "Señor, trae Tu sanidad a mi corazón y cuerpo hoy. Confío en Tu tierno cuidado. Amén."
      },
      "Portuguese": {
        title: "Restaurado e Feito Completo",
        scripture: "Salmo 147:3",
        scriptureText: "Sara os quebrantados de coração e liga-lhes as feridas.",
        reflection: "A cura é um processo que abrange nosso ser físico, emocional e espiritual. Deus não está distante de nossa dor; Ele é um médico compassivo e próximo aos quebrantados. Quando Lhe trazemos nossas cicatrizes, Ele nos encontra com graça e restauração ilimitadas.",
        actionStep: "Envie uma mensagem gentil de conforto ou encorajamento para alguém que você conhece que está passando por uma fase difícil.",
        prayer: "Seinho, traz Tua cura ao meu coração e corpo hoje. Confio no Teu terno cuidado. Amém."
      },
      "French": {
        title: "Restauré et Rendu Entier",
        scripture: "Psaume 147:3",
        scriptureText: "Il guérit ceux qui ont le cœur brisé, et il panse leurs blessures.",
        reflection: "La guérison est un processus qui englobe notre être physique, émotionnel et spirituel. Dieu n'est pas distant de notre douleur; Il est un médecin tendre et proche de ceux qui ont le cœur brisé. Quand nous Lui apportons nos cicatrices, Il nous accueille avec une grâce et une restauration illimitées.",
        actionStep: "Envoyez un message doux de réconfort ou d'encouragement à quelqu'un que vous connaissez qui traverse une période difficile.",
        prayer: "Seigneur, apporte Ta guérison à mon cœur et à mon corps aujourd'hui. J'ai confiance en Ton tendre soin. Amen."
      },
      "Tagalog": {
        title: "Ipinanumbalik at Ginawang Buo",
        scripture: "Awit 147:3",
        scriptureText: "Kaniyang pinagagaling ang mga may bagbag na puso, at ginagamot niya ang kanilang mga sugat.",
        reflection: "Ang paggaling ay isang proseso na sumasaklaw sa ating pisikal, emosyonal, at espirituwal na pagkatao. Ang Diyos ay hindi malayo sa ating sakit; Siya ay isang mapagmahal na manggagamot na malapit sa mga may sugat na puso.",
        actionStep: "Magpadala ng mensahe ng comfort o pampalakas-loob sa isang kakilala na nakakaranas ng pagsubok ngayon.",
        prayer: "Panginoon, dalhin Mo ang Iyong paggaling sa aking puso at katawan ngayon. Nagtitiwala ako sa Iyong kalinga. Amen."
      }
    }
  };

  const t = topic.toLowerCase();
  let key = "default";
  if (t.includes("hope")) {
    key = "hope";
  } else if (t.includes("anxiety") || t.includes("worry") || t.includes("stress")) {
    key = "anxiety";
  } else if (t.includes("healing") || t.includes("pain") || t.includes("sickness")) {
    key = "healing";
  }

  const fallbackSet = DEVOTIONAL_LOCALIZED_FALLBACKS[key];
  if (fallbackSet && fallbackSet[language]) {
    return fallbackSet[language];
  }

  // English fallback fallback
  let scripture = "Psalm 23:3";
  let title = "Cultivating Faith Day by Day";
  let text = "He restores my soul; He leads me in the paths of righteousness for His name's sake.";
  let refl = "Focusing on scripture and biblical principles assists us in centering our hearts in the midst of daily stress. When things feel overwhelming, stepping back to reflect on the core elements of the gospel secures our hope. God's grace is steady and provides refreshing spiritual streams in dusty seasons.";
  let action = "Take 5 minutes today in quiet meditation, asking how you can live out this focus in your relationships.";
  let prayer = "Thank You, Father, for Your guidance. Help me walk in Your wisdom and trust Your perfect love today. Amen.";

  if (key === "hope") {
    title = "An Anchored Hope";
    scripture = "Hebrews 6:19";
    text = "We have this hope as an anchor for the soul, firm and secure.";
    refl = "Hope is not wishful thinking; biblical hope is a secure confidence in God's promises. When the waves of life crash around us, our anchor remains deep in the presence of Christ. This keeps us steady even through the dark and unpredictable storms.";
    action = "Write down one thing you are anxious about and consciously surrender it as a sign of placing your anchor.";
  } else if (key === "anxiety") {
    title = "Trading Worry for Worship";
    scripture = "1 Peter 5:7";
    text = "Cast all your anxiety on him because he cares for you.";
    refl = "Anxiety seeks to convince us that we are carrying life alone. But the scriptures remind us of a Father who numbers the hairs on our head. Casting our worries onto Him is an active, daily discipline of letting go of control and accepting His loving custody.";
    action = "Whenever a stressful thought enters your mind today, whisper: 'The Lord is with me, He cares for me.'";
  } else if (key === "healing") {
    title = "Restored and Made Whole";
    scripture = "Psalm 147:3";
    text = "He heals the brokenhearted and binds up their wounds.";
    refl = "Healing is a process that encompasses our physical, emotional, and spiritual selves. God is not distant from our pain; He is a tender physician close to the broken. When we bring our scars to Him, He meets us with boundless grace and restoration.";
    action = "Send a gentle message of comfort or encouragement to someone you know who is going through a painful season.";
  }

  return {
    title,
    scripture,
    scriptureText: text,
    reflection: refl,
    actionStep: action,
    prayer
  };
}
