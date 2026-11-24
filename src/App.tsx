import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  Car, 
  BarChart3, 
  GraduationCap, 
  Briefcase 
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';

import { auth, db, signInWithGoogle, logout, OperationType, handleFirestoreError } from './lib/firebase';
import { 
  TabType, 
  WorkEntry, 
  TravelEntry, 
  FreeDay, 
  VacationPeriod, 
  TimerState, 
  WorkCategory,
  SchoolYearData,
  SchoolYearWeekData,
  UserScheduleConfig
} from './types';
import { 
  calculateDuration, 
  calculateWeekTarget, 
  getSchoolYearForDate, 
  getBaseTargetForSchoolYear, 
  toLocalYYYYMMDD, 
  getTransportRate,
  getMondayStr,
  getSundayStr,
  isIctCategory,
  isWeekendDate,
  calculateWeekTargetUpTo,
  formatWeekLabelShort,
  getSchoolYearBounds,
  DEFAULT_SCHEDULE_CONFIG
} from './utils/calculations';

import { HeaderStats } from './components/HeaderStats';
import { HoursTab } from './components/HoursTab';
import { WorkEntryList } from './components/WorkEntryList';
import { TravelTab } from './components/TravelTab';
import { ReportsTab } from './components/ReportsTab';
import { ScheduleConfigModal } from './components/ScheduleConfigModal';
import { SickLeaveModal } from './components/SickLeaveModal';
import { TimerCard } from './components/TimerCard';
import { ChecksPanel } from './components/ChecksPanel';
import { findDataIssues, findOverlappingEntries, describeOverlap } from './utils/checks';

