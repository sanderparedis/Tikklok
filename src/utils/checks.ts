import { WorkEntry, TravelEntry, VacationPeriod } from '../types';
import { calculateDuration, formatDateBE } from './calculations';

export type IssueKind = 'overlap' | 'zero-duration' | 'zero-km' | 'vacation-reversed';

export interface DataIssue {
  key: string;
  kind: IssueKind;
  /** Datum om op te sorteren en te tonen (YYYY-MM-DD). */
  date: string;
  message: string;
}

const entryLabel = (e: WorkEntry) => {
  const cat = e.category === 'teaching' ? 'Les' : e.category === 'wai' ? 'W-AI' : 'ICT';
  return `${cat} ${e.startTime}-${e.endTime}`;
};

/** Overlappen twee tijdvakken op dezelfde dag? (aansluitend, bv. 10:00-11:00 en 11:00-12:00, is geen overlap) */
const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  aStart < bEnd && bStart < aEnd;

/**
 * Bestaande registraties die overlappen met een nieuwe of gewijzigde registratie.
 * `excludeId` = de registratie zelf (bij wijzigen).
 */
export const findOverlappingEntries = (
  candidate: { date: string; startTime: string; endTime: string },
  entries: WorkEntry[],
  excludeId?: string
): WorkEntry[] =>
  entries.filter(
    e =>
      e.id !== excludeId &&
      e.date === candidate.date &&
      calculateDuration(e.startTime, e.endTime) > 0 &&
      overlaps(candidate.startTime, candidate.endTime, e.startTime, e.endTime)
  );

/** Leesbare waarschuwing voor een overlap bij invoer. */
export const describeOverlap = (date: string, others: WorkEntry[]): string =>
  `Deze registratie overlapt op ${formatDateBE(date)} met: ${others.map(entryLabel).join(', ')}.`;

/**
 * Alle bestaande problemen in de data (alleen lezen, er wordt niets aangepast):
 * overlappende registraties, registraties van 0 minuten, ritten van 0 km en
 * vakanties met een einddatum vóór de startdatum.
 */
export const findDataIssues = (
  workEntries: WorkEntry[],
  travelEntries: TravelEntry[],
  vacationPeriods: VacationPeriod[]
): DataIssue[] => {
  const issues: DataIssue[] = [];

  // 0 minuten (of eindtijd vóór starttijd)
  workEntries.forEach(e => {
    if (calculateDuration(e.startTime, e.endTime, e.breakTime || 0) <= 0) {
      issues.push({
        key: `zero-${e.id}`,
        kind: 'zero-duration',
        date: e.date,
        message: `Registratie van 0 minuten (${entryLabel(e)})`
      });
    }
  });

  // Overlappen per dag
  const byDate = new Map<string, WorkEntry[]>();
  workEntries.forEach(e => {
    if (calculateDuration(e.startTime, e.endTime) <= 0) return;
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date)!.push(e);
  });
  byDate.forEach((list, date) => {
    const sorted = [...list].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].startTime >= sorted[i].endTime) break;
        issues.push({
          key: `overlap-${sorted[i].id}-${sorted[j].id}`,
          kind: 'overlap',
          date,
          message: `Overlappende registraties: ${entryLabel(sorted[i])} en ${entryLabel(sorted[j])}`
        });
      }
    }
  });

  // Ritten van 0 km
  travelEntries.forEach(t => {
    if (!(t.distance > 0)) {
      issues.push({
        key: `km-${t.id}`,
        kind: 'zero-km',
        date: t.date,
        message: `Rit van 0 km (${t.description || 'zonder omschrijving'})`
      });
    }
  });

  // Vakanties met einddatum vóór startdatum
  vacationPeriods.forEach(vp => {
    if (vp.endDate < vp.startDate) {
      issues.push({
        key: `vac-${vp.id}`,
        kind: 'vacation-reversed',
        date: vp.startDate,
        message: `Vakantie "${vp.description || 'zonder naam'}": einddatum ${formatDateBE(vp.endDate)} ligt vóór startdatum ${formatDateBE(vp.startDate)}`
      });
    }
  });

  return issues.sort((a, b) => b.date.localeCompare(a.date));
};
