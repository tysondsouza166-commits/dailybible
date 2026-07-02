import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { translate } from "../lib/translations";
import { BookOpen, Mail, ArrowRight, Shield, Heart, Eye, EyeOff, Lock } from "lucide-react";
import { motion } from "motion/react";

export const AuthScreen: React.FC = () => {
  const { signInWithGoogle, signInGuest, language } = useApp();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signInGuest(email, isSignUp ? name : undefined, password || undefined, isSignUp);
    } catch (err: any) {
      setError(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  const handleFaithPilgrim = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInGuest("pilgrim@dailybible.app", "Faith Pilgrim", "DailyBibleSecuredPass123!", false);
    } catch (err: any) {
      setError(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || "Google Sign-In failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-[100dvh] bg-white dark:bg-black text-slate-900 dark:text-white flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full bg-slate-50 dark:bg-[#1C1C1E] border border-slate-100 dark:border-gray-800 rounded-3xl shadow-xl overflow-hidden"
      >
        {/* Banner area */}
        <div className="bg-gradient-to-br from-red-600 to-red-800 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 bottom-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 100 }}
            className="w-16 h-16 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4"
          >
            <BookOpen className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">DailyBible</h1>
          <p className="text-red-100 text-sm mt-1">{translate("slogan", language) || "Your Daily Scripture Companion"}</p>
        </div>
 
        {/* Form Area */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-sm rounded-lg border border-rose-200 dark:border-rose-900/50">
              {error}
            </div>
          )}
 
          {/* Quick Access Pilgrim Button */}
          <div className="space-y-3">
            <button
              onClick={handleFaithPilgrim}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-3 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-xl shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <Heart className="w-5 h-5 fill-white/25" />
              <span>Continue as Faith Pilgrim</span>
            </button>
            <p className="text-xs text-center text-slate-400 dark:text-slate-500">
              Instant access with preset journaling & prayer templates
            </p>
          </div>
 
          <div className="flex items-center my-4">
            <div className="flex-1 border-t border-slate-200 dark:border-neutral-800" />
            <span className="px-3 text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
              Or Use Email Access
            </span>
            <div className="flex-1 border-t border-slate-200 dark:border-neutral-800" />
          </div>
 
          {/* Email and Name/Password Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {isSignUp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.3 }}
              >
                <label htmlFor="name-input" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Your Name (Optional)
                </label>
                <input
                  id="name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Faith Pilgrim"
                  disabled={loading}
                  className="w-full bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white transition-colors"
                />
              </motion.div>
            )}
 
            <div>
              <label htmlFor="email-input" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  disabled={loading}
                  className="w-full bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white transition-colors"
                />
                <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
              </div>
            </div>
 
            <div>
              <label htmlFor="password-input" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white transition-colors"
                />
                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <button
                  type="button"
                  onClick={() => {
                    setShowPassword(!showPassword);
                  }}
                  className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
 
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-xl shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <span>{isSignUp ? "Create Account & Access" : "Access Bible Dashboard"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
 
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
                className="text-xs text-red-600 dark:text-red-400 hover:underline font-semibold focus:outline-none cursor-pointer"
              >
                {isSignUp ? "Already have an account? Sign In" : "Need an account? Sign Up"}
              </button>
            </div>
          </form>
 
          {/* Google Sign-in Alternative */}
          <div className="pt-2 border-t border-slate-200 dark:border-neutral-800">
            <button
              onClick={handleGoogleClick}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 bg-white hover:bg-slate-50 dark:bg-black dark:hover:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-slate-300 py-2.5 px-4 rounded-xl text-sm transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        </div>
 
        {/* Info footer */}
        <div className="bg-slate-100 dark:bg-black px-6 py-4 flex items-center justify-center space-x-2 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-neutral-800">
          <Shield className="w-3.5 h-3.5" />
          <span>Secured by Firebase Authentication</span>
        </div>
      </motion.div>
    </div>
  );
};
