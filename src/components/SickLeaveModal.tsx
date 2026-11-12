import React, { useState, useMemo } from 'react';
import { HeartPulse, Calendar, X, Check, AlertCircle, Info, Stethoscope, Clock } from 'lucide-react';
import { UserScheduleConfig } from '../types';
import { computeScheduleDetails, formatMinutes, toLocalYYYYMMDD } from '../utils/calculations';

interface SickLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSickDays: (data: {
    startDate: string;
    endDate?: string;
    isPeriod: boolean;
    description?: string;
  }) => Promise<void>;
  defaultDate: string;
  scheduleConfig?: UserScheduleConfig;
}

export const SickLeaveModal: React.FC<SickLeaveModalProps> = ({
  isOpen,
  onClose,
  onSaveSickDays,
  defaultDate,
  scheduleConfig
}) => {
  const [isPeriod, setIsPeriod] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>(defaultDate);
  const [endDate, setEndDate] = useState<string>(defaultDate);
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const schedule = useMemo(() => computeScheduleDetails(scheduleConfig), [scheduleConfig]);

  // Calculate affected school days
  const affectedDays = useMemo(() => {
    if (!startDate) return [];
    if (!isPeriod || !endDate || startDate === endDate) {
      const d = new Date(startDate + 'T00:00:00');
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const daySchedule = schedule.daySchedules[dayOfWeek] || { ictMin: 0, teachingMin: 0, totalMin: 0 };
      return [{
        dateStr: startDate,
        dayName: d.toLocaleDateString('nl', { weekday: 'long', day: 'numeric', month: 'short' }),
        dayOfWeek,
        isWeekend,
        ictMin: isWeekend ? 0 : daySchedule.ictMin,
        teachingMin: isWeekend ? 0 : daySchedule.teachingMin
      }];
    }

    const list = [];
    const cur = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    // Safety guard against massive loops if date is inverted or way in the future
    let count = 0;
    while (cur <= end && count < 60) {
      count++;
      const dayOfWeek = cur.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dateStr = toLocalYYYYMMDD(cur);
      const daySchedule = schedule.daySchedules[dayOfWeek] || { ictMin: 0, teachingMin: 0, totalMin: 0 };
      list.push({
        dateStr,
        dayName: cur.toLocaleDateString('nl', { weekday: 'short', day: 'numeric', month: 'short' }),
        dayOfWeek,
        isWeekend,
        ictMin: isWeekend ? 0 : daySchedule.ictMin,
        teachingMin: isWeekend ? 0 : daySchedule.teachingMin
      });
      cur.setDate(cur.getDate() + 1);
    }
    return list;
  }, [startDate, endDate, isPeriod, schedule]);

  const schoolDays = affectedDays.filter(d => !d.isWeekend);
  const totalIctReductionMin = schoolDays.reduce((acc, d) => acc + d.ictMin, 0);
  const totalTeachingReductionMin = schoolDays.reduce((acc, d) => acc + d.teachingMin, 0);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isPeriod && endDate < startDate) {
      setErrorMessage('De einddatum kan niet vóór de begindatum liggen.');
      return;
    }

    if (schoolDays.length === 0) {
      setErrorMessage('De geselecteerde datum of periode bevat geen geldige schooldagen (maandag t/m vrijdag).');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSaveSickDays({
        startDate,
        endDate: isPeriod ? endDate : undefined,
        isPeriod,
        description: description.trim() || undefined
      });
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Er is een fout opgetreden bij het opslaan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[var(--panel-bg)] rounded-2xl border border-[var(--panel-border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--panel-border)] bg-rose-50/60 dark:bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-main)]">Ziektedag(en) Registreren</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Gewettigde afwezigheid • Normvermindering volgens verdeelsleutel ({schedule.fractionLabel})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Toggle Single vs Period */}
          <div>
            <label className="label-tiny">Type Invoer</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-[var(--panel-border)]">
              <button
                type="button"
                onClick={() => setIsPeriod(false)}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  !isPeriod
                    ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-300 shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>1 Ziektedag</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPeriod(true)}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  isPeriod
                    ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-300 shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <HeartPulse className="w-3.5 h-3.5" />
                <span>Ziekteperiode (meerdere dagen)</span>
              </button>
            </div>
          </div>

          {/* Date Pickers */}
          {!isPeriod ? (
            <div>
              <label className="label-tiny">Datum van de Ziektedag</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label-tiny">Van (eerste ziektedag)</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate < e.target.value) setEndDate(e.target.value);
                  }}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-tiny">Tot en met (laatste ziektedag)</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          )}

          {/* Description / Note */}
          <div>
            <label className="label-tiny">Reden / Opmerking (optioneel)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="bijv. Doktersbriefje, Griep, Ziekteattest ingediend"
              maxLength={200}
              className="input-field text-xs"
            />
          </div>

          {/* Impact Preview Card */}
          <div className="p-4 rounded-xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/15 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-rose-900 dark:text-rose-200">
              <span className="flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-rose-500" />
                <span>Geregistreerde schooldagen:</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-mono text-xs">
                {schoolDays.length} {schoolDays.length === 1 ? 'dag' : 'dagen'}
              </span>
            </div>

            {schoolDays.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {schoolDays.map((d) => (
                    <span
                      key={d.dateStr}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/50 text-[11px] font-medium text-[var(--text-main)] shadow-2xs"
                    >
                      <span>{d.dayName}</span>
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 font-mono">
                        (-{formatMinutes(d.ictMin)})
                      </span>
                    </span>
                  ))}
                </div>

                <div className="pt-2 border-t border-rose-200/50 dark:border-rose-900/30 flex justify-between items-center text-xs">
                  <span className="text-[var(--text-muted)]">Totale weeknorm vermindering:</span>
                  <span className="font-mono font-bold text-rose-700 dark:text-rose-300">
                    -{formatMinutes(totalIctReductionMin)} ICT
                    {totalTeachingReductionMin > 0 && ` • -${formatMinutes(totalTeachingReductionMin)} les`}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Let op: in het weekend zijn er geen geplande schooluren. Kies minstens één doordeweekse werkdag (ma-vr).
              </p>
            )}
          </div>

          {/* Explanation note */}
          <div className="flex items-start gap-2 text-[11px] text-[var(--text-muted)] bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-[var(--panel-border)]">
            <Info className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
            <span>
              Een ziektedag telt in het Vlaams onderwijs als gewettigde afwezigheid met behoud van salaris. Tikklok verlaagt voor die dagen automatisch je te presteren weekdoel, zodat je geen overuren hoeft in te halen.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--panel-border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={isSubmitting || schoolDays.length === 0}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Bezig met opslaan...' : `Ziektedagen Opslaan (${schoolDays.length})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
