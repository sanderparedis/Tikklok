import * as XLSX from 'xlsx';
import { Clock, Car, ChevronRight, ChevronDown, Trash2, MapPin, Briefcase, BarChart3, Download, LogIn, LogOut, Sun, Moon, GraduationCap, School, Pencil, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useMemo } from 'react';
import { auth, db, signInWithGoogle, logout, OperationType, handleFirestoreError } from './lib/firebase';
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
  getDoc,
  updateDoc
} from 'firebase/firestore';

// --- Types ---

type TransportType = 'auto' | 'fiets';
type TabType = 'hours' | 'travel' | 'reports';

interface WorkEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  breakTime: number; // minutes
}

interface TravelEntry {
  id: string;
  date: string;
  description: string;
  distance: number; // km
  type: TransportType;
}

interface TimerState {
  isActive: boolean;
  startTime: number | null;
}

type FreeDayType = 'vrije/facultatieve dag' | 'ziek' | 'feestdag';

interface FreeDay {
  id: string;
  date: string;
  type: FreeDayType;
}

interface VacationPeriod {
  id: string;
  startDate: string;
  endDate: string;
  description: string;
}

const TRANSPORT_RATES: Record<TransportType, number> = {
  auto: 0.4004,
  fiets: 0.21
};

const LOCATIONS = ['Neeroeteren', 'Campus', 'Kinrooi', 'Maaseik'];

const ROUTE_DISTANCES: Record<string, Record<string, number>> = {
  'Neeroeteren': { 'Campus': 7.7, 'Kinrooi': 7.7, 'Maaseik': 8.2 },
  'Campus': { 'Neeroeteren': 7.7, 'Kinrooi': 5.4, 'Maaseik': 2.1 },
  'Kinrooi': { 'Neeroeteren': 7.7, 'Campus': 5.4, 'Maaseik': 7.0 },
  'Maaseik': { 'Neeroeteren': 8.2, 'Campus': 2.1, 'Kinrooi': 7.0 }
};

// --- Helpers ---

const calculateDuration = (start: string, end: string, pause: number): number => {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  const totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1) - pause;
  return Math.max(0, totalMinutes);
};

const formatMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h}u ${m}m`;
};

const formatTimer = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.floor((minutes * 60) % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const toLocalYYYYMMDD = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const isSummerDate = (dateStr: string): boolean => {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth(); // 0 = Jan, 5 = June, 6 = July, 7 = Aug
  return month === 6 || month === 7;
};

const isWeekFullySummer = (mondayStr: string): boolean => {
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

const getSchoolYearForDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 = Jan, 5 = June, 6 = July
  
  if (month >= 6) { // July (6) to December (11)
    return `${year}-${year + 1}`;
  } else { // January (0) to June (5)
    return `${year - 1}-${year}`;
  }
};

const formatWeekLabel = (mondayStr: string): string => {
  const d = new Date(mondayStr + 'T00:00:00');
  const startStr = d.toLocaleDateString('nl', { day: 'numeric', month: 'short' });
  const end = new Date(d);
  end.setDate(d.getDate() + 4); // Friday
  const endStr = end.toLocaleDateString('nl', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startStr} t/m ${endStr}`;
};

