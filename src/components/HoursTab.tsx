import React, { useState } from 'react';
import { 
  Plus, 
  Clock, 
  Calendar, 
  Briefcase, 
  GraduationCap, 
  CalendarOff, 
  Palmtree, 
  Check, 
  Tag, 
  FileText,
  Sparkles
} from 'lucide-react';
import { WorkCategory, UserScheduleConfig } from '../types';
import { formatMinutes, formatMonoTime, CATEGORY_CONFIG, toLocalYYYYMMDD, computeScheduleDetails, formatBalanceText } from '../utils/calculations';

interface HoursTabProps {
  currentWeekTotalMin: number;
  currentWeekIctMin: number;
  currentWeekTeachingMin: number;
  currentWeekWaiMin?: number;
  currentTargetMinutes: number;
  /** Pro-rata doel t.e.m. vandaag en het bijhorende saldo (zelfde cijfer als in het rapport). */
  currentTargetUpToMin?: number;
  currentWeekBalanceMin?: number;
  progressPercent: number;
  onAddManualWorkEntry: (e: React.FormEvent<HTMLFormElement>) => void;
  onAddFreeDay: (e: React.FormEvent<HTMLFormElement>) => void;
  onAddVacationPeriod: (e: React.FormEvent<HTMLFormElement>) => void;
  defaultDate: string;
  scheduleConfig?: UserScheduleConfig;
}

