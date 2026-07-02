import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Bookmark, Search, Sparkles, AlertCircle, HelpCircle, Heart } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { searchBible } from "../lib/geminiClient";
import { translate } from "../lib/translations";

const LOCAL_FALLBACK_VERSES: Record<string, Array<{ reference: string; text: string; explanation: string }>> = {
  hope: [
    { reference: "Romans 15:13", text: "May the God of hope fill you with all joy and peace as you trust in him, so that you may overflow with hope by the power of the Holy Spirit.", explanation: "Encourages trust as the fertile ground for overflowing hope." },
    { reference: "Hebrews 6:19", text: "We have this hope as an anchor for the soul, firm and secure.", explanation: "Tethers our inner peace to God's immovable sanctuary in stormy seasons." },
    { reference: "Jeremiah 29:11", text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.", explanation: "Reveals God's intentional design toward a bright, guided tomorrow." },
    { reference: "Isaiah 40:31", text: "But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.", explanation: "Promises complete renewal of endurance when we patiently wait on the Lord." }
  ],
  anxiety: [
    { reference: "Philippians 4:6-7", text: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts...", explanation: "Commands turning worry into thankful prayer to receive supernatural peace." },
    { reference: "1 Peter 5:7", text: "Cast all your anxiety on him because he cares for you.", explanation: "Reminds us that we can surrender our heaviest burdens because our Father loves us." },
    { reference: "Matthew 6:34", text: "Therefore do not worry about tomorrow, for tomorrow will worry about itself. Each day has enough trouble of its own.", explanation: "Instructs mindfulness of today's grace, letting go of future variables." },
    { reference: "Isaiah 41:10", text: "So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you; I will uphold you with my righteous right hand.", explanation: "Draws courage directly from God's personal, active companionship." }
  ],
  peace: [
    { reference: "John 14:27", text: "Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid.", explanation: "Distinguishes Christ's unshakeable peace from temporal world comfort." },
    { reference: "Isaiah 26:3", text: "You will keep in perfect peace those whose minds are steadfast, because they trust in you.", explanation: "Focuses on steady trust as the primary mental gatekeeper of lasting tranquility." },
    { reference: "Romans 5:1", text: "Therefore, since we have been justified through faith, we have peace with God through our Lord Jesus Christ.", explanation: "Establishes a deep relational peace that heals our spiritual position." }
  ],
  faith: [
    { reference: "Hebrews 11:1", text: "Now faith is confidence in what we hope for and assurance about what we do not see.", explanation: "Defines faith as structural certainty in God's promises." },
    { reference: "Hebrews 11:6", text: "And without faith it is impossible to please God, because anyone who comes to him must believe that he exists and that he rewards those who earnestly seek him.", explanation: "Points to belief and earnest seeking as core parameters of pleasing faith." },
    { reference: "Romans 10:17", text: "Consequently, faith comes from hearing the message, and the message is heard through the word about Christ.", explanation: "Traces the growth of faith to immersion in divine teaching." },
    { reference: "Mark 11:22", text: "Have faith in God. Truly I tell you, if anyone says to this mountain, 'Go, throw yourself into the sea,' and does not doubt in their heart but believes it will be done.", explanation: "Spurs dynamic, courageous faith that triumphs over massive difficulties." }
  ],
  healing: [
    { reference: "Psalm 147:3", text: "He heals the brokenhearted and binds up their wounds.", explanation: "Beautifully frames God as a hands-on caregiver dressing our soul scars." },
    { reference: "Jeremiah 17:14", text: "Heal me, Lord, and I will be healed; save me and I will be saved, for you are the one I praise.", explanation: "A beautiful prayer from a starting posture of absolute trust." },
    { reference: "James 5:14-15", text: "Is anyone among you sick? Let them call the elders of the church to pray over them... And the prayer offered in faith will make the sick person well.", explanation: "Combines community prayer and faith in the process of restoration." }
  ],
  forgiveness: [
    { reference: "Colossians 3:13", text: "Bear with each other and forgive one another if any of you has a grievance against someone. Forgive as the Lord forgave you.", explanation: "Hooks our call to forgive directly to the absolute pardon we've received." },
    { reference: "1 John 1:9", text: "If we confess our sins, he is faithful and just and will forgive us our sins and purify us from all unrighteousness.", explanation: "Provides a pristine covenant promise of full restoration when we are honest." },
    { reference: "Ephesians 4:32", text: "Be kind and compassionate to one another, forgiving each other, just as in Christ God forgave you.", explanation: "Models interpersonal forgiveness after Christ's massive divine benchmark." }
  ],
  love: [
    { reference: "1 Corinthians 13:4-7", text: "Love is patient, love is kind. It does not envy, it does not boast... It always protects, always trusts, always hopes, always perseveres.", explanation: "Portrays the ultimate, self-giving character of godly love." },
    { reference: "1 John 4:19", text: "We love because he first loved us.", explanation: "Explains that our capacity to love originates in being deeply loved first." },
    { reference: "John 15:13", text: "Greater love has no one than this: to lay down one's life for one's friends.", explanation: "Unveils deep sacrifice as the ultimate measure of true affection." }
  ],
  prayer: [
    { reference: "1 Thessalonians 5:16-18", text: "Rejoice always, pray continually, give thanks in all circumstances; for this is God’s will for you in Christ Jesus.", explanation: "Interlocks unceasing prayer with constant thankfulness and joy." },
    { reference: "Philippians 4:6", text: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.", explanation: "Instructs active prayer with a thankful focus as the solution to worry." },
    { reference: "Hebrews 4:16", text: "Let us then approach God’s throne of grace with confidence, so that we may receive mercy and find grace to help us.", explanation: "Invites us boldly to discuss our problems with the Source of Grace." }
  ],
  strength: [
    { reference: "Isaiah 40:29", text: "He gives strength to the weary and increases the power of the weak.", explanation: "Promises supernatural energy exactly when we reach our personal limit." },
    { reference: "Philippians 4:13", text: "I can do all things through Christ who strengthens me.", explanation: "Anchors our endurance in Christ's indwelling power rather than circumstances." },
    { reference: "Nehemiah 8:10", text: "Do not grieve, for the joy of the Lord is your strength.", explanation: "Declares God's joy as our protective fortress." }
  ]
};

const getClientFallbackResults = (query: string) => {
  const q = query.toLowerCase().trim();
  if (q.includes("hope") || q.includes("future") || q.includes("prosper")) return LOCAL_FALLBACK_VERSES.hope;
  if (q.includes("anx") || q.includes("worry") || q.includes("stress") || q.includes("fear") || q.includes("anxiety")) return LOCAL_FALLBACK_VERSES.anxiety;
  if (q.includes("peace") || q.includes("calm") || q.includes("quiet")) return LOCAL_FALLBACK_VERSES.peace;
  if (q.includes("faith") || q.includes("trust") || q.includes("believ")) return LOCAL_FALLBACK_VERSES.faith;
  if (q.includes("heal") || q.includes("sick") || q.includes("pain") || q.includes("wound")) return LOCAL_FALLBACK_VERSES.healing;
  if (q.includes("forg") || q.includes("grace") || q.includes("confes") || q.includes("sin")) return LOCAL_FALLBACK_VERSES.forgiveness;
  if (q.includes("love") || q.includes("kind") || q.includes("heart")) return LOCAL_FALLBACK_VERSES.love;
  if (q.includes("pray") || q.includes("petition") || q.includes("ask")) return LOCAL_FALLBACK_VERSES.prayer;
  if (q.includes("stren") || q.includes("weary") || q.includes("weak")) return LOCAL_FALLBACK_VERSES.strength;

  return [
    { reference: "Proverbs 3:5-6", text: "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.", explanation: "Instructs us to trade our limited logic for deep trust in God's roadmap." },
    { reference: "Romans 8:28", text: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose.", explanation: "Promises that God is actively blending all experiences into a beautiful plan." },
    { reference: "John 3:16", text: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.", explanation: "The core, central message of sacrificial love and redemption." },
    { reference: "Galatians 5:22-23", text: "But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness, gentleness and self-control.", explanation: "Lists the beautiful qualities that result from spiritual maturity." }
  ];
};

export const BibleSearch: React.FC = () => {
  const { 
    isBookmarked, 
    addFavorite, 
    removeFavorite, 
    favorites,
    isVerseBookmarked,
    toggleBookmark,
    language
  } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isOfflineResult, setIsOfflineResult] = useState(false);

  useEffect(() => {
    if (results.length === 0 || !hasSearched) return;
    
    let active = true;
    const translateExistingResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch("/api/translate-results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ results, language }),
        });
        if (resp.ok && active) {
          const data = await resp.json();
          if (data && Array.isArray(data.results)) {
            setResults(data.results);
          }
        }
      } catch (err) {
        console.warn("Translation of existing search results failed:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    translateExistingResults();
    return () => {
      active = false;
    };
  }, [language]);

  const topics = [
    { key: "topic_hope", query: "Hope" },
    { key: "topic_anxiety", query: "Anxiety" },
    { key: "topic_faith", query: "Faith" },
    { key: "topic_healing", query: "Healing" },
    { key: "topic_forgiveness", query: "Forgiveness" },
    { key: "topic_family", query: "Family" },
    { key: "topic_leadership", query: "Leadership" },
    { key: "topic_gratitude", query: "Gratitude" }
  ];

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = customQuery || query;
    if (!searchQuery.trim()) return;

    if (!customQuery) setQuery(searchQuery);

    setLoading(true);
    setError(null);
    setHasSearched(true);
    setIsOfflineResult(false);

    try {
      const data = await searchBible(searchQuery, language);
      setResults(data);
    } catch (err: any) {
      console.warn("Express backend search failed, using graceful client-side fallback: ", err);
      const fallback = getClientFallbackResults(searchQuery);
      setResults(fallback);
      setIsOfflineResult(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFavoriteToggle = async (result: any) => {
    const isSaved = isBookmarked(result.reference);
    if (isSaved) {
      const existing = favorites.find(f => f.reference === result.reference);
      if (existing) await removeFavorite(existing.id);
    } else {
      await addFavorite(result.reference, result.text, "Search Insight");
    }
  };

  const handleCloudBookmarkToggle = async (result: any) => {
    await toggleBookmark(result.reference, result.text);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-4 px-0">
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-serif tracking-tight text-brand-700 dark:text-brand-200">
          {translate("smart_explorer", language)}
        </h2>
        <p className="text-sm text-charcoal-600 dark:text-charcoal-400">
          {translate("search_scrip_desc", language)}
        </p>
      </div>

      {/* Suggested Quick Topics */}
      <div className="flex flex-wrap gap-2 mb-6">
        {topics.map((t) => (
          <button
            key={t.key}
            onClick={(e) => {
              setQuery(t.query);
              handleSearch(e, t.query);
            }}
            className="px-3.5 py-1.5 text-xs text-charcoal-600 dark:text-charcoal-300 bg-white hover:bg-brand-50 dark:bg-charcoal-900 border-linen-200 dark:border-charcoal-800 dark:hover:bg-brand-900/20 shadow-xs border rounded-full transition-all active:scale-95 duration-100 font-sans hover:border-brand-500 cursor-pointer"
          >
            {translate(t.key, language)}
          </button>
        ))}
      </div>

      {/* Search Input Bar */}
      <form onSubmit={(e) => handleSearch(e)} className="relative flex items-center mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={translate("search_placeholder", language)}
          className="w-full pl-11 pr-24 py-3.5 bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-2xl focus:ring-2 focus:ring-brand-500 focus:outline-none shadow-xs text-charcoal-800 dark:text-linen-100 placeholder-charcoal-400 font-sans"
        />
        <div className="absolute left-4 text-charcoal-400 pointer-events-none">
          <Search className="w-5 h-5" />
        </div>
        <button
          type="submit"
          className="absolute right-2 px-5 py-2 hover:bg-brand-700 bg-brand-600 rounded-xl text-white font-medium text-xs md:text-sm active:scale-95 duration-150 shadow-xs flex items-center space-x-1.5 cursor-pointer"
        >
          <span>{translate("find", language)}</span>
        </button>
      </form>

      {/* Search Results Display Area */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            <p className="text-sm text-charcoal-600 dark:text-charcoal-405">{translate("searching_commentaries", language)}</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl p-6 text-center text-red-650 dark:text-red-400 flex items-center justify-center space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-sans">{error}</span>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-4">
            {isOfflineResult && (
              <div className="bg-[#faf8f5] dark:bg-charcoal-900 border border-brand-200 dark:border-brand-900/40 rounded-2xl p-4 flex items-center space-x-3 text-brand-700 dark:text-brand-300 shadow-sm animate-fade-in">
                <Sparkles className="w-5 h-5 flex-shrink-0 text-brand-600 animate-pulse" />
                <p className="text-xs font-sans leading-relaxed">
                  {translate("offline_search_warning", language)} <strong>"{query}"</strong>.
                </p>
              </div>
            )}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
            {results.map((verse, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-2xl p-6 flex flex-col justify-between shadow-xs relative hover:border-brand-200 dark:hover:border-brand-850/40 transition-all duration-300"
              >
                <div className="absolute top-4 right-4 flex items-center space-x-1">
                  {/* Secure cloud real-time bookmark subcollection */}
                  <button
                    onClick={() => handleCloudBookmarkToggle(verse)}
                    className="p-2 transition-transform active:scale-90 hover:bg-linen-100 dark:hover:bg-charcoal-800 rounded-full text-charcoal-400 dark:text-charcoal-600 hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer"
                    title={isVerseBookmarked(verse.reference) ? translate("remove_cloud_bookmark", language) : translate("save_cloud_bookmark", language)}
                  >
                    {isVerseBookmarked(verse.reference) ? (
                      <Bookmark className="w-5 h-5 text-brand-600 fill-brand-600" />
                    ) : (
                      <Bookmark className="w-5 h-5" />
                    )}
                  </button>

                  {/* Legacy local/cloud Favorites */}
                  <button
                    onClick={() => handleFavoriteToggle(verse)}
                    className="p-2 transition-transform active:scale-90 hover:bg-linen-100 dark:hover:bg-charcoal-800 rounded-full text-charcoal-400 dark:text-charcoal-600 hover:text-red-500 dark:hover:text-red-400 cursor-pointer"
                    title={isBookmarked(verse.reference) ? translate("remove_favorite", language) : translate("save_favorites", language)}
                  >
                    {isBookmarked(verse.reference) ? (
                      <Heart className="w-5 h-5 text-red-500 fill-red-550" />
                    ) : (
                      <Heart className="w-5 h-5" />
                    )}
                  </button>
                </div>

                <div className="space-y-4 flex-grow">
                  <span className="inline-flex text-[10px] font-bold tracking-widest uppercase text-clay-700 dark:text-clay-300 bg-clay-500/10 px-2.5 py-1 rounded-md">
                    {translate("scripture_passage", language)}
                  </span>
                  <blockquote className="text-base font-serif text-brand-700 dark:text-linen-100 leading-relaxed italic pr-6 select-text">
                    “{language && language.toLowerCase() !== "english" && verse.translatedText ? verse.translatedText : verse.text}”
                  </blockquote>
                  <p className="font-serif font-bold text-brand-600 dark:text-brand-300 select-text">
                    — {verse.reference}
                  </p>
                </div>

                {(verse.translatedExplanation || verse.explanation) && (
                  <div className="mt-4 pt-4 border-t border-linen-200 dark:border-charcoal-800 flex items-start space-x-2 text-charcoal-600 dark:text-charcoal-400">
                    <Sparkles className="w-4 h-4 text-brand-550 mt-0.5 flex-shrink-0" />
                    <p className="text-xs font-sans italic leading-relaxed select-text">
                      {language && language.toLowerCase() !== "english" && verse.translatedExplanation ? verse.translatedExplanation : verse.explanation}
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
        ) : hasSearched ? (
          <div className="text-center py-12 text-charcoal-400 dark:text-charcoal-500 space-y-2">
            <HelpCircle className="w-10 h-10 mx-auto stroke-1 text-charcoal-350 dark:text-charcoal-700" />
            <h4 className="font-semibold text-charcoal-700 dark:text-charcoal-300">{translate("no_results_found", language)}</h4>
            <p className="text-xs">{translate("adjust_terms", language)}</p>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-linen-400 dark:border-charcoal-800 p-12 text-center text-charcoal-400 dark:text-charcoal-500">
            <HelpCircle className="w-10 h-10 mx-auto mb-3 stroke-1 text-charcoal-350 dark:text-charcoal-700" />
            <h4 className="font-medium text-charcoal-700 dark:text-charcoal-300 mb-1">{translate("begin_your_study", language)}</h4>
            <p className="text-xs max-w-sm mx-auto">
              {translate("begin_your_study_desc", language)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
