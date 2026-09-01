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
  SchoolYearWeekData
} from './types';
import { 
  calculateDuration, 
  calculateWeekTarget, 
  getSchoolYearForDate, 
  getBaseTargetForSchoolYear, 
  toLocalYYYYMMDD, 
  isSummerDate,
  TRANSPORT_RATES
} from './utils/calculations';

import { HeaderStats } from './components/HeaderStats';
import { HoursTab } from './components/HoursTab';
import { WorkEntryList } from './components/WorkEntryList';
import { TravelTab } from './components/TravelTab';
import { ReportsTab } from './components/ReportsTab';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('hours');
  
  // Data collections
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [travelEntries, setTravelEntries] = useState<TravelEntry[]>([]);
  const [freeDays, setFreeDays] = useState<FreeDay[]>([]);
  const [vacationPeriods, setVacationPeriods] = useState<VacationPeriod[]>([]);
  
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
          type: d.type
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

  const defaultToday = useMemo(() => toLocalYYYYMMDD(new Date()), []);
  const currentSchoolYear = useMemo(() => getSchoolYearForDate(defaultToday), [defaultToday]);

  // Monday of the current week
  const currentMondayStr = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return toLocalYYYYMMDD(d);
  }, []);

  // Calculate current week target for ICT
  const currentWeekTargetInfo = useMemo(() => {
    return calculateWeekTarget(currentMondayStr, freeDays, vacationPeriods);
  }, [currentMondayStr, freeDays, vacationPeriods]);

  // Current week work minutes (ICT vs Teaching)
  const { currentWeekIctMin, currentWeekTeachingMin } = useMemo(() => {
    const monday = new Date(currentMondayStr + 'T00:00:00');
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const fridayStr = toLocalYYYYMMDD(friday);

    let ict = 0;
    let teaching = 0;

    workEntries.forEach(e => {
      if (e.date >= currentMondayStr && e.date <= fridayStr) {
        const dur = calculateDuration(e.startTime, e.endTime, e.breakTime || 0);
        if (e.category === 'teaching') {
          teaching += dur;
        } else {
          ict += dur;
        }
      }
    });

    if (timer.isActive) {
      if (timer.category === 'teaching') {
        teaching += liveMinutes;
      } else {
        ict += liveMinutes;
      }
    }

    return { currentWeekIctMin: Math.round(ict), currentWeekTeachingMin: Math.round(teaching) };
  }, [currentMondayStr, workEntries, timer.isActive, timer.category, liveMinutes]);

  // Travel totals
  const totalKm = useMemo(() => {
    return travelEntries.reduce((acc, t) => acc + t.distance, 0);
  }, [travelEntries]);

  const totalTravelComp = useMemo(() => {
    return travelEntries.reduce((acc, t) => acc + (t.distance * TRANSPORT_RATES[t.type]), 0);
  }, [travelEntries]);

  // Aggregate School Years Data
  const schoolYearsData: SchoolYearData[] = useMemo(() => {
    const syMap: Record<string, {
      weeks: Record<string, { ict: number; teaching: number }>;
    }> = {};

    // Collect all Mondays from work entries
    workEntries.forEach(entry => {
      const d = new Date(entry.date + 'T00:00:00');
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      const monStr = toLocalYYYYMMDD(d);
      const sy = getSchoolYearForDate(monStr);

      if (!syMap[sy]) {
        syMap[sy] = { weeks: {} };
      }
      if (!syMap[sy].weeks[monStr]) {
        syMap[sy].weeks[monStr] = { ict: 0, teaching: 0 };
      }
      const dur = calculateDuration(entry.startTime, entry.endTime, entry.breakTime || 0);
      if (entry.category === 'teaching') {
        syMap[sy].weeks[monStr].teaching += dur;
      } else {
        syMap[sy].weeks[monStr].ict += dur;
      }
    });

    // Ensure current school year exists
    if (!syMap[currentSchoolYear]) {
      syMap[currentSchoolYear] = { weeks: {} };
    }
    if (!syMap[currentSchoolYear].weeks[currentMondayStr]) {
      syMap[currentSchoolYear].weeks[currentMondayStr] = { ict: 0, teaching: 0 };
    }

    const result: SchoolYearData[] = Object.keys(syMap)
      .sort((a, b) => b.localeCompare(a))
      .map(sy => {
        const isCurrent = sy === currentSchoolYear;
        const baseWeeklyTargetMin = getBaseTargetForSchoolYear(sy);
        const weekKeys = Object.keys(syMap[sy].weeks).sort((a, b) => b.localeCompare(a));

        let totalWorkedIct = 0;
        let totalWorkedTeaching = 0;
        let totalTargetMin = 0;
        let activeTeachingWeeks = 0;
        let completedWeeksOvertime = 0;

        const weeks: SchoolYearWeekData[] = weekKeys.map(monStr => {
          const wData = syMap[sy].weeks[monStr];
          const targetInfo = calculateWeekTarget(monStr, freeDays, vacationPeriods);
          
          let wIct = wData.ict;
          let wTeaching = wData.teaching;

          // Add live timer if current week
          if (isCurrent && monStr === currentMondayStr && timer.isActive) {
            if (timer.category === 'teaching') {
              wTeaching += liveMinutes;
            } else {
              wIct += liveMinutes;
            }
          }

          const workedIct = Math.round(wIct);
          const workedTeaching = Math.round(wTeaching);
          const workedTotal = workedIct + workedTeaching;
          const balanceMin = workedTotal - targetInfo.targetMin;

          totalWorkedIct += workedIct;
          totalWorkedTeaching += workedTeaching;
          totalTargetMin += targetInfo.targetMin;
          if (workedTeaching > 0) {
            activeTeachingWeeks++;
          }

          if (isCurrent) {
            if (monStr < currentMondayStr) {
              completedWeeksOvertime += balanceMin;
            }
          }

          return {
            weekKey: monStr,
            workedIct,
            workedTeaching,
            workedTotal,
            targetMin: targetInfo.targetMin,
            reductionMin: targetInfo.reductionMin,
            freeDaysCount: targetInfo.freeDaysCount,
            summerDaysCount: targetInfo.summerDaysCount,
            balanceMin
          };
        });

        const totalWorkedAll = totalWorkedIct + totalWorkedTeaching;
        
        // For the current active school year: start at 0 (clean slate on Sep 1) + completed weeks + current week surplus
        let overtimeBalance: number;
        if (isCurrent) {
          const currentWeekData = weeks.find(w => w.weekKey === currentMondayStr);
          const currentWeekSurplus = currentWeekData && currentWeekData.workedTotal > currentWeekData.targetMin
            ? currentWeekData.workedTotal - currentWeekData.targetMin
            : 0;
          overtimeBalance = completedWeeksOvertime + currentWeekSurplus;
        } else {
          overtimeBalance = totalWorkedAll - totalTargetMin;
        }

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
          isCurrent,
          weeksCount,
          activeTeachingWeeks,
          averageTeachingMinPerWeek,
          baseWeeklyTargetMin,
          weeks
        };
      });

    return result;
  }, [workEntries, currentSchoolYear, currentMondayStr, freeDays, vacationPeriods, timer.isActive, timer.category, liveMinutes]);

  const currentYearData = schoolYearsData.find(s => s.schoolYear === currentSchoolYear);
  const currentOvertimeBalance = currentYearData?.overtimeBalance || 0;
  const currentWeekTotalMin = currentWeekIctMin + currentWeekTeachingMin;

  // Last 3 weeks data
  const lastThreeWeeks = useMemo(() => {
    const list = [];
    const mon = new Date(currentMondayStr + 'T00:00:00');

    for (let i = 0; i < 3; i++) {
      const curMon = new Date(mon);
      curMon.setDate(mon.getDate() - (i * 7));
      const monStr = toLocalYYYYMMDD(curMon);

      const targetInfo = calculateWeekTarget(monStr, freeDays, vacationPeriods);
      const friday = new Date(curMon);
      friday.setDate(curMon.getDate() + 4);
      const friStr = toLocalYYYYMMDD(friday);

      let wIct = 0;
      let wTeaching = 0;

      workEntries.forEach(e => {
        if (e.date >= monStr && e.date <= friStr) {
          const dur = calculateDuration(e.startTime, e.endTime, e.breakTime || 0);
          if (e.category === 'teaching') {
            wTeaching += dur;
          } else {
            wIct += dur;
          }
        }
      });

      if (i === 0 && timer.isActive) {
        if (timer.category === 'teaching') {
          wTeaching += liveMinutes;
        } else {
          wIct += liveMinutes;
        }
      }

      const workedIctMin = Math.round(wIct);
      const workedTeachingMin = Math.round(wTeaching);
      const workedTotalMin = workedIctMin + workedTeachingMin;
      const balanceMin = workedTotalMin - targetInfo.targetMin;

      const startLabel = curMon.toLocaleDateString('nl', { day: 'numeric', month: 'short' });
      const endLabel = friday.toLocaleDateString('nl', { day: 'numeric', month: 'short' });

      list.push({
        mondayStr: monStr,
        weekLabel: `${startLabel} - ${endLabel}`,
        targetMin: targetInfo.targetMin,
        workedIctMin,
        workedTeachingMin,
        workedTotalMin,
        balanceMin,
        freeDaysCount: targetInfo.freeDaysCount
      });
    }

    return list;
  }, [currentMondayStr, freeDays, vacationPeriods, workEntries, timer.isActive, timer.category, liveMinutes]);

  // Monthly aggregated data
  const monthlyData = useMemo(() => {
    const monthsMap: Record<string, {
      label: string;
      ictMin: number;
      teachingMin: number;
      totalWorkMin: number;
      travelKm: number;
      travelComp: number;
      entriesCount: number;
    }> = {};

    workEntries.forEach(e => {
      const monthKey = e.date.substring(0, 7);
      if (!monthsMap[monthKey]) {
        const d = new Date(e.date + 'T00:00:00');
        monthsMap[monthKey] = {
          label: d.toLocaleDateString('nl', { month: 'long', year: 'numeric' }),
          ictMin: 0,
          teachingMin: 0,
          totalWorkMin: 0,
          travelKm: 0,
          travelComp: 0,
          entriesCount: 0
        };
      }
      const dur = calculateDuration(e.startTime, e.endTime, e.breakTime || 0);
      if (e.category === 'teaching') {
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
          label: d.toLocaleDateString('nl', { month: 'long', year: 'numeric' }),
          ictMin: 0,
          teachingMin: 0,
          totalWorkMin: 0,
          travelKm: 0,
          travelComp: 0,
          entriesCount: 0
        };
      }
      monthsMap[monthKey].travelKm += t.distance;
      monthsMap[monthKey].travelComp += (t.distance * TRANSPORT_RATES[t.type]);
    });

    return Object.keys(monthsMap)
      .sort((a, b) => b.localeCompare(a))
      .map(k => ({
        monthKey: k,
        monthLabel: monthsMap[k].label,
        ictMin: monthsMap[k].ictMin,
        teachingMin: monthsMap[k].teachingMin,
        totalWorkMin: monthsMap[k].totalWorkMin,
        travelKm: monthsMap[k].travelKm,
        travelComp: monthsMap[k].travelComp,
        entriesCount: monthsMap[k].entriesCount
      }));
  }, [workEntries, travelEntries]);

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
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
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
    const newEntry = {
      id: entryId,
      date: toLocalYYYYMMDD(startObj),
      startTime: formatTime(startObj),
      endTime: formatTime(now),
      breakTime: 0,
      category: cat,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      const entryRef = doc(db, 'users', user.uid, 'workEntries', entryId);
      const userRef = doc(db, 'users', user.uid);
      await setDoc(entryRef, newEntry);
      await setDoc(userRef, {
        isActive: false,
        startTime: null,
        category: null
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/workEntries/${entryId}`);
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

    const newEntry: any = {
      id: entryId,
      date: formData.get('date') as string,
      startTime: formData.get('start') as string,
      endTime: formData.get('end') as string,
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
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/workEntries/${entryId}`);
    }
  };

  const handleUpdateWorkEntry = async (
    id: string, 
    update: { startTime: string; endTime: string; category: WorkCategory; description?: string }
  ) => {
    if (!user) return;
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
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}/workEntries/${id}`);
    }
  };

  const handleDeleteWorkEntry = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'workEntries', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/workEntries/${id}`);
    }
  };

  const handleAddTravelEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const entryId = crypto.randomUUID();

    const newEntry = {
      id: entryId,
      date: formData.get('date') as string,
      description: formData.get('description') as string,
      distance: Number(formData.get('distance')),
      type: formData.get('type') as any,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'users', user.uid, 'travelEntries', entryId), newEntry);
      form.reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/travelEntries/${entryId}`);
    }
  };

  const handleDeleteTravelEntry = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'travelEntries', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/travelEntries/${id}`);
    }
  };

  const handleAddFreeDay = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const id = crypto.randomUUID();

    const newEntry = {
      id,
      date: formData.get('date') as string,
      type: formData.get('type') as any,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'users', user.uid, 'freeDays', id), newEntry);
      form.reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/freeDays/${id}`);
    }
  };

  const handleDeleteFreeDay = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'freeDays', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/freeDays/${id}`);
    }
  };

  const handleAddVacationPeriod = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const id = crypto.randomUUID();

    const newEntry = {
      id,
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string,
      description: formData.get('description') as string,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'users', user.uid, 'vacationPeriods', id), newEntry);
      form.reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/vacationPeriods/${id}`);
    }
  };

  const handleDeleteVacationPeriod = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'vacationPeriods', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/vacationPeriods/${id}`);
    }
  };

  const progressPercent = currentWeekTargetInfo.targetMin > 0
    ? (currentWeekTotalMin / currentWeekTargetInfo.targetMin) * 100
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)] text-[var(--text-muted)] text-sm">
        Applicatie laden...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text-main)] py-6 sm:py-10 px-4 sm:px-6">
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
          totalWorkedMin={currentWeekTotalMin}
          ictWorkedMin={currentWeekIctMin}
          teachingWorkedMin={currentWeekTeachingMin}
          overtimeBalance={currentOvertimeBalance}
          totalKm={totalKm}
          totalTravelComp={totalTravelComp}
        />

        {/* Tab Navigation Navigation Bar */}
        <div className="flex items-center gap-2 mb-6 border-b border-[var(--panel-border)] pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('hours')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0 ${
              activeTab === 'hours'
                ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'
                : 'text-[var(--text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Tijdregistratie & Timer</span>
          </button>

          <button
            onClick={() => setActiveTab('travel')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0 ${
              activeTab === 'travel'
                ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'
                : 'text-[var(--text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Verplaatsingen ({travelEntries.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0 ${
              activeTab === 'reports'
                ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'
                : 'text-[var(--text-muted)] hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Overuren & Rapporten</span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div>
          {activeTab === 'hours' && (
            <div className="space-y-8">
              <HoursTab
                timer={timer}
                liveMinutes={liveMinutes}
                currentWeekTotalMin={currentWeekTotalMin}
                currentWeekIctMin={currentWeekIctMin}
                currentWeekTeachingMin={currentWeekTeachingMin}
                currentTargetMinutes={currentWeekTargetInfo.targetMin}
                progressPercent={progressPercent}
                onStartTimer={handleStartTimer}
                onStopTimer={handleStopTimer}
                onAddManualWorkEntry={handleAddManualWorkEntry}
                onAddFreeDay={handleAddFreeDay}
                onAddVacationPeriod={handleAddVacationPeriod}
                defaultDate={defaultToday}
              />

              <WorkEntryList
                workEntries={workEntries}
                freeDays={freeDays}
                vacationPeriods={vacationPeriods}
                onDeleteWorkEntry={handleDeleteWorkEntry}
                onUpdateWorkEntry={handleUpdateWorkEntry}
                onDeleteFreeDay={handleDeleteFreeDay}
                onDeleteVacationPeriod={handleDeleteVacationPeriod}
              />
            </div>
          )}

          {activeTab === 'travel' && (
            <TravelTab
              travelEntries={travelEntries}
              onAddTravelEntry={handleAddTravelEntry}
              onDeleteTravelEntry={handleDeleteTravelEntry}
              defaultDate={defaultToday}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsTab
              schoolYearsData={schoolYearsData}
              monthlyData={monthlyData}
              lastThreeWeeks={lastThreeWeeks}
              workEntries={workEntries}
              travelEntries={travelEntries}
            />
          )}
        </div>
      </div>
    </div>
  );
}
