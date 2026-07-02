import React from "react";
import { Flame, Calendar, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useApp } from "../context/AppContext";

export const StreakCalendar: React.FC = () => {
  const { streak } = useApp();

  const daysOfWeek = [
    { label: "M", fullName: "Monday", index: 0 },
    { label: "T", fullName: "Tuesday", index: 1 },
    { label: "W", fullName: "Wednesday", index: 2 },
    { label: "T", fullName: "Thursday", index: 3 },
    { label: "F", fullName: "Friday", index: 4 },
    { label: "S", fullName: "Saturday", index: 5 },
    { label: "S", fullName: "Sunday", index: 6 },
  ];

  // Get current day of week (0 = Monday, 6 = Sunday)
  const getTodayIndex = (): number => {
    const day = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    return (day + 6) % 7;
  };

  const todayIndex = getTodayIndex();

  const isDayActive = (dayIdx: number): boolean => {
    if (streak <= 0) return false;

    // A day is active if:
    // 1. It is today or earlier in the current week, and within the streak window.
    if (dayIdx <= todayIndex) {
      return todayIndex - dayIdx < streak;
    }
    // 2. It is later in the week, meaning we are looking at the previous week's days
    // that are still covered by the streak count.
    return 7 - dayIdx + todayIndex < streak;
  };

  return (
    <div className="bg-[#1E1E1E] rounded-3xl p-5 border border-neutral-800/20 shadow-sm mt-6 flex flex-col">
      {/* Header Info */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] text-amber-500 uppercase tracking-widest font-bold flex items-center gap-1">
              Consistency
            </span>
            <h4 className="text-base font-bold text-white mt-0.5">Streak Calendar</h4>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-xl text-xs font-bold border border-amber-500/10">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>{streak} Day Streak</span>
        </div>
      </div>

      {/* 7 Days Bar */}
      <div className="overflow-x-auto scrollbar-none py-1">
        <div className="flex justify-between items-center min-w-[280px] gap-2">
          {daysOfWeek.map((day) => {
            const active = isDayActive(day.index);
            const isToday = day.index === todayIndex;

            return (
              <div
                key={day.fullName}
                className="flex flex-col items-center gap-2 flex-1"
              >
                {/* Circle Indicator */}
                <motion.div
                  initial={active ? { scale: 0.8, opacity: 0.5 } : false}
                  animate={active ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 0.8 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center relative transition-all duration-300 ${
                    active
                      ? "bg-amber-500 text-black font-extrabold shadow-lg shadow-amber-500/25"
                      : isToday
                      ? "bg-neutral-900 border border-amber-500/40 text-neutral-400"
                      : "bg-neutral-900 border border-neutral-800/60 text-neutral-600"
                  }`}
                >
                  {active ? (
                    <Flame className="w-4 h-4" />
                  ) : (
                    <span className="text-[10px] font-mono font-bold uppercase">{day.label}</span>
                  )}

                  {/* Indicator Dot for Today */}
                  {isToday && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  )}
                </motion.div>

                {/* Sub-label */}
                <span
                  className={`text-[10px] font-semibold transition-colors duration-200 ${
                    isToday
                      ? "text-amber-500 font-bold"
                      : active
                      ? "text-neutral-300"
                      : "text-neutral-500"
                  }`}
                >
                  {isToday ? "Today" : day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
