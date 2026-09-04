import React, { useState } from 'react';
import { 
  X, 
  Check, 
  Sliders, 
  Clock, 
  Calendar, 
  Info, 
  RotateCcw,
  Sparkles,
  School,
  AlertCircle
} from 'lucide-react';
import { UserScheduleConfig } from '../types';
import { 
  DEFAULT_SCHEDULE_CONFIG, 
  computeScheduleDetails, 
  formatMinutes 
} from '../utils/calculations';

interface ScheduleConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: UserScheduleConfig;
  onSave: (newConfig: UserScheduleConfig) => Promise<void> | void;
}

export const ScheduleConfigModal: React.FC<ScheduleConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave
}) => {
  const [adminNum, setAdminNum] = useState<number>(config.adminNumerator ?? 15);
  const [teachingNum, setTeachingNum] = useState<number>(config.teachingNumerator ?? 6);
  const [denominator, setDenominator] = useState<number>(config.denominator ?? 21);
  const [weekHours, setWeekHours] = useState<number>(config.fulltimeWeekHours ?? 36);
  const [lessonsPerDay, setLessonsPerDay] = useState<Record<number, number>>({
    1: config.teachingLessonsPerDay?.[1] ?? 4,
    2: config.teachingLessonsPerDay?.[2] ?? 0,
    3: config.teachingLessonsPerDay?.[3] ?? 2,
    4: config.teachingLessonsPerDay?.[4] ?? 0,
    5: config.teachingLessonsPerDay?.[5] ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Live calculation of preview details
  const previewDetails = computeScheduleDetails({
    adminNumerator: adminNum,
    teachingNumerator: teachingNum,
    denominator: denominator,
    fulltimeWeekHours: weekHours,
    teachingLessonsPerDay: lessonsPerDay
  });

  const totalLessonsScheduled = [1, 2, 3, 4, 5].reduce(
    (sum, d) => sum + (lessonsPerDay[d] || 0), 
    0
  );

  const lessonsMatch = totalLessonsScheduled === teachingNum;

  const handleDayLessonChange = (day: number, val: number) => {
    const clamped = Math.max(0, Math.min(10, val));
    setLessonsPerDay(prev => ({
      ...prev,
      [day]: clamped
    }));
  };

  const applyPreset = (
    adm: number, 
    tch: number, 
    denom: number, 
    monL: number, 
    wedL: number
  ) => {
    setAdminNum(adm);
    setTeachingNum(tch);
    setDenominator(denom);
    setWeekHours(36);
    setLessonsPerDay({
      1: monL,
      2: 0,
      3: wedL,
      4: 0,
      5: 0
    });
  };

  const handleResetDefault = () => {
    setAdminNum(DEFAULT_SCHEDULE_CONFIG.adminNumerator);
    setTeachingNum(DEFAULT_SCHEDULE_CONFIG.teachingNumerator);
    setDenominator(DEFAULT_SCHEDULE_CONFIG.denominator);
    setWeekHours(DEFAULT_SCHEDULE_CONFIG.fulltimeWeekHours);
    setLessonsPerDay({
      1: DEFAULT_SCHEDULE_CONFIG.teachingLessonsPerDay[1] || 4,
      2: DEFAULT_SCHEDULE_CONFIG.teachingLessonsPerDay[2] || 0,
      3: DEFAULT_SCHEDULE_CONFIG.teachingLessonsPerDay[3] || 2,
      4: DEFAULT_SCHEDULE_CONFIG.teachingLessonsPerDay[4] || 0,
      5: DEFAULT_SCHEDULE_CONFIG.teachingLessonsPerDay[5] || 0
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated: UserScheduleConfig = {
        adminNumerator: adminNum,
        teachingNumerator: teachingNum,
        denominator: denominator,
        fulltimeWeekHours: weekHours,
        teachingLessonsPerDay: lessonsPerDay,
        updatedAt: new Date().toISOString()
      };
      await onSave(updated);
      setSuccessMessage('Verdeelsleutel en rooster succesvol opgeslagen!');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 900);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div 
        className="card-panel w-full max-w-2xl bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-2xl shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--panel-border)] bg-slate-50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-main)]">
                Aanstelling & Verdeelsleutel Aanpassen
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Geef je eigen opdracht in. Tikklok berekent automatisch de normuren en past vrije dagen aan.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-slate-200 dark:hover:bg-slate-700/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Quick Presets */}
          <div>
            <label className="label-tiny flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Snelle Voorbeelden / Presets</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset(15, 6, 21, 4, 2)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  adminNum === 15 && teachingNum === 6 && denominator === 21
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white dark:bg-slate-800 text-[var(--text-main)] border-[var(--panel-border)] hover:bg-slate-50'
                }`}
              >
                15/21 ICT + 6/21 Les (Standaard)
              </button>
              <button
                type="button"
                onClick={() => applyPreset(21, 0, 21, 0, 0)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  adminNum === 21 && teachingNum === 0 && denominator === 21
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white dark:bg-slate-800 text-[var(--text-main)] border-[var(--panel-border)] hover:bg-slate-50'
                }`}
              >
                21/21 ICT Voltijds (geen lesopdracht)
              </button>
              <button
                type="button"
                onClick={() => applyPreset(18, 3, 21, 3, 0)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  adminNum === 18 && teachingNum === 3 && denominator === 21
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white dark:bg-slate-800 text-[var(--text-main)] border-[var(--panel-border)] hover:bg-slate-50'
                }`}
              >
                18/21 ICT + 3/21 Les
              </button>
              <button
                type="button"
                onClick={() => applyPreset(10, 0, 20, 0, 0)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  adminNum === 10 && teachingNum === 0 && denominator === 20
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white dark:bg-slate-800 text-[var(--text-main)] border-[var(--panel-border)] hover:bg-slate-50'
                }`}
              >
                10/20 ICT Halftijds (18u)
              </button>
            </div>
          </div>

          {/* Section 1: Verdeelsleutel velden */}
          <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-[var(--panel-border)] space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <School className="w-4 h-4 text-brand-primary" />
              <span>1. Opdrachtbreuken & Basisuren</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label-tiny">ICT-opdracht (teller)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={denominator}
                    step={0.5}
                    value={adminNum}
                    onChange={(e) => setAdminNum(parseFloat(e.target.value) || 0)}
                    className="input-field font-semibold text-sky-700 dark:text-sky-400"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-[var(--text-muted)]">
                    /{denominator}
                  </span>
                </div>
              </div>

              <div>
                <label className="label-tiny">Lesopdracht (teller)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={denominator}
                    step={0.5}
                    value={teachingNum}
                    onChange={(e) => setTeachingNum(parseFloat(e.target.value) || 0)}
                    className="input-field font-semibold text-purple-700 dark:text-purple-400"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-[var(--text-muted)]">
                    /{denominator}
                  </span>
                </div>
              </div>

              <div>
                <label className="label-tiny">Voltijdse noemer</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={denominator}
                    onChange={(e) => setDenominator(parseInt(e.target.value) || 21)}
                    className="input-field font-semibold"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-[var(--text-muted)]">
                    uur/w
                  </span>
                </div>
              </div>
            </div>

            {/* Live Calculation Banner */}
            <div className="bg-white dark:bg-slate-900/80 p-3.5 rounded-xl border border-[var(--panel-border)] flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
                  Automatisch berekende weeknormen
                </div>
                <div className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2 mt-0.5">
                  <span className="text-sky-600 dark:text-sky-400">
                    ICT: {formatMinutes(previewDetails.adminTargetMin)}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-purple-600 dark:text-purple-400">
                    Lesopdracht: {formatMinutes(previewDetails.teachingTargetMin)}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-[var(--text-muted)] font-normal text-xs">
                    Totaal: {formatMinutes(previewDetails.totalTargetMin)} ({adminNum + teachingNum}/{denominator})
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">
                  <Clock className="w-3 h-3" />
                  {formatMinutes(previewDetails.adminTargetMin)} / week
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Vaste lesuren per weekdag */}
          <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-[var(--panel-border)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>2. Vaste Lesuren per Weekdag (voor Vrije Dagen)</span>
              </h3>
              <div className="text-xs">
                {lessonsMatch ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Rooster klopt: {totalLessonsScheduled} van {teachingNum} lesuren
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {totalLessonsScheduled} lesuren ingeroosterd (opdracht is {teachingNum})
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Vul in hoeveel effectieve lesuren je op elke dag geeft. Als er een feestdag of vakantiedag op die dag valt, trekt Tikklok exact het resterende ICT-deel af.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { day: 1, name: 'Maandag', sub: 'voltijds (8u)' },
                { day: 2, name: 'Dinsdag', sub: 'voltijds (8u)' },
                { day: 3, name: 'Woensdag', sub: 'halve dag (4u)' },
                { day: 4, name: 'Donderdag', sub: 'voltijds (8u)' },
                { day: 5, name: 'Vrijdag', sub: 'voltijds (8u)' },
              ].map(({ day, name, sub }) => (
                <div 
                  key={day} 
                  className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-[var(--panel-border)] flex flex-col justify-between"
                >
                  <div className="mb-1.5">
                    <span className="text-xs font-bold text-[var(--text-main)] block">
                      {name}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {sub}
                    </span>
                  </div>
                  <div className="mt-1">
                    <label className="text-[9px] uppercase font-bold text-[var(--text-muted)] block mb-1">
                      Lesuren (50m)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={8}
                      value={lessonsPerDay[day] ?? 0}
                      onChange={(e) => handleDayLessonChange(day, parseInt(e.target.value) || 0)}
                      className="input-field text-center py-1 font-bold text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Dagschema Preview Tabel */}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[var(--panel-border)] text-[var(--text-muted)] text-[10px] uppercase">
                    <th className="py-1 px-2 font-semibold">Dag</th>
                    <th className="py-1 px-2 font-semibold">Lesuren</th>
                    <th className="py-1 px-2 font-semibold">Lesopdracht aandeel</th>
                    <th className="py-1 px-2 font-semibold text-sky-700 dark:text-sky-400">ICT uren (overuren-norm)</th>
                    <th className="py-1 px-2 font-semibold text-[var(--text-muted)]">Bij vrije dag -ICT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--panel-border)]">
                  {[1, 2, 3, 4, 5].map((d) => {
                    const sched = previewDetails.daySchedules[d];
                    return (
                      <tr key={d} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/50">
                        <td className="py-1.5 px-2 font-medium">{sched.dayName}</td>
                        <td className="py-1.5 px-2 font-semibold">
                          {sched.teachingLessons > 0 ? `${sched.teachingLessons} u` : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-purple-600 dark:text-purple-400 font-mono">
                          {sched.teachingMin > 0 ? formatMinutes(sched.teachingMin) : '—'}
                        </td>
                        <td className="py-1.5 px-2 text-sky-700 dark:text-sky-400 font-mono font-bold">
                          {formatMinutes(sched.ictMin)}
                        </td>
                        <td className="py-1.5 px-2 text-[var(--text-muted)]">
                          -{formatMinutes(sched.ictMin)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Feedback message */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--panel-border)]">
            <button
              type="button"
              onClick={handleResetDefault}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Herstel standaarden (15/21)</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--panel-border)] text-[var(--text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center gap-1.5 py-2 px-5 text-xs"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Opslaan...' : 'Verdeelsleutel Toepassen'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
