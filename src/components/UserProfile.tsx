import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { saveUserProfile, getUserProfile, isFirebaseActive } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import { 
  User, 
  Edit2, 
  Check, 
  X, 
  Sparkles, 
  BookOpen, 
  Flame, 
  Heart, 
  FileText, 
  ShieldCheck, 
  Globe
} from "lucide-react";
import { safeStorage } from "../lib/safeStorage";
import { translate } from "../lib/translations";

const PRESET_AVATARS = [
  { name: "Default Pilgrim", url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80" },
  { name: "Quiet Forest", url: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=150&auto=format&fit=crop&q=80" },
  { name: "Mountain Peace", url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=150&auto=format&fit=crop&q=80" },
  { name: "Ocean Grace", url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=150&auto=format&fit=crop&q=80" },
  { name: "Morning Light", url: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=150&auto=format&fit=crop&q=80" }
];

export const UserProfile: React.FC = () => {
  const { user, streak, favorites, notes, bookmarks, language } = useApp();
  
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load profile details from Firebase or safeStorage on mount / user change
  useEffect(() => {
    if (user) {
      setIsInitialLoading(true);
      
      const fetchProfileData = async () => {
        try {
          const profile = await getUserProfile(user.uid);
          if (profile) {
            setDisplayName(profile.displayName || user.displayName || "Faith Pilgrim");
            setPhotoURL(profile.photoURL || user.photoURL || PRESET_AVATARS[0].url);
            setBio(profile.bio || "");
          } else {
            // Apply fallbacks if profile document doesn't exist yet
            setDisplayName(user.displayName || "Faith Pilgrim");
            setPhotoURL(user.photoURL || PRESET_AVATARS[0].url);
            setBio("");
          }
        } catch (e) {
          console.error("Error fetching user profile:", e);
          // Fallbacks on error
          setDisplayName(user.displayName || "Faith Pilgrim");
          setPhotoURL(user.photoURL || PRESET_AVATARS[0].url);
          setBio("");
        } finally {
          setIsInitialLoading(false);
        }
      };

      fetchProfileData();
    } else {
      setIsInitialLoading(false);
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      await saveUserProfile(user.uid, {
        displayName: displayName.trim() || "Faith Pilgrim",
        bio: bio.trim(),
        photoURL: photoURL
      });
      
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto py-12 px-6 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-sm font-sans text-charcoal-600 dark:text-charcoal-400 animate-pulse">
          {language === "Spanish" ? "Cargando tu perfil espiritual..." : "Gathering your spiritual profile..."}
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full max-w-xl mx-auto py-12 px-6 text-center">
        <p className="text-charcoal-600 dark:text-charcoal-400">Please authenticate to view your spiritual profile.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-4 px-0 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-serif tracking-tight text-brand-700 dark:text-brand-200">
            {language === "Spanish" ? "Perfil de Peregrino" : "Pilgrim Profile"}
          </h2>
          <p className="text-sm text-charcoal-600 dark:text-charcoal-400">
            {language === "Spanish" ? "Administra tu identidad espiritual y progreso" : "Manage your spiritual identity and progress"}
          </p>
        </div>
        
        <button
          onClick={() => {
            if (isEditing) {
              // Reset values on cancel
              setIsEditing(false);
            } else {
              setIsEditing(true);
            }
          }}
          className="flex items-center space-x-2 text-sm font-medium bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 text-charcoal-800 dark:text-linen-100 px-4 py-2.5 rounded-xl hover:bg-linen-200 dark:hover:bg-charcoal-800 transition-colors shadow-xs cursor-pointer"
        >
          {isEditing ? (
            <>
              <X className="w-4 h-4 text-rose-500" />
              <span>{language === "Spanish" ? "Cancelar" : "Cancel"}</span>
            </>
          ) : (
            <>
              <Edit2 className="w-4 h-4 text-brand-600 dark:text-brand-500" />
              <span>{language === "Spanish" ? "Editar Perfil" : "Edit Profile"}</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card Summary / Left Column */}
        <div className="md:col-span-1 bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-3xl p-6 flex flex-col items-center text-center shadow-xs">
          <div className="relative group mb-4">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-brand-500 dark:border-brand-600 shadow-sm relative bg-linen-200">
              <img 
                src={photoURL || PRESET_AVATARS[0].url} 
                alt={displayName} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PRESET_AVATARS[0].url;
                }}
              />
            </div>
            {isEditing && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <Sparkles className="w-5 h-5" />
              </div>
            )}
          </div>

          <h3 className="text-xl font-bold text-charcoal-800 dark:text-linen-100 font-sans tracking-tight">
            {displayName}
          </h3>
          <p className="text-xs font-mono text-brand-600 dark:text-brand-500 font-medium uppercase tracking-widest mt-0.5">
            {language === "Spanish" ? "Peregrino de Fe" : "Faith Pilgrim"}
          </p>

          <div className="w-full border-t border-linen-300 dark:border-charcoal-800 my-4" />

          <p className="text-sm text-charcoal-600 dark:text-charcoal-400 italic font-serif leading-relaxed px-2">
            {bio ? `"${bio}"` : `"${language === "Spanish" ? "Buscando la verdad diaria en Su Palabra." : "Seeking daily truth in His Word."}"`}
          </p>

          <div className="w-full border-t border-linen-300 dark:border-charcoal-800 my-4" />

          {/* User Meta info */}
          <div className="w-full space-y-2 text-left text-xs text-charcoal-600 dark:text-charcoal-400 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">EMAIL:</span>
              <span className="truncate max-w-[150px]">{user.email || "guest@dailybible.app"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">UID:</span>
              <span className="truncate max-w-[150px]">{user.uid.slice(0, 10)}...</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">STATUS:</span>
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                {isFirebaseActive ? "VERIFIED" : "OFFLINE"}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Presentation Statistics / Edit Form */}
        <div className="md:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            {!isEditing ? (
              <motion.div
                key="presentation"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Stats Bento Grid */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Streak Card */}
                  <div className="bg-orange-50/50 dark:bg-amber-950/10 border border-orange-200/50 dark:border-amber-900/30 rounded-2xl p-4 text-center">
                    <div className="flex justify-center mb-1">
                      <Flame className="w-6 h-6 text-orange-500 fill-orange-500 animate-pulse" />
                    </div>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 font-serif">
                      {streak}
                    </div>
                    <div className="text-[10px] md:text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-widest font-sans mt-1">
                      {language === "Spanish" ? "Racha" : "Streak"}
                    </div>
                  </div>

                  {/* Bookmarks Card */}
                  <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-200/50 dark:border-blue-900/30 rounded-2xl p-4 text-center">
                    <div className="flex justify-center mb-1">
                      <BookOpen className="w-6 h-6 text-brand-500 fill-brand-500/20" />
                    </div>
                    <div className="text-2xl font-bold text-brand-600 dark:text-brand-400 font-serif">
                      {bookmarks.length}
                    </div>
                    <div className="text-[10px] md:text-xs font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-widest font-sans mt-1">
                      {language === "Spanish" ? "Marcadores" : "Bookmarks"}
                    </div>
                  </div>

                  {/* Notes Card */}
                  <div className="bg-teal-50/50 dark:bg-teal-950/10 border border-teal-200/50 dark:border-teal-900/30 rounded-2xl p-4 text-center">
                    <div className="flex justify-center mb-1">
                      <FileText className="w-6 h-6 text-teal-500 fill-teal-500/20" />
                    </div>
                    <div className="text-2xl font-bold text-teal-600 dark:text-teal-400 font-serif">
                      {notes.length}
                    </div>
                    <div className="text-[10px] md:text-xs font-semibold text-teal-700 dark:text-teal-300 uppercase tracking-widest font-sans mt-1">
                      {language === "Spanish" ? "Notas" : "Notes"}
                    </div>
                  </div>
                </div>

                {/* Favorite Categories / Details Section */}
                <div className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-3xl p-6 space-y-4 shadow-xs">
                  <h4 className="text-lg font-bold font-serif text-brand-700 dark:text-brand-200 flex items-center space-x-2">
                    <Heart className="w-5 h-5 text-rose-500 fill-rose-500/10" />
                    <span>{language === "Spanish" ? "Versículos Favoritos" : "Favorite Verses"}</span>
                  </h4>

                  {favorites.length === 0 ? (
                    <p className="text-sm text-charcoal-600 dark:text-charcoal-400 italic">
                      {language === "Spanish" 
                        ? "Aún no has guardado versículos favoritos. Explora la Biblia hoy y guarda uno."
                        : "No favorite scriptures saved yet. Explore the Bible today and save one."}
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {favorites.slice(0, 3).map((fav) => (
                        <div 
                          key={fav.id} 
                          className="p-3 bg-linen-100 dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-800 rounded-xl"
                        >
                          <p className="text-sm font-serif italic text-charcoal-800 dark:text-linen-100 leading-relaxed mb-1">
                            "{fav.text}"
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-charcoal-600 dark:text-charcoal-400 font-mono">
                            <span className="font-semibold text-brand-600 dark:text-brand-500">{fav.reference}</span>
                            <span className="bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full font-sans uppercase font-bold text-[9px]">
                              {fav.category}
                            </span>
                          </div>
                        </div>
                      ))}
                      {favorites.length > 3 && (
                        <p className="text-xs text-center text-charcoal-600 dark:text-charcoal-400 font-mono pt-1">
                          + {favorites.length - 3} {language === "Spanish" ? "más en tus favoritos" : "more in your favorites"}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Spiritual Covenant Card */}
                <div className="bg-gradient-to-br from-brand-600/5 to-brand-700/10 dark:from-brand-900/10 dark:to-brand-800/20 border border-brand-500/25 dark:border-brand-600/25 rounded-3xl p-6 flex items-start space-x-4">
                  <div className="p-3 bg-brand-500 dark:bg-brand-600 text-white rounded-2xl shrink-0 shadow-sm">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-bold text-charcoal-800 dark:text-linen-100 font-sans tracking-tight">
                      {language === "Spanish" ? "La Alianza del Peregrino" : "The Pilgrim's Covenant"}
                    </h5>
                    <p className="text-sm text-charcoal-600 dark:text-charcoal-400 leading-relaxed">
                      {language === "Spanish" 
                        ? "Te has comprometido a leer y meditar diariamente en las Sagradas Escrituras. Que cada racha fortalezca tu caminar diario."
                        : "You have committed to daily reading and meditation on Holy Scripture. May every streak strengthen your daily walk."}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="edit-form"
                onSubmit={handleSave}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-3xl p-6 space-y-6 shadow-xs"
              >
                {errorMessage && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-sm rounded-xl border border-rose-200 dark:border-rose-900/50">
                    {errorMessage}
                  </div>
                )}

                {/* Form fields */}
                <div className="space-y-4">
                  {/* Avatar Preset Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      {language === "Spanish" ? "Selecciona un Avatar" : "Select an Avatar"}
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {PRESET_AVATARS.map((preset) => {
                        const isSelected = photoURL === preset.url;
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => setPhotoURL(preset.url)}
                            className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all relative ${
                              isSelected 
                                ? "border-brand-500 ring-2 ring-brand-200 dark:ring-brand-900/50 scale-105" 
                                : "border-linen-300 dark:border-charcoal-800 opacity-70 hover:opacity-100"
                            }`}
                          >
                            <img 
                              src={preset.url} 
                              alt={preset.name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            {isSelected && (
                              <div className="absolute inset-0 bg-brand-500/20 flex items-center justify-center">
                                <div className="w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5" />
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Manual URL field */}
                  <div>
                    <label htmlFor="avatar-url-input" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      {language === "Spanish" ? "URL de Avatar Personalizado" : "Custom Avatar Image URL"}
                    </label>
                    <input
                      id="avatar-url-input"
                      type="url"
                      value={photoURL}
                      onChange={(e) => setPhotoURL(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full bg-linen-50 dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-charcoal-800 dark:text-linen-100 transition-colors"
                    />
                  </div>

                  {/* Display Name Input */}
                  <div>
                    <label htmlFor="display-name-input" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      {language === "Spanish" ? "Nombre para Mostrar" : "Display Name"}
                    </label>
                    <input
                      id="display-name-input"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      maxLength={40}
                      placeholder="Faith Pilgrim"
                      className="w-full bg-linen-50 dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-charcoal-800 dark:text-linen-100 transition-colors"
                    />
                  </div>

                  {/* Bio Area */}
                  <div>
                    <label htmlFor="bio-input" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      {language === "Spanish" ? "Biografía / Lema Espiritual" : "Bio / Spiritual Tagline"}
                    </label>
                    <textarea
                      id="bio-input"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={180}
                      rows={3}
                      placeholder={language === "Spanish" ? "Escribe un breve lema o cita de tu fe..." : "Write a brief faith quote or bio..."}
                      className="w-full bg-linen-50 dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-charcoal-800 dark:text-linen-100 transition-colors resize-none"
                    />
                    <div className="text-right text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-1">
                      {bio.length}/180
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setErrorMessage(null);
                    }}
                    className="px-5 py-2.5 rounded-xl border border-linen-300 dark:border-charcoal-800 text-sm font-medium text-charcoal-800 dark:text-linen-100 hover:bg-linen-100 dark:hover:bg-charcoal-850 cursor-pointer"
                  >
                    {language === "Spanish" ? "Descartar" : "Discard"}
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving || saveSuccess}
                    className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 px-6 rounded-xl shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : saveSuccess ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>
                      {isSaving 
                        ? (language === "Spanish" ? "Guardando..." : "Saving...") 
                        : saveSuccess 
                        ? (language === "Spanish" ? "¡Guardado!" : "Saved!") 
                        : (language === "Spanish" ? "Guardar Cambios" : "Save Changes")}
                    </span>
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
