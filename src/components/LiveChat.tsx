import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { createOrGetChat, sendMessage, subscribeToMessages, ChatMessage } from "../lib/firebase";
import { Send, ArrowLeft, Heart, MessageCircle, ShieldCheck, Smile, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface LiveChatProps {
  friendUid: string;
  friendName: string;
  friendAvatar: string | null;
  onBack: () => void;
}

export const LiveChat: React.FC<LiveChatProps> = ({ friendUid, friendName, friendAvatar, onBack }) => {
  const { user, language } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Get or Create Chat ID on mount
  useEffect(() => {
    if (!user) return;
    
    const initChat = async () => {
      try {
        setIsConnecting(true);
        setError(null);
        const cid = await createOrGetChat(user.uid, friendUid);
        setChatId(cid);
      } catch (err: any) {
        console.error("Failed to initialize chat:", err);
        setError(language === "Spanish" ? "No se pudo conectar el chat." : "Failed to initialize secure chat room.");
      } finally {
        setIsConnecting(false);
      }
    };

    initChat();
  }, [user, friendUid]);

  // Subscribe to real-time messages when chatId is set
  useEffect(() => {
    if (!chatId) return;

    const unsubscribe = subscribeToMessages(chatId, (newMessages) => {
      setMessages(newMessages);
      // Let React render the new messages before scrolling
      setTimeout(() => scrollToBottom("smooth"), 100);
    });

    return () => {
      unsubscribe();
    };
  }, [chatId]);

  // Handle send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !chatId || !inputText.trim() || isSending) return;

    const textToSend = inputText.trim();
    setInputText("");
    setIsSending(true);

    try {
      await sendMessage(chatId, user.uid, textToSend);
    } catch (err: any) {
      console.error("Failed to send message:", err);
      setError(language === "Spanish" ? "Error al enviar mensaje." : "Failed to send message. Please retry.");
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    let date: Date;
    if (typeof timestamp === "number") {
      date = new Date(timestamp);
    } else if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const defaultAvatar = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80";

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col h-[600px] bg-linen-50 dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-800 rounded-3xl overflow-hidden shadow-xs relative">
      {/* Chat Header */}
      <div className="px-6 py-4 bg-white dark:bg-charcoal-900 border-b border-linen-300 dark:border-charcoal-850 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-linen-100 dark:hover:bg-charcoal-800 text-charcoal-700 dark:text-linen-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Back to friends"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <img
            src={friendAvatar || defaultAvatar}
            alt={friendName}
            className="w-10 h-10 rounded-full object-cover border border-linen-300 dark:border-charcoal-800"
            referrerPolicy="no-referrer"
          />

          <div>
            <h3 className="text-sm font-bold text-charcoal-800 dark:text-linen-100 font-sans tracking-tight">
              {friendName}
            </h3>
            <p className="text-[10px] text-brand-600 dark:text-brand-400 font-medium tracking-wide uppercase">
              {language === "Spanish" ? "En Línea" : "In Fellowship"}
            </p>
          </div>
        </div>

        {/* Encrypted Sync status label */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-brand-50 dark:bg-brand-950/20 border border-brand-200/40 dark:border-brand-900/30 rounded-full text-[10px] font-mono text-brand-700 dark:text-brand-300">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">REAL-TIME FELLOWSHIP</span>
        </div>
      </div>

      {/* Main Body: Messages Container */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-4"
      >
        {isConnecting ? (
          <div className="h-full flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-xs text-charcoal-600 dark:text-charcoal-400 font-mono">
              {language === "Spanish" ? "UNIENDO A LA SALA..." : "ESTABLISHING CHANNELS..."}
            </p>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
            <AlertCircle className="w-10 h-10 text-rose-500" />
            <p className="text-sm font-medium text-charcoal-800 dark:text-linen-100">{error}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="p-3 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-2xl">
              <MessageCircle className="w-6 h-6 animate-pulse" />
            </div>
            <h4 className="font-bold text-charcoal-800 dark:text-linen-100 text-sm font-sans">
              {language === "Spanish" ? "El principio de un lazo" : "Commence Fellowship"}
            </h4>
            <p className="text-xs text-charcoal-600 dark:text-charcoal-400 max-w-xs leading-relaxed">
              {language === "Spanish"
                ? "Envía un mensaje para comenzar a dialogar sobre escrituras, peticiones o devocionales."
                : "Send a message to start conversing about scripture, prayer requests, or daily encouragements."}
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === user?.uid;
            
            return (
              <motion.div
                key={msg.id || index}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex flex-col max-w-[75%] space-y-1`}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm shadow-2xs leading-relaxed ${
                      isMe
                        ? "bg-brand-600 dark:bg-brand-700 text-white font-medium rounded-tr-xs"
                        : "bg-white dark:bg-charcoal-900 text-charcoal-800 dark:text-linen-100 border border-linen-300 dark:border-charcoal-800 rounded-tl-xs"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span
                    className={`text-[9px] font-mono text-charcoal-500 dark:text-charcoal-500 px-1 ${
                      isMe ? "text-right" : "text-left"
                    }`}
                  >
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Footer */}
      <form
        onSubmit={handleSend}
        className="p-4 bg-white dark:bg-charcoal-900 border-t border-linen-300 dark:border-charcoal-850 flex items-center gap-3 shrink-0"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={language === "Spanish" ? "Escribe un mensaje de fe..." : "Write a encouraging message of faith..."}
          disabled={isConnecting || !!error}
          className="flex-1 bg-linen-50 dark:bg-charcoal-950 border border-linen-300 dark:border-charcoal-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-charcoal-800 dark:text-linen-100 transition-colors placeholder:text-charcoal-500 dark:placeholder:text-charcoal-500"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isSending || isConnecting || !!error}
          className="p-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:hover:bg-brand-600 text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center shrink-0"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
