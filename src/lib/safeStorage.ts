/**
 * A safe wrapper around localStorage to prevent security or quota exceptions from crashing the application.
 */
export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`[safeStorage] Failed to getItem for key "${key}":`, e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[safeStorage] Failed to setItem for key "${key}":`, e);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[safeStorage] Failed to removeItem for key "${key}":`, e);
    }
  },
  clearTranslationCaches: (): void => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("daily_verse:") || key.startsWith("study_guide:") || key.startsWith("devotional:") || key.startsWith("chapter-summary:") || key.startsWith("daily-verse-"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.warn("[safeStorage] Failed to clear translation caches:", e);
    }
  }
};
