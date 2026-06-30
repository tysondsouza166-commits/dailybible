import { useState, useEffect, useRef } from "react";

// Map the app's current language states to appropriate TTS standard codes
export const mapLanguageToTTSCode = (language: string): string => {
  const lang = language.toLowerCase();
  if (lang.includes("english")) return "en-US";
  if (lang.includes("french")) return "fr-FR";
  if (lang.includes("portuguese")) return "pt-BR";
  if (lang.includes("tagalog")) return "tl-PH";
  if (lang.includes("konkani")) return "hi-IN"; // Fallback to Hindi phonetic rendering
  return "en-US";
};

export const useTTS = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  };

  const speak = (text: string, language: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      console.warn("Speech synthesis is not supported in this browser environment.");
      return;
    }

    // Always stop any ongoing speaking first
    window.speechSynthesis.cancel();

    // Clean up text (remove HTML-like characters or excessive quotes if any)
    const cleanedText = text.trim();
    if (!cleanedText) return;

    try {
      const utterance = new SpeechSynthesisUtterance(cleanedText);
      const langCode = mapLanguageToTTSCode(language);
      utterance.lang = langCode;

      // Keep reference to avoid browser garbage collection bugs during long speech
      utteranceRef.current = utterance;

      // Attempt to find a suitable voice matching our language code
      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = voices.find(
        (v) =>
          v.lang.toLowerCase() === langCode.toLowerCase() ||
          v.lang.toLowerCase().startsWith(langCode.toLowerCase().split("-")[0])
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onstart = () => {
        setIsPlaying(true);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        utteranceRef.current = null;
      };

      utterance.onerror = (e) => {
        // Ignore user cancellation errors
        if (e.error !== "interrupted" && e.error !== "canceled") {
          console.error("SpeechSynthesisUtterance error:", e);
        }
        setIsPlaying(false);
        utteranceRef.current = null;
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Failed to initialize or speak via SpeechSynthesis:", err);
      setIsPlaying(false);
    }
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    isPlaying,
    speak,
    stop,
  };
};
