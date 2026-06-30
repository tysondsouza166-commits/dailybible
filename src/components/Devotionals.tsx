import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Heart, Sparkles, BookOpen, Clock, Lightbulb, Bookmark, BookmarkCheck, ChevronRight, Volume2, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getDevotional } from "../lib/geminiClient";
import { translate } from "../lib/translations";
import { useTTS } from "../lib/useTTS";

export const Devotionals: React.FC = () => {
  const { isBookmarked, addFavorite, removeFavorite, favorites, language, textSize } = useApp();

  const scriptureSizeMap: Record<string, string> = {
    sm: "text-base md:text-lg",
    base: "text-lg md:text-xl",
    lg: "text-xl md:text-2xl",
    xl: "text-2xl md:text-3xl",
    "2xl": "text-3xl md:text-4xl"
  };

  const bodySizeMap: Record<string, string> = {
    sm: "text-xs md:text-sm",
    base: "text-sm md:text-base",
    lg: "text-base md:text-lg",
    xl: "text-lg md:text-xl",
    "2xl": "text-xl md:text-2xl"
  };

  const cardTextSizeMap: Record<string, string> = {
    sm: "text-[11px] md:text-xs",
    base: "text-xs md:text-sm",
    lg: "text-sm md:text-base",
    xl: "text-base md:text-lg",
    "2xl": "text-lg md:text-xl"
  };

  const { isPlaying, speak, stop } = useTTS();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [devotional, setDevotional] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topics = [
    { name: "Faith", key: "faith", desc: translate("desc_faith", language), color: "from-blue-500/10 to-teal-500/5 hover:border-blue-500/20" },
    { name: "Hope", key: "hope", desc: translate("desc_hope", language), color: "from-amber-500/10 to-orange-500/5 hover:border-amber-500/20" },
    { name: "Anxiety", key: "anxiety", desc: translate("desc_anxiety", language), color: "from-rose-500/10 to-purple-500/5 hover:border-rose-500/20" },
    { name: "Family", key: "family", desc: translate("desc_family", language), color: "from-emerald-500/10 to-teal-500/5 hover:border-emerald-500/20" },
    { name: "Leadership", key: "leadership", desc: translate("desc_leadership", language), color: "from-indigo-500/10 to-violet-500/5 hover:border-indigo-500/20" },
    { name: "Healing", key: "healing", desc: translate("desc_healing", language), color: "from-violet-500/10 to-fuchsia-500/5 hover:border-violet-500/20" },
    { name: "Gratitude", key: "gratitude", desc: translate("desc_gratitude", language), color: "from-cyan-500/10 to-blue-500/5 hover:border-cyan-500/20" }
  ];

  const handleSelectTopic = async (topic: string) => {
    setSelectedTopic(topic);
    setLoading(true);
    setError(null);
    setDevotional(null);

    try {
      const data = await getDevotional(topic, language);
      setDevotional(data);
    } catch (err: any) {
      setError(err.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    stop();
    setDevotional(null);
    setError(null);
    if (selectedTopic) {
      handleSelectTopic(selectedTopic);
    }
  }, [language]);

  const handleTTSToggle = () => {
    if (!devotional) return;
    if (isPlaying) {
      stop();
    } else {
      const title = devotional.title || "";
      const scriptureText = devotional.scriptureText || "";
      const scriptureRef = devotional.scripture || "";
      const reflection = devotional.reflection || "";
      const actionStep = devotional.actionStep || "";
      const prayer = devotional.prayer || "";
      
      const combinedText = `${title}. ${scriptureText}. ${scriptureRef}. ${reflection}. ${actionStep}. ${prayer}`;
      speak(combinedText, language);
    }
  };

  const handleFavoriteToggle = async () => {
    if (!devotional) return;
    const isSaved = isBookmarked(devotional.scripture);
    if (isSaved) {
      const existing = favorites.find(f => f.reference === devotional.scripture);
      if (existing) await removeFavorite(existing.id);
    } else {
      await addFavorite(devotional.scripture, devotional.scriptureText, `${selectedTopic} Devotional`);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-4 px-2">
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-serif tracking-tight text-brand-700 dark:text-brand-200 flex items-center space-x-2">
          <span>{translate("topic_devotionals", language)}</span>
        </h2>
        <p className="text-sm text-charcoal-600 dark:text-charcoal-400">
          {translate("devotionals_desc", language)}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!selectedTopic ? (
          <motion.div
            key="topic-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {topics.map((item, idx) => (
              <button
                key={item.name}
                onClick={() => handleSelectTopic(item.name)}
                className={`group p-6 rounded-2xl bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 shadow-xs flex flex-col justify-between items-start text-left hover:shadow-md transition-all active:scale-98 duration-250 cursor-pointer hover:border-brand-300 dark:hover:border-charcoal-700`}
              >
                <div className="w-full">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold tracking-widest uppercase text-brand-600 dark:text-brand-305 font-sans">
                      {translate("category", language)}
                    </span>
                    <Sparkles className="w-4 h-4 text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <h3 className="text-lg font-serif font-bold text-brand-700 dark:text-brand-200 group-hover:text-brand-605 dark:group-hover:text-brand-300 transition-colors">
                    {translate("topic_" + item.key, language)}
                  </h3>
                  <p className="text-xs text-charcoal-600 dark:text-charcoal-400 mt-1 line-clamp-2">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-6 flex items-center text-xs font-semibold text-brand-600 dark:text-brand-305 group-hover:translate-x-1 transition-transform">
                  <span>{translate("explore_devotional", language)}</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="devotional-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Back to selection link */}
            <button
              onClick={() => {
                stop();
                setSelectedTopic(null);
              }}
              className="text-xs font-semibold text-[#7c786f] hover:text-brand-600 dark:text-charcoal-405 dark:hover:text-brand-300 flex items-center space-x-1 cursor-pointer"
            >
              {translate("back_to_categories", language)}
            </button>

            {loading ? (
              <div className="flex flex-col items-center justify-center p-16 space-y-4 bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-3xl min-h-[400px]">
                <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                <p className="text-sm text-charcoal-605 dark:text-charcoal-400 font-sans">{translate("writing_devotional", language)}</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl p-6 text-center text-red-650 dark:text-red-400 flex items-center justify-center space-x-2">
                <span>{error}</span>
              </div>
            ) : devotional ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-8"
              >
                {/* Header info */}
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-linen-100 dark:border-charcoal-800 pb-6 gap-4">
                  <div className="space-y-1">
                    <span className="inline-flex text-[10px] font-bold tracking-wider uppercase text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/10 px-2.5 py-1 rounded-md">
                      {translate("topic_" + selectedTopic.toLowerCase(), language)} {translate("devotional_study", language)}
                    </span>
                    <h3 className="text-2xl font-serif font-bold text-brand-700 dark:text-brand-200 leading-tight">
                      {devotional.title}
                    </h3>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={handleTTSToggle}
                      className={`px-3 py-1.5 border rounded-xl text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-all ${
                        isPlaying
                          ? "bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-900/30 dark:border-brand-800 dark:text-brand-300 animate-pulse"
                          : "border-linen-350 dark:border-charcoal-800 hover:bg-[#faf8f5] dark:hover:bg-charcoal-850 text-charcoal-700 dark:text-linen-100"
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Square className="w-4 h-4 fill-current" />
                          <span>{translate("stop", language)}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4" />
                          <span>{translate("listen", language)}</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleFavoriteToggle}
                      className="px-3 py-1.5 border border-linen-350 dark:border-charcoal-800 rounded-xl hover:bg-[#faf8f5] dark:hover:bg-charcoal-850 hover:text-[#d97706] text-xs font-semibold text-charcoal-700 dark:text-linen-100 flex items-center space-x-1 cursor-pointer"
                    >
                      {isBookmarked(devotional.scripture) ? (
                        <>
                          <BookmarkCheck className="w-4 h-4 text-amber-500" />
                          <span className="text-amber-500">{translate("bookmarked", language)}</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-4 h-4" />
                          <span>{translate("bookmark_scripture", language)}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Scripture Quote */}
                <div className="bg-linen-50 dark:bg-charcoal-950/40 border border-linen-350/50 dark:border-charcoal-850 p-6 rounded-2xl relative overflow-hidden">
                  <div className="absolute right-4 bottom-4 opacity-5 pointer-events-none">
                    <BookOpen className="w-24 h-24 stroke-1 text-charcoal-900 dark:text-white" />
                  </div>
                  <blockquote className={`font-serif italic text-[#3c3a35] dark:text-linen-100 leading-relaxed pr-6 select-text mb-3 ${scriptureSizeMap[textSize] || "text-base"}`}>
                    “{devotional.scriptureText}”
                  </blockquote>
                  <p className="font-serif font-semibold text-sm text-brand-700 dark:text-brand-303 select-text">
                    — {devotional.scripture}
                  </p>
                </div>

                {/* Reflections */}
                <div className="space-y-4 md:space-y-6">
                  {devotional.reflection.split("\n\n").map((para: string, pIdx: number) => (
                    <p key={pIdx} className={`text-charcoal-750 dark:text-charcoal-200 leading-relaxed font-sans select-text ${bodySizeMap[textSize] || "text-sm md:text-base"}`}>
                      {para}
                    </p>
                  ))}
                </div>

                {/* Practical Step & Prayer split */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-linen-100 dark:border-charcoal-800">
                  <div className="bg-brand-500/5 border border-brand-500/10 dark:border-brand-500/10 rounded-2xl p-6 space-y-3">
                    <div className="flex items-center space-x-2 text-brand-700 dark:text-brand-300">
                      <Lightbulb className="w-5 h-5 flex-shrink-0" />
                      <h4 className="font-semibold text-sm uppercase tracking-wider font-sans">{translate("daily_application_step", language)}</h4>
                    </div>
                    <p className={`text-charcoal-750 dark:text-charcoal-300 leading-relaxed font-sans ${cardTextSizeMap[textSize] || "text-xs md:text-sm"}`}>
                      {devotional.actionStep}
                    </p>
                  </div>

                  <div className="bg-[#fcfbf9] dark:bg-charcoal-950 border border-linen-200 dark:border-charcoal-800 rounded-2xl p-6 space-y-3">
                    <div className="flex items-center space-x-2 text-charcoal-700 dark:text-linen-300">
                      <Clock className="w-5 h-5 flex-shrink-0" />
                      <h4 className="font-semibold text-sm uppercase tracking-wider font-sans">{translate("closing_prayer", language)}</h4>
                    </div>
                    <p className={`italic font-serif text-charcoal-750 dark:text-linen-200 leading-relaxed select-text ${cardTextSizeMap[textSize] || "text-xs md:text-sm"}`}>
                      {devotional.prayer}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
