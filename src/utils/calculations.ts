import { TransportType, FreeDay, VacationPeriod, WorkCategory, UserScheduleConfig } from '../types';

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

export interface DaySchedule {
  dayOfWeek: number; // 1 = Maandag, 2 = Dinsdag, 3 = Woensdag, 4 = Donderdag, 5 = Vrijdag
  dayName: string;
  totalNormMin: number; // 8u = 480 min, 4u = 240 min (geschaald naar 36u week)
  teachingLessons: number; // Aantal lesuren op deze dag
  teachingMin: number; // Minuten lesopdracht (incl. voorbereiding/evaluatie)
  ictMin: number; // Resterende ICT-minuten op deze dag
}

export const DEFAULT_SCHEDULE_CONFIG: UserScheduleConfig = {
  adminNumerator: 15,
  teachingNumerator: 6,
  denominator: 21,
  fulltimeWeekHours: 36,
  teachingLessonsPerDay: { 1: 4, 2: 0, 3: 2, 4: 0, 5: 0 }
};

export interface ScheduleDetails {
  adminNumerator: number;
  teachingNumerator: number;
  denominator: number;
  fulltimeWeekHours: number;
  adminTargetMin: number;
  teachingTargetMin: number;
  totalTargetMin: number;
  totalLessons: number;
  minPerLesson: number;
  daySchedules: Record<number, DaySchedule>;
  fractionLabel: string;
  teachingFractionLabel: string;
}

export const computeScheduleDetails = (config?: Partial<UserScheduleConfig>): ScheduleDetails => {
  const adminNum = Number(config?.adminNumerator ?? 15);
  const teachingNum = Number(config?.teachingNumerator ?? 6);
  const denom = Number(config?.denominator ?? 21);
  const fulltimeHours = Number(config?.fulltimeWeekHours ?? 36);

  const adminNumerator = !isNaN(adminNum) && adminNum >= 0 ? adminNum : 15;
  const teachingNumerator = !isNaN(teachingNum) && teachingNum >= 0 ? teachingNum : 6;
  const denominator = !isNaN(denom) && denom > 0 ? denom : 21;
  const fulltimeWeekHours = !isNaN(fulltimeHours) && fulltimeHours > 0 ? fulltimeHours : 36;

  const rawLessons = config?.teachingLessonsPerDay || { 1: 4, 2: 0, 3: 2, 4: 0, 5: 0 };
  const teachingLessonsPerDay: Record<number, number> = {
    1: Number(rawLessons[1] ?? 0),
    2: Number(rawLessons[2] ?? 0),
    3: Number(rawLessons[3] ?? 0),
    4: Number(rawLessons[4] ?? 0),
    5: Number(rawLessons[5] ?? 0)
  };

  // Berekening normuren in minuten
  const adminTargetMin = Math.round((adminNumerator / denominator) * fulltimeWeekHours * 60);
  const teachingTargetMin = Math.round((teachingNumerator / denominator) * fulltimeWeekHours * 60);
  const totalTargetMin = adminTargetMin + teachingTargetMin;

  // Som lesuren over de week
  const totalLessons = [1, 2, 3, 4, 5].reduce((sum, d) => sum + (teachingLessonsPerDay[d] || 0), 0);
  const effectiveLessons = totalLessons > 0 ? totalLessons : (teachingNumerator > 0 ? teachingNumerator : 0);
  const minPerLesson = effectiveLessons > 0 ? teachingTargetMin / effectiveLessons : 0;

  // Dagschema normen: in een 36u week is ma/di/do/vr 8u (480m) en woensdag 4u (240m)
  const scale = fulltimeWeekHours / 36;
  const fullDayNorm = Math.round(480 * scale);
  const halfDayNorm = Math.round(240 * scale);

  const dayNames: Record<number, string> = {
    1: 'Maandag',
    2: 'Dinsdag',
    3: 'Woensdag',
    4: 'Donderdag',
    5: 'Vrijdag'
  };

  const daySchedules: Record<number, DaySchedule> = {};

  for (let d = 1; d <= 5; d++) {
    const isWednesday = d === 3;
    const totalNormMin = isWednesday ? halfDayNorm : fullDayNorm;
    const lessons = teachingLessonsPerDay[d] || 0;
    const teachingMin = Math.min(totalNormMin, Math.round(lessons * minPerLesson));
    const ictMin = Math.max(0, totalNormMin - teachingMin);

    daySchedules[d] = {
      dayOfWeek: d,
      dayName: dayNames[d],
      totalNormMin,
      teachingLessons: lessons,
      teachingMin,
      ictMin
    };
  }

  return {
    adminNumerator,
    teachingNumerator,
    denominator,
    fulltimeWeekHours,
    adminTargetMin,
    teachingTargetMin,
    totalTargetMin,
    totalLessons,
    minPerLesson,
    daySchedules,
    fractionLabel: `${adminNumerator}/${denominator}`,
    teachingFractionLabel: `${teachingNumerator}/${denominator}`
  };
};

