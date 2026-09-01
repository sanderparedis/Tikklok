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
  FileText 
} from 'lucide-react';
import { WorkEntry, FreeDay, VacationPeriod, WorkCategory } from '../types';
import { calculateDuration, formatMinutes, CATEGORY_CONFIG } from '../utils/calculations';

interface WorkEntryListProps {
  workEntries: WorkEntry[];
  freeDays: FreeDay[];
  vacationPeriods: VacationPeriod[];
  onDeleteWorkEntry: (id: string) => void;
  onUpdateWorkEntry: (id: string, update: { startTime: string; endTime: string; category: WorkCategory; description?: string }) => void;
  onDeleteFreeDay: (id: string) => void;
  onDeleteVacationPeriod: (id: string) => void;
}

export const WorkEntryList: React.FC<WorkEntryListProps> = ({
  workEntries,
  freeDays,
  vacationPeriods,
  onDeleteWorkEntry,
  onUpdateWorkEntry,
  onDeleteFreeDay,
  onDeleteVacationPeriod
}) => {
  const [filter, setFilter] = useState<'all' | 'ict' | 'teaching'>('all');
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
    return true;
  });

  const totalFilteredMinutes = filteredEntries.reduce((acc, entry) => {
    return acc + calculateDuration(entry.startTime, entry.endTime, entry.breakTime || 0);
  }, 0);

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
                ({filteredEntries.length} registraties • Totaal: {formatMinutes(totalFilteredMinutes)})
              </span>
            </h2>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-[var(--panel-border)] text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-[var(--text-main)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Alles
            </button>
            <button
              onClick={() => setFilter('ict')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
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
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                filter === 'teaching'
                  ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-purple-600'
              }`}
            >
              <GraduationCap className="w-3 h-3" />
              <span>Lesopdracht</span>
            </button>
          </div>
        </div>

        {/* List of Entries */}
        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">
            Geen tijdsregistraties gevonden voor het geselecteerde filter.
          </div>
        ) : (
          <div className="divide-y divide-[var(--panel-border)]">
            {filteredEntries.map(entry => {
              const category = entry.category || 'ict';
              const catConfig = CATEGORY_CONFIG[category];
              const isEditing = editingId === entry.id;
              const durationMin = calculateDuration(entry.startTime, entry.endTime, entry.breakTime || 0);

              const formattedDate = new Date(entry.date + 'T00:00:00').toLocaleDateString('nl', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });

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
                          <option value="ict">ICT-coördinatie (25:45)</option>
                          <option value="teaching">Lesopdracht</option>
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
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    {/* Category Icon Badge */}
                    <div className={`p-2 rounded-xl border ${catConfig.badgeBg} ${catConfig.badgeBorder} ${catConfig.badgeText} shrink-0`}>
                      {category === 'ict' ? <Briefcase className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-[var(--text-main)] capitalize">
                          {formattedDate}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${catConfig.badgeBg} ${catConfig.badgeText} ${catConfig.badgeBorder}`}>
                          {catConfig.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                        <span className="font-mono">{entry.startTime} - {entry.endTime}</span>
                        {entry.breakTime > 0 && <span>(pauze: {entry.breakTime}m)</span>}
                        {entry.description && (
                          <span className="text-slate-600 dark:text-slate-400 italic flex items-center gap-1">
                            • <FileText className="w-3 h-3 inline" /> {entry.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="text-right">
                      <div className={`font-mono font-bold text-sm ${category === 'teaching' ? 'text-purple-700 dark:text-purple-300' : 'text-sky-700 dark:text-sky-300'}`}>
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
                        onClick={() => onDeleteWorkEntry(entry.id)}
                        title="Verwijderen"
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Free Days & Vacation Summary Badges */}
      {(freeDays.length > 0 || vacationPeriods.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Free days registered */}
          {freeDays.length > 0 && (
            <div className="card-panel p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-2">
                <CalendarOff className="w-3.5 h-3.5 text-amber-500" />
                <span>Geregistreerde Vrije Dagen</span>
              </h3>
              <div className="space-y-2">
                {freeDays.map(fd => (
                  <div key={fd.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 text-xs">
                    <span className="font-semibold text-amber-900 dark:text-amber-200">
                      {new Date(fd.date + 'T00:00:00').toLocaleDateString('nl', { weekday: 'short', day: 'numeric', month: 'short' })}: {fd.type}
                    </span>
                    <button
                      onClick={() => onDeleteFreeDay(fd.id)}
                      className="text-amber-700 hover:text-red-600 p-1"
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-2">
                <Palmtree className="w-3.5 h-3.5 text-emerald-500" />
                <span>Geregistreerde Vakanties</span>
              </h3>
              <div className="space-y-2">
                {vacationPeriods.map(vp => (
                  <div key={vp.id} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40 text-xs">
                    <div>
                      <div className="font-semibold text-emerald-900 dark:text-emerald-200">{vp.description}</div>
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                        {vp.startDate} t/m {vp.endDate}
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteVacationPeriod(vp.id)}
                      className="text-emerald-700 hover:text-red-600 p-1"
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
