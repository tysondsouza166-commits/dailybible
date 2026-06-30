export interface FavoriteVerse {
  id: string;
  reference: string;
  text: string;
  category: string;
  savedAt: string;
}

export interface PersonalNote {
  id: string;
  reference: string;
  content: string;
  category: string;
  updatedAt: string;
}

export interface PrayerRecord {
  id: string;
  request: string;
  prayer: string;
  createdAt: string;
  answered: boolean;
}

export interface RecentStudy {
  id: string;
  book: string;
  chapter: number;
  summary: string;
  date: string;
}

export interface Devotional {
  title: string;
  scripture: string;
  scriptureText: string;
  reflection: string;
  actionStep: string;
  prayer: string;
}

export interface VerseResult {
  reference: string;
  text: string;
  explanation: string;
}
