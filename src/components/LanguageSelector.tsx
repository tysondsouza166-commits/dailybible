import React, { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../context/AppContext";

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const standardLanguages = [
    "English",
    "Tagalog",
    "Portuguese",
    "French",
    "Konkani (Goan - Roman Script)",
    "Konkani (Mangalorean - Kannada Script)"
  ];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = async (lang: string) => {
    setIsChanging(true);
    try {
      // Yield to the paint loop so loading spinner renders instantly
      await new Promise((resolve) => setTimeout(resolve, 50));
      setLanguage(lang);
      setIsOpen(false);
    } catch (err) {
      console.error("[LanguageSelector] Failed to update language:", err);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Selector trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isChanging}
        className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 dark:bg-charcoal-850 dark:hover:bg-charcoal-800 text-brand-700 dark:text-brand-300 rounded-full transition duration-150 cursor-pointer text-xs font-bold font-sans border border-brand-200/50 dark:border-charcoal-700 disabled:opacity-60"
        title="Select Bible Study Language"
      >
        {isChanging ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />
        ) : (
          <Globe className="w-3.5 h-3.5 text-brand-500" />
        )}
        <span className="hidden sm:inline-block max-w-[120px] truncate">{language}</span>
        <ChevronDown className={`w-3 h-3 text-brand-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-3 border-b border-linen-200 dark:border-charcoal-800 bg-linen-50/50 dark:bg-charcoal-950/30">
              <p className="text-[10px] font-bold text-charcoal-450 dark:text-charcoal-400 uppercase tracking-wider font-sans">
                Select Language
              </p>
            </div>

            {/* Language list */}
            <div className="p-1.5 space-y-0.5">
              {standardLanguages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleSelect(lang)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl text-left transition ${
                    language.toLowerCase() === lang.toLowerCase()
                      ? "bg-brand-500 text-white"
                      : "text-charcoal-700 hover:bg-linen-100 dark:text-linen-300 dark:hover:bg-charcoal-800"
                  }`}
                >
                  <span>{lang}</span>
                  {language.toLowerCase() === lang.toLowerCase() && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
