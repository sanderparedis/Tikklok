export type TransportType = 'auto' | 'fiets';
export type TabType = 'hours' | 'travel' | 'reports';
// 'wai' = W-AI: aparte opdracht, pure extra registratie (telt nergens mee: geen ICT, les of overuren)
export type WorkCategory = 'ict' | 'teaching' | 'wai';
export type FreeDayType = 'vrije/facultatieve dag' | 'ziek' | 'feestdag';

export interface WorkEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  breakTime: number; // minutes
  category?: WorkCategory; // 'ict' (default) or 'teaching'
  description?: string; // optional note/topic
  createdAt?: any;
  updatedAt?: any;
}

export interface TravelEntry {
  id: string;
  date: string;
  description: string;
  distance: number; // km
  type: TransportType;
  createdAt?: any;
  updatedAt?: any;
}

export interface TimerState {
  isActive: boolean;
  startTime: number | null;
  category?: WorkCategory;
}

export interface FreeDay {
  id: string;
  date: string;
  type: FreeDayType;
  description?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface VacationPeriod {
  id: string;
  startDate: string;
  endDate: string;
  description: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface SchoolYearWeekData {
  weekKey: string;
  workedIct: number;
  workedTeaching: number;
  workedTotal: number;
  targetMin: number;
  reductionMin: number;
  freeDaysCount: number;
  sickDaysCount?: number;
  summerDaysCount: number;
  balanceMin: number;
  /** Volledig ICT-weekdoel (targetMin is voor de lopende week het pro-rata doel t.e.m. vandaag). */
  fullTargetMin: number;
  teachingTargetMin: number; // lesopdracht-doel (pro-rata voor de lopende week)
  teachingBalanceMin: number; // gewerkt lesopdracht - doel
  weekendMin: number; // minuten gewerkt op za/zo (tellen mee in het totaal)
  isCurrentWeek: boolean; // lopende week: saldo t.e.m. vandaag
}

export interface SchoolYearData {
  schoolYear: string;
  totalWorkedIct: number;
  totalWorkedTeaching: number;
  totalWorkedAll: number;
  totalTargetMin: number;
  overtimeBalance: number;
  activeOvertime: number;
  totalTeachingTargetMin: number;
  teachingBalance: number; // eigen saldo lesopdracht (los van het officiële ICT-overurensaldo)
  isCurrent: boolean;
  weeksCount: number;
  activeTeachingWeeks: number;
  averageTeachingMinPerWeek: number;
  baseWeeklyTargetMin: number;
  weeks: SchoolYearWeekData[];
}

export interface IctBlock {
  start: string; // 'HH:MM' of '' (geen ICT)
  end: string;
}

/**
 * ICT-moment(en) van één weekdag. Een lijst blokken laat pauzes toe (bv. 07:50-11:55 en 12:45-16:40);
 * een lege lijst = geen ICT. Eén los blok is het oudere formaat en blijft geldig.
 */
export type IctDay = IctBlock | IctBlock[];

export interface UserScheduleConfig {
  adminNumerator: number; // e.g. 15
  teachingNumerator: number; // e.g. 6
  denominator: number; // e.g. 21
  fulltimeWeekHours: number; // e.g. 36
  teachingLessonsPerDay: Record<number, number>; // 1: 4, 2: 0, 3: 2, 4: 0, 5: 0
  /**
   * Vaste ICT-momenten per weekdag (1 = ma ... 5 = vr). Een dag die hier staat krijgt exact die
   * ICT-tijd (som van de blokken, pauzes tellen niet mee; lege lijst = geen ICT die dag). Dagen die hier niet staan delen de rest van de
   * ICT-weeknorm. Bepaalt hoeveel het weekdoel daalt bij een ziekte-, vrije of vakantiedag.
   */
  fixedIctBlocks?: Record<number, IctDay>;
  updatedAt?: any;
}

