import { useState, lazy, Suspense } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthScreen } from "./components/AuthScreen";
import { ThemeToggleButton } from "./components/ThemeToggleButton";
import { LanguageSelector } from "./components/LanguageSelector";
import { translate } from "./lib/translations";

// Lazy-loaded components to optimize performance and prevent eager AI content fetching
const DailyVerse = lazy(() => import("./components/DailyVerse").then(module => ({ default: module.DailyVerse })));
const BibleSearch = lazy(() => import("./components/BibleSearch").then(module => ({ default: module.BibleSearch })));
const AiAssistant = lazy(() => import("./components/AiAssistant").then(module => ({ default: module.AiAssistant })));
const Devotionals = lazy(() => import("./components/Devotionals").then(module => ({ default: module.Devotionals })));
const ChapterSummaries = lazy(() => import("./components/ChapterSummaries").then(module => ({ default: module.ChapterSummaries })));
const PrayerCompanion = lazy(() => import("./components/PrayerCompanion").then(module => ({ default: module.PrayerCompanion })));
const UserDashboard = lazy(() => import("./components/UserDashboard").then(module => ({ default: module.UserDashboard })));
const ChurchFinder = lazy(() => import("./components/ChurchFinder").then(module => ({ default: module.ChurchFinder })));
import { 
  Sparkles, 
  Search, 
  MessageSquare, 
  BookOpen, 
  Calendar, 
  Heart, 
  User, 
  Flame,
  Globe,
  ExternalLink,
  MapPin
} from "lucide-react";

function MainAppLayout() {
  const { user, loading, isDarkMode, toggleTheme, streak, language } = useApp();
  const [activeTab, setActiveTab] = useState<"daily" | "search" | "chat" | "chapters" | "prayers" | "devotionals" | "profile" | "churches">("daily");
  
  const isIframe = typeof window !== "undefined" && window.self !== window.top;

  if (loading) {
    return (
      <div className="w-full min-h-[100dvh] flex flex-col items-center justify-center space-y-4 p-6 bg-white text-slate-900 dark:bg-black dark:text-white">
        <div className="w-10 h-10 rounded-full border-4 border-red-600 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500 dark:text-zinc-400 font-serif italic">{translate("centering", language)}</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // Define tab navigation buttons
  const navigationItems = [
    { id: "daily", label: translate("daily_verse", language), icon: Calendar },
    { id: "chapters", label: translate("chapter_guides", language), icon: BookOpen },
    { id: "search", label: translate("explorer", language), icon: Search },
    { id: "chat", label: translate("guided_study", language), icon: MessageSquare },
    { id: "devotionals", label: translate("devotionals", language), icon: Sparkles },
    { id: "prayers", label: translate("prayer_companion", language), icon: Heart },
    { id: "churches", label: translate("church_finder", language), icon: MapPin },
    { id: "profile", label: translate("dashboard", language), icon: User }
  ];

  return (
    <div className="w-full min-h-[100dvh] bg-white text-slate-900 dark:bg-black dark:text-white flex flex-col font-sans transition-colors duration-200">
      {/* Universal Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-slate-100 dark:border-neutral-800">
        <div className="max-w-6xl w-full mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          {/* Logo brand */}
          <div 
            onClick={() => setActiveTab("daily")} 
            className="flex items-center space-x-2 cursor-pointer hover:opacity-90 select-none"
          >
            <div className="p-1.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-serif font-extrabold tracking-tight text-slate-900 dark:text-white">
                DailyBible
              </h1>
            </div>
          </div>

          {/* Quick actions: Streak + Theme toggle */}
          <div className="flex items-center space-x-2.5 text-sm font-sans font-medium">
            {/* Reading Streak ticker */}
            <div 
              onClick={() => setActiveTab("profile")}
              className="flex items-center space-x-1 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/15 text-red-600 dark:text-red-400 rounded-full transition cursor-pointer"
              title={translate("streak_label", language)}
            >
              <Flame className="w-3.5 h-3.5 fill-red-500 text-red-500" />
              <span className="font-bold text-xs select-none">{streak}d</span>
            </div>

            {/* Language Selection */}
            <LanguageSelector />

            {/* Dark & Light mode switch */}
            <ThemeToggleButton />

            {/* Popout preview inside iframe context */}
            {isIframe && (
              <button
                onClick={() => window.open(window.location.href, "_blank")}
                title={translate("open_tab", language)}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-neutral-900 dark:hover:bg-neutral-800 rounded-xl text-slate-500 dark:text-zinc-400 transition cursor-pointer flex items-center justify-center border border-slate-100 dark:border-neutral-800"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main layout routing wrapper */}
      <main className="flex-grow w-full max-w-6xl mx-auto px-4 md:px-6 py-6 pb-24 md:pb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Desktop/Tablet Left-Rail Navigation Sidebar */}
          <aside className="hidden md:block md:col-span-3 lg:col-span-3 space-y-6 select-none">
            <div className="bg-slate-50 dark:bg-[#1C1C1E] border border-slate-100 dark:border-gray-800 p-5 rounded-3xl shadow-sm space-y-4">
              <div className="px-2">
                <h4 className="text-[10px] font-bold tracking-widest text-slate-400 dark:text-zinc-500 uppercase font-sans">
                  Navigation
                </h4>
              </div>

              <nav className="flex flex-col space-y-1">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isSelected = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`flex items-center space-x-3 py-3 px-4 rounded-2xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400"
                          : "text-slate-600 hover:text-slate-800 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-neutral-800/60"
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Active Work Views Container */}
          <section className="md:col-span-9 lg:col-span-9 min-h-[450px]">
            <Suspense fallback={
              <div className="flex flex-col items-center justify-center p-16 space-y-4 bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 rounded-3xl min-h-[400px]">
                <div className="w-8 h-8 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
                <p className="text-sm text-slate-500 dark:text-zinc-400 font-sans italic">
                  {translate("centering", language)}
                </p>
              </div>
            }>
              {activeTab === "daily" && <DailyVerse />}
              {activeTab === "search" && <BibleSearch />}
              {activeTab === "chat" && <AiAssistant />}
              {activeTab === "devotionals" && <Devotionals />}
              {activeTab === "chapters" && <ChapterSummaries />}
              {activeTab === "prayers" && <PrayerCompanion />}
              {activeTab === "churches" && <ChurchFinder />}
              {activeTab === "profile" && <UserDashboard />}
            </Suspense>
          </section>
        </div>
      </main>

      {/* Fixed Bottom Navigation Bar (constrained to md:hidden) */}
      <nav 
        id="bottom-nav-bar" 
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border-t border-slate-100 dark:border-neutral-800/80 w-full px-1 py-2 flex justify-around items-center shadow-lg md:hidden"
      >
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isSelected = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center justify-center py-1 transition-all duration-200 rounded-xl relative cursor-pointer select-none w-14 ${
                isSelected
                  ? "text-red-600 dark:text-red-500 font-semibold scale-105"
                  : "text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300"
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[9px] font-medium tracking-tight truncate max-w-full">
                {item.label}
              </span>
              {isSelected && (
                <span className="absolute bottom-0 w-1.5 h-1.5 bg-red-600 dark:bg-red-500 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <MainAppLayout />
      </AppProvider>
    </ThemeProvider>
  );
}