export const ADMINISTRATIVE_TARGET_MIN = 25 * 60 + 43; // 1543 min (default 15/21 van 36u)
export const TEACHING_GUIDELINE_MIN = 10 * 60 + 17; // 617 min (default 6/21 van 36u)
export const TOTAL_WEEK_NORM_MIN = 36 * 60; // 2160 min (default 21/21 = 36u)

export const getBaseTargetForSchoolYear = (schoolYear?: string, config?: UserScheduleConfig): number => {
  return computeScheduleDetails(config).adminTargetMin;
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
  vacationPeriods: VacationPeriod[],
  userConfig?: UserScheduleConfig
): {
  targetMin: number;
  baseTargetMin: number;
  reductionMin: number;
  teachingTargetMin: number;
  teachingBaseMin: number;
  teachingReductionMin: number;
  freeDaysCount: number;
  summerDaysCount: number;
} => {
  const details = computeScheduleDetails(userConfig);
  const baseTargetMin = details.adminTargetMin;
  const teachingBaseMin = details.teachingTargetMin;
  const daySchedules = details.daySchedules;

  let reductionMin = 0;
  let teachingReductionMin = 0;
  let freeDaysCount = 0;
  let summerDaysCount = 0;

  const mon = new Date(mondayStr + 'T00:00:00');

  for (let i = 0; i < 5; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const dateStr = toLocalYYYYMMDD(d);
    
    const isFree = freeDays.some(fd => fd.date === dateStr);
    const isVacation = vacationPeriods.some(vp => dateStr >= vp.startDate && dateStr <= vp.endDate);
    const isSummer = isSummerDate(dateStr);

    if (isFree || isVacation || isSummer) {
      const dayOfWeek = d.getDay(); // 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri
      const schedule = daySchedules[dayOfWeek];
      if (schedule) {
        reductionMin += schedule.ictMin;
        teachingReductionMin += schedule.teachingMin;
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
    teachingTargetMin: Math.max(0, teachingBaseMin - teachingReductionMin),
    teachingBaseMin,
    teachingReductionMin,
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
  isOfficial: boolean;
}> = {
  ict: {
    label: 'ICT-coördinatie',
    shortLabel: 'ICT',
    badgeBg: 'bg-sky-50 dark:bg-sky-950/40',
    badgeText: 'text-sky-700 dark:text-sky-300',
    badgeBorder: 'border-sky-200 dark:border-sky-800',
    accentColor: '#00638A',
    description: 'Administratief (15/21 • norm 25u 43m) • Telt mee voor overuren',
    isOfficial: true
  },
  teaching: {
    label: 'Lesopdracht',
    shortLabel: 'Les',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/40',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-200 dark:border-purple-800',
    accentColor: '#7C3AED',
    description: '6 lesuren (50 min) & voorbereiding • Eigen administratie (geen overuren)',
    isOfficial: false
  }
};
