import { TravelEntry } from '../types';
import { getTransportRate } from './calculations';

export interface MonthTravelExport {
  maand: string; // JJJJ-MM
  ritten: { datum: string; traject: string; vervoer: 'Auto' | 'Fiets'; km: number }[];
  totaal_eur: number;
}

/** Vorige maand (JJJJ-MM) t.o.v. een datum JJJJ-MM-DD. */
export const previousMonthKey = (todayStr: string): string => {
  const y = Number(todayStr.slice(0, 4));
  const m = Number(todayStr.slice(5, 7));
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, '0')}`;
};

/**
 * Ritten van één maand in het formaat van de maandtaak (maak_onkosten.py):
 * {"maand":"JJJJ-MM","ritten":[{"datum":"JJJJ-MM-DD","traject":"...","vervoer":"Auto","km":7.7}],"totaal_eur":12.34}
 * totaal_eur = som van km × tarief (tarief volgens de datum van de rit), afgerond op 2 decimalen,
 * net zoals de app het bedrag toont.
 */
export const buildMonthTravelExport = (entries: TravelEntry[], monthKey: string): MonthTravelExport => {
  const monthEntries = entries
    .filter(t => t.date.startsWith(monthKey + '-'))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.description || '').localeCompare(b.description || ''));
  const total = monthEntries.reduce((sum, t) => sum + t.distance * getTransportRate(t.type, t.date), 0);
  return {
    maand: monthKey,
    ritten: monthEntries.map(t => ({
      datum: t.date,
      traject: t.description,
      vervoer: t.type === 'fiets' ? 'Fiets' : 'Auto',
      km: t.distance
    })),
    totaal_eur: Math.round(total * 100) / 100
  };
};