const calculateWeekTarget = (
  mondayStr: string, 
  freeDays: FreeDay[], 
  vacationPeriods: VacationPeriod[]
): { targetMin: number, reductionMin: number, freeDaysCount: number, summerDaysCount: number } => {
  const mon = new Date(mondayStr + 'T00:00:00');
  let targetMin = 36 * 60;
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
      const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
      if (dayOfWeek === 3) { // Wednesday is 4 hours
        reductionMin += 4 * 60;
      } else { // other weekdays are 8 hours
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
    targetMin: Math.max(0, targetMin - reductionMin),
    reductionMin,
    freeDaysCount,
    summerDaysCount
  };
};

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('hours');
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [travelEntries, setTravelEntries] = useState<TravelEntry[]>([]);
  const [freeDays, setFreeDays] = useState<FreeDay[]>([]);
  const [vacationPeriods, setVacationPeriods] = useState<VacationPeriod[]>([]);
  const [vacationStart, setVacationStart] = useState<string>(() => toLocalYYYYMMDD(new Date()));
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Dark mode effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Timer State
  const [timer, setTimer] = useState<TimerState>({
    isActive: false,
    startTime: null
  });

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ startTime: string; endTime: string } | null>(null);

  const [currentTime, setCurrentTime] = useState(Date.now());
  const [travelRouteType, setTravelRouteType] = useState<string>('preset');
  const [startLocation, setStartLocation] = useState<string>(LOCATIONS[0]);
  const [endLocation, setEndLocation] = useState<string>(LOCATIONS[1]);
  const [expandedSchoolYear, setExpandedSchoolYear] = useState<string | null>(null);

  // Auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Sync Timer from Firestore
  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    return onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setTimer({
          isActive: data.isActive || false,
          startTime: data.startTime || null
        });
      }
    }, (error) => {
       // Only log if it's not a missing doc (expected on first login)
       if (error.code !== 'permission-denied') {
         handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
       }
    });
  }, [user]);

  // Sync work entries
  useEffect(() => {
    if (!user) {
      setWorkEntries([]);
      return;
    }
    const q = collection(db, 'users', user.uid, 'workEntries');
    return onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ ...doc.data() } as WorkEntry));
      const sorted = [...entries].sort((a, b) => {
        const dateA = new Date(a.date + 'T00:00:00').getTime();
        const dateB = new Date(b.date + 'T00:00:00').getTime();
        if (dateA !== dateB) return dateB - dateA;
        return (b.startTime || '').localeCompare(a.startTime || '');
      });
      setWorkEntries(sorted);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/workEntries`));
  }, [user]);

  // Sync travel entries
  useEffect(() => {
    if (!user) {
      setTravelEntries([]);
      return;
    }
    const q = collection(db, 'users', user.uid, 'travelEntries');
    return onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ ...doc.data() } as TravelEntry));
      const sorted = [...entries].sort((a, b) => {
        const dateA = new Date(a.date + 'T00:00:00').getTime();
        const dateB = new Date(b.date + 'T00:00:00').getTime();
        return dateB - dateA;
      });
      setTravelEntries(sorted);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/travelEntries`));
  }, [user]);

  // Sync free days
  useEffect(() => {
    if (!user) {
      setFreeDays([]);
      return;
    }
    const q = collection(db, 'users', user.uid, 'freeDays');
    return onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ ...doc.data() } as FreeDay));
      const sorted = [...entries].sort((a, b) => {
        const dateA = new Date(a.date + 'T00:00:00').getTime();
        const dateB = new Date(b.date + 'T00:00:00').getTime();
        return dateB - dateA;
      });
      setFreeDays(sorted);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/freeDays`));
  }, [user]);

  // Sync vacation periods
  useEffect(() => {
    if (!user) {
      setVacationPeriods([]);
      return;
    }
    const q = collection(db, 'users', user.uid, 'vacationPeriods');
    return onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ ...doc.data() } as VacationPeriod));
      const sorted = [...entries].sort((a, b) => b.startDate.localeCompare(a.startDate));
      setVacationPeriods(sorted);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/vacationPeriods`));
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const exportToExcel = (monthKey: string) => {
    // Filter entries for the selected month using the same key generator as groupedMonthlyData
    const getMonthKey = (dateStr: string) => new Date(dateStr + 'T00:00:00').toLocaleString('nl', { month: 'long', year: 'numeric' });

    const monthWork = workEntries.filter(e => getMonthKey(e.date) === monthKey && !isSummerDate(e.date));
    const monthTravel = travelEntries.filter(e => getMonthKey(e.date) === monthKey);

    // Create Work Sheet
    const workData = monthWork.map(e => ({
      Datum: e.date,
      Start: e.startTime,
      Einde: e.endTime,
      Pauze: e.breakTime,
      TotaalMin: calculateDuration(e.startTime, e.endTime, e.breakTime),
      TotaalUren: formatMonoTime(calculateDuration(e.startTime, e.endTime, e.breakTime))
    }));

    // Create Travel Sheet
    const travelData = monthTravel.map(e => ({
      Datum: e.date,
      Traject: e.description,
      Type: e.type,
      Afstand: e.distance,
      Vergoeding: (e.distance * (TRANSPORT_RATES[e.type] || 0)).toFixed(4)
    }));

    const wb = XLSX.utils.book_new();
    const wsWork = XLSX.utils.json_to_sheet(workData);
    const wsTravel = XLSX.utils.json_to_sheet(travelData);

    XLSX.utils.book_append_sheet(wb, wsWork, "Uren");
    XLSX.utils.book_append_sheet(wb, wsTravel, "Verplaatsingen");

    XLSX.writeFile(wb, `Overzicht_${monthKey.replace(/[\s,]+/g, '_')}.xlsx`);
  };

  const groupedMonthlyData = useMemo(() => {
    const groups: Record<string, { workMin: number, travelComp: number, travelKm: number }> = {};
    
    const getMonthKey = (dateStr: string) => new Date(dateStr + 'T00:00:00').toLocaleString('nl', { month: 'long', year: 'numeric' });

    workEntries.forEach(e => {
      if (isSummerDate(e.date)) return;
      const key = getMonthKey(e.date);
      if (!groups[key]) groups[key] = { workMin: 0, travelComp: 0, travelKm: 0 };
      groups[key].workMin += calculateDuration(e.startTime, e.endTime, e.breakTime);
    });

    travelEntries.forEach(e => {
      const key = getMonthKey(e.date);
      if (!groups[key]) groups[key] = { workMin: 0, travelComp: 0, travelKm: 0 };
      groups[key].travelKm += e.distance;
      groups[key].travelComp += e.distance * (TRANSPORT_RATES[e.type] || 0);
    });

    return Object.entries(groups).sort((a, b) => {
      // Sort keys descending (newest first)
      const parse = (k: string) => {
        const parts = k.replace(',', '').split(' ');
        const m = parts[0];
        const y = parts[parts.length - 1]; // Year is usually last
        const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
        const monthIdx = months.indexOf(m.toLowerCase());
        return new Date(Number(y), monthIdx !== -1 ? monthIdx : 0, 1).getTime();
      };
      return parse(b[0]) - parse(a[0]);
    });
  }, [workEntries, travelEntries]);

  const currentWeekWorkMin = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    return workEntries
      .filter(e => {
        const entryDate = new Date(e.date + 'T00:00:00');
        return entryDate >= startOfWeek && !isSummerDate(e.date);
      })
      .reduce((acc, entry) => acc + calculateDuration(entry.startTime, entry.endTime, entry.breakTime), 0);
  }, [workEntries]);

  const liveMinutes = useMemo(() => {
    if (!timer.isActive || !timer.startTime) return 0;
    return (currentTime - timer.startTime) / 60000;
  }, [timer, currentTime]);

  const combinedEntries = useMemo(() => {
    const combined: (
      | ({ entryType: 'work' } & WorkEntry)
      | ({ entryType: 'free' } & FreeDay)
    )[] = [
      ...workEntries.map(e => ({ ...e, entryType: 'work' as const })),
      ...freeDays.map(e => ({ ...e, entryType: 'free' as const })),
    ];

    return combined.sort((a, b) => {
      const dateA = new Date(a.date + 'T00:00:00').getTime();
      const dateB = new Date(b.date + 'T00:00:00').getTime();
      if (dateA !== dateB) return dateB - dateA;
      
      // If same date, work entries might have startTime, free days don't really have a secondary sort priority
      const startA = (a as any).startTime || '';
      const startB = (b as any).startTime || '';
      return startB.localeCompare(startA);
    });
  }, [workEntries, freeDays]);

  const totalKmForMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return travelEntries
      .filter(entry => {
        const d = new Date(entry.date + 'T00:00:00');
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((acc, entry) => acc + entry.distance, 0);
  }, [travelEntries]);

  const totalCompForMonth = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return travelEntries
      .filter(entry => {
        const d = new Date(entry.date + 'T00:00:00');
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((acc, entry) => acc + (entry.distance * (TRANSPORT_RATES[entry.type] || 0)), 0);
  }, [travelEntries]);

  const { currentTargetMinutes, weeklyFreeDays } = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const mondayStr = toLocalYYYYMMDD(startOfWeek);

    const { targetMin } = calculateWeekTarget(mondayStr, freeDays, vacationPeriods);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const weekFreeDays = freeDays.filter(fd => {
      const d = new Date(fd.date + 'T00:00:00');
      return d >= startOfWeek && d < endOfWeek;
    });

    return { 
      currentTargetMinutes: targetMin,
      weeklyFreeDays: weekFreeDays
    };
  }, [freeDays, vacationPeriods]);

  const progressPercent = currentTargetMinutes > 0 
    ? Math.min(100, ((currentWeekWorkMin + liveMinutes) / currentTargetMinutes) * 100) 
    : 0;

  const schoolYearsData = useMemo(() => {
    const yearsMap: Record<string, { workedMin: number; targetMin: number; weeks: Record<string, { worked: number; target: number }> }> = {};

    const getWeekKey = (dateStr: string) => {
      const d = new Date(dateStr + 'T00:00:00');
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(d);
      start.setDate(diff);
      return toLocalYYYYMMDD(start);
    };

    const currentWeekKey = getWeekKey(toLocalYYYYMMDD(new Date()));

    // Collect all weeks with work entries, free days, or the current week
    const allWeekKeys = new Set<string>();
    workEntries.forEach(e => {
      const wk = getWeekKey(e.date);
      if (!isWeekFullySummer(wk)) {
        allWeekKeys.add(wk);
      }
    });
    freeDays.forEach(fd => {
      const wk = getWeekKey(fd.date);
      if (!isWeekFullySummer(wk)) {
        allWeekKeys.add(wk);
      }
    });
    if (!isWeekFullySummer(currentWeekKey)) {
      allWeekKeys.add(currentWeekKey);
    }

    allWeekKeys.forEach(weekKey => {
      const schoolYear = getSchoolYearForDate(weekKey);
      if (!yearsMap[schoolYear]) {
        yearsMap[schoolYear] = { workedMin: 0, targetMin: 0, weeks: {} };
      }

      let worked = workEntries
        .filter(e => getWeekKey(e.date) === weekKey && !isSummerDate(e.date))
        .reduce((acc, entry) => acc + calculateDuration(entry.startTime, entry.endTime, entry.breakTime), 0);

      if (weekKey === currentWeekKey) {
        const today = new Date();
        const m = today.getMonth();
        if (m !== 6 && m !== 7) {
          worked += liveMinutes;
        }
      }

      const { targetMin } = calculateWeekTarget(weekKey, freeDays, vacationPeriods);

      yearsMap[schoolYear].weeks[weekKey] = { worked, target: targetMin };
    });

    return Object.entries(yearsMap).map(([schoolYear, data]) => {
      let totalWorked = 0;
      let totalTarget = 0;
      let completedOvertime = 0;
      let activeOvertime = 0;

      const weeks = Object.entries(data.weeks).map(([weekKey, weekData]) => {
        const { reductionMin, freeDaysCount, summerDaysCount } = calculateWeekTarget(weekKey, freeDays, vacationPeriods);
        return {
          weekKey,
          worked: weekData.worked,
          target: weekData.target,
          reductionMin,
          freeDaysCount,
          summerDaysCount,
          balance: weekData.worked - weekData.target
        };
      })
      .filter(w => !isWeekFullySummer(w.weekKey))
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey));

      Object.entries(data.weeks).forEach(([weekKey, weekData]) => {
        totalWorked += weekData.worked;
        totalTarget += weekData.target;

        if (weekKey < currentWeekKey) {
          completedOvertime += (weekData.worked - weekData.target);
        } else if (weekKey === currentWeekKey) {
          activeOvertime = (weekData.worked - weekData.target);
        }
      });

      const isCurrent = schoolYear === getSchoolYearForDate(new Date().toISOString().split('T')[0]);

      return {
        schoolYear,
        totalWorked,
        totalTarget,
        overtimeBalance: completedOvertime,
        activeOvertime,
        isCurrent,
        weeksCount: Object.keys(data.weeks).length,
        weeks
      };
    }).sort((a, b) => b.schoolYear.localeCompare(a.schoolYear));
  }, [workEntries, freeDays, vacationPeriods, liveMinutes]);

  const currentSchoolYear = useMemo(() => {
    return getSchoolYearForDate(new Date().toISOString().split('T')[0]);
  }, []);

  const overtimeBalance = useMemo(() => {
    const currentYearData = schoolYearsData.find(y => y.schoolYear === currentSchoolYear);
    return currentYearData ? currentYearData.overtimeBalance : 0;
  }, [schoolYearsData, currentSchoolYear]);

  const lastThreeWeeks = useMemo(() => {
    const getMonday = (d: Date) => {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(d);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      return start;
    };

    const currentMonday = getMonday(new Date());
    const weeksList = [];
    
    for (let i = 0; i < 3; i++) {
      const mon = new Date(currentMonday);
      mon.setDate(currentMonday.getDate() - (i * 7));
      
      const fri = new Date(mon);
      fri.setDate(mon.getDate() + 4); // Friday
      
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6); // Sunday to cover full calendar week
      
      weeksList.push({
        mondayDate: mon,
        fridayDate: fri,
        sundayDate: sun,
        key: mon.toISOString().split('T')[0]
      });
    }
    
    return weeksList.map(({ mondayDate, fridayDate, sundayDate, key }) => {
      const weekWork = workEntries.filter(e => {
        const d = new Date(e.date + 'T00:00:00');
        return d >= mondayDate && d <= sundayDate && !isSummerDate(e.date);
      });
      
      let workedMin = weekWork.reduce((acc, entry) => acc + calculateDuration(entry.startTime, entry.endTime, entry.breakTime), 0);
      
      const currentWeekKey = currentMonday.toISOString().split('T')[0];
      const isCurrentWeek = key === currentWeekKey;
      if (isCurrentWeek) {
        workedMin += liveMinutes;
      }
      
      const { targetMin, reductionMin, freeDaysCount } = calculateWeekTarget(key, freeDays, vacationPeriods);
      const overtimeMin = workedMin - targetMin;
      
      const formatDateLabel = (mon: Date, fri: Date) => {
        const monStr = mon.toLocaleDateString('nl', { day: 'numeric', month: 'short' });
        const friStr = fri.toLocaleDateString('nl', { day: 'numeric', month: 'short' });
        return `${monStr} t/m ${friStr}`;
      };
      
      return {
        key,
        label: isCurrentWeek ? 'Deze week' : `Week van ${mondayDate.toLocaleDateString('nl', { day: 'numeric', month: 'short' })}`,
        range: formatDateLabel(mondayDate, fridayDate),
        workedMin,
        targetMin,
        overtimeMin,
        isCurrentWeek,
        reductionMinutes: reductionMin,
        freeDaysCount: freeDaysCount
      };
    });
  }, [workEntries, freeDays, vacationPeriods, liveMinutes]);

  const startTimer = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        isActive: true,
        startTime: timer.startTime || Date.now(),
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const stopTimer = async () => {
    if (!user || !timer.startTime) return;
    
    const now = new Date();
    const startObj = new Date(timer.startTime);
    const entryId = crypto.randomUUID();
    
    const formatTime = (date: Date) => 
      `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

    const newEntry = {
      id: entryId,
      date: startObj.toISOString().split('T')[0],
      startTime: formatTime(startObj),
      endTime: formatTime(now),
      breakTime: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const workEntryRef = doc(db, 'users', user.uid, 'workEntries', entryId);
      const userRef = doc(db, 'users', user.uid);
      
      await setDoc(workEntryRef, newEntry);
      await setDoc(userRef, {
        isActive: false,
        startTime: null,
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/workEntries/${entryId}`);
    }
  };

  const addWorkEntryManual = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const entryId = crypto.randomUUID();
    
    const newEntry = {
      id: entryId,
      date: formData.get('date') as string,
      startTime: formData.get('start') as string,
      endTime: formData.get('end') as string,
      breakTime: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const entryRef = doc(db, 'users', user.uid, 'workEntries', entryId);
      await setDoc(entryRef, newEntry);
      form.reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/workEntries/${entryId}`);
    }
  };

  const addTravelEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const routeCategory = formData.get('routeCategory') as string;
    const isReturn = formData.get('return') === 'on';
    const transportType = formData.get('type') as TransportType;
    
    let distance = 0;
    let description = "";
    let finalType = transportType;

    if (routeCategory === "nascholing") {
      const enkel = Number(formData.get('distance_manual'));
      distance = enkel * 2;
      description = `Nascholing (H&T)`;
      finalType = 'auto';
    } else if (routeCategory === "woonwerk_fiets") {
      const enkel = Number(formData.get('distance_manual'));
      distance = enkel * 2;
      description = `Woon-werkverkeer Fiets (H&T)`;
      finalType = 'fiets';
    } else if (routeCategory === "custom") {
      const dist = Number(formData.get('distance_manual'));
      distance = dist * (isReturn ? 2 : 1);
      const customDesc = formData.get('custom_description') as string;
      description = `${customDesc || 'Aangepast traject'} ${isReturn ? '(H&T)' : ''}`;
      finalType = transportType;
    } else {
      const start = formData.get('startLocation') as string;
      const end = formData.get('endLocation') as string;
      const baseDistance = ROUTE_DISTANCES[start]?.[end] || 0;
      
      distance = baseDistance * (isReturn ? 2 : 1);
      description = `${start} - ${end} ${isReturn ? '(H&T)' : ''}`;
      finalType = transportType;
    }

    const entryId = crypto.randomUUID();
    const newEntry = {
      id: entryId,
      date: formData.get('date') as string,
      description,
      distance,
      type: finalType,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const entryRef = doc(db, 'users', user.uid, 'travelEntries', entryId);
      await setDoc(entryRef, newEntry);
      form.reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/travelEntries/${entryId}`);
    }
  };

  const addFreeDay = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const dayId = crypto.randomUUID();
    
    const newEntry = {
      id: dayId,
      date: formData.get('date') as string,
      type: formData.get('type') as FreeDayType,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const entryRef = doc(db, 'users', user.uid, 'freeDays', dayId);
      await setDoc(entryRef, newEntry);
      form.reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/freeDays/${dayId}`);
    }
  };

  const deleteWork = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'workEntries', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/workEntries/${id}`);
    }
  };

  const updateWorkEntry = async (id: string) => {
    if (!user || !editValues) return;
    try {
      const entryRef = doc(db, 'users', user.uid, 'workEntries', id);
      await updateDoc(entryRef, {
        startTime: editValues.startTime,
        endTime: editValues.endTime,
        updatedAt: serverTimestamp(),
      });
      setEditingEntryId(null);
      setEditValues(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/workEntries/${id}`);
    }
  };

  const startEditing = (entry: WorkEntry) => {
    setEditingEntryId(entry.id);
    setEditValues({
      startTime: entry.startTime,
      endTime: entry.endTime
    });
  };

  const deleteTravel = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'travelEntries', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/travelEntries/${id}`);
    }
  };

  const deleteFreeDay = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'freeDays', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/freeDays/${id}`);
    }
  };

  const addVacationPeriod = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const id = crypto.randomUUID();
    
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const description = formData.get('description') as string;

    if (startDate > endDate) {
      return;
    }

    const newEntry = {
      id,
      startDate,
      endDate,
      description: description || 'Vakantie',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const entryRef = doc(db, 'users', user.uid, 'vacationPeriods', id);
      await setDoc(entryRef, newEntry);
      form.reset();
      setVacationStart(toLocalYYYYMMDD(new Date()));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/vacationPeriods/${id}`);
    }
  };

  const deleteVacationPeriod = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'vacationPeriods', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/vacationPeriods/${id}`);
    }
  };

  const formatMonoTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.floor(totalMinutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
          <p className="text-slate-400 font-medium animate-pulse">Laden...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg p-4 flex-col gap-6">
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="fixed top-8 right-8 p-3 card-panel text-brand-primary hover:text-brand-primary active:scale-95 transition-all"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="w-full max-w-md">
          <div className="card-panel p-8 text-center flex flex-col gap-8 shadow-2xl shadow-brand-primary/10">
            <div className="flex justify-center">
              <div className="w-24 h-24 bg-gradient-to-tr from-brand-primary to-brand-secondary rounded-[2rem] flex items-center justify-center text-slate-100 shadow-2xl shadow-brand-primary/20 rotate-3 group">
                <School size={48} className="group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-black text-[var(--text-main)] mb-2 tracking-tight">Werktijd</h1>
              <p className="text-[var(--text-muted)] font-medium">Mosa-RT • Professionaliteit & Talent</p>
            </div>
            <button 
              onClick={signInWithGoogle}
              className="btn-primary w-full py-5 flex items-center justify-center gap-3 text-lg group border-none shadow-xl"
            >
              <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
              Inloggen met Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-brand-bg text-[var(--text-main)] font-sans h-screen overflow-hidden">
      {/* Sidebar Nav */}
      <aside className="w-16 md:w-20 bg-brand-sidebar flex flex-col items-center py-6 md:py-8 gap-8 md:gap-10 shrink-0 z-50">
        <div className="flex flex-col items-center gap-1 group">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-[var(--panel-bg)] rounded-xl flex items-center justify-center text-brand-primary font-bold text-xl md:text-2xl shadow-xl shadow-brand-primary/10 overflow-hidden border-2 border-brand-primary/20 transition-colors">
            <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-tr from-brand-primary to-brand-secondary/80">
              <School className="text-slate-100 w-6 h-6 md:w-7 md:h-7" />
            </div>
          </div>
          <span className="text-[8px] font-black tracking-tighter text-slate-100/40 uppercase group-hover:text-slate-100/80 transition-colors">Mosa-RT</span>
        </div>
        
        <nav className="flex flex-col gap-6 md:gap-8 flex-1">
          <button 
            id="nav-hours"
            onClick={() => setActiveTab('hours')}
            className={`p-2.5 md:p-3 rounded-lg transition-all ${activeTab === 'hours' ? 'bg-brand-primary/20 text-brand-primary scale-110 shadow-[0_0_15px_rgba(31,95,122,0.1)]' : 'text-slate-500 hover:text-slate-200'}`}
            title="Tijdregistratie"
          >
            <Clock size={20} className="md:w-6 md:h-6" />
          </button>
          <button 
            id="nav-travel"
            onClick={() => setActiveTab('travel')}
            className={`p-2.5 md:p-3 rounded-lg transition-all ${activeTab === 'travel' ? 'bg-brand-primary/20 text-brand-primary scale-110 shadow-[0_0_15px_rgba(31,95,122,0.1)]' : 'text-slate-500 hover:text-slate-200'}`}
            title="Verplaatsingen"
          >
            <Car size={20} className="md:w-6 md:h-6" />
          </button>
          <button 
            id="nav-reports"
            onClick={() => setActiveTab('reports')}
            className={`p-2.5 md:p-3 rounded-lg transition-all ${activeTab === 'reports' ? 'bg-brand-primary/20 text-brand-primary scale-110 shadow-[0_0_15px_rgba(31,95,122,0.1)]' : 'text-slate-500 hover:text-slate-200'}`}
            title="Rapporten"
          >
            <BarChart3 size={20} className="md:w-6 md:h-6" />
          </button>

          <div className="mt-8 flex flex-col gap-4 border-t border-white/5 pt-8">
             <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 md:p-3 rounded-lg text-slate-400 hover:text-yellow-400 transition-all"
              title={isDarkMode ? 'Lichte modus' : 'Donkere modus'}
            >
              {isDarkMode ? <Sun size={20} className="md:w-6 md:h-6" /> : <Moon size={20} className="md:w-6 md:h-6" />}
            </button>
          </div>
          
          <div className="mt-auto flex flex-col gap-6 items-center">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-brand-primary/20 overflow-hidden shadow-sm">
              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=00638A&color=fff`} alt="avatar" className="w-full h-full object-cover" />
            </div>
            <button 
              onClick={logout}
              className="p-2.5 md:p-3 rounded-lg text-slate-400 hover:text-red-400 transition-all mb-4"
              title="Uitloggen"
            >
              <LogOut size={20} className="md:w-6 md:h-6" />
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 md:p-8 gap-6 overflow-y-auto">
        {/* Header Section */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end shrink-0 gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[var(--text-main)]">
              {activeTab === 'hours' ? 'Tijdregistratie' : activeTab === 'travel' ? 'Verplaatsingen' : 'Maandoverzichten'}
            </h1>
            <p className="text-[var(--text-muted)] text-sm font-medium">Overzicht van je professionele activiteiten</p>
          </div>
          <div className="flex gap-2 md:gap-4 w-full sm:w-auto">
                <div className="card-panel px-3 md:px-4 py-2 border-slate-200 dark:border-slate-800 flex-1 sm:min-w-32">
              <span className="label-tiny">Doel</span>
              <span className="text-base md:text-lg mono-value block text-[var(--text-main)]">{formatMonoTime(currentTargetMinutes)}</span>
            </div>
            <div className="card-panel px-3 md:px-4 py-2 border-slate-200 dark:border-slate-800 flex-1 sm:min-w-32">
              <span className="label-tiny">Gewerkte uren</span>
              <span className={`text-base md:text-lg mono-value block ${progressPercent >= 100 ? 'text-green-600 dark:text-green-400' : 'text-brand-primary'}`}>
                {formatMonoTime(currentWeekWorkMin + liveMinutes)}
              </span>
            </div>
            <div className="card-panel px-3 md:px-4 py-2 border-slate-200 dark:border-slate-800 flex-1 sm:min-w-32">
              <span className="label-tiny">Overuren ({currentSchoolYear})</span>
              <span className={`text-base md:text-lg mono-value block ${
                overtimeBalance > 20 * 60 ? 'text-purple-600 dark:text-purple-400' : 
                overtimeBalance > 0 ? 'text-green-600 dark:text-green-400' : 
                overtimeBalance < 0 ? 'text-red-500 dark:text-red-400' :
                'text-[var(--text-main)]'
              }`}>
                {overtimeBalance > 0 ? '+' : ''}{formatMonoTime(Math.abs(overtimeBalance))}
              </span>
            </div>
            <div className="card-panel px-3 md:px-4 py-2 border-slate-200 dark:border-slate-800 flex-1 sm:min-w-32">
              <span className="label-tiny">KM Totaal</span>
              <span className="text-base md:text-lg mono-value block text-slate-900 dark:text-slate-100">{totalKmForMonth.toFixed(1)} km</span>
            </div>
            <div className="card-panel px-3 md:px-4 py-2 border-slate-200 dark:border-slate-800 flex-1 sm:min-w-32">
              <span className="label-tiny">Vergoeding</span>
              <span className="text-base md:text-lg mono-value block text-green-600 dark:text-green-400">€{totalCompForMonth.toFixed(2)}</span>
            </div>
          </div>
        </header>

        {/* Layout Grid */}
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 flex-1 min-h-0">
          
          {/* Input Section (Left/Top) */}
          {activeTab !== 'reports' && (
            <section className="lg:col-span-4 flex flex-col gap-6 overflow-visible lg:overflow-y-auto pr-0 lg:pr-2">
              {activeTab === 'hours' && (
                <div className="card-panel p-6 flex flex-col shrink-0 bg-gradient-to-br from-[var(--panel-bg)] to-brand-primary/5">
                  <h3 className="label-tiny mb-4">Focus & Voortgang</h3>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Weekdoel</span>
                        <span className="text-[10px] font-bold text-brand-primary uppercase tabular-nums">{progressPercent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-900/50 h-2 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          className="h-full bg-brand-primary shadow-[0_0_12px_rgba(31,95,122,0.3)] dark:shadow-[0_0_12px_rgba(31,95,122,0.15)]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'hours' && (
                <div className="card-panel p-6 flex flex-col shrink-0 bg-gradient-to-br from-[var(--panel-bg)] to-indigo-500/5">
                  <h3 className="label-tiny mb-4">Live Sessie</h3>
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <div className="text-5xl font-mono font-light text-[var(--text-main)] tracking-tighter drop-shadow-sm">
                      {formatTimer(liveMinutes)}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${timer.isActive ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-slate-300 dark:bg-slate-700'}`} />
                      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        {timer.isActive ? 'Actief aan het werk' : 'Inactief'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {!timer.isActive ? (
                      <button onClick={startTimer} className="col-span-2 btn-primary py-4 shadow-xl border-none">
                        Start Nieuwe Sessie
                      </button>
                    ) : (
                      <button onClick={stopTimer} className="col-span-2 bg-red-500/10 text-red-500 font-bold py-4 rounded-xl hover:bg-red-500/20 transition-colors">
                        Stop Sessie
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="card-panel p-6 flex flex-col shrink-0">
                <h3 className="label-tiny mb-6">{activeTab === 'hours' ? 'Handmatige Registratie' : 'Nieuwe Verplaatsing'}</h3>
                
                <AnimatePresence mode="wait">
                  {activeTab === 'hours' ? (
                    <motion.form 
                      key="work-form-manual"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={addWorkEntryManual} 
                      className="flex flex-col gap-4"
                    >
                      <div className="space-y-1">
                        <label className="label-tiny">Datum</label>
                        <input type="date" name="date" required className="input-field" defaultValue={new Date().toISOString().split('T')[0]} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="label-tiny">Start</label>
                          <input type="time" name="start" required className="input-field" defaultValue="09:00" />
                        </div>
                        <div className="space-y-1">
                          <label className="label-tiny">Einde</label>
                          <input type="time" name="end" required className="input-field" defaultValue="17:00" />
                        </div>
                      </div>
                      <button type="submit" className="mt-2 w-full btn-primary bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 border-none">
                        Handmatig Toevoegen
                      </button>
                    </motion.form>
                  ) : (
                    <motion.form 
                      key="travel-form-preset"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={addTravelEntry} 
                      className="flex flex-col gap-4"
                    >
                      <div className="space-y-1">
                        <label className="label-tiny">Datum</label>
                        <input type="date" name="date" required className="input-field" defaultValue={new Date().toISOString().split('T')[0]} />
                      </div>
                      <div className="space-y-1">
                        <label className="label-tiny">Categorie</label>
                        <select 
                          name="routeCategory" 
                          className="input-field" 
                          value={travelRouteType}
                          onChange={(e) => setTravelRouteType(e.target.value)}
                        >
                          <option value="preset">Vast Traject</option>
                          <option value="nascholing">Nascholing (Auto, H&T)</option>
                          <option value="woonwerk_fiets">Woon-werkverkeer (Fiets, H&T)</option>
                          <option value="custom">Handmatig traject...</option>
                        </select>
                      </div>

                      {travelRouteType === 'preset' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="label-tiny">Vertrek</label>
                            <select 
                              name="startLocation" 
                              className="input-field"
                              value={startLocation}
                              onChange={(e) => setStartLocation(e.target.value)}
                            >
                              {LOCATIONS.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="label-tiny">Bestemming</label>
                            <select 
                              name="endLocation" 
                              className="input-field"
                              value={endLocation}
                              onChange={(e) => setEndLocation(e.target.value)}
                            >
                              {LOCATIONS.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {travelRouteType === 'preset' && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800/50">
                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Afstand</p>
                          <p className="text-sm font-mono font-bold text-brand-primary">
                            {ROUTE_DISTANCES[startLocation]?.[endLocation] || 0} km
                          </p>
                        </div>
                      )}

                      {travelRouteType === 'custom' && (
                        <div className="space-y-1">
                          <label className="label-tiny">Omschrijving verplaatsing</label>
                          <input 
                            type="text" 
                            name="custom_description" 
                            required 
                            className="input-field" 
                            placeholder="bijv. Klantbezoek Hasselt" 
                          />
                        </div>
                      )}

                      {(travelRouteType === 'custom' || travelRouteType === 'nascholing' || travelRouteType === 'woonwerk_fiets') && (
                        <div className="space-y-1">
                          <label className="label-tiny">
                            {travelRouteType === 'custom' ? 'Afstand (km)' : 'Enkel traject (km)'}
                          </label>
                          <input 
                            type="number" 
                            name="distance_manual" 
                            step="0.1" 
                            required 
                            className="input-field" 
                            placeholder="bijv. 12.5" 
                          />
                          {(travelRouteType === 'nascholing' || travelRouteType === 'woonwerk_fiets') && (
                            <p className="text-[10px] text-brand-primary font-bold uppercase mt-1">Wordt automatisch verdubbeld (H&T)</p>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-3 py-1">
                         <input 
                           type="checkbox" 
                           name="return" 
                           id="is-return" 
                           className="w-4 h-4 rounded text-brand-primary" 
                           disabled={travelRouteType === 'nascholing' || travelRouteType === 'woonwerk_fiets'}
                           defaultChecked={travelRouteType === 'nascholing' || travelRouteType === 'woonwerk_fiets'}
                         />
                         <label htmlFor="is-return" className={`text-xs font-bold text-slate-500 uppercase cursor-pointer ${ (travelRouteType === 'nascholing' || travelRouteType === 'woonwerk_fiets') ? 'opacity-50' : ''}`}>
                           Heen en terug rit
                         </label>
                      </div>
                      <div className="space-y-1">
                        <label className="label-tiny">Vervoer</label>
                        <select 
                          name="type" 
                          className="input-field" 
                          disabled={travelRouteType === 'nascholing' || travelRouteType === 'woonwerk_fiets'}
                          value={travelRouteType === 'nascholing' ? 'auto' : travelRouteType === 'woonwerk_fiets' ? 'fiets' : undefined}
                        >
                          <option value="auto">Auto (€0,4004/km)</option>
                          <option value="fiets">Fiets (€0,21/km)</option>
                        </select>
                      </div>
                      <button type="submit" className="mt-4 w-full btn-primary bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 border-none">
                        Toevoegen
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>

              {activeTab === 'hours' && (
                <div className="card-panel p-6 flex flex-col shrink-0">
                  <h3 className="label-tiny mb-6">Vrije Dag Toevoegen</h3>
                  <form onSubmit={addFreeDay} className="flex flex-col gap-4">
                    <div className="space-y-1">
                      <label className="label-tiny">Datum</label>
                      <input type="date" name="date" required className="input-field" defaultValue={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div className="space-y-1">
                      <label className="label-tiny">Type</label>
                      <select name="type" required className="input-field">
                        <option value="vrije/facultatieve dag">Vrije/facultatieve dag</option>
                        <option value="feestdag">Feestdag</option>
                        <option value="ziek">Ziek</option>
                      </select>
                    </div>
                    <button type="submit" className="mt-2 w-full btn-primary bg-indigo-600 hover:bg-indigo-700 border-none">
                      Toevoegen
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'hours' && (
                <div className="card-panel p-6 flex flex-col shrink-0">
                  <h3 className="label-tiny mb-6">Lange Vakantieperiode</h3>
                  <form onSubmit={addVacationPeriod} className="flex flex-col gap-4">
                    <div className="space-y-1">
                      <label className="label-tiny">Startdatum</label>
                      <input 
                        type="date" 
                        name="startDate" 
                        required 
                        className="input-field" 
                        value={vacationStart}
                        onChange={(e) => setVacationStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="label-tiny">Einddatum</label>
                      <input 
                        type="date" 
                        name="endDate" 
                        required 
                        className="input-field" 
                        min={vacationStart || undefined}
                        defaultValue={new Date().toISOString().split('T')[0]} 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="label-tiny">Omschrijving</label>
                      <input 
                        type="text" 
                        name="description" 
                        required 
                        className="input-field" 
                        placeholder="bijv. Zomervakantie" 
                      />
                    </div>
                    <button type="submit" className="mt-2 w-full btn-primary bg-indigo-600 hover:bg-indigo-700 border-none">
                      Vakantie Toevoegen
                    </button>
                  </form>

                  {vacationPeriods.length > 0 && (
                    <div className="mt-6 border-t border-slate-100 dark:border-slate-800/60 pt-4">
                      <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Actieve Vakantieperiodes</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {vacationPeriods.map(vp => (
                          <div key={vp.id} className="flex items-center justify-between p-2.5 rounded bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 text-xs">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-[var(--text-main)] truncate">{vp.description}</p>
                              <p className="text-[10px] text-[var(--text-muted)] font-medium">
                                {new Date(vp.startDate).toLocaleDateString('nl', { day: 'numeric', month: 'short' })} t/m {new Date(vp.endDate).toLocaleDateString('nl', { day: 'numeric', month: 'short' })}
                              </p>
                            </div>
                            <button 
                              onClick={() => deleteVacationPeriod(vp.id)} 
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors ml-2 shrink-0"
                              title="Verwijderen"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* List Section (Right/Bottom) */}
          <section className={`${activeTab === 'reports' ? 'lg:col-span-12' : 'lg:col-span-8'} flex flex-col gap-6 min-h-0`}>

            <div className="card-panel flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800/50 bg-brand-primary flex justify-between items-center shrink-0 transition-all">
                <h3 className="label-tiny !mb-0 text-white">
                  {activeTab === 'hours' ? 'Geregistreerde Uren' : activeTab === 'travel' ? 'Verplaatsing Historiek' : 'Overzicht per Maand'}
                </h3>
                <span className="text-[10px] font-bold text-white/90 uppercase">
                  {activeTab === 'hours' ? `${combinedEntries.length} items` : activeTab === 'travel' ? `${travelEntries.length} items` : `${groupedMonthlyData.length} maanden`}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                  {activeTab === 'hours' ? (
                    <motion.div 
                      key="work-list-responsive"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {/* Desktop Table */}
                      <div className="hidden md:block w-full">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-[var(--text-main)]">
                          {combinedEntries.map(entry => {
                            if (entry.entryType === 'free') {
                              return (
                                <div key={entry.id} className="group bg-indigo-50/20 dark:bg-indigo-900/10 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 transition-colors grid grid-cols-[100px_1fr_140px_60px] gap-6 items-center px-6 py-4 text-sm">
                                  <div>
                                    <span className="font-semibold block whitespace-nowrap text-indigo-700 dark:text-indigo-300">{new Date(entry.date).toLocaleDateString('nl', { day: '2-digit', month: 'short' })}</span>
                                    <span className="text-[10px] text-indigo-400 uppercase font-bold">{new Date(entry.date).toLocaleDateString('nl', { weekday: 'short' })}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border transition-colors ${
                                      entry.type === 'ziek' ? 'bg-red-50 text-red-500 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' : 
                                      entry.type === 'feestdag' ? 'bg-amber-50 text-amber-500 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' : 
                                      'bg-indigo-50 text-indigo-500 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20'
                                    }`}>
                                      {entry.type}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs font-bold text-indigo-400">
                                      -{new Date(entry.date + 'T00:00:00').getDay() === 3 ? '4u' : '8u'} doel
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <button onClick={() => deleteFreeDay(entry.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={entry.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors grid grid-cols-[100px_1fr_140px_80px] gap-6 items-center px-6 py-4 text-sm border-b dark:border-slate-800/30">
                                <div>
                                  <span className="font-semibold block whitespace-nowrap">{new Date(entry.date).toLocaleDateString('nl', { day: '2-digit', month: 'short' })}</span>
                                  <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">{new Date(entry.date).toLocaleDateString('nl', { weekday: 'short' })}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  {editingEntryId === entry.id ? (
                                    <div className="flex items-center gap-2">
                                      <input 
                                        type="time" 
                                        className="input-field py-1 px-2 text-xs h-auto min-w-[70px]"
                                        value={editValues?.startTime}
                                        onChange={(e) => setEditValues(prev => prev ? { ...prev, startTime: e.target.value } : null)}
                                      />
                                      <ChevronRight size={10} className="text-slate-300 dark:text-slate-600" />
                                      <input 
                                        type="time" 
                                        className="input-field py-1 px-2 text-xs h-auto min-w-[70px]"
                                        value={editValues?.endTime}
                                        onChange={(e) => setEditValues(prev => prev ? { ...prev, endTime: e.target.value } : null)}
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      <span className="bg-slate-50 dark:bg-slate-900/40 px-2.5 py-1 rounded text-xs font-mono font-medium text-[var(--text-muted)] min-w-[55px] text-center tabular-nums border border-slate-200/50 dark:border-slate-800/80">{entry.startTime}</span>
                                      <ChevronRight size={10} className="text-slate-300 dark:text-slate-600" />
                                      <span className="bg-slate-50 dark:bg-slate-900/40 px-2.5 py-1 rounded text-xs font-mono font-medium text-[var(--text-muted)] min-w-[55px] text-center tabular-nums border border-slate-200/50 dark:border-slate-800/80">{entry.endTime}</span>
                                      {vacationPeriods.some(vp => entry.date >= vp.startDate && entry.date <= vp.endDate) && (
                                        <span className="bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wide shrink-0 border border-indigo-500/20" title="Geregistreerd tijdens vakantie (telt als overuren)">Vakantie</span>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className="mono-value tabular-nums">
                                    {formatMonoTime(
                                      editingEntryId === entry.id && editValues 
                                        ? calculateDuration(editValues.startTime, editValues.endTime, entry.breakTime)
                                        : calculateDuration(entry.startTime, entry.endTime, entry.breakTime)
                                    )}
                                  </span>
                                </div>
                                <div className="text-right flex items-center justify-end gap-1">
                                  {editingEntryId === entry.id ? (
                                    <>
                                      <button onClick={() => updateWorkEntry(entry.id)} className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-all" title="Opslaan">
                                        <Check size={14} />
                                      </button>
                                      <button onClick={() => { setEditingEntryId(null); setEditValues(null); }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all" title="Annuleren">
                                        <X size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => startEditing(entry)} className="p-2 text-slate-300 hover:text-brand-primary opacity-0 group-hover:opacity-100 transition-all" title="Bewerken">
                                        <Pencil size={14} />
                                      </button>
                                      <button onClick={() => deleteWork(entry.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all" title="Verwijderen">
                                        <Trash2 size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Mobile Cards */}
                      <div className="md:hidden divide-y divide-slate-100">
                        {combinedEntries.map(entry => {
                          if (entry.entryType === 'free') {
                            return (
                              <div key={entry.id} className="p-4 flex justify-between items-center bg-indigo-50/20 dark:bg-indigo-900/10 border-b border-indigo-100/50 dark:border-indigo-900/30">
                                <div className="flex items-center gap-4">
                                  <div className="bg-indigo-100 dark:bg-indigo-900/40 px-2 py-1 rounded text-center min-w-12 border border-indigo-200/50 dark:border-indigo-800/50">
                                    <span className="block text-[10px] font-bold text-indigo-400 uppercase">{new Date(entry.date).toLocaleDateString('nl', { month: 'short' })}</span>
                                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{new Date(entry.date).getDate()}</span>
                                  </div>
                                  <div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase text-xs ${
                                      entry.type === 'ziek' ? 'text-red-500' : 
                                      entry.type === 'feestdag' ? 'text-amber-500' : 
                                      'text-indigo-500'
                                    }`}>
                                      {entry.type}
                                    </span>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{new Date(entry.date).toLocaleDateString('nl', { weekday: 'long' })}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-xs font-bold text-indigo-400">-{new Date(entry.date + 'T00:00:00').getDay() === 3 ? '4u' : '8u'}</span>
                                  <button onClick={() => deleteFreeDay(entry.id)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-all">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={entry.id} className="p-4 bg-[var(--panel-bg)] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800/30">
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-4">
                                  <div className="bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded text-center min-w-12">
                                    <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{new Date(entry.date).toLocaleDateString('nl', { month: 'short' })}</span>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{new Date(entry.date).getDate()}</span>
                                  </div>
                                  <div>
                                    {editingEntryId === entry.id ? (
                                      <div className="flex items-center gap-2 mb-1">
                                        <input 
                                          type="time" 
                                          className="input-field py-1 px-2 text-[10px] h-auto min-w-[60px]"
                                          value={editValues?.startTime}
                                          onChange={(e) => setEditValues(prev => prev ? { ...prev, startTime: e.target.value } : null)}
                                        />
                                        <ChevronRight size={10} className="text-slate-300 dark:text-slate-600" />
                                        <input 
                                          type="time" 
                                          className="input-field py-1 px-2 text-[10px] h-auto min-w-[60px]"
                                          value={editValues?.endTime}
                                          onChange={(e) => setEditValues(prev => prev ? { ...prev, endTime: e.target.value } : null)}
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                        <span>{entry.startTime}</span>
                                        <ChevronRight size={10} className="text-slate-300 dark:text-slate-600" />
                                        <span>{entry.endTime}</span>
                                        {vacationPeriods.some(vp => entry.date >= vp.startDate && entry.date <= vp.endDate) && (
                                          <span className="bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide shrink-0 border border-indigo-500/20" title="Geregistreerd tijdens vakantie (telt als overuren)">Vakantie</span>
                                        )}
                                      </div>
                                    )}
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{new Date(entry.date).toLocaleDateString('nl', { weekday: 'long' })}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {editingEntryId === entry.id ? (
                                    <>
                                      <button onClick={() => updateWorkEntry(entry.id)} className="p-2 text-green-500 bg-green-50 dark:bg-green-500/10 rounded-lg" title="Opslaan">
                                        <Check size={16} />
                                      </button>
                                      <button onClick={() => { setEditingEntryId(null); setEditValues(null); }} className="p-2 text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg" title="Annuleren">
                                        <X size={16} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => startEditing(entry)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-brand-primary" title="Bewerken">
                                        <Pencil size={16} />
                                      </button>
                                      <button onClick={() => deleteWork(entry.id)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-all" title="Verwijderen">
                                        <Trash2 size={16} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                <span>Duur</span>
                                <span className="mono-value text-xs text-[var(--text-main)] lowercase font-bold">
                                  {formatMonoTime(
                                    editingEntryId === entry.id && editValues 
                                      ? calculateDuration(editValues.startTime, editValues.endTime, entry.breakTime)
                                      : calculateDuration(entry.startTime, entry.endTime, entry.breakTime)
                                  )}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ) : activeTab === 'travel' ? (
                    <motion.div 
                      key="travel-list-responsive"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {/* Desktop Table */}
                      <div className="hidden md:block w-full">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-[var(--text-main)]">
                          {travelEntries.map(entry => (
                            <div key={entry.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors grid grid-cols-[90px_1fr_100px_130px_60px] gap-6 items-center px-6 py-4 text-sm border-b dark:border-slate-800/30 last:border-0">
                              <div className="font-semibold text-[var(--text-muted)]">
                                {new Date(entry.date).toLocaleDateString('nl', { day: '2-digit', month: 'short' })}
                              </div>
                              <div className="font-medium truncate tracking-tight text-[var(--text-main)]">{entry.description}</div>
                              <div className="flex items-center">
                                <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-tight min-w-[60px] text-center border ${
                                  entry.type === 'auto' ? 'bg-blue-500/5 text-blue-500 border-blue-500/20' : 'bg-green-500/5 text-green-500 border-green-500/20'
                                }`}>
                                  {entry.type}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="mono-value tabular-nums text-[var(--text-main)]">{entry.distance.toFixed(1)} km</div>
                                <div className="text-[10px] text-green-600 dark:text-green-400 font-bold tabular-nums">€{(entry.distance * TRANSPORT_RATES[entry.type]).toFixed(2)}</div>
                              </div>
                              <div className="text-right">
                                <button onClick={() => deleteTravel(entry.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Mobile Cards */}
                      <div className="md:hidden divide-y divide-slate-100">
                        {travelEntries.map(entry => (
                          <div key={entry.id} className="p-4 bg-[var(--panel-bg)] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800/30">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-3">
                                <div className="bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded text-center min-w-12">
                                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{new Date(entry.date).toLocaleDateString('nl', { month: 'short' })}</span>
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{new Date(entry.date).getDate()}</span>
                                </div>
                                <div className="text-sm font-semibold text-[var(--text-main)] truncate max-w-[180px]">{entry.description}</div>
                              </div>
                              <button onClick={() => deleteTravel(entry.id)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-all">
                                <Trash2 size={16} />
                              </button>
                            </div>
                            <div className="flex justify-between items-center pl-[60px]">
                              <span className={`uppercase text-[10px] font-black px-2 py-0.5 rounded border ${
                                entry.type === 'auto' ? 'bg-blue-500/5 text-blue-500 border-blue-500/20' : 'bg-green-500/5 text-green-500 border-green-500/20'
                              }`}>
                                {entry.type}
                              </span>
                              <div className="text-right">
                                <span className="mono-value text-xs text-[var(--text-main)] block">{entry.distance.toFixed(1)} km</span>
                                <span className="text-[10px] text-green-600 dark:text-green-400 font-bold">€{(entry.distance * TRANSPORT_RATES[entry.type]).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="reports-container"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="p-4 md:p-6 flex flex-col gap-8"
                    >
                      {/* Section 1: Laatste 3 Werkweken */}
                      <div>
                        <div className="flex flex-col mb-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60">
                          <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider text-brand-primary">Glijtijd & Overuren (Laatste 3 Weken)</h3>
                          <p className="text-[11px] text-[var(--text-muted)] font-medium mt-0.5">Visueel week-voor-week overzicht van je prestaties inclusief vrije dagen.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {lastThreeWeeks.map((week) => {
                            return (
                              <div 
                                key={week.key} 
                                className={`card-panel p-4 flex flex-col justify-between border-slate-200 dark:border-slate-800/80 transition-all ${
                                  week.isCurrentWeek 
                                    ? 'bg-gradient-to-br from-[var(--panel-bg)] to-brand-primary/5 border-brand-primary/20 shadow-md ring-1 ring-brand-primary/10' 
                                    : 'bg-[var(--panel-bg)] hover:border-slate-300 dark:hover:border-slate-700/80'
                                }`}
                              >
                                <div className="mb-3">
                                  <div className="flex justify-between items-start">
                                    <h4 className="text-xs font-bold text-[var(--text-main)] truncate" title={week.label}>{week.label}</h4>
                                    {week.isCurrentWeek && (
                                      <span className="bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/25 text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wider shrink-0">Actief</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider block mt-0.5">{week.range}</span>
                                </div>

                                <div className="space-y-2 mt-2">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-[var(--text-muted)] font-medium">Weekdoel</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-[var(--text-main)]">{formatMonoTime(week.targetMin)}</span>
                                      {week.reductionMinutes > 0 && (
                                        <span className="text-[9px] text-indigo-500 font-bold uppercase" title={`${week.freeDaysCount} vrije dag(en)`}>
                                          (-{formatMonoTime(week.reductionMinutes)})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-[var(--text-muted)] font-medium">Gewerkt</span>
                                    <span className="font-mono font-bold text-[var(--text-main)]">{formatMonoTime(week.workedMin)}</span>
                                  </div>

                                  <div className="border-t border-dashed border-slate-100 dark:border-slate-800/80 pt-2 flex justify-between items-center text-xs">
                                    <span className="font-semibold text-[var(--text-main)]">Resultaat</span>
                                    <span className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                                      week.overtimeMin > 0 
                                        ? 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400' 
                                        : week.overtimeMin < 0 
                                          ? 'bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400'
                                          : 'bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)]'
                                    }`}>
                                      {week.overtimeMin > 0 ? '+' : ''}{formatMonoTime(week.overtimeMin)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Section 2: Overzicht per Maand */}
                      <div>
                        <div className="flex flex-col mb-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60">
                          <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider text-brand-primary">Overzicht per Maand</h3>
                          <p className="text-[11px] text-[var(--text-muted)] font-medium mt-0.5">Exporteer maandrapporten naar Excel of bekijk gecumuleerde reiskosten.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                          {groupedMonthlyData.map(([key, stats], index) => (
                            <div key={key} className={`card-panel p-4 md:p-6 hover:border-brand-primary/30 transition-all group ${
                              (index === 3 || index === 4 || index === 5) ? 'bg-brand-primary shadow-lg shadow-brand-primary/10' : ''
                            }`}>
                              <div className="flex justify-between items-start mb-6">
                                <div>
                                  <h4 className={`text-base md:text-lg font-bold capitalize ${
                                    (index === 3 || index === 4 || index === 5) ? 'text-slate-100' : 'text-[var(--text-main)]'
                                  }`}>{key}</h4>
                                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${
                                    (index === 3 || index === 4 || index === 5) ? 'text-slate-100/60' : 'text-[var(--text-muted)]'
                                  }`}>Maandrapport</p>
                                </div>
                                <button 
                                  onClick={() => exportToExcel(key)}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
                                    (index === 3 || index === 4 || index === 5) 
                                      ? 'bg-white/20 text-white hover:bg-white/30' 
                                      : 'bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white'
                                  }`}
                                >
                                  <Download size={14} /> <span className="hidden sm:inline">Excel</span>
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 md:gap-4">
                                <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-[var(--panel-border)] shadow-inner">
                                  <span className="label-tiny">Gewerkte Uren</span>
                                  <span className="block text-lg md:text-xl mono-value text-[var(--text-main)]">{formatMonoTime(stats.workMin)}</span>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-[var(--panel-border)] shadow-inner">
                                  <span className="label-tiny">Reiskosten</span>
                                  <span className="block text-lg md:text-xl mono-value text-green-600 dark:text-green-400">€{stats.travelComp.toFixed(2)}</span>
                                </div>
                                <div className="col-span-2 flex items-center justify-between px-3 py-2 bg-slate-50/50 dark:bg-slate-900/20 rounded-lg border border-[var(--panel-border)]">
                                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Afstand</span>
                                  <span className="text-xs font-bold text-[var(--text-main)] mono-value">{stats.travelKm.toFixed(1)} km</span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {groupedMonthlyData.length === 0 && (
                            <div className="col-span-2 flex flex-col items-center justify-center py-10 text-slate-300 text-center">
                               <BarChart3 size={40} className="mb-2 opacity-20" />
                               <p className="text-sm font-medium">Nog geen data beschikbaar voor rapportage.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section 3: Overuren per Schooljaar (Snapshots) */}
                      <div className="mt-8">
                        <div className="flex flex-col mb-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60">
                          <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider text-brand-primary">Schooljaren & Overuren Snapshots</h3>
                          <p className="text-[11px] text-[var(--text-muted)] font-medium mt-0.5">Overuren worden aan het einde van het schooljaar (30 juni) gearchiveerd en niet meegenomen naar het volgende jaar. Klik op een schooljaar om de week-tot-week specificatie te zien.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {schoolYearsData.map((sy) => {
                            const rangeStart = `1 sep ${sy.schoolYear.split('-')[0]}`;
                            const rangeEnd = `30 jun ${sy.schoolYear.split('-')[1]}`;
                            const isExpanded = expandedSchoolYear === sy.schoolYear;
                            return (
                              <div 
                                key={sy.schoolYear} 
                                onClick={() => setExpandedSchoolYear(isExpanded ? null : sy.schoolYear)}
                                className={`card-panel p-4 flex flex-col justify-between border-slate-200 dark:border-slate-800/80 transition-all cursor-pointer select-none ${
                                  sy.isCurrent 
                                    ? 'bg-gradient-to-br from-[var(--panel-bg)] to-brand-primary/5 border-brand-primary/20 shadow-md ring-1 ring-brand-primary/10' 
                                    : 'bg-[var(--panel-bg)] hover:border-slate-300 dark:hover:border-slate-700/80'
                                } ${isExpanded ? 'ring-2 ring-indigo-500 border-transparent dark:ring-indigo-400' : ''}`}
                              >
                                <div className="mb-3">
                                  <div className="flex justify-between items-start gap-2">
                                    <h4 className="text-xs font-bold text-[var(--text-main)] truncate">Schooljaar {sy.schoolYear}</h4>
                                    {sy.isCurrent ? (
                                      <span className="bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/25 text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wider shrink-0">Lopend</span>
                                    ) : (
                                      <span className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400 text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wider shrink-0">Snapshot</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider block mt-0.5">{rangeStart} t/m {rangeEnd}</span>
                                </div>

                                <div className="space-y-2 mt-2">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-[var(--text-muted)] font-medium">Gewerkt</span>
                                    <span className="font-mono font-bold text-[var(--text-main)]">{formatMonoTime(sy.totalWorked)}</span>
                                  </div>

                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-[var(--text-muted)] font-medium">Doeluren</span>
                                    <span className="font-mono font-bold text-[var(--text-main)]">{formatMonoTime(sy.totalTarget)}</span>
                                  </div>
                                  
                                  <div className="border-t border-dashed border-slate-100 dark:border-slate-800/80 pt-2 flex justify-between items-center text-xs">
                                    <span className="font-semibold text-[var(--text-main)]">
                                      {sy.isCurrent ? 'Saldo (lopend)' : 'Overuren Gearchiveerd'}
                                    </span>
                                    <span className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                                      sy.overtimeBalance > 0 
                                        ? 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400' 
                                        : sy.overtimeBalance < 0 
                                          ? 'bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400'
                                          : 'bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)]'
                                    }`}>
                                      {sy.overtimeBalance > 0 ? '+' : ''}{formatMonoTime(sy.overtimeBalance)}
                                    </span>
                                  </div>

                                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/40 flex justify-center items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                    <span>{isExpanded ? 'Details Verbergen' : 'Details Weergeven'}</span>
                                    <ChevronDown size={12} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {expandedSchoolYear && (() => {
                          const selectedYear = schoolYearsData.find(y => y.schoolYear === expandedSchoolYear);
                          if (!selectedYear) return null;
                          return (
                            <div className="mt-6 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <h4 className="text-sm font-bold text-[var(--text-main)]">
                                    Week-tot-week specificatie schooljaar {selectedYear.schoolYear}
                                  </h4>
                                  <p className="text-[11px] text-[var(--text-muted)] font-medium mt-0.5">
                                    Hieronder zie je de opbouw van je uren per geregistreerde week. Weken waarin geen uren of vrije dagen zijn geregistreerd, worden weggelaten.
                                  </p>
                                </div>
                                <button 
                                  onClick={() => setExpandedSchoolYear(null)}
                                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <X size={16} />
                                </button>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800/80 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                      <th className="py-2.5 px-3">Week</th>
                                      <th className="py-2.5 px-3">Gewerkt</th>
                                      <th className="py-2.5 px-3">Doeluren (Doel)</th>
                                      <th className="py-2.5 px-3 text-right">Saldo</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                    {selectedYear.weeks.map((wk) => {
                                      const currentWeekKey = schoolYearsData.find(y => y.isCurrent)?.weeks.find(w => w.weekKey === wk.weekKey)?.weekKey;
                                      return (
                                        <tr key={wk.weekKey} className="hover:bg-slate-100/40 dark:hover:bg-slate-800/20">
                                          <td className="py-2.5 px-3 font-medium text-[var(--text-main)]">
                                            {formatWeekLabel(wk.weekKey)}
                                            {wk.weekKey === currentWeekKey && (
                                              <span className="ml-2 bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/25 text-[8px] font-black uppercase px-1.5 py-0.5 rounded">Huidig</span>
                                            )}
                                          </td>
                                          <td className="py-2.5 px-3 font-mono font-semibold text-[var(--text-main)]">
                                            {formatMonoTime(wk.worked)}
                                          </td>
                                          <td className="py-2.5 px-3 text-[var(--text-muted)]">
                                            <span className="font-mono font-medium">{formatMonoTime(wk.target)}</span>
                                            {wk.reductionMin > 0 && (
                                              <span className="ml-1 text-[10px] font-medium text-indigo-500 dark:text-indigo-400">
                                                (verlaagd met {formatMonoTime(wk.reductionMin)}
                                                {wk.summerDaysCount > 0 && wk.freeDaysCount > 0 
                                                  ? ` i.v.m. zomervakantie & ${wk.freeDaysCount}v` 
                                                  : wk.summerDaysCount > 0 
                                                    ? ' i.v.m. zomervakantie' 
                                                    : ` i.v.m. ${wk.freeDaysCount}v`}
                                                )
                                              </span>
                                            )}
                                          </td>
                                          <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                                            wk.balance > 0 
                                              ? 'text-green-600 dark:text-green-400' 
                                              : wk.balance < 0 
                                                ? 'text-red-500 dark:text-red-400'
                                                : 'text-[var(--text-muted)]'
                                          }`}>
                                            {wk.balance > 0 ? '+' : ''}{formatMonoTime(wk.balance)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {(activeTab === 'hours' ? combinedEntries.length : activeTab === 'travel' ? travelEntries.length : 0) === 0 && activeTab !== 'reports' && (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300 text-center px-4">
                    <Briefcase size={48} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium">Nog geen gegevens om weer te geven.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

    </div>
  );
}
