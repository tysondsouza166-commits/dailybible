import React, { createContext, useContext, useState, useEffect } from "react";
import { useTheme } from "./ThemeContext";
import { auth, db, googleProvider, isFirebaseActive } from "../firebase";
import { safeStorage } from "../lib/safeStorage";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  setDoc, 
  updateDoc 
} from "firebase/firestore";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface BookmarkedVerse {
  id: string; // sanitized reference
  reference: string;
  text: string;
  savedAt: string;
}

interface FavoriteVerse {
  id: string; // doc ID or timestamp in fallback
  reference: string;
  text: string;
  category: string;
  savedAt: string;
}

interface PersonalNote {
  id: string;
  reference: string;
  content: string;
  category: string;
  updatedAt: string;
}

interface PrayerRecord {
  id: string;
  request: string;
  prayer: string;
  createdAt: string;
  answered: boolean;
}

interface RecentStudy {
  id: string;
  book: string;
  chapter: number;
  summary: string;
  date: string;
}

interface AppContextType {
  user: User | null;
  loading: boolean;
  streak: number;
  favorites: FavoriteVerse[];
  notes: PersonalNote[];
  prayers: PrayerRecord[];
  recentStudies: RecentStudy[];
  bookmarks: BookmarkedVerse[];
  isDarkMode: boolean;
  // Auth Functions
  signInWithGoogle: () => Promise<void>;
  signInGuest: (email: string, displayName?: string, password?: string, isSignUp?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  // Action Functions
  toggleTheme: () => void;
  addFavorite: (reference: string, text: string, category: string) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  saveNote: (reference: string, content: string, category: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  addPrayer: (request: string, response: string) => Promise<void>;
  togglePrayerAnswered: (id: string) => Promise<void>;
  deletePrayer: (id: string) => Promise<void>;
  recordStudy: (book: string, chapter: number, summary: string) => Promise<void>;
  incrementStreak: () => void;
  isBookmarked: (reference: string) => boolean;
  // Bookmark functions
  toggleBookmark: (reference: string, text: string) => Promise<void>;
  isVerseBookmarked: (reference: string) => boolean;
  // Language Selection
  language: string;
  setLanguage: (lang: string) => void;
  // Text Size Preference
  textSize: string;
  setTextSize: (size: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_PILGRIM_USER: User = {
  uid: "faith_pilgrim_12345",
  email: "pilgrim@dailybible.app",
  displayName: "Faith Pilgrim",
  photoURL: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=60"
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [guestUser, setGuestUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(1);
  const [favorites, setFavorites] = useState<FavoriteVerse[]>([]);
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [prayers, setPrayers] = useState<PrayerRecord[]>([]);
  const [recentStudies, setRecentStudies] = useState<RecentStudy[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkedVerse[]>([]);
  const { isDarkMode, toggleTheme } = useTheme();

  // --- Language Selection State ---
  const [language, setLanguageState] = useState<string>(() => {
    return safeStorage.getItem("selected_language") || "English";
  });

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    safeStorage.setItem("selected_language", lang);
    safeStorage.clearTranslationCaches();
  };

  // --- Text Size Preference ---
  const [textSize, setTextSizeState] = useState<string>(() => {
    return safeStorage.getItem("selected_text_size") || "base";
  });

  const setTextSize = (size: string) => {
    setTextSizeState(size);
    safeStorage.setItem("selected_text_size", size);
  };

  // --- Real-time Bookmarks Loader ---
  const loadLocalBookmarks = () => {
    const local = safeStorage.getItem("fg_bookmarks");
    if (local) {
      try {
        setBookmarks(JSON.parse(local));
      } catch (e) {
        console.error("Failed to parse local bookmarks", e);
      }
    } else {
      setBookmarks([]);
    }
  };

  useEffect(() => {
    const firebaseUser = auth?.currentUser;
    if (isFirebaseActive && db && firebaseUser) {
      const bookmarksColRef = collection(db, "users", firebaseUser.uid, "bookmarks");
      const unsubscribe = onSnapshot(bookmarksColRef, (snapshot) => {
        const list: BookmarkedVerse[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            reference: d.reference || "",
            text: d.text || "",
            savedAt: d.savedAt || ""
          });
        });
        setBookmarks(list.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
      }, (error) => {
        if (error.message && error.message.toLowerCase().includes("permission-denied")) {
          console.warn("Permission denied for real-time bookmarks listener, falling back to local state.");
        } else {
          handleFirestoreError(error, OperationType.LIST, `users/${firebaseUser.uid}/bookmarks`);
        }
      });
      return () => unsubscribe();
    } else {
      loadLocalBookmarks();
    }
  }, [user]);

  // --- Offline Streak Loading ---
  useEffect(() => {
    // Load streak local storage fallback
    const savedStreak = safeStorage.getItem("streak_count");
    if (savedStreak) setStreak(parseInt(savedStreak, 10));

    const streakDate = safeStorage.getItem("streak_last_date");
    const todayStr = new Date().toDateString();
    if (streakDate && streakDate !== todayStr) {
      // If it is the next day, verify streak or keep.
      const lastDate = new Date(streakDate);
      const diffTime = Math.abs(new Date().getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        // Streak broken
        setStreak(0);
        safeStorage.setItem("streak_count", "0");
      }
    }
  }, []);

  // --- Auth Initializer (Firebase or Local Guest) ---
  useEffect(() => {
    if (isFirebaseActive && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const u: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL
          };
          setUser(u);
          await loadUserData(firebaseUser.uid);
        } else {
          setUser(null);
          loadGuestData();
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      const savedGuest = safeStorage.getItem("guest_user");
      if (savedGuest) {
        try {
          const parsed = JSON.parse(savedGuest);
          setUser(parsed);
          setGuestUser(parsed);
        } catch (e) {
          setUser(null);
          setGuestUser(null);
        }
      } else {
        setUser(null);
        setGuestUser(null);
      }
      loadGuestData();
      setLoading(false);
    }
  }, []);

  // --- Load Data (Firestore vs Local Storage) ---
  const loadUserData = async (uid: string) => {
    try {
      if (!isFirebaseActive || !db) return;

      // 1. Load Favorites
      const favsQuery = query(collection(db, "favorites"), where("userId", "==", uid));
      const favsSnap = await getDocs(favsQuery);
      const favsList: FavoriteVerse[] = [];
      favsSnap.forEach((docSnap) => {
        const d = docSnap.data();
        favsList.push({
          id: docSnap.id,
          reference: d.reference,
          text: d.text,
          category: d.category,
          savedAt: d.savedAt
        });
      });
      setFavorites(favsList.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));

      // 2. Load Notes
      const notesQuery = query(collection(db, "notes"), where("userId", "==", uid));
      const notesSnap = await getDocs(notesQuery);
      const notesList: PersonalNote[] = [];
      notesSnap.forEach((docSnap) => {
        const d = docSnap.data();
        notesList.push({
          id: docSnap.id,
          reference: d.reference,
          content: d.content,
          category: d.category,
          updatedAt: d.updatedAt
        });
      });
      setNotes(notesList.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));

      // 3. Load Prayers
      const prayersQuery = query(collection(db, "prayers"), where("userId", "==", uid));
      const prayersSnap = await getDocs(prayersQuery);
      const prayersList: PrayerRecord[] = [];
      prayersSnap.forEach((docSnap) => {
        const d = docSnap.data();
        prayersList.push({
          id: docSnap.id,
          request: d.request,
          prayer: d.prayer,
          createdAt: d.createdAt,
          answered: d.answered || false
        });
      });
      setPrayers(prayersList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

      // 4. Load Studies
      const studyQuery = query(collection(db, "studies"), where("userId", "==", uid));
      const studiesSnap = await getDocs(studyQuery);
      const studiesList: RecentStudy[] = [];
      studiesSnap.forEach((docSnap) => {
        const d = docSnap.data();
        studiesList.push({
          id: docSnap.id,
          book: d.book,
          chapter: d.chapter,
          summary: d.summary,
          date: d.date
        });
      });
      setRecentStudies(studiesList.sort((a, b) => b.date.localeCompare(a.date)));

      // 5. Load Streak from Firestore (with Local Storage fallback)
      let firestoreStreak = null;
      let firestoreLastActiveDate = null;
      if (isFirebaseActive && db) {
        try {
          const streakDocRef = doc(db, "users", uid, "streak", "status");
          const streakSnap = await getDoc(streakDocRef);
          if (streakSnap.exists()) {
            const data = streakSnap.data();
            firestoreStreak = data.currentStreak;
            firestoreLastActiveDate = data.lastActiveDate;
            console.log(`[Streak] Loaded streak from Firestore: ${firestoreStreak}, last active: ${firestoreLastActiveDate}`);
          }
        } catch (e) {
          console.error("[Streak] Failed to load streak from Firestore:", e);
        }
      }

      const todayStr = new Date().toDateString();
      if (firestoreStreak !== null) {
        if (firestoreLastActiveDate && firestoreLastActiveDate !== todayStr) {
          const lastDate = new Date(firestoreLastActiveDate);
          const diffTime = Math.abs(new Date().getTime() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 1) {
            // Streak broken
            firestoreStreak = 0;
          }
        }
        setStreak(firestoreStreak);
        safeStorage.setItem("streak_count", String(firestoreStreak));
        if (firestoreLastActiveDate) {
          safeStorage.setItem("streak_last_date", firestoreLastActiveDate);
        }
      } else {
        const localStreak = safeStorage.getItem("streak_count");
        const streakDate = safeStorage.getItem("streak_last_date");
        let parsedStreak = localStreak ? parseInt(localStreak, 10) : 1;

        if (streakDate && streakDate !== todayStr) {
          const lastDate = new Date(streakDate);
          const diffTime = Math.abs(new Date().getTime() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 1) {
            parsedStreak = 0;
            safeStorage.setItem("streak_count", "0");
          }
        }
        setStreak(parsedStreak);
        if (isFirebaseActive && db) {
          try {
            const streakDocRef = doc(db, "users", uid, "streak", "status");
            await setDoc(streakDocRef, {
              currentStreak: parsedStreak,
              lastActiveDate: streakDate || "",
              updatedAt: new Date().toISOString()
            });
          } catch (err) {
            console.error("[Streak] Failed to init Firestore streak:", err);
          }
        }
      }
    } catch (e) {
      console.error("Error loading user data, falling back to Local Storage:", e);
      loadGuestData();
    }
  };

  const loadGuestData = () => {
    // Load favorites
    const localFavs = safeStorage.getItem("fg_favorites");
    if (localFavs) setFavorites(JSON.parse(localFavs));

    // Load notes
    const localNotes = safeStorage.getItem("fg_notes");
    if (localNotes) setNotes(JSON.parse(localNotes));

    // Load prayers
    const localPrayers = safeStorage.getItem("fg_prayers");
    if (localPrayers) setPrayers(JSON.parse(localPrayers));

    // Load studies
    const localStudies = safeStorage.getItem("fg_studies");
    if (localStudies) setRecentStudies(JSON.parse(localStudies));
  };

  // --- Sign In & Out ---
  const signInWithGoogle = async () => {
    if (isFirebaseActive && auth && googleProvider) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        if (result.user) {
          const u: User = {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL
          };
          setUser(u);
          await loadUserData(result.user.uid);
        }
      } catch (e: any) {
        console.error("Google Sign-In failed:", e);
        throw e;
      }
    } else {
      await signInGuest("pilgrim.google@dailybible.app", "Faith Pilgrim (Google)");
    }
  };

  const signInGuest = async (email: string, displayName?: string, password?: string, isSignUp?: boolean) => {
    if (isFirebaseActive && auth) {
      try {
        let userCredential;
        // Fallback standard password if not provided to make it seamless
        const finalPassword = password || "DailyBibleSecuredPass123!";
        
        if (isSignUp) {
          userCredential = await createUserWithEmailAndPassword(auth, email, finalPassword);
          if (displayName && userCredential.user) {
            await updateProfile(userCredential.user, { displayName });
          }
        } else {
          try {
            userCredential = await signInWithEmailAndPassword(auth, email, finalPassword);
          } catch (err: any) {
            // Auto sign-up if the account doesn't exist yet, for seamless experience
            if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/user-disabled" || err.message.includes("user-not-found")) {
              userCredential = await createUserWithEmailAndPassword(auth, email, finalPassword);
              if (displayName && userCredential.user) {
                await updateProfile(userCredential.user, { displayName });
              }
            } else {
              throw err;
            }
          }
        }
        
        if (userCredential && userCredential.user) {
          const u: User = {
            uid: userCredential.user.uid,
            email: userCredential.user.email,
            displayName: userCredential.user.displayName || displayName || null,
            photoURL: userCredential.user.photoURL
          };
          setUser(u);
          await loadUserData(userCredential.user.uid);
        }
      } catch (e: any) {
        console.error("Firebase Auth Email login failed:", e);
        throw e;
      }
    } else {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, displayName })
        });
        const data = await response.json();
        if (data.success && data.user) {
          setUser(data.user);
          setGuestUser(data.user);
          safeStorage.setItem("guest_user", JSON.stringify(data.user));
          loadGuestData();
        } else {
          throw new Error(data.error || "Login failed");
        }
      } catch (e) {
        console.error("Auth login failed, using fallback:", e);
        const fallbackUser = {
          uid: "faith_pilgrim_12345",
          email: email || "pilgrim@dailybible.app",
          displayName: displayName || "Faith Pilgrim",
          photoURL: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=60"
        };
        setUser(fallbackUser);
        setGuestUser(fallbackUser);
        safeStorage.setItem("guest_user", JSON.stringify(fallbackUser));
        loadGuestData();
      }
    }
  };

  const logout = async () => {
    if (isFirebaseActive && auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.error("Firebase signOut failed:", e);
      }
    }
    setGuestUser(null);
    setUser(null);
    safeStorage.removeItem("guest_user");
    // clear memory arrays but reload offline ones
    setFavorites([]);
    setNotes([]);
    setPrayers([]);
    setRecentStudies([]);
    loadGuestData();
  };

  const getActiveUserId = () => {
    if (user) return user.uid;
    if (guestUser) return guestUser.uid;
    return "anonymous_user";
  };

  // --- Favorite Verses Operations ---
  const addFavorite = async (reference: string, text: string, category: string) => {
    const uid = getActiveUserId();
    const newFav: FavoriteVerse = {
      id: "fav_" + Date.now(),
      reference,
      text,
      category,
      savedAt: new Date().toISOString()
    };

    const updated = [newFav, ...favorites];
    setFavorites(updated);
    safeStorage.setItem("fg_favorites", JSON.stringify(updated));

    if (isFirebaseActive && db && (user || guestUser)) {
      try {
        const docRef = await addDoc(collection(db, "favorites"), {
          userId: uid,
          reference,
          text,
          category,
          savedAt: newFav.savedAt
        });
        // Update local id to match firestore doc ID
        setFavorites(prev => prev.map(f => f.id === newFav.id ? { ...f, id: docRef.id } : f));
      } catch (e) {
        console.error("Failed to save favorite to Firestore", e);
      }
    }
  };

  const removeFavorite = async (id: string) => {
    const updated = favorites.filter(f => f.id !== id);
    setFavorites(updated);
    safeStorage.setItem("fg_favorites", JSON.stringify(updated));

    if (isFirebaseActive && db && id.indexOf("fav_") === -1) {
      try {
        await deleteDoc(doc(db, "favorites", id));
      } catch (e) {
        console.error("Failed to delete favorite from Firestore", e);
      }
    }
  };

  const isBookmarked = (reference: string) => {
    return favorites.some(f => f.reference.toLowerCase().trim() === reference.toLowerCase().trim());
  };

  const sanitizeVerseId = (ref: string) => {
    return ref.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
  };

  const isVerseBookmarked = (reference: string) => {
    const verseId = sanitizeVerseId(reference);
    return bookmarks.some(b => b.id === verseId);
  };

  const toggleBookmark = async (reference: string, text: string) => {
    const firebaseUser = auth?.currentUser;
    const verseId = sanitizeVerseId(reference);

    if (isFirebaseActive && db && firebaseUser) {
      const docRef = doc(db, "users", firebaseUser.uid, "bookmarks", verseId);
      const exists = bookmarks.some(b => b.id === verseId);

      if (exists) {
        try {
          await deleteDoc(docRef);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${firebaseUser.uid}/bookmarks/${verseId}`);
        }
      } else {
        try {
          await setDoc(docRef, {
            reference,
            text,
            savedAt: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}/bookmarks/${verseId}`);
        }
      }
    } else {
      // Offline/Guest Pilgrim local storage mock-up DB
      const current = [...bookmarks];
      const exists = current.some(b => b.id === verseId);
      let updated;
      if (exists) {
        updated = current.filter(b => b.id !== verseId);
      } else {
        const newB: BookmarkedVerse = {
          id: verseId,
          reference,
          text,
          savedAt: new Date().toISOString()
        };
        updated = [newB, ...current];
      }
      setBookmarks(updated);
      safeStorage.setItem("fg_bookmarks", JSON.stringify(updated));
    }
  };

  // --- Personal Notes Operations ---
  const saveNote = async (reference: string, content: string, category: string) => {
    const uid = getActiveUserId();
    const newNote: PersonalNote = {
      id: "note_" + Date.now(),
      reference,
      content,
      category,
      updatedAt: new Date().toISOString()
    };

    // If exists, replace. Else, prepend.
    const existingIndex = notes.findIndex(n => n.reference.toLowerCase().trim() === reference.toLowerCase().trim());
    let updated;
    if (existingIndex !== -1) {
      newNote.id = notes[existingIndex].id;
      updated = [...notes];
      updated[existingIndex] = newNote;
    } else {
      updated = [newNote, ...notes];
    }

    setNotes(updated);
    safeStorage.setItem("fg_notes", JSON.stringify(updated));

    if (isFirebaseActive && db && (user || guestUser)) {
      try {
        const q = query(
          collection(db, "notes"), 
          where("userId", "==", uid), 
          where("reference", "==", reference)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          // Update existing
          const matchDoc = querySnapshot.docs[0];
          await updateDoc(doc(db, "notes", matchDoc.id), {
            content,
            category,
            updatedAt: newNote.updatedAt
          });
        } else {
          // Add new
          const docRef = await addDoc(collection(db, "notes"), {
            userId: uid,
            reference,
            content,
            category,
            updatedAt: newNote.updatedAt
          });
          setNotes(prev => prev.map(n => n.id === newNote.id ? { ...n, id: docRef.id } : n));
        }
      } catch (e) {
        console.error("Failed to save note to Firestore", e);
      }
    }
  };

  const deleteNote = async (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated);
    safeStorage.setItem("fg_notes", JSON.stringify(updated));

    if (isFirebaseActive && db && id.indexOf("note_") === -1) {
      try {
        await deleteDoc(doc(db, "notes", id));
      } catch (e) {
        console.error("Failed to delete note from Firestore", e);
      }
    }
  };

  // --- Prayer Companion Operations ---
  const addPrayer = async (request: string, prayer: string) => {
    const uid = getActiveUserId();
    const newPrayer: PrayerRecord = {
      id: "prayer_" + Date.now(),
      request,
      prayer,
      createdAt: new Date().toISOString(),
      answered: false
    };

    const updated = [newPrayer, ...prayers];
    setPrayers(updated);
    safeStorage.setItem("fg_prayers", JSON.stringify(updated));

    if (isFirebaseActive && db && (user || guestUser)) {
      try {
        const docRef = await addDoc(collection(db, "prayers"), {
          userId: uid,
          request,
          prayer,
          createdAt: newPrayer.createdAt,
          answered: false
        });
        setPrayers(prev => prev.map(p => p.id === newPrayer.id ? { ...p, id: docRef.id } : p));
      } catch (e) {
        console.error("Failed to save prayer to Firestore", e);
      }
    }
  };

  const togglePrayerAnswered = async (id: string) => {
    const prayer = prayers.find(p => p.id === id);
    if (!prayer) return;

    const nextState = !prayer.answered;
    const updated = prayers.map(p => p.id === id ? { ...p, answered: nextState } : p);
    setPrayers(updated);
    safeStorage.setItem("fg_prayers", JSON.stringify(updated));

    if (isFirebaseActive && db && id.indexOf("prayer_") === -1) {
      try {
        await updateDoc(doc(db, "prayers", id), { answered: nextState });
      } catch (e) {
        console.error("Failed to update prayer in Firestore", e);
      }
    }
  };

  const deletePrayer = async (id: string) => {
    const updated = prayers.filter(p => p.id !== id);
    setPrayers(updated);
    safeStorage.setItem("fg_prayers", JSON.stringify(updated));

    if (isFirebaseActive && db && id.indexOf("prayer_") === -1) {
      try {
        await deleteDoc(doc(db, "prayers", id));
      } catch (e) {
        console.error("Failed to delete prayer from Firestore", e);
      }
    }
  };

  // --- Chapter Studies History ---
  const recordStudy = async (book: string, chapter: number, summary: string) => {
    const uid = getActiveUserId();
    const newStudy: RecentStudy = {
      id: "study_" + Date.now(),
      book,
      chapter,
      summary,
      date: new Date().toISOString()
    };

    const updated = [newStudy, ...recentStudies].slice(0, 5); // Kept to 5 latest
    setRecentStudies(updated);
    safeStorage.setItem("fg_studies", JSON.stringify(updated));

    if (isFirebaseActive && db && (user || guestUser)) {
      try {
        await addDoc(collection(db, "studies"), {
          userId: uid,
          book,
          chapter,
          summary,
          date: newStudy.date
        });
      } catch (e) {
        console.error("Failed to save study to Firestore", e);
      }
    }
  };

  // --- Streaks Handling ---
  const incrementStreak = async () => {
    const todayStr = new Date().toDateString();
    const lastDate = safeStorage.getItem("streak_last_date");

    if (lastDate === todayStr) {
      // Already active today, keep current streak
      return;
    }

    const nextStreak = lastDate ? streak + 1 : 1;
    setStreak(nextStreak);
    safeStorage.setItem("streak_count", String(nextStreak));
    safeStorage.setItem("streak_last_date", todayStr);

    const uid = getActiveUserId();
    
    // 1. Sync with Firebase Firestore if active
    if (isFirebaseActive && db && uid && uid !== "anonymous_user") {
      try {
        const streakDocRef = doc(db, "users", uid, "streak", "status");
        await setDoc(streakDocRef, {
          currentStreak: nextStreak,
          lastActiveDate: todayStr,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`[Streak] Firestore streak synchronized: ${nextStreak}`);
      } catch (e) {
        console.error("[Streak] Failed to update Firestore streak:", e);
      }
    }

    // 2. Sync with Express/PostgreSQL backend if DATABASE_URL is set
    if (uid && uid !== "anonymous_user") {
      try {
        const response = await fetch("/api/streak/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userId: uid,
            localDateStr: new Date().toISOString().split('T')[0]
          })
        });
        const resData = await response.json();
        console.log("[Streak] Express DB streak synchronized:", resData);
      } catch (e) {
        console.warn("[Streak] Express DB sync warning:", e);
      }
    }
  };

  return (
    <AppContext.Provider value={{
      user: user || guestUser,
      loading,
      streak,
      favorites,
      notes,
      prayers,
      recentStudies,
      isDarkMode,
      signInWithGoogle,
      signInGuest,
      logout,
      toggleTheme,
      addFavorite,
      removeFavorite,
      saveNote,
      deleteNote,
      addPrayer,
      togglePrayerAnswered,
      deletePrayer,
      recordStudy,
      incrementStreak,
      isBookmarked,
      bookmarks,
      toggleBookmark,
      isVerseBookmarked,
      language,
      setLanguage,
      textSize,
      setTextSize
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
