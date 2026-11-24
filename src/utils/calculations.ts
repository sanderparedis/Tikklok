import { TransportType, FreeDay, VacationPeriod, WorkCategory, UserScheduleConfig, IctBlock, IctDay } from '../types';

/**
 * Km-tarieven per periode. Het tarief hangt af van de DATUM VAN DE RIT, niet van vandaag:
 * zo veranderen oude maanden (en reeds ondertekende onkostennota's) niet als het tarief wijzigt.
 * Voeg bij elke tariefwijziging een nieuwe regel toe (oplopend op `from`, formaat YYYY-MM-DD),
 * bv. { from: '2027-09-01', rates: { auto: 0.45, fiets: 0.21 } }.
 */
export const RATE_PERIODS: { from: string; rates: Record<TransportType, number> }[] = [
  { from: '2000-01-01', rates: { auto: 0.4285, fiets: 0.21 } },
];

export const getTransportRate = (type: TransportType, dateStr: string): number => {
  let rate = RATE_PERIODS[0].rates[type];
  for (const p of RATE_PERIODS) {
    if (dateStr >= p.from) rate = p.rates[type];
  }
  return rate ?? 0;
};

/** Tarieven die vandaag gelden (voor labels in de UI). */
export const TRANSPORT_RATES: Record<TransportType, number> = RATE_PERIODS[RATE_PERIODS.length - 1].rates;

export const formatRate = (rate: number): string => rate.toString().replace('.', ',');

/** Maandag (YYYY-MM-DD) van de week waarin `dateStr` valt. */
export const getMondayStr = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return toLocalYYYYMMDD(d);
};