export const HoursTab: React.FC<HoursTabProps> = ({
  currentWeekTotalMin,
  currentWeekIctMin,
  currentWeekTeachingMin,
  currentWeekWaiMin = 0,
  currentTargetMinutes,
  currentTargetUpToMin = 0,
  currentWeekBalanceMin = 0,
  progressPercent,
  onAddManualWorkEntry,
  onAddFreeDay,
  onAddVacationPeriod,
  defaultDate,
  scheduleConfig
}) => {
  // Local state for selecting category before starting timer
  const [manualCategory, setManualCategory] = useState<WorkCategory>('ict');
  const [showConfigForms, setShowConfigForms] = useState(false);

  const schedule = computeScheduleDetails(scheduleConfig);
  return (
    <div className="space-y-6">
      {/* 1. Weekly Progress Bar & Focus Indicator */}
      <div className="card-panel p-5 bg-gradient-to-br from-[var(--panel-bg)] to-slate-50 dark:to-slate-900/40">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="label-tiny">Voortgang Administratieve Uren (ICT-coördinatie - {schedule.fractionLabel})</span>
            </div>
            <div className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2 flex-wrap">
              <span className="text-sky-700 dark:text-sky-300 font-mono">{formatMinutes(currentWeekIctMin)}</span>
              <span className="text-sm font-normal text-[var(--text-muted)]">
                van {formatMinutes(currentTargetMinutes)} doel ({schedule.fractionLabel})
              </span>
              {currentTargetMinutes > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                    currentWeekBalanceMin >= 0
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                  }`}
                  title={`Doel t.e.m. vandaag: ${formatMinutes(currentTargetUpToMin)}`}
                >
                  {formatBalanceText(currentWeekBalanceMin)} (t.e.m. vandaag)
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            {schedule.teachingNumerator > 0 && (
              <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                <GraduationCap className="w-4 h-4" />
                <span>Lesopdracht ({schedule.teachingFractionLabel}): <strong>{formatMinutes(currentWeekTeachingMin)}</strong></span>
                <span className="text-[10px] font-normal text-[var(--text-muted)]">(eigen admin)</span>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-1 text-[var(--text-muted)] pl-2 border-l border-[var(--panel-border)]">
              <span>Totaal: <strong className="text-[var(--text-main)]">{formatMinutes(currentWeekTotalMin)}</strong></span>
            </div>
            {currentWeekWaiMin > 0 && (
              <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-300 pl-2 border-l border-[var(--panel-border)]" title="Telt mee in het totaal, niet in ICT of overuren">
                <Sparkles className="w-4 h-4" />
                <span>W-AI: <strong>{formatMinutes(currentWeekWaiMin)}</strong></span>
                <span className="text-[10px] font-normal text-[var(--text-muted)]">(niet ICT)</span>
              </div>
            )}
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
          <span>{Math.round(progressPercent)}% voltooid (ICT)</span>
          <span>{formatMinutes(currentTargetMinutes)}</span>
        </div>
      </div>

      {/* 2. Handmatige invoer (de live timer staat bovenaan de pagina) */}
      <div>
        {/* Manual Time Entry Form */}
        <div className="card-panel p-4 sm:p-6">
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                    <span>ICT-coördinatie (15/21)</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    Administratief • Telt mee voor overuren
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
                    <span>Lesopdracht (6/21)</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    6 lesuren (50m) • Eigen administratie
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setManualCategory('wai')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    manualCategory === 'wai'
                      ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200 ring-2 ring-orange-400/20'
                      : 'border-[var(--panel-border)] bg-[var(--input-bg)] text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-orange-700 dark:text-orange-300 mb-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>W-AI</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    Aparte opdracht • Telt mee in totaal, niet in ICT
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
              <label className="label-tiny flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-brand-primary" />
                <span>Omschrijving / Notitie (optioneel)</span>
              </label>
              <input
                type="text"
                name="description"
                placeholder={manualCategory === 'ict' ? "bijv. Netwerkonderhoud, Chromebook uitrol, ticketing" : "bijv. Les 3B informatica, lesvoorbereiding, evaluatie"}
                className="input-field"
                maxLength={150}
              />
            </div>

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Registratie Toevoegen</span>
            </button>
          </form>
        </div>
      </div>

      {/* 3. Collapsible School Agenda / Vrije Dagen, Ziektedagen & Vakanties */}
      <div className="card-panel p-4">
        <button
          type="button"
          onClick={() => setShowConfigForms(!showConfigForms)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
            <CalendarOff className="w-4 h-4 text-brand-primary" />
            <span>Schoolkalender, Ziektedagen, Vrije Dagen & Vakanties</span>
          </div>
          <span className="text-xs text-brand-primary font-semibold">
            {showConfigForms ? 'Verberg configuratie' : 'Beheer afwezigheden / kalender'}
          </span>
        </button>

        {showConfigForms && (
          <div className="mt-5 pt-4 border-t border-[var(--panel-border)] grid grid-cols-1 md:grid-cols-2 gap-6">
            <p className="md:col-span-2 text-xs text-[var(--text-muted)]">
              Ziektedagen geef je in via de knop <strong>Ziek</strong> bovenaan; de verdeelsleutel wijzig je via <strong>Verdeelsleutel</strong>.
            </p>
            {/* Card 2: Vrije dag / Feestdag toevoegen */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                <CalendarOff className="w-3.5 h-3.5 text-amber-500" />
                <span>Vrije Dag / Feestdag</span>
              </h3>
              <form onSubmit={onAddFreeDay} className="space-y-3 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-[var(--panel-border)]">
                <div>
                  <label className="label-tiny">Datum</label>
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={defaultDate}
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="label-tiny">Type</label>
                  <select name="type" className="input-field text-xs">
                    <option value="vrije/facultatieve dag">Vrije / Facultatieve Dag</option>
                    <option value="feestdag">Feestdag</option>
                    <option value="ziek">Ziek (enkele dag)</option>
                  </select>
                </div>
                <div>
                  <label className="label-tiny">Notitie (optioneel)</label>
                  <input
                    type="text"
                    name="description"
                    placeholder="bijv. Pedagogische studiedag"
                    maxLength={200}
                    className="input-field text-xs"
                  />
                </div>
                <button type="submit" className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors">
                  Vrije Dag Registreren
                </button>
              </form>
            </div>

            {/* Card 3: Vakantieperiode toevoegen */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                <Palmtree className="w-3.5 h-3.5 text-emerald-500" />
                <span>Vakantieperiode</span>
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
