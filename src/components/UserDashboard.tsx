import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { subscribeToMyPrayerRequests, togglePrayerRequestAnswered, deletePrayerRequest } from "../lib/firebase";
import { 
  Flame, 
  Bookmark, 
  PenTool, 
  Heart, 
  MapPin, 
  Settings, 
  ChevronRight, 
  X, 
  Copy, 
  Trash2, 
  Check, 
  LogOut, 
  User, 
  Search, 
  Plus,
  BookOpen,
  Calendar,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { translate } from "../lib/translations";
import { StreakCalendar } from "./StreakCalendar";

export const UserDashboard: React.FC = () => {
  const { 
    user, 
    logout, 
    updateUserProfile,
    streak, 
    favorites, 
    removeFavorite,
    notes,
    deleteNote,
    saveNote,
    prayers,
    addPrayer,
    togglePrayerAnswered,
    deletePrayer,
    bookmarks,
    toggleBookmark,
    language,
    setLanguage,
    textSize,
    setTextSize
  } = useApp();

  // State for sub-views / modal sheets
  const [activeSubView, setActiveSubView] = useState<"favorites" | "prayer" | "church" | "settings" | "my_prayer_requests" | null>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // My Prayer Requests from prayer_requests collection
  const [myPrayerRequests, setMyPrayerRequests] = useState<any[]>([]);
  const [myPrayerFilter, setMyPrayerFilter] = useState<"all" | "active" | "answered">("all");

  // Copy status feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit Profile fields (using local storage as offline-first durable persistence)
  const [customBio, setCustomBio] = useState(() => localStorage.getItem("fg_custom_bio") || "Faith Pilgrim");
  const [customAvatar, setCustomAvatar] = useState(() => localStorage.getItem("fg_custom_avatar") || "");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const getAvatarUrl = () => {
    if (customAvatar.trim()) return customAvatar;
    return user?.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
  };

  // Prayer Journal tab selection
  const [journalTab, setJournalTab] = useState<"prayers" | "notes">("prayers");

  // New Prayer form state
  const [newPrayerRequest, setNewPrayerRequest] = useState("");
  const [newPrayerMeditation, setNewPrayerMeditation] = useState("");
  const [isAddingPrayer, setIsAddingPrayer] = useState(false);

  // New Note form state
  const [newNoteRef, setNewNoteRef] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteCategory, setNewNoteCategory] = useState("General");
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Church Finder state
  const [churchSearch, setChurchSearch] = useState("");
  const [churchFiltered, setChurchFiltered] = useState<any[]>([]);

  // Preferences / Settings state
  const [ageRange, setAgeRange] = useState(() => localStorage.getItem("fg_pref_age_range") || "25-34");
  const [denomination, setDenomination] = useState(() => localStorage.getItem("fg_pref_denomination") || "Non-Denominational");

  const ageOptions = ["13-17", "18-24", "25-34", "35-44", "45-54", "55+"];
  const denomOptions = ["Catholic", "Protestant", "Orthodox", "Non-Denominational", "Anglican", "Baptist", "Methodist", "Lutheran", "Presbyterian", "Other"];

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

  const handleCopyQuote = (text: string, ref: string, id: string) => {
    navigator.clipboard.writeText(`“${text}” — ${ref}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (isEditProfileOpen) {
      setEditName(user?.displayName || "Tyson");
      setEditBio(customBio);
      setPreviewAvatar(getAvatarUrl());
    }
  }, [isEditProfileOpen, user, customBio]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const rawBase64 = reader.result;
          const img = new Image();
          img.src = rawBase64;
          img.onload = () => {
            try {
              const canvas = document.createElement("canvas");
              const size = 150; // Standard mobile thumbnail size
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                // Calculate cover-style dimensions to avoid distortion
                const scale = Math.max(size / img.width, size / img.height);
                const x = (size - img.width * scale) / 2;
                const y = (size - img.height * scale) / 2;
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                
                // Compress as JPEG with 0.75 quality for visual clarity and tiny size
                const compressed = canvas.toDataURL("image/jpeg", 0.75);
                setPreviewAvatar(compressed);
              } else {
                setPreviewAvatar(rawBase64);
              }
            } catch (canvasErr) {
              console.warn("Failed to compress image using canvas, falling back to original", canvasErr);
              setPreviewAvatar(rawBase64);
            }
          };
          img.onerror = () => {
            setPreviewAvatar(rawBase64);
          };
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setIsSavingProfile(true);
    try {
      try {
        localStorage.setItem("fg_custom_bio", editBio.trim());
      } catch (err) {
        console.warn("Failed to write bio to localStorage", err);
      }
      setCustomBio(editBio.trim());

      let finalPhotoURL = previewAvatar;
      if (previewAvatar) {
        try {
          localStorage.setItem("fg_custom_avatar", previewAvatar);
        } catch (err) {
          console.warn("Failed to write custom avatar to localStorage", err);
        }
        setCustomAvatar(previewAvatar);
      }

      await updateUserProfile(editName.trim(), finalPhotoURL);

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditProfileOpen(false);
      }, 1000);
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCreatePrayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrayerRequest.trim() || !newPrayerMeditation.trim()) return;
    setIsAddingPrayer(true);
    await addPrayer(newPrayerRequest.trim(), newPrayerMeditation.trim());
    setNewPrayerRequest("");
    setNewPrayerMeditation("");
    setIsAddingPrayer(false);
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteRef.trim() || !newNoteContent.trim()) return;
    setIsAddingNote(true);
    await saveNote(newNoteRef.trim(), newNoteContent.trim(), newNoteCategory);
    setNewNoteRef("");
    setNewNoteContent("");
    setNewNoteCategory("General");
    setIsAddingNote(false);
  };

  const CHURCH_DATABASE = [
    { name: "Grace Community Church", type: "Non-Denominational", distance: "1.2 miles", services: "Sun 9:00 AM & 11:00 AM", address: "1024 Grace Way, Seattle" },
    { name: "St. Paul's Cathedral", type: "Catholic", distance: "2.5 miles", services: "Sun 8:00 AM & 10:30 AM", address: "405 Cathedral Plaza, Seattle" },
    { name: "Trinity Presbyterian Church", type: "Presbyterian", distance: "3.8 miles", services: "Sun 10:00 AM", address: "812 Trinity Dr, Seattle" },
    { name: "Faith Fellowship", type: "Baptist", distance: "4.1 miles", services: "Sun 9:30 AM & 11:15 AM", address: "1500 Faith Blvd, Boston" },
    { name: "St. Mary's Church", type: "Catholic", distance: "5.3 miles", services: "Sat 5:00 PM, Sun 9:00 AM", address: "302 St. Marys Lane, Boston" },
    { name: "All Saints Chapel", type: "Orthodox", distance: "6.2 miles", services: "Sun 10:00 AM (Divine Liturgy)", address: "89 Chapel St, Chicago" },
  ];

  useEffect(() => {
    if (!churchSearch.trim()) {
      setChurchFiltered(CHURCH_DATABASE);
    } else {
      const q = churchSearch.toLowerCase();
      const filtered = CHURCH_DATABASE.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.type.toLowerCase().includes(q) || 
        c.address.toLowerCase().includes(q)
      );
      setChurchFiltered(filtered);
    }
  }, [churchSearch]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToMyPrayerRequests(user.uid, (data) => {
      setMyPrayerRequests(data);
    });
    return () => unsubscribe();
  }, [user]);

  const handleTogglePrayerRequestAnswered = async (requestId: string, currentAnswered: boolean) => {
    try {
      await togglePrayerRequestAnswered(requestId, currentAnswered);
    } catch (error) {
      console.error("Failed to toggle prayer request answered:", error);
    }
  };

  const handleDeletePrayerRequest = async (requestId: string) => {
    try {
      await deletePrayerRequest(requestId);
    } catch (error) {
      console.error("Failed to delete prayer request:", error);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-screen px-4 py-6 bg-[#121212] text-white rounded-3xl overflow-hidden shadow-2xl border border-neutral-800 relative flex flex-col font-sans">
      
      {/* 1. Unified Profile Header */}
      <div className="flex flex-col items-center mt-4">
        {/* Avatar */}
        <div className="relative">
          <img
            src={getAvatarUrl()}
            alt="Tyson Avatar"
            className="w-20 h-20 rounded-full border-2 border-neutral-800 object-cover shadow-lg"
          />
        </div>
        
        {/* Name */}
        <h2 className="text-2xl font-bold text-white mt-3 tracking-tight text-center">
          {user?.displayName || "Tyson"}
        </h2>
        
        {/* Subtitle */}
        <p className="text-sm text-neutral-400 mt-1 font-medium text-center">{customBio}</p>
        
        {/* Outlined Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-5 w-full">
          <button
            onClick={() => setIsEditProfileOpen(true)}
            className="flex items-center justify-center gap-2 border border-neutral-800 hover:bg-neutral-800/60 text-neutral-200 text-xs font-semibold py-2.5 px-4 rounded-xl transition cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 border border-neutral-800 hover:bg-neutral-800/60 text-neutral-200 text-xs font-semibold py-2.5 px-4 rounded-xl transition hover:text-red-400 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* 2. Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        {/* Card 1: Streak */}
        <div className="bg-[#1E1E1E] rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center border border-neutral-800/20">
          <motion.div
            animate={{
              scale: [1, 1.15, 1],
              filter: ["drop-shadow(0px 0px 0px rgba(245, 158, 11, 0))", "drop-shadow(0px 0px 6px rgba(245, 158, 11, 0.4))", "drop-shadow(0px 0px 0px rgba(245, 158, 11, 0))"]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="mb-1"
          >
            <Flame className="w-6 h-6 text-amber-500 fill-amber-500/10" />
          </motion.div>
          <span className="text-2xl font-bold text-white">{streak}</span>
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold mt-1">Streak</span>
        </div>

        {/* Card 2: Bookmarks */}
        <div className="bg-[#1E1E1E] rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center border border-neutral-800/20">
          <Bookmark className="w-6 h-6 text-blue-400 fill-blue-400/10 mb-1" />
          <span className="text-2xl font-bold text-white">{bookmarks.length}</span>
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold mt-1">Bookmarks</span>
        </div>

        {/* Card 3: Notes */}
        <div className="bg-[#1E1E1E] rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center border border-neutral-800/20">
          <PenTool className="w-6 h-6 text-emerald-400 fill-emerald-400/10 mb-1" />
          <span className="text-2xl font-bold text-white">{notes.length}</span>
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold mt-1">Notes</span>
        </div>
      </div>

      {/* Streak Calendar Bar */}
      <StreakCalendar />

      {/* 3. Vertical Action Menu */}
      <div className="bg-[#1E1E1E] rounded-3xl overflow-hidden mt-6 border border-neutral-800/20">
        {[
          { id: "favorites", label: "Favorite Verses", icon: Heart },
          { id: "prayer", label: "Prayer Journal", icon: BookOpen },
          { id: "my_prayer_requests", label: "My Prayer Requests", icon: Sparkles },
          { id: "church", label: "Church Finder", icon: MapPin },
          { id: "settings", label: "Settings", icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSubView(item.id as any)}
              className="w-full flex items-center justify-between py-4.5 px-5 hover:bg-[#252525] transition text-left cursor-pointer border-b border-neutral-800/40 last:border-0"
            >
              <div className="flex items-center space-x-3.5">
                <Icon className="w-5 h-5 text-neutral-300" />
                <span className="text-sm font-medium text-white">{item.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500" />
            </button>
          );
        })}
      </div>

      {/* Animated Sheets Overlay Container */}
      <AnimatePresence>
        
        {/* A. Edit Profile Modal (Native Feel Bottom Sheet) */}
        {isEditProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
            {/* Click outside to close overlay */}
            <div className="absolute inset-0" onClick={() => setIsEditProfileOpen(false)} />
            
            <motion.div
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.5 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full sm:max-w-md bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl p-6 border-t sm:border border-neutral-800/60 shadow-2xl flex flex-col z-10"
            >
              {/* iOS Drag Handle on Mobile */}
              <div className="w-12 h-1 bg-neutral-800 rounded-full mx-auto mb-5 sm:hidden" />

              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white font-sans">Edit Pilgrim Profile</h3>
                <button 
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="p-1.5 hover:bg-neutral-800 rounded-full text-neutral-400 cursor-pointer transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                {/* Large Centered Avatar with Camera Icon Overlay */}
                <div className="flex flex-col items-center mb-6">
                  <div className="relative group cursor-pointer">
                    <img
                      src={previewAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                      alt="Avatar Preview"
                      className="w-24 h-24 rounded-full border-2 border-amber-500 object-cover shadow-xl transition group-hover:opacity-85"
                      onClick={() => document.getElementById("profile-photo-picker")?.click()}
                    />
                    
                    {/* Camera icon overlay */}
                    <div 
                      onClick={() => document.getElementById("profile-photo-picker")?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition duration-200"
                    >
                      <div className="bg-neutral-900/90 p-2.5 rounded-full border border-neutral-800 text-amber-500 shadow-lg">
                        <svg className="w-5 h-5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Hidden File input */}
                  <input
                    id="profile-photo-picker"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <span className="text-[11px] text-neutral-400 mt-2 font-medium">Tap photo to select from library</span>
                </div>

                {/* Username input */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Pilgrim Username
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter username"
                    className="w-full bg-[#2C2C2E] border border-neutral-800 rounded-xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-neutral-700 transition font-medium"
                  />
                </div>

                {/* Tagline input */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Spiritual Tagline
                  </label>
                  <input
                    type="text"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="E.g., Faith Pilgrim"
                    maxLength={60}
                    className="w-full bg-[#2C2C2E] border border-neutral-800 rounded-xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-neutral-700 transition"
                  />
                </div>

                {/* Actions */}
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditProfileOpen(false)}
                    className="flex-1 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 font-bold py-3 px-4 rounded-xl transition text-center cursor-pointer text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile || !editName.trim()}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-extrabold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    {isSavingProfile ? (
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : saveSuccess ? (
                      <>
                        <Check className="w-4 h-4 stroke-[3px]" />
                        <span>Saved!</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* B. Favorite Verses Sheet */}
        {activeSubView === "favorites" && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="absolute inset-0 bg-[#121212] z-40 flex flex-col px-5 py-6 overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-white">Favorite Verses</h3>
              <button 
                onClick={() => setActiveSubView(null)}
                className="p-1.5 hover:bg-neutral-800 rounded-full text-neutral-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-400 mb-4">Your saved spiritual guidelines and inspiration bookmarks.</p>

            <div className="space-y-4 flex-grow overflow-y-auto">
              {favorites.length > 0 ? (
                favorites.map((fav) => (
                  <div 
                    key={fav.id}
                    className="bg-[#1E1E1E] border border-neutral-800/40 rounded-2xl p-4 flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded uppercase">
                        {fav.category}
                      </span>
                      <div className="flex space-x-1.5">
                        <button
                          onClick={() => handleCopyQuote(fav.text, fav.reference, fav.id)}
                          className="p-1.5 text-neutral-400 hover:text-white transition rounded-md hover:bg-neutral-800"
                          title="Copy reference"
                        >
                          {copiedId === fav.id ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => removeFavorite(fav.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-400 transition rounded-md hover:bg-neutral-800"
                          title="Remove bookmark"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <blockquote className="text-sm italic text-neutral-200 font-serif leading-relaxed pr-2">
                      “{fav.text}”
                    </blockquote>

                    <p className="text-xs font-bold text-white mt-3 self-end font-serif">
                      — {fav.reference}
                    </p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center text-neutral-500 space-y-3">
                  <Heart className="w-12 h-12 stroke-1" />
                  <p className="text-sm">No favorite scriptures saved yet.</p>
                  <p className="text-xs max-w-xs">Explore the Bible today and tap the heart icon to save verses here.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* C. Prayer Journal Sheet */}
        {activeSubView === "prayer" && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="absolute inset-0 bg-[#121212] z-40 flex flex-col px-5 py-6 overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Prayer Journal</h3>
              <button 
                onClick={() => setActiveSubView(null)}
                className="p-1.5 hover:bg-neutral-800 rounded-full text-neutral-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub Tabs: Prayers vs Notes */}
            <div className="grid grid-cols-2 gap-2 bg-[#1E1E1E] p-1 rounded-xl mb-5">
              <button
                onClick={() => setJournalTab("prayers")}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition cursor-pointer ${
                  journalTab === "prayers" 
                    ? "bg-[#2A2A2A] text-white shadow-sm" 
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Prayers ({prayers.length})
              </button>
              <button
                onClick={() => setJournalTab("notes")}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition cursor-pointer ${
                  journalTab === "notes" 
                    ? "bg-[#2A2A2A] text-white shadow-sm" 
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Notes ({notes.length})
              </button>
            </div>

            <div className="flex-grow overflow-y-auto space-y-4">
              {journalTab === "prayers" ? (
                <>
                  {/* Add Prayer Form */}
                  <form onSubmit={handleCreatePrayer} className="bg-[#1E1E1E] border border-neutral-800/40 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-widest flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Prayer Request</span>
                    </h4>
                    
                    <input
                      type="text"
                      placeholder="Intent (e.g., Peace, Family Guidance)"
                      value={newPrayerRequest}
                      onChange={(e) => setNewPrayerRequest(e.target.value)}
                      required
                      className="w-full bg-[#121212] border border-neutral-800 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-neutral-700 transition"
                    />

                    <textarea
                      placeholder="My deep prayer and petition..."
                      value={newPrayerMeditation}
                      onChange={(e) => setNewPrayerMeditation(e.target.value)}
                      required
                      rows={2}
                      className="w-full bg-[#121212] border border-neutral-800 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-neutral-700 transition resize-none"
                    />

                    <button
                      type="submit"
                      disabled={isAddingPrayer}
                      className="w-full bg-white text-black hover:bg-neutral-200 font-bold py-2 px-3 rounded-xl text-xs transition cursor-pointer"
                    >
                      {isAddingPrayer ? "Recording..." : "Record Prayer"}
                    </button>
                  </form>

                  {/* Prayers List */}
                  <div className="space-y-3 pt-2">
                    {prayers.length > 0 ? (
                      prayers.map((pr) => (
                        <div 
                          key={pr.id}
                          className="bg-[#1E1E1E] border border-neutral-800/40 rounded-2xl p-4 flex flex-col justify-between"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-white">{pr.request}</span>
                            <div className="flex space-x-1.5 items-center">
                              <button
                                onClick={() => togglePrayerAnswered(pr.id)}
                                className={`p-1 rounded-md transition ${
                                  pr.answered 
                                    ? "bg-green-950/40 text-green-400 border border-green-800" 
                                    : "text-neutral-500 hover:text-white hover:bg-neutral-800"
                                }`}
                                title="Mark as Answered"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => deletePrayer(pr.id)}
                                className="p-1 text-neutral-500 hover:text-red-400 transition rounded-md hover:bg-neutral-800"
                                title="Delete prayer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          
                          <p className="text-xs text-neutral-300 italic leading-relaxed">{pr.prayer}</p>
                          
                          {pr.answered && (
                            <span className="text-[9px] text-green-400 font-bold uppercase tracking-wider mt-2 bg-green-950/20 py-0.5 px-2 rounded-full self-start">
                              Answered Grace
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-neutral-500 text-xs">
                        No prayers logged yet. Add one above!
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Add Note Form */}
                  <form onSubmit={handleCreateNote} className="bg-[#1E1E1E] border border-neutral-800/40 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-widest flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Bible Study Note</span>
                    </h4>
                    
                    <input
                      type="text"
                      placeholder="Scripture Reference (e.g., Psalm 23:1)"
                      value={newNoteRef}
                      onChange={(e) => setNewNoteRef(e.target.value)}
                      required
                      className="w-full bg-[#121212] border border-neutral-800 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-neutral-700 transition"
                    />

                    <textarea
                      placeholder="My key insight and spiritual meditation..."
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      required
                      rows={2}
                      className="w-full bg-[#121212] border border-neutral-800 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-neutral-700 transition resize-none"
                    />

                    <div className="flex gap-2">
                      <select
                        value={newNoteCategory}
                        onChange={(e) => setNewNoteCategory(e.target.value)}
                        className="bg-[#121212] border border-neutral-800 rounded-xl py-2 px-3 text-xs text-neutral-300 focus:outline-none"
                      >
                        <option value="General">General</option>
                        <option value="Devotion">Devotion</option>
                        <option value="Inspiration">Inspiration</option>
                        <option value="Worship">Worship</option>
                      </select>
                      
                      <button
                        type="submit"
                        disabled={isAddingNote}
                        className="flex-grow bg-white text-black hover:bg-neutral-200 font-bold py-2 px-3 rounded-xl text-xs transition cursor-pointer"
                      >
                        {isAddingNote ? "Adding..." : "Save Note"}
                      </button>
                    </div>
                  </form>

                  {/* Notes List */}
                  <div className="space-y-3 pt-2">
                    {notes.length > 0 ? (
                      notes.map((nt) => (
                        <div 
                          key={nt.id}
                          className="bg-[#1E1E1E] border border-neutral-800/40 rounded-2xl p-4 flex flex-col justify-between"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-[10px] text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded uppercase font-bold">
                                {nt.category}
                              </span>
                              <h5 className="text-xs font-bold text-white font-serif mt-1.5">{nt.reference}</h5>
                            </div>
                            <button
                              onClick={() => deleteNote(nt.id)}
                              className="p-1 text-neutral-500 hover:text-red-400 transition rounded-md hover:bg-neutral-800"
                              title="Delete note"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          <p className="text-xs text-neutral-300 leading-relaxed font-sans mt-1">{nt.content}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-neutral-500 text-xs">
                        No notebook notes saved yet. Save one above!
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* D. Church Finder Sheet */}
        {activeSubView === "church" && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="absolute inset-0 bg-[#121212] z-40 flex flex-col px-5 py-6 overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Church Finder</h3>
              <button 
                onClick={() => setActiveSubView(null)}
                className="p-1.5 hover:bg-neutral-800 rounded-full text-neutral-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search inputs */}
            <div className="relative mb-5">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <Search className="h-4 w-4 text-neutral-400" />
              </span>
              <input
                type="text"
                value={churchSearch}
                onChange={(e) => setChurchSearch(e.target.value)}
                placeholder="Search by city, name, or denomination..."
                className="w-full bg-[#1E1E1E] border border-neutral-800 rounded-xl py-3 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-neutral-700 transition"
              />
            </div>

            {/* Church List */}
            <div className="space-y-4 flex-grow overflow-y-auto">
              {churchFiltered.length > 0 ? (
                churchFiltered.map((ch, idx) => (
                  <div 
                    key={idx}
                    className="bg-[#1E1E1E] border border-neutral-800/40 rounded-2xl p-4 flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-bold text-white">{ch.name}</h4>
                      <span className="text-[10px] text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-full font-semibold">
                        {ch.distance}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-400 font-medium mb-2">{ch.type}</p>
                    
                    <div className="space-y-1 text-xs text-neutral-300">
                      <p className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{ch.services}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{ch.address}</span>
                      </p>
                    </div>

                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(ch.name + ' ' + ch.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 w-full bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-200 font-bold py-2 px-3 rounded-xl text-center text-xs transition block cursor-pointer"
                    >
                      Get Directions
                    </a>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-neutral-500 text-xs">
                  No matching congregations found.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* E. Settings Sheet */}
        {activeSubView === "settings" && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="absolute inset-0 bg-[#121212] z-40 flex flex-col px-5 py-6 overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-white">Settings & Preferences</h3>
              <button 
                onClick={() => setActiveSubView(null)}
                className="p-1.5 hover:bg-neutral-800 rounded-full text-neutral-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 flex-grow">
              
              {/* Language Selector */}
              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5">Preferred Language</h4>
                <div className="grid grid-cols-2 gap-2">
                  {["English", "Spanish", "Portuguese", "French", "Tagalog"].map((lang) => {
                    const isSelected = language === lang || (lang === "Spanish" && language === "es") || (lang === "French" && language === "fr");
                    return (
                      <button
                        key={lang}
                        onClick={() => setLanguage(lang)}
                        className={`rounded-xl border py-2.5 px-3 text-xs font-bold transition text-center cursor-pointer ${
                          isSelected
                            ? "bg-white border-white text-black font-extrabold"
                            : "bg-[#1E1E1E] border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                        }`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Text Size Slider */}
              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5">Text Reading Size</h4>
                <div className="flex items-center justify-between bg-[#1E1E1E] border border-neutral-800 rounded-xl p-3">
                  <button
                    onClick={handleDecreaseTextSize}
                    disabled={textSize === "sm"}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs select-none transition ${
                      textSize === "sm"
                        ? "text-neutral-600 cursor-not-allowed"
                        : "text-white hover:bg-neutral-800 cursor-pointer"
                    }`}
                  >
                    A-
                  </button>
                  
                  <span className="text-xs font-bold capitalize text-neutral-200">
                    {textSize === "sm" ? "Small" : textSize === "base" ? "Normal" : textSize === "lg" ? "Large" : textSize === "xl" ? "X-Large" : "XX-Large"}
                  </span>
                  
                  <button
                    onClick={handleIncreaseTextSize}
                    disabled={textSize === "2xl"}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base select-none transition ${
                      textSize === "2xl"
                        ? "text-neutral-600 cursor-not-allowed"
                        : "text-white hover:bg-neutral-800 cursor-pointer"
                    }`}
                  >
                    A+
                  </button>
                </div>
              </div>

              {/* Age Range Selection */}
              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5">Age Range</h4>
                <div className="grid grid-cols-3 gap-2">
                  {ageOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setAgeRange(opt);
                        localStorage.setItem("fg_pref_age_range", opt);
                      }}
                      className={`rounded-xl border py-2 px-3 text-xs font-bold transition text-center cursor-pointer ${
                        ageRange === opt
                          ? "bg-white border-white text-black font-extrabold"
                          : "bg-[#1E1E1E] border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Denomination Choice */}
              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5">Denomination</h4>
                <div className="grid grid-cols-2 gap-2">
                  {denomOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setDenomination(opt);
                        localStorage.setItem("fg_pref_denomination", opt);
                      }}
                      className={`rounded-xl border py-2 px-3 text-xs font-bold transition text-center cursor-pointer truncate ${
                        denomination === opt
                          ? "bg-white border-white text-black font-extrabold"
                          : "bg-[#1E1E1E] border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                      }`}
                      title={opt}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {/* F. My Prayer Requests Sheet */}
        {activeSubView === "my_prayer_requests" && (() => {
          const filteredRequests = myPrayerRequests.filter(req => {
            if (myPrayerFilter === "active") return !req.answered;
            if (myPrayerFilter === "answered") return !!req.answered;
            return true;
          });

          return (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="absolute inset-0 bg-[#121212] z-40 flex flex-col px-5 py-6 overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-bold text-white">My Prayer Requests</h3>
                <button 
                  onClick={() => setActiveSubView(null)}
                  className="p-1.5 hover:bg-neutral-800 rounded-full text-neutral-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-neutral-400 mb-5">
                These are your public or anonymous prayer requests posted on the Global Prayer Wall. You can mark them as answered or delete them when they are completed.
              </p>

              {/* Filter Toggle Segment */}
              <div className="grid grid-cols-3 gap-2 bg-[#1E1E1E] p-1 rounded-xl mb-5 border border-neutral-800/40">
                {(["all", "active", "answered"] as const).map((filter) => {
                  const isActive = myPrayerFilter === filter;
                  const count = filter === "all" 
                    ? myPrayerRequests.length 
                    : filter === "active" 
                      ? myPrayerRequests.filter(r => !r.answered).length
                      : myPrayerRequests.filter(r => r.answered).length;

                  return (
                    <button
                      key={filter}
                      onClick={() => setMyPrayerFilter(filter)}
                      className={`py-2 px-1 text-xs font-bold rounded-lg transition-all cursor-pointer capitalize flex flex-col items-center justify-center ${
                        isActive 
                          ? "bg-[#2A2A2A] text-white shadow-sm border border-neutral-700/20" 
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      <span>{filter}</span>
                      <span className={`text-[9px] font-semibold mt-0.5 ${isActive ? "text-neutral-300" : "text-neutral-500"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4 flex-grow overflow-y-auto pb-6">
                {filteredRequests.length > 0 ? (
                  filteredRequests.map((req) => (
                    <div 
                      key={req.id}
                      className="bg-[#1E1E1E] border border-neutral-800/40 rounded-2xl p-4 flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-start mb-2.5">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded uppercase self-start">
                            {req.isAnonymous ? "Anonymous" : "Public Request"}
                          </span>
                          {req.prayedBy && req.prayedBy.length > 0 && (
                            <span className="text-[9px] text-amber-400 font-semibold mt-1">
                              Prayed for by {req.prayedBy.length} {req.prayedBy.length === 1 ? "person" : "people"}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex space-x-1.5 items-center">
                          <button
                            onClick={() => handleTogglePrayerRequestAnswered(req.id, !!req.answered)}
                            className={`p-1.5 rounded-lg transition border cursor-pointer ${
                              req.answered 
                                ? "bg-green-950/40 text-green-400 border-green-800/60 hover:bg-green-900/40" 
                                : "text-neutral-500 border-neutral-800 hover:text-white hover:bg-neutral-800"
                            }`}
                            title={req.answered ? "Mark as Active" : "Mark as Answered"}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            onClick={() => handleDeletePrayerRequest(req.id)}
                            className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition rounded-lg border border-transparent cursor-pointer"
                            title="Delete request"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-sm text-neutral-200 leading-relaxed font-sans pr-2">
                        {req.text}
                      </p>

                      {req.answered && (
                        <div className="mt-3.5 flex items-center gap-1.5 bg-green-950/20 border border-green-900/30 py-1 px-2.5 rounded-xl self-start">
                          <Sparkles className="w-3 h-3 text-green-400" />
                          <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">
                            Praise God! Answered
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-neutral-500 space-y-3">
                    <Sparkles className="w-12 h-12 stroke-1 text-neutral-600 animate-pulse" />
                    <p className="text-sm">
                      {myPrayerFilter === "all" 
                        ? "No prayer wall requests found." 
                        : myPrayerFilter === "active" 
                          ? "No active prayer requests." 
                          : "No answered prayer requests yet."}
                    </p>
                    <p className="text-xs max-w-xs text-center text-neutral-400">
                      {myPrayerFilter === "all" 
                        ? "Share a request on the Prayer Wall tab, and it will appear here under your account." 
                        : myPrayerFilter === "active" 
                          ? "You have completed or answered all your requests! Beautiful!" 
                          : "Tap the checkmark on any request when God answers your prayer to move it here."}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })()}

      </AnimatePresence>

    </div>
  );
};
