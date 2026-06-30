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
  ExternalLink
} from "lucide-react";

function MainAppLayout() {
  const { user, loading, isDarkMode, toggleTheme, streak, language } = useApp();
  const [activeTab, setActiveTab] = useState<"daily" | "search" | "chat" | "chapters" | "prayers" | "devotionals" | "profile">("daily");
  
  const isIframe = typeof window !== "undefined" && window.self !== window.top;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500 dark:text-slate-400 font-serif italic">{translate("centering", language)}</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // Define tab navigation buttons
  const navigationItems = [
    { id: "daily", label: translate("daily_verse", language), icon: Calendar },
    { id: "search", label: translate("explorer", language), icon: Search },
    { id: "chat", label: translate("guided_study", language), icon: MessageSquare },
    { id: "devotionals", label: translate("devotionals", language), icon: Sparkles },
    { id: "chapters", label: translate("chapter_guides", language), icon: BookOpen },
    { id: "prayers", label: translate("prayer_companion", language), icon: Heart },
    { id: "profile", label: translate("dashboard", language), icon: User }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-linen-100 text-charcoal-800 dark:bg-charcoal-950 dark:text-linen-100 font-sans transition-colors duration-200">
      {/* Universal Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-charcoal-900/95 backdrop-blur-md border-b border-linen-300 dark:border-charcoal-800">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          {/* Logo brand */}
          <div 
            onClick={() => setActiveTab("daily")} 
            className="flex items-center space-x-2.5 cursor-pointer hover:opacity-90 select-none"
          >
            <div className="p-1.5 bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 rounded-xl">
              <Sparkles className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-lg font-serif font-extrabold tracking-tight text-brand-750 dark:text-linen-100">
                DailyBible
              </h1>
              <p className="text-[10px] text-charcoal-400 font-semibold uppercase tracking-wider hidden sm:block">
                {translate("slogan", language)}
              </p>
            </div>
          </div>

          {/* Quick actions: Streak + Theme toggle + profile */}
          <div className="flex items-center space-x-3 text-sm font-sans font-medium">
            {/* Reading Streak ticker */}
            <div 
              onClick={() => setActiveTab("profile")}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-clay-500/10 hover:bg-clay-500/15 text-clay-700 dark:text-clay-300 rounded-full transition cursor-pointer"
              title={translate("streak_label", language)}
            >
              <Flame className="w-4 h-4 fill-clay-500 text-clay-500" />
              <span className="font-bold text-xs select-none">{streak}d</span>
            </div>

            {/* Language dropdown */}
            <LanguageSelector />

            {/* Dark & Light mode switch */}
            <ThemeToggleButton />

            {/* Popout preview inside iframe context */}
            {isIframe && (
              <button
                onClick={() => window.open(window.location.href, "_blank")}
                title={translate("open_tab", language)}
                className="p-1.5 md:p-2 bg-linen-200/50 hover:bg-linen-200 dark:bg-charcoal-800 dark:hover:bg-charcoal-750 rounded-xl text-charcoal-600 dark:text-linen-300 transition duration-150 cursor-pointer flex items-center justify-center border border-linen-300/30 dark:border-charcoal-700/30 shadow-xs"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}

            {/* Micro avatar profile */}
            <div 
              onClick={() => setActiveTab("profile")}
              className="flex items-center space-x-2 cursor-pointer group"
            >
              <img
                src={user?.photoURL || "https://images.unsplash.com/photo-1544025162-d76694265947?w=100&auto=format&fit=crop&q=80"}
                alt="Mini Avatar"
                className="w-8 h-8 rounded-full border border-brand-500 object-cover"
              />
              <span className="text-xs font-semibold text-charcoal-700 group-hover:text-brand-600 dark:text-linen-300 dark:group-hover:text-brand-300 hidden md:block select-none">
                {user.displayName?.split(" ")[0] || translate("pilgrim", language)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main layout routing wrapper */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-6 py-6 pb-24">
        {/* Responsive Mobile top nav rail (hidden on desk) */}
        <div className="flex xl:hidden bg-linen-200 dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 p-1 rounded-2xl mb-6 overflow-x-auto gap-1 no-scrollbar-x select-none">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex items-center space-x-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl flex-shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? "bg-white dark:bg-charcoal-800 text-brand-700 dark:text-brand-300 shadow-sm border border-linen-300 dark:border-charcoal-700"
                    : "text-charcoal-600 hover:text-charcoal-800 dark:text-charcoal-400 dark:hover:text-linen-200"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Desktop Left-Rail Navigation Selector */}
          <aside className="hidden xl:block xl:col-span-3 space-y-6 select-none">
            <div className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 p-5 rounded-3xl shadow-xs space-y-4">
              <div className="px-2">
                <h4 className="text-[10px] font-bold tracking-widest text-charcoal-400 dark:text-charcoal-500 uppercase font-sans">
                  {translate("study_nav", language)}
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
                          ? "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300"
                          : "text-charcoal-600 hover:text-charcoal-800 hover:bg-linen-200 dark:text-charcoal-400 dark:hover:text-linen-100 dark:hover:bg-charcoal-800/60"
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Liturgical encouragement box */}
            <div className="bg-gradient-to-br from-brand-650 to-brand-700 text-linen-50 p-6 rounded-3xl shadow-xs space-y-2.5 relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-10 translate-y-4 translate-x-4">
                <Globe className="w-36 h-36" />
              </div>
              <h5 className="font-serif font-extrabold text-sm text-brand-300 tracking-wide uppercase uppercase-spacing">{translate("daily_tip_title", language)}</h5>
              <p className="text-xs leading-relaxed font-medium">
                {translate("daily_tip_desc", language)}
              </p>
            </div>
          </aside>

          {/* Active Work Views Container */}
          <section className="xl:col-span-9 min-h-[450px]">
            <Suspense fallback={
              <div className="flex flex-col items-center justify-center p-16 space-y-4 bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-3xl min-h-[400px]">
                <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                <p className="text-sm text-charcoal-600 dark:text-charcoal-400 font-sans italic">
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
              {activeTab === "profile" && <UserDashboard />}
            </Suspense>
          </section>
        </div>
      </main>

      {/* Liturgical Small Footer */}
      <footer className="bg-white dark:bg-charcoal-900 border-t border-linen-300 dark:border-charcoal-800 py-6">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between text-xs text-charcoal-450 dark:text-charcoal-600 gap-4">
          <p className="font-sans font-medium text-center md:text-left">
            {translate("footer_credits", language)}
          </p>
          <div className="flex space-x-4 font-sans justify-center md:justify-end">
            <span>{translate("uplifting", language)}</span>
            <span>•</span>
            <span>{translate("non_denom", language)}</span>
            <span>•</span>
            <span>{translate("biblical", language)}</span>
          </div>
        </div>
      </footer>
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
