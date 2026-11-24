import React, { useState } from 'react';
import { Play, Square, Briefcase, GraduationCap, Sparkles, AlarmClock } from 'lucide-react';
import { WorkCategory, TimerState } from '../types';
import { formatTimer, CATEGORY_CONFIG } from '../utils/calculations';

interface TimerCardProps {
  timer: TimerState;
  liveMinutes: number;
  onStartTimer: (category: WorkCategory) => void;
  onStopTimer: () => void;
  /** Timer loopt nog na 18:00 (of sinds een vorige dag). */
  isLate?: boolean;
}

const CATEGORY_OPTIONS: { value: WorkCategory; label: string; active: string }[] = [
  { value: 'ict', label: 'ICT', active: 'text-sky-700 dark:text-sky-300' },
  { value: 'teaching', label: 'Les', active: 'text-purple-700 dark:text-purple-300' },
  { value: 'wai', label: 'W-AI', active: 'text-orange-700 dark:text-orange-300' }
];

const CategoryIcon: React.FC<{ cat: WorkCategory; className: string }> = ({ cat, className }) =>
  cat === 'teaching' ? <GraduationCap className={className} /> : cat === 'wai' ? <Sparkles className={className} /> : <Briefcase className={className} />;

/**
 * Live timer (Start/Stop). Staat op gsm bovenaan, boven de statistieken,
 * zodat je zonder scrollen kan starten of stoppen.
 */
export const TimerCard: React.FC<TimerCardProps> = ({ timer, liveMinutes, onStartTimer, onStopTimer, isLate = false }) => {
  const [timerCategory, setTimerCategory] = useState<WorkCategory>('ict');
  const activeCategory: WorkCategory = timer.isActive ? (timer.category || 'ict') : timerCategory;
  const activeConfig = CATEGORY_CONFIG[activeCategory];

  return (
    <section
      aria-label="Live timer"
      className="card-panel p-4 sm:p-5 border-2 border-brand-primary/20 flex flex-col gap-3 h-full"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${timer.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {timer.isActive ? 'Timer loopt' : 'Live timer'}
          </span>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${activeConfig.badgeBg} ${activeConfig.badgeText} ${activeConfig.badgeBorder} flex items-center gap-1.5`}>
          <CategoryIcon cat={activeCategory} className="w-3.5 h-3.5" />
          {activeConfig.label}
        </span>
      </div>

      {isLate && (
        <div role="status" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-semibold">
          <AlarmClock className="w-4 h-4 shrink-0" />
          <span>Loopt nog na 18:00 — vergeten te stoppen?</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-main)]">
            {formatTimer(liveMinutes)}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
            {timer.isActive && timer.startTime
              ? `Sinds ${new Date(timer.startTime).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}`
              : CATEGORY_CONFIG[timerCategory].description}
          </p>
        </div>

        {timer.isActive ? (
          <button
            type="button"
            onClick={onStopTimer}
            className="shrink-0 px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 active:scale-[0.98] transition-all text-sm"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onStartTimer(timerCategory)}
            className="shrink-0 px-5 py-3 bg-brand-primary hover:brightness-110 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-[0.98] transition-all text-sm"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start</span>
          </button>
        )}
      </div>

      {!timer.isActive && (
        <div
          role="radiogroup"
          aria-label="Categorie voor de timer"
          className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-[var(--panel-border)]"
        >
          {CATEGORY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={timerCategory === opt.value}
              onClick={() => setTimerCategory(opt.value)}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                timerCategory === opt.value
                  ? `bg-white dark:bg-slate-700 shadow-sm ${opt.active}`
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CategoryIcon cat={opt.value} className="w-3.5 h-3.5" />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
