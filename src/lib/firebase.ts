import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot, orderBy, serverTimestamp, arrayUnion } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, updateProfile } from "firebase/auth";
import { safeStorage } from "./safeStorage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const hasConfig = !!import.meta.env.VITE_FIREBASE_API_KEY;

let app;
let auth: any = null;
let db: any = null;
let googleProvider: any = null;
let isFirebaseActive = false;

if (hasConfig) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    // Configure Custom Parameters if needed
    googleProvider.setCustomParameters({ prompt: "select_account" });
    isFirebaseActive = true;
    console.log("Firebase initialized successfully on frontend.");
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
} else {
  console.warn("Firebase credentials missing from environment. Using local storage mode.");
}

export interface UserProfileData {
  displayName: string | null;
  bio: string | null;
  photoURL: string | null;
}

export async function saveUserProfile(uid: string, data: UserProfileData) {
  if (isFirebaseActive && db) {
    try {
      const userDocRef = doc(db, "users", uid);
      await setDoc(userDocRef, {
        displayName: data.displayName,
        bio: data.bio,
        photoURL: data.photoURL,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Also update Auth profile if it's the current user
      const currentUser = auth?.currentUser;
      if (currentUser && currentUser.uid === uid) {
        await updateProfile(currentUser, {
          displayName: data.displayName || undefined,
          photoURL: data.photoURL || undefined
        });
      }
    } catch (error) {
      console.error("Failed to save user profile in Firestore:", error);
      throw error;
    }
  } else {
    // Offline / safeStorage fallback
    console.log("Saving profile in offline fallback mode:", uid, data);
    const guestUserStr = safeStorage.getItem("guest_user");
    if (guestUserStr) {
      try {
        const parsed = JSON.parse(guestUserStr);
        if (parsed.uid === uid) {
          const updated = {
            ...parsed,
            displayName: data.displayName,
            photoURL: data.photoURL,
            bio: data.bio
          };
          safeStorage.setItem("guest_user", JSON.stringify(updated));
        }
      } catch (e) {
        console.error("safeStorage update failed", e);
      }
    } else {
      const fallbackUser = {
        uid: uid,
        email: "pilgrim@dailybible.app",
        displayName: data.displayName,
        photoURL: data.photoURL,
        bio: data.bio
      };
      safeStorage.setItem("guest_user", JSON.stringify(fallbackUser));
    }
    safeStorage.setItem(`bio_${uid}`, data.bio || "");
  }
}

export async function getUserProfile(uid: string): Promise<UserProfileData | null> {
  if (isFirebaseActive && db) {
    try {
      const userDocRef = doc(db, "users", uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          displayName: data.displayName || null,
          bio: data.bio || null,
          photoURL: data.photoURL || null
        };
      }
      return null;
    } catch (error) {
      console.error("Failed to get user profile from Firestore:", error);
      throw error;
    }
  } else {
    // Offline / safeStorage fallback
    const guestUserStr = safeStorage.getItem("guest_user");
    if (guestUserStr) {
      try {
        const parsed = JSON.parse(guestUserStr);
        if (parsed.uid === uid) {
          return {
            displayName: parsed.displayName || null,
            bio: parsed.bio || safeStorage.getItem(`bio_${uid}`) || null,
            photoURL: parsed.photoURL || null
          };
        }
      } catch (e) {}
    }
    const localBio = safeStorage.getItem(`bio_${uid}`);
    if (localBio) {
      return {
        displayName: "Faith Pilgrim",
        bio: localBio,
        photoURL: null
      };
    }
    return null;
  }
}

export interface Friendship {
  id: string;
  requesterId: string;
  recipientId: string;
  status: "pending" | "accepted";
  createdAt: string;
  friendData?: {
    uid: string;
    displayName: string | null;
    photoURL: string | null;
    bio: string | null;
  };
}

export async function searchUsers(queryText: string): Promise<Array<{ uid: string; displayName: string | null; photoURL: string | null; bio: string | null }>> {
  if (isFirebaseActive && db) {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef);
      const querySnapshot = await getDocs(q);
      const results: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const displayName = data.displayName || "";
        if (displayName.toLowerCase().includes(queryText.toLowerCase())) {
          results.push({
            uid: doc.id,
            displayName: data.displayName || null,
            photoURL: data.photoURL || null,
            bio: data.bio || null
          });
        }
      });
      return results;
    } catch (error) {
      console.error("Error searching users in Firestore:", error);
      throw error;
    }
  } else {
    // Local / Offline fallback using safeStorage list of users
    const mockUsers = [
      { uid: "believer_1", displayName: "Grace Walker", photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80", bio: "Walking in faith and love daily." },
      { uid: "believer_2", displayName: "Timothy Cross", photoURL: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80", bio: "The Lord is my shepherd. Devoted theology student." },
      { uid: "believer_3", displayName: "Maria de la Cruz", photoURL: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80", bio: "Amante de las Escrituras. Bendiciones a todos." },
      { uid: "believer_4", displayName: "David Shepherd", photoURL: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80", bio: "Musician and worshipper. Finding harmony in His word." },
      { uid: "believer_5", displayName: "Hannah Prayer", photoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80", bio: "Intercessor. Leave your prayer requests!" }
    ];

    const currentUser = auth?.currentUser;
    const currentUid = currentUser?.uid;

    const filtered = mockUsers.filter(u => 
      u.uid !== currentUid && 
      u.displayName.toLowerCase().includes(queryText.toLowerCase())
    );
    return filtered;
  }
}

export async function sendFriendRequest(currentUserUid: string, targetUserUid: string): Promise<string> {
  if (isFirebaseActive && db) {
    try {
      const friendshipsRef = collection(db, "friendships");
      
      const q1 = query(friendshipsRef, where("requesterId", "==", currentUserUid), where("recipientId", "==", targetUserUid));
      const s1 = await getDocs(q1);
      if (!s1.empty) return s1.docs[0].id;

      const q2 = query(friendshipsRef, where("requesterId", "==", targetUserUid), where("recipientId", "==", currentUserUid));
      const s2 = await getDocs(q2);
      if (!s2.empty) return s2.docs[0].id;

      const docRef = await addDoc(friendshipsRef, {
        requesterId: currentUserUid,
        recipientId: targetUserUid,
        status: "pending",
        createdAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      console.error("Failed to send friend request:", error);
      throw error;
    }
  } else {
    const key = `friendships`;
    const stored = safeStorage.getItem(key);
    let friendships = stored ? JSON.parse(stored) : [];
    
    const existing = friendships.find((f: any) => 
      (f.requesterId === currentUserUid && f.recipientId === targetUserUid) ||
      (f.requesterId === targetUserUid && f.recipientId === currentUserUid)
    );
    if (existing) return existing.id;

    const newId = `friendship_${Date.now()}`;
    const newReq = {
      id: newId,
      requesterId: currentUserUid,
      recipientId: targetUserUid,
      status: "pending",
      createdAt: new Date().toISOString()
    };
    friendships.push(newReq);
    safeStorage.setItem(key, JSON.stringify(friendships));
    return newId;
  }
}

export async function acceptFriendRequest(friendshipDocId: string): Promise<void> {
  if (isFirebaseActive && db) {
    try {
      const docRef = doc(db, "friendships", friendshipDocId);
      await updateDoc(docRef, {
        status: "accepted",
        acceptedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Failed to accept friend request:", error);
      throw error;
    }
  } else {
    const key = `friendships`;
    const stored = safeStorage.getItem(key);
    if (stored) {
      let friendships = JSON.parse(stored);
      friendships = friendships.map((f: any) => {
        if (f.id === friendshipDocId) {
          return { ...f, status: "accepted", acceptedAt: new Date().toISOString() };
        }
        return f;
      });
      safeStorage.setItem(key, JSON.stringify(friendships));
    }
  }
}

export async function declineFriendRequest(friendshipDocId: string): Promise<void> {
  if (isFirebaseActive && db) {
    try {
      const docRef = doc(db, "friendships", friendshipDocId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Failed to decline friend request:", error);
      throw error;
    }
  } else {
    const key = `friendships`;
    const stored = safeStorage.getItem(key);
    if (stored) {
      let friendships = JSON.parse(stored);
      friendships = friendships.filter((f: any) => f.id !== friendshipDocId);
      safeStorage.setItem(key, JSON.stringify(friendships));
    }
  }
}

export async function getUserFriends(currentUserUid: string): Promise<Friendship[]> {
  if (isFirebaseActive && db) {
    try {
      const friendshipsRef = collection(db, "friendships");
      
      const q1 = query(friendshipsRef, where("requesterId", "==", currentUserUid));
      const s1 = await getDocs(q1);
      
      const q2 = query(friendshipsRef, where("recipientId", "==", currentUserUid));
      const s2 = await getDocs(q2);
      
      const allFriendships: Friendship[] = [];
      const seenIds = new Set<string>();

      const addDocs = (snapshot: any) => {
        snapshot.forEach((doc: any) => {
          if (!seenIds.has(doc.id)) {
            seenIds.add(doc.id);
            const data = doc.data();
            allFriendships.push({
              id: doc.id,
              requesterId: data.requesterId,
              recipientId: data.recipientId,
              status: data.status,
              createdAt: data.createdAt
            });
          }
        });
      };

      addDocs(s1);
      addDocs(s2);

      const enrichedFriendships = await Promise.all(
        allFriendships.map(async (friendship) => {
          const friendUid = friendship.requesterId === currentUserUid ? friendship.recipientId : friendship.requesterId;
          const profile = await getUserProfile(friendUid);
          return {
            ...friendship,
            friendData: {
              uid: friendUid,
              displayName: profile?.displayName || "Faith Pilgrim",
              photoURL: profile?.photoURL || null,
              bio: profile?.bio || null
            }
          };
        })
      );

      return enrichedFriendships;
    } catch (error) {
      console.error("Failed to get user friends:", error);
      throw error;
    }
  } else {
    const key = `friendships`;
    const stored = safeStorage.getItem(key);
    const friendships = stored ? JSON.parse(stored) : [];
    
    const userFriendships = friendships.filter((f: any) => f.requesterId === currentUserUid || f.recipientId === currentUserUid);
    
    const mockUsers: Record<string, any> = {
      believer_1: { displayName: "Grace Walker", photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80", bio: "Walking in faith and love daily." },
      believer_2: { displayName: "Timothy Cross", photoURL: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80", bio: "The Lord is my shepherd. Devoted theology student." },
      believer_3: { displayName: "Maria de la Cruz", photoURL: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80", bio: "Amante de las Escrituras. Bendiciones a todos." },
      believer_4: { displayName: "David Shepherd", photoURL: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80", bio: "Musician and worshipper. Finding harmony in His word." },
      believer_5: { displayName: "Hannah Prayer", photoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80", bio: "Intercessor. Leave your prayer requests!" }
    };

    const enriched = userFriendships.map((f: any) => {
      const friendUid = f.requesterId === currentUserUid ? f.recipientId : f.requesterId;
      const mockProfile = mockUsers[friendUid] || { displayName: "Faith Pilgrim", photoURL: null, bio: null };
      return {
        id: f.id,
        requesterId: f.requesterId,
        recipientId: f.recipientId,
        status: f.status,
        createdAt: f.createdAt,
        friendData: {
          uid: friendUid,
          displayName: mockProfile.displayName,
          photoURL: mockProfile.photoURL,
          bio: mockProfile.bio
        }
      };
    });

    return enriched;
  }
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: any;
}

// Simple event emitter for offline local live simulation
class ChatEmitter {
  private listeners: { [chatId: string]: Array<(messages: ChatMessage[]) => void> } = {};

  subscribe(chatId: string, callback: (messages: ChatMessage[]) => void) {
    if (!this.listeners[chatId]) {
      this.listeners[chatId] = [];
    }
    this.listeners[chatId].push(callback);
    return () => {
      this.listeners[chatId] = this.listeners[chatId].filter(cb => cb !== callback);
    };
  }

  broadcast(chatId: string, messages: ChatMessage[]) {
    if (this.listeners[chatId]) {
      this.listeners[chatId].forEach(cb => cb(messages));
    }
  }
}

const chatEmitter = new ChatEmitter();

export async function createOrGetChat(userId1: string, userId2: string): Promise<string> {
  if (isFirebaseActive && db) {
    try {
      const sortedUsers = [userId1, userId2].sort();
      const chatKey = `${sortedUsers[0]}_${sortedUsers[1]}`;
      
      const chatDocRef = doc(db, "chats", chatKey);
      const chatDoc = await getDoc(chatDocRef);
      if (chatDoc.exists()) {
        return chatKey;
      }
      
      await setDoc(chatDocRef, {
        participants: [userId1, userId2],
        createdAt: new Date().toISOString()
      });
      return chatKey;
    } catch (error) {
      console.error("Failed to create/get chat:", error);
      throw error;
    }
  } else {
    const key = `chat_${[userId1, userId2].sort().join("_")}`;
    return key;
  }
}

export async function sendMessage(chatId: string, senderId: string, text: string): Promise<void> {
  if (isFirebaseActive && db) {
    try {
      const messagesRef = collection(db, "chats", chatId, "messages");
      await addDoc(messagesRef, {
        senderId,
        text,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      throw error;
    }
  } else {
    const key = `messages_${chatId}`;
    const stored = safeStorage.getItem(key);
    const messages = stored ? JSON.parse(stored) : [];
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderId,
      text,
      timestamp: Date.now()
    };
    messages.push(newMsg);
    safeStorage.setItem(key, JSON.stringify(messages));
    chatEmitter.broadcast(chatId, messages);
    
    // Simulate supportive spiritual sibling response to make the app incredibly interactive offline
    setTimeout(() => {
      const responses = [
        "Amen! Let us keep each other in prayer today.",
        "That is such an inspiring verse. Thank you for sharing!",
        "May the Lord bless you and keep you.",
        "I was just meditating on a similar scripture. Praise God!",
        "How can I pray for you specifically today, my friend?",
        "Thank you for this beautiful encouragement."
      ];
      const randomReply = responses[Math.floor(Math.random() * responses.length)];
      const currentMsgs = JSON.parse(safeStorage.getItem(key) || "[]");
      const targetFriendId = chatId.replace("chat_", "").split("_").find(uid => uid !== senderId) || "believer_1";
      const replyMsg: ChatMessage = {
        id: `msg_reply_${Date.now()}`,
        senderId: targetFriendId,
        text: randomReply,
        timestamp: Date.now()
      };
      currentMsgs.push(replyMsg);
      safeStorage.setItem(key, JSON.stringify(currentMsgs));
      chatEmitter.broadcast(chatId, currentMsgs);
    }, 1500);
  }
}

export function subscribeToMessages(chatId: string, callback: (messages: ChatMessage[]) => void): () => void {
  if (isFirebaseActive && db) {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    return onSnapshot(q, (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          senderId: data.senderId,
          text: data.text,
          timestamp: data.timestamp
        });
      });
      callback(messages);
    }, (error) => {
      console.error("Error subscribing to messages:", error);
    });
  } else {
    const key = `messages_${chatId}`;
    const stored = safeStorage.getItem(key);
    const initialMessages = stored ? JSON.parse(stored) : [];
    
    setTimeout(() => {
      callback(initialMessages);
    }, 50);

    return chatEmitter.subscribe(chatId, callback);
  }
}

export interface PrayerRequest {
  id: string;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  text: string;
  isAnonymous: boolean;
  prayedBy: string[];
  createdAt: any;
  answered?: boolean;
}

class PrayerWallEmitter {
  private listeners: Array<(requests: PrayerRequest[]) => void> = [];

  subscribe(callback: (requests: PrayerRequest[]) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  broadcast(requests: PrayerRequest[]) {
    this.listeners.forEach(cb => cb(requests));
  }
}

const prayerWallEmitter = new PrayerWallEmitter();

export async function createPrayerRequest(userId: string, text: string, isAnonymous: boolean): Promise<void> {
  let userName = "Faith Pilgrim";
  let userAvatar: string | null = null;

  if (!isAnonymous) {
    try {
      const profile = await getUserProfile(userId);
      if (profile) {
        userName = profile.displayName || "Faith Pilgrim";
        userAvatar = profile.photoURL;
      }
    } catch (e) {
      console.warn("Could not fetch profile for prayer request:", e);
    }
  }

  if (isFirebaseActive && db) {
    try {
      const wallRef = collection(db, "prayer_requests");
      await addDoc(wallRef, {
        userId,
        userName: isAnonymous ? null : userName,
        userAvatar: isAnonymous ? null : userAvatar,
        text,
        isAnonymous,
        prayedBy: [],
        createdAt: serverTimestamp(),
        answered: false
      });
    } catch (error) {
      console.error("Failed to create prayer request:", error);
      throw error;
    }
  } else {
    const key = "prayer_requests";
    const stored = safeStorage.getItem(key);
    const requests = stored ? JSON.parse(stored) : [];
    const newRequest: PrayerRequest = {
      id: `prayer_${Date.now()}`,
      userId,
      userName: isAnonymous ? null : userName,
      userAvatar: isAnonymous ? null : userAvatar,
      text,
      isAnonymous,
      prayedBy: [],
      createdAt: new Date().toISOString(),
      answered: false
    };
    requests.unshift(newRequest);
    safeStorage.setItem(key, JSON.stringify(requests));
    prayerWallEmitter.broadcast(requests);
  }
}

export async function addPrayerSupport(requestId: string, currentUserId: string): Promise<void> {
  if (isFirebaseActive && db) {
    try {
      const requestDocRef = doc(db, "prayer_requests", requestId);
      await updateDoc(requestDocRef, {
        prayedBy: arrayUnion(currentUserId)
      });
    } catch (error) {
      console.error("Failed to add prayer support:", error);
      throw error;
    }
  } else {
    const key = "prayer_requests";
    const stored = safeStorage.getItem(key);
    if (stored) {
      const requests: PrayerRequest[] = JSON.parse(stored);
      const reqIndex = requests.findIndex(r => r.id === requestId);
      if (reqIndex !== -1) {
        const req = requests[reqIndex];
        if (!req.prayedBy.includes(currentUserId)) {
          req.prayedBy.push(currentUserId);
          safeStorage.setItem(key, JSON.stringify(requests));
          prayerWallEmitter.broadcast(requests);
        }
      }
    }
  }
}

export async function togglePrayerRequestAnswered(requestId: string, currentAnswered: boolean): Promise<void> {
  const nextState = !currentAnswered;
  if (isFirebaseActive && db) {
    try {
      const docRef = doc(db, "prayer_requests", requestId);
      await updateDoc(docRef, {
        answered: nextState
      });
    } catch (error) {
      console.error("Failed to toggle prayer request answered:", error);
      throw error;
    }
  } else {
    const key = "prayer_requests";
    const stored = safeStorage.getItem(key);
    if (stored) {
      const requests: PrayerRequest[] = JSON.parse(stored);
      const updated = requests.map(r => r.id === requestId ? { ...r, answered: nextState } : r);
      safeStorage.setItem(key, JSON.stringify(updated));
      prayerWallEmitter.broadcast(updated);
    }
  }
}

export function subscribeToPrayerWall(callback: (requests: PrayerRequest[]) => void): () => void {
  if (isFirebaseActive && db) {
    const wallRef = collection(db, "prayer_requests");
    const q = query(wallRef, orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      const requests: PrayerRequest[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        requests.push({
          id: doc.id,
          userId: data.userId,
          userName: data.userName,
          userAvatar: data.userAvatar,
          text: data.text,
          isAnonymous: !!data.isAnonymous,
          prayedBy: data.prayedBy || [],
          createdAt: data.createdAt,
          answered: !!data.answered
        });
      });
      callback(requests);
    }, (error) => {
      console.error("Error subscribing to prayer wall:", error);
    });
  } else {
    const key = "prayer_requests";
    const stored = safeStorage.getItem(key);
    let initialRequests: PrayerRequest[] = stored ? JSON.parse(stored) : [];
    
    if (initialRequests.length === 0) {
      initialRequests = [
        {
          id: "seed_1",
          userId: "believer_1",
          userName: "Grace Walker",
          userAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          text: "Please pray for my grandmother who is undergoing surgery tomorrow. Praying for peace and a speedy recovery.",
          isAnonymous: false,
          prayedBy: ["believer_2", "believer_3"],
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          answered: false
        },
        {
          id: "seed_2",
          userId: "anonymous",
          userName: null,
          userAvatar: null,
          text: "Praying for guidance in my career choices. I want to align my profession with God's perfect purpose for my life.",
          isAnonymous: true,
          prayedBy: ["believer_1"],
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          answered: false
        },
        {
          id: "seed_3",
          userId: "believer_2",
          userName: "Timothy Cross",
          userAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
          text: "Seeking strength and focus as I prepare for my final theology exams. May His wisdom fill my mind.",
          isAnonymous: false,
          prayedBy: ["believer_1", "believer_4", "believer_5"],
          createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
          answered: false
        }
      ];
      safeStorage.setItem(key, JSON.stringify(initialRequests));
    }

    setTimeout(() => {
      callback(initialRequests);
    }, 50);

    return prayerWallEmitter.subscribe(callback);
  }
}

export function subscribeToMyPrayerRequests(userId: string, callback: (requests: PrayerRequest[]) => void): () => void {
  if (isFirebaseActive && db) {
    const wallRef = collection(db, "prayer_requests");
    const q = query(wallRef, where("userId", "==", userId));
    return onSnapshot(q, (snapshot) => {
      const requests: PrayerRequest[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        requests.push({
          id: doc.id,
          userId: data.userId,
          userName: data.userName,
          userAvatar: data.userAvatar,
          text: data.text,
          isAnonymous: !!data.isAnonymous,
          prayedBy: data.prayedBy || [],
          createdAt: data.createdAt,
          answered: !!data.answered
        });
      });
      
      // Sort in-memory by createdAt descending
      requests.sort((a, b) => {
        const timeA = a.createdAt?.seconds 
          ? a.createdAt.seconds * 1000 
          : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.seconds 
          ? b.createdAt.seconds * 1000 
          : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });

      callback(requests);
    }, (error) => {
      console.error("Error subscribing to my prayer requests:", error);
    });
  } else {
    const key = "prayer_requests";
    const getLocal = () => {
      const stored = safeStorage.getItem(key);
      const all: PrayerRequest[] = stored ? JSON.parse(stored) : [];
      return all.filter(r => r.userId === userId);
    };

    setTimeout(() => {
      callback(getLocal());
    }, 50);

    return prayerWallEmitter.subscribe(() => {
      callback(getLocal());
    });
  }
}

export async function deletePrayerRequest(requestId: string): Promise<void> {
  if (isFirebaseActive && db) {
    try {
      const docRef = doc(db, "prayer_requests", requestId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Failed to delete prayer request:", error);
      throw error;
    }
  } else {
    const key = "prayer_requests";
    const stored = safeStorage.getItem(key);
    if (stored) {
      const requests: PrayerRequest[] = JSON.parse(stored);
      const filtered = requests.filter(r => r.id !== requestId);
      safeStorage.setItem(key, JSON.stringify(filtered));
      prayerWallEmitter.broadcast(filtered);
    }
  }
}

export { auth, db, googleProvider, isFirebaseActive };
