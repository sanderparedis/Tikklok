import React, { useState } from 'react';
import {
  Clock,
  Briefcase,
  GraduationCap,
  Car,
  Moon,
  Sun,
  LogIn,
  LogOut,
  TrendingUp,
  Sliders,
  HeartPulse,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { User } from 'firebase/auth';
import { UserScheduleConfig } from '../types';
import {
  formatMinutes,
  formatMonoTime,
  computeScheduleDetails,
  formatBalanceText,
  formatSignedMono,
  formatEuro,
  formatKm
} from '../utils/calculations';

interface HeaderStatsProps {
  user: User | null;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onLogin: () => void;
  onLogout: () => void;
  schoolYear: string;
  targetMin: number;
  reductionMin?: number;
  sickReductionMin?: number;
  teachingTargetMin?: number;
  totalWorkedMin: number;
  ictWorkedMin: number;
  waiWorkedMin?: number;
  teachingWorkedMin: number;
  overtimeBalance: number;
  /** Saldo ICT van de lopende week t.e.m. vandaag (pro rata). */
  weekBalanceMin?: number;
  /** Saldo lesopdracht van de lopende week t.e.m. vandaag (pro rata). */
  teachingWeekBalanceMin?: number;
  /** Eigen saldo lesopdracht over het schooljaar. */
  teachingBalance?: number;
  currentMonthKm: number;
  currentMonthTravelComp: number;
  currentMonthName: string;
  scheduleConfig?: UserScheduleConfig;
  onOpenScheduleConfig?: () => void;
  onOpenSickLeaveModal?: () => void;
  /** Live timer: op gsm boven de statistieken, op desktop links ervan. */
  timerSlot?: React.ReactNode;
}

const balanceColor = (min: number) =>
  min >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400';

export const HeaderStats: React.FC<HeaderStatsProps> = ({
  user,
  isDarkMode,
  onToggleDarkMode,
  onLogin,
  onLogout,
  schoolYear,
  targetMin,
  reductionMin = 0,
  sickReductionMin = 0,
  teachingTargetMin,
  totalWorkedMin,
  ictWorkedMin,
  waiWorkedMin = 0,
  teachingWorkedMin,
  overtimeBalance,
  weekBalanceMin = 0,
  teachingWeekBalanceMin = 0,
  teachingBalance = 0,
  currentMonthKm,
  currentMonthTravelComp,
  currentMonthName,
  scheduleConfig,
  onOpenScheduleConfig,
  onOpenSickLeaveModal,
  timerSlot
}) => {
  const [statsOpen, setStatsOpen] = useState(false);
  const schedule = computeScheduleDetails(scheduleConfig);

  return (
    <header className="mb-6 space-y-4">
      {/* Kopbalk */}
      <div className="flex justify-between items-center gap-3 bg-[var(--panel-bg)] p-3 sm:p-4 rounded-2xl border border-[var(--panel-border)] shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-brand-primary/10 dark:bg-brand-primary/20 items-center justify-center text-brand-primary shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
              <span className="shrink-0">Tikklok</span>
              <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-normal border border-slate-200 dark:border-slate-700 shrink-0">
                SJ {schoolYear}
              </span>
            </h1>
            <p className="hidden md:block text-xs text-[var(--text-muted)]">
              ICT ({schedule.fractionLabel}: norm {formatMinutes(schedule.adminTargetMin)} officieel voor overuren)
              {schedule.teachingNumerator > 0 && ` • Lesopdracht (${schedule.teachingFractionLabel}: eigen admin)`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onOpenSickLeaveModal && (
            <button
              type="button"
              onClick={onOpenSickLeaveModal}
              aria-label="Ziektedag ingeven"
              title="Ziektedag(en) registreren"
              className="flex items-center gap-1.5 p-2 sm:px-3 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              <HeartPulse className="w-4 h-4 text-rose-500" />
              <span className="hidden sm:inline">Ziektedag ingeven</span>
            </button>
          )}

          {onOpenScheduleConfig && (
            <button
              type="button"
              onClick={onOpenScheduleConfig}
              aria-label={`Verdeelsleutel (${schedule.fractionLabel}) wijzigen`}
              title="Aanstelling & verdeelsleutel aanpassen"
              className="flex items-center gap-1.5 p-2 sm:px-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-xs font-semibold text-brand-primary"
            >
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline">Verdeelsleutel ({schedule.fractionLabel})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={isDarkMode ? 'Lichte modus' : 'Donkere modus'}
            aria-pressed={isDarkMode}
            className="p-2 rounded-xl border border-[var(--panel-border)] hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-[var(--text-muted)] hover:text-[var(--text-main)]"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {user ? (
            <div className="flex items-center gap-2 pl-1.5 sm:pl-2 border-l border-[var(--panel-border)]">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Gebruiker'}
                  className="hidden sm:block w-8 h-8 rounded-full border border-[var(--panel-border)]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="hidden sm:flex w-8 h-8 rounded-full bg-brand-primary text-white text-xs items-center justify-center font-bold">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-[var(--text-main)] leading-tight">
                  {user.displayName || user.email}
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">Aangemeld</div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Afmelden"
                aria-label="Afmelden"
                className="p-2 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="flex items-center gap-2 px-3 py-2 bg-brand-primary text-white text-xs sm:text-sm font-semibold rounded-xl hover:brightness-110 transition-all shadow-md shadow-brand-primary/20"
            >
              <LogIn className="w-4 h-4" />
              <span>Inloggen</span>
            </button>
          )}
        </div>
      </div>

      {/* Timer + statistieken */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {timerSlot && <div className="lg:col-span-4">{timerSlot}</div>}

        <div className={timerSlot ? 'lg:col-span-8' : 'lg:col-span-12'}>
          {/* Compacte balk (enkel op gsm): de kerncijfers, tik om alle kaartjes te zien */}
          <button
            type="button"
            onClick={() => setStatsOpen(!statsOpen)}
            aria-expanded={statsOpen}
            aria-controls="stat-cards"
            className="sm:hidden w-full card-panel px-4 py-3 flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-4 min-w-0 text-xs">
              <div>
                <div className="label-tiny !mb-0">Overuren</div>
                <div className={`font-mono font-bold text-sm ${balanceColor(overtimeBalance)}`}>{formatSignedMono(overtimeBalance)}</div>
              </div>
              <div className="min-w-0">
                <div className="label-tiny !mb-0">Deze week</div>
                <div className={`font-semibold truncate ${balanceColor(weekBalanceMin)}`}>{formatBalanceText(weekBalanceMin)}</div>
              </div>
              <div>
                <div className="label-tiny !mb-0">Gewerkt</div>
                <div className="font-mono font-bold text-sm text-[var(--text-main)]">{formatMonoTime(totalWorkedMin)}</div>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform ${statsOpen ? 'rotate-180' : ''}`} />
          </button>

          <div
            id="stat-cards"
            className={`${statsOpen ? 'grid mt-3' : 'hidden'} sm:grid sm:mt-0 grid-cols-2 sm:grid-cols-3 gap-3`}
          >
            {/* Overurensaldo (ICT) */}
            <div className="card-panel p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <span className="label-tiny !mb-0 font-semibold text-slate-700 dark:text-slate-300">Overuren {schoolYear}</span>
                <TrendingUp className={`w-4 h-4 ${overtimeBalance >= 0 ? 'text-emerald-500' : 'text-amber-500'}`} />
              </div>
              <div>
                <div className={`text-xl font-bold font-mono ${balanceColor(overtimeBalance)}`}>
                  {formatSignedMono(overtimeBalance)}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                  {overtimeBalance >= 0 ? 'Positief saldo' : 'Inhaalsaldo'} ({schedule.fractionLabel}, t.e.m. vandaag)
                </div>
              </div>
            </div>

            {/* ICT Gewerkt (deze week) */}
            <div className="card-panel p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-sky-600 dark:text-sky-400 mb-1.5">
                <span className="label-tiny !mb-0 text-sky-700 dark:text-sky-300 font-semibold">ICT (wk)</span>
                <Briefcase className="w-4 h-4 opacity-80" />
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-sky-700 dark:text-sky-300">
                  {formatMonoTime(ictWorkedMin)}
                </div>
                <div
                  className={`text-[11px] mt-0.5 truncate ${targetMin > 0 ? balanceColor(weekBalanceMin) : 'text-[var(--text-muted)]'}`}
                  title={'Saldo t.e.m. vandaag. ' + (reductionMin > 0
                    ? `Weekdoel ${formatMinutes(targetMin)}: norm ${formatMinutes(schedule.adminTargetMin)} min ${formatMinutes(reductionMin)} ${sickReductionMin > 0 ? (reductionMin === sickReductionMin ? 'ziekte' : 'ziekte/vrij') : 'vrij'}`
                    : `Weekdoel ${formatMinutes(targetMin)} (norm ${schedule.fractionLabel})`)}
                >
                  {targetMin > 0 ? formatBalanceText(weekBalanceMin) : 'Vrije week'}
                </div>
              </div>
            </div>

            {/* Lesopdracht - eigen saldo */}
            <div className="card-panel p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1.5">
                <span className="label-tiny !mb-0 text-purple-700 dark:text-purple-300 font-semibold">
                  Les {schedule.teachingFractionLabel} (wk)
                </span>
                <GraduationCap className="w-4 h-4 opacity-80" />
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-purple-700 dark:text-purple-300">
                  {formatMonoTime(teachingWorkedMin)}
                </div>
                <div
                  className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate"
                  title={`Eigen saldo lesopdracht (los van de officiële overuren). Weekdoel ${formatMinutes(teachingTargetMin ?? schedule.teachingTargetMin)}, norm ${formatMinutes(schedule.teachingTargetMin)}/week.`}
                >
                  <span className={balanceColor(teachingWeekBalanceMin)}>{formatBalanceText(teachingWeekBalanceMin)}</span>
                  {' • SJ '}
                  <span className={balanceColor(teachingBalance)}>{formatSignedMono(teachingBalance)}</span>
                </div>
              </div>
            </div>

            {/* Totaal gewerkt (deze week) */}
            <div className="card-panel p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-brand-primary mb-1.5">
                <span className="label-tiny !mb-0 text-brand-primary font-semibold">Gewerkt (wk)</span>
                <Clock className="w-4 h-4 opacity-80" />
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-[var(--text-main)]">
                  {formatMonoTime(totalWorkedMin)}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate" title="Alle gepresteerde uren deze week (ma-zo): ICT + lesopdracht + W-AI">
                  ICT + les + W-AI (ma-zo)
                </div>
              </div>
            </div>

            {/* W-AI (deze week) */}
            <div className="card-panel p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-orange-600 dark:text-orange-400 mb-1.5">
                <span className="label-tiny !mb-0 text-orange-700 dark:text-orange-300 font-semibold">W-AI (wk)</span>
                <Sparkles className="w-4 h-4 opacity-80" />
              </div>
              <div>
                <div className="text-xl font-bold font-mono text-orange-700 dark:text-orange-300">
                  {formatMonoTime(waiWorkedMin)}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate" title="W-AI telt mee in je totaal gewerkte uren, niet in ICT of overuren.">
                  Telt niet mee in ICT
                </div>
              </div>
            </div>

            {/* Verplaatsing (huidige maand) */}
            <div className="card-panel p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1.5">
                <span className="label-tiny !mb-0 text-emerald-700 dark:text-emerald-300 font-semibold">
                  Ritten {currentMonthName}
                </span>
                <Car className="w-4 h-4 opacity-80" />
              </div>
              <div>
                <div className="text-xl font-bold text-[var(--text-main)] font-mono">
                  {formatEuro(currentMonthTravelComp)}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5 font-mono">
                  {formatKm(currentMonthKm)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
