import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { Calendar, Heart, BookOpen, PenTool, CheckCircle, Flame, LogOut, Copy, Trash2, ArrowUpRight, Lightbulb, ClipboardList, Bookmark, Settings, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { translate } from "../lib/translations";

export const UserDashboard: React.FC = () => {
  const { 
    user, 
    logout, 
    streak, 
    favorites, 
    removeFavorite,
    notes,
    deleteNote,
    saveNote,
    prayers,
    recentStudies,
    bookmarks,
    toggleBookmark,
    language,
    textSize,
    setTextSize
  } = useApp();

  const textSizes = ["sm", "base", "lg", "xl", "2xl"];

  const handleDecreaseTextSize = () => {
    const currentIndex = textSizes.indexOf(textSize);
    if (currentIndex > 0) {
      setTextSize(textSizes[currentIndex - 1]);
    }
  };

  const handleIncreaseTextSize = () => {
    const currentIndex = textSizes.indexOf(textSize);
    if (currentIndex < textSizes.length - 1) {
      setTextSize(textSizes[currentIndex + 1]);
    }
  };

  const [activeTab, setActiveTab] = useState<"streak" | "favorites" | "bookmarks" | "notes" | "studies" | "preferences">("streak");
  const [copiedStatus, setCopiedStatus] = useState<{ [key: string]: boolean }>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");

  // Preferences state
  const [ageRange, setAgeRange] = useState<string>(() => localStorage.getItem("fg_pref_age_range") || "Not Set");
  const [denomination, setDenomination] = useState<string>(() => localStorage.getItem("fg_pref_denomination") || "Not Set");
  const [isAgeModalOpen, setIsAgeModalOpen] = useState(false);
  const [isDenomModalOpen, setIsDenomModalOpen] = useState(false);

  // Temporary modal states
  const [tempAgeRange, setTempAgeRange] = useState<string>("");
  const [tempDenomination, setTempDenomination] = useState<string>("");

  const ageOptions = ["13-17", "18-24", "25-34", "35-44", "45-54", "55+"];
  const denomOptions = [
    "Catholic", 
    "Protestant", 
    "Orthodox", 
    "Non-Denominational", 
    "Anglican", 
    "Baptist", 
    "Methodist", 
    "Lutheran", 
    "Presbyterian", 
    "Other"
  ];

  const handleOpenAgeModal = () => {
    setTempAgeRange(ageRange === "Not Set" ? "18-24" : ageRange);
    setIsAgeModalOpen(true);
  };

  const handleOpenDenomModal = () => {
    setTempDenomination(denomination === "Not Set" ? "Catholic" : denomination);
    setIsDenomModalOpen(true);
  };

  const handleSaveAge = () => {
    setAgeRange(tempAgeRange);
    localStorage.setItem("fg_pref_age_range", tempAgeRange);
    setIsAgeModalOpen(false);
  };

  const handleSaveDenom = () => {
    setDenomination(tempDenomination);
    localStorage.setItem("fg_pref_denomination", tempDenomination);
    setIsDenomModalOpen(false);
  };

  const handleCopyQuote = (text: string, ref: string) => {
    navigator.clipboard.writeText(`“${text}” — ${ref}`);
    setCopiedStatus(prev => ({ ...prev, [ref]: true }));
    setTimeout(() => {
      setCopiedStatus(prev => ({ ...prev, [ref]: false }));
    }, 2000);
  };

  const handleStartEditNote = (note: any) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
  };

  const handleSaveEditNote = async (note: any) => {
    await saveNote(note.reference, editingNoteContent, note.category);
    setEditingNoteId(null);
  };

  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  // Streaks dynamic title text
  const getStreakBadge = (count: number, lang: string) => {
    const badges: { [lang: string]: { [key: string]: string } } = {
      en: {
        anchor: "Devout Anchor",
        champion: "Scripture Champion",
        walker: "Faithful Walker",
        pilgrim: "New Pilgrim"
      },
      es: {
        anchor: "Ancla Devota",
        champion: "Campeón de la Escritura",
        walker: "Caminante Fiel",
        pilgrim: "Nuevo Peregrino"
      },
      pt: {
        anchor: "Âncora Devota",
        champion: "Campeão das Escrituras",
        walker: "Caminhante Fiel",
        pilgrim: "Novo Peregrino"
      },
      fr: {
        anchor: "Ancre Dévote",
        champion: "Champion des Écritures",
        walker: "Marcheur Fidèle",
        pilgrim: "Nouveau Pèlerin"
      },
      tl: {
        anchor: "Madasubaybay na Angkla",
        champion: "Kampeon ng Kasulatan",
        walker: "Tapat na Lakbay",
        pilgrim: "Bagong Pilgrim"
      }
    };
    const langKey = badges[lang] ? lang : "en";
    const set = badges[langKey];
    if (count >= 15) return set.anchor;
    if (count >= 7) return set.champion;
    if (count >= 3) return set.walker;
    return set.pilgrim;
  };

  const getMetricDesc = (labelKey: string, lang: string) => {
    const descs: { [lang: string]: { [key: string]: string } } = {
      en: {
        streak: "Consecutive Days Active",
        favs: "Saved References",
        bookmarks: "Secure Cloud Sync",
        notes: "Personal Insights",
        prayers: "Answered Graces"
      },
      es: {
        streak: "Días Activos Consecutivos",
        favs: "Referencias Guardadas",
        bookmarks: "Sincronización Segura",
        notes: "Perspectivas Personales",
        prayers: "Gracias Contestadas"
      },
      pt: {
        streak: "Dias Ativos Consecutivos",
        favs: "Referências Salvas",
        bookmarks: "Sincronização Segura",
        notes: "Reflexões Pessoais",
        prayers: "Graças Respondidas"
      },
      fr: {
        streak: "Jours Actifs Consécutifs",
        favs: "Références Enregistrées",
        bookmarks: "Synchro Cloud Sécurisée",
        notes: "Réflexions Personnelles",
        prayers: "Grâces Exaucées"
      },
      tl: {
        streak: "Sunod-sunod na Araw na Aktibo",
        favs: "Mga Nai-save na Sanggunian",
        bookmarks: "Ligtas na Cloud Sync",
        notes: "Mga Personal na Kaisipan",
        prayers: "Mga Nasagot na Biyaya"
      }
    };
    const langKey = descs[lang] ? lang : "en";
    return descs[langKey][labelKey] || descs["en"][labelKey];
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-4 px-2 space-y-8">
      {/* User Card Header */}
      <div className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6 shadow-xs">
        <div className="flex items-center space-x-4">
          <img
            src={user?.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
            alt="Profile Avatar"
            className="w-14 h-14 rounded-full border-2 border-brand-500 flex-shrink-0 object-cover"
          />
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xl font-bold font-serif text-brand-700 dark:text-brand-200">
                {user?.displayName || translate("faith_pilgrim", language)}
              </h3>
              <span className="text-[10px] font-bold tracking-wider uppercase text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/10 px-2 py-0.5 rounded">
                {getStreakBadge(streak, language)}
              </span>
            </div>
            <p className="text-xs text-charcoal-600 dark:text-charcoal-405 mt-0.5 font-sans">
              {user?.email || "anonymous-believer@faithguide.app"}
            </p>
          </div>
        </div>

        <div className="flex space-x-2 w-full md:w-auto">
          <button
            onClick={logout}
            className="w-full md:w-auto px-4 py-2 border border-linen-350 dark:border-charcoal-800 rounded-xl hover:bg-[#faf8f5] dark:hover:bg-charcoal-850 hover:text-red-500 text-xs font-semibold text-charcoal-600 dark:text-linen-100 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{translate("sign_out", language)}</span>
          </button>
        </div>
      </div>

      {/* Metrics board */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: translate("streak_log", language), count: streak, desc: getMetricDesc("streak", language), icon: Flame, color: "text-[#d97706] bg-[#fef3c7]" },
          { label: translate("local_favorites", language), count: favorites.length, desc: getMetricDesc("favs", language), icon: Heart, color: "text-red-600 bg-red-500/10" },
          { label: translate("cloud_bookmarks", language), count: bookmarks.length, desc: getMetricDesc("bookmarks", language), icon: Bookmark, color: "text-brand-700 bg-brand-50" },
          { label: translate("journal_notes", language), count: notes.length, desc: getMetricDesc("notes", language), icon: PenTool, color: "text-brand-700 bg-brand-50" },
          { label: translate("answered_prayers", language), count: prayers.filter(p => p.answered).length, desc: getMetricDesc("prayers", language), icon: CheckCircle, color: "text-brand-600 bg-[#f0ede6]" }
        ].map((met) => {
          const Icon = met.icon;
          return (
            <div key={met.label} className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 p-4 rounded-2xl space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-charcoal-600 dark:text-charcoal-405 tracking-wider uppercase font-sans">
                  {met.label}
                </span>
                <div className={`p-1.5 rounded-lg ${met.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-serif font-bold text-brand-700 dark:text-brand-200">{met.count}</p>
              <p className="text-[10px] text-charcoal-600 dark:text-charcoal-405 font-sans">{met.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="space-y-6">
        <div className="border-b border-linen-300 dark:border-charcoal-850 flex flex-wrap md:flex-nowrap gap-4 md:space-x-6 pb-1">
          {[
            { id: "streak", label: translate("streak_log", language), icon: Flame },
            { id: "favorites", label: translate("local_favorites", language), icon: Heart },
            { id: "bookmarks", label: translate("cloud_bookmarks", language), icon: Bookmark },
            { id: "notes", label: translate("study_notebook", language), icon: PenTool },
            { id: "studies", label: translate("recent_summaries", language), icon: BookOpen },
            { id: "preferences", label: translate("preferences", language), icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-1.5 pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  isSelected
                    ? "border-brand-500 text-brand-600 dark:text-brand-300"
                    : "border-transparent text-[#7c786f] hover:text-charcoal-900 dark:text-charcoal-405 dark:hover:text-linen-100"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Panel renderer */}
        <div className="min-h-[250px]">
          <AnimatePresence mode="wait">
            {activeTab === "streak" && (
              <motion.div
                key="streak"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 p-6 rounded-3xl shadow-xs space-y-6 flex flex-col items-center text-center"
              >
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                    <Flame className="w-12 h-12 text-[#d97706] animate-pulse fill-[#d97706]" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-brand-500" />
                  </span>
                </div>

                <div className="max-w-md space-y-2">
                  <h4 className="text-xl font-serif font-bold text-brand-700 dark:text-brand-200">
                    {translate("streak_badge_active", language).replace("{streak}", streak.toString())}
                  </h4>
                  <p className="text-sm text-charcoal-750 dark:text-linen-200 leading-relaxed font-sans">
                    {translate("streak_badge_desc", language)}
                  </p>
                </div>

                <div className="bg-[#faf8f5] dark:bg-charcoal-950/40 border border-linen-300 dark:border-charcoal-800 p-4 rounded-2xl w-full max-w-sm text-left flex items-start space-x-3">
                  <Lightbulb className="w-5 h-5 text-brand-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-charcoal-700 dark:text-linen-300 font-sans uppercase tracking-wider">{translate("spiritual_goal_advice", language)}</h5>
                    <p className="text-xs text-[#7c786f] dark:text-charcoal-405 mt-1">
                      {translate("spiritual_goal_desc", language)}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "favorites" && (
              <motion.div
                key="favorites"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {favorites.length > 0 ? (
                  favorites.map((fav, fIdx) => (
                    <motion.div
                      key={fav.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: fIdx * 0.04 }}
                      className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-850 p-5 rounded-2xl hover:border-brand-550/40 relative flex flex-col justify-between transition-colors shadow-xs"
                    >
                      <div className="absolute top-4 right-4 flex space-x-1">
                        <button
                          onClick={() => handleCopyQuote(fav.text, fav.reference)}
                          className="p-1.5 text-charcoal-400 hover:text-brand-600 dark:hover:text-brand-400 transition rounded-md hover:bg-[#faf8f5] dark:hover:bg-charcoal-800 cursor-pointer"
                          title={translate("copy_quote", language)}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeFavorite(fav.id)}
                          className="p-1.5 text-charcoal-405 hover:text-red-500 dark:hover:text-red-400 transition rounded-md hover:bg-[#faf8f5] dark:hover:bg-charcoal-800 cursor-pointer"
                          title={translate("unbookmark", language)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-4 flex-grow mb-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-[9px] font-bold text-brand-700 bg-brand-50 dark:text-brand-300 dark:bg-brand-950/20 px-2 py-0.5 rounded uppercase">
                            {fav.category}
                          </span>
                          <span className="text-[9px] text-[#7c786f]">{formatDate(fav.savedAt)}</span>
                        </div>

                        <blockquote className="text-sm font-serif italic text-[#3c3a35] dark:text-linen-100 pr-12 line-clamp-4 leading-relaxed select-text">
                          “{fav.text}”
                        </blockquote>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-linen-100 dark:border-charcoal-800">
                        <p className="text-xs font-serif font-semibold text-brand-700 dark:text-brand-300">
                          {fav.reference}
                        </p>
                        {copiedStatus[fav.reference] && (
                          <span className="text-[10px] text-brand-650 dark:text-brand-300 font-bold font-sans animate-pulse">
                            {translate("quote_copied", language)}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full border border-dashed border-linen-300 dark:border-charcoal-800 p-12 text-center text-charcoal-600 dark:text-charcoal-400 rounded-2xl">
                    {translate("no_bookmarks_yet", language)}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "bookmarks" && (
              <motion.div
                key="bookmarks"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {bookmarks.length > 0 ? (
                  bookmarks.map((bmark, bIdx) => (
                    <motion.div
                      key={bmark.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: bIdx * 0.04 }}
                      className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-850 p-5 rounded-2xl hover:border-brand-550/40 relative flex flex-col justify-between transition-colors shadow-xs"
                    >
                      <div className="absolute top-4 right-4 flex space-x-1">
                        <button
                          onClick={() => handleCopyQuote(bmark.text, bmark.reference)}
                          className="p-1.5 text-charcoal-400 hover:text-brand-600 dark:hover:text-brand-400 transition rounded-md hover:bg-[#faf8f5] dark:hover:bg-charcoal-800 cursor-pointer"
                          title={translate("copy_quote", language)}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleBookmark(bmark.reference, bmark.text)}
                          className="p-1.5 text-charcoal-405 hover:text-red-500 dark:hover:text-red-400 transition rounded-md hover:bg-[#faf8f5] dark:hover:bg-charcoal-800 cursor-pointer"
                          title={translate("unbookmark_cloud", language)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-4 flex-grow mb-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-[9px] font-bold text-brand-700 bg-brand-50 dark:text-brand-300 dark:bg-brand-950/10 px-2 py-0.5 rounded uppercase flex items-center shadow-xs">
                            <Bookmark className="w-2.5 h-2.5 mr-1 fill-brand-700 dark:fill-brand-300" />
                            {translate("cloud_sync", language)}
                          </span>
                          <span className="text-[9px] text-[#7c786f]">{formatDate(bmark.savedAt)}</span>
                        </div>

                        <blockquote className="text-sm font-serif italic text-[#3c3a35] dark:text-linen-100 pr-12 line-clamp-4 leading-relaxed select-text">
                          “{bmark.text}”
                        </blockquote>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-linen-100 dark:border-charcoal-800">
                        <p className="text-xs font-serif font-semibold text-brand-700 dark:text-brand-300">
                          {bmark.reference}
                        </p>
                        {copiedStatus[bmark.reference] && (
                          <span className="text-[10px] text-brand-650 dark:text-brand-300 font-bold font-sans animate-pulse">
                            {translate("quote_copied", language)}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full border border-dashed border-linen-300 dark:border-charcoal-800 p-12 text-center text-charcoal-600 dark:text-charcoal-400 rounded-2xl space-y-2">
                    <Bookmark className="w-8 h-8 text-charcoal-300 dark:text-charcoal-700 mx-auto stroke-1" />
                    <h4 className="font-semibold text-charcoal-700 dark:text-charcoal-300">{translate("no_cloud_bookmarks", language)}</h4>
                    <p className="text-xs">
                      {translate("no_cloud_bookmarks_desc", language)}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "notes" && (
              <motion.div
                key="notes"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {notes.length > 0 ? (
                  notes.map((note, nIdx) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: nIdx * 0.05 }}
                      className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-850 p-6 rounded-2xl shadow-xs"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[9px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-950/20 dark:text-brand-300 px-2 py-0.5 rounded uppercase font-sans">
                              {note.category}
                            </span>
                            <span className="text-[9.5px] text-[#7c786f] font-sans">{formatDate(note.updatedAt)}</span>
                          </div>
                          <h4 className="text-sm font-serif font-bold text-brand-700 dark:text-brand-300 mt-1.5">
                            {note.reference}
                          </h4>
                        </div>

                        <div className="flex space-x-1">
                          {editingNoteId !== note.id && (
                            <button
                              onClick={() => handleStartEditNote(note)}
                              className="px-2.5 py-1 text-xs text-brand-700 hover:text-[#d97706] dark:text-brand-300 bg-[#faf8f5] hover:bg-linen-100 dark:bg-charcoal-950 rounded-lg transition cursor-pointer"
                            >
                              {translate("edit_note", language)}
                            </button>
                          )}
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="p-1.5 text-charcoal-405 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition hover:bg-[#faf8f5] dark:hover:bg-charcoal-950 cursor-pointer"
                            title={translate("delete_note_title", language)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {editingNoteId === note.id ? (
                        <div className="space-y-2 mt-2">
                          <textarea
                            value={editingNoteContent}
                            onChange={(e) => setEditingNoteContent(e.target.value)}
                            className="w-full p-3 text-xs bg-[#faf8f5] dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-800 rounded-xl text-charcoal-900 dark:text-linen-100 focus:outline-none focus:ring-1 focus:ring-brand-500 h-20 resize-none font-sans"
                          />
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => setEditingNoteId(null)}
                              className="px-2.5 py-1 text-[10px] font-semibold text-charcoal-500 hover:bg-linen-100 rounded-md transition cursor-pointer"
                            >
                              {translate("cancel_edit", language)}
                            </button>
                            <button
                              onClick={() => handleSaveEditNote(note)}
                              className="px-2.5 py-1 text-[10px] font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-md transition cursor-pointer"
                            >
                              {translate("save_notes", language)}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs md:text-sm text-charcoal-750 dark:text-linen-200 leading-relaxed font-sans select-text whitespace-pre-line">
                          {note.content}
                        </p>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <div className="border border-dashed border-linen-300 dark:border-charcoal-800 p-12 text-center text-charcoal-600 dark:text-charcoal-400 rounded-2xl">
                    {translate("no_journal_notes", language)}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "studies" && (
              <motion.div
                key="studies"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {recentStudies.length > 0 ? (
                  recentStudies.map((study, sIdx) => (
                    <motion.div
                      key={study.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: sIdx * 0.05 }}
                      className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-850 p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-start shadow-xs"
                    >
                      <div className="p-3 bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 rounded-xl flex-shrink-0">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div className="space-y-1.5 flex-grow">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-serif font-bold text-[#3c3a35] dark:text-linen-100">
                            {study.book} {translate("chapter", language)} {study.chapter}
                          </h4>
                          <span className="text-[10px] text-charcoal-405 font-sans">{formatDate(study.date)}</span>
                        </div>
                        <p className="text-xs md:text-sm text-charcoal-750 dark:text-charcoal-300 leading-relaxed max-w-2xl font-sans select-text line-clamp-3">
                          {study.summary}
                        </p>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="border border-dashed border-linen-300 dark:border-charcoal-800 p-12 text-center text-charcoal-600 dark:text-charcoal-400 rounded-2xl">
                    {translate("no_recent_summaries", language)}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "preferences" && (
              <motion.div
                key="preferences"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 p-6 rounded-3xl shadow-xs space-y-6"
              >
                <div>
                  <h4 className="text-lg font-serif font-bold text-brand-700 dark:text-brand-200 mb-1">
                    {translate("preferences", language)}
                  </h4>
                  <p className="text-xs text-charcoal-600 dark:text-charcoal-405 font-sans">
                    {translate("preferences_desc", language)}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Age selector preference trigger */}
                  <div className="bg-[#faf8f5] dark:bg-charcoal-950/40 border border-linen-300 dark:border-charcoal-800 p-5 rounded-2xl flex flex-col justify-between items-start space-y-3">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-2xl select-none" role="img" aria-label="cake">🎂</span>
                      <div>
                        <h5 className="text-xs font-bold text-charcoal-700 dark:text-linen-300 uppercase tracking-wider font-sans">{translate("age_range", language)}</h5>
                        <p className="text-sm font-semibold text-brand-700 dark:text-brand-300 mt-0.5">{ageRange}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleOpenAgeModal}
                      className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-full shadow-xs cursor-pointer active:scale-95 transition-all"
                    >
                      {translate("set_age_range", language)}
                    </button>
                  </div>

                  {/* Denomination selector preference trigger */}
                  <div className="bg-[#faf8f5] dark:bg-charcoal-950/40 border border-linen-300 dark:border-charcoal-800 p-5 rounded-2xl flex flex-col justify-between items-start space-y-3">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-2xl select-none" role="img" aria-label="church">⛪</span>
                      <div>
                        <h5 className="text-xs font-bold text-charcoal-700 dark:text-linen-300 uppercase tracking-wider font-sans">{translate("denomination", language)}</h5>
                        <p className="text-sm font-semibold text-brand-700 dark:text-brand-300 mt-0.5">{denomination}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleOpenDenomModal}
                      className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-full shadow-xs cursor-pointer active:scale-95 transition-all"
                    >
                      {translate("set_denomination", language)}
                    </button>
                  </div>

                  {/* Text Size preference controller */}
                  <div className="bg-[#faf8f5] dark:bg-charcoal-950/40 border border-linen-300 dark:border-charcoal-800 p-5 rounded-2xl flex flex-col justify-between items-start space-y-3 sm:col-span-2">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-2xl select-none" role="img" aria-label="text size">🔎</span>
                        <div>
                          <h5 className="text-xs font-bold text-charcoal-700 dark:text-linen-300 uppercase tracking-wider font-sans">
                            {translate("text_size", language)}
                          </h5>
                          <p className="text-xs text-charcoal-600 dark:text-charcoal-405 mt-0.5">
                            {translate("text_size_desc", language)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Interactive Controls */}
                      <div className="flex items-center space-x-2 bg-white dark:bg-charcoal-900 border border-linen-350 dark:border-charcoal-800 rounded-full p-1 shadow-xs">
                        <button
                          onClick={handleDecreaseTextSize}
                          disabled={textSize === "sm"}
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs cursor-pointer select-none transition-all ${
                            textSize === "sm"
                              ? "text-charcoal-300 dark:text-charcoal-700 cursor-not-allowed"
                              : "text-charcoal-700 dark:text-linen-100 hover:bg-linen-100 dark:hover:bg-charcoal-800"
                          }`}
                          title="Decrease text size"
                        >
                          A-
                        </button>
                        
                        <div className="px-3 text-xs font-bold font-mono text-brand-600 dark:text-brand-400 min-w-[70px] text-center capitalize">
                          {textSize === "sm" ? "Small" : textSize === "base" ? "Normal" : textSize === "lg" ? "Large" : textSize === "xl" ? "X-Large" : "XX-Large"}
                        </div>
                        
                        <button
                          onClick={handleIncreaseTextSize}
                          disabled={textSize === "2xl"}
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-base cursor-pointer select-none transition-all ${
                            textSize === "2xl"
                              ? "text-charcoal-300 dark:text-charcoal-700 cursor-not-allowed"
                              : "text-charcoal-700 dark:text-linen-100 hover:bg-linen-100 dark:hover:bg-charcoal-800"
                          }`}
                          title="Increase text size"
                        >
                          A+
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Preferences Modals */}
      <AnimatePresence>
        {isAgeModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-55 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-3xl p-6 w-full max-w-sm relative text-center space-y-4 shadow-xl"
            >
              <button 
                onClick={() => setIsAgeModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-[#faf8f5] dark:hover:bg-charcoal-850 rounded-full text-charcoal-400 dark:text-charcoal-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="text-5xl select-none animate-bounce" role="img" aria-label="cake">🎂</div>
              <h3 className="text-lg font-serif font-bold text-brand-700 dark:text-brand-200">{translate("select_age_range", language)}</h3>
              <p className="text-xs text-charcoal-600 dark:text-charcoal-400 font-sans max-w-xs mx-auto">
                {translate("age_range_desc", language)}
              </p>

              <div className="grid grid-cols-2 gap-2 pt-2">
                {ageOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setTempAgeRange(opt)}
                    className={`rounded-full border py-2 px-3 text-xs font-bold transition duration-150 cursor-pointer text-center ${
                      tempAgeRange === opt
                        ? "bg-brand-600 border-brand-600 text-white shadow-sm"
                        : "bg-white dark:bg-charcoal-950 border-linen-350 dark:border-charcoal-800 text-charcoal-700 dark:text-linen-200 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-charcoal-800"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              <button
                onClick={handleSaveAge}
                className="w-full mt-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-full transition cursor-pointer active:scale-95 shadow-md"
              >
                {translate("save", language)}
              </button>
            </motion.div>
          </div>
        )}

        {isDenomModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-55 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-3xl p-6 w-full max-w-md relative text-center space-y-4 shadow-xl"
            >
              <button 
                onClick={() => setIsDenomModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-[#faf8f5] dark:hover:bg-charcoal-850 rounded-full text-charcoal-400 dark:text-charcoal-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="text-5xl select-none" role="img" aria-label="church">⛪</div>
              <h3 className="text-lg font-serif font-bold text-brand-700 dark:text-brand-200">{translate("select_denomination", language)}</h3>
              <p className="text-xs text-charcoal-600 dark:text-charcoal-400 font-sans max-w-sm mx-auto">
                {translate("denom_desc", language)}
              </p>

              <div className="grid grid-cols-2 gap-2 pt-2">
                {denomOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setTempDenomination(opt)}
                    className={`rounded-full border py-2 px-3 text-xs font-bold transition duration-150 cursor-pointer text-center ${
                      tempDenomination === opt
                        ? "bg-brand-600 border-brand-600 text-white shadow-sm"
                        : "bg-white dark:bg-charcoal-950 border-linen-350 dark:border-charcoal-800 text-charcoal-700 dark:text-linen-200 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-charcoal-800"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              <button
                onClick={handleSaveDenom}
                className="w-full mt-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-full transition cursor-pointer active:scale-95 shadow-md"
              >
                {translate("save", language)}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
