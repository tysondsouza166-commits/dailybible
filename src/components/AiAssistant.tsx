import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User, HelpCircle, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getStudyChatReply } from "../lib/geminiClient";
import { useApp } from "../context/AppContext";
import { translate } from "../lib/translations";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export const AiAssistant: React.FC = () => {
  const { language } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "" // Will be populated dynamically based on translation
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const starterQuestions = [
    translate("starter_q_1", language),
    translate("starter_q_2", language),
    translate("starter_q_3", language),
    translate("starter_q_4", language)
  ];

  const getClientOfflineResponse = (query: string): string => {
    const q = query.toLowerCase().trim();
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

    return `Welcome to DailyBible's Sandbox Companion. I am glad you reached out!

Whether you are studying scripture, seeking encouragement, or looking for practical life applications, I am here to assist your daily walk of faith.

**Scripture to Hold Onto Today:**
"Your word is a lamp to my feet and a light to my path." — Psalm 119:105

**Suggested Application Options:**
1. **Daily Reading:** Explore the **Daily Devotionals** or **Verse of the Day** tabs to receive curated spiritual refreshment.
2. **Exploration:** Use the **Smart Bible Explorer** to search for specific topics such as forgiveness, peace, and hope.
3. **Study Guides:** Dig into the **Chapter Summaries** tab to generate outline structures and helpful reflection questions for any Bible chapter.

Please feel free to ask me any questions about scripture meanings, biblical history, or daily life integration. I am ready to guide you!`;
  };

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    if (!customText) setInput("");

    const newMsg: Message = { id: String(Date.now()), role: "user", text: textToSend };
    setMessages(prev => [...prev, newMsg]);
    setLoading(true);

    try {
      // Build previous context history
      const history = messages.slice(1).map(m => ({
        role: m.role,
        text: m.text
      }));

      const reply = await getStudyChatReply(textToSend, history, language);
      
      setMessages(prev => [...prev, {
        id: String(Date.now() + 1),
        role: "assistant",
        text: reply
      }]);
    } catch (err: any) {
      console.warn("Express backend call struggled, falling back to local client-side assistant mock:", err);
      const fallbackText = getClientOfflineResponse(textToSend);
      setMessages(prev => [...prev, {
        id: String(Date.now() + 1),
        role: "assistant",
        text: fallbackText + "\n\n" + translate("sandbox_note", language)
      }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Render text with smart typography & blockquote formatting for scriptures
  const renderFormattedText = (rawText: string) => {
    return rawText.split("\n\n").map((paragraph, pIdx) => {
      // Check if this looks like a direct blockquote (e.g., inside quotation marks or special notation)
      const isScriptureQuote = paragraph.trim().startsWith("“") || 
                              paragraph.trim().startsWith('"') || 
                              paragraph.trim().includes("— ") ||
                              (paragraph.length < 150 && /^[1-9]\s+[A-Z]/.test(paragraph.trim()));

      if (isScriptureQuote) {
        return (
          <blockquote 
            key={pIdx} 
            className="my-3 pl-4 border-l-4 border-brand-500/80 italic font-serif text-brand-700 dark:text-linen-100 bg-brand-500/5 dark:bg-brand-300/5 py-2 px-3 rounded-r-lg text-sm select-text"
          >
            {paragraph}
          </blockquote>
        );
      }

      // Render markdown boldings manually
      const parts = paragraph.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={pIdx} className="text-charcoal-700 dark:text-charcoal-400 leading-relaxed text-sm md:text-base select-text">
          {parts.map((part, partIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return <strong key={partIdx} className="font-semibold text-brand-750 dark:text-brand-300">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto py-4 px-0 flex flex-col h-[calc(100vh-13rem)] min-h-[480px]">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold font-serif tracking-tight text-brand-700 dark:text-brand-200 flex items-center space-x-2">
          <Sparkles className="w-6 h-6 text-brand-600 dark:text-brand-300" />
          <span>{translate("guided_study", language)}</span>
        </h2>
        <p className="text-sm text-charcoal-600 dark:text-charcoal-400">
          {language === "Spanish" ? "Explicaciones bíblicas inspiradoras y objetivas, mapeo de contexto y aplicación de la vida" :
           language === "Portuguese" ? "Explicações bíblicas inspiradoras e objetivas, mapeamento de contexto e aplicação na vida" :
           language === "French" ? "Explications bibliques édifiantes et objectives, cartographie du contexte et application à la vie" :
           language === "Tagalog" ? "Nagpapasiglang paliwanag ng Bibliya, pagmamapa ng konteksto, at pagsasabuhay" :
           "Uplifting, objective Bible explanations, context mapping, and life application"}
        </p>
      </div>

      {/* Conversations Area */}
      <div className="flex-grow bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-3xl p-6 overflow-y-auto mb-4 shadow-xs flex flex-col space-y-6">
        {messages.map((m) => {
          const isWelcome = m.id === "welcome";
          const displaytext = isWelcome ? translate("assistant_welcome", language) : m.text;
          return (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} items-start space-x-3`}
            >
              {m.role === "assistant" && (
                <div className="p-2 bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 rounded-xl flex-shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl p-4 md:p-5 ${
                  m.role === "user"
                    ? "bg-brand-550 text-white shadow-xs rounded-tr-none px-5"
                    : "bg-linen-50 dark:bg-charcoal-950/45 border border-linen-300 dark:border-charcoal-800/40 rounded-tl-none text-charcoal-800 dark:text-linen-100"
                }`}
              >
                {m.role === "user" ? (
                  <p className="text-sm md:text-base leading-relaxed select-text font-medium">{displaytext}</p>
                ) : (
                  <div className="space-y-3 font-sans">
                    {renderFormattedText(displaytext)}
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className="p-2 bg-linen-200 dark:bg-charcoal-850 text-charcoal-600 dark:text-linen-300 rounded-xl flex-shrink-0">
                  <User className="w-5 h-5" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start items-center space-x-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 rounded-xl flex-shrink-0 animate-pulse">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="bg-linen-50 dark:bg-charcoal-950/45 border border-linen-300 dark:border-charcoal-800/40 rounded-2xl rounded-tl-none p-4 flex items-center space-x-2">
              <div className="w-2.5 h-2.5 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2.5 h-2.5 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2.5 h-2.5 bg-brand-500 rounded-full animate-bounce" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Starter Suggestions */}
      {messages.length === 1 && (
        <div className="mb-4">
          <p className="text-xs text-charcoal-400 dark:text-charcoal-500 mb-2 font-medium">{translate("begin_suggestion", language)}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {starterQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(q)}
                className="text-left py-2.5 px-4 text-xs bg-linen-50 border border-linen-300 dark:bg-charcoal-850 dark:border-charcoal-800 text-charcoal-600 dark:text-charcoal-350 hover:bg-brand-50 dark:hover:bg-brand-900/10 hover:text-brand-600 dark:hover:text-brand-300 hover:border-brand-500 rounded-xl leading-snug transition-all cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Submit form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex space-x-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={translate("ask_faith_q", language)}
          className="flex-grow p-3 bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs text-charcoal-800 dark:text-linen-100 placeholder-charcoal-400 text-sm md:text-base font-sans"
        />
        <button
          type="submit"
          className="p-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl active:scale-95 duration-100 shadow-xs transition flex-shrink-0 cursor-pointer"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};
