import React from 'react';
import { Clock, Briefcase, GraduationCap, Car, Moon, Sun, LogIn, LogOut, TrendingUp, Sparkles } from 'lucide-react';
import { User } from 'firebase/auth';
import { formatMinutes, formatMonoTime } from '../utils/calculations';

interface HeaderStatsProps {
  user: User | null;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onLogin: () => void;
  onLogout: () => void;
  schoolYear: string;
  targetMin: number;
  totalWorkedMin: number;
  ictWorkedMin: number;
  teachingWorkedMin: number;
  overtimeBalance: number;
  totalKm: number;
  totalTravelComp: number;
}

export const HeaderStats: React.FC<HeaderStatsProps> = ({
  user,
  isDarkMode,
  onToggleDarkMode,
  onLogin,
  onLogout,
  schoolYear,
  targetMin,
  totalWorkedMin,
  ictWorkedMin,
  teachingWorkedMin,
  overtimeBalance,
  totalKm,
  totalTravelComp
}) => {
  const isOvertimePositive = overtimeBalance >= 0;

  return (
    <header className="mb-8 space-y-6">
      {/* Top Navbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--panel-bg)] p-4 rounded-2xl border border-[var(--panel-border)] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-primary/10 dark:bg-brand-primary/20 flex items-center justify-center text-brand-primary">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
              WerkTijd Tracker
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-normal border border-slate-200 dark:border-slate-700">
                SJ {schoolYear}
              </span>
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Tijdregistratie met uitsplitsing ICT-coördinatie & Lesopdracht • Streefdoel 36u / week
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={onToggleDarkMode}
            aria-label="Toggle dark mode"
            className="p-2.5 rounded-xl border border-[var(--panel-border)] hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-[var(--text-muted)] hover:text-[var(--text-main)]"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {user ? (
            <div className="flex items-center gap-3 pl-2 border-l border-[var(--panel-border)]">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Gebruiker'}
                  className="w-8 h-8 rounded-full border border-[var(--panel-border)]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-primary text-white text-xs flex items-center justify-center font-bold">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold text-[var(--text-main)] leading-tight">
                  {user.displayName || user.email}
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">Aangemeld</div>
              </div>
              <button
                onClick={onLogout}
                title="Afmelden"
                className="p-2 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-sm font-semibold rounded-xl hover:brightness-110 transition-all shadow-md shadow-brand-primary/20"
            >
              <LogIn className="w-4 h-4" />
              <span>Inloggen met Google</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Weekdoel */}
        <div className="card-panel p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-brand-primary mb-2">
            <span className="label-tiny !mb-0 text-brand-primary font-semibold">Streefdoel (wk)</span>
            <Clock className="w-4 h-4 opacity-80" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--text-main)]">
              {formatMonoTime(targetMin)}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Norm: 36u 00m / week
            </div>
          </div>
        </div>

        {/* Totaal Gewerkt (deze week) */}
        <div className="card-panel p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-brand-primary mb-2">
            <span className="label-tiny !mb-0 text-brand-primary font-semibold">Totaal Gewerkt (wk)</span>
            <Sparkles className="w-4 h-4 opacity-80" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-brand-primary">
              {formatMonoTime(totalWorkedMin)}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {targetMin > 0 ? `${Math.round((totalWorkedMin / targetMin) * 100)}% van streefdoel` : 'Vrije week'}
            </div>
          </div>
        </div>

        {/* Overurensaldo */}
        <div className="card-panel p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="label-tiny !mb-0 font-semibold text-slate-700 dark:text-slate-300">Overuren ({schoolYear})</span>
            <TrendingUp className={`w-4 h-4 ${isOvertimePositive ? 'text-emerald-500' : 'text-amber-500'}`} />
          </div>
          <div>
            <div className={`text-xl sm:text-2xl font-bold font-mono ${isOvertimePositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {isOvertimePositive ? `+${formatMonoTime(overtimeBalance)}` : formatMonoTime(overtimeBalance)}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {isOvertimePositive ? 'Positief saldo' : 'Inhaalsaldo'}
            </div>
          </div>
        </div>

        {/* Uitsplitsing Categorieën */}
        <div className="card-panel p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 mb-2">
            <span className="label-tiny !mb-0 font-semibold text-slate-700 dark:text-slate-300">Opdeling (wk)</span>
            <Briefcase className="w-4 h-4 opacity-80 text-sky-600" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-sky-700 dark:text-sky-300 flex items-center gap-1 font-semibold">
                <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" /> ICT:
              </span>
              <span className="font-mono font-bold text-sky-700 dark:text-sky-300">{formatMonoTime(ictWorkedMin)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-purple-700 dark:text-purple-300 flex items-center gap-1 font-semibold">
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Les:
              </span>
              <span className="font-mono font-bold text-purple-700 dark:text-purple-300">{formatMonoTime(teachingWorkedMin)}</span>
            </div>
          </div>
        </div>

        {/* KM & Vergoeding */}
        <div className="card-panel p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
            <span className="label-tiny !mb-0 text-emerald-700 dark:text-emerald-300 font-semibold">Verplaatsing</span>
            <Car className="w-4 h-4 opacity-80" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-[var(--text-main)]">
              € {totalTravelComp.toFixed(2)}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5 font-mono">
              {totalKm.toFixed(1)} km (auto €0,4285)
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
