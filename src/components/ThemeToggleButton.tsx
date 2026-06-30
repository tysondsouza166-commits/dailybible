import React from "react";
import { Sun, Moon } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "../context/ThemeContext";

interface ThemeToggleButtonProps {
  className?: string;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({ className = "" }) => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <button
      id="theme-toggle-btn"
      onClick={toggleTheme}
      className={`relative p-2.5 rounded-xl transition-all duration-200 outline-none border border-linen-300 hover:border-linen-400 dark:border-charcoal-800 dark:hover:border-charcoal-700 hover:bg-linen-200 dark:hover:bg-charcoal-800 rounded-full cursor-pointer select-none flex items-center justify-center ${className}`}
      aria-label={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
      title={isDarkMode ? "Switch to Light Theme" : "Switch to Dark Theme"}
    >
      <div className="relative w-4.5 h-4.5 flex items-center justify-center overflow-hidden">
        <motion.div
          initial={false}
          animate={{
            y: isDarkMode ? 0 : 25,
            opacity: isDarkMode ? 1 : 0,
            rotate: isDarkMode ? 0 : -90
          }}
          transition={{ type: "spring", stiffness: 250, damping: 18 }}
          className="absolute flex items-center justify-center"
        >
          <Sun className="w-4.5 h-4.5 text-clay-500 fill-clay-500/10" />
        </motion.div>

        <motion.div
          initial={false}
          animate={{
            y: isDarkMode ? -25 : 0,
            opacity: isDarkMode ? 0 : 1,
            rotate: isDarkMode ? 90 : 0
          }}
          transition={{ type: "spring", stiffness: 250, damping: 18 }}
          className="absolute flex items-center justify-center"
        >
          <Moon className="w-4.5 h-4.5 text-charcoal-600 dark:text-charcoal-400" />
        </motion.div>
      </div>
    </button>
  );
};
