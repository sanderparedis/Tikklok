import React, { useState } from 'react';
import { 
  BarChart3, 
  Download, 
  ChevronDown, 
  ChevronRight, 
  Briefcase, 
  GraduationCap, 
  TrendingUp, 
  Calendar, 
  Layers, 
  Car, 
  CheckCircle2, 
  Info 
} from 'lucide-react';
import { SchoolYearData, WorkEntry, TravelEntry } from '../types';
import { formatMinutes, formatMonoTime, formatWeekLabel } from '../utils/calculations';
import * as XLSX from 'xlsx';

interface MonthlyReportItem {
  monthKey: string;
  monthLabel: string;
  ictMin: number;
  teachingMin: number;
  totalWorkMin: number;
  travelKm: number;
  travelComp: number;
  entriesCount: number;
}

interface LastWeekReportItem {
  mondayStr: string;
  weekLabel: string;
  targetMin: number;
  workedIctMin: number;
  workedTeachingMin: number;
  workedTotalMin: number;
  balanceMin: number;
  freeDaysCount: number;
}

interface ReportsTabProps {
  schoolYearsData: SchoolYearData[];
  monthlyData: MonthlyReportItem[];
  lastThreeWeeks: LastWeekReportItem[];
  workEntries: WorkEntry[];
  travelEntries: TravelEntry[];
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  schoolYearsData,
  monthlyData,
  lastThreeWeeks,
  workEntries,
  travelEntries,
}) => {
  const [expandedYear, setExpandedYear] = useState<string | null>(
    schoolYearsData[0]?.schoolYear || null
  );

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Tijdregistraties sheet
    const workData = workEntries.map(e => {
      const category = e.category || 'ict';
      const catLabel = category === 'ict' ? 'ICT-coördinatie' : 'Lesopdracht';
      const [h1, m1] = e.startTime.split(':').map(Number);
      const [h2, m2] = e.endTime.split(':').map(Number);
      const min = Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1) - (e.breakTime || 0));
      return {
        'Datum': e.date,
        'Categorie': catLabel,
        'Omschrijving': e.description || '',
        'Starttijd': e.startTime,
        'Eindtijd': e.endTime,
        'Pauze (min)': e.breakTime || 0,
        'Totaal Minuten': min,
        'Totaal Uren:Min': formatMinutes(min)
      };
    });
    const wsWork = XLSX.utils.json_to_sheet(workData);
    XLSX.utils.book_append_sheet(wb, wsWork, 'Tijdregistraties');

    // 2. Verplaatsingen sheet
    const travelData = travelEntries.map(t => ({
      'Datum': t.date,
      'Traject / Omschrijving': t.description,
      'Vervoertype': t.type === 'auto' ? 'Auto (€0.4285/km)' : 'Fiets (€0.21/km)',
      'Afstand (km)': t.distance,
      'Vergoeding (€)': Number((t.distance * (t.type === 'auto' ? 0.4285 : 0.21)).toFixed(2))
    }));
    const wsTravel = XLSX.utils.json_to_sheet(travelData);
    XLSX.utils.book_append_sheet(wb, wsTravel, 'Verplaatsingen');

    // 3. Maandtotalen sheet
    const monthData = monthlyData.map(m => ({
      'Maand': m.monthLabel,
      'ICT Uren': formatMinutes(m.ictMin),
      'Lesopdracht Uren': formatMinutes(m.teachingMin),
      'Totaal Werkuren': formatMinutes(m.totalWorkMin),
      'Verplaatsingen (km)': Number(m.travelKm.toFixed(1)),
      'Vergoeding (€)': Number(m.travelComp.toFixed(2))
    }));
    const wsMonth = XLSX.utils.json_to_sheet(monthData);
    XLSX.utils.book_append_sheet(wb, wsMonth, 'Maandoverzicht');

    XLSX.writeFile(wb, `WerkTijd_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-8">
      {/* 1. Recente 3 Weken Overzicht */}
      <div className="card-panel p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
          <div>
            <h2 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-primary" />
              <span>Laatste 3 Weken: Administratieve Overuren (15/21)</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Overuren berekend op basis van de 15/21 ICT-opdracht (norm 25u 43m). Lesopdracht (6/21) geregistreerd voor eigen administratie.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {lastThreeWeeks.map((week, idx) => {
            const isPositive = week.balanceMin >= 0;
            return (
              <div
                key={week.mondayStr}
                className={`p-4 rounded-xl border transition-all ${
                  idx === 0
                    ? 'border-brand-primary/40 bg-brand-primary/5 dark:bg-brand-primary/10'
                    : 'border-[var(--panel-border)] bg-[var(--panel-bg)]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[var(--text-main)]">
                    {week.weekLabel}
                  </span>
                  {idx === 0 && (
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-brand-primary text-white">
                      Deze Week
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs pt-1 border-t border-[var(--panel-border)]">
                  {/* ICT worked */}
                  <div className="flex justify-between items-center text-sky-800 dark:text-sky-300 font-semibold">
                    <span>ICT Gewerkt (15/21):</span>
                    <span className="font-mono font-bold text-sky-700 dark:text-sky-300">{formatMonoTime(week.workedIctMin)}</span>
                  </div>

                  {/* Target */}
                  <div className="flex justify-between items-center text-[var(--text-muted)]">
                    <span>ICT Streefdoel:</span>
                    <span className="font-mono">{formatMonoTime(week.targetMin)}</span>
                  </div>

                  {/* Saldo */}
                  <div className="flex justify-between items-center pt-1 border-t border-[var(--panel-border)]/60">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Overuren Saldo:</span>
                    {idx === 0 && week.workedIctMin < week.targetMin ? (
                      <span className="font-mono font-bold text-slate-500 dark:text-slate-400">
                        +00:00 <span className="text-[10px] font-normal">(in opbouw)</span>
                      </span>
                    ) : (
                      <span className={`font-mono font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {isPositive ? `+${formatMonoTime(week.balanceMin)}` : formatMonoTime(week.balanceMin)}
                      </span>
                    )}
                  </div>

                  {/* Categories breakdown */}
                  <div className="pt-2 border-t border-[var(--panel-border)]/50 flex justify-between items-center text-[11px]">
                    <span className="text-purple-700 dark:text-purple-300 font-medium">
                      Les (eigen admin): <strong>{formatMonoTime(week.workedTeachingMin)}</strong>
                    </span>
                    <span className="text-[var(--text-muted)] font-mono">
                      Totaal: {formatMonoTime(week.workedTotalMin)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Schooljaren Snapshots & Overurensaldo */}
      <div className="card-panel p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
          <div>
            <h2 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-primary" />
              <span>Schooljaren Overzicht & Overuren Snapshots</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Overurensaldo berekend op basis van de 15/21 ICT-opdracht (norm 25u 43m/wk). Lesopdracht (6/21) blijft bijgehouden voor eigen administratie.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {schoolYearsData.map((sy) => {
            const isExpanded = expandedYear === sy.schoolYear;
            const isOvertimePos = sy.overtimeBalance >= 0;
            const baseHoursStr = formatMinutes(sy.baseWeeklyTargetMin);

            return (
              <div
                key={sy.schoolYear}
                className="border border-[var(--panel-border)] rounded-xl overflow-hidden bg-[var(--panel-bg)]"
              >
                {/* Year Header Accordion Bar */}
                <button
                  type="button"
                  onClick={() => setExpandedYear(isExpanded ? null : sy.schoolYear)}
                  className="w-full p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-[var(--text-main)]">
                          Schooljaar {sy.schoolYear}
                        </span>
                        {sy.isCurrent ? (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            Lopend
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            Afgesloten (30 juni)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        ICT weeknorm: <strong className="text-[var(--text-main)]">{baseHoursStr} (15/21)</strong> • Totaal gewerkt: <strong className="text-brand-primary">{formatMinutes(sy.totalWorkedAll)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Summary Badges on Header */}
                  <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
                    {/* Overuren Saldo */}
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
                        Overuren Saldo (15/21)
                      </div>
                      <div className={`font-mono font-bold text-sm ${isOvertimePos ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {isOvertimePos ? `+${formatMonoTime(sy.overtimeBalance)}` : formatMonoTime(sy.overtimeBalance)}
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="text-left sm:text-right text-xs">
                      <div className="text-sky-700 dark:text-sky-300 font-semibold">
                        ICT: {formatMinutes(sy.totalWorkedIct)}
                      </div>
                      <div className="text-purple-700 dark:text-purple-300 font-semibold">
                        Les (eigen): {formatMinutes(sy.totalWorkedTeaching)}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded Details Table */}
                {isExpanded && (
                  <div className="p-4 border-t border-[var(--panel-border)] bg-slate-50/50 dark:bg-slate-900/30 space-y-4">
                    {/* Quick Stats Grid for Year */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-[var(--panel-bg)] border border-[var(--panel-border)]">
                        <div className="label-tiny">ICT Gewerkt (15/21)</div>
                        <div className="font-mono font-bold text-sm text-sky-700 dark:text-sky-300">
                          {formatMinutes(sy.totalWorkedIct)}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--panel-bg)] border border-[var(--panel-border)]">
                        <div className="label-tiny">ICT Streefdoel</div>
                        <div className="font-mono font-bold text-sm text-[var(--text-main)]">
                          {formatMinutes(sy.totalTargetMin)}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--panel-bg)] border border-[var(--panel-border)]">
                        <div className="label-tiny">Lesopdracht (6/21)</div>
                        <div className="font-mono font-bold text-sm text-purple-700 dark:text-purple-300">
                          {formatMinutes(sy.totalWorkedTeaching)}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">Eigen admin</div>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--panel-bg)] border border-[var(--panel-border)]">
                        <div className="label-tiny">Totaal Alle Werk</div>
                        <div className="font-mono font-bold text-sm text-brand-primary">
                          {formatMinutes(sy.totalWorkedAll)}
                        </div>
                      </div>
                    </div>

                    {/* Week-to-Week Table */}
                    <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[var(--text-muted)] font-semibold border-b border-[var(--panel-border)]">
                          <tr>
                            <th className="p-3">Week</th>
                            <th className="p-3 text-sky-700 dark:text-sky-300">ICT Gewerkt (15/21)</th>
                            <th className="p-3">ICT Doel</th>
                            <th className="p-3">Overuren Saldo</th>
                            <th className="p-3 text-purple-700 dark:text-purple-300">Lesopdracht (6/21 - eigen admin)</th>
                            <th className="p-3">Totaal Gewerkt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--panel-border)]">
                          {sy.weeks.map(w => {
                            const isWeekPos = w.balanceMin >= 0;
                            return (
                              <tr key={w.weekKey} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="p-3 font-medium text-[var(--text-main)]">
                                  {formatWeekLabel(w.weekKey)}
                                  {w.freeDaysCount > 0 && (
                                    <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                                      ({w.freeDaysCount} vrije dag)
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 font-mono font-bold text-sky-700 dark:text-sky-300">
                                  {formatMonoTime(w.workedIct)}
                                </td>
                                <td className="p-3 font-mono text-[var(--text-muted)]">
                                  {formatMonoTime(w.targetMin)}
                                </td>
                                <td className={`p-3 font-mono font-bold ${isWeekPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                  {isWeekPos ? `+${formatMonoTime(w.balanceMin)}` : formatMonoTime(w.balanceMin)}
                                </td>
                                <td className="p-3 font-mono text-purple-700 dark:text-purple-300">
                                  {formatMonoTime(w.workedTeaching)}
                                </td>
                                <td className="p-3 font-mono font-semibold text-brand-primary">
                                  {formatMonoTime(w.workedTotal)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Maandoverzicht & Excel Export */}
      <div className="card-panel p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-primary" />
              <span>Maandoverzicht & Export</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Geconsolideerd overzicht van werkuren en verplaatsingen per maand
            </p>
          </div>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Exporteer naar Excel (.xlsx)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {monthlyData.map(m => (
            <div
              key={m.monthKey}
              className="p-4 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] space-y-3"
            >
              <div className="flex justify-between items-center pb-2 border-b border-[var(--panel-border)]">
                <span className="font-bold text-sm text-[var(--text-main)]">{m.monthLabel}</span>
                <span className="text-[11px] text-[var(--text-muted)]">{m.entriesCount} sessies</span>
              </div>

              <div className="space-y-1.5 text-xs">
                {/* ICT Hours */}
                <div className="flex justify-between items-center text-sky-800 dark:text-sky-300">
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" />
                    ICT-coördinatie:
                  </span>
                  <span className="font-mono font-bold">{formatMinutes(m.ictMin)}</span>
                </div>

                {/* Teaching Hours */}
                <div className="flex justify-between items-center text-purple-700 dark:text-purple-300">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5" />
                    Lesopdracht:
                  </span>
                  <span className="font-mono font-bold">{formatMinutes(m.teachingMin)}</span>
                </div>

                {/* Total Work */}
                <div className="flex justify-between items-center pt-1 border-t border-[var(--panel-border)] font-semibold text-[var(--text-main)]">
                  <span>Totaal Werk:</span>
                  <span className="font-mono">{formatMinutes(m.totalWorkMin)}</span>
                </div>

                {/* Travel */}
                <div className="flex justify-between items-center pt-1 text-emerald-700 dark:text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5" />
                    Verplaatsing:
                  </span>
                  <span className="font-mono font-bold">
                    {m.travelKm.toFixed(1)} km • € {m.travelComp.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
