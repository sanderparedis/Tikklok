export type TransportType = 'auto' | 'fiets';
export type TabType = 'hours' | 'travel' | 'reports';
export type WorkCategory = 'ict' | 'teaching';
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
  summerDaysCount: number;
  balanceMin: number;
}

export interface SchoolYearData {
  schoolYear: string;
  totalWorkedIct: number;
  totalWorkedTeaching: number;
  totalWorkedAll: number;
  totalTargetMin: number;
  overtimeBalance: number;
  activeOvertime: number;
  isCurrent: boolean;
  weeksCount: number;
  activeTeachingWeeks: number;
  averageTeachingMinPerWeek: number;
  baseWeeklyTargetMin: number;
  weeks: SchoolYearWeekData[];
}