/** Zondag (YYYY-MM-DD) van de week die op `mondayStr` begint. Weekendwerk telt mee in die week. */
export const getSundayStr = (mondayStr: string): string => {
  const d = new Date(mondayStr + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return toLocalYYYYMMDD(d);
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
  ictMin: number; // ICT-minuten op deze dag (vast blok of aandeel van de rest)
  ictFixed: boolean; // true = vast ICT-moment ingesteld voor deze dag
  ictBlocks?: IctBlock[]; // vaste blokken van deze dag (leeg = geen ICT)
}

export const DEFAULT_SCHEDULE_CONFIG: UserScheduleConfig = {
  adminNumerator: 15,
  teachingNumerator: 6,
  denominator: 21,
  fulltimeWeekHours: 36,
  teachingLessonsPerDay: { 1: 4, 2: 0, 3: 2, 4: 0, 5: 0 },
  // Maandag: lessen 08:20-11:55, geen structurele ICT. Woensdag: ICT 07:50-10:15, lessen 10:15-11:55.
  fixedIctBlocks: {
    1: { start: '', end: '' },
    3: { start: '07:50', end: '10:15' }
  }
};

/**
 * Zet de instelling van één dag om naar een lijst blokken.
 * undefined = automatisch (geen vaste blokken), [] = geen ICT.
 */
export const getDayBlocks = (day?: IctDay): IctBlock[] | undefined => {
  if (day === undefined || day === null) return undefined;
  const list = Array.isArray(day) ? day : [day];
  return list.filter(b => b && (b.start || b.end));
};

/** Totale ICT-tijd van een dag in minuten: som van alle blokken (pauzes ertussen tellen niet mee). */
export const ictBlockMinutes = (day?: IctDay): number =>
  (getDayBlocks(day) || []).reduce(
    (sum, b) => sum + (b.start && b.end ? calculateDuration(b.start, b.end, 0) : 0),
    0
  );

/** Leesbare weergave, bv. "07:50-11:55 + 12:45-16:40". */
export const formatDayBlocks = (day?: IctDay): string =>
  (getDayBlocks(day) || []).map(b => `${b.start}-${b.end}`).join(' + ');

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
  const fixedBlocks = config?.fixedIctBlocks || {};

  // Stap 1: lesopdracht per dag + "automatisch" ICT-aandeel (dagnorm min lestijd)
  const autoIct: Record<number, number> = {};
  for (let d = 1; d <= 5; d++) {
    const isWednesday = d === 3;
    const totalNormMin = isWednesday ? halfDayNorm : fullDayNorm;
    const lessons = teachingLessonsPerDay[d] || 0;
    const teachingMin = Math.min(totalNormMin, Math.round(lessons * minPerLesson));
    autoIct[d] = Math.max(0, totalNormMin - teachingMin);

    daySchedules[d] = {
      dayOfWeek: d,
      dayName: dayNames[d],
      totalNormMin,
      teachingLessons: lessons,
      teachingMin,
      ictMin: autoIct[d],
      ictFixed: false
    };
  }

  // Stap 2: vaste ICT-momenten overschrijven hun dag; de rest van de ICT-weeknorm wordt verdeeld
  // over de overige dagen (naar verhouding van hun automatisch aandeel), zodat de som per week
  // altijd exact gelijk blijft aan de ICT-norm (een volledige week ziek = doel 0).
  const fixedDays = [1, 2, 3, 4, 5].filter(d => fixedBlocks[d] !== undefined);
  if (fixedDays.length > 0) {
    let fixedTotal = 0;
    fixedDays.forEach(d => {
      const min = ictBlockMinutes(fixedBlocks[d]);
      daySchedules[d].ictMin = min;
      daySchedules[d].ictFixed = true;
      daySchedules[d].ictBlocks = getDayBlocks(fixedBlocks[d]) || [];
      fixedTotal += min;
    });
    const autoDays = [1, 2, 3, 4, 5].filter(d => fixedBlocks[d] === undefined);
    const remaining = Math.max(0, adminTargetMin - fixedTotal);
    const weightSum = autoDays.reduce((s, d) => s + autoIct[d], 0);
    let assigned = 0;
    autoDays.forEach((d, i) => {
      const share = i === autoDays.length - 1
        ? remaining - assigned
        : Math.round(weightSum > 0 ? remaining * autoIct[d] / weightSum : remaining / autoDays.length);
      daySchedules[d].ictMin = Math.max(0, share);
      assigned += share;
    });
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

/** Weeklabel ma t/m zo, bv. "14 sep t/m 20 sep 2026" (weekendwerk telt mee in die week). */
export const formatWeekLabel = (mondayStr: string): string => {
  const d = new Date(mondayStr + 'T00:00:00');
  const startStr = d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });
  const end = new Date(d);
  end.setDate(d.getDate() + 6); // zondag
  const endStr = end.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startStr} t/m ${endStr}`;
};

/** Kort weeklabel zonder jaar, bv. "14 sep - 20 sep". */
export const formatWeekLabelShort = (mondayStr: string): string => {
  const d = new Date(mondayStr + 'T00:00:00');
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });
  return `${fmt(d)} - ${fmt(end)}`;
};

/** Saldo als tekst: "voor 1u 5m" / "achter 3u 10m" / "op schema". */
export const formatBalanceText = (minutes: number): string => {
  const m = Math.round(minutes);
  if (m === 0) return 'op schema';
  return m > 0 ? `voor ${formatMinutes(m)}` : `achter ${formatMinutes(-m)}`;
};

/** Saldo in mono-notatie met teken, bv. "+01:05" / "-03:10". */
export const formatSignedMono = (minutes: number): string =>
  minutes >= 0 ? `+${formatMonoTime(minutes)}` : formatMonoTime(minutes);

/** Begin- en einddatum (YYYY-MM-DD) van een schooljaar "2026-2027": 1 sep t/m 31 aug. */
export const getSchoolYearBounds = (schoolYear: string): { start: string; end: string } => {
  const y = Number(schoolYear.slice(0, 4));
  return { start: `${y}-09-01`, end: `${y + 1}-08-31` };
};

/** Is deze datum een vrije dag, vakantiedag of zomervakantiedag (dan geldt er geen norm)? */
export const isNonWorkingDate = (
  dateStr: string,
  freeDays: FreeDay[],
  vacationPeriods: VacationPeriod[]
): boolean =>
  freeDays.some(fd => fd.date === dateStr) ||
  vacationPeriods.some(vp => dateStr >= vp.startDate && dateStr <= vp.endDate) ||
  isSummerDate(dateStr);

/**
 * Pro-rata doel van een week t.e.m. `uptoDateStr` (inclusief die dag).
 * = weekdoel min de ICT-/lesminuten van de nog komende werkdagen (na `uptoDateStr`).
 * Zo is het pro-rata doel op zondag (of later) exact gelijk aan het volledige weekdoel,
 * en tellen za/zo nooit mee in het doel (weekendwerk telt wel mee in het gewerkte).
 */
export const calculateWeekTargetUpTo = (
  mondayStr: string,
  uptoDateStr: string,
  freeDays: FreeDay[],
  vacationPeriods: VacationPeriod[],
  userConfig?: UserScheduleConfig
): { ictTargetMin: number; teachingTargetMin: number; isPartial: boolean } => {
  const full = calculateWeekTarget(mondayStr, freeDays, vacationPeriods, userConfig);
  const { daySchedules } = computeScheduleDetails(userConfig);
  let ictRemaining = 0;
  let teachingRemaining = 0;
  const mon = new Date(mondayStr + 'T00:00:00');
  for (let i = 0; i < 5; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const dateStr = toLocalYYYYMMDD(d);
    if (dateStr <= uptoDateStr) continue;
    if (isNonWorkingDate(dateStr, freeDays, vacationPeriods)) continue;
    const sched = daySchedules[d.getDay()];
    if (sched) {
      ictRemaining += sched.ictMin;
      teachingRemaining += sched.teachingMin;
    }
  }
  return {
    ictTargetMin: Math.max(0, full.targetMin - ictRemaining),
    teachingTargetMin: Math.max(0, full.teachingTargetMin - teachingRemaining),
    isPartial: uptoDateStr < getSundayStr(mondayStr)
  };
};

/** Bedrag in Belgische notatie: "€ 8,40". */
export const formatEuro = (amount: number): string =>
  `€ ${amount.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Afstand in Belgische notatie: "7,7 km". */
export const formatKm = (km: number): string =>
  `${km.toLocaleString('nl-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;

/** Datum in Belgische notatie: "di 17 nov 2026". */
export const formatDateBE = (dateStr: string): string =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('nl-BE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

/** Is de datum een zaterdag of zondag? */
export const isWeekendDate = (dateStr: string): boolean => {
  const day = new Date(dateStr + 'T00:00:00').getDay();
  return day === 0 || day === 6;
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
  sickDaysCount: number;
  sickReductionMin: number;
  summerDaysCount: number;
} => {
  const details = computeScheduleDetails(userConfig);
  const baseTargetMin = details.adminTargetMin;
  const teachingBaseMin = details.teachingTargetMin;
  const daySchedules = details.daySchedules;

  let reductionMin = 0;
  let teachingReductionMin = 0;
  let freeDaysCount = 0;
  let sickDaysCount = 0;
  let sickReductionMin = 0;
  let summerDaysCount = 0;

  const mon = new Date(mondayStr + 'T00:00:00');

  for (let i = 0; i < 5; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const dateStr = toLocalYYYYMMDD(d);
    
    const matchedFreeDay = freeDays.find(fd => fd.date === dateStr);
    const isFree = Boolean(matchedFreeDay);
    const isVacation = vacationPeriods.some(vp => dateStr >= vp.startDate && dateStr <= vp.endDate);
    const isSummer = isSummerDate(dateStr);

    if (isFree || isVacation || isSummer) {
      const dayOfWeek = d.getDay(); // 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri
      const schedule = daySchedules[dayOfWeek];
      if (schedule) {
        reductionMin += schedule.ictMin;
        teachingReductionMin += schedule.teachingMin;
        if (matchedFreeDay?.type === 'ziek') {
          sickReductionMin += schedule.ictMin;
        }
      }
      
      if (isSummer) {
        summerDaysCount++;
      } else if (matchedFreeDay?.type === 'ziek') {
        sickDaysCount++;
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
    sickDaysCount,
    sickReductionMin,
    summerDaysCount
  };
};

/** Telt een registratie mee als ICT? (geen categorie = ICT, voor oude registraties) */
export const isIctCategory = (c?: WorkCategory | null): boolean => !c || c === 'ict';

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
  },
  wai: {
    label: 'W-AI',
    shortLabel: 'W-AI',
    badgeBg: 'bg-orange-50 dark:bg-orange-950/40',
    badgeText: 'text-orange-700 dark:text-orange-300',
    badgeBorder: 'border-orange-200 dark:border-orange-800',
    accentColor: '#EA580C',
    description: 'Aparte opdracht • Telt mee in totaal gewerkte uren, niet in ICT of overuren',
    isOfficial: false
  }
};
