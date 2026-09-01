import { TransportType, FreeDay, VacationPeriod, WorkCategory } from '../types';

export const TRANSPORT_RATES: Record<TransportType, number> = {
  auto: 0.4285,
  fiets: 0.21
};

export const LOCATIONS = ['Neeroeteren', 'Campus', 'Kinrooi', 'Maaseik'];

export const ROUTE_DISTANCES: Record<string, Record<string, number>> = {
  'Neeroeteren': { 'Campus': 7.7, 'Kinrooi': 7.7, 'Maaseik': 8.2 },
  'Campus': { 'Neeroeteren': 7.7, 'Kinrooi': 5.4, 'Maaseik': 2.1 },
  'Kinrooi': { 'Neeroeteren': 7.7, 'Campus': 5.4, 'Maaseik': 7.0 },
  'Maaseik': { 'Neeroeteren': 8.2, 'Campus': 2.1, 'Kinrooi': 7.0 }
};

export const calculateDuration = (start: string, end: string, pause: number = 0): number => {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
  const totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1) - pause;
  return Math.max(0, totalMinutes);
};

export const formatMinutes = (minutes: number): string => {
  const isNeg = minutes < 0;
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = Math.floor(abs % 60);
  return `${isNeg ? '-' : ''}${h}u ${m}m`;
};

export const formatMonoTime = (totalMinutes: number): string => {
  const isNeg = totalMinutes < 0;
  const abs = Math.abs(totalMinutes);
  const h = Math.floor(abs / 60);
  const m = Math.floor(abs % 60);
  return `${isNeg ? '-' : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const formatTimer = (minutes: number): string => {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = Math.floor(abs % 60);
  const s = Math.floor((abs * 60) % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const toLocalYYYYMMDD = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const isSummerDate = (dateStr: string): boolean => {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth(); // 0 = Jan, 5 = June, 6 = July, 7 = Aug
  return month === 6 || month === 7;
};

export const isWeekFullySummer = (mondayStr: string): boolean => {
  const mon = new Date(mondayStr + 'T00:00:00');
  for (let i = 0; i < 5; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const dateStr = toLocalYYYYMMDD(d);
    if (!isSummerDate(dateStr)) {
      return false;
    }
  }
  return true;
};

export const getSchoolYearForDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 = Jan ... 7 = Aug, 8 = Sep, 11 = Dec
  
  if (month >= 8) { // September (8) to December (11)
    return `${year}-${year + 1}`;
  } else { // January (0) to August (7)
    // If it's a Monday in late August where the school week crosses into September (e.g. 2026-08-31)
    const day = d.getDay();
    if (day === 1 && month === 7 && d.getDate() >= 25) {
      const friday = new Date(d);
      friday.setDate(d.getDate() + 4);
      if (friday.getMonth() >= 8) {
        return `${year}-${year + 1}`;
      }
    }
    return `${year - 1}-${year}`;
  }
};

export const getBaseTargetForSchoolYear = (schoolYear?: string): number => {
  // Streefdoel is in totaal 36 uur per week (2160 minuten) ongeacht lestijd of ICT
  return 36 * 60; // 2160 minutes
};

export const formatWeekLabel = (mondayStr: string): string => {
  const d = new Date(mondayStr + 'T00:00:00');
  const startStr = d.toLocaleDateString('nl', { day: 'numeric', month: 'short' });
  const end = new Date(d);
  end.setDate(d.getDate() + 4); // Friday
  const endStr = end.toLocaleDateString('nl', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startStr} t/m ${endStr}`;
};

export const calculateWeekTarget = (
  mondayStr: string, 
  freeDays: FreeDay[], 
  vacationPeriods: VacationPeriod[]
): { targetMin: number; baseTargetMin: number; reductionMin: number; freeDaysCount: number; summerDaysCount: number } => {
  const mon = new Date(mondayStr + 'T00:00:00');
  const schoolYear = getSchoolYearForDate(mondayStr);
  const baseTargetMin = getBaseTargetForSchoolYear(schoolYear);

  let reductionMin = 0;
  let freeDaysCount = 0;
  let summerDaysCount = 0;

  for (let i = 0; i < 5; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const dateStr = toLocalYYYYMMDD(d);
    
    const isFree = freeDays.some(fd => fd.date === dateStr);
    const isVacation = vacationPeriods.some(vp => dateStr >= vp.startDate && dateStr <= vp.endDate);
    const isSummer = isSummerDate(dateStr);

    if (isFree || isVacation || isSummer) {
      const dayOfWeek = d.getDay(); // 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri
      if (dayOfWeek === 3) { // Wednesday is 4 hours
        reductionMin += 4 * 60;
      } else { // Mon, Tue, Thu, Fri are 8 hours
        reductionMin += 8 * 60;
      }
      
      if (isSummer) {
        summerDaysCount++;
      } else {
        freeDaysCount++;
      }
    }
  }

  return {
    targetMin: Math.max(0, baseTargetMin - reductionMin),
    baseTargetMin,
    reductionMin,
    freeDaysCount,
    summerDaysCount
  };
};

export const CATEGORY_CONFIG: Record<WorkCategory, {
  label: string;
  shortLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  accentColor: string;
  description: string;
}> = {
  ict: {
    label: 'ICT-coördinatie',
    shortLabel: 'ICT',
    badgeBg: 'bg-sky-50 dark:bg-sky-950/40',
    badgeText: 'text-sky-700 dark:text-sky-300',
    badgeBorder: 'border-sky-200 dark:border-sky-800',
    accentColor: '#00638A',
    description: 'ICT-coördinatie taken & infrastructuur • Telt mee voor weekdoel 36u'
  },
  teaching: {
    label: 'Lesopdracht',
    shortLabel: 'Les',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/40',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-200 dark:border-purple-800',
    accentColor: '#7C3AED',
    description: '6 lesuren (50 min) & lesvoorbereidingen • Telt mee voor weekdoel 36u'
  }
};
