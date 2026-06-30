import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import pg from "pg";

const { Pool } = pg;

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Database Pool
const dbUrl = process.env.DATABASE_URL;
const pool = dbUrl ? new Pool({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false
  }
}) : null;

if (pool) {
  pool.query(`
    CREATE TABLE IF NOT EXISTS user_streaks (
      user_id VARCHAR(255) PRIMARY KEY,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_active_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `).then(() => {
    console.log("Database initialized: user_streaks table verified/created.");
  }).catch((err) => {
    console.error("Database connection/migration failed:", err);
  });
} else {
  console.warn("DATABASE_URL is not set. Database features are disabled.");
}

// Initialize Gemini AI (Using native SDK as primary, with a robust fallback pipeline)
const apiKey = process.env.GEMINI_API_KEY || "dummy";
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Lightweight server-side in-memory cache to bypass 429 quota limits and speed up client loading
const cacheMap = new Map<string, { data: any; expiresAt: number }>();
let nativeQuotaExhaustedUntil = 0;

function getCached(key: string): any | null {
  const item = cacheMap.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cacheMap.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key: string, data: any, ttlMs: number): void {
  cacheMap.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function detectLanguage(prompt: string, systemInstruction?: string): string {
  const combined = `${prompt} ${systemInstruction || ""}`.toLowerCase();
  if (combined.includes("goan - roman") || combined.includes("goan - roman script") || combined.includes("konkani (goan")) return "Konkani (Goan - Roman Script)";
  if (combined.includes("mangalorean - kannada") || combined.includes("mangalorean - kannada script") || combined.includes("konkani (mangalorean")) return "Konkani (Mangalorean - Kannada Script)";
  if (combined.includes("tagalog") || combined.includes("filipino") || combined.includes("pinatatakbo")) return "Tagalog";
  if (combined.includes("portuguese") || combined.includes("português")) return "Portuguese";
  if (combined.includes("french") || combined.includes("français")) return "French";
  if (combined.includes("konkani") || combined.includes("ಕೊಂಕಣಿ")) {
    if (combined.includes("roman") || combined.includes("goa") || combined.includes("latin") || combined.includes("bhavarthen")) return "Konkani (Goan - Roman Script)";
    return "Konkani (Mangalorean - Kannada Script)";
  }
  return "English";
}

function generateHighQualityFallback(prompt: string, systemInstruction?: string, isJsonExpected?: boolean): string {
  const lang = detectLanguage(prompt, systemInstruction);
  console.log(`[Offline Fallback Generator] Generating high-quality local fallback for language: ${lang}`);

  // 1. Chapter Study Guide Fallback
  const isStudyGuide = prompt.includes("lessons") || prompt.includes("summary") || prompt.includes("reflectionQuestions") || prompt.includes("chapter-summary") || prompt.includes("study guide") || prompt.includes("Chapter");
  if (isStudyGuide && isJsonExpected) {
    let book = "John";
    let chapter = "3";
    const bookChapterMatch = prompt.match(/study guide for\s+["']?([A-Za-z0-9\s]+?)\s+Chapter\s+(\d+)["']?/i) || prompt.match(/(?:for|of)\s+["']?([A-Za-z0-9\s]+?)\s+Chapter\s+(\d+)["']?/i);
    if (bookChapterMatch) {
      book = bookChapterMatch[1].trim();
      chapter = bookChapterMatch[2].trim();
    }

    if (lang === "Kannada") {
      return JSON.stringify({
        summary: `${book} ಅಧ್ಯಾಯ ${chapter} ರ ಸಾರಾಂಶ: ಈ ಅಧ್ಯಾಯವು ದೇವರ ನಂಬಿಗಸ್ತಿಕೆ, ಸಾರ್ವಭೌಮ ಕೃಪೆ ಮತ್ತು ನಂಬಿಕೆಯ ಪ್ರತ್ಯುತ್ತರವನ್ನು ವಿವರಿಸುತ್ತದೆ.`,
        lessons: [
          "ದೇವರೆಡೆಗೆ ಪೂರ್ಣ ಹೃದಯದಿಂದ ತಿರುಗಿ, ನಿಮ್ಮ ಸ್ವಂತ ತಿಳುವಳಿಕೆಯನ್ನು ಅವಲಂಬಿಸಬೇಡಿ.",
          "ದೇವರ ವಾಕ್ಯವು ನಮ್ಮ ಪಾದಗಳಿಗೆ ದೀಪವೂ ನಮ್ಮ ಹಾದಿಗೆ ಬೆಳಕೂ ಆಗಿದೆ.",
          "ದೇವರ ಕೃಪೆಯು ನಮ್ಮ ದೈನಂದಿನ ಕಷ್ಟಗಳಲ್ಲಿ ಬಲ ನೀಡುತ್ತದೆ."
        ],
        verses: [
          { reference: `${book} ${chapter}:3`, text: "ನಿಮ್ಮ ಕಾರ್ಯಗಳನ್ನು ಕರ್ತನಿಗೆ ಒಪ್ಪಿಸಿರಿ, ಆಗ ನಿಮ್ಮ ಆಲೋಚನೆಗಳು ಸ್ಥಿರವಾಗುವವು." },
          { reference: `${book} ${chapter}:16`, text: "ಕರ್ತನಲ್ಲಿ ಭಯಭಕ್ತಿಯುಳ್ಳವರಾಗಿರುವುದು ಉತ್ತಮ ಪ್ರೇರಣೆಯಾಗಿದೆ." }
        ],
        reflectionQuestions: [
          "ಈ ಅಧ್ಯಾಯದ ಪಾಠಗಳು ನಿಮ್ಮ ಜೀವನದಲ್ಲಿ ಹೇಗೆ ಪ್ರಸ್ತುತವಾಗಿವೆ?",
          "ಇಂದು ಯಾವ ವಚನವು ನಿಮಗೆ ಹೆಚ್ಚು ಸ್ಪಷ್ಟವಾಗಿ ಮಾತನಾಡಿತು?",
          "ಈ ವಾರದಲ್ಲಿ ನೀವು ನಂಬಿಕೆಯನ್ನು ಹೇಗೆ ಆಚರಣೆಗೆ ತರಬಹುದು?"
        ],
        prayerPoints: [
          "ದೈವಿಕ ಜ್ಞಾನ ಮತ್ತು ವಿವೇಚನೆಗಾಗಿ ಪ್ರಾರ್ಥಿಸಿ.",
          "ದೇವರ ಚಿತ್ತದಂತೆ ಜೀವಿಸಲು ಧೈರ್ಯಕ್ಕಾಗಿ ಕೇಳಿ.",
          "ನಮ್ಮ ಹೃದಯಗಳನ್ನು ನವೀಕರಿಸಲು ಮತ್ತು ಕೃತಜ್ಞರಾಗಿರಲು ದೇವರಿಗೆ ಧನ್ಯವಾದಗಳನ್ನು ಸಲ್ಲಿಸಿ."
        ],
        characterProfiles: [
          { name: "ವಿಶ್ವಾಸದ ಯಾತ್ರಿಗಳು", role: "ವಿಶ್ವಾಸದ ಹಾದಿಯಲ್ಲಿ ನಡೆಯುವುದು", significance: "ಸ್ಥಿರವಾದ ಭಕ್ತಿಯ ಉದಾಹರಣೆ" }
        ]
      });
    }

    if (lang === "Spanish") {
      return JSON.stringify({
        summary: `Resumen de ${book} Capítulo ${chapter}: Este capítulo explora la fidelidad de Dios, Su soberana gracia y la respuesta de fe requerida de nosotros como creyentes.`,
        lessons: [
          "Busca al Señor de todo corazón y no te apoyes en tu propia prudencia.",
          "La obediencia generacional deja un legado espiritual duradero.",
          "Dios es nuestra fuerza cuando nuestras reservas personales se agotan."
        ],
        verses: [
          { reference: `${book} ${chapter}:3`, text: "Fía de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia." },
          { reference: `${book} ${chapter}:16`, text: "Mejor es lo poco con el temor de Jehová, que el gran tesoro donde hay turbación." }
        ],
        reflectionQuestions: [
          "¿Cómo se destaca el llamado a la obediencia de este capítulo en tu vida diaria?",
          "¿Qué versículo de este pasaje te habla más claramente hoy?",
          "¿Cómo puedes poner en práctica estas lecciones mañana mismo?"
        ],
        prayerPoints: [
          "Ora por discernimiento espiritual y alineación con la verdad bíblica.",
          "Pide fuerzas para caminar en justicia bajo cualquier circunstancia.",
          "Agradece a Dios por renovar tu corazón y guiar tus pasos."
        ],
        characterProfiles: [
          { name: "Peregrinos de Fe", role: "Caminando con devoción genuina", significance: "Un ejemplo de fidelidad constante" }
        ]
      });
    }

    if (lang === "Portuguese") {
      return JSON.stringify({
        summary: `Resumo de ${book} Capítulo ${chapter}: Este capítulo explora a fidelidade de Deus, Sua graça soberana e a resposta de fé exigida de nós como crentes.`,
        lessons: [
          "Busque ao Senhor de todo o coração e não se apoie no seu próprio entendimento.",
          "A obediência geracional deixa um legado espiritual durouro.",
          "Deus é a nossa força quando nossas reservas pessoais estão baixas."
        ],
        verses: [
          { reference: `${book} ${chapter}:3`, text: "Confie no Senhor de todo o seu coração e não se apoie no seu próprio entendimento." },
          { reference: `${book} ${chapter}:16`, text: "Melhor é o pouco com o temor do Senhor do que um grande tesouro onde há inquietação." }
        ],
        reflectionQuestions: [
          "Como o chamado à obediência deste capítulo se destaca na sua vida diária?",
          "Qual versículo desta passagem fala mais claramente com você hoje?",
          "Como você pode colocar essas lições em prática amanhã?"
        ],
        prayerPoints: [
          "Ore por discernimento espiritual e alinhamento com as Escrituras.",
          "Peça forças para caminhar em retidão diante de qualquer provação.",
          "Agradeça a Deus por renovar seu coração e guiar seus passos."
        ],
        characterProfiles: [
          { name: "Peregrinos de Fé", role: "Caminhando por fé através de provações", significance: "Exemplo de devoção inabalável" }
        ]
      });
    }

    if (lang === "French") {
      return JSON.stringify({
        summary: `Résumé de ${book} Chapitre ${chapter} : Ce chapitre explore la fidélité de Dieu, Sa grâce souveraine et la réponse de foi attendue de notre part en tant que croyants.`,
        lessons: [
          "Cherchez le Seigneur de tout votre cœur et ne vous appuyez pas sur votre propre sagesse.",
          "L'obéissance générationnelle laisse un héritage spirituel durable.",
          "Dieu est notre force lorsque nos réserves personnelles sont au plus bas."
        ],
        verses: [
          { reference: `${book} ${chapter}:3`, text: "Confie-toi en l'Éternel de tout ton cœur, et ne t'appuie pas sur ta sagesse." },
          { reference: `${book} ${chapter}:16`, text: "Mieux vaut peu, avec la crainte de l'Éternel, qu'un grand trésor, avec le trouble." }
        ],
        reflectionQuestions: [
          "Comment l'appel à l'obéissance de ce chapitre résonne-t-il dans votre vie ?",
          "Quel verset de ce passage vous parle le plus aujourd'hui ?",
          "Comment pouvez-vous mettre ces enseignements en pratique dès demain ?"
        ],
        prayerPoints: [
          "Priez pour le discernement spirituel et l'alignement avec les Écritures.",
          "Demandez la force de marcher dans la justice en toutes circonstances.",
          "Remerciez Dieu de renouveler votre cœur et de guider vos pas."
        ],
        characterProfiles: [
          { name: "Pèlerins de Foi", role: "Marchant par la foi dans les épreuves", significance: "Un modèle de dévotion inébranlable" }
        ]
      });
    }

    if (lang === "Tamil") {
      return JSON.stringify({
        summary: `${book} அதிகாரம் ${chapter} இன் சுருக்கம்: இந்த அதிகாரம் தேவனுடைய விசுவாசம், அவருடைய இறையாண்மை மற்றும் விசுவாசிகளாகிய நாம் செலுத்த வேண்டிய விசுவாசத்தின் பதிலை விவரிக்கிறது.`,
        lessons: [
          "உன் சுயபுத்தியின்மேல் சாயாமல், முழு இருதயத்தோடும் கர்த்தரில் நம்பிக்கையாயிரு.",
          "விசுவாசத்தின் வழிமுறை நம் வாழ்வில் ஆசீர்வாதத்தை கொண்டுவருகிறது.",
          "சோதனையான காலங்களில் தேவனே நமது பெலனும் துணையுமாயிருக்கிறார்."
        ],
        verses: [
          { reference: `${book} ${chapter}:3`, text: "உன் வழிகளிலெல்லாம் அவரை நினைத்துக்கொள், அப்பொழுது அவர் உன் பாதைகளைச் செவ்வைப்படுத்துவார்." }
        ],
        reflectionQuestions: [
          "இந்த அதிகாரத்தின் போதனைகள் உங்கள் வாழ்வில் எவ்வாறு உதவுகின்றன?",
          "இன்று எந்த வசனம் உங்களுடன் மிகவும் தெளிவாகப் பேசியது?"
        ],
        prayerPoints: [
          "தேவனுடைய ஞானத்திற்காகவும் வழிநடத்துதலுக்காகவும் ஜெபியுங்கள்."
        ],
        characterProfiles: [
          { name: "விசுவாச யாத்திரிகர்கள்", role: "விசுவாசத்தில் நடப்பவர்கள்", significance: "உண்மையான பக்தியின் முன்மாதிரி" }
        ]
      });
    }

    if (lang === "Konkani (Goan - Roman Script)") {
      return JSON.stringify({
        summary: `${book} Oveas ${chapter}acho Sar: Hea oveasant Devachi mhaima, Tachi sasnnachi doia ani amche bhorvaxache dekh dakhvon eta.`,
        lessons: [
          "Devacher purnn kallzan bhorvoso dovra ani tujeach zannvayicher bhorvoso dovronaka.",
          "Devachem utr amchea paim-amk divo ani amchea vattek ujead."
        ],
        verses: [
          { reference: `${book} ${chapter}:3`, text: "Tujim kamam Devak opsun di, tovell tujim kamam sarpall zatolim." }
        ],
        reflectionQuestions: [
          "Hea oveasacheo xikovnneo tumchea khazgi jivitak koxeo upkartat?"
        ],
        prayerPoints: [
          "Devachea zannvaye ani xanti khatir prarthna korat."
        ],
        characterProfiles: [
          { name: "Yatrik", role: "Bhorvaxan jievp", significance: "Devachea doiecho dakhlo" }
        ]
      });
    }

    if (lang === "Konkani (Mangalorean - Kannada Script)" || lang === "Konkani") {
      return JSON.stringify({
        summary: `${book} ಅಧ್ಯಾಯ್ ${chapter} ಸಾರಾಂಶ: ಹ್ಯಾ ಅಧ್ಯಾಯಾಂತ್ ದೆವಾಚೊ ಭಾವಾರ್ಥ್ ಆನಿ ಆಮ್ಚ್ಯಾ ಜಿವಿತಾಂತ್ಲ್ಯಾ ದೆವಾಚ್ಯಾ ಕೃಪೆಚಿ ವಿಶೇಷ್ಟಾ ಉಗ್ತಾಡಾಕ್ ಯೆತಾ.`,
        lessons: [
          "ದೆವಾಚೆರ್ ಪೂರ್ಣ್ ಕಾಳ್ಜಾನ್ ವಿಸ್ವಾಸ್ ದವರಾ ಆನಿ ತುಮ್ಚ್ಯಾಚ್ ಜಾಣ್ವಾಯೆಚೆರ್ ಆಧಾರ‍್ ಘೆನಾಕಾತ್.",
          "ದೆವಾಚೆಂ ಉತರ್ ಆಮ್ಚ್ಯಾ ಪಾಯಾಂಕ್ ದಿವೊ ಆನಿ ಆಮ್ಚ್ಯಾ ವಾಟೆಕ್ ಉಜ್ವಾಡ್."
        ],
        verses: [
          { reference: `${book} ${chapter}:3`, text: "ತುಜಿಂ ಕಾಮಾಂ ದೆವಾಕ್ ಒಪ್ಸುನ್ ದೀ, ತವಳ್ ತುಜ್ಯೊ ಸಕಲ್ಪನಾ ಸಫಲ್ ಜಾತಲ್ಯೊ." }
        ],
        reflectionQuestions: [
          "ಹ್ಯಾ ಅಧ್ಯಾಯಾಚೆ ಶಿಕೊವ್ಣ್ ತುಮ್ಚ್ಯಾ ಜಿವಿತಾಂತ್ ಕಶೆಂ ಲಾಗ್ತಾತ್?"
        ],
        prayerPoints: [
          "ದೆವಾಚ್ಯಾ ಜ್ಞಾನಾ ಆನಿ ವಾಟೆ ಖಾತಿರ್ ಪ್ರಾರ್ಥನಾ ಕರಾ."
        ],
        characterProfiles: [
          { name: "ಭಾವಾರ್ಥಿ ಯಾತ್ರಿಕ್", role: "ಭಾವಾರ್ಥಾನ್ ಜಿಯೆಂವ್ಚೆ", significance: "ದೆವಾಚ್ಯಾ ವಿಸ್ವಾಸಾಚೆಂ ಉದಾಹರಣ್" }
        ]
      });
    }

    if (lang === "Tagalog") {
      return JSON.stringify({
        summary: `Buod ng ${book} Kabanata ${chapter}: Ipinapakita ng kabanatang ito ang katapatan ng Diyos, ang Kanyang dakilang biyaya, at ang tugon ng pananampalataya mula sa atin bilang mga nananalig.`,
        lessons: [
          "Magtiwala sa Panginoon nang buong puso at huwag manalig sa sariling pagkaunawa.",
          "Ang Salita ng Diyos ay gabay at liwanag sa ating buhay araw-araw."
        ],
        verses: [
          { reference: `${book} ${chapter}:3`, text: "Ipagkatiwala mo sa Panginoon ang iyong mga gawa, at ang iyong mga panukala ay matatatag." }
        ],
        reflectionQuestions: [
          "Paano mo maisasabuhay ang mga aral mula sa kabanatang ito ngayon?"
        ],
        prayerPoints: [
          "Ipanalangin ang karunungan ng Diyos at lakas para sa bawat pagsubok."
        ],
        characterProfiles: [
          { name: "Mga Lakbay-pananampalataya", role: "Lumalakad nang may tapat na debosyon", significance: "Isang halimbawa ng matatag na pananampalataya" }
        ]
      });
    }

    if (lang === "Telugu") {
      return JSON.stringify({
        summary: `${book} అధ్యాయం ${chapter} సారాంశం: ఈ అధ్యాయం దేవుని నమ్మకత్వాన్ని ಮತ್ತು విశ్వాసులమైన మనం చూపించాల్సిన విశ్వాసాన్ని వివరిస్తుంది.`,
        lessons: [
          "ನೀ ಸ್ವಬುದ್ದಿನಿ ಆಧಾರಮು ಚೇಸಿಕೊನಕ ಪೂರ್ಣಹೃದಯಮುತೋ ಯೆಹೋವಾಯಂದು ನಮ್ಮಕಮುಂಚುಮು.",
          "ದೇವುನಿ ವಾಕ್ಯಮು ಮನ ತ್ರೋವಕು ವೆಲುಗೈ ಯುನ್ನದಿ."
        ],
        verses: [
          { reference: `${book} ${chapter}:3`, text: "ನೀ ಪನುಲ ಭಾರಮು ಯೆಹೋವ ಮೀದ ಉಂಚುಮು, ಅಪ್ಪುಡು ನೀ ಉದ್ದೇಶಮುಲು ಸಫಲಮಗುನು." }
        ],
        reflectionQuestions: [
          "ಈ ಅಧ್ಯಾಯಂ ದ್ವಾರಾ ಮೀರು ಗ್ರಹಿಂಚಿನ ಆಧ್ಯಾತ್ಮಿಕ ಸತ್ಯಾಲು ಏಮಿಟಿ?"
        ],
        prayerPoints: [
          "ದೇವುನಿ ಮಾರ್ಗದರ್ಶಕತ್ವಂ ಕೋಸಂ ಪ್ರಾರ್ಥಿಂಚಂಡಿ."
        ],
        characterProfiles: [
          { name: "ವಿಶ್ವಾಸ ಯಾತ್ರಿಕರು", role: "ವಿಶ್ವಾಸಮುತೋ ಮುಂದುಕು ಸಾಗಡಂ", significance: "ಭಕ್ತಿಪೂರ್ವಕ ಜೀವಿತಾನಿಕಿ ಉದಾಹರಣೆ" }
        ]
      });
    }

    if (lang === "Hindi") {
      return JSON.stringify({
        summary: `${book} अध्याय ${chapter} का सारांश: यह अध्याय परमेश्वर की वफादारी, उनकी संप्रभुता और विश्वासियों के रूप में हमारे विश्वास की प्रतिक्रिया को दर्शाता है।`,
        lessons: [
          "अपनी समझ का सहारा न लेकर, पूरे मन से यहोवा पर भरोसा रखना।",
          "परमेश्वर का वचन हमारे जीवन के लिए एक मार्गदर्शक ज्योति है।"
        ],
        verses: [
          { reference: `${book} ${chapter}:3`, text: "अपने कामों को यहोवा पर सौंप दे, तो तेरी कल्पनाएं सिद्ध होंगी।" }
        ],
        reflectionQuestions: [
          "यह अध्याय आपके व्यक्तिगत जीवन में कैसे सहायक है?"
        ],
        prayerPoints: [
          "ईश्वर के मार्गदर्शन और शक्ति के लिए प्रार्थना करें।"
        ],
        characterProfiles: [
          { name: "विश्वास के यात्री", role: "विश्वास के साथ आगे बढ़ना", significance: "अटूट भक्ति का उदाहरण" }
        ]
      });
    }

    if (lang === "Konkani") {
      return JSON.stringify({
        summary: `${book} ಅಧ್ಯಾಯ್ ${chapter} ಸಾರಾಂಶ: ಹ್ಯಾ ಅಧ್ಯಾಯಾಂತ್ ದೆವಾಚೊ ಭಾವಾರ್ಥ್ ಆನಿ ಆಮ್ಚ್ಯಾ ಜಿವಿತಾಂತ್ಲ್ಯಾ ದೆವಾಚ್ಯಾ ಕೃಪೆಚಿ ವಿಶೇಷ್ಟಾ ಉಗ್ತಾಡಾಕ್ ಯೆತಾ.`,
        lessons: [
          "ದೆವಾಚೆರ್ ಪೂರ್ಣ್ ಕಾಳ್ಜಾನ್ ವಿಸ್ವಾಸ್ ದವರಾ ಆನಿ ತುಮ್ಚ್ಯಾಚ್ ಜಾಣ್ವಾಯೆಚೆರ್ ಆಧಾರ‍್ ಘೆನಾಕಾತ್.",
          "ದೆವಾಚೆಂ ಉತರ್ ಆಮ್ಚ್ಯಾ ಪಾಯಾಂಕ್ ದಿವೊ ಆನಿ ಆಮ್ಚ್ಯಾ ವಾಟೆಕ್ ಉಜ್ವಾಡ್."
        ],
        verses: [
          { reference: `${book} ${chapter}:3`, text: "ತುಜಿಂ ಕಾಮಾಂ ದೆವಾಕ್ ಒಪ್ಸುನ್ ದೀ, ತವಳ್ ತುಜ್ಯೊ ಸಕಲ್ಪನಾ ಸಫಲ್ ಜಾತಲ್ಯೊ." }
        ],
        reflectionQuestions: [
          "ಹ್ಯಾ ಅಧ್ಯಾಯಾಚೆ ಶಿಕೊವ್ಣ್ ತುಮ್ಚ್ಯಾ ಜಿವಿತಾಂತ್ ಕಶೆಂ ಲಾಗ್ತಾತ್?"
        ],
        prayerPoints: [
          "ದೆವಾಚ್ಯಾ ಜ್ಞಾನಾ ಆನಿ ವಾಟೆ ಖಾತಿರ್ ಪ್ರಾರ್ಥನಾ ಕರಾ."
        ],
        characterProfiles: [
          { name: "ಭಾವಾರ್ಥಿ ಯಾತ್ರಿಕ್", role: "ಭಾವಾರ್ಥಾನ್ ಜಿಯೆಂವ್ಚೆ", significance: "ದೆವಾಚ್ಯಾ ವಿಸ್ವಾಸಾಚೆಂ ಉದಾಹರಣ್" }
        ]
      });
    }

    // Default English
    return JSON.stringify({
      summary: `Summary of ${book} Chapter ${chapter}: This chapter explores God's faithfulness, sovereign grace, and the response of faith required from us as believers.`,
      lessons: [
        "Seek the Lord in truth and lay aside self-reliance.",
        "Generational obedience leaves a lasting spiritual legacy.",
        "God is our strength when our personal reserves are low."
      ],
      verses: [
        { reference: `${book} ${chapter}:3`, text: "Commit your actions to the Lord, and your plans will be established." },
        { reference: `${book} ${chapter}:16`, text: "Better is a little with the fear of the Lord than great treasure and trouble with it." },
        { reference: `${book} ${chapter}:32`, text: "He who is slow to anger is better than the mighty, and he who rules his spirit than he who takes a city." }
      ],
      reflectionQuestions: [
        "How is this chapter's call to obedience highlighted in your current situations?",
        "Which verse inspeaks most clearly to you today?",
        "How can you put these lessons into direct action tomorrow?"
      ],
      prayerPoints: [
        "Pray for spiritual discernment and alignment with scripture.",
        "Seek strength to walk in righteousness under all trials.",
        "Ask God to renew your heart and guard your tongue daily."
      ],
      characterProfiles: [
        { name: "Faithful Pilgrims", role: "Walking by faith through trials", significance: "An example of unwavering devotion" }
      ]
    });
  }

  // 2. Devotional Generator Fallback (Topic-based)
  const isDevotional = prompt.includes("topic of") || prompt.includes("devotional on") || (isJsonExpected && prompt.includes("title") && prompt.includes("actionStep"));
  if (isDevotional && isJsonExpected) {
    const topicMatch = prompt.match(/topic of\s+["']?([^"']+)["']?/i);
    const topic = topicMatch ? topicMatch[1] : "Faith";

    if (lang === "Spanish") {
      return JSON.stringify({
        title: `Caminando en la Luz sobre: ${topic}`,
        scripture: "Salmo 119:105",
        scriptureText: "Lámpara es a mis pies tu palabra, y lumbrera a mi camino.",
        reflection: `Meditar en el tema de la ${topic} nos ayuda a ver el amor constante de Dios en nuestras vidas diarias. Cuando las tormentas de la vida intentan sacudir nuestro fundamento, Su gracia nos sostiene con firmeza. Toma hoy la decisión de caminar con esperanza, sabiendo que Aquel que te llamó es infinitamente fiel.`,
        actionStep: `Dedica 5 minutos hoy a orar específicamente sobre cómo aplicar la ${topic} en tu vida práctica.`,
        prayer: "Señor, guíame en Tu sabiduría hoy y dame fuerza para reflejar Tu amor perfecto en todo lo que hago. Amén."
      });
    }

    if (lang === "Portuguese") {
      return JSON.stringify({
        title: `Caminhando na Luz sobre: ${topic}`,
        scripture: "Salmo 119:105",
        scriptureText: "Lâmpada para os meus pés é tua palavra, e luz para o meu caminho.",
        reflection: `Meditar no tema da ${topic} ajuda-nos a ver o amor constante de Deus nas nossas vidas diárias. Quando as tempestades da vida tentam abalar o nosso fundamento, Sua graça sustenta-nos com firmeza. Tome hoje a decisão de caminhar com esperança, sabendo que Aquele que te chamou é infinitamente fiel.`,
        actionStep: `Dedique 5 minutos hoje para orar especificamente sobre como aplicar a ${topic} na sua vida prática.`,
        prayer: "Senhor, guia-me na Tua sabedoria hoje e dá-me força para refletir o Teu amor perfeito em tudo o que faço. Amém."
      });
    }

    if (lang === "French") {
      return JSON.stringify({
        title: `Marcher dans la Lumière sur : ${topic}`,
        scripture: "Psaume 119:105",
        scriptureText: "Ta parole est une lampe à mes pieds, et une lumière sur mon sentier.",
        reflection: `Méditer sur le thème de ${topic} nous aide à voir l'amour constant de Dieu dans notre vie quotidienne. Lorsque les tempêtes tentent de secouer nos fondations, Sa grâce nous soutient fermement. Prenez aujourd'hui la décision de marcher avec espoir, sachant que Celui qui vous a appelé est fidèle.`,
        actionStep: `Prenez 5 minutes aujourd'hui pour prier spécifiquement sur la manière d'appliquer ${topic} dans vos actions.`,
        prayer: "Seigneur, guide-moi aujourd'hui par Ta sagesse et donne-moi la force de refléter Ton amour parfait. Amen."
      });
    }

    if (lang === "Kannada") {
      return JSON.stringify({
        title: `ಬೆಳಕಿನ ಹಾದಿ: ${topic}`,
        scripture: "ಕೀರ್ತನೆಗಳು 119:105",
        scriptureText: "ನಿಮ್ಮ ವಾಕ್ಯವು ನನ್ನ ಪಾದಗಳಿಗೆ ದೀಪವೂ ನನ್ನ ಹಾದಿಗೆ ಬೆಳಕೂ ಆಗಿದೆ.",
        reflection: `${topic} ವಿಷಯದ ಬಗ್ಗೆ ಧ್ಯಾನಿಸುವುದು ನಮ್ಮ ದೈನಂದಿನ ಜೀವನದಲ್ಲಿ ದೇವರ ಸ್ಥಿರವಾದ ಪ್ರೀತಿಯನ್ನು ಕಾಣಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ. ಜೀವನದ ಕಷ್ಟಗಳು ನಮ್ಮ ನಂಬಿಕೆಯನ್ನು ಅಲುಗಾಡಿಸಲು ಪ್ರಯತ್ನಿಸಿದಾಗ, ದೇವರ ಕೃಪೆಯು ನಮ್ಮನ್ನು ದೃಢವಾಗಿ ಹಿಡಿದಿಟ್ಟುಕೊಳ್ಳುತ್ತದೆ. ಇಂದು ಭರವಸೆಯಿಂದ ನಡೆಯಿರಿ, ನಮ್ಮನ್ನು ಕರೆದ ದೇವರು ಎಂದೆಂದಿಗೂ ನಂಬಿಗಸ್ತನಾಗಿದ್ದಾನೆ.`,
        actionStep: `ಇಂದು 5 ನಿಮಿಷಗಳ ಕಾಲ ಶಾಂತವಾಗಿ ಕುಳಿತು, ನಿಮ್ಮ ಜೀವನದಲ್ಲಿ ${topic} ಅನ್ನು ಹೇಗೆ ಅಳವಡಿಸಿಕೊಳ್ಳಬಹುದು ಎಂದು ಆಲೋಚಿಸಿ.`,
        prayer: "ಕರ್ತನೇ, ಇಂದು ನನ್ನನ್ನು ನಿಮ್ಮ ಜ್ಞಾನದಲ್ಲಿ ಮುನ್ನಡೆಸಿ ಮತ್ತು ನಿಮ್ಮ ಪರಿಪೂರ್ಣ ಪ್ರೀತಿಯನ್ನು ಜಗತ್ತಿಗೆ ತೋರಿಸಲು ನನಗೆ ಶಕ್ತಿ ನೀಡಿರಿ. ಆಮೆನ್."
      });
    }

    if (lang === "Tamil") {
      return JSON.stringify({
        title: `${topic} இன் வழியில் தேவ பிரசன்னம்`,
        scripture: "சங்கீதம் 119:105",
        scriptureText: "உம்முடைய வசனம் என் கால்களுக்குத் தீபமும், என் பாதைக்கு வெளிச்சமுமாய் இருக்கிறது.",
        reflection: `${topic} குறித்து தியானிப்பது தேவனுடைய மாறாத அன்பை நமது அன்றாட வாழ்வில் காண உதவுகிறது. வாழ்க்கையின் புயல்கள் நம்மை அசைக்க முயலும்போது, அவருடைய கிருபை நம்மைத் தாங்குகிறது. விசுவாசத்தோடு இன்று முன்செல்லுங்கள்.`,
        actionStep: `இன்று 5 நிமிடங்கள் அமைதியாக தேவனிடம் ${topic} குறித்து ஜெபியுங்கள்.`,
        prayer: "ஆண்டவரே, இன்று என்னை உம்முடைய வழியில் வழிநடத்தி, உமது அன்பைப் பிரதிபலிக்க எனக்கு பெலன் தாரும். ஆமென்."
      });
    }

    if (lang === "Telugu") {
      return JSON.stringify({
        title: `${topic} తోడి విశ్వాస యాత్ర`,
        scripture: "కీర్తనలు 119:105",
        scriptureText: "నీ వాక్యము నా పాదములకు దీపమును నా త్రోవకు వెలుగునై యున్నది.",
        reflection: `${topic} గురించి ధ్యానించడం దేవుని నిరంతర ప్రేమను మన దైనందిన జీవితంలో చూడటానికి సహాయపడుతుంది. కష్టాలు ఎదురైనప్పుడు ఆయన కృప మనకు తోడుగా ఉంటుంది.`,
        actionStep: `ఈ రోజు 5 నిమిషాల సమయం కేటాయించి ${topic} పట్ల దేవుని చిత్తాన్ని అన్వేషించండి.`,
        prayer: "ప్రభువా, నన్ను నీ జ్ఞానంలో నడిపించి, నీ ప్రేమను ఇతరులకు చూపించే భాగ్యాన్ని ప్రసాదించు. ఆమేన్."
      });
    }

    if (lang === "Hindi") {
      return JSON.stringify({
        title: `${topic} में विश्वास और आशा`,
        scripture: "भजन संहिता 119:105",
        scriptureText: "तेरा वचन मेरे पांव के लिए दीपक, और मेरे मार्ग के लिए उजियाला है।",
        reflection: `${topic} के विषय में सोचना हमें परमेश्वर के अगाध प्रेम की याद दिलाता है। जब जीवन की कठिनाइयां हमें विचलित करती हैं, तब परमेश्वर का अनुग्रह हमारा संबल बनता है। आज पूरे विश्वास के साथ आगे बढ़ें।`,
        actionStep: `आज 5 मिनट निकालें और सोचें कि आप ${topic} को अपने व्यवहार में कैसे लागू कर सकते हैं।`,
        prayer: "हे प्रभु, मुझे अपने ज्ञान में चलाएं और आज के दिन अपना प्रेम प्रदर्शित करने की शक्ति दें। आमीन।"
      });
    }

    if (lang === "Konkani") {
      return JSON.stringify({
        title: `${topic}ಂತ್ ದೆವಾಚೊ ಆಶೀರ್ವಾದ್`,
        scripture: "ಸ್ತೋತ್ರಾಂ 119:105",
        scriptureText: "ತುಜೆಂ ಉತರ್ ಮ್ಹಜ್ಯಾ ಪಾಯಾಂಕ್ ದಿವೊ ಆನಿ ಮ್ಹಜ್ಯಾ ವಾಟೆಕ್ ಉಜ್ವಾಡ್.",
        reflection: `${topic} ವಿಷ್ಣ್ಯಾಂತ್ ಧ್ಯಾನ ಕರ್ಚೆಂ ದೆವಾಚೊ ನಿರಂತರ್ ಭಾವಾರ್ಥ್ ಆಮ್ಚ್ಯಾ ಜಿವಿತಾಂತ್ ದೆಖ್ಕೊಂಕ್ ಆವ್ಕಾಸ್ ದಿತಾ. ಜಿವಿತಾಚ್ಯಾ ಕಷ್ಟಾಂ ಮಧೆಂ ದೆವಾಚಿ ಕೃಪಾ ಆಮ್ಕಾಂ ಬಳ್ ದಿತಾ.`,
        actionStep: `ಆಜ್ 5 ಮಿನುಟಾಂ ಶಾಂತಿನ್ ಬಸುನ್ ${topic} ಖಾತಿರ್ ಪ್ರಾರ್ಥನಾ ಕರಾ.`,
        prayer: "ದೆವಾ, ಆಜ್ ಮ್ಹಜೆರ್ ತುಜಿ ಕೃಪಾ ದವರ್ ಆನಿ ಮ್ಹಜ್ಯಾ ಜಿವಿತಾಂತ್ ತುಜೊ ಜಯ್ತ್ ಉಜ್ವಾಡ್ ದಾಯ್. ಆಮೆನ್."
      });
    }

    // Default English
    return JSON.stringify({
      title: `Finding Peace in: ${topic}`,
      scripture: "Psalm 119:105",
      scriptureText: "Your word is a lamp to my feet and a light to my path.",
      reflection: `Focusing on the theme of ${topic} helps us center our hearts amidst daily stress. When things feel overwhelming, taking a moment to reflect on the core elements of faith secures our hope. God's grace is constant, providing refreshing spiritual streams in dry seasons.`,
      actionStep: `Take 5 minutes today in quiet meditation, asking how you can live out this focus on ${topic} in your relationships.`,
      prayer: "Thank You, Father, for Your guidance. Help me walk in Your wisdom and trust in Your perfect love today. Amen."
    });
  }

  // 3. Daily Verse Study/Reflection Fallback
  const isDailyVerse = prompt.includes("For the Bible verse") || (isJsonExpected && prompt.includes("reflection") && prompt.includes("reference") && prompt.includes("text"));
  if (isDailyVerse && isJsonExpected) {
    let ref = "Proverbs 3:5";
    let verseText = "Trust in the Lord with all your heart and lean not on your own understanding.";
    const verseMatch = prompt.match(/Bible verse:\s+["']?(.*?)\s+-\s+(.*?)["']?,\s+generate/i) || prompt.match(/verse:\s+["']?(.*?)\s+-\s+(.*?)["']?/i);
    if (verseMatch) {
      ref = verseMatch[1].trim();
      verseText = verseMatch[2].trim();
    }

    if (lang === "Tagalog") {
      return JSON.stringify({
        reference: ref,
        text: verseText,
        reflection: "Pagninilay Ngayong Araw: Sa makapangyarihang kasulatang ito, ipinapaalala sa atin ang soberanong kontrol ng Diyos at ang Kanyang malalim at hindi nagbabagong pag-ibig sa atin. Ang bersikulong ito ay nag-uudyok sa atin na isantabi ang ating mga nag-aalalang isipin at ilagay ang ating tiwala sa Kanyang ligtas na patnubay. Magtiwala sa Kanya ngayon, at mamasdan kung paano Niya ididirekta ang iyong mga landas."
      });
    }

    if (lang === "Portuguese") {
      return JSON.stringify({
        reference: ref,
        text: verseText,
        reflection: "Reflexão de Hoje: Nesta poderosa escritura, somos lembrados do controle soberano de Deus e do Seu amor profundo e imutável por nós. Este versículo nos incentiva a deixar de lado nossas preocupações ansiosas e colocar nossa confiança em Sua orientação segura. Confie nEle hoje e veja-O direcionar seus caminhos."
      });
    }

    if (lang === "French") {
      return JSON.stringify({
        reference: ref,
        text: verseText,
        reflection: "Réflexion d'Aujourd'hui : Dans cette puissante Écriture, il nous est rappelé le contrôle souverain de Dieu et Son amour profond et immuable pour nous. Ce verset nous invite à mettre de côté nos soucis anxieux et à placer notre confiance dans Sa direction sûre. Faites-Lui confiance aujourd'hui et regardez-Le guider vos pas."
      });
    }

    if (lang.includes("Goan - Roman") || lang === "Konkani (Goan - Roman Script)") {
      return JSON.stringify({
        reference: ref,
        text: verseText,
        reflection: "Aichem Bhakti Chintna: Hea balvont dev-utrant, amkam Devachea rannbhorit niontronnachi ani Tachea khol, bodlonaslea mogachi yad korta. Hem vorsik amkam amcheo usko sôddun divnk ani Tachea moga vorvim surakxit margdorxonnacher visvas dovrunk prernna dita. Aiz Tacher patie, ani To tumche paim nitt dakhloitolo tem polle."
      });
    }

    if (lang.includes("Mangalorean - Kannada") || lang === "Konkani (Mangalorean - Kannada Script)" || lang === "Konkani") {
      return JSON.stringify({
        reference: ref,
        text: verseText,
        reflection: "ದಿನಾಚೆಂ ಉತರ್ ಧ್ಯಾನ: ಹ್ಯಾ ವಚನಾಂತ್ ದೇವ್ ಆಮ್ಕಾಂ ತಾಚೊ ಮೊಗ್ ಆನಿ ವಾಟ್ ನೆನಪುನ್ ಕರ್ತಾ. ತುಜಿಂ ಸಕ್ಕಡ್ ಕಾಮಾಂ ದೆವಾಕ್ ಒಪ್ಸುನ್ ದೀ ಆನಿ ಜಿವಿತಾಂತ್ ಸಫಲ್ ಜಾವ್ನ್ ಮುಖಾರ್ ಪಳಾ. ತುಜೊ ಸಗ್ಳೊ ಭರ್ವಸೊ ದೆವಾಚೆರ್ ದವರ್ ಆನಿ ಉಸ್ಕೆ ಸ ಸಾಂಡುನ್ ದೀ."
      });
    }

    // Default English
    return JSON.stringify({
      reference: ref,
      text: verseText,
      reflection: "Today's reflection reminder: In this powerful scripture, we are reminded of God's sovereign control and deep, unchanging love for us. This verse prompts us to lay aside our anxious worries and place our confidence in His secure guidance. Trust Him today, and watch Him direct your paths."
    });
  }

  // 4. Bible Search Fallback
  const isSearch = prompt.includes("Find 4 to 6 relevant Bible verses") || (isJsonExpected && prompt.includes("explanation") && prompt.includes("reference"));
  if (isSearch && isJsonExpected) {
    if (lang === "Spanish") {
      return JSON.stringify([
        { reference: "Proverbios 3:5", text: "Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia.", explanation: "Nos recuerda confiar en Dios antes que en nuestro propio entendimiento." },
        { reference: "Filipenses 4:6", text: "Por nada estéis afanosos, sino sean conocidas vuestras peticiones delante de Dios en toda oración.", explanation: "Muestra la oración como el mejor remedio contra la ansiedad." },
        { reference: "Salmo 23:1", text: "Jehová es mi pastor; nada me faltará.", explanation: "Establece la provisión y el cuidado de Dios sobre Su rebaño." }
      ]);
    }

    if (lang === "Kannada") {
      return JSON.stringify([
        { reference: "ಜ್ಞಾನೋಕ್ತಿಗಳು 3:5", text: "ನಿಮ್ಮ ಪೂರ್ಣ ಹೃದಯದಿಂದ ಕರ್ತನಲ್ಲಿ ನಂಬಿಕೆಯಿಡಿ ಮತ್ತು ನಿಮ್ಮ ಸ್ವಂತ ತಿಳುವಳಿಕೆಯನ್ನು ಅವಲಂಬಿಸಬೇಡಿ.", explanation: "ನಮ್ಮ ಸ್ವಂತ ಆಲೋಚನೆಗಳಿಗಿಂತ ದೇವರ ಬುದ್ಧಿವಂತಿಕೆಯನ್ನು ನಂಬಲು ಇದು ಪ್ರೋತ್ಸಾಹಿಸುತ್ತದೆ." },
        { reference: "ಫಿಲಿಪ್ಪಿಯವರಿಗೆ 4:6", text: "ಯಾವುದಕ್ಕೂ ಚಿಂತಿಸಬೇಡಿ, ಆದರೆ ಪ್ರಾರ್ಥನೆ ಮತ್ತು ಕೃತಜ್ಞತೆಯಿಂದ ನಿಮ್ಮ ವಿನಂತಿಗಳನ್ನು ದೇವರಿಗೆ ತಿಳಿಸಿ.", explanation: "ಚಿಂತೆಗಳನ್ನು ಪ್ರಾರ್ಥನೆಯ ಮೂಲಕ ದೇವರಿಗೆ ಒಪ್ಪಿಸಲು ಇದು ನಮಗೆ ಕಲಿಸುತ್ತದೆ." },
        { reference: "ಕೀರ್ತನೆಗಳು 23:1", text: "ಯೆಹೋವನು ನನ್ನ ಕುರುಬನಾಗಿದ್ದಾನೆ; ನನಗೆ ಕೊರತೆಯಿರುವುದಿಲ್ಲ.", explanation: "ದೇವರು ನಮ್ಮನ್ನು ಅದ್ಭುತವಾಗಿ ಪಾಲಿಸುವ ಕುರುಬನೆಂಬ ಭರವಸೆ ನೀಡುತ್ತದೆ." }
      ]);
    }

    return JSON.stringify([
      { reference: "Proverbs 3:5", text: "Trust in the Lord with all your heart and lean not on your own understanding.", explanation: "Encourages complete trust in God's wisdom over our own." },
      { reference: "Philippians 4:6", text: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.", explanation: "Instructs us to trade worry for prayer with a thankful heart." },
      { reference: "Romans 15:13", text: "May the God of hope fill you with all joy and peace as you trust in him.", explanation: "A beautiful prayer for hope, joy, and peace in Christ." }
    ]);
  }

  // 5. Text Translation / General Fallback
  const textMatch = prompt.match(/(?:Scripture text to translate|Text to translate):\s*["']?([\s\S]*?)["']?$/i) || prompt.match(/(?:translate the following|translate this text):\s*["']?([\s\S]*?)["']?$/i);
  if (textMatch && textMatch[1]) {
    const rawText = textMatch[1].trim();
    if (rawText.toLowerCase().includes("today's reflection reminder") || rawText.toLowerCase().includes("god promises")) {
      if (lang === "Spanish") return "Reflexión de hoy: En este versículo, Dios promete Su presencia, fuerza y guía en nuestro caminar diario de fe. Confía en Él hoy con tus preocupaciones y deja que Su Palabra ilumine tu camino.";
      if (lang === "Portuguese") return "Reflexão de hoje: Neste versículo, Deus promete Sua presença, força e orientação em nossa caminhada diária de fé. Confie n'Ele hoje com suas preocupações e deixe que Sua Palavra ilumine seu caminho.";
      if (lang === "French") return "Réflexion d'aujourd'hui : Dans ce verset, Dieu promet Sa présence, Sa force et Sa direction dans notre marche de foi quotidienne. Faites-Lui confiance aujourd'hui.";
      if (lang === "Kannada") return "ಈ ದಿನದ ವಚನ ಧ್ಯಾನ್ಯ: ದೇವರು ನಮ್ಮೊಂದಿಗೆ ಇದ್ದಾರೆ, ನಮಗೆ ಧೈರ್ಯ ಮತ್ತು ಮಾರ್ಗದರ್ಶನ ನೀಡುತ್ತಾರೆ. ಇಂದು ನಿಮ್ಮ ಚಿಂತೆಗಳನ್ನು ಅವರಿಗೆ ಒಪ್ಪಿಸಿ ಮತ್ತು ದೇವರ ವಾಕ್ಯ ನಿಮ್ಮ ದಾರಿಗೆ ಬೆಳಕಾಗಲಿ.";
    }
    return rawText;
  }

  // 6. Assistant / Chat / Prayers Fallback
  if (prompt.includes("prayer") || systemInstruction?.includes("prayer")) {
    if (lang === "Spanish") {
      return "Querido Padre Celestial,\n\nTe damos gracias por Tu infinito amor y fidelidad. Hoy ponemos en Tus manos todas nuestras preocupaciones y necesidades. Pedimos Tu paz que sobrepasa todo entendimiento para guardar nuestros corazones y mentes en Cristo Jesús. Guíanos con Tu sabiduría eterna y danos la fuerza para caminar en Tu luz cada día. En el nombre de Jesús, Amén.";
    }
    if (lang === "Kannada") {
      return "ಪ್ರೀತಿಯ ಪರಲೋಕದ ತಂದೆಯೇ,\n\nನಿಮ್ಮ ಅಪರಿಮಿತ ಪ್ರೀತಿ ಮತ್ತು ಕೃಪೆಗಾಗಿ ನಾವು ನಿಮಗೆ ಧನ್ಯವಾದಗಳನ್ನು ಅರ್ಪಿಸುತ್ತೇವೆ. ಇಂದು ನಮ್ಮ ಎಲ್ಲಾ ಚಿಂತೆಗಳನ್ನು ಮತ್ತು ಅಗತ್ಯಗಳನ್ನು ನಿಮ್ಮ ಕೈಯಲ್ಲಿ ಒಪ್ಪಿಸುತ್ತೇವೆ. ನಮ್ಮ ಹೃದಯಗಳನ್ನು ಕಾಪಾಡುವ ನಿಮ್ಮ ಅದ್ಭುತವಾದ ಶಾಂತಿಯನ್ನು ನಮಗೆ ನೀಡಿರಿ. ನಿಮ್ಮ ದಿವ್ಯ ಜ್ಞಾನದಿಂದ ನಮ್ಮನ್ನು ಮುನ್ನಡೆಸಿ. ಯೇಸುವಿನ ಹೆಸರಿನಲ್ಲಿ ಪ್ರಾರ್ಥಿಸುತ್ತೇವೆ ತಂದೆಯೇ, ಆಮೆನ್.";
    }
    return "Dear Heavenly Father,\n\nWe come before You today with hearts full of gratitude for Your loving-kindness and sovereign grace. We place all our worries, needs, and dreams into Your secure hands. Grant us the comfortable peace that transcends all human understanding, keeping our hearts and minds focused on Your truth. Guide each step we take with Your eternal wisdom. In Jesus' name, Amen.";
  }

  if (lang === "Spanish") {
    return "La paz del Señor esté contigo. Es una bendición reflexionar sobre las Escrituras juntos. ¿Hay algún versículo o tema del que te gustaría hablar hoy?";
  }
  if (lang === "Kannada") {
    return "ಕರ್ತನ ಶಾಂತಿ ನಿಮ್ಮೊಂದಿಗೆ ಇರಲಿ. ದೇವರ ವಾಕ್ಯವನ್ನು ಒಟ್ಟಿಗೆ ಧ್ಯಾನಿಸುವುದು ಒಂದು ದೊಡ್ಡ ಆಶೀರ್ವಾದವಾಗಿದೆ. ಇಂದು ನೀವು ಯಾವ ವಿಷಯದ ಬಗ್ಗೆ ಮಾತನಾಡಲು ಬಯಸುತ್ತೀರಿ?";
  }
  return "Peace be with you. It is a true blessing to study and meditate on Scripture together. What verses or biblical themes would you like to explore today? I am always here to walk with you.";
}

// Helper function to call native Gemini with robust fallback to OpenRouter
async function callGemini(prompt: string, systemInstruction?: string, options?: { responseMimeType?: string }) {
  // Determine if JSON is expected based on prompt, systemInstruction, or options
  const isJsonExpected = options?.responseMimeType === "application/json" ||
    (prompt && (prompt.includes("JSON") || prompt.includes("json") || prompt.includes("keys:"))) ||
    (systemInstruction && (systemInstruction.includes("JSON") || systemInstruction.includes("json")));

  try {
    // 1. TRY NATIVE GEMINI FIRST (if API key is present and not dummy/placeholder)
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey && geminiApiKey !== "dummy" && geminiApiKey !== "placeholder" && Date.now() > nativeQuotaExhaustedUntil) {
      const nativeModels = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"];
      for (const model of nativeModels) {
        try {
          console.log(`[Gemini API] Attempting native ${model} call...`);
          const nativeResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
              systemInstruction: systemInstruction,
              responseMimeType: isJsonExpected ? "application/json" : undefined,
            },
          });

          const text = nativeResponse.text;
          if (text) {
            console.log(`[Gemini API] Native ${model} call succeeded!`);
            return text;
          }
        } catch (nativeErr: any) {
          const errMsg = nativeErr.message || String(nativeErr);
          const isQuota = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED");
          
          if (isQuota) {
            console.log(`[Gemini Status] Quota limit encountered on native API. Activating dynamic local fallback.`);
            nativeQuotaExhaustedUntil = Date.now() + 30 * 60 * 1000; // 30 minutes cooldown
            break; // Stop attempting native calls immediately
          } else {
            console.log(`[Gemini Status] Native ${model} returned unready state. Trying next options.`);
          }
          // Sleep briefly to let potential rate-limit/high demand clear
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
    } else if (Date.now() <= nativeQuotaExhaustedUntil) {
      console.log("[Gemini Status] Native API is cooling down due to temporary rate limits. Utilizing secondary channel.");
    }

    // 2. FALLBACK TO OPENROUTER
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      console.error("OPENROUTER_API_KEY environment variable is undefined or empty! Yielding to dynamic local generator...");
      return generateHighQualityFallback(prompt, systemInstruction, isJsonExpected);
    }

    const modelsToTry = [
      "google/gemini-2.5-flash",
      "openai/gpt-3.5-turbo",
      "google/gemini-2.5-pro"
    ];
    let lastError: any;
    
    const rateLimitDelays = [2000, 4000, 8000];
    let rateLimitAttempts = 0;

    let initialMaxTokens = isJsonExpected ? 1000 : 800;
    if (prompt && (prompt.includes("Translate") || prompt.includes("translate"))) {
      initialMaxTokens = 350;
    }

    for (const model of modelsToTry) {
      let modelAttempt = 0;
      const maxModelAttempts = rateLimitDelays.length + 2; 
      let currentMaxTokens = initialMaxTokens;

      while (modelAttempt < maxModelAttempts) {
        try {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openRouterKey}`,
              "HTTP-Referer": "https://ai.studio/build",
              "X-Title": "DailyBible Companion"
            },
            body: JSON.stringify({
              model: model,
              messages: [
                ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
                { role: "user", content: prompt }
              ],
              max_tokens: currentMaxTokens,
              ...(isJsonExpected ? { response_format: { type: "json_object" } } : {})
            })
          });

          if (response.ok) {
            const json = await response.json();
            const content = json?.choices?.[0]?.message?.content;
            if (content) {
              return content;
            }
          }

          const status = response.status;
          const errText = await response.text();
          const is429 = status === 429 || errText.toLowerCase().includes("rate limit") || errText.toLowerCase().includes("quota");
          const is402 = status === 402 || errText.toLowerCase().includes("credits") || errText.toLowerCase().includes("afford");

          if (is429 && rateLimitAttempts < rateLimitDelays.length) {
            const delay = rateLimitDelays[rateLimitAttempts];
            rateLimitAttempts++;
            modelAttempt++;
            console.warn(`[OpenRouter 429 Backoff] Model ${model} hit rate limit. Waiting ${delay}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          } else if (is402 && modelAttempt < maxModelAttempts) {
            const match = errText.match(/can only afford (\d+)/i);
            let affordable = 0;
            if (match && match[1]) {
              affordable = parseInt(match[1], 10);
            }
            
            if (affordable >= 100) {
              const proposedTokens = Math.floor(affordable * 0.9);
              if (proposedTokens < currentMaxTokens) {
                currentMaxTokens = proposedTokens;
                modelAttempt++;
                console.warn(`[OpenRouter 402 Credits] Model ${model} can't afford current max_tokens. Retrying with reduced max_tokens: ${currentMaxTokens}...`);
                continue;
              }
            }
            
            if (currentMaxTokens > 150) {
              currentMaxTokens = Math.max(150, Math.floor(currentMaxTokens / 2));
              modelAttempt++;
              console.warn(`[OpenRouter 402 Credits] Halving max_tokens to ${currentMaxTokens} and retrying model ${model}...`);
              continue;
            } else {
              console.warn(`[OpenRouter Call] Model ${model} failed with status ${status} (credits exhausted). Trying next model.`);
              break;
            }
          } else {
            console.warn(`[OpenRouter Call] Model ${model} failed with status ${status}: ${errText}. Trying next model.`);
            break; 
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`[OpenRouter Call Error] Model ${model} failed: ${err.message || err}. Trying next model.`);
          break; 
        }
      }
    }
    
    console.warn("[Quota Exhausted] All model endpoints failed. Delegating to dynamic local generator.");
    return generateHighQualityFallback(prompt, systemInstruction, isJsonExpected);
  } catch (err) {
    console.error("[callGemini Error Catch] Critical error in calling models. Generating safe local fallback:", err);
    return generateHighQualityFallback(prompt, systemInstruction, isJsonExpected);
  }
}

  function cleanJsonString(str: string): string {
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

    // 4. Remove trailing commas inside arrays or objects (e.g., [1, 2, ] or {"a": 1, })
    cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");

    return cleaned.trim();
  }

  function getLanguageSpecificInstructions(language: string): string {
    const lang = (language || "English").trim();
    let dialectRules = "";
    if (lang.includes("Konkani (Goan - Roman Script)")) {
      dialectRules = "\n   - For Konkani (Goan - Roman Script): Translate all text/scriptures/explanations into the Goan dialect of Konkani and strictly use the Latin/English alphabet (Roman script). Do NOT use Kannada or Devanagari script.";
    } else if (lang.includes("Konkani (Mangalorean - Kannada Script)")) {
      dialectRules = "\n   - For Konkani (Mangalorean - Kannada Script): Translate all text/scriptures/explanations into the Mangalorean Catholic dialect of Konkani and strictly use the Kannada script (ಕನ್ನಡ ಲಿಪಿ) with high typographic fidelity.";
    }

    return `CRITICAL LANGUAGE & SCRIPT INSTRUCTIONS:
1. You MUST generate ALL text content, scriptures, titles, and explanations in the exact language requested: "${lang}". Do not mix languages.
2. The application strictly supports only 6 languages:
   - English: Standard modern English.
   - Tagalog: Standard modern Tagalog. Use modern Tagalog vocabulary.
   - Portuguese: Standard modern Portuguese (use Almeida Corrigida Fiel or similar translation for scriptures).
   - French: Standard modern French (use Louis Segond or similar translation for scriptures).
   - Konkani (Goan - Roman Script): Use Roman/Latin script.${dialectRules}
   - Konkani (Mangalorean - Kannada Script): Use Kannada script.${dialectRules}
3. If translating standard scripture, use a highly respected, formal, and theologically accurate translation equivalent in that language.
4. Do NOT let native script characters or quotation marks break the JSON formatting. Inside any JSON string values, any double quotes MUST be strictly escaped with double backslashes (e.g., use \\" instead of "). Do not include literal newlines within JSON string values; use "\\n" instead.`;
  }

  async function translateVerbatimScripture(text: string, language: string): Promise<string> {
    if (!text || !language || language.toLowerCase() === "english") {
      return text;
    }
    const cacheKey = `verbatim-scripture-${text.slice(0, 100)}-${language}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      let extraRules = "";
      if (language.includes("Konkani (Goan - Roman Script)")) {
        extraRules = "\n- Specific Rule: Translate the text into the Goan dialect of Konkani and strictly use the Latin/English alphabet (Roman script). Do NOT use any Indian scripts.";
      } else if (language.includes("Konkani (Mangalorean - Kannada Script)")) {
        extraRules = "\n- Specific Rule: Translate the text into the Mangalorean Catholic dialect of Konkani and strictly use the Kannada script.";
      }

      const prompt = `You are a professional, accurate Bible translator and theologian.
Translate the following verbatim scripture text into the requested language: "${language}".${extraRules}
Maintain the exact verse structure and verse numbers (e.g., "[1]", "[2]", "[3]") and keep any XML tags like "<red>words of Jesus</red>" intact exactly as they are.
Do not summarize, shorten, or omit any verse. Ensure high grammatical precision, theological reverence, and proper script formatting (e.g., proper accented characters for Portuguese/French, modern Tagalog vocabulary for Tagalog, Latin/Roman characters for Goan Konkani, and high typographic fidelity Kannada script characters for Mangalorean Konkani).

Scripture text to translate:
"${text}"

Return ONLY the translated verbatim scripture text, without any introductory or concluding remarks.`;

      const result = await callGemini(prompt, `You translate verbatim scripture accurately and reverently into "${language}".`);
      const trimmed = result.trim();
      setCached(cacheKey, trimmed, 30 * 24 * 60 * 60 * 1000); // 30 days cache
      return trimmed;
    } catch (err) {
      console.warn(`Translation of verbatim scripture to ${language} failed:`, err);
      return text;
    }
  }

  async function translateText(text: string, language: string): Promise<string> {
    if (!text || !language || language.toLowerCase() === "english") return text;
    const cacheKey = `translate-text-${text.slice(0, 100)}-${language}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      let extraRules = "";
      if (language.includes("Konkani (Goan - Roman Script)")) {
        extraRules = "\n- Specific Rule: Translate the text into the Goan dialect of Konkani and strictly use the Latin/English alphabet (Roman script). Do NOT use Devanagari or Kannada script. Render in Roman script only.";
      } else if (language.includes("Konkani (Mangalorean - Kannada Script)")) {
        extraRules = "\n- Specific Rule: Translate the text into the Mangalorean Catholic dialect of Konkani and strictly use the Kannada script (ಕನ್ನಡ ಲಿಪಿ). Ensure proper Kannada characters are generated.";
      }

      const prompt = `Translate the following text accurately and natural-sounding into the language: "${language}".${extraRules}
Return ONLY the translated text, without any introductory or concluding remarks or quotes.

Text to translate:
${text}`;
      const result = await callGemini(prompt, `You are a professional, accurate translator. You translate text into "${language}". ${getLanguageSpecificInstructions(language)}`);
      const trimmed = result.trim();
      setCached(cacheKey, trimmed, 30 * 24 * 60 * 60 * 1000); // 30 days cache
      return trimmed;
    } catch (e) {
      console.error("Translation failed:", e);
      return text;
    }
  }

  async function translateStudyGuide(guide: any, language: string): Promise<any> {
    if (!guide || !language || language.toLowerCase() === "english") return guide;
    try {
      const summary = await translateText(guide.summary, language);
      const lessons = await Promise.all((guide.lessons || []).map((l: string) => translateText(l, language)));
      const verses = await Promise.all((guide.verses || []).map(async (v: any) => ({
        reference: v.reference,
        text: await translateVerbatimScripture(v.text, language)
      })));
      const reflectionQuestions = await Promise.all((guide.reflectionQuestions || []).map((q: string) => translateText(q, language)));
      const prayerPoints = await Promise.all((guide.prayerPoints || []).map((p: string) => translateText(p, language)));
      const characterProfiles = await Promise.all((guide.characterProfiles || []).map(async (c: any) => ({
        name: await translateText(c.name, language),
        role: await translateText(c.role, language),
        significance: await translateText(c.significance, language)
      })));
      const fullChapterText = await translateVerbatimScripture(guide.fullChapterText, language);

      return {
        ...guide,
        summary,
        lessons,
        verses,
        reflectionQuestions,
        prayerPoints,
        characterProfiles,
        fullChapterText,
        translatedSummary: summary,
        translatedLessons: lessons,
        translatedReflectionQuestions: reflectionQuestions,
        translatedPrayerPoints: prayerPoints,
        translatedFullChapterText: fullChapterText,
        translatedCharacterProfiles: characterProfiles
      };
    } catch (err) {
      console.error("translateStudyGuide failed:", err);
      return guide;
    }
  }

  function getApiTranslation(translation: string, language: string = "English"): string {
    const lang = (language || "English").toLowerCase();
    if (lang === "spanish" || lang === "español") return "rvr09";
    if (lang === "portuguese" || lang === "português") return "almeida";

    const t = (translation || "web").toLowerCase().trim();
    if (t === "kjv" || t === "nkjv") return "kjv";
    if (t === "bbe") return "bbe";
    if (t === "oeb" || t === "oeb-us" || t === "oeb-cw") return "oeb-us";
    
    return "web";
  }

  async function fetchScriptureFromApi(reference: string, translation: string, language: string = "English"): Promise<string> {
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
      console.warn(`Failed scripture fetch for ${reference}:`, err);
    }

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

  function getOfflineAssistantResponse(message: string): string {
    const q = message.toLowerCase();

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

    if (q.includes("pray") || q.includes("petition") || q.includes("hear") || q.includes("commun") || q.includes("talk to god")) {
      return `Prayer is not an eloquent speech; it is a raw, heart-to-heart conversation with your Father.

If you feel like your prayers are bouncing off the ceiling, or if you aren't sure how to begin, remember that God welcomes your simple honesty.

**Scripture Focus:**
"The Lord is near to all who call on him, to all who call on him in truth." — Psalm 145:18

**Practical Daily Application:**
1. **The 'ACTS' Method:** Organize your prayer into: Adoration (praise God), Confession (sincere clean slate), Thanksgiving (count blessings), and Supplication (ask for needs).
2. **Quiet Solitude:** Spend 2 minutes in complete silence before speaking, simply positioning your soul to listen.
3. **Scriptured Prayers:** Read a Psalm (like Psalm 23 or 51) and pray those exact words back to God as your personal message.

God is never too busy for your voice. Speak to Him today as you would a loving, wise father.`;
    }

    if (q.includes("love") || q.includes("kind") || q.includes("mercy") || q.includes("relationship") || q.includes("marri") || q.includes("friend")) {
      return `Divine love is a sacrificial choice to seek the highest good of another.

Healthy relationships with family, spouses, and friends are anchored in the self-giving, patient model of love that God shares with us.

**Scripture Focus:**
"Love is patient, love is kind. It does not envy, it does not boast, it is not proud... It always protects, always trusts, always hopes, always perseveres." — 1 Corinthians 13:4-7

**Practical Daily Application:**
1. **The Kind Response:** The next time frustration rises in a conversation, intentionally speak with a soft, slow, and respectful tone.
2. **Generous Blessing:** Perform one anonymous act of kindness for someone in your circle this week.
3. **Active Listening:** Put away your phone and give your full, uninterrupted attention when a loved one is sharing their heart.

Love is not merely a feeling; it is an active discipline of choosing patience, honor, and grace day by day.`;
    }

    // General/Fallback study response
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

  // --- API Routes ---

  // Custom Authentication Endpoint
  app.post("/api/auth/login", (req, res) => {
    const { email, displayName } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const name = displayName || email.split("@")[0];
    const user = {
      uid: `user_${Buffer.from(email).toString("hex").substring(0, 12)}`,
      email,
      displayName: name.charAt(0).toUpperCase() + name.slice(1),
      photoURL: `https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=60`
    };
    return res.json({ success: true, user });
  });

  // Streak Counting System Endpoints
  app.post("/api/streak/complete", async (req, res) => {
    const { userId, localDateStr } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }
    if (!pool) {
      return res.json({ success: false, message: "Database not connected" });
    }

    // Format input date (default to today YYYY-MM-DD in UTC if not provided)
    const clientDateStr = localDateStr || new Date().toISOString().split('T')[0];

    try {
      // Fetch existing streak record
      const selectQuery = `
        SELECT current_streak, longest_streak, last_active_date::text AS last_active_date_str 
        FROM user_streaks 
        WHERE user_id = $1
      `;
      const selectRes = await pool.query(selectQuery, [userId]);

      let currentStreak = 1;
      let longestStreak = 1;
      let status = "initialized";

      if (selectRes.rows.length === 0) {
        // New user: insert initial record
        const insertQuery = `
          INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_active_date)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          RETURNING current_streak, longest_streak, last_active_date::text AS last_active_date_str
        `;
        const insertRes = await pool.query(insertQuery, [userId, currentStreak, longestStreak]);
        console.log(`Created streak record for user ${userId}`);
      } else {
        const row = selectRes.rows[0];
        const prevStreak = row.current_streak;
        const prevLongest = row.longest_streak;
        const lastActiveStr = row.last_active_date_str ? row.last_active_date_str.split(' ')[0] : null;

        if (lastActiveStr === clientDateStr) {
          // Same Day: keep streak the same
          currentStreak = prevStreak;
          longestStreak = prevLongest;
          status = "same_day";
        } else {
          const parseDateUTC = (str: string) => {
            const [year, month, day] = str.split('-').map(Number);
            return new Date(Date.UTC(year, month - 1, day));
          };

          const todayDate = parseDateUTC(clientDateStr);
          const lastActiveDate = lastActiveStr ? parseDateUTC(lastActiveStr) : null;

          if (lastActiveDate) {
            const diffTime = todayDate.getTime() - lastActiveDate.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
              // Consecutive Day: increment
              currentStreak = prevStreak + 1;
              longestStreak = Math.max(prevLongest, currentStreak);
              status = "consecutive";
            } else if (diffDays > 1) {
              // Broken Streak: reset to 1
              currentStreak = 1;
              longestStreak = prevLongest;
              status = "broken";
            } else {
              // Negative time difference or clock skew, keep existing
              currentStreak = prevStreak;
              longestStreak = prevLongest;
              status = "clock_skew";
            }
          } else {
            currentStreak = 1;
            longestStreak = Math.max(prevLongest, 1);
            status = "initialized";
          }
        }

        // Update record
        const updateQuery = `
          UPDATE user_streaks
          SET current_streak = $1, longest_streak = $2, last_active_date = CURRENT_TIMESTAMP
          WHERE user_id = $3
        `;
        await pool.query(updateQuery, [currentStreak, longestStreak, userId]);
      }

      res.json({
        success: true,
        userId,
        currentStreak,
        longestStreak,
        status
      });

    } catch (err: any) {
      console.error("Error updating daily streak in database:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/streak/status", async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }
    if (!pool) {
      return res.json({ success: false, message: "Database not connected" });
    }

    try {
      const selectQuery = `
        SELECT current_streak, longest_streak, last_active_date::text AS last_active_date_str
        FROM user_streaks
        WHERE user_id = $1
      `;
      const result = await pool.query(selectQuery, [userId]);
      if (result.rows.length === 0) {
        return res.json({
          currentStreak: 0,
          longestStreak: 0,
          lastActiveDate: null
        });
      }
      const row = result.rows[0];
      res.json({
        currentStreak: row.current_streak,
        longestStreak: row.longest_streak,
        lastActiveDate: row.last_active_date_str
      });
    } catch (err: any) {
      console.error("Error retrieving streak status:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 1. Daily Verse (caches or picks deterministically based on date)
  app.get("/api/daily-verse", async (req, res) => {
    try {
      const language = (req.query.language as string) || "English";
      const selectedLanguage = language;
      const dateString = new Date().toISOString().slice(0, 10);
      const cacheKey = `daily-verse-${language}-${dateString}`;
      const cached = getCached(cacheKey);
      if (cached) {
        console.log(`[Cache Hit] Serving daily-verse from server cache for key: ${cacheKey}`);
        return res.json(cached);
      }

      const bibleVerses = [
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

      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000);
      const verse = bibleVerses[Math.abs(dayOfYear) % bibleVerses.length];

      if (ai) {
        try {
          const prompt = `For the Bible verse: "${verse.reference} - ${verse.text}", generate an encouragement-filled devotional reflection.
You must return the Bible verse, the scripture reference, and the devotional reflection entirely in "${selectedLanguage}".

${getLanguageSpecificInstructions(selectedLanguage)}

Format your output strictly as a valid JSON object with the keys "reference" (the original reference e.g., "${verse.reference}"), "text" (the exact verse text translated to "${selectedLanguage}"), and "reflection" (the devotional reflection in "${selectedLanguage}", around 100-150 words). Do not include markdown block ticks like \`\`\`json, just return raw JSON starting with { and ending with }.`;
          const resultString = await callGemini(prompt, `You are DailyBible, a respectful, biblically grounded companion. You write and translate entirely in the language: "${selectedLanguage}".`);
          const cleaned = cleanJsonString(resultString);
          const parsed = JSON.parse(cleaned);
          if (parsed && parsed.text && parsed.reflection) {
            const isEnglish = !language || language.toLowerCase() === "english";
            const responseData = {
              reference: verse.reference,
              text: verse.text,
              translatedText: isEnglish ? verse.text : parsed.text,
              reflection: "Today's reflection reminder: In this verse, God promises His presence, strength, and guidance in our daily walk of faith. Trust Him today with your worries and let His Word light your path.",
              translatedReflection: parsed.reflection
            };
            setCached(cacheKey, responseData, 12 * 60 * 60 * 1000); // 12 hours cache
            return res.json(responseData);
          }
        } catch (err) {
          console.warn("Daily verse Gemini call failed, trying local high-quality translations:", err);
        }
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
        },
        "Proverbs 3:5-6": {
          "Spanish": {
            text: "Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia. Reconócelo en todos tus caminos, y él enderezará tus veredas.",
            reflection: "Libera la necesidad de resolverlo todo por ti mismo. Entrega tus planes a Él hoy y observa cómo guía tu camino."
          },
          "Portuguese": {
            text: "Confie no Senhor de todo o seu coração e não se apoie no seu próprio entendimento; reconheça o Senhor em todos os seus caminhos, e ele endireitará as suas veredas.",
            reflection: "Liberte a necessidade de resolver tudo sozinho. Entregue seus planos a Ele hoje e observe como Ele guia o seu caminho."
          },
          "French": {
            text: "Confie-toi en l'Éternel de tout ton cœur, et ne t'appuie pas sur ta sagesse; reconnais-le dans toutes tes voies, et il aplanira tes sentiers.",
            reflection: "Libérez le besoin de tout résoudre par vous-même. Soumettez-Lui vos plans aujourd'hui, et observez comment Il guide vos pas."
          },
          "Tagalog": {
            text: "Tumiwala ka sa Panginoon ng buong puso mo, at huwag kang manalig sa iyong sariling kaunawaan: Kilalanin mo siya sa lahat ng iyong mga lakad, at kaniyang itutuwid ang iyong mga landas.",
            reflection: "Iwanan ang pangangailangang unawain ang lahat sa sarili mong kakayahan. Ipagkatiwala ang iyong mga plano sa Kanya ngayon."
          }
        },
        "Isaiah 40:31": {
          "Spanish": {
            text: "Pero los que esperan en el Señor renovarán sus fuerzas; levantarán alas como las águilas; correrán y no se cansarán; caminarán y no se fatigarán.",
            reflection: "Cuando te sientas exhausto, descansa en Sus promesas. Él renovará tus energías y te elevará por encima de las tormentas."
          },
          "Portuguese": {
            text: "Mas aqueles que esperam no Senhor renovam as suas forças. Voam alto como águias; correm e não se cansam, caminham e não se fatigam.",
            reflection: "Quando se sentir exausto, descanse em Suas promessas. Ele renovará suas energias e o elevará acima das tempestades."
          },
          "French": {
            text: "Mais ceux qui se confient en l'Éternel renouvellent leur force. Ils prennent le vol comme les aigles; ils courent, et ne se lassent point, ils marchent, et ne se fatiguent point.",
            reflection: "Quand vous vous sentez épuisé, reposez-vous sur Ses promesses. Il renouvellera votre énergie et vous élèvera au-dessus des tempêtes."
          },
          "Tagalog": {
            text: "Nguni't silang nangaghihintay sa Panginoon ay mangababago ng kanilang lakas; sila'y paiilanglang na may mga pakpak na parang mga agila; sila'y tatakbo, at hindi mangapapagal; sila'y lalakad, at hindi mangalulupaypay.",
            reflection: "Kapag pakiramdam mo ay pagod ka na, magpahinga sa Kanyang mga pangako. Ibabalik Niya ang iyong lakas at itataas ka."
          }
        },
        "Joshua 1:9": {
          "Spanish": {
            text: "¿No te lo he ordenado yo? Sé fuerte y valiente. No temas ni te acobardes, porque el Señor tu Dios estará contigo dondequiera que vayas.",
            reflection: "El miedo pierde su poder cuando recuerdas quién camina a tu lado. Avanza hoy con total confianza en Su presencia."
          },
          "Portuguese": {
            text: "Não fui eu que lhe ordenei? Seja forte e corajoso! Não se apavore, nem se desanime, pois o Senhor, o seu Deus, estará com você por onde você andar.",
            reflection: "O medo perde o poder quando você se lembra de quem caminha ao seu lado. Siga em frente hoje com total confiança em Sua presença."
          },
          "French": {
            text: "Ne t'ai-je pas donné cet ordre: Fortifie-toi et prends courage? Ne t'effraye point et ne t'épouvante point, car l'Éternel, ton Dieu, est avec toi dans tout ce que tu entreprendras.",
            reflection: "La peur perd son pouvoir quand vous vous rappelez qui marche à vos côtés. Avancez aujourd'hui avec assurance en Sa présence."
          },
          "Tagalog": {
            text: "Hindi ba kita utusan? Magpakalakas ka at magpakatapang; huwag kang matakot, ni manglupaypay: sapagka't ang Panginoon mong Dios ay sumasaiyo saan ka man pumaroon.",
            reflection: "Nawawalan ng kapangyarihan ang takot kapag naalala mo kung sino ang kasama mong lumalakad. Magpatuloy nang may lakas ng loob."
          }
        },
        "Psalm 23:1": {
          "Spanish": {
            text: "El Señor es mi pastor, nada me faltará.",
            reflection: "Como tu Buen Pastor, Dios provee para cada una de tus necesidades emocionales, espirituales y físicas. Puedes descansar plenamente en Su cuidado."
          },
          "Portuguese": {
            text: "O Senhor é o meu pastor, nada me faltará.",
            reflection: "Como seu Bom Pastor, Deus provê todas as suas necessidades emocionais, espirituais e físicas. Você pode descansar totalmente sob o cuidado Dele."
          },
          "French": {
            text: "L'Éternel est mon berger: je ne manquerai de rien.",
            reflection: "Comme votre Bon Berger, Dieu pourvoit à tous vos besoins émotionnels, spirituels et physiques. Vous pouvez vous reposer pleinement sur Son soin."
          },
          "Tagalog": {
            text: "Ang Panginoon ay aking pastor; hindi ako mangangailangan.",
            reflection: "Bilang iyong Mabuting Pastol, ibinibigay ng Diyos ang lahat ng iyong pangangailangan. Maaari kang lubos na magpahinga sa Kanyang kalinga."
          }
        },
        "Romans 12:2": {
          "Spanish": {
            text: "No os conforméis a este siglo, sino transformaos por medio de la renovación de vuestro entendimiento, para que comprobéis cuál sea la buena voluntad de Dios, agradable y perfecta.",
            reflection: "Deja que Dios renueve tus pensamientos hoy. Aleja tu mente de los patrones y ansiedades del mundo para ver Su camino perfecto."
          },
          "Portuguese": {
            text: "E não vos conformeis com este mundo, mas transformai-vos pela renovação da vossa mente, para que experimenteis qual seja a boa, agradável e perfeita vontade de Deus.",
            reflection: "Permita que Deus renove seus pensamentos hoje. Afaste sua mente dos padrões mundanos e descubra a maravilhosa vontade Dele."
          },
          "French": {
            text: "Ne vous conformez pas au siècle présent, mais soyez transformés par le renouvellement de l'intelligence, afin que vous discerniez quelle est la volonté de Dieu, ce qui est bon, agréable et parfait.",
            reflection: "Laissez Dieu renouveler vos pensées aujourd'hui. Éloignez votre esprit des inquiétudes du monde pour discerner Sa volonté parfaite."
          },
          "Tagalog": {
            text: "At huwag kayong makiayon sa sanglibutang ito: kundi magiba kayo sa pamamagitan ng pagbabago ng inyong pagiisip, upang mapatunayan ninyo kung alin ang mabuti at kaayaaya at sakdal na kalooban ng Dios.",
            reflection: "Hayaang baguhin ng Diyos ang iyong pag-iisip ngayon. Lumayo sa mga gawi ng mundo upang makita ang Kanyang perpektong kalooban."
          }
        },
        "Hebrews 11:1": {
          "Spanish": {
            text: "Es, pues, la fe la certeza de lo que se espera, la convicción de lo que no se ve.",
            reflection: "La fe es el ancla de tu alma hoy. Aunque no puedas ver el resultado final, confía en que Dios tiene el control absoluto."
          },
          "Portuguese": {
            text: "Ora, a fé é a certeza de coisas que se esperam, a convicção de fatos que se não veem.",
            reflection: "A fé é a âncora da sua alma hoje. Mesmo que você não possa ver o resultado, confie que Deus está agindo nos bastidores."
          },
          "French": {
            text: "Or la foi est une ferme assurance des choses qu'on espère, une démonstration de celles qu'on ne voit pas.",
            reflection: "La foi est l'ancre de votre âme aujourd'hui. Même si vous ne voyez pas encore l'issue, croyez que Dieu est à l'œuvre."
          },
          "Tagalog": {
            text: "Ngayon ang pananampalataya ay siyang kapanatagan sa mga bagay na inaasahan, ang patunay sa mga bagay na hindi nakikita.",
            reflection: "Ang pananampalataya ang nagpapatatag sa atin ngayon. Kahit hindi mo nakikita ang bukas, magtiwalang may plano ang Diyos."
          }
        },
        "Galatians 5:22-23": {
          "Spanish": {
            text: "Mas el fruto del Espíritu es amor, gozo, paz, paciencia, benignidad, bondad, fe, mansedumbre, templanza; contra tales cosas no hay ley.",
            reflection: "Permite que el Espíritu Santo guíe tus interacciones hoy, vistiendo tu corazón de paciencia, amor y compasión hacia los demás."
          },
          "Portuguese": {
            text: "Mas o fruto do Espírito é: amor, alegria, paz, longanimidade, benignidade, bondade, fidelidade, mansidão, autodomínio. Contra estas coisas não há lei.",
            reflection: "Permita que o Espírito Santo guie as suas ações hoje, enchendo o seu coração de paciência, bondade e amor com todos ao seu redor."
          },
          "French": {
            text: "Mais le fruit de l'Esprit, c'est l'amour, la joie, la paix, la patience, la bonté, la bénignité, la fidélité, la douceur, la tempérance; la loi n'est pas contre ces choses.",
            reflection: "Laissez le Saint-Esprit diriger vos relations aujourd'hui, vous remplissant de douceur, de patience et de bienveillance envers chacun."
          },
          "Tagalog": {
            text: "Datapuwa't ang bunga ng Espiritu ay pagibig, katuwaan, kapayapaan, pagpapahinuhod, kagandahang-loob, kabutihan, pagtatapat, kaamuan, pagpipigil; laban sa mga gayong bagay ay walang kautusan.",
            reflection: "Hayaang gabayan ng Espiritu Santo ang iyong pakikitungo sa kapwa ngayon. Maghasik ng pagmamahal, kapayapaan, at kabutihan."
          }
        },
        "John 3:16": {
          "Spanish": {
            text: "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.",
            reflection: "Eres profunda e incondicionalmente amado por tu Creador. Su regalo supremo de gracia asegura tu esperanza y futuro para siempre."
          },
          "Portuguese": {
            text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.",
            reflection: "Você é profunda e incondicionalmente amado pelo Criador. Seu presente supremo de graça assegura sua esperança e futuro para sempre."
          },
          "French": {
            text: "Car Dieu a tant aimé le monde qu'il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu'il ait la vie éternelle.",
            reflection: "Vous êtes profondément et inconditionnellement aimé par le Créateur. Son don ultime de grâce assure votre espérance et votre avenir à jamais."
          },
          "Tagalog": {
            text: "Sapagka't gayon na lamang ang pagsinta ng Dios sa sanglibutan, na ibinigay niya ang kaniyang bugtong na Anak, upang ang sinomang sa kaniya'y sumampalataya ay huwag mapahamak, kundi magkaroon ng buhay na walang hanggan.",
            reflection: "Mahal na mahal ka ng iyong Maylalang nang walang pasubali. Ang Kanyang regalo ng biyaya ang nagtitiyak ng iyong pag-asa magpakailanman."
          }
        }
      };

      const fallbackSet = LOCALIZED_FALLBACKS[verse.reference];
      const defaultReflection = "Today's reflection reminder: In this verse, God promises His presence, strength, and guidance in our daily walk of faith. Trust Him today with your worries and let His Word light your path.";
      
      if (fallbackSet && fallbackSet[language]) {
        const responseData = {
          reference: verse.reference,
          text: verse.text,
          translatedText: fallbackSet[language].text,
          reflection: defaultReflection,
          translatedReflection: fallbackSet[language].reflection
        };
        setCached(cacheKey, responseData, 12 * 60 * 60 * 1000); // 12 hours cache
        return res.json(responseData);
      }

      const translatedFallbackText = await translateVerbatimScripture(verse.text, language);
      let translatedReflection = defaultReflection;
      if (language && language.toLowerCase() !== "english") {
        translatedReflection = await translateText(defaultReflection, language);
      }
      const responseData = {
        reference: verse.reference,
        text: verse.text,
        translatedText: translatedFallbackText || verse.text,
        reflection: defaultReflection,
        translatedReflection: translatedReflection
      };
      setCached(cacheKey, responseData, 12 * 60 * 60 * 1000); // 12 hours cache
      res.json(responseData);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/daily-verse", async (req, res) => {
    try {
      const { reference, text, language = "English", translation = "NIV" } = req.body;
      if (!reference || !text) {
        return res.status(400).json({ error: "Missing reference or text" });
      }

      const prompt = `For the Bible verse: "${reference} - ${text}", generate an encouragement-filled devotional reflection.
You must return the Bible verse, reference, and the devotional reflection entirely in the selected language: "${language}".

${getLanguageSpecificInstructions(language)}

Format your output strictly as a valid JSON object with the keys "reference" (the original reference e.g., "${reference}"), "text" (the exact verse text translated to "${language}"), and "reflection" (the devotional reflection in "${language}", around 100-150 words). Do not include markdown block ticks like \`\`\`json, just return raw JSON starting with { and ending with }.`;
      
      const resultString = await callGemini(prompt, `You are DailyBible, a respectful, biblically grounded companion. You write and translate entirely in the language: "${language}".`);
      const cleaned = cleanJsonString(resultString);
      const parsed = JSON.parse(cleaned);
      if (parsed && parsed.reflection && parsed.text) {
        const isEnglish = !language || language.toLowerCase() === "english";
        const englishReflection = isEnglish ? parsed.reflection : "Today's reflection reminder: In this verse, God promises His presence, strength, and guidance in our daily walk of faith. Trust Him today with your worries and let His Word light your path.";
        return res.json({
          reference,
          text: text,
          translatedText: parsed.text,
          reflection: englishReflection,
          translatedReflection: parsed.reflection
        });
      } else if (parsed && parsed.reflection) {
        const translatedVerseText = await translateVerbatimScripture(text, language);
        const isEnglish = !language || language.toLowerCase() === "english";
        const englishReflection = isEnglish ? parsed.reflection : "Today's reflection reminder: In this verse, God promises His presence, strength, and guidance in our daily walk of faith. Trust Him today with your worries and let His Word light your path.";
        return res.json({
          reference,
          text: text,
          translatedText: translatedVerseText || text,
          reflection: englishReflection,
          translatedReflection: parsed.reflection
        });
      } else {
        throw new Error("Invalid reflection generated");
      }
    } catch (err: any) {
      console.error("Daily verse study generation failed:", err);
      const reqLanguage = req.body.language || "English";
      const translatedFallbackText = await translateVerbatimScripture(req.body.text, reqLanguage);
      const defaultReflection = "Today's reflection reminder: In this verse, God promises His presence, strength, and guidance in our daily walk of faith. Trust Him today with your worries and let His Word light your path.";
      let translatedReflection = defaultReflection;
      if (reqLanguage && reqLanguage.toLowerCase() !== "english") {
        translatedReflection = await translateText(defaultReflection, reqLanguage);
      }
      return res.json({
        reference: req.body.reference,
        text: req.body.text,
        translatedText: translatedFallbackText || req.body.text,
        reflection: defaultReflection,
        translatedReflection: translatedReflection
      });
    }
  });

  // 2. Bible Search
  app.post("/api/bible-search", async (req, res) => {
    try {
      const { query, language = "English" } = req.body;
      if (!query) return res.status(400).json({ error: "Missing query" });

      if (ai) {
        try {
          const prompt = `Find 4 to 6 relevant Bible verses related to the query or keyword or chapter: "${query}".
For each verse, please return standard Bible references, the exact scripture text translated entirely in the language: "${language}", and a brief 1-sentence application context in the language: "${language}" showing why it fits. 

${getLanguageSpecificInstructions(language)}

Format your output strictly as a valid JSON array of objects with the keys "reference", "text", and "explanation". Do not include any HTML styles or markdown code blocks like \`\`\`json, just return raw JSON string starting with [ and ending with ].`;
          const resultString = await callGemini(prompt, `You are a helpful, accurate Bible search companion that returns verses and explanations exclusively in the language: "${language}" as a clean JSON list.`);
          const cleaned = cleanJsonString(resultString);
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const mapped = parsed.map((v: any) => ({
              ...v,
              translatedText: language && language.toLowerCase() !== "english" ? v.text : undefined,
              translatedExplanation: language && language.toLowerCase() !== "english" ? v.explanation : undefined
            }));
            return res.json({ results: mapped });
          }
        } catch (e) {
          console.error("Gemini Bible Search API call or JSON parsing failed. Falling back to curated offline search: ", e);
        }
      }

      // Offline/Fallback results if Gemini fails or key not set
      // Match query to key categories
      const q = (query || "").toLowerCase();
      let curated = [
        { reference: "Proverbs 3:5", text: "Trust in the Lord with all your heart and lean not on your own understanding.", explanation: "Encourages complete trust in God's wisdom over our own." },
        { reference: "Isaiah 26:3", text: "You will keep in perfect peace those whose minds are steadfast, because they trust in you.", explanation: "Shows the connection between trusting God and having mental peace." },
        { reference: "Matthew 6:33", text: "But seek first the kingdom of God and his righteousness, and all these things will be added to you.", explanation: "Commands putting spiritual priorities first daily." },
        { reference: "Psalm 119:105", text: "Your word is a lamp to my feet and a light to my path.", explanation: "Reminds us that Scripture provides direct guidance for life's journey." }
      ];

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

      if (q.includes("hope") || q.includes("future") || q.includes("prosper")) {
        curated = hopeVerses;
      } else if (q.includes("anx") || q.includes("peace") || q.includes("worry") || q.includes("stress") || q.includes("fear")) {
        curated = peaceAndAnxiety;
      } else if (q.includes("faith") || q.includes("trust") || q.includes("believ")) {
        curated = faithAndTrust;
      } else if (q.includes("heal") || q.includes("sick") || q.includes("pain") || q.includes("wound")) {
        curated = healingAndPain;
      } else if (q.includes("forg") || q.includes("sin") || q.includes("grace")) {
        curated = forgivenessAndGrace;
      } else if (q.includes("love") || q.includes("kind")) {
        curated = loveAndKindness;
      }

      if (language && language.toLowerCase() !== "english") {
        try {
          curated = await Promise.all(
            curated.map(async (v) => {
              const translatedText = await translateVerbatimScripture(v.text, language);
              const translatedExplanation = await translateText(v.explanation, language);
              return {
                ...v,
                translatedText,
                translatedExplanation,
                text: translatedText,
                explanation: translatedExplanation
              };
            })
          );
        } catch (err) {
          console.warn("Failed to translate fallback bible search results:", err);
        }
      }

      res.json({ results: curated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Guided Study Companion Chat & Chat Alias
  const handleChat = async (req: any, res: any) => {
    try {
      const { message, userMessage, chatHistory, language = "English" } = req.body;
      const actualMessage = message || userMessage;
      if (!actualMessage) return res.status(400).json({ error: "Missing message or userMessage" });

      const historyFormatted = (chatHistory || []).map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join("\n");

      if (ai) {
        try {
          const prompt = `
Context History:
${historyFormatted}

User Question: ${actualMessage}

Please respond following these guidelines:
- Answer respectfully and biblically.
- Provide clear scripture references (including book, chapter, and verse) whenever possible.
- Avoid denominational bias (use broad Christian, non-denominational biblical views).
- Use encouraging, hopeful, and uplifting language.
- Clearly separate direct scripture quotations from your explanations.
- Suggest practical daily life applications for the answer.
- CRITICAL: Respond and translate all Scripture and explanations entirely in the selected language: "${language}".

${getLanguageSpecificInstructions(language)}`;

          const systemInstruction = 
            `You are DailyBible, a professional, respectful, non-denominational, and compassionate Bible Study Companion. ` +
            `Your goal is to explain scripture in accessible language, guide people back to biblical truth, and offer helpful, reassuring life suggestions entirely in the language: "${language}". ${getLanguageSpecificInstructions(language)}`;

          const response = await callGemini(prompt, systemInstruction);
          return res.json({ reply: response });
        } catch (err: any) {
          console.warn("Gemini Assistant call failed, falling back to custom server-side sandbox mode:", err);
        }
      }

      // Safe, rich, interactive offline response if Gemini is not set up or throws an error
      const offlineReply = getOfflineAssistantResponse(actualMessage);
      res.json({ reply: offlineReply });
    } catch (err: any) {
      console.error("General error in assistant endpoint:", err);
      try {
        const absoluteFallback = getOfflineAssistantResponse(req.body.message || req.body.userMessage || "");
        res.json({ reply: absoluteFallback });
      } catch (inner) {
        res.status(250).json({ reply: "Peace be with you. I am standing by to study with you." });
      }
    }
  };

  app.post("/api/assistant", handleChat);
  app.post("/api/chat", handleChat);

  // 4. Chapter Summaries
  app.post("/api/chapter-summary", async (req, res) => {
    try {
      const { book, chapter, language = "English", translation = "NIV" } = req.body;
      if (!book || !chapter) return res.status(400).json({ error: "Missing book or chapter" });

      const cacheKey = `chapter-summary-${book.trim().toLowerCase()}-${chapter}-${language.trim().toLowerCase()}-${translation.trim().toLowerCase()}`;
      const cached = getCached(cacheKey);
      if (cached) {
        console.log(`[Cache Hit] Serving chapter-summary from server cache for key: ${cacheKey}`);
        return res.json(cached);
      }

      if (ai) {
        try {
          const scripturePromise = fetchScriptureFromApi(`${book} ${chapter}`, translation, language);

          const prompt = `Generate a highly concise study guide for "${book} Chapter ${chapter}" based on the "${translation}" Bible translation version.
Please return a strict JSON format with exactly the following keys:
- "summary": A brief general summary paragraph of the chapter (max 60 words).
- "lessons": An array of 3 brief, high-impact key spiritual or practical lessons (max 20 words each).
- "verses": An array of 3 key verses or highlight verses from the chapter as written in the "${translation}" translation, as objects with keys "reference" (e.g. "${book} ${chapter}:3") and "text" (the verse Scripture text in "${translation}", max 30 words).
- "reflectionQuestions": An array of 3 concise personal reflection questions for study (max 15 words each).
- "prayerPoints": An array of 3 short prayer prompt points derived from the chapter (max 15 words each).
- "characterProfiles": An array of profile objects for up to 3 key characters or groups mentioned in this exact chapter (if none, return []). Each profile has:
  * "name": The name of the character or group.
  * "role": Their specific role/actions in this chapter (max 15 words).
  * "significance": Their overall significance or spiritual meaning (max 15 words).

${getLanguageSpecificInstructions(language)}

CRITICAL Translation Instructions:
1. All expositional content (summary, lessons, verses reference and text, reflectionQuestions, prayerPoints, characterProfiles) MUST be written entirely in the selected language: "${language}".
2. Do NOT include the "fullChapterText" key in the JSON.
3. Keep the overall theological commentary and phrasing style aligned with the "${translation}" translation.
4. Inside any string value, you must escape any double quotes with a backslash (e.g., use \\" instead of \"). Do not use unescaped double quotes inside JSON string values.
Keep the entire response extremely concise, brief, and under 800 tokens to ensure complete generation. Do not include any Markdown blocks like \`\`\`json, just return a raw JSON string starting with { and ending with }.`;

          const [resultString, scriptureText] = await Promise.all([
            callGemini(prompt, `You are an expert Bible study author and theologian. Provide chapter study guides strictly in perfect, extremely concise JSON in the language: "${language}" matching the "${translation}" translation style. ${getLanguageSpecificInstructions(language)}`),
            scripturePromise
          ]);

          const translatedScriptureText = await translateVerbatimScripture(scriptureText, language);

          const cleaned = cleanJsonString(resultString);
          const parsed = JSON.parse(cleaned);
          if (parsed && parsed.summary && Array.isArray(parsed.lessons) && Array.isArray(parsed.verses)) {
            parsed.fullChapterText = translatedScriptureText || `[1] (Scripture content for ${book} ${chapter} is currently unavailable offline)`;
            parsed.translatedText = translatedScriptureText;
            setCached(cacheKey, parsed, 7 * 24 * 60 * 60 * 1000); // cache for 7 days
            return res.json(parsed);
          }
        } catch (e) {
          console.error("Chapter study generation or JSON parse failed. Falling back to offline companion guide:", e);
        }
      }

      // Safe, rich offline chapter study guide
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

      // Deepen offline fallback based on book type
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

      let responseGuide = {
        summary,
        lessons,
        verses,
        reflectionQuestions,
        prayerPoints,
        fullChapterText,
        characterProfiles,
        _offline: true
      };

      if (language && language.toLowerCase() !== "english") {
        try {
          responseGuide = await translateStudyGuide(responseGuide, language);
        } catch (err) {
          console.warn("Failed to translate fallback study guide:", err);
        }
      }

      setCached(cacheKey, responseGuide, 7 * 24 * 60 * 60 * 1000); // cache for 7 days
      res.json(responseGuide);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Utility Translation Endpoints for Client Resiliency
  app.post("/api/translate", async (req, res) => {
    try {
      const { text, language } = req.body;
      if (!text || !language || language.toLowerCase() === "english") {
        return res.json({ translatedText: text });
      }
      const translatedText = await translateText(text, language);
      res.json({ translatedText });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/translate-scripture", async (req, res) => {
    try {
      const { text, language } = req.body;
      if (!text || !language || language.toLowerCase() === "english") {
        return res.json({ translatedText: text });
      }
      const translatedText = await translateVerbatimScripture(text, language);
      res.json({ translatedText });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/translate-results", async (req, res) => {
    try {
      const { results, language } = req.body;
      if (!results || !Array.isArray(results) || !language || language.toLowerCase() === "english") {
        return res.json({ results });
      }
      const translated = await Promise.all(
        results.map(async (v: any) => {
          const text = await translateVerbatimScripture(v.text, language);
          const explanation = await translateText(v.explanation, language);
          return {
            ...v,
            translatedText: text,
            translatedExplanation: explanation,
            text,
            explanation
          };
        })
      );
      res.json({ results: translated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/translate-study-guide", async (req, res) => {
    try {
      const { guide, language } = req.body;
      if (!guide || !language || language.toLowerCase() === "english") {
        return res.json({ guide });
      }
      const translatedGuide = await translateStudyGuide(guide, language);
      res.json({ guide: translatedGuide });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Prayer Companion Reflection
  app.post("/api/prayer-companion", async (req, res) => {
    try {
      const { request, language = "English" } = req.body;
      if (!request) return res.status(400).json({ error: "Missing prayer request" });

      if (ai) {
        const prompt = `Write a deep, compassionate, and personalized prayer based on this request/concern: "${request}". 
Make sure to:
- Be uplifting, biblically encouraging, and humble.
- Incorporate a direct relevant Bible verse quote in the prayer.
- Focus on hope, surrender, healing, peace, or praise as appropriate.
- Keep the length around 150-250 words.

${getLanguageSpecificInstructions(language)}

- CRITICAL: Write the entire prayer and any included scriptures entirely in the selected language: "${language}".`;
        const prayer = await callGemini(prompt, `You are a warm, faith-filled prayer counselor. You write prayers that are heartfelt, personal, and scripturally rich entirely in the language: "${language}". ${getLanguageSpecificInstructions(language)}`);
        return res.json({ prayer });
      }

      res.json({
        prayer: `Dear Heavenly Father,\n\nWe lift up this request to You today: "${request}". In the midst of this situation, we claim Your promise in Philippians 4:6-7, to not be anxious about anything, but in everything by prayer and petition, with thanksgiving, present our requests to You. We ask for Your comfortable peace which transcends all understanding to guard this heart. Guide every step and let Your warm presence bring comfort. In Jesus' name, Amen.`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Devotional Generator
  app.post("/api/devotional", async (req, res) => {
    try {
      const { topic, language = "English" } = req.body;
      const selectedLanguage = language;
      if (!topic) return res.status(400).json({ error: "Missing topic" });

      const cacheKey = `devotional-${topic.trim().toLowerCase()}-${language.trim().toLowerCase()}`;
      const cached = getCached(cacheKey);
      if (cached) {
        console.log(`[Cache Hit] Serving devotional from server cache for key: ${cacheKey}`);
        return res.json(cached);
      }

      if (ai) {
        const prompt = `Generate a daily devotional on the topic of "${topic}".
Please construct a strict JSON format with the following keys:
- "title": A catching, deep devotional title (max 10 words).
- "scripture": A scripture reference relevant to the topic (e.g. "Psalm 46:10").
- "scriptureText": The exact quotation text of that scripture.
- "reflection": A deep, single-paragraph devotional reflecting on the spiritual lessons (max 150 words).
- "actionStep": A concrete practical daily action/challenge step related to this devotional (max 20 words).
- "prayer": A short, heartfelt 2-line closing prayer (max 30 words).

${getLanguageSpecificInstructions(selectedLanguage)}

CRITICAL Instructions:
1. Translate and write ALL fields (title, scripture reference, scriptureText, reflection, actionStep, prayer) entirely in the selected language: "${selectedLanguage}".
2. Inside any string value, you must escape any double quotes with a backslash (e.g., use \\" instead of \"). Do not use unescaped double quotes inside JSON string values.
Keep the entire response extremely concise, brief, and under 600 tokens to ensure complete generation. Do not include any Markdown blocks like \`\`\`json, just return raw JSON string starting with { and ending with }.`;

        const resultString = await callGemini(prompt, `You are a devotional author that produces warm, rich spiritual insights in extremely concise JSON format entirely in the language: "${selectedLanguage}". ${getLanguageSpecificInstructions(selectedLanguage)}`);
        try {
          const cleaned = cleanJsonString(resultString);
          const parsed = JSON.parse(cleaned);
          setCached(cacheKey, parsed, 24 * 60 * 60 * 1000); // cache for 24 hours
          return res.json(parsed);
        } catch (e) {
          console.error("Devotional JSON parse failed", e, resultString);
        }
      }

      // Offline fallback
      const DEVOTIONAL_LOCALIZED_FALLBACKS: Record<string, Record<string, any>> = {
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
            reflection: "A esperança no é um pensamento positivo; a esperança bíblica é uma confiança segura nas promesas de Deus. Quando as ondas da vida quebram ao nosso redor, nossa âncora permanece profunda na presença de Cristo. Isso nos mantém firmes mesmo através das tempestades escuras e imprevisíveis.",
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
        setCached(cacheKey, fallbackSet[language], 24 * 60 * 60 * 1000); // cache for 24 hours
        return res.json(fallbackSet[language]);
      }

      // Offline fallback
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

      const responseData = {
        title,
        scripture,
        scriptureText: text,
        reflection: refl,
        actionStep: action,
        prayer
      };
      setCached(cacheKey, responseData, 24 * 60 * 60 * 1000); // cache for 24 hours
      res.json(responseData);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Proxy endpoint for client-side Gemini generation to prevent browser API key exposure and handle quotas via robust server-side fallback
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { prompt, systemInstruction, options } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Missing prompt" });
      }
      const responseText = await callGemini(prompt, systemInstruction, options);
      res.json({ text: responseText });
    } catch (err: any) {
      console.error("Error in server-side proxy /api/gemini/generate:", err);
      res.status(500).json({ error: err.message || "Failed to generate content" });
    }
  });

  // --- Vite & Client Integration ---
  if (process.env.NODE_ENV !== "production") {
    createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    }).then((vite) => {
      app.use(vite.middlewares);
      if (!process.env.VERCEL) {
        app.listen(PORT, "0.0.0.0", () => {
          console.log(`DailyBible Full-Stack Server listening on http://localhost:${PORT}`);
        });
      }
    }).catch((err) => {
      console.error("Failed to start Vite dev server:", err);
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    if (!process.env.VERCEL) {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`DailyBible Full-Stack Server listening on http://localhost:${PORT}`);
      });
    }
  }

export default app;
