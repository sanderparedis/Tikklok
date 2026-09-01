import React, { useState } from 'react';
import { 
  Play, 
  Square, 
  Plus, 
  Clock, 
  Calendar, 
  Briefcase, 
  GraduationCap, 
  CalendarOff, 
  Palmtree, 
  Check, 
  Tag, 
  FileText 
} from 'lucide-react';
import { WorkCategory, FreeDayType, TimerState } from '../types';
import { formatTimer, formatMinutes, formatMonoTime, CATEGORY_CONFIG, toLocalYYYYMMDD } from '../utils/calculations';

interface HoursTabProps {
  timer: TimerState;
  liveMinutes: number;
  currentWeekTotalMin: number;
  currentWeekIctMin: number;
  currentWeekTeachingMin: number;
  currentTargetMinutes: number;
  progressPercent: number;
  onStartTimer: (category: WorkCategory) => void;
  onStopTimer: () => void;
  onAddManualWorkEntry: (e: React.FormEvent<HTMLFormElement>) => void;
  onAddFreeDay: (e: React.FormEvent<HTMLFormElement>) => void;
  onAddVacationPeriod: (e: React.FormEvent<HTMLFormElement>) => void;
  defaultDate: string;
}

export const HoursTab: React.FC<HoursTabProps> = ({
  timer,
  liveMinutes,
  currentWeekTotalMin,
  currentWeekIctMin,
  currentWeekTeachingMin,
  currentTargetMinutes,
  progressPercent,
  onStartTimer,
  onStopTimer,
  onAddManualWorkEntry,
  onAddFreeDay,
  onAddVacationPeriod,
  defaultDate,
}) => {
  // Local state for selecting category before starting timer
  const [timerCategory, setTimerCategory] = useState<WorkCategory>('ict');
  const [manualCategory, setManualCategory] = useState<WorkCategory>('ict');
  const [showConfigForms, setShowConfigForms] = useState(false);

  const activeCategory = timer.category || timerCategory;
  const activeConfig = CATEGORY_CONFIG[activeCategory];

  return (
    <div className="space-y-6">
      {/* 1. Weekly Progress Bar & Focus Indicator */}
      <div className="card-panel p-5 bg-gradient-to-br from-[var(--panel-bg)] to-slate-50 dark:to-slate-900/40">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
          <div>
            <span className="label-tiny">Voortgang Weekdoel (Totaal 36u)</span>
            <div className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2 flex-wrap">
              <span>{formatMinutes(currentWeekTotalMin)}</span>
              <span className="text-sm font-normal text-[var(--text-muted)]">
                van {formatMinutes(currentTargetMinutes)} doel
              </span>
              {currentWeekTotalMin > currentTargetMinutes && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold">
                  +{formatMinutes(currentWeekTotalMin - currentTargetMinutes)} overuren
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1 text-sky-700 dark:text-sky-300">
              <Briefcase className="w-4 h-4" />
              <span>ICT: <strong>{formatMinutes(currentWeekIctMin)}</strong></span>
            </div>
            <div className="flex items-center gap-1 text-purple-700 dark:text-purple-300">
              <GraduationCap className="w-4 h-4" />
              <span>Les: <strong>{formatMinutes(currentWeekTeachingMin)}</strong></span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-brand-primary transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-[var(--text-muted)] mt-1.5">
          <span>0u</span>
          <span>{Math.round(progressPercent)}% voltooid</span>
          <span>{formatMinutes(currentTargetMinutes)}</span>
        </div>
      </div>

      {/* 2. Dual Grid: Live Timer Card & Handmatige Invoer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live Timer Card */}
        <div className="lg:col-span-5 card-panel p-6 flex flex-col justify-between relative overflow-hidden border-2 border-brand-primary/20">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${timer.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {timer.isActive ? 'Actieve Tijdregistratie' : 'Live Timer'}
                </span>
              </div>

              {/* Active / Current Category Badge */}
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${activeConfig.badgeBg} ${activeConfig.badgeText} ${activeConfig.badgeBorder} flex items-center gap-1.5`}>
                {activeCategory === 'ict' ? <Briefcase className="w-3.5 h-3.5" /> : <GraduationCap className="w-3.5 h-3.5" />}
                {activeConfig.label}
              </span>
            </div>

            {/* Category Selector (when not running) */}
            {!timer.isActive && (
              <div className="mb-5">
                <label className="label-tiny">Selecteer Categorie voor Timer</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-[var(--panel-border)]">
                  <button
                    type="button"
                    onClick={() => setTimerCategory('ict')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      timerCategory === 'ict'
                        ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>ICT-coördinatie</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTimerCategory('teaching')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      timerCategory === 'teaching'
                        ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Lesopdracht</span>
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 italic">
                  {CATEGORY_CONFIG[timerCategory].description}
                </p>
              </div>
            )}

            {/* Timer Display */}
            <div className="text-center py-4 sm:py-6">
              <div className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-[var(--text-main)]">
                {formatTimer(liveMinutes)}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                {timer.isActive
                  ? `Bezig met ${activeConfig.label.toLowerCase()} sinds ${new Date(timer.startTime!).toLocaleTimeString('nl', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Druk op start om de sessie live bij te houden'}
              </p>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-4">
            {timer.isActive ? (
              <button
                type="button"
                onClick={onStopTimer}
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 active:scale-[0.99] transition-all text-sm"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Timer & Registreer ({activeConfig.shortLabel})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onStartTimer(timerCategory)}
                className="w-full py-3.5 bg-brand-primary hover:brightness-110 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-[0.99] transition-all text-sm"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Live Timer ({CATEGORY_CONFIG[timerCategory].shortLabel})</span>
              </button>
            )}
          </div>
        </div>

        {/* Manual Time Entry Form */}
        <div className="lg:col-span-7 card-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-brand-primary" />
              <h2 className="text-sm font-bold text-[var(--text-main)]">Handmatige Tijdsregistratie</h2>
            </div>
            <span className="text-[11px] text-[var(--text-muted)]">Nadien toevoegen of corrigeren</span>
          </div>

          <form onSubmit={onAddManualWorkEntry} className="space-y-4">
            {/* Category Selector Buttons */}
            <div>
              <label className="label-tiny">Categorie</label>
              <input type="hidden" name="category" value={manualCategory} />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setManualCategory('ict')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    manualCategory === 'ict'
                      ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 ring-2 ring-sky-400/20'
                      : 'border-[var(--panel-border)] bg-[var(--input-bg)] text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-sky-700 dark:text-sky-300 mb-0.5">
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>ICT-coördinatie</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    ICT & Netwerk • Telt mee voor 36u
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setManualCategory('teaching')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    manualCategory === 'teaching'
                      ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 ring-2 ring-purple-400/20'
                      : 'border-[var(--panel-border)] bg-[var(--input-bg)] text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-purple-700 dark:text-purple-300 mb-0.5">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Lesopdracht</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    6 lesuren (50m) + voorbereiding
                  </div>
                </button>
              </div>
            </div>

            {/* Inputs: Datum, Start, Einde */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label-tiny">Datum</label>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={defaultDate}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label-tiny">Starttijd</label>
                <input
                  type="time"
                  name="start"
                  required
                  defaultValue="08:30"
                  className="input-field"
                />
              </div>

              <div>
                <label className="label-tiny">Eindtijd</label>
                <input
                  type="time"
                  name="end"
                  required
                  defaultValue="16:30"
                  className="input-field"
                />
              </div>
            </div>

            {/* Optional description */}
            <div>
              <label className="label-tiny">Omschrijving / Notitie (optioneel)</label>
              <div className="relative">
                <FileText className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
                <input
                  type="text"
                  name="description"
                  placeholder={manualCategory === 'ict' ? "bijv. Netwerkonderhoud, Chromebook uitrol, ticketing" : "bijv. Les 3B informatica, lesvoorbereiding, evaluatie"}
                  className="input-field pl-9"
                  maxLength={150}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Registratie Toevoegen</span>
            </button>
          </form>
        </div>
      </div>

      {/* 3. Collapsible School Agenda / Vrije Dagen & Vakanties */}
      <div className="card-panel p-4">
        <button
          type="button"
          onClick={() => setShowConfigForms(!showConfigForms)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
            <CalendarOff className="w-4 h-4 text-brand-primary" />
            <span>Schoolkalender, Vrije Dagen & Vakanties Configureren</span>
          </div>
          <span className="text-xs text-brand-primary font-semibold">
            {showConfigForms ? 'Verberg formulieren' : 'Beheer vrije dagen / vakanties'}
          </span>
        </button>

        {showConfigForms && (
          <div className="mt-5 pt-4 border-t border-[var(--panel-border)] grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vrije dag toevoegen */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                <CalendarOff className="w-3.5 h-3.5 text-amber-500" />
                <span>Vrije Dag / Feestdag Toevoegen</span>
              </h3>
              <form onSubmit={onAddFreeDay} className="space-y-3 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-[var(--panel-border)]">
                <div>
                  <label className="label-tiny">Datum</label>
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={defaultDate}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-tiny">Type</label>
                  <select name="type" className="input-field">
                    <option value="vrije/facultatieve dag">Vrije / Facultatieve Dag</option>
                    <option value="feestdag">Feestdag</option>
                    <option value="ziek">Ziek</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors">
                  Vrije Dag Registreren
                </button>
              </form>
            </div>

            {/* Vakantieperiode toevoegen */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                <Palmtree className="w-3.5 h-3.5 text-emerald-500" />
                <span>Vakantieperiode Toevoegen</span>
              </h3>
              <form onSubmit={onAddVacationPeriod} className="space-y-3 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-[var(--panel-border)]">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label-tiny">Van</label>
                    <input type="date" name="startDate" required defaultValue={defaultDate} className="input-field text-xs" />
                  </div>
                  <div>
                    <label className="label-tiny">Tot en met</label>
                    <input type="date" name="endDate" required defaultValue={defaultDate} className="input-field text-xs" />
                  </div>
                </div>
                <div>
                  <label className="label-tiny">Benaming</label>
                  <input type="text" name="description" placeholder="bijv. Herfstvakantie" required className="input-field text-xs" />
                </div>
                <button type="submit" className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors">
                  Vakantieperiode Opslaan
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
