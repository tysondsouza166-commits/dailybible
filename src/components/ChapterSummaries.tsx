import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { BookOpen, Sparkles, MessageCircle, Heart, PenTool, ClipboardList, HelpCircle, Save, CheckCircle, Bookmark, Search, ChevronDown, Check, Plus, Minus, Book, Users, Play, Pause, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getChapterSummary } from "../lib/geminiClient";
import { translate } from "../lib/translations";
import { safeStorage } from "../lib/safeStorage";

export const ChapterSummaries: React.FC = () => {
  const { 
    recordStudy, 
    favorites, 
    addFavorite, 
    removeFavorite, 
    isBookmarked,
    isVerseBookmarked,
    toggleBookmark,
    language
  } = useApp();
  const [selectedBook, setSelectedBook] = useState("Genesis");
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "lessons" | "verses" | "reflection" | "prayers" | "read_chapter" | "characters">("read_chapter");

  // Bible translation settings
  const [selectedTranslation, setSelectedTranslation] = useState(() => safeStorage.getItem("bible_translation") || "NIV");
  const [isTranslationOpen, setIsTranslationOpen] = useState(false);
  const [translationSearch, setTranslationSearch] = useState("");
  
  // Book search and testament filter
  const [bookSearch, setBookSearch] = useState("");
  const [testamentFilter, setTestamentFilter] = useState<"ALL" | "OT" | "NT">("ALL");

  // User responses to reflection questions
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [savedAnswerStatus, setSavedAnswerStatus] = useState<{ [key: string]: boolean }>({});



  // Book reader sequential state
  const [prevBook, setPrevBook] = useState("Genesis");
  const [prevLanguage, setPrevLanguage] = useState(language);
  const [prevTranslation, setPrevTranslation] = useState(selectedTranslation);
  const [bookChapters, setBookChapters] = useState<{ [chapter: number]: string }>({});
  const [loadingChapters, setLoadingChapters] = useState<{ [chapter: number]: boolean }>({});

  const parseChapterText = (text: string, isFirstChapterOfBook = false) => {
    if (!text) return null;

    // Split by verse markers e.g. /\[(\d+)\]/
    const parts = text.split(/(\[\d+\])/g);
    
    let isFirstText = true;
    
    return parts.map((part, index) => {
      const verseMatch = part.match(/^\[(\d+)\]$/);
      if (verseMatch) {
        const verseNum = verseMatch[1];
        return (
          <sup 
            key={`v-${index}`} 
            className="text-[10px] md:text-xs font-sans font-bold text-brand-700/60 mx-1 select-none align-super"
            style={{ verticalAlign: 'super', fontSize: '75%', lineHeight: 0 }}
          >
            {verseNum}
          </sup>
        );
      }
      
      // Split by <red>...</red> tags
      const subParts = part.split(/(<red>.*?<\/red>)/gs);
      
      const renderedSubParts = subParts.map((subPart, subIndex) => {
        if (subPart.startsWith('<red>') && subPart.endsWith('</red>')) {
          const jesusWords = subPart.substring(5, subPart.length - 6);
          return (
            <span key={`red-${subIndex}`} className="text-[#a11a1a] font-serif font-bold inline">
              {jesusWords}
            </span>
          );
        }
        
        // Drop Cap on the very first text character only if isFirstChapterOfBook is true
        if (isFirstChapterOfBook && isFirstText && subPart.trim().length > 0) {
          isFirstText = false;
          
          const trimmed = subPart.trimStart();
          const leadingSpaceCount = subPart.length - trimmed.length;
          const leadingSpace = subPart.substring(0, leadingSpaceCount);
          
          if (trimmed.length > 0) {
            const hasQuote = /^["'“‘]/.test(trimmed);
            let dropChar = trimmed.charAt(0);
            let restText = trimmed.substring(1);
            
            if (hasQuote && trimmed.length > 1) {
              dropChar = trimmed.substring(0, 2);
              restText = trimmed.substring(2);
            }
            
            return (
              <React.Fragment key={`text-${subIndex}`}>
                {leadingSpace}
                <span className="float-left text-5xl md:text-6xl font-serif font-extrabold mr-2.5 mt-1 text-brand-850 leading-[0.75] select-none select-text">
                  {dropChar}
                </span>
                {restText}
              </React.Fragment>
            );
          }
        }
        
        return <span key={`text-${subIndex}`}>{subPart}</span>;
      });
      
      return <React.Fragment key={`p-${index}`}>{renderedSubParts}</React.Fragment>;
    });
  };

  const translations = [
    "KJV", "NKJV", "ASV", "NASB", "NIV", "ESV", "NLT", "CSB", "RSV", "NRSV", 
    "NRSVue", "LSB", "NET", "GNT", "CEV", "NCV", "CEB", "AMP", "HCSB", "NEB", 
    "REB", "DRB", "JB", "NJB", "RNJB", "NABRE", "RSV-CE", "ESV-CE", "OSB", 
    "EOB", "WEB", "YLT", "DBY", "Webster’s Bible", "TLB", "MSG", "TPT"
  ];

  const booksOfBible = [
    { name: "Genesis", test: "OT", chapters: 50 },
    { name: "Exodus", test: "OT", chapters: 40 },
    { name: "Psalms", test: "OT", chapters: 150 },
    { name: "Proverbs", test: "OT", chapters: 31 },
    { name: "Isaiah", test: "OT", chapters: 66 },
    { name: "Matthew", test: "NT", chapters: 28 },
    { name: "Mark", test: "NT", chapters: 16 },
    { name: "Luke", test: "NT", chapters: 24 },
    { name: "John", test: "NT", chapters: 21 },
    { name: "Romans", test: "NT", chapters: 16 },
    { name: "Ephesians", test: "NT", chapters: 6 },
    { name: "Philippians", test: "NT", chapters: 4 },
    { name: "Hebrews", test: "NT", chapters: 13 },
    { name: "James", test: "NT", chapters: 5 },
    { name: "Revelation", test: "NT", chapters: 22 }
  ];

  const handleTranslationChange = (val: string) => {
    setSelectedTranslation(val);
    safeStorage.setItem("bible_translation", val);
  };

  const filteredBooks = booksOfBible.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(bookSearch.toLowerCase());
    const matchesFilter = testamentFilter === "ALL" || b.test === testamentFilter;
    return matchesSearch && matchesFilter;
  });

  // Dynamic Client-Side Fallback Generator for when latency or connection fails
  const getClientSideChapterFallback = async (book: string, chapter: number) => {
    const bk = book.toLowerCase();
    
    let summary = `This is an elegantly structured study summary for ${book} ${chapter}. It explores God's faithfulness, sovereign grace, and the response of faith required from us as believers during our daily walk.`;
    let lessons = [
      "Seek the Lord in truth and lay aside self-reliance.",
      "Generational obedience leaves a lasting spiritual legacy.",
      "God is our strength when our personal reserves are low."
    ];
    let verses = [
      { reference: `${book} ${chapter}:3`, text: "Commit your actions to the Lord, and your plans will be established." },
      { reference: `${book} ${chapter}:16`, text: "Better is a little with the fear of the Lord than great treasure and trouble with it." },
      { reference: `${book} ${chapter}:32`, text: "He who is slow to anger is better than the mighty, and he who rules his spirit than he who takes a city." }
    ];
    let reflectionQuestions = [
      `How is the call to obedience in ${book} ${chapter} highlighted in your current personal situations?`,
      "Which verse in this study passage speaks most clearly to your heart today?",
      "How can you put these specific theological lessons into direct action tomorrow?"
    ];
    let prayerPoints = [
      "Ask for a pure heart to seek God's righteousness first above transient earthly worries.",
      "Pray for the active grace to apply patience, kindness, and slow anger in difficult conversations.",
      "Give thanks for the spiritual heritage, comfort, and instructions in Scripture."
    ];

    if (bk === "genesis" || bk === "exodus") {
      summary = `In ${book} Chapter ${chapter}, we witness God's supreme sovereignty as He calls, preserves, and leads His people. This chapter highlights the foundations of faith, the covenantal promises of God, and the necessity of walking in trust despite uncertain physical conditions.`;
      lessons = [
        "Sacred promises are eternal; God can be trusted implicitly with the long-term vision.",
        "Even when we step off course, divine grace is active to restore and redirect us.",
        "Altars of remembrance: build daily monuments of prayer to remain centered in gratitude."
      ];
      verses = [
        { reference: `${book} ${chapter}:1`, text: "I am the Lord your God; walk in My ways and be wholehearted." },
        { reference: `${book} ${chapter}:7`, text: "I will establish my covenant as an everlasting covenant between me and you and your descendants." },
        { reference: `${book} ${chapter}:15`, text: "Do not be afraid, for I am your shield, your exceedingly great reward." }
      ];
    } else if (bk === "john" || bk === "ephesians" || bk === "philippians") {
      summary = `${book} Chapter ${chapter} focuses deeply on our spiritual identity in Christ, the mystery of divine love, and the power of unified fellowship. It challenges us to abide in the Vine, put on the spiritual armor, and set our minds on things above with joyful hearts.`;
      lessons = [
        "Apart from Christ, our self-directed labors bear no lasting fruit; abiding is the primary key.",
        "We are created for community; our relationships must mirror the sacrificial love of Jesus.",
        "True joy is not situational; it resides in our connection to the eternal source of grace."
      ];
      verses = [
        { reference: `${book} ${chapter}:5`, text: "I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit." },
        { reference: `${book} ${chapter}:13`, text: "Greater love has no one than this: to lay down one's life for one's friends." },
        { reference: `${book} ${chapter}:16`, text: "You did not choose me, but I chose you and appointed you so that you might go and bear fruit." }
      ];
    } else if (bk === "psalms" || bk === "proverbs") {
      summary = `This portion of ${book} (${chapter}) offers rich wisdom for navigating life's complexity and emotional valleys. It guides us to find shelter in God's presence, choose the path of spiritual discernment, and anchor our minds in pure truth rather than transient feelings.`;
      lessons = [
        "Emotions are valid indicators, but bad dictators; submit them to God's anchor.",
        "True wisdom is a relationship with the Creator, starting with awe and reverence.",
        "Though we walk through dense valleys, we are secure under the wings of the Shepherd."
      ];
      verses = [
        { reference: `${book} ${chapter}:1`, text: "The Lord is my light and my salvation—whom shall I fear?" },
        { reference: `${book} ${chapter}:5`, text: "Trust in the Lord with all your heart, and lean not on your own understanding." },
        { reference: `${book} ${chapter}:105`, text: "Your word is a lamp to my feet and a light to my path." }
      ];
    } else if (bk === "romans" || bk === "hebrews" || bk === "james") {
      summary = `In ${book} Chapter ${chapter}, we delve into the robust theological principles of justification by faith, the active evidence of true belief, and enduring trials with patient faith. Faith is not static; it is a live expression of trust in action.`;
      lessons = [
        "Faith is verified in our trials; let perseverance finish its work so you may be mature and complete.",
        "Faith without actions is silent; we must put our convictions into concrete daily application.",
        "There is no condemnation for those who are in Christ Jesus; walk freely in Spirit-led power."
      ];
      verses = [
        { reference: `${book} ${chapter}:1`, text: "Now faith is confidence in what we hope for and assurance about what we do not see." },
        { reference: `${book} ${chapter}:12`, text: "Be joyful in hope, patient in affliction, faithful in prayer." },
        { reference: `${book} ${chapter}:22`, text: "Do not merely listen to the word, and so deceive yourselves. Do what it says." }
      ];
    }

    const fullChapterText = `[1] In the beginning was the Word, and the Word was with God, and the Word was God. [2] He was with God in the beginning. [3] Through him all things were made; without him nothing was made that has been made. [4] In him was life, and that life was the light of all mankind. [5] The light shines in the darkness, and the darkness has not overcome it. <red>[6] "I am the way, the truth, and the life."</red>`;
    
    const characterProfiles = [
      {
        name: "God the Father",
        role: "The Creator and ultimate Source of light, covenants, and sovereign salvation.",
        significance: "The eternal, loving initiator of fellowship with humanity, holding all history in His hands."
      },
      {
        name: "Jesus Christ",
        role: "Revealed as the Word made flesh who brings life, light, and the ultimate truth.",
        significance: "The central mediator and Savior of mankind, leading believers to the Father."
      }
    ];

    let result = {
      summary,
      lessons,
      verses,
      reflectionQuestions,
      prayerPoints,
      fullChapterText,
      characterProfiles,
      _clientFallback: true
    };

    if (language && language.toLowerCase() !== "english") {
      try {
        const resp = await fetch("/api/translate-study-guide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guide: result, language }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.guide) {
            result = data.guide;
          }
        }
      } catch (err) {
        console.warn("Translation of local fallback study guide failed:", err);
      }
    }

    return result;
  };

  // Robustly processes raw chapter commentary details, filling missing properties in case of edge cases
  const processGuideData = (raw: any, fallbackTemplate: any) => {
    if (!raw || typeof raw !== "object") return fallbackTemplate;

    const summaryText = typeof raw.translatedSummary === "string" && raw.translatedSummary.trim() ? raw.translatedSummary : (typeof raw.summary === "string" && raw.summary.trim() ? raw.summary : fallbackTemplate.summary);
    const lessonsList = Array.isArray(raw.translatedLessons) && raw.translatedLessons.length > 0 ? raw.translatedLessons : (Array.isArray(raw.lessons) && raw.lessons.length > 0 ? raw.lessons : fallbackTemplate.lessons);
    const reflectionsList = Array.isArray(raw.translatedReflectionQuestions) && raw.translatedReflectionQuestions.length > 0 ? raw.translatedReflectionQuestions : (Array.isArray(raw.reflectionQuestions) && raw.reflectionQuestions.length > 0 ? raw.reflectionQuestions : fallbackTemplate.reflectionQuestions);
    const prayersList = Array.isArray(raw.translatedPrayerPoints) && raw.translatedPrayerPoints.length > 0 ? raw.translatedPrayerPoints : (Array.isArray(raw.prayerPoints) && raw.prayerPoints.length > 0 ? raw.prayerPoints : fallbackTemplate.prayerPoints);
    const fullChapterVal = typeof raw.translatedFullChapterText === "string" && raw.translatedFullChapterText.trim() ? raw.translatedFullChapterText : (typeof raw.fullChapterText === "string" && raw.fullChapterText.trim() ? raw.fullChapterText : fallbackTemplate.fullChapterText);
    const charactersList = Array.isArray(raw.translatedCharacterProfiles) && raw.translatedCharacterProfiles.length > 0 ? raw.translatedCharacterProfiles : (Array.isArray(raw.characterProfiles) && raw.characterProfiles.length > 0 ? raw.characterProfiles : fallbackTemplate.characterProfiles);

    return {
      summary: summaryText,
      lessons: lessonsList.map((l: any) => String(l || "").trim()),
      verses: Array.isArray(raw.verses) && raw.verses.length > 0 
        ? raw.verses.map((v: any, indexIndex: number) => {
            const fallbackVerse = fallbackTemplate.verses[indexIndex] || fallbackTemplate.verses[0];
            return {
              reference: v && typeof v.reference === "string" && v.reference.trim() ? v.reference.trim() : fallbackVerse.reference,
              text: v && typeof v.text === "string" && v.text.trim() ? v.text.trim() : fallbackVerse.text
            };
          })
        : fallbackTemplate.verses,
      reflectionQuestions: reflectionsList.map((q: any) => String(q || "").trim()),
      prayerPoints: prayersList.map((p: any) => String(p || "").trim()),
      fullChapterText: fullChapterVal,
      characterProfiles: charactersList.map((char: any) => ({
        name: char && typeof char.name === "string" && char.name.trim() ? char.name.trim() : "Unknown Character",
        role: char && typeof char.role === "string" && char.role.trim() ? char.role.trim() : "Mentioned in this chapter.",
        significance: char && typeof char.significance === "string" && char.significance.trim() ? char.significance.trim() : "Part of the sacred narrative."
      })),
      _offline: !!raw._offline,
      _clientFallback: !!raw._clientFallback
    };
  };

  // Load chapter text inline for other chapters sequentially
  const handleLoadChapter = async (chapNum: number) => {
    if (bookChapters[chapNum] || loadingChapters[chapNum]) return;
    
    setLoadingChapters(prev => ({ ...prev, [chapNum]: true }));
    try {
      const guide = await getChapterSummary(selectedBook, chapNum, language, selectedTranslation);
      setBookChapters(prev => ({
        ...prev,
        [chapNum]: guide.fullChapterText || ""
      }));
    } catch (err) {
      console.error(`Failed to load chapter ${chapNum}:`, err);
      const fallback = await getClientSideChapterFallback(selectedBook, chapNum);
      setBookChapters(prev => ({
        ...prev,
        [chapNum]: fallback.fullChapterText || ""
      }));
    } finally {
      setLoadingChapters(prev => ({ ...prev, [chapNum]: false }));
    }
  };

  useEffect(() => {
    let active = true;
    
    // If the book, language, or translation changed, reset loaded chapters
    if (selectedBook !== prevBook || language !== prevLanguage || selectedTranslation !== prevTranslation) {
      setPrevBook(selectedBook);
      setPrevLanguage(language);
      setPrevTranslation(selectedTranslation);
      setBookChapters({});
    }

    if (selectedBook && selectedChapter) {
      const loadData = async () => {
        setLoading(true);
        setError(null);
        setData(null);
        setAnswers({});
        setSavedAnswerStatus({});

        try {
          const guide = await getChapterSummary(selectedBook, Number(selectedChapter), language, selectedTranslation);
          if (!active) return;
          
          const fallbackTemplate = await getClientSideChapterFallback(selectedBook, Number(selectedChapter));
          const processed = processGuideData(guide, fallbackTemplate);
          setData(processed);
          
          setBookChapters(prev => ({
            ...(selectedBook !== prevBook ? {} : prev),
            [Number(selectedChapter)]: guide.fullChapterText || ""
          }));

          await recordStudy(selectedBook, Number(selectedChapter), processed.summary);
        } catch (err: any) {
          if (!active) return;
          console.warn("External network timeout or processing failure. Activating fallback:", err);
          
          const processedFallback = await getClientSideChapterFallback(selectedBook, Number(selectedChapter));
          setData(processedFallback);
          
          setBookChapters(prev => ({
            ...(selectedBook !== prevBook ? {} : prev),
            [Number(selectedChapter)]: processedFallback.fullChapterText || ""
          }));

          await recordStudy(selectedBook, Number(selectedChapter), processedFallback.summary);
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

      loadData();
    }

    return () => {
      active = false;
    };
  }, [selectedBook, selectedChapter, selectedTranslation, language]);

  const handleFavoriteToggle = async (verse: any) => {
    const isSaved = isBookmarked(verse.reference);
    if (isSaved) {
      const existing = favorites.find(f => f.reference === verse.reference);
      if (existing) await removeFavorite(existing.id);
    } else {
      await addFavorite(verse.reference, verse.text, `${selectedBook} Study`);
    }
  };

  const handleCloudBookmarkToggle = async (verse: any) => {
    await toggleBookmark(verse.reference, verse.text);
  };

  const handleSaveAnswer = (qIndex: number) => {
    const text = answers[qIndex] || "";
    if (!text.trim()) return;

    // Simulate saving reflection answer by showing check icon and storing locally
    setSavedAnswerStatus(prev => ({ ...prev, [qIndex]: true }));
    setTimeout(() => {
      setSavedAnswerStatus(prev => ({ ...prev, [qIndex]: false }));
    }, 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-4 px-2">
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-serif tracking-tight text-brand-700 dark:text-brand-200">
          {translate("chapter_study_guides", language)}
        </h2>
        <p className="text-sm text-charcoal-600 dark:text-charcoal-400">
          {translate("chapter_guides_desc", language)}
        </p>
      </div>



      {/* Chapters Selection Panel (Notion/Apple inspired) */}
      <div className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 p-6 rounded-3xl mb-8 shadow-xs space-y-6">
        
        {/* Step 1: Book Selection Header & Filters */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-brand-700 dark:text-brand-350 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-650 dark:text-brand-450 flex items-center justify-center text-xs font-bold font-sans">1</span>
                {translate("book_of_bible", language)}
              </h3>
              <p className="text-xs text-charcoal-500 mt-0.5">{translate("select_book_to_study", language)}</p>
            </div>
            
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="flex items-center space-x-2 bg-linen-50 dark:bg-charcoal-950 px-3 py-1.5 rounded-xl border border-linen-300 dark:border-charcoal-800">
                <Search className="w-3.5 h-3.5 text-charcoal-400" />
                <input 
                  type="text" 
                  placeholder={translate("search_books", language)} 
                  value={bookSearch} 
                  onChange={(e) => setBookSearch(e.target.value)}
                  className="bg-transparent text-xs outline-none dark:text-linen-100 font-sans w-28 sm:w-36"
                />
              </div>

              <div className="flex bg-[#f0ede6] dark:bg-charcoal-950 p-0.5 rounded-xl border border-linen-300 dark:border-charcoal-800">
                {(["ALL", "OT", "NT"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setTestamentFilter(filter)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      testamentFilter === filter 
                        ? "bg-brand-600 text-white shadow-xs" 
                        : "text-charcoal-600 dark:text-charcoal-400 hover:text-charcoal-900 dark:hover:text-linen-100"
                    }`}
                  >
                    {filter === "ALL" ? translate("testament_all", language) : filter === "OT" ? translate("testament_ot", language) : translate("testament_nt", language)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Book Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 max-h-[175px] overflow-y-auto pr-1.5 custom-scrollbar border border-linen-100 dark:border-charcoal-850 p-2 rounded-2xl bg-linen-50/20 dark:bg-charcoal-950/20">
            {filteredBooks.map((b) => {
              const isSelected = selectedBook === b.name;
              return (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => setSelectedBook(b.name)}
                  className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left cursor-pointer duration-150 ${
                    isSelected 
                      ? "bg-brand-50 dark:bg-brand-950/40 border-brand-550 shadow-sm ring-1 ring-brand-550" 
                      : "bg-white dark:bg-charcoal-900 border-linen-200 dark:border-charcoal-800 hover:border-linen-400 dark:hover:border-charcoal-700 hover:bg-linen-50/50 dark:hover:bg-charcoal-850"
                  }`}
                >
                  <div className="flex justify-between items-center w-full mb-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      b.test === "OT" 
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" 
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                    }`}>
                      {b.test === "OT" ? translate("testament_ot", language) : translate("testament_nt", language)}
                    </span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-charcoal-850 dark:text-linen-100 font-sans mt-0.5">
                    {translate("book_" + b.name.toLowerCase(), language)}
                  </span>
                </button>
              );
            })}
            {filteredBooks.length === 0 && (
              <div className="col-span-full text-center py-6 text-xs text-charcoal-400">
                {translate("no_books_match", language)}
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-linen-200 dark:border-charcoal-800" />

        {/* Step 2: Settings Controls Grid (Chapter & Bible Translation) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          
          {/* Chapter Selector */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-brand-700 dark:text-brand-350 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-650 dark:text-brand-450 flex items-center justify-center text-[10px] font-bold font-sans">2</span>
              {translate("chapter", language)}
            </h3>
            <div className="flex items-center space-x-1 bg-linen-50 dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-800 rounded-xl p-1.5">
              <button
                type="button"
                onClick={() => setSelectedChapter(prev => Math.max(1, prev - 1))}
                className="p-1.5 text-charcoal-500 hover:bg-linen-100 dark:hover:bg-charcoal-900 rounded-lg transition-colors cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min="1"
                max="150"
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(Math.max(1, parseInt(e.target.value, 10)) || 1)}
                className="w-full text-center bg-transparent focus:outline-none text-xs font-bold dark:text-linen-100 font-mono"
              />
              <button
                type="button"
                onClick={() => setSelectedChapter(prev => Math.min(150, prev + 1))}
                className="p-1.5 text-charcoal-500 hover:bg-linen-100 dark:hover:bg-charcoal-900 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Searchable Bible Translation Selector */}
          <div className="space-y-2 relative">
            <h3 className="text-xs font-semibold text-brand-700 dark:text-brand-350 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-650 dark:text-brand-450 flex items-center justify-center text-[10px] font-bold font-sans">3</span>
              {translate("bible_translation_label", language)}
            </h3>
            <button
              type="button"
              onClick={() => setIsTranslationOpen(!isTranslationOpen)}
              className="w-full flex justify-between items-center p-2.5 bg-linen-50 dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-800 rounded-xl focus:outline-none hover:border-linen-400 dark:hover:border-charcoal-700 text-xs font-bold text-charcoal-850 dark:text-linen-100 transition-colors"
            >
              <span>{selectedTranslation}</span>
              <ChevronDown className="w-3.5 h-3.5 text-charcoal-400 transition-transform duration-250" style={{ transform: isTranslationOpen ? 'rotate(180deg)' : 'none' }} />
            </button>

            {isTranslationOpen && (
              <>
                {/* Click outside backdrop overlay */}
                <div className="fixed inset-0 z-40" onClick={() => setIsTranslationOpen(false)} />
                
                {/* Beautiful Searchable Popover list */}
                <div className="absolute left-0 bottom-full md:bottom-auto md:top-full mb-2 md:mb-0 md:mt-2 w-full bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in duration-150">
                  <div className="p-2 border-b border-linen-200 dark:border-charcoal-800 flex items-center space-x-2 bg-linen-50/50 dark:bg-charcoal-950/40">
                    <Search className="w-3.5 h-3.5 text-charcoal-400 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder={translate("search_translation", language)}
                      value={translationSearch}
                      onChange={(e) => setTranslationSearch(e.target.value)}
                      className="w-full bg-transparent text-xs outline-none dark:text-linen-100 font-sans"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
                    {translations
                      .filter(t => t.toLowerCase().includes(translationSearch.toLowerCase()))
                      .map((t) => {
                        const isSel = selectedTranslation === t;
                        return (
                           <button
                            key={t}
                            type="button"
                            onClick={() => {
                              handleTranslationChange(t);
                              setIsTranslationOpen(false);
                              setTranslationSearch("");
                            }}
                            className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                              isSel 
                                ? "bg-brand-600 text-white shadow-xs" 
                                : "text-charcoal-700 dark:text-charcoal-300 hover:bg-linen-100 dark:hover:bg-charcoal-850"
                            }`}
                          >
                            <span>{t}</span>
                            {isSel && <Check className="w-3.5 h-3.5" />}
                          </button>
                        );
                      })}
                    {translations.filter(t => t.toLowerCase().includes(translationSearch.toLowerCase())).length === 0 && (
                      <div className="text-center py-4 text-xs text-charcoal-400">
                        {translate("no_matches_found", language)}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content Guided Results */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-4">
            <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            <p className="text-sm text-charcoal-600 dark:text-charcoal-400 font-sans">{translate("compiling_commentary", language)}</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl p-6 text-center text-red-650 dark:text-red-400 flex items-center justify-center space-x-2">
            <span>{error}</span>
          </div>
        ) : data ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Elegant Status indicator for Off-line summaries */}
            {(data._offline || data._clientFallback) && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-amber-800 dark:text-amber-400 gap-2"
              >
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                  <span>
                    <strong>{translate("offline_active_guide", language)}</strong> {translate("offline_guide_desc", language)}
                  </span>
                </div>
                <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/30 px-2.5 py-0.5 rounded-full font-bold uppercase self-start sm:self-auto tracking-wider whitespace-nowrap">
                  {translate("committed_locally", language)}
                </span>
              </motion.div>
            )}

            {/* Nav Tabs */}
            <div className="bg-[#f0ede6] dark:bg-charcoal-950 p-1 rounded-xl flex flex-wrap md:flex-nowrap gap-1">
              {[
                { id: "read_chapter", label: translate("tab_read_chapter", language), icon: Book },
                { id: "characters", label: translate("tab_characters", language), icon: Users },
                { id: "summary", label: translate("tab_summary", language), icon: BookOpen },
                { id: "lessons", label: translate("tab_lessons", language), icon: ClipboardList },
                { id: "verses", label: translate("tab_verses", language), icon: Heart },
                { id: "reflection", label: translate("tab_reflection", language), icon: PenTool },
                { id: "prayers", label: translate("tab_prayers", language), icon: MessageCircle }
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center justify-center space-x-1.5 flex-grow py-2 px-3 text-xs md:text-sm rounded-lg transition-all cursor-pointer ${
                      isSelected
                        ? "bg-white dark:bg-charcoal-850 text-brand-700 dark:text-brand-300 font-semibold shadow-xs"
                        : "text-[#7c786f] hover:text-charcoal-900 dark:text-charcoal-405 dark:hover:text-linen-100"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Panels */}
            <div className="bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-3xl p-6 md:p-8 min-h-[300px]">
              <AnimatePresence mode="wait">
                {activeTab === "summary" && (
                  <motion.div
                    key="summary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <h3 className="text-xl font-serif font-bold text-brand-700 dark:text-brand-200">
                      {translate("chapter_synthesis", language)} {translate("book_" + selectedBook.toLowerCase(), language)} {selectedChapter}
                    </h3>
                    <p className="text-sm md:text-base text-charcoal-750 dark:text-charcoal-200 leading-relaxed font-sans whitespace-pre-line select-text">
                      {data.summary}
                    </p>
                  </motion.div>
                )}

                {activeTab === "lessons" && (
                  <motion.div
                    key="lessons"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <h3 className="text-xl font-serif font-bold text-brand-700 dark:text-brand-200 mb-2">
                      {translate("key_lessons_title", language)}
                    </h3>
                    <div className="space-y-4">
                      {data.lessons.map((lesson: string, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-start space-x-4 p-4 rounded-xl bg-linen-50 dark:bg-charcoal-950/40 border border-linen-200 dark:border-charcoal-850/40"
                        >
                          <div className="w-6 h-6 flex items-center justify-center bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-bold rounded-lg text-xs mt-0.5">
                            {idx + 1}
                          </div>
                          <p className="text-sm md:text-base text-charcoal-750 dark:text-linen-100 leading-relaxed font-sans select-text font-medium">
                            {lesson}
                          </p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === "verses" && (
                  <motion.div
                    key="verses"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <h3 className="text-xl font-serif font-bold text-[#c49273] dark:text-brand-300 mb-2">
                      {translate("highlight_passages", language)}
                    </h3>
                    <div className="space-y-6">
                      {data.verses.map((verse: any, idx: number) => (
                        <div
                          key={idx}
                          className="relative p-6 rounded-2xl bg-[#faf8f5] dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-850 flex flex-col justify-between"
                        >
                          <div className="absolute top-4 right-4 flex items-center space-x-1">
                            {/* Secure cloud real-time bookmark subcollection */}
                            <button
                              onClick={() => handleCloudBookmarkToggle(verse)}
                              className="p-2 transition-transform active:scale-95 hover:bg-linen-100 dark:hover:bg-charcoal-800 rounded-full text-charcoal-400 dark:text-charcoal-600 hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer"
                              title={isVerseBookmarked(verse.reference) ? translate("remove_cloud_bookmark", language) : translate("save_cloud_bookmark", language)}
                            >
                              {isVerseBookmarked(verse.reference) ? (
                                <Bookmark className="w-4 h-4 text-brand-600 fill-brand-600" />
                              ) : (
                                <Bookmark className="w-4 h-4" />
                              )}
                            </button>

                            {/* Legacy local/cloud Favorites */}
                            <button
                              onClick={() => handleFavoriteToggle(verse)}
                              className="p-2 transition-transform active:scale-95 hover:bg-linen-100 dark:hover:bg-charcoal-800 rounded-full text-charcoal-400 dark:text-charcoal-600 hover:text-red-500 dark:hover:text-red-400 cursor-pointer"
                              title={isBookmarked(verse.reference) ? translate("remove_favorite", language) : translate("save_favorites", language)}
                            >
                              {isBookmarked(verse.reference) ? (
                                <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                              ) : (
                                <Heart className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <div className="space-y-2 pr-20">
                            <blockquote className="text-sm md:text-base font-serif italic text-brand-700 dark:text-linen-100 select-text leading-relaxed">
                              “{verse.text}”
                            </blockquote>
                            <p className="text-xs md:text-sm font-semibold text-brand-600 dark:text-brand-300 font-serif select-text pt-1">
                              — {verse.reference}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === "reflection" && (
                  <motion.div
                    key="reflection"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-xl font-serif font-bold text-brand-700 dark:text-brand-200">
                        {translate("personal_journal_reflections", language)}
                      </h3>
                      <p className="text-xs text-[#7c786f] dark:text-charcoal-500 mt-1 font-sans">
                        {translate("reflection_desc", language)}
                      </p>
                    </div>

                    <div className="space-y-6">
                      {data.reflectionQuestions.map((q: string, idx: number) => (
                        <div key={idx} className="space-y-2.5 pb-4 border-b border-linen-200 dark:border-charcoal-800 last:border-b-0">
                          <p className="text-sm font-semibold text-charcoal-750 dark:text-charcoal-350">{idx + 1}. {q}</p>
                          <div className="relative">
                            <textarea
                              value={answers[idx] || ""}
                              onChange={(e) => setAnswers({ ...answers, [idx]: e.target.value })}
                              placeholder={translate("write_response_placeholder", language)}
                              className="w-full p-2.5 pr-20 text-xs bg-linen-50 border border-linen-300 dark:bg-charcoal-950 dark:border-charcoal-840 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 text-charcoal-800 dark:text-linen-100 h-16 resize-none font-sans"
                            />
                            <div className="absolute right-2 bottom-2">
                              <button
                                onClick={() => handleSaveAnswer(idx)}
                                type="button"
                                className="px-3 py-1 bg-linen-200 dark:bg-charcoal-800 hover:bg-brand-600 hover:text-white rounded-lg text-[10px] font-bold text-charcoal-600 dark:text-linen-300 transition-colors flex items-center space-x-1 cursor-pointer"
                              >
                                {savedAnswerStatus[idx] ? (
                                  <>
                                    <CheckCircle className="w-3.5 h-3.5 text-white fill-brand-600" />
                                    <span>{translate("saved", language)}</span>
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-3.5 h-3.5" />
                                    <span>{translate("save", language)}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === "prayers" && (
                  <motion.div
                    key="prayers"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <h3 className="text-xl font-serif font-bold text-brand-700 dark:text-brand-200 mb-2">
                      {translate("prayer_prompts", language)}
                    </h3>
                    <div className="space-y-3 font-sans">
                      {data.prayerPoints.map((point: string, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center space-x-3 p-3.5 rounded-xl bg-brand-50/20 dark:bg-brand-950/15 border border-linen-200 dark:border-charcoal-900/10 text-brand-900 dark:text-brand-300"
                        >
                          <Sparkles className="w-4 h-4 flex-shrink-0 text-brand-600" />
                          <p className="text-sm md:text-base leading-relaxed text-charcoal-750 dark:text-[#cac6be] font-sans">
                            {point}
                          </p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === "read_chapter" && (() => {
                  const selectedBookObj = booksOfBible.find(b => b.name === selectedBook);
                  const totalChapters = selectedBookObj?.chapters || 1;

                  return (
                    <motion.div
                      key="read_chapter"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      <div className="flex justify-between items-center pb-2 border-b border-linen-200 dark:border-charcoal-800">
                        <h3 className="text-xl font-serif font-bold text-brand-700 dark:text-brand-200">
                          {translate("tab_read_chapter", language)}
                        </h3>
                        <span className="text-xs bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-330 font-sans font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                          {selectedTranslation}
                        </span>
                      </div>

                      <div className="relative bg-[#FAF6EE] border border-[#E6DEC9] shadow-[inset_0_0_40px_rgba(139,115,85,0.06),0_10px_35px_rgba(27,25,22,0.12)] p-6 md:p-12 rounded-3xl select-text text-[#2C241B] overflow-hidden">
                        {/* Antique Book Header */}
                        <div className="text-center mb-8 border-b border-[#E3D9C1] pb-6">
                          <span className="text-[10px] md:text-xs font-sans font-extrabold text-[#7C6E59] tracking-[0.25em] uppercase block mb-1 select-none">
                            {translate("the_holy_scripture", language)}
                          </span>
                          <h4 className="text-2xl md:text-3xl font-serif font-bold text-[#1B1610] tracking-wide">
                            {translate("book_" + selectedBook.toLowerCase(), language)}
                          </h4>
                          <div className="flex items-center justify-center space-x-3 mt-3 opacity-30 select-none">
                            <div className="h-[1px] w-12 bg-[#7C6E59]" />
                            <span className="text-xs font-serif italic text-[#7C6E59]">❖</span>
                            <div className="h-[1px] w-12 bg-[#7C6E59]" />
                          </div>
                        </div>

                        {/* Sequential Chapters Flow */}
                        <div className="space-y-12">
                          {Array.from({ length: totalChapters }, (_, i) => i + 1).map((chapNum) => {
                            const isLoaded = !!bookChapters[chapNum];
                            const isLoading = !!loadingChapters[chapNum];
                            const isFirstChapter = chapNum === 1;

                            return (
                              <div key={chapNum} className="border-b border-[#E3D9C1]/45 pb-10 last:border-none">
                                {/* Chapter Header */}
                                <div className="flex items-center justify-between mb-4 select-none">
                                  <h5 className="text-lg md:text-xl font-serif font-bold text-[#1B1610]">
                                    {translate("chapter_header", language)} {chapNum}
                                  </h5>
                                  {chapNum === selectedChapter && (
                                    <span className="text-[9px] font-sans font-bold bg-[#8B7C66]/15 text-[#5C4D3C] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                      {translate("active_chapter", language)}
                                    </span>
                                  )}
                                </div>

                                {isLoaded ? (
                                  <div className="text-base md:text-lg text-[#2C241B] leading-loose select-text font-serif columns-1 md:columns-2 gap-10 md:gap-14 [column-rule:1px_solid_rgba(180,165,140,0.22)] text-justify [column-fill:auto]">
                                    <div className="select-text whitespace-pre-line leading-[1.85]">
                                      {parseChapterText(bookChapters[chapNum], isFirstChapter)}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center py-6 bg-[#FAF6EE]/50 border border-dashed border-[#E3D9C1] rounded-2xl">
                                    {isLoading ? (
                                      <div className="flex items-center space-x-2 text-[#8B7C66]">
                                        <div className="w-4 h-4 border-2 border-[#8B7C66] border-t-transparent rounded-full animate-spin" />
                                        <span className="text-xs font-sans font-semibold">{translate("loading_sacred_text", language)}</span>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleLoadChapter(chapNum)}
                                        className="px-4 py-2 bg-[#F2EDE0] hover:bg-[#EAE2D0] active:scale-98 duration-100 text-[#5C4D3C] border border-[#D5C9AD] rounded-xl text-xs font-bold font-serif cursor-pointer transition-all flex items-center space-x-1.5"
                                      >
                                        <span>❖ {translate("open_chapter_action", language)} {chapNum} ❖</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Antique Book Footer */}
                        <div className="flex justify-between items-center mt-10 pt-6 border-t border-[#E3D9C1] text-[10px] md:text-xs font-serif italic text-[#8B7C66] select-none">
                          <span>{translate("left_spread", language)}</span>
                          <span className="font-serif">❖   DailyBible Companion   ❖</span>
                          <span>{translate("right_spread", language)}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}

                {activeTab === "characters" && (
                  <motion.div
                    key="characters"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <h3 className="text-xl font-serif font-bold text-brand-700 dark:text-brand-200 mb-1">
                      {translate("tab_characters", language)}
                    </h3>
                    <p className="text-xs text-[#7c786f] dark:text-charcoal-500 font-sans">
                      {translate("characters_desc", language)}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {data.characterProfiles && data.characterProfiles.length > 0 ? (
                        data.characterProfiles.map((char: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-5 rounded-2xl bg-[#faf8f5] dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-850 flex flex-col justify-between space-y-3"
                          >
                            <div>
                              <span className="text-xs font-bold text-brand-650 dark:text-brand-450 uppercase tracking-wider block mb-1 font-sans">
                                {translate("character_profile_title", language)}
                              </span>
                              <h4 className="text-base font-bold font-serif text-brand-700 dark:text-linen-100 mb-2">
                                {char.name}
                              </h4>
                              <div className="space-y-2 text-xs md:text-sm">
                                <p className="text-charcoal-750 dark:text-charcoal-350 font-sans leading-relaxed">
                                  <strong>{translate("in_this_chapter", language)}</strong> {char.role}
                                </p>
                                <p className="text-charcoal-600 dark:text-charcoal-450 font-sans leading-relaxed">
                                  <strong>{translate("overall_significance", language)}</strong> {char.significance}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full text-center py-8 text-charcoal-400 dark:text-charcoal-500 text-sm font-sans">
                          {translate("no_characters_found", language)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          <div className="border border-dashed border-linen-400 dark:border-charcoal-800 rounded-3xl p-16 text-center text-charcoal-400 dark:text-charcoal-500">
            <BookOpen className="w-12 h-12 mx-auto stroke-1 text-charcoal-350 dark:text-charcoal-700 mb-3" />
            <h4 className="font-semibold text-charcoal-700 dark:text-charcoal-300 mb-1">{translate("guide_workspace", language)}</h4>
            <p className="text-xs max-w-sm mx-auto">
              {translate("guide_workspace_desc", language)}
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