const TABS: { id: TabType; short: string; long: string; icon: typeof Clock }[] = [
  { id: 'hours', short: 'Uren', long: 'Tijdregistratie', icon: Clock },
  { id: 'travel', short: 'Ritten', long: 'Verplaatsingen', icon: Car },
  { id: 'reports', short: 'Rapport', long: 'Overuren & Rapporten', icon: BarChart3 }
];
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('hours');
  
  // Data collections
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [travelEntries, setTravelEntries] = useState<TravelEntry[]>([]);
  const [freeDays, setFreeDays] = useState<FreeDay[]>([]);
  const [vacationPeriods, setVacationPeriods] = useState<VacationPeriod[]>([]);
  
  // Modals and feedback state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isSickModalOpen, setIsSickModalOpen] = useState(false);
  const [toastNotification, setToastNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => {
      setToastNotification(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toastNotification]);
  
  // User Schedule Configuration (Verdeelsleutel & Rooster)
  const [scheduleConfig, setScheduleConfig] = useState<UserScheduleConfig>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('mosa_schedule_config');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return { ...parsed, fixedIctBlocks: parsed.fixedIctBlocks ?? DEFAULT_SCHEDULE_CONFIG.fixedIctBlocks };
        } catch {
          // fallback to default
        }
      }
    }
    return DEFAULT_SCHEDULE_CONFIG;
  });
  
  // Timer State
  const [timer, setTimer] = useState<TimerState>({
    isActive: false,
    startTime: null,
    category: 'ict'
  });
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Sync Timer from Firestore
  useEffect(() => {
    if (!user) {
      setTimer({ isActive: false, startTime: null, category: 'ict' });
      return;
    }
    const userRef = doc(db, 'users', user.uid);
    return onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setTimer({
          isActive: Boolean(data.isActive),
          startTime: data.startTime || null,
          category: data.category || 'ict'
        });
      }
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    });
  }, [user]);

  // Sync Work Entries
  useEffect(() => {
    if (!user) {
      setWorkEntries([]);
      return;
    }
    const q = query(collection(db, 'users', user.uid, 'workEntries'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const entries: WorkEntry[] = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        entries.push({
          id: doc.id,
          date: d.date,
          startTime: d.startTime,
          endTime: d.endTime,
          breakTime: d.breakTime || 0,
          category: d.category || 'ict',
          description: d.description || ''
        });
      });
      setWorkEntries(entries);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/workEntries`);
    });
  }, [user]);

  // Sync Travel Entries
  useEffect(() => {
    if (!user) {
      setTravelEntries([]);
      return;
    }
    const q = query(collection(db, 'users', user.uid, 'travelEntries'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const entries: TravelEntry[] = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        entries.push({
          id: doc.id,
          date: d.date,
          description: d.description,
          distance: d.distance,
          type: d.type
        });
      });
      setTravelEntries(entries);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/travelEntries`);
    });
  }, [user]);

  // Sync Free Days
  useEffect(() => {
    if (!user) {
      setFreeDays([]);
      return;
    }
    const q = query(collection(db, 'users', user.uid, 'freeDays'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const entries: FreeDay[] = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        entries.push({
          id: doc.id,
          date: d.date,
          type: d.type,
          description: d.description
        });
      });
      setFreeDays(entries);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/freeDays`);
    });
  }, [user]);

  // Sync Vacation Periods
  useEffect(() => {
    if (!user) {
      setVacationPeriods([]);
      return;
    }
    const q = query(collection(db, 'users', user.uid, 'vacationPeriods'), orderBy('startDate', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const entries: VacationPeriod[] = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        entries.push({
          id: doc.id,
          startDate: d.startDate,
          endDate: d.endDate,
          description: d.description
        });
      });
      setVacationPeriods(entries);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/vacationPeriods`);
    });
  }, [user]);

  // Sync Schedule Settings from Firestore
  useEffect(() => {
    if (!user) {
      return;
    }
    const settingsRef = doc(db, 'users', user.uid, 'settings', 'schedule');
    return onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const d = snapshot.data();
        const loaded: UserScheduleConfig = {
          adminNumerator: typeof d.adminNumerator === 'number' ? d.adminNumerator : DEFAULT_SCHEDULE_CONFIG.adminNumerator,
          teachingNumerator: typeof d.teachingNumerator === 'number' ? d.teachingNumerator : DEFAULT_SCHEDULE_CONFIG.teachingNumerator,
          denominator: typeof d.denominator === 'number' ? d.denominator : DEFAULT_SCHEDULE_CONFIG.denominator,
          fulltimeWeekHours: typeof d.fulltimeWeekHours === 'number' ? d.fulltimeWeekHours : DEFAULT_SCHEDULE_CONFIG.fulltimeWeekHours,
          teachingLessonsPerDay: d.teachingLessonsPerDay || DEFAULT_SCHEDULE_CONFIG.teachingLessonsPerDay,
          fixedIctBlocks: d.fixedIctBlocks && typeof d.fixedIctBlocks === 'object' ? d.fixedIctBlocks : DEFAULT_SCHEDULE_CONFIG.fixedIctBlocks,
          updatedAt: d.updatedAt || undefined
        };
        setScheduleConfig(loaded);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`mosa_schedule_config_${user.uid}`, JSON.stringify(loaded));
          localStorage.setItem('mosa_schedule_config', JSON.stringify(loaded));
        }
      }
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/settings/schedule`);
      }
    });
  }, [user]);

  const handleSaveScheduleConfig = async (newConfig: UserScheduleConfig) => {
    setScheduleConfig(newConfig);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mosa_schedule_config', JSON.stringify(newConfig));
    }
    if (user) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`mosa_schedule_config_${user.uid}`, JSON.stringify(newConfig));
      }
      try {
        const settingsRef = doc(db, 'users', user.uid, 'settings', 'schedule');
        await setDoc(settingsRef, {
          adminNumerator: newConfig.adminNumerator,
          teachingNumerator: newConfig.teachingNumerator,
          denominator: newConfig.denominator,
          fulltimeWeekHours: newConfig.fulltimeWeekHours,
          teachingLessonsPerDay: newConfig.teachingLessonsPerDay,
          fixedIctBlocks: newConfig.fixedIctBlocks || {},
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/settings/schedule`);
      }
    }
  };

  // Live Timer Interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer.isActive && timer.startTime) {
      interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    }
    return () => clearInterval(interval);
  }, [timer.isActive, timer.startTime]);

  // Current live minutes
  const liveMinutes = useMemo(() => {
    if (!timer.isActive || !timer.startTime) return 0;
    return Math.max(0, (currentTime - timer.startTime) / 60000);
  }, [timer.isActive, timer.startTime, currentTime]);

  // "Vandaag" wordt elke minuut herberekend, zodat een app die over middernacht / het weekend
  // open blijft (bv. op gsm) niet in de vorige dag of week blijft hangen.
  const [defaultToday, setDefaultToday] = useState(() => toLocalYYYYMMDD(new Date()));
  useEffect(() => {
    const id = setInterval(() => {
      const t = toLocalYYYYMMDD(new Date());
      setDefaultToday(prev => (prev === t ? prev : t));
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  const currentSchoolYear = useMemo(() => getSchoolYearForDate(defaultToday), [defaultToday]);

  // Monday of the current week
  const currentMondayStr = useMemo(() => getMondayStr(defaultToday), [defaultToday]);

  // Calculate current week target for ICT
  const currentWeekTargetInfo = useMemo(() => {
    return calculateWeekTarget(currentMondayStr, freeDays, vacationPeriods, scheduleConfig);
  }, [currentMondayStr, freeDays, vacationPeriods, scheduleConfig]);

  // Current week work minutes (ICT vs Teaching)
  const { currentWeekIctMin, currentWeekTeachingMin, currentWeekWaiMin } = useMemo(() => {
    // Ma t/m zo: weekendwerk telt mee (consistent met het schooljaaroverzicht)
    const sundayStr = getSundayStr(currentMondayStr);

    let ict = 0;
    let teaching = 0;
    let wai = 0;

    workEntries.forEach(e => {
      if (e.date >= currentMondayStr && e.date <= sundayStr) {
        const dur = calculateDuration(e.startTime, e.endTime, e.breakTime || 0);
        if (e.category === 'teaching') {
          teaching += dur;
        } else if (e.category === 'wai') {
          wai += dur;
        } else {
          ict += dur;
        }
      }
    });

    if (timer.isActive) {
      if (timer.category === 'teaching') {
        teaching += liveMinutes;
      } else if (timer.category === 'wai') {
        wai += liveMinutes;
      } else {
        ict += liveMinutes;
      }
    }

    return { currentWeekIctMin: Math.round(ict), currentWeekTeachingMin: Math.round(teaching), currentWeekWaiMin: Math.round(wai) };
  }, [currentMondayStr, workEntries, timer.isActive, timer.category, liveMinutes]);

  // Travel totals for the current month (displayed in header KPI card)
  const currentMonthKey = useMemo(() => defaultToday.substring(0, 7), [defaultToday]);
  const currentMonthName = useMemo(() => {
    return new Date(defaultToday + 'T00:00:00').toLocaleDateString('nl-BE', { month: 'long' });
  }, [defaultToday]);

  const { currentMonthKm, currentMonthTravelComp } = useMemo(() => {
    const monthEntries = travelEntries.filter(t => t.date.startsWith(currentMonthKey));
    const km = monthEntries.reduce((acc, t) => acc + t.distance, 0);
    const comp = monthEntries.reduce((acc, t) => acc + (t.distance * getTransportRate(t.type, t.date)), 0);
    return { currentMonthKm: km, currentMonthTravelComp: comp };
  }, [travelEntries, currentMonthKey]);

  // Aggregate School Years Data
  const schoolYearsData: SchoolYearData[] = useMemo(() => {
    const syMap: Record<string, {
      weeks: Record<string, { ict: number; teaching: number; weekend: number }>;
    }> = {};

    // Collect all Mondays from work entries
    workEntries.forEach(entry => {
      const monStr = getMondayStr(entry.date);
      const sy = getSchoolYearForDate(monStr);

      if (!syMap[sy]) {
        syMap[sy] = { weeks: {} };
      }
      if (!syMap[sy].weeks[monStr]) {
        syMap[sy].weeks[monStr] = { ict: 0, teaching: 0, weekend: 0 };
      }
      const dur = calculateDuration(entry.startTime, entry.endTime, entry.breakTime || 0);
      if (isWeekendDate(entry.date)) {
        syMap[sy].weeks[monStr].weekend += dur;
      }
      if (entry.category === 'teaching') {
        syMap[sy].weeks[monStr].teaching += dur;
      } else if (isIctCategory(entry.category)) {
        syMap[sy].weeks[monStr].ict += dur;
      } // W-AI telt niet mee in het schooljaaroverzicht
    });

    // Collect all Mondays from free days (including sick days)
    freeDays.forEach(fd => {
      const monStr = getMondayStr(fd.date);
      const sy = getSchoolYearForDate(monStr);

      if (!syMap[sy]) {
        syMap[sy] = { weeks: {} };
      }
      if (!syMap[sy].weeks[monStr]) {
        syMap[sy].weeks[monStr] = { ict: 0, teaching: 0, weekend: 0 };
      }
    });

    // Ensure current school year exists
    if (!syMap[currentSchoolYear]) {
      syMap[currentSchoolYear] = { weeks: {} };
    }
    if (!syMap[currentSchoolYear].weeks[currentMondayStr]) {
      syMap[currentSchoolYear].weeks[currentMondayStr] = { ict: 0, teaching: 0, weekend: 0 };
    }

    // Vul ontbrekende weken op tussen de eerste geregistreerde week en de laatste (of huidige) week.
    // Zonder dit telt een week zonder enige registratie (vergeten in te vullen, of afwezig zonder
    // vrije dag te boeken) niet mee in het streefdoel en wordt het overurensaldo te rooskleurig.
    Object.keys(syMap).forEach(sy => {
      const keys = Object.keys(syMap[sy].weeks).sort();
      if (keys.length === 0) return;
      let last = keys[keys.length - 1];
      if (sy === currentSchoolYear && currentMondayStr > last) last = currentMondayStr;
      const cur = new Date(keys[0] + 'T00:00:00');
      let guard = 0;
      while (toLocalYYYYMMDD(cur) <= last && guard < 60) {
        const k = toLocalYYYYMMDD(cur);
        if (!syMap[sy].weeks[k] && getSchoolYearForDate(k) === sy) {
          syMap[sy].weeks[k] = { ict: 0, teaching: 0, weekend: 0 };
        }
        cur.setDate(cur.getDate() + 7);
        guard++;
      }
    });

    const result: SchoolYearData[] = Object.keys(syMap)
      .sort((a, b) => b.localeCompare(a))
      .map(sy => {
        const isCurrent = sy === currentSchoolYear;
        const baseWeeklyTargetMin = getBaseTargetForSchoolYear(sy, scheduleConfig);
        const weekKeys = Object.keys(syMap[sy].weeks).sort((a, b) => b.localeCompare(a));

        let totalWorkedIct = 0;
        let totalWorkedTeaching = 0;
        let totalTargetMin = 0;
        let totalTeachingTargetMin = 0;
        let activeTeachingWeeks = 0;

        const weeks: SchoolYearWeekData[] = weekKeys.map(monStr => {
          const wData = syMap[sy].weeks[monStr];
          const targetInfo = calculateWeekTarget(monStr, freeDays, vacationPeriods, scheduleConfig);
          const isCurrentWeek = isCurrent && monStr === currentMondayStr;

          // Lopende week: doel pro rata t.e.m. vandaag. Afgelopen weken: volledig weekdoel.
          const upTo = isCurrentWeek
            ? calculateWeekTargetUpTo(monStr, defaultToday, freeDays, vacationPeriods, scheduleConfig)
            : { ictTargetMin: targetInfo.targetMin, teachingTargetMin: targetInfo.teachingTargetMin };

          let wIct = wData.ict;
          let wTeaching = wData.teaching;

          // Live timer telt mee in de lopende week
          if (isCurrentWeek && timer.isActive) {
            if (timer.category === 'teaching') {
              wTeaching += liveMinutes;
            } else if (isIctCategory(timer.category)) {
              wIct += liveMinutes;
            }
          }

          const workedIct = Math.round(wIct);
          const workedTeaching = Math.round(wTeaching);
          const workedTotal = workedIct + workedTeaching;
          // Enkel de administratieve uren (ICT 15/21) tellen mee voor het officiële overurensaldo
          const balanceMin = workedIct - upTo.ictTargetMin;
          // Lesopdracht: eigen saldo, los van het officiële saldo
          const teachingBalanceMin = workedTeaching - upTo.teachingTargetMin;

          totalWorkedIct += workedIct;
          totalWorkedTeaching += workedTeaching;
          totalTargetMin += upTo.ictTargetMin;
          totalTeachingTargetMin += upTo.teachingTargetMin;
          if (workedTeaching > 0) {
            activeTeachingWeeks++;
          }

          return {
            weekKey: monStr,
            workedIct,
            workedTeaching,
            workedTotal,
            targetMin: upTo.ictTargetMin,
            fullTargetMin: targetInfo.targetMin,
            reductionMin: targetInfo.reductionMin,
            freeDaysCount: targetInfo.freeDaysCount,
            sickDaysCount: targetInfo.sickDaysCount,
            summerDaysCount: targetInfo.summerDaysCount,
            balanceMin,
            teachingTargetMin: upTo.teachingTargetMin,
            teachingBalanceMin,
            weekendMin: Math.round(wData.weekend),
            isCurrentWeek
          };
        });

        const totalWorkedAll = totalWorkedIct + totalWorkedTeaching;

        // Saldo = som van alle weken, inclusief de lopende week pro rata (t.e.m. vandaag).
        // Zo tonen het saldo bovenaan, het weekkaartje en de tabel overal hetzelfde.
        const overtimeBalance = totalWorkedIct - totalTargetMin;
        const teachingBalance = totalWorkedTeaching - totalTeachingTargetMin;

        const weeksCount = weeks.length;
        const divisor = activeTeachingWeeks > 0 ? activeTeachingWeeks : (weeksCount > 0 ? weeksCount : 1);
        const averageTeachingMinPerWeek = Math.round(totalWorkedTeaching / divisor);

        return {
          schoolYear: sy,
          totalWorkedIct,
          totalWorkedTeaching,
          totalWorkedAll,
          totalTargetMin,
          overtimeBalance,
          activeOvertime: overtimeBalance,
          totalTeachingTargetMin,
          teachingBalance,
          isCurrent,
          weeksCount,
          activeTeachingWeeks,
          averageTeachingMinPerWeek,
          baseWeeklyTargetMin,
          weeks
        };
      });

    return result;
  }, [workEntries, currentSchoolYear, currentMondayStr, defaultToday, freeDays, vacationPeriods, timer.isActive, timer.category, liveMinutes, scheduleConfig]);

  const currentYearData = schoolYearsData.find(s => s.schoolYear === currentSchoolYear);
  const currentOvertimeBalance = currentYearData?.overtimeBalance || 0;
  // Totaal gewerkt = ICT + lesopdracht + W-AI (W-AI telt wel mee in het totaal, niet in ICT/overuren)
  const currentWeekTotalMin = currentWeekIctMin + currentWeekTeachingMin + currentWeekWaiMin;

  // Alle weken (over schooljaren heen) op maandag-sleutel, voor de weekkaartjes
  const weekByKey = useMemo(() => {
    const map: Record<string, SchoolYearWeekData> = {};
    schoolYearsData.forEach(sy => sy.weeks.forEach(w => { map[w.weekKey] = w; }));
    return map;
  }, [schoolYearsData]);

  const currentWeekData = weekByKey[currentMondayStr];

  // Laatste 3 weken: dezelfde cijfers als in het schooljaaroverzicht (lopende week pro rata)
  const lastThreeWeeks = useMemo(() => {
    const list = [];
    const mon = new Date(currentMondayStr + 'T00:00:00');

    for (let i = 0; i < 3; i++) {
      const curMon = new Date(mon);
      curMon.setDate(mon.getDate() - (i * 7));
      const monStr = toLocalYYYYMMDD(curMon);
      const w = weekByKey[monStr];
      const targetInfo = calculateWeekTarget(monStr, freeDays, vacationPeriods, scheduleConfig);
      const targetMin = w ? w.targetMin : targetInfo.targetMin;
      const teachingTargetMin = w ? w.teachingTargetMin : targetInfo.teachingTargetMin;
      const workedIctMin = w?.workedIct ?? 0;
      const workedTeachingMin = w?.workedTeaching ?? 0;

      list.push({
        mondayStr: monStr,
        weekLabel: formatWeekLabelShort(monStr),
        targetMin,
        fullTargetMin: w?.fullTargetMin ?? targetInfo.targetMin,
        workedIctMin,
        workedTeachingMin,
        workedTotalMin: workedIctMin + workedTeachingMin,
        balanceMin: w ? w.balanceMin : workedIctMin - targetMin,
        teachingTargetMin,
        teachingBalanceMin: w ? w.teachingBalanceMin : workedTeachingMin - teachingTargetMin,
        weekendMin: w?.weekendMin ?? 0,
        isCurrentWeek: i === 0,
        freeDaysCount: targetInfo.freeDaysCount
      });
    }

    return list;
  }, [currentMondayStr, weekByKey, freeDays, vacationPeriods, scheduleConfig]);

  // Monthly aggregated data
  const monthlyData = useMemo(() => {
    const monthsMap: Record<string, {
      label: string;
      ictMin: number;
      teachingMin: number;
      totalWorkMin: number;
      waiMin: number;
      travelKm: number;
      travelComp: number;
      entriesCount: number;
    }> = {};

    workEntries.forEach(e => {
      const monthKey = e.date.substring(0, 7);
      if (!monthsMap[monthKey]) {
        const d = new Date(e.date + 'T00:00:00');
        monthsMap[monthKey] = {
          label: d.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' }),
          ictMin: 0,
          teachingMin: 0,
          totalWorkMin: 0,
          waiMin: 0,
          travelKm: 0,
          travelComp: 0,
          entriesCount: 0
        };
      }
      const dur = calculateDuration(e.startTime, e.endTime, e.breakTime || 0);
      if (e.category === 'wai') {
        // W-AI: telt mee in totaal werkuren, niet in ICT
        monthsMap[monthKey].waiMin += dur;
      } else if (e.category === 'teaching') {
        monthsMap[monthKey].teachingMin += dur;
      } else {
        monthsMap[monthKey].ictMin += dur;
      }
      monthsMap[monthKey].totalWorkMin += dur;
      monthsMap[monthKey].entriesCount++;
    });

    travelEntries.forEach(t => {
      const monthKey = t.date.substring(0, 7);
      if (!monthsMap[monthKey]) {
        const d = new Date(t.date + 'T00:00:00');
        monthsMap[monthKey] = {
          label: d.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' }),
          ictMin: 0,
          teachingMin: 0,
          totalWorkMin: 0,
          waiMin: 0,
          travelKm: 0,
          travelComp: 0,
          entriesCount: 0
        };
      }
      monthsMap[monthKey].travelKm += t.distance;
      monthsMap[monthKey].travelComp += (t.distance * getTransportRate(t.type, t.date));
    });

    return Object.keys(monthsMap)
      .sort((a, b) => b.localeCompare(a))
      .map(k => ({
        monthKey: k,
        monthLabel: monthsMap[k].label,
        ictMin: monthsMap[k].ictMin,
        teachingMin: monthsMap[k].teachingMin,
        totalWorkMin: monthsMap[k].totalWorkMin,
        waiMin: monthsMap[k].waiMin,
        travelKm: monthsMap[k].travelKm,
        travelComp: monthsMap[k].travelComp,
        entriesCount: monthsMap[k].entriesCount
      }));
  }, [workEntries, travelEntries]);

  // Toon schrijffouten aan de gebruiker i.p.v. een stille, ongevangen exception in de console.
  const reportError = (err: unknown, op: OperationType, path: string) => {
    try {
      handleFirestoreError(err, op, path);
    } catch {
      // handleFirestoreError logt en gooit altijd opnieuw; hier vangen we dat op.
    }
    setToastNotification({ type: 'error', message: 'Opslaan mislukt. Controleer je verbinding en probeer opnieuw.' });
  };

  const isValidTimeRange = (start: string, end: string) => Boolean(start && end && end > start);

  // Controle: bestaande problemen in de data (alleen lezen)
  const dataIssues = useMemo(
    () => findDataIssues(workEntries, travelEntries, vacationPeriods),
    [workEntries, travelEntries, vacationPeriods]
  );

  // Timer loopt nog na 18:00 (of sinds een vorige dag): eenmalige melding per sessie
  const isTimerLate = useMemo(() => {
    if (!timer.isActive || !timer.startTime) return false;
    const now = new Date(currentTime);
    return now.getHours() >= 18 || toLocalYYYYMMDD(new Date(timer.startTime)) < toLocalYYYYMMDD(now);
  }, [timer.isActive, timer.startTime, currentTime]);
  const lateNotifiedFor = React.useRef<number | null>(null);
  useEffect(() => {
    if (!isTimerLate || !timer.startTime || lateNotifiedFor.current === timer.startTime) return;
    lateNotifiedFor.current = timer.startTime;
    const msg = 'De timer loopt nog na 18:00. Vergeten te stoppen?';
    setToastNotification({ type: 'info', message: msg });
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Tikklok', { body: msg });
      }
    } catch {
      // meldingen niet beschikbaar: de toast en de badge volstaan
    }
  }, [isTimerLate, timer.startTime]);

  // Actions
  const handleStartTimer = async (category: WorkCategory) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        isActive: true,
        startTime: Date.now(),
        category
      }, { merge: true });
    } catch (e) {
      reportError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleStopTimer = async () => {
    if (!user || !timer.startTime) return;
    const now = new Date();
    const startObj = new Date(timer.startTime);
    const entryId = crypto.randomUUID();

    const formatTime = (date: Date) => 
      `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

    const cat = timer.category || 'ict';

    // Splits de sessie per kalenderdag. Vroeger kreeg een sessie over middernacht een eindtijd
    // vóór de starttijd en werd ze als 0 minuten opgeslagen (uren kwijt).
    const segments: { date: string; startTime: string; endTime: string }[] = [];
    const cursor = new Date(startObj);
    while (toLocalYYYYMMDD(cursor) < toLocalYYYYMMDD(now) && segments.length < 14) {
      segments.push({ date: toLocalYYYYMMDD(cursor), startTime: formatTime(cursor), endTime: '23:59' });
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    }
    segments.push({ date: toLocalYYYYMMDD(now), startTime: formatTime(cursor), endTime: formatTime(now) });

    const totalHours = (now.getTime() - startObj.getTime()) / 3_600_000;

    try {
      const userRef = doc(db, 'users', user.uid);
      for (const [i, seg] of segments.entries()) {
        if (seg.endTime <= seg.startTime) continue; // < 1 minuut: niets opslaan
        const id = i === 0 ? entryId : crypto.randomUUID();
        await setDoc(doc(db, 'users', user.uid, 'workEntries', id), {
          id,
          ...seg,
          breakTime: 0,
          category: cat,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      if (totalHours > 12) {
        setToastNotification({
          type: 'info',
          message: `De timer liep ${Math.round(totalHours)} uur. Was je vergeten te stoppen? Controleer de registratie.`
        });
      }
      await setDoc(userRef, {
        isActive: false,
        startTime: null,
        category: null
      }, { merge: true });
    } catch (e) {
      reportError(e, OperationType.WRITE, `users/${user.uid}/workEntries/${entryId}`);
    }
  };

  const handleAddManualWorkEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const entryId = crypto.randomUUID();
    const cat = (formData.get('category') as WorkCategory) || 'ict';
    const desc = (formData.get('description') as string)?.trim();

    const startTime = formData.get('start') as string;
    const endTime = formData.get('end') as string;
    if (!isValidTimeRange(startTime, endTime)) {
      setToastNotification({ type: 'error', message: 'De eindtijd moet na de starttijd liggen.' });
      return;
    }
    const entryDate = formData.get('date') as string;
    const overlapping = findOverlappingEntries({ date: entryDate, startTime, endTime }, workEntries);
    if (overlapping.length > 0 && !window.confirm(`${describeOverlap(entryDate, overlapping)}\n\nToch opslaan?`)) {
      return;
    }

    const newEntry: any = {
      id: entryId,
      date: formData.get('date') as string,
      startTime,
      endTime,
      breakTime: 0,
      category: cat,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (desc) {
      newEntry.description = desc;
    }

    try {
      const entryRef = doc(db, 'users', user.uid, 'workEntries', entryId);
      await setDoc(entryRef, newEntry);
      form.reset();
    } catch (err) {
      reportError(err, OperationType.WRITE, `users/${user.uid}/workEntries/${entryId}`);
    }
  };

  const handleUpdateWorkEntry = async (
    id: string, 
    update: { startTime: string; endTime: string; category: WorkCategory; description?: string }
  ) => {
    if (!user) return;
    if (!isValidTimeRange(update.startTime, update.endTime)) {
      setToastNotification({ type: 'error', message: 'De eindtijd moet na de starttijd liggen. Wijziging niet opgeslagen.' });
      return;
    }
    const original = workEntries.find(e => e.id === id);
    if (original) {
      const overlapping = findOverlappingEntries({ date: original.date, startTime: update.startTime, endTime: update.endTime }, workEntries, id);
      if (overlapping.length > 0 && !window.confirm(`${describeOverlap(original.date, overlapping)}\n\nToch opslaan?`)) {
        return;
      }
    }
    try {
      const entryRef = doc(db, 'users', user.uid, 'workEntries', id);
      const payload: any = {
        startTime: update.startTime,
        endTime: update.endTime,
        category: update.category,
        updatedAt: serverTimestamp()
      };
      if (update.description !== undefined) {
        payload.description = update.description;
      }
      await updateDoc(entryRef, payload);
    } catch (e) {
      reportError(e, OperationType.UPDATE, `users/${user.uid}/workEntries/${id}`);
    }
  };

  const handleDeleteWorkEntry = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'workEntries', id));
    } catch (e) {
      reportError(e, OperationType.DELETE, `users/${user.uid}/workEntries/${id}`);
    }
  };

  const handleAddTravelEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const entryId = crypto.randomUUID();

    const distance = Number(formData.get('distance'));
    const description = ((formData.get('description') as string) || '').trim();
    if (!Number.isFinite(distance) || distance <= 0 || distance > 1000) {
      setToastNotification({ type: 'error', message: 'Ongeldige afstand. Kies een ander traject of vul de afstand in.' });
      return;
    }

    const newEntry = {
      id: entryId,
      date: formData.get('date') as string,
      description,
      distance: Math.round(distance * 10) / 10,
      type: formData.get('type') as any,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'users', user.uid, 'travelEntries', entryId), newEntry);
      form.reset();
    } catch (err) {
      reportError(err, OperationType.WRITE, `users/${user.uid}/travelEntries/${entryId}`);
    }
  };

  const handleDeleteTravelEntry = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'travelEntries', id));
    } catch (e) {
      reportError(e, OperationType.DELETE, `users/${user.uid}/travelEntries/${id}`);
    }
  };

  const handleAddSickDays = async (data: {
    startDate: string;
    endDate?: string;
    isPeriod: boolean;
    description?: string;
  }) => {
    if (!user) {
      setToastNotification({
        type: 'error',
        message: 'Meld je eerst aan met je Google-account om ziektedagen op te slaan.'
      });
      return;
    }

    try {
      const datesToRegister: string[] = [];
      if (!data.isPeriod || !data.endDate || data.startDate === data.endDate) {
        datesToRegister.push(data.startDate);
      } else {
        const cur = new Date(data.startDate + 'T00:00:00');
        const end = new Date(data.endDate + 'T00:00:00');
        let count = 0;
        while (cur <= end && count < 400) {
          count++;
          const dayOfWeek = cur.getDay();
          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            datesToRegister.push(toLocalYYYYMMDD(cur));
          }
          cur.setDate(cur.getDate() + 1);
        }
      }

      if (datesToRegister.length === 0) {
        setToastNotification({
          type: 'error',
          message: 'Geen schooldagen (ma-vr) gevonden in de geselecteerde periode.'
        });
        return;
      }

      const newDates = datesToRegister.filter(dateStr => !freeDays.some(fd => fd.date === dateStr && fd.type === 'ziek'));
      if (newDates.length === 0) {
        setToastNotification({ type: 'info', message: 'Deze ziektedag(en) waren al geregistreerd.' });
        return;
      }

      const batchPromises = newDates.map(async (dateStr) => {
        const id = crypto.randomUUID();
        const payload: any = {
          id,
          date: dateStr,
          type: 'ziek',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        if (data.description?.trim()) {
          payload.description = data.description.trim();
        }
        return setDoc(doc(db, 'users', user.uid, 'freeDays', id), payload);
      });

      await Promise.all(batchPromises);
      setToastNotification({
        type: 'success',
        message: `${newDates.length} ${newDates.length === 1 ? 'ziektedag' : 'ziektedagen'} succesvol geregistreerd!`
      });
    } catch (err) {
      reportError(err, OperationType.WRITE, `users/${user.uid}/freeDays`);
    }
  };

  const handleAddFreeDay = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setToastNotification({
        type: 'error',
        message: 'Meld je eerst aan met je Google-account om vrije dagen op te slaan.'
      });
      return;
    }
    const form = e.currentTarget;
    const formData = new FormData(form);
    const id = crypto.randomUUID();
    const desc = (formData.get('description') as string)?.trim() || undefined;

    const newEntry: any = {
      id,
      date: formData.get('date') as string,
      type: formData.get('type') as any,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (desc) {
      newEntry.description = desc;
    }

    try {
      await setDoc(doc(db, 'users', user.uid, 'freeDays', id), newEntry);
      form.reset();
      setToastNotification({
        type: 'success',
        message: 'Vrije dag / afwezigheid succesvol geregistreerd!'
      });
    } catch (err) {
      reportError(err, OperationType.WRITE, `users/${user.uid}/freeDays/${id}`);
    }
  };

  const handleDeleteFreeDay = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'freeDays', id));
      setToastNotification({
        type: 'info',
        message: 'Item succesvol verwijderd.'
      });
    } catch (e) {
      reportError(e, OperationType.DELETE, `users/${user.uid}/freeDays/${id}`);
    }
  };

  const handleAddVacationPeriod = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setToastNotification({
        type: 'error',
        message: 'Meld je eerst aan met je Google-account om vakanties op te slaan.'
      });
      return;
    }
    const form = e.currentTarget;
    const formData = new FormData(form);
    const id = crypto.randomUUID();

    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    if (!startDate || !endDate || endDate < startDate) {
      setToastNotification({ type: 'error', message: 'De einddatum van de vakantie ligt vóór de startdatum.' });
      return;
    }

    const newEntry = {
      id,
      startDate,
      endDate,
      description: formData.get('description') as string,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'users', user.uid, 'vacationPeriods', id), newEntry);
      form.reset();
      setToastNotification({
        type: 'success',
        message: 'Vakantieperiode succesvol opgeslagen!'
      });
    } catch (err) {
      reportError(err, OperationType.WRITE, `users/${user.uid}/vacationPeriods/${id}`);
    }
  };

  const handleDeleteVacationPeriod = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'vacationPeriods', id));
    } catch (e) {
      reportError(e, OperationType.DELETE, `users/${user.uid}/vacationPeriods/${id}`);
    }
  };

  const progressPercent = currentWeekTargetInfo.targetMin > 0
    ? (currentWeekIctMin / currentWeekTargetInfo.targetMin) * 100
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)] text-[var(--text-muted)] text-sm">
        Applicatie laden...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text-main)] py-4 sm:py-10 px-4 sm:px-6 overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Top Header & Stats */}
        <HeaderStats
          user={user}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          onLogin={signInWithGoogle}
          onLogout={logout}
          schoolYear={currentSchoolYear}
          targetMin={currentWeekTargetInfo.targetMin}
          reductionMin={currentWeekTargetInfo.reductionMin}
          sickReductionMin={currentWeekTargetInfo.sickReductionMin}
          teachingTargetMin={currentWeekTargetInfo.teachingTargetMin}
          totalWorkedMin={currentWeekTotalMin}
          ictWorkedMin={currentWeekIctMin}
          waiWorkedMin={currentWeekWaiMin}
          teachingWorkedMin={currentWeekTeachingMin}
          overtimeBalance={currentOvertimeBalance}
          weekBalanceMin={currentWeekData?.balanceMin ?? 0}
          teachingWeekBalanceMin={currentWeekData?.teachingBalanceMin ?? 0}
          teachingBalance={currentYearData?.teachingBalance ?? 0}
          currentMonthKm={currentMonthKm}
          currentMonthTravelComp={currentMonthTravelComp}
          currentMonthName={currentMonthName}
          scheduleConfig={scheduleConfig}
          onOpenScheduleConfig={() => setIsScheduleModalOpen(true)}
          onOpenSickLeaveModal={() => setIsSickModalOpen(true)}
          timerSlot={
            <TimerCard
              timer={timer}
              liveMinutes={liveMinutes}
              onStartTimer={handleStartTimer}
              onStopTimer={handleStopTimer}
              isLate={isTimerLate}
            />
          }
        />

        {/* Tabs: echte knoppen met role="tab", passen op 375 px */}
        <div
          role="tablist"
          aria-label="Onderdelen"
          className="grid grid-cols-3 gap-1.5 mb-6 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-[var(--panel-border)]"
        >
          {TABS.map(tab => {
            const selected = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => {
                  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                  const idx = TABS.findIndex(t => t.id === tab.id);
                  const next = TABS[(idx + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
                  setActiveTab(next.id);
                  document.getElementById(`tab-${next.id}`)?.focus();
                }}
                className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all min-w-0 ${
                  selected
                    ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'
                    : 'text-[var(--text-muted)] hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate sm:hidden">{tab.short}</span>
                <span className="truncate hidden sm:inline">
                  {tab.long}{tab.id === 'travel' ? ` (${travelEntries.length})` : ''}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Body Content */}
        <div>
          {activeTab === 'hours' && (
            <div role="tabpanel" id="panel-hours" aria-labelledby="tab-hours" className="space-y-8">
              <HoursTab
                currentWeekTotalMin={currentWeekTotalMin}
                currentWeekIctMin={currentWeekIctMin}
                currentWeekTeachingMin={currentWeekTeachingMin}
                currentWeekWaiMin={currentWeekWaiMin}
                currentTargetMinutes={currentWeekTargetInfo.targetMin}
                currentTargetUpToMin={currentWeekData?.targetMin ?? 0}
                currentWeekBalanceMin={currentWeekData?.balanceMin ?? 0}
                progressPercent={progressPercent}
                onAddManualWorkEntry={handleAddManualWorkEntry}
                onAddFreeDay={handleAddFreeDay}
                onAddVacationPeriod={handleAddVacationPeriod}
                defaultDate={defaultToday}
                scheduleConfig={scheduleConfig}
              />

              <ChecksPanel issues={dataIssues} />

              <WorkEntryList
                workEntries={workEntries}
                freeDays={freeDays}
                vacationPeriods={vacationPeriods}
                onDeleteWorkEntry={handleDeleteWorkEntry}
                onUpdateWorkEntry={handleUpdateWorkEntry}
                onDeleteFreeDay={handleDeleteFreeDay}
                onDeleteVacationPeriod={handleDeleteVacationPeriod}
                scheduleConfig={scheduleConfig}
              />
            </div>
          )}

          {activeTab === 'travel' && (
            <div role="tabpanel" id="panel-travel" aria-labelledby="tab-travel">
            <TravelTab
              travelEntries={travelEntries}
              currentSchoolYear={currentSchoolYear}
              onAddTravelEntry={handleAddTravelEntry}
              onDeleteTravelEntry={handleDeleteTravelEntry}
              defaultDate={defaultToday}
            />
            </div>
          )}

          {activeTab === 'reports' && (
            <div role="tabpanel" id="panel-reports" aria-labelledby="tab-reports">
            <ReportsTab
              schoolYearsData={schoolYearsData}
              monthlyData={monthlyData}
              lastThreeWeeks={lastThreeWeeks}
              workEntries={workEntries}
              travelEntries={travelEntries}
              scheduleConfig={scheduleConfig}
            />
            </div>
          )}
        </div>

        {/* Customizable Schedule & Allocation Modal */}
        <ScheduleConfigModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          config={scheduleConfig}
          onSave={handleSaveScheduleConfig}
        />

        {/* Dedicated Sick Leave Modal */}
        <SickLeaveModal
          isOpen={isSickModalOpen}
          onClose={() => setIsSickModalOpen(false)}
          onSaveSickDays={handleAddSickDays}
          defaultDate={defaultToday}
          scheduleConfig={scheduleConfig}
        />

        {/* Floating Toast Notification */}
        {toastNotification && (
          <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md animate-fadeIn text-xs font-semibold max-w-md transition-all ${
            toastNotification.type === 'success'
              ? 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
              : toastNotification.type === 'error'
              ? 'bg-red-50/95 dark:bg-red-950/90 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100'
              : 'bg-sky-50/95 dark:bg-sky-950/90 border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-100'
          }`}>
            {toastNotification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
            {toastNotification.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />}
            <span className="flex-1">{toastNotification.message}</span>
            <button
              onClick={() => setToastNotification(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
