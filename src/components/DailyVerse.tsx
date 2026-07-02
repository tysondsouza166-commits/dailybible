import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Bookmark, Heart, FileText, Sparkles, RefreshCw, AlertCircle, Volume2, Square } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { fetchDailyVerse } from "../lib/geminiClient";
import { translate } from "../lib/translations";
import { safeStorage } from "../lib/safeStorage";
import { useTTS } from "../lib/useTTS";

export const DailyVerse: React.FC = () => {
  const { 
    isBookmarked, 
    addFavorite, 
    removeFavorite, 
    favorites, 
    saveNote, 
    incrementStreak,
    isVerseBookmarked,
    toggleBookmark,
    language,
    textSize
  } = useApp();

  const scriptureSizeMap: Record<string, string> = {
    sm: "text-lg md:text-xl",
    base: "text-xl md:text-2xl",
    lg: "text-2xl md:text-3xl",
    xl: "text-3xl md:text-4xl",
    "2xl": "text-4xl md:text-5xl"
  };

  const bodySizeMap: Record<string, string> = {
    sm: "text-xs md:text-sm",
    base: "text-sm md:text-base",
    lg: "text-base md:text-lg",
    xl: "text-lg md:text-xl",
    "2xl": "text-xl md:text-2xl"
  };
  
  const { isPlaying, speak, stop } = useTTS();
  
  const [bibleTranslation, setBibleTranslation] = useState(() => safeStorage.getItem("bible_translation") || "NIV");
  const [verse, setVerse] = useState<{ reference: string; text: string; translatedText?: string; reflection: string; translatedReflection?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteCategory, setNoteCategory] = useState("Daily Reflection");
  const [savedNoteSuccess, setSavedNoteSuccess] = useState(false);

  // YouVersion Platform Core SDK Custom Explorer states
  const [customRef, setCustomRef] = useState("Philippians 4:8");
  const [customVersion, setCustomVersion] = useState("NIV");
  const [customResult, setCustomResult] = useState<{ reference: string; text: string; version: string } | null>(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // Clean fetch call to our new YouVersion server endpoint
  const fetchCustomScripture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRef.trim()) return;
    setCustomLoading(true);
    setCustomError(null);
    setCustomResult(null);

    try {
      const url = `/api/bible-verse?versionId=${encodeURIComponent(customVersion)}&reference=${encodeURIComponent(customRef)}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to retrieve scripture (Status: ${response.status})`);
      }
      const data = await response.json();
      setCustomResult(data);
    } catch (err: any) {
      setCustomError(err.message || "Failed to load scripture from YouVersion");
    } finally {
      setCustomLoading(false);
    }
  };

  const fetchDailyVerseData = async () => {
    setLoading(true);
    setError(null);
    setVerse(null);
    try {
      const data = await fetchDailyVerse(language, bibleTranslation);
      setVerse(data);
      incrementStreak();
    } catch (err: any) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    stop();
    fetchDailyVerseData();
  }, [language, bibleTranslation]);

  const handleFavoriteToggle = async () => {
    if (!verse) return;
    const isSaved = isBookmarked(verse.reference);
    if (isSaved) {
      const existing = favorites.find(f => f.reference === verse.reference);
      if (existing) await removeFavorite(existing.id);
    } else {
      await addFavorite(verse.reference, verse.text, "Daily Devotional");
    }
  };

  const handleCloudBookmarkToggle = async () => {
    if (!verse) return;
    await toggleBookmark(verse.reference, verse.text);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verse || !noteContent.trim()) return;
    await saveNote(verse.reference, noteContent, noteCategory);
    setSavedNoteSuccess(true);
    setNoteContent("");
    setTimeout(() => {
      setSavedNoteSuccess(false);
      setShowNoteInput(false);
    }, 2000);
  };

  const handleTTSToggle = () => {
    if (!verse) return;
    if (isPlaying) {
      stop();
    } else {
      const verseText = (language && language.toLowerCase() !== "english" && verse.translatedText) ? verse.translatedText : verse.text;
      const reflectionText = (language && language.toLowerCase() !== "english" && verse.translatedReflection) ? verse.translatedReflection : verse.reflection;
      const combinedText = `${verseText}. ${verse.reference}. ${reflectionText}`;
      speak(combinedText, language);
    }
  };

  const translations = [
    "KJV", "NKJV", "ASV", "NASB", "NIV", "ESV", "NLT", "CSB", "RSV", "NRSV", "WEB"
  ];

  return (
    <div className="w-full max-w-3xl mx-auto py-4 px-0 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-serif tracking-tight text-brand-700 dark:text-brand-200">
            {translate("daily_scrip_refl", language)}
          </h2>
          <p className="text-xs text-charcoal-605 dark:text-charcoal-405 mt-0.5">
            {translate("centering_spirit", language)}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={bibleTranslation}
            onChange={(e) => {
              const val = e.target.value;
              setBibleTranslation(val);
              safeStorage.setItem("bible_translation", val);
            }}
            className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 text-charcoal-700 dark:text-linen-200 rounded-xl px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-brand-500 focus:outline-none font-sans font-medium"
          >
            {translations.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            onClick={fetchDailyVerseData}
            disabled={loading}
            className="p-2 transition-transform active:scale-95 duration-200 text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/40 rounded-full cursor-pointer"
            title={translate("refresh_verse", language)}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center p-16 space-y-4 bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-850 rounded-3xl shadow-xs"
          >
            <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            <p className="text-xs font-sans text-charcoal-600 dark:text-charcoal-405">
              {translate("receiving_nourishment", language)}
            </p>
          </motion.div>
        ) : error ? (
          <motion.div 
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/30 rounded-2xl p-6 text-center space-y-3"
          >
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <h3 className="font-semibold text-red-800 dark:text-red-400">{translate("unable_fetch_verse", language)}</h3>
            <p className="text-sm text-red-600 dark:text-red-500">{error}</p>
            <button
              onClick={fetchDailyVerseData}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition cursor-pointer"
            >
              {translate("retry_connection", language)}
            </button>
          </motion.div>
        ) : verse ? (
          <motion.div 
            key="content"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <div className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-3xl shadow-xs overflow-hidden p-6 md:p-8 relative">
              <div className="absolute top-4 right-4 flex items-center space-x-1">
                <button
                  onClick={handleTTSToggle}
                  className={`p-2 transition-all rounded-full cursor-pointer ${
                    isPlaying 
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 animate-pulse" 
                      : "text-charcoal-400 dark:text-charcoal-650 hover:bg-linen-100 dark:hover:bg-charcoal-800 hover:text-charcoal-750 dark:hover:text-linen-100"
                  }`}
                  title={isPlaying ? translate("stop", language) : translate("listen", language)}
                >
                  {isPlaying ? (
                    <Square className="w-5 h-5 fill-current" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>

                <button
                  onClick={handleCloudBookmarkToggle}
                  className="p-2 transition-transform active:scale-90 hover:bg-linen-100 dark:hover:bg-charcoal-800 rounded-full text-charcoal-400 dark:text-charcoal-650 hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer"
                  title={isVerseBookmarked(verse.reference) ? translate("remove_cloud_bookmark", language) : translate("save_cloud_bookmark", language)}
                >
                  <Bookmark className={`w-5 h-5 ${isVerseBookmarked(verse.reference) ? "text-brand-600 fill-brand-600" : ""}`} />
                </button>

                <button
                  onClick={handleFavoriteToggle}
                  className="p-2 transition-transform active:scale-90 hover:bg-linen-100 dark:hover:bg-charcoal-800 rounded-full text-charcoal-400 dark:text-charcoal-650 hover:text-red-500 dark:hover:text-red-400 cursor-pointer"
                  title={isBookmarked(verse.reference) ? translate("remove_favorite", language) : translate("save_favorites", language)}
                >
                  <Heart className={`w-5 h-5 ${isBookmarked(verse.reference) ? "text-red-500 fill-red-500" : ""}`} />
                </button>

                <button
                  onClick={() => setShowNoteInput(!showNoteInput)}
                  className={`p-2 transition-all rounded-full cursor-pointer ${
                    showNoteInput 
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" 
                      : "text-charcoal-400 dark:text-charcoal-650 hover:bg-linen-100 dark:hover:bg-charcoal-800 hover:text-charcoal-750 dark:hover:text-linen-100"
                  }`}
                  title={translate("add_personal_note", language)}
                >
                  <FileText className="w-5 h-5" />
                </button>
              </div>

              <div className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest text-clay-700 dark:text-clay-300 bg-clay-500/10 px-3 py-1 rounded-full mb-6 select-none">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {translate("verse_of_day", language)}
              </div>

              <div className="space-y-6">
                <blockquote className={`font-serif text-brand-700 dark:text-linen-100 leading-relaxed italic pr-6 select-text whitespace-pre-line ${scriptureSizeMap[textSize] || "text-xl md:text-2xl"}`}>
                  “{(language && language.toLowerCase() !== "english" && verse.translatedText) ? verse.translatedText : verse.text}”
                </blockquote>
                <p className="text-right text-base font-serif font-semibold text-brand-600 dark:text-brand-300 select-text">
                  — {verse.reference}
                </p>
              </div>
            </div>

            {/* Inline Personal note composer */}
            <AnimatePresence>
              {showNoteInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-linen-50 dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-2xl p-6 space-y-4">
                    <h4 className="text-sm font-semibold text-charcoal-700 dark:text-linen-200">
                      {translate("write_note_for", language)} {verse.reference}
                    </h4>
                    {savedNoteSuccess ? (
                      <div className="text-center py-4 text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                        {translate("note_saved_success", language)}
                      </div>
                    ) : (
                      <form onSubmit={handleSaveNote} className="space-y-3">
                        <textarea
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder={translate("what_is_god_speaking", language)}
                          className="w-full p-3 h-24 text-sm bg-white dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-800 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none dark:text-linen-100 placeholder-charcoal-400"
                        />
                        <div className="flex justify-between items-center">
                          <select
                            value={noteCategory}
                            onChange={(e) => setNoteCategory(e.target.value)}
                            className="bg-white dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-800 rounded-lg p-1.5 text-xs text-charcoal-700 dark:text-linen-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="Daily Reflection">{translate("daily_reflection", language)}</option>
                            <option value="Personal Study">{translate("personal_study", language)}</option>
                            <option value="Sermon Notes">{translate("sermon_notes", language)}</option>
                            <option value="Spiritual Lesson">{translate("spiritual_lesson", language)}</option>
                          </select>
                          <div className="flex space-x-2">
                            <button
                              type="button"
                              onClick={() => setShowNoteInput(false)}
                              className="px-3 py-1.5 text-xs text-charcoal-500 dark:text-charcoal-400 hover:bg-linen-200 dark:hover:bg-charcoal-800 rounded-lg cursor-pointer"
                            >
                              {translate("cancel", language)}
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-1.5 text-xs bg-brand-600 active:scale-95 duration-100 hover:bg-brand-700 text-white rounded-lg cursor-pointer"
                            >
                              {translate("save_note", language)}
                            </button>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Devotional Reflection block */}
            <div className="bg-linen-50 dark:bg-charcoal-900/60 p-6 rounded-3xl border-l-4 border-brand-500 border border-linen-300 dark:border-charcoal-800 space-y-3">
              <div className="flex items-center space-x-2 text-brand-750 dark:text-brand-300">
                <Sparkles className="w-5 h-5 text-brand-600" />
                <h3 className="font-semibold text-lg font-serif">{translate("devotional_reflection_title", language)}</h3>
              </div>
              <p className={`text-charcoal-750 dark:text-charcoal-200 leading-relaxed font-sans select-text whitespace-pre-line ${bodySizeMap[textSize] || "text-sm md:text-base"}`}>
                {(language && language.toLowerCase() !== "english" && verse.translatedReflection) ? verse.translatedReflection : verse.reflection}
              </p>
            </div>

            {/* YouVersion Platform Core SDK Explorer */}
            <div className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-3xl p-6 md:p-8 shadow-xs space-y-5">
              <div>
                <h3 className="text-lg font-bold font-serif text-brand-700 dark:text-brand-200 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-600" />
                  YouVersion SDK Scripture Explorer
                </h3>
                <p className="text-xs text-charcoal-500 dark:text-charcoal-405 mt-1">
                  Directly fetch and explore any scripture reference from the YouVersion Platform Core SDK API via our backend.
                </p>
              </div>

              <form onSubmit={fetchCustomScripture} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-charcoal-500 dark:text-charcoal-405 mb-1.5">
                    Scripture Reference
                  </label>
                  <input
                    type="text"
                    value={customRef}
                    onChange={(e) => setCustomRef(e.target.value)}
                    placeholder="e.g. Philippians 4:8, Genesis 1:1"
                    className="w-full px-3.5 py-2 text-sm bg-linen-50 dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-800 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none dark:text-linen-100 placeholder-charcoal-405 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-charcoal-500 dark:text-charcoal-405 mb-1.5">
                    Bible Version
                  </label>
                  <select
                    value={customVersion}
                    onChange={(e) => setCustomVersion(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-linen-50 dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-800 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none dark:text-linen-100 font-medium"
                  >
                    {translations.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-3 pt-1">
                  <button
                    type="submit"
                    disabled={customLoading}
                    className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-98 transition duration-150 text-white font-semibold rounded-xl text-xs tracking-wider uppercase disabled:opacity-55 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {customLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        Querying YouVersion BibleClient...
                      </>
                    ) : (
                      "Fetch Passages"
                    )}
                  </button>
                </div>
              </form>

              <AnimatePresence mode="wait">
                {customError && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-2xl text-xs font-sans"
                  >
                    {customError}
                  </motion.div>
                )}

                {customResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-linen-50 dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-850 rounded-2xl space-y-3"
                  >
                    <blockquote className="font-serif text-brand-750 dark:text-linen-100 leading-relaxed italic text-sm md:text-base select-text">
                      “{customResult.text}”
                    </blockquote>
                    <p className="text-right text-xs font-serif font-bold text-brand-600 dark:text-brand-300 select-text">
                      — {customResult.reference} ({customResult.version})
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
