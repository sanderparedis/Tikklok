import React, { useState } from 'react';
import { 
  Briefcase, 
  GraduationCap, 
  Trash2, 
  Pencil, 
  Check, 
  X, 
  Clock, 
  CalendarOff, 
  Palmtree, 
  Filter, 
  FileText,
  HeartPulse,
  Sparkles,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { WorkEntry, FreeDay, VacationPeriod, WorkCategory, UserScheduleConfig } from '../types';
import { calculateDuration, formatMinutes, CATEGORY_CONFIG, computeScheduleDetails, toLocalYYYYMMDD, getMondayStr, formatWeekLabel, formatDateBE, isWeekendDate } from '../utils/calculations';

interface WorkEntryListProps {
  workEntries: WorkEntry[];
  freeDays: FreeDay[];
  vacationPeriods: VacationPeriod[];
  onDeleteWorkEntry: (id: string) => void;
  onUpdateWorkEntry: (id: string, update: { startTime: string; endTime: string; category: WorkCategory; description?: string }) => void;
  onDeleteFreeDay: (id: string) => void;
  onDeleteVacationPeriod: (id: string) => void;
  scheduleConfig?: UserScheduleConfig;
}

const formatDayLabel = formatDateBE;

const entryMinutes = (e: WorkEntry) => calculateDuration(e.startTime, e.endTime, e.breakTime || 0);

interface DayGroup {
  date: string;
  work: WorkEntry[];
  free: FreeDay[];
}

interface WeekGroup {
  weekKey: string;
  days: DayGroup[];
  vacations: VacationPeriod[];
  totalMin: number;
  weekendMin: number;
}

/** Aantal werkdagen (ma-vr) in een periode, inclusief begin- en einddatum. */
const countWeekdays = (start: string, end: string) => {
  let n = 0;
  const cur = new Date(start + 'T00:00:00');
  let guard = 0;
  while (toLocalYYYYMMDD(cur) <= end && guard < 400) {
    const d = cur.getDay();
    if (d >= 1 && d <= 5) n++;
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return n;
};

export const WorkEntryList: React.FC<WorkEntryListProps> = ({
  workEntries,
  freeDays,
  vacationPeriods,
  onDeleteWorkEntry,
  onUpdateWorkEntry,
  onDeleteFreeDay,
  onDeleteVacationPeriod,
  scheduleConfig
}) => {
  const [filter, setFilter] = useState<'all' | 'ict' | 'teaching' | 'wai' | 'absence'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    startTime: string;
    endTime: string;
    category: WorkCategory;
    description: string;
  } | null>(null);

  const filteredEntries = workEntries.filter(entry => {
    const cat = entry.category || 'ict';
    if (filter === 'ict') return cat === 'ict';
    if (filter === 'teaching') return cat === 'teaching';
    if (filter === 'wai') return cat === 'wai';
    if (filter === 'absence') return false;
    return true;
  });

  // "Totaal" = alle getoonde registraties (ICT + lesopdracht + W-AI)
  const totalFilteredMinutes = filteredEntries.reduce((acc, entry) => {
    return acc + calculateDuration(entry.startTime, entry.endTime, entry.breakTime || 0);
  }, 0);

  // Ziektedagen, vrije dagen en vakanties chronologisch tussen de werkregistraties tonen
  // (bij filter "Alles" en "Afwezig"; niet bij ICT/Lesopdracht).
  const showAbsences = filter === 'all' || filter === 'absence';
  const schedule = computeScheduleDetails(scheduleConfig);
  const absenceCount = showAbsences ? freeDays.length + vacationPeriods.length : 0;

  // Groeperen per week (ma-zo) en per dag. Weken en dagen: nieuwste eerst.
  // Binnen een dag: oplopend op starttijd.
  const weekGroups: WeekGroup[] = (() => {
    const weeks = new Map<string, { days: Map<string, DayGroup>; vacations: VacationPeriod[] }>();
    const getWeek = (dateStr: string) => {
      const key = getMondayStr(dateStr);
      if (!weeks.has(key)) weeks.set(key, { days: new Map(), vacations: [] });
      return weeks.get(key)!;
    };
    const getDay = (dateStr: string) => {
      const w = getWeek(dateStr);
      if (!w.days.has(dateStr)) w.days.set(dateStr, { date: dateStr, work: [], free: [] });
      return w.days.get(dateStr)!;
    };
    filteredEntries.forEach(e => getDay(e.date).work.push(e));
    if (showAbsences) {
      freeDays.forEach(fd => getDay(fd.date).free.push(fd));
      vacationPeriods.forEach(vp => getWeek(vp.startDate).vacations.push(vp));
    }
    return [...weeks.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([weekKey, w]) => {
        const days = [...w.days.values()].sort((a, b) => b.date.localeCompare(a.date));
        days.forEach(d => d.work.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime)));
        const totalMin = days.reduce((sum, d) => sum + d.work.reduce((s2, e) => s2 + entryMinutes(e), 0), 0);
        const weekendMin = days
          .filter(d => isWeekendDate(d.date))
          .reduce((sum, d) => sum + d.work.reduce((s2, e) => s2 + entryMinutes(e), 0), 0);
        return { weekKey, days, vacations: w.vacations, totalMin, weekendMin };
      });
  })();

  // Deze week standaard open, oudere weken dicht
  const currentWeekKey = getMondayStr(toLocalYYYYMMDD(new Date()));
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(() => new Set([currentWeekKey]));
  const toggleWeek = (key: string) => {
    setOpenWeeks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const renderAbsence = (item: { kind: 'free'; freeDay: FreeDay } | { kind: 'vacation'; vacation: VacationPeriod }) => {
    if (item.kind === 'free') {
      const fd = item.freeDay;
      const isSick = fd.type === 'ziek';
      const dow = new Date(fd.date + 'T00:00:00').getDay();
      const ictMin = schedule.daySchedules[dow]?.ictMin ?? 0;
      const label = isSick ? 'Ziektedag' : fd.type === 'feestdag' ? 'Feestdag' : 'Vrije / facultatieve dag';
      return (
        <div
          key={`free-${fd.id}`}
          className={`p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${isSick ? 'bg-rose-50/40 dark:bg-rose-950/15' : 'bg-amber-50/40 dark:bg-amber-950/15'}`}
        >
          <div className="flex items-start sm:items-center gap-3">
            <div className={`p-2 rounded-xl border shrink-0 ${isSick ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-300' : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-600 dark:text-amber-300'}`}>
              {isSick ? <HeartPulse className="w-4 h-4" /> : <CalendarOff className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-[var(--text-main)] capitalize">{formatDayLabel(fd.date)}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${isSick ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50'}`}>
                  {label}
                </span>
              </div>
              {fd.description && (
                <div className="text-xs text-[var(--text-muted)] italic mt-0.5 flex items-center gap-1">
                  <FileText className="w-3 h-3 inline" /> {fd.description}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="text-right font-mono text-xs text-[var(--text-muted)]" title="Vermindering van je ICT-weekdoel">
              {dow >= 1 && dow <= 5 ? `-${formatMinutes(ictMin)} doel` : 'weekend'}
            </div>
            <button
              onClick={() => { if (window.confirm(`${label} van ${formatDayLabel(fd.date)} verwijderen?`)) onDeleteFreeDay(fd.id); }}
              title="Verwijderen"
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }

    const vp = item.vacation;
    const weekdays = countWeekdays(vp.startDate, vp.endDate);
    return (
      <div
        key={`vac-${vp.id}`}
        className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-emerald-50/40 dark:bg-emerald-950/15"
      >
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 rounded-xl border shrink-0 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-300">
            <Palmtree className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-[var(--text-main)]">{vp.description || 'Vakantie'}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50">
                Vakantie
              </span>
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              {formatDayLabel(vp.startDate)} t/m {formatDayLabel(vp.endDate)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="text-right font-mono text-xs text-[var(--text-muted)]">
            {weekdays} {weekdays === 1 ? 'werkdag' : 'werkdagen'}
          </div>
          <button
            onClick={() => { if (window.confirm(`Vakantie "${vp.description}" verwijderen?`)) onDeleteVacationPeriod(vp.id); }}
            title="Verwijderen"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const startEdit = (entry: WorkEntry) => {
    setEditingId(entry.id);
    setEditValues({
      startTime: entry.startTime,
      endTime: entry.endTime,
      category: entry.category || 'ict',
      description: entry.description || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues(null);
  };

  const saveEdit = (id: string) => {
    if (!editValues) return;
    onUpdateWorkEntry(id, {
      startTime: editValues.startTime,
      endTime: editValues.endTime,
      category: editValues.category,
      description: editValues.description.trim() || undefined
    });
    setEditingId(null);
    setEditValues(null);
  };

  const renderWorkEntry = (entry: WorkEntry) => {
          const category = entry.category || 'ict';
          const catConfig = CATEGORY_CONFIG[category];
          const isEditing = editingId === entry.id;
          const durationMin = calculateDuration(entry.startTime, entry.endTime, entry.breakTime || 0);

          const formattedDate = formatDayLabel(entry.date);

          if (isEditing && editValues) {
            return (
              <div key={entry.id} className="p-4 bg-sky-50/40 dark:bg-sky-950/20 space-y-3">
                <div className="text-xs font-bold text-[var(--text-main)]">
                  Registratie bewerken ({formattedDate})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="label-tiny">Categorie</label>
                    <select
                      value={editValues.category}
                      onChange={(e) => setEditValues({ ...editValues, category: e.target.value as WorkCategory })}
                      className="input-field text-xs py-2"
                    >
                      <option value="ict">ICT-coördinatie (15/21 • overuren)</option>
                      <option value="teaching">Lesopdracht (6/21 • eigen admin)</option>
                      <option value="wai">W-AI (in totaal, niet ICT)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-tiny">Starttijd</label>
                    <input
                      type="time"
                      value={editValues.startTime}
                      onChange={(e) => setEditValues({ ...editValues, startTime: e.target.value })}
                      className="input-field text-xs py-2"
                    />
                  </div>
                  <div>
                    <label className="label-tiny">Eindtijd</label>
                    <input
                      type="time"
                      value={editValues.endTime}
                      onChange={(e) => setEditValues({ ...editValues, endTime: e.target.value })}
                      className="input-field text-xs py-2"
                    />
                  </div>
                  <div>
                    <label className="label-tiny">Omschrijving</label>
                    <input
                      type="text"
                      value={editValues.description}
                      onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                      placeholder="Optionele notitie"
                      className="input-field text-xs py-2"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--panel-border)] text-[var(--text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={() => saveEdit(entry.id)}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-brand-primary text-white hover:brightness-110 flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Opslaan</span>
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={entry.id}
              className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Category Icon Badge */}
                <div className={`p-2 rounded-xl border ${catConfig.badgeBg} ${catConfig.badgeBorder} ${catConfig.badgeText} shrink-0`}>
                  {category === 'ict' ? <Briefcase className="w-4 h-4" /> : category === 'wai' ? <Sparkles className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-sm text-[var(--text-main)]">
                      {entry.startTime} - {entry.endTime}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${catConfig.badgeBg} ${catConfig.badgeText} ${catConfig.badgeBorder}`}>
                      {catConfig.shortLabel}
                    </span>
                    {entry.breakTime > 0 && <span className="text-xs text-[var(--text-muted)]">(pauze: {entry.breakTime}m)</span>}
                  </div>
                  {entry.description && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 italic flex items-center gap-1 mt-0.5 truncate">
                      <FileText className="w-3 h-3 inline shrink-0" /> <span className="truncate">{entry.description}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="text-right">
                  <div className={`font-mono font-bold text-sm ${category === 'teaching' ? 'text-purple-700 dark:text-purple-300' : category === 'wai' ? 'text-orange-700 dark:text-orange-300' : 'text-sky-700 dark:text-sky-300'}`}>
                    {formatMinutes(durationMin)}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(entry)}
                    title="Bewerken"
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-brand-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { if (window.confirm(`Registratie van ${formattedDate} (${entry.startTime}-${entry.endTime}) verwijderen?`)) onDeleteWorkEntry(entry.id); }}
                    title="Verwijderen"
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
  };

  return (
    <div className="space-y-6">
      {/* Work Entries Section */}
      <div className="card-panel overflow-hidden">
        {/* Header & Filter Toolbar */}
        <div className="p-4 sm:p-5 border-b border-[var(--panel-border)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
              <span>Geregistreerde Uren</span>
              <span className="text-xs font-normal text-[var(--text-muted)]">
                {filter === 'absence'
                  ? `(${absenceCount} afwezigheden)`
                  : `(${filteredEntries.length} registraties • ${filter === 'wai' ? 'W-AI' : 'Totaal'}: ${formatMinutes(totalFilteredMinutes)}${absenceCount > 0 ? ` • ${absenceCount} afwezigheden` : ''})`}
              </span>
            </h2>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-[var(--panel-border)] text-xs max-w-full overflow-x-auto">
            <button
              onClick={() => setFilter('all')}
              className={`shrink-0 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-[var(--text-main)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Alles
            </button>
            <button
              onClick={() => setFilter('ict')}
              className={`shrink-0 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                filter === 'ict'
                  ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-sky-600'
              }`}
            >
              <Briefcase className="w-3 h-3" />
              <span>ICT</span>
            </button>
            <button
              onClick={() => setFilter('teaching')}
              className={`shrink-0 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                filter === 'teaching'
                  ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-purple-600'
              }`}
            >
              <GraduationCap className="w-3 h-3" />
              <span>Lesopdracht</span>
            </button>
            <button
              onClick={() => setFilter('wai')}
              className={`shrink-0 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                filter === 'wai'
                  ? 'bg-white dark:bg-slate-700 text-orange-700 dark:text-orange-300 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-orange-600'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>W-AI</span>
            </button>
            <button
              onClick={() => setFilter('absence')}
              className={`shrink-0 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                filter === 'absence'
                  ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-300 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-rose-600'
              }`}
            >
              <CalendarOff className="w-3 h-3" />
              <span>Afwezig</span>
            </button>
          </div>
        </div>

        {/* Lijst per week (inklapbaar) en per dag, met dagtotalen */}
        {weekGroups.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">
            {filter === 'absence' ? 'Geen ziektedagen, vrije dagen of vakanties geregistreerd.' : 'Geen tijdsregistraties gevonden voor het geselecteerde filter.'}
          </div>
        ) : (
          <div className="divide-y divide-[var(--panel-border)]">
            {weekGroups.map(week => {
              const isOpen = openWeeks.has(week.weekKey);
              const isCurrent = week.weekKey === currentWeekKey;
              return (
                <section key={week.weekKey} aria-label={`Week ${formatWeekLabel(week.weekKey)}`}>
                  <button
                    type="button"
                    onClick={() => toggleWeek(week.weekKey)}
                    aria-expanded={isOpen}
                    className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors ${
                      isCurrent ? 'bg-brand-primary/5 dark:bg-brand-primary/10' : 'bg-slate-50/70 dark:bg-slate-900/40'
                    } hover:bg-slate-100/80 dark:hover:bg-slate-800/50`}
                  >
                    <span className="flex items-center gap-2 min-w-0 flex-wrap">
                      {isOpen ? <ChevronDown className="w-4 h-4 text-brand-primary shrink-0" /> : <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
                      <span className="font-bold text-sm text-[var(--text-main)]">{formatWeekLabel(week.weekKey)}</span>
                      {isCurrent && (
                        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-brand-primary text-white">Deze week</span>
                      )}
                      {week.weekendMin > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                          weekend {formatMinutes(week.weekendMin)}
                        </span>
                      )}
                    </span>
                    <span className="font-mono font-bold text-sm text-[var(--text-main)] shrink-0">{formatMinutes(week.totalMin)}</span>
                  </button>

                  {isOpen && (
                    <div className="divide-y divide-[var(--panel-border)]">
                      {week.vacations.map(vp => renderAbsence({ kind: 'vacation', vacation: vp }))}
                      {week.days.map(day => {
                        const dayMin = day.work.reduce((sum, e) => sum + entryMinutes(e), 0);
                        return (
                          <div key={day.date}>
                            <div className="px-4 py-2 flex items-center justify-between text-xs bg-[var(--app-bg)]/60 border-t border-[var(--panel-border)]">
                              <span className="font-semibold text-[var(--text-main)] capitalize">
                                {formatDayLabel(day.date)}
                                {isWeekendDate(day.date) && <span className="ml-1.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">weekend</span>}
                              </span>
                              {day.work.length > 0 && (
                                <span className="font-mono font-bold text-[var(--text-main)]">dag: {formatMinutes(dayMin)}</span>
                              )}
                            </div>
                            {day.free.map(fd => renderAbsence({ kind: 'free', freeDay: fd }))}
                            {day.work.map(entry => renderWorkEntry(entry))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Free Days, Sick Days & Vacation Summary Badges */}
      {(freeDays.length > 0 || vacationPeriods.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sick Days registered */}
          {freeDays.filter(fd => fd.type === 'ziek').length > 0 && (
            <div className="card-panel p-4 border-rose-200/60 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                  <span>Ziektedagen</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                  {freeDays.filter(fd => fd.type === 'ziek').length}
                </span>
              </h3>
              <div className="space-y-2">
                {freeDays.filter(fd => fd.type === 'ziek').map(fd => (
                  <div key={fd.id} className="flex items-center justify-between p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs">
                    <div>
                      <span className="font-semibold text-rose-900 dark:text-rose-200 block">
                        {new Date(fd.date + 'T00:00:00').toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      {fd.description && (
                        <span className="text-[10px] text-rose-700 dark:text-rose-400">
                          {fd.description}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onDeleteFreeDay(fd.id)}
                      title="Verwijder ziektedag"
                      className="text-rose-700 hover:text-red-600 p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Free days registered */}
          {freeDays.filter(fd => fd.type !== 'ziek').length > 0 && (
            <div className="card-panel p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CalendarOff className="w-3.5 h-3.5 text-amber-500" />
                  <span>Vrije Dagen & Feestdagen</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                  {freeDays.filter(fd => fd.type !== 'ziek').length}
                </span>
              </h3>
              <div className="space-y-2">
                {freeDays.filter(fd => fd.type !== 'ziek').map(fd => (
                  <div key={fd.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 text-xs">
                    <div>
                      <span className="font-semibold text-amber-900 dark:text-amber-200 block">
                        {new Date(fd.date + 'T00:00:00').toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })}: {fd.type}
                      </span>
                      {fd.description && (
                        <span className="text-[10px] text-amber-700 dark:text-amber-400">
                          {fd.description}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onDeleteFreeDay(fd.id)}
                      title="Verwijder vrije dag"
                      className="text-amber-700 hover:text-red-600 p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vacation periods registered */}
          {vacationPeriods.length > 0 && (
            <div className="card-panel p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Palmtree className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Vakanties</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  {vacationPeriods.length}
                </span>
              </h3>
              <div className="space-y-2">
                {vacationPeriods.map(vp => (
                  <div key={vp.id} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40 text-xs">
                    <div>
                      <div className="font-semibold text-emerald-900 dark:text-emerald-200">{vp.description}</div>
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                        {formatDateBE(vp.startDate)} t/m {formatDateBE(vp.endDate)}
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteVacationPeriod(vp.id)}
                      title="Verwijder vakantie"
                      className="text-emerald-700 hover:text-red-600 p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
