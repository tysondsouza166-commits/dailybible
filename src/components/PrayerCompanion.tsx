import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { Heart, Activity, CheckCircle, Trash2, Calendar, Sparkles, HelpCircle, Save, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getPrayerReflection } from "../lib/geminiClient";
import { translate } from "../lib/translations";

export const PrayerCompanion: React.FC = () => {
  const { prayers, addPrayer, togglePrayerAnswered, deletePrayer, language } = useApp();
  const [request, setRequest] = useState("");
  const [generatedPrayer, setGeneratedPrayer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGeneratePrayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request.trim()) return;

    setLoading(true);
    setError(null);
    setGeneratedPrayer("");

    try {
      const prayer = await getPrayerReflection(request, language);
      setGeneratedPrayer(prayer);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToHistory = async () => {
    if (!request.trim() || !generatedPrayer) return;
    await addPrayer(request, generatedPrayer);
    setRequest("");
    setGeneratedPrayer("");
  };

  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-4 px-0">
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-serif tracking-tight text-brand-700 dark:text-brand-200 flex items-center space-x-2">
          <span>{translate("prayer_companion_journal", language)}</span>
        </h2>
        <p className="text-sm text-charcoal-600 dark:text-charcoal-400">
          {translate("prayer_companion_desc", language)}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column: Entry & companion */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-3xl p-6 shadow-xs">
            <h3 className="text-lg font-serif font-bold text-brand-700 dark:text-brand-200 mb-4 flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-brand-505" />
              <span>{translate("personalized_request", language)}</span>
            </h3>

            <form onSubmit={handleGeneratePrayer} className="space-y-4">
              <div>
                <textarea
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  placeholder={translate("prayer_placeholder", language)}
                  className="w-full p-3.5 text-sm bg-[#faf8f5] dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-800 rounded-xl focus:ring-1 focus:ring-brand-500 focus:outline-none dark:text-linen-100 h-24 placeholder-charcoal-400 resize-none font-sans"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-95 duration-100 text-white font-medium text-xs md:text-sm rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
                >
                  {loading && <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin mr-1" />}
                  <span>{translate("generate_prayer", language)}</span>
                </button>
              </div>
            </form>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl flex items-center space-x-3 text-red-700 dark:text-red-400"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-xs font-sans">{error}</p>
              </motion.div>
            )}

            {generatedPrayer && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-500/5 dark:bg-brand-950/10 border border-brand-500/10 dark:border-brand-505/20 rounded-3xl p-6 md:p-8 space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-brand-700 dark:text-brand-300">
                    <Sparkles className="w-5 h-5" />
                    <h4 className="font-serif font-bold text-lg">{translate("prepared_prayer", language)}</h4>
                  </div>
                  <button
                    onClick={handleSaveToHistory}
                    className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                    title={translate("save_to_journal", language)}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{translate("save_to_journal", language)}</span>
                  </button>
                </div>

                <div className="space-y-4 text-[#3c3a35] dark:text-linen-100 leading-relaxed font-serif text-base select-text whitespace-pre-line border-l-2 border-brand-500/30 pl-4 py-1 italic">
                  {generatedPrayer}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right column: Prayer logs */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#faf8f5] dark:bg-charcoal-900/40 border border-linen-300 dark:border-charcoal-800/80 rounded-3xl p-6 min-h-[350px] flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-serif font-bold text-brand-700 dark:text-brand-200 mb-4 flex items-center space-x-2">
                <Heart className="w-5 h-5 text-brand-505" />
                <span>{translate("my_prayer_journal", language)}</span>
              </h3>

              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                {prayers.length > 0 ? (
                  prayers.map((p, pIdx) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: pIdx * 0.05 }}
                      className={`p-4 rounded-2xl border transition-all ${
                        p.answered 
                          ? "bg-brand-500/5 dark:bg-brand-900/10 border-brand-205/40" 
                          : "bg-white dark:bg-charcoal-950 border-linen-300 dark:border-charcoal-850"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] text-charcoal-600 flex items-center font-sans">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(p.createdAt)}
                        </span>
                        <div className="flex space-x-1 items-center">
                          <button
                            onClick={() => togglePrayerAnswered(p.id)}
                            className={`p-1 rounded-md transition cursor-pointer ${
                              p.answered 
                                ? "text-brand-600 hover:text-brand-700 bg-brand-50 dark:bg-brand-950/20" 
                                : "text-charcoal-400 hover:text-brand-500 hover:bg-linen-100 dark:hover:bg-charcoal-800"
                            }`}
                            title={p.answered ? translate("mark_pending", language) : translate("mark_answered", language)}
                          >
                            <CheckCircle className={`w-4 h-4 ${p.answered ? "fill-brand-600 text-white" : ""}`} />
                          </button>
                          <button
                            onClick={() => deletePrayer(p.id)}
                            className="p-1 text-charcoal-405 hover:text-red-500 dark:hover:text-red-400 rounded-md transition cursor-pointer"
                            title={translate("delete_record", language)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs font-semibold text-charcoal-750 dark:text-linen-100 line-clamp-2 italic mb-1 font-serif select-text">
                        "{p.request}"
                      </p>

                      {p.answered && (
                        <span className="inline-flex items-center text-[9px] font-bold tracking-wide uppercase text-brand-700 bg-brand-50 dark:text-brand-300 dark:bg-brand-900/20 px-2 py-0.5 rounded-full mt-1.5 animate-pulse">
                          {translate("answered_prayer_badge", language)}
                        </span>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-16 text-charcoal-600 dark:text-charcoal-400 space-y-2">
                    <HelpCircle className="w-8 h-8 mx-auto stroke-1 text-charcoal-400 dark:text-charcoal-700" />
                    <p className="text-xs font-sans">{translate("prayer_journal_empty", language)}</p>
                  </div>
                )}
              </div>
            </div>

            {prayers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-linen-300 dark:border-charcoal-800 text-center">
                <p className="text-[10px] text-charcoal-600 dark:text-charcoal-400 font-sans">
                  {prayers.filter(p => p.answered).length} / {prayers.length} {translate("answered_testimonies", language)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
