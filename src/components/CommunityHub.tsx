import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { 
  searchUsers, 
  sendFriendRequest, 
  acceptFriendRequest, 
  declineFriendRequest, 
  getUserFriends, 
  Friendship, 
  isFirebaseActive 
} from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import { LiveChat } from "./LiveChat";
import { 
  Search, 
  UserPlus, 
  UserCheck, 
  Users, 
  Clock, 
  Check, 
  X, 
  Sparkles, 
  MessageSquare,
  AlertCircle,
  ShieldCheck,
  UserX
} from "lucide-react";

export const CommunityHub: React.FC = () => {
  const { user, language } = useApp();
  
  const [activeTab, setActiveTab] = useState<"search" | "pending" | "friends">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [activeChatFriend, setActiveChatFriend] = useState<{ uid: string; displayName: string; photoURL: string | null } | null>(null);
  
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load friends & pending requests on mount / user change
  const loadFriendships = async () => {
    if (!user) return;
    try {
      setIsLoadingFriends(true);
      const data = await getUserFriends(user.uid);
      setFriendships(data);
    } catch (err: any) {
      console.error("Failed to load friendships:", err);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  useEffect(() => {
    loadFriendships();
  }, [user]);

  // Execute Search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !searchQuery.trim()) return;

    setIsSearching(true);
    setErrorMessage(null);
    try {
      const results = await searchUsers(searchQuery.trim());
      // Filter out the current user just in case
      setSearchResults(results.filter((u: any) => u.uid !== user.uid));
    } catch (err: any) {
      setErrorMessage(language === "Spanish" ? "Error al buscar creyentes." : "Error searching for believers.");
    } finally {
      setIsSearching(false);
    }
  };

  // Quick search when input changes (with a fallback button)
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const delayDebounceFn = setTimeout(() => {
        handleSearch();
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Actions
  const handleSendRequest = async (targetUid: string) => {
    if (!user) return;
    setActionLoadingId(targetUid);
    setErrorMessage(null);
    try {
      await sendFriendRequest(user.uid, targetUid);
      setSuccessMessage(language === "Spanish" ? "¡Petición de amistad enviada!" : "Friend request sent successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadFriendships();
    } catch (err: any) {
      setErrorMessage(language === "Spanish" ? "No se pudo enviar la petición." : "Failed to send request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    setActionLoadingId(friendshipId);
    setErrorMessage(null);
    try {
      await acceptFriendRequest(friendshipId);
      setSuccessMessage(language === "Spanish" ? "¡Petición de amistad aceptada!" : "Friend request accepted!");
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadFriendships();
    } catch (err: any) {
      setErrorMessage(language === "Spanish" ? "No se pudo aceptar la petición." : "Failed to accept request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    setActionLoadingId(friendshipId);
    setErrorMessage(null);
    try {
      await declineFriendRequest(friendshipId);
      setSuccessMessage(language === "Spanish" ? "Petición rechazada o eliminada." : "Request declined or removed.");
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadFriendships();
    } catch (err: any) {
      setErrorMessage(language === "Spanish" ? "No se pudo declinar la petición." : "Failed to decline request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Helper to get relationship state with a user
  const getRelationship = (targetUid: string) => {
    const found = friendships.find(f => f.requesterId === targetUid || f.recipientId === targetUid);
    if (!found) return null;
    return {
      id: found.id,
      status: found.status,
      isRequester: found.requesterId === user?.uid
    };
  };

  // Segmenting friendships for different panels
  const pendingIncoming = friendships.filter(f => f.status === "pending" && f.recipientId === user?.uid);
  const pendingOutgoing = friendships.filter(f => f.status === "pending" && f.requesterId === user?.uid);
  const acceptedFriends = friendships.filter(f => f.status === "accepted");

  const fallbackAvatar = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80";

  if (!user) {
    return (
      <div className="w-full max-w-xl mx-auto py-12 px-6 text-center">
        <p className="text-charcoal-600 dark:text-charcoal-400">
          {language === "Spanish" ? "Inicia sesión para conectarte con la comunidad." : "Please authenticate to connect with the community."}
        </p>
      </div>
    );
  }

  if (activeChatFriend) {
    return (
      <LiveChat
        friendUid={activeChatFriend.uid}
        friendName={activeChatFriend.displayName}
        friendAvatar={activeChatFriend.photoURL}
        onBack={() => {
          setActiveChatFriend(null);
          loadFriendships();
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-4 px-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-serif tracking-tight text-brand-700 dark:text-brand-200 flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-500" />
            <span>{language === "Spanish" ? "Comunidad de Fe" : "Community Hub"}</span>
          </h2>
          <p className="text-sm text-charcoal-600 dark:text-charcoal-400">
            {language === "Spanish" ? "Encuentra hermanos en la fe, comparte devocionales y caminen juntos" : "Find fellow believers, share scripture, and grow in your walk together"}
          </p>
        </div>

        {/* Firebase Status Tag */}
        <div className="flex items-center self-start sm:self-auto gap-1.5 px-3 py-1 bg-linen-100 dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-full text-xs font-mono text-charcoal-600 dark:text-charcoal-400">
          <ShieldCheck className={`w-3.5 h-3.5 ${isFirebaseActive ? "text-emerald-500" : "text-amber-500"}`} />
          <span>{isFirebaseActive ? "CLOUD SYNCED" : "OFFLINE PREVIEW"}</span>
        </div>
      </div>

      {/* Messaging / Alerts */}
      <AnimatePresence mode="wait">
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-sm rounded-2xl border border-rose-100 dark:border-rose-900/30 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </motion.div>
        )}

        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 text-emerald-600 dark:text-emerald-400 text-sm rounded-2xl border border-emerald-100 dark:border-emerald-900/20 flex items-center gap-2"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs Menu */}
      <div className="border-b border-linen-300 dark:border-charcoal-850 flex gap-6 pb-1">
        <button
          onClick={() => setActiveTab("search")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "search" 
              ? "border-brand-500 text-brand-600 dark:text-brand-400 font-bold" 
              : "border-transparent text-charcoal-600 dark:text-charcoal-400 hover:text-charcoal-800 dark:hover:text-linen-100"
          }`}
        >
          {language === "Spanish" ? "Buscar Creyentes" : "Find Believers"}
        </button>
        
        <button
          onClick={() => setActiveTab("pending")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all relative cursor-pointer ${
            activeTab === "pending" 
              ? "border-brand-500 text-brand-600 dark:text-brand-400 font-bold" 
              : "border-transparent text-charcoal-600 dark:text-charcoal-400 hover:text-charcoal-800 dark:hover:text-linen-100"
          }`}
        >
          <span>{language === "Spanish" ? "Solicitudes" : "Pending Requests"}</span>
          {pendingIncoming.length > 0 && (
            <span className="absolute -top-1 -right-3.5 bg-brand-500 text-white text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold">
              {pendingIncoming.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("friends")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "friends" 
              ? "border-brand-500 text-brand-600 dark:text-brand-400 font-bold" 
              : "border-transparent text-charcoal-600 dark:text-charcoal-400 hover:text-charcoal-800 dark:hover:text-linen-100"
          }`}
        >
          {language === "Spanish" ? "Mis Amigos" : "My Friends"} ({acceptedFriends.length})
        </button>
      </div>

      {/* Main Panel Box */}
      <div className="min-h-[300px]">
        <AnimatePresence mode="wait">
          {/* FIND BELIEVERS TAB */}
          {activeTab === "search" && (
            <motion.div
              key="search-tab"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6"
            >
              {/* Search Bar Form */}
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  placeholder={language === "Spanish" ? "Buscar por nombre (ej. Grace, Timothy...)" : "Search by display name (e.g., Grace, Timothy...)"}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-charcoal-800 dark:text-linen-100 transition-colors shadow-xs font-sans"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-400 w-5 h-5" />
              </form>

              {/* Search results */}
              <div className="space-y-3">
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
                    <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
                    <p className="text-xs text-charcoal-600 dark:text-charcoal-400 font-mono">
                      {language === "Spanish" ? "BUSCANDO EN LA ASOCIACIÓN..." : "SEARCHING FELLOWSHIP..."}
                    </p>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((item) => {
                    const relationship = getRelationship(item.uid);
                    return (
                      <motion.div
                        key={item.uid}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-4 bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-2xl flex items-center justify-between gap-4 shadow-xs"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={item.photoURL || fallbackAvatar}
                            alt={item.displayName || "Believer"}
                            className="w-12 h-12 rounded-full object-cover border border-linen-300 dark:border-charcoal-800 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <h4 className="font-semibold text-charcoal-800 dark:text-linen-100 font-sans tracking-tight text-sm">
                              {item.displayName || "Faith Pilgrim"}
                            </h4>
                            <p className="text-xs text-charcoal-600 dark:text-charcoal-400 italic font-serif line-clamp-1">
                              {item.bio || (language === "Spanish" ? "Buscando la gracia de Dios." : "Seeking God's grace.")}
                            </p>
                          </div>
                        </div>

                        {/* Connection Button */}
                        <div className="shrink-0">
                          {relationship === null ? (
                            <button
                              disabled={actionLoadingId === item.uid}
                              onClick={() => handleSendRequest(item.uid)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>{language === "Spanish" ? "Conectar" : "Connect"}</span>
                            </button>
                          ) : relationship.status === "pending" ? (
                            relationship.isRequester ? (
                              <div className="flex items-center gap-1 text-xs text-charcoal-600 dark:text-charcoal-400 font-medium bg-linen-100 dark:bg-charcoal-800 px-3 py-1.5 rounded-xl border border-linen-200 dark:border-charcoal-750">
                                <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                <span>{language === "Spanish" ? "Enviada" : "Pending"}</span>
                              </div>
                            ) : (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleAcceptRequest(relationship.id)}
                                  disabled={actionLoadingId === relationship.id}
                                  className="p-1.5 bg-brand-100 dark:bg-brand-900/30 hover:bg-brand-200 text-brand-700 dark:text-brand-300 rounded-lg cursor-pointer transition-colors"
                                  title={language === "Spanish" ? "Aceptar" : "Accept"}
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeclineRequest(relationship.id)}
                                  disabled={actionLoadingId === relationship.id}
                                  className="p-1.5 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer transition-colors"
                                  title={language === "Spanish" ? "Rechazar" : "Decline"}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30">
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>{language === "Spanish" ? "Amigos" : "Friends"}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                ) : searchQuery.trim().length > 1 ? (
                  <div className="text-center py-12 bg-white dark:bg-charcoal-900 border border-dashed border-linen-300 dark:border-charcoal-800 rounded-2xl">
                    <UserX className="w-8 h-8 text-charcoal-400 mx-auto mb-2" />
                    <p className="text-sm font-sans text-charcoal-600 dark:text-charcoal-400 font-medium">
                      {language === "Spanish" ? "No se encontraron creyentes" : "No fellow believers found"}
                    </p>
                    <p className="text-xs text-charcoal-400 mt-0.5">
                      {language === "Spanish" ? "Intenta con un término de búsqueda diferente." : "Try a different search term."}
                    </p>
                  </div>
                ) : (
                  <div className="p-6 bg-gradient-to-br from-brand-600/5 to-transparent rounded-2xl border border-brand-500/10 text-center space-y-2">
                    <Sparkles className="w-6 h-6 text-brand-500 mx-auto animate-pulse" />
                    <h5 className="font-semibold text-charcoal-800 dark:text-linen-100 text-sm">
                      {language === "Spanish" ? "Encuentra Compañeros en la Fe" : "Seek Fellowship"}
                    </h5>
                    <p className="text-xs text-charcoal-600 dark:text-charcoal-400 max-w-md mx-auto leading-relaxed">
                      {language === "Spanish"
                        ? "Escribe arriba para buscar por nombre. Puedes enviar solicitudes de amistad instantáneas y crear tu círculo espiritual de apoyo."
                        : "Type above to search by display name. You can send friend requests and establish your circle of spiritual support."}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* PENDING REQUESTS TAB */}
          {activeTab === "pending" && (
            <motion.div
              key="pending-tab"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6"
            >
              {isLoadingFriends ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
                  <p className="text-xs text-charcoal-600 dark:text-charcoal-400 font-mono">
                    {language === "Spanish" ? "OBTENIENDO SOLICITUDES..." : "GETTING REQUESTS..."}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Incoming Requests Section */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
                      {language === "Spanish" ? `RECIBIDAS (${pendingIncoming.length})` : `INCOMING (${pendingIncoming.length})`}
                    </h3>

                    {pendingIncoming.length === 0 ? (
                      <p className="text-xs italic text-charcoal-600 dark:text-charcoal-400 py-2">
                        {language === "Spanish" ? "No tienes solicitudes entrantes en este momento." : "No incoming friend requests at the moment."}
                      </p>
                    ) : (
                      pendingIncoming.map((req) => (
                        <div
                          key={req.id}
                          className="p-4 bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-2xl flex items-center justify-between gap-4 shadow-xs"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={req.friendData?.photoURL || fallbackAvatar}
                              alt={req.friendData?.displayName || "Pilgrim"}
                              className="w-10 h-10 rounded-full object-cover border border-linen-300 dark:border-charcoal-800"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <h4 className="font-semibold text-charcoal-800 dark:text-linen-100 font-sans tracking-tight text-sm">
                                {req.friendData?.displayName || "Faith Pilgrim"}
                              </h4>
                              <p className="text-xs text-charcoal-600 dark:text-charcoal-400 italic font-serif line-clamp-1">
                                {req.friendData?.bio || (language === "Spanish" ? "Hermano en la fe." : "Brother in faith.")}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleAcceptRequest(req.id)}
                              disabled={actionLoadingId === req.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">{language === "Spanish" ? "Aceptar" : "Accept"}</span>
                            </button>
                            <button
                              onClick={() => handleDeclineRequest(req.id)}
                              disabled={actionLoadingId === req.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 disabled:opacity-50 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-lg cursor-pointer transition-colors border border-rose-200 dark:border-rose-900/30"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">{language === "Spanish" ? "Rechazar" : "Decline"}</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Outgoing Requests Section */}
                  <div className="space-y-3 pt-4 border-t border-linen-300 dark:border-charcoal-850">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
                      {language === "Spanish" ? `ENVIADAS (${pendingOutgoing.length})` : `SENT REQUESTS (${pendingOutgoing.length})`}
                    </h3>

                    {pendingOutgoing.length === 0 ? (
                      <p className="text-xs italic text-charcoal-600 dark:text-charcoal-400 py-2">
                        {language === "Spanish" ? "No tienes solicitudes de amistad enviadas pendientes." : "No pending sent requests."}
                      </p>
                    ) : (
                      pendingOutgoing.map((req) => (
                        <div
                          key={req.id}
                          className="p-4 bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-2xl flex items-center justify-between gap-4 shadow-xs"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={req.friendData?.photoURL || fallbackAvatar}
                              alt={req.friendData?.displayName || "Pilgrim"}
                              className="w-10 h-10 rounded-full object-cover border border-linen-300 dark:border-charcoal-800"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <h4 className="font-semibold text-charcoal-800 dark:text-linen-100 font-sans tracking-tight text-sm">
                                {req.friendData?.displayName || "Faith Pilgrim"}
                              </h4>
                              <p className="text-xs text-charcoal-600 dark:text-charcoal-400 italic font-serif line-clamp-1">
                                {req.friendData?.bio || (language === "Spanish" ? "Caminando con el Señor." : "Walking with the Lord.")}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeclineRequest(req.id)}
                            disabled={actionLoadingId === req.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-linen-100 dark:bg-charcoal-800 hover:bg-linen-200 dark:hover:bg-charcoal-750 text-charcoal-600 dark:text-charcoal-300 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>{language === "Spanish" ? "Cancelar" : "Cancel"}</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* MY FRIENDS TAB */}
          {activeTab === "friends" && (
            <motion.div
              key="friends-tab"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-4"
            >
              {isLoadingFriends ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
                  <p className="text-xs text-charcoal-600 dark:text-charcoal-400 font-mono">
                    {language === "Spanish" ? "CARGANDO AMIGOS..." : "LOADING FRIENDS..."}
                  </p>
                </div>
              ) : acceptedFriends.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-charcoal-900 border border-dashed border-linen-300 dark:border-charcoal-800 rounded-2xl">
                  <Users className="w-10 h-10 text-charcoal-400 mx-auto mb-2" />
                  <p className="text-sm font-sans text-charcoal-800 dark:text-linen-100 font-semibold">
                    {language === "Spanish" ? "Aún no tienes amigos de fe agregados" : "No faith friends added yet"}
                  </p>
                  <p className="text-xs text-charcoal-600 dark:text-charcoal-400 max-w-sm mx-auto mt-1 leading-relaxed">
                    {language === "Spanish"
                      ? "¡Vayan de dos en dos! Utiliza la pestaña de búsqueda para encontrar a otros creyentes y comparte tu crecimiento espiritual."
                      : "We are built for community! Use the Search tab to connect with other pilgrims and support one another in prayer."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {acceptedFriends.map((friend) => (
                    <motion.div
                      key={friend.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 bg-white dark:bg-charcoal-900 border border-linen-300 dark:border-charcoal-800 rounded-2xl flex items-center justify-between gap-4 shadow-xs hover:border-brand-500/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={friend.friendData?.photoURL || fallbackAvatar}
                          alt={friend.friendData?.displayName || "Friend"}
                          className="w-12 h-12 rounded-full object-cover border border-linen-300 dark:border-charcoal-800 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h4 className="font-semibold text-charcoal-800 dark:text-linen-100 font-sans tracking-tight text-sm">
                            {friend.friendData?.displayName || "Faith Pilgrim"}
                          </h4>
                          <p className="text-xs text-charcoal-600 dark:text-charcoal-400 italic font-serif line-clamp-1">
                            {friend.friendData?.bio || (language === "Spanish" ? "Creciendo en Su gracia." : "Growing in His grace.")}
                          </p>
                        </div>
                      </div>

                      {/* Options or Chat bubble (visual link) */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            if (friend.friendData) {
                              setActiveChatFriend({
                                uid: friend.friendData.uid,
                                displayName: friend.friendData.displayName || "Faith Pilgrim",
                                photoURL: friend.friendData.photoURL
                              });
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/20 dark:hover:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{language === "Spanish" ? "Chat" : "Chat"}</span>
                        </button>

                        <button
                          onClick={() => handleDeclineRequest(friend.id)}
                          disabled={actionLoadingId === friend.id}
                          className="p-2 text-charcoal-400 hover:text-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/10 rounded-xl transition-colors cursor-pointer"
                          title={language === "Spanish" ? "Eliminar amigo" : "Remove friend"}
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
