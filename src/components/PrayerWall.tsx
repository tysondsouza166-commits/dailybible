import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { createPrayerRequest, addPrayerSupport, subscribeToPrayerWall, PrayerRequest } from "../lib/firebase";
import { Heart, Sparkles, Send, ShieldAlert, CheckCircle, Flame, Clock, User, HelpCircle, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const PrayerWall: React.FC = () => {
  const { user, language } = useApp();
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [inputText, setInputText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Subscribe to Prayer Wall requests
  useEffect(() => {
    const unsubscribe = subscribeToPrayerWall((data) => {
      setRequests(data);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inputText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      await createPrayerRequest(user.uid, inputText.trim(), isAnonymous);
      setInputText("");
      setIsAnonymous(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("Failed to share prayer request:", err);
      setError(
        language === "Spanish"
          ? "No se pudo publicar tu petición de oración."
          : "Failed to publish your prayer request."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupport = async (requestId: string) => {
    if (!user) return;
    try {
      await addPrayerSupport(requestId, user.uid);
    } catch (err) {
      console.error("Failed to add prayer support:", err);
    }
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "";
    let date: Date;
    if (typeof dateValue === "number") {
      date = new Date(dateValue);
    } else if (dateValue?.toDate) {
      date = dateValue.toDate();
    } else {
      date = new Date(dateValue);
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);

    if (diffMins < 1) {
      return language === "Spanish" ? "Ahora mismo" : "Just now";
    }
    if (diffMins < 60) {
      return language === "Spanish" ? `Hace ${diffMins} min` : `${diffMins}m ago`;
    }
    if (diffHrs < 24) {
      return language === "Spanish" ? `Hace ${diffHrs} h` : `${diffHrs}h ago`;
    }
    
    return date.toLocaleDateString(language === "Spanish" ? "es-ES" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80";

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Premium Header Accent Card */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-brand-600 to-brand-800 text-white p-6 md:p-8 shadow-xs">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5 text-brand-200" />
            <span>{language === "Spanish" ? "Muro de Fe" : "Real-time Wall of Faith"}</span>
          </div>
          <h2 className="text-xl md:text-3xl font-bold font-sans tracking-tight">
            {language === "Spanish" ? "Muro Global de Oración" : "Global Prayer Wall"}
          </h2>
          <p className="text-xs md:text-sm text-brand-100 max-w-xl leading-relaxed">
            {language === "Spanish"
              ? "Lleva las cargas de los demás y cumple la ley de Cristo. Publica tus peticiones de manera pública o anónima y únete en intercesión por tus hermanos."
              : "Bear one another's burdens, and so fulfill the law of Christ. Share your prayer requests publicly or anonymously, and join in continuous intercession."}
          </p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-12 translate-x-12 blur-2xl pointer-events-none" />
      </div>

      {/* Share Prayer Request Form */}
      <div className="p-6 bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-850 rounded-3xl shadow-2xs">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-charcoal-700 dark:text-linen-300 font-sans tracking-wide uppercase">
              {language === "Spanish" ? "¿Por qué podemos orar hoy?" : "How can we lift you in prayer today?"}
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                language === "Spanish"
                  ? "Escribe tu petición aquí... (Ej: 'Pido oración por sanidad y paz en mi hogar...')"
                  : "Write your request here... (e.g., 'Please pray for peace, healing, and guidance in my family...')"
              }
              maxLength={400}
              rows={3}
              required
              className="w-full bg-linen-50 dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-charcoal-800 dark:text-linen-100 transition-colors placeholder:text-charcoal-400 dark:placeholder:text-charcoal-600 resize-none font-sans"
            />
            <div className="flex justify-end">
              <span className="text-[10px] font-mono text-charcoal-500">
                {inputText.length}/400
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-linen-100 dark:border-charcoal-850">
            {/* Anonymous toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-linen-200 dark:bg-charcoal-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600 relative transition-colors" />
              <div className="flex items-center gap-1 text-xs font-semibold text-charcoal-700 dark:text-linen-300">
                <EyeOff className="w-3.5 h-3.5" />
                <span>{language === "Spanish" ? "Publicar Anónimamente" : "Post Anonymously"}</span>
              </div>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !inputText.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:hover:bg-brand-600 text-white rounded-xl shadow-xs text-xs font-bold transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? language === "Spanish" ? "Enviando..." : "Submitting..."
                  : language === "Spanish" ? "Compartir Petición" : "Share Prayer"}
              </span>
            </button>
          </div>
        </form>

        {/* Feedback Messages */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 rounded-xl flex items-center gap-2 text-xs"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl flex items-center gap-2 text-xs"
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>
                {language === "Spanish"
                  ? "¡Petición compartida exitosamente! La comunidad está orando por ti."
                  : "Prayer request shared successfully! The community is joining you in faith."}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Prayer Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-charcoal-700 dark:text-linen-300 font-sans uppercase tracking-wide">
            {language === "Spanish" ? "Peticiones Recientes" : "Recent Requests"}
          </h3>
          <span className="text-[10px] font-mono px-2 py-1 bg-linen-100 dark:bg-charcoal-900 border border-linen-200 dark:border-charcoal-800 text-charcoal-600 dark:text-charcoal-400 rounded-full">
            {requests.length} {language === "Spanish" ? "peticiones" : "requests"}
          </span>
        </div>

        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {requests.map((req) => {
              const hasSupported = user ? req.prayedBy.includes(user.uid) : false;
              
              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-5 bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-850 rounded-3xl shadow-2xs space-y-4 transition-all hover:border-linen-400 dark:hover:border-charcoal-800"
                >
                  {/* User Profile Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={req.isAnonymous ? "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80" : (req.userAvatar || defaultAvatar)}
                        alt={req.isAnonymous ? "Anonymous" : (req.userName || "Believer")}
                        className={`w-9 h-9 rounded-full object-cover border ${
                          req.isAnonymous
                            ? "border-linen-300 dark:border-charcoal-800 opacity-60 grayscale"
                            : "border-brand-100 dark:border-brand-900/50"
                        }`}
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-charcoal-800 dark:text-linen-100 font-sans">
                          {req.isAnonymous
                            ? language === "Spanish" ? "Peregrino Anónimo" : "Anonymous Pilgrim"
                            : (req.userName || "Faith Pilgrim")}
                        </h4>
                        <div className="flex items-center gap-1 text-[10px] text-charcoal-500">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(req.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {req.isAnonymous && (
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-charcoal-50 dark:bg-charcoal-950/40 text-charcoal-600 dark:text-charcoal-400 border border-linen-100 dark:border-charcoal-800 rounded-md">
                        {language === "Spanish" ? "ANÓNIMO" : "ANONYMOUS"}
                      </span>
                    )}
                  </div>

                  {/* Prayer Request Body text */}
                  <p className="text-sm text-charcoal-800 dark:text-linen-100 leading-relaxed font-sans whitespace-pre-wrap">
                    {req.text}
                  </p>

                  {/* Intercession Action Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-linen-100 dark:border-charcoal-850/60">
                    <button
                      onClick={() => handleSupport(req.id)}
                      disabled={hasSupported}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        hasSupported
                          ? "bg-brand-50 border border-brand-200 text-brand-600 dark:bg-brand-950/20 dark:border-brand-900/40 dark:text-brand-400 scale-[0.98]"
                          : "bg-white hover:bg-linen-50 dark:bg-charcoal-900 dark:hover:bg-charcoal-850 border border-linen-300 dark:border-charcoal-800 text-charcoal-700 dark:text-linen-300 active:scale-95"
                      }`}
                    >
                      <span className={hasSupported ? "animate-bounce" : ""}>🙏</span>
                      <span>
                        {hasSupported
                          ? language === "Spanish" ? "¡Orando!" : "Praying!"
                          : language === "Spanish" ? "Unirme en Oración" : "Join in Prayer"}
                      </span>
                    </button>

                    {/* Support counters */}
                    <div className="flex items-center gap-1 text-xs text-charcoal-500 dark:text-charcoal-400 font-mono">
                      <span className="font-bold text-brand-600 dark:text-brand-400">
                        {req.prayedBy.length}
                      </span>
                      <span>
                        {req.prayedBy.length === 1
                          ? language === "Spanish" ? "intercesor" : "intercessor"
                          : language === "Spanish" ? "intercesores" : "intercessors"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
