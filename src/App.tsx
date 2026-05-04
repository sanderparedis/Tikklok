import * as XLSX from 'xlsx';
import { Clock, Car, ChevronRight, Trash2, Briefcase, BarChart3, Download, LogOut, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useMemo } from 'react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp,
  getDoc
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

const TRANSPORT_RATES: Record<TransportType, number> = {
  auto: 0.4004,
  fiets: 0.21
};

const PRESET_ROUTES = [
  { label: 'Neeroeteren - Campus', km: 7.7 },
  { label: 'Neeroeteren - Kinrooi', km: 7.7 },
  { label: 'Neeroeteren - Maaseik', km: 8.2 },
  { label: 'Campus - Kinrooi', km: 5.4 },
  { label: 'Campus - Maaseik', km: 2.1 },
  { label: 'Maaseik - Kinrooi', km: 7.0 }
];

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

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('hours');
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [travelEntries, setTravelEntries] = useState<TravelEntry[]>([]);

  // Timer State
  const [timer, setTimer] = useState<TimerState>({
    isActive: false,
    startTime: null
  });

  const [currentTime, setCurrentTime] = useState(Date.now());

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Data Sync
  useEffect(() => {
    if (!user) {
      setWorkEntries([]);
      setTravelEntries([]);
      setTimer({ isActive: false, startTime: null });
      return;
    }

    const qWork = query(
      collection(db, `users/${user.uid}/workEntries`),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );
    const unsubWork = onSnapshot(qWork, (snapshot) => {
      setWorkEntries(snapshot.docs.map(d => d.data() as WorkEntry));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/workEntries`));

    const qTravel = query(
      collection(db, `users/${user.uid}/travelEntries`),
      orderBy('date', 'desc'),
      orderBy('createdAt', 'desc')
    );
    const unsubTravel = onSnapshot(qTravel, (snapshot) => {
      setTravelEntries(snapshot.docs.map(d => d.data() as TravelEntry));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/travelEntries`));

    const unsubTimer = onSnapshot(doc(db, `users/${user.uid}/state/timer`), (snapshot) => {
      if (snapshot.exists()) {
        setTimer(snapshot.data() as TimerState);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}/state/timer`));

    return () => {
      unsubWork();
      unsubTravel();
      unsubTimer();
    };
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Pruning logic - keep only last 12 months (still applied on local view for safety)
  const prunedWorkEntries = useMemo(() => {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);
    
    return workEntries.filter(e => {
      const entryDate = new Date(e.date + 'T00:00:00');
      return entryDate >= twelveMonthsAgo;
    });
  }, [workEntries]);

  const prunedTravelEntries = useMemo(() => {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);
    
    return travelEntries.filter(e => {
      const entryDate = new Date(e.date + 'T00:00:00');
      return entryDate >= twelveMonthsAgo;
    });
  }, [travelEntries]);

  const exportToExcel = (monthKey: string) => {
    const getMonthKey = (dateStr: string) => new Date(dateStr + 'T00:00:00').toLocaleString('nl', { month: 'long', year: 'numeric' });

    const monthWork = prunedWorkEntries.filter(e => getMonthKey(e.date) === monthKey);
    const monthTravel = prunedTravelEntries.filter(e => getMonthKey(e.date) === monthKey);

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

  const liveMinutes = useMemo(() => {
    if (!timer.isActive || !timer.startTime) return 0;
    return (currentTime - timer.startTime) / 60000;
  }, [timer, currentTime]);

  const totalWorkMin = useMemo(() => 
    prunedWorkEntries.reduce((acc, entry) => acc + calculateDuration(entry.startTime, entry.endTime, entry.breakTime), 0),
  [prunedWorkEntries]);

  const totalKm = useMemo(() => 
    prunedTravelEntries.reduce((acc, entry) => acc + entry.distance, 0),
  [prunedTravelEntries]);

  const totalComp = useMemo(() => 
    prunedTravelEntries.reduce((acc, entry) => acc + (entry.distance * (TRANSPORT_RATES[entry.type] || 0)), 0),
  [prunedTravelEntries]);

  const targetMinutes = 30 * 60 + 35;
  const progressPercent = Math.min(100, (totalWorkMin / targetMinutes) * 100);

  const startTimer = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/state/timer`), {
        isActive: true,
        startTime: timer.startTime || Date.now(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/state/timer`);
    }
  };

  const stopTimer = async () => {
    if (!user || !timer.startTime) return;
    
    const now = new Date();
    const startObj = new Date(timer.startTime);
    
    const formatTime = (date: Date) => 
      `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

    const id = crypto.randomUUID();
    const newEntry: any = {
      id,
      date: startObj.toISOString().split('T')[0],
      startTime: formatTime(startObj),
      endTime: formatTime(now),
      breakTime: 0,
      userId: user.uid,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, `users/${user.uid}/workEntries/${id}`), newEntry);
      await setDoc(doc(db, `users/${user.uid}/state/timer`), {
        isActive: false,
        startTime: null,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'stopping timer');
    }
  };

  const addWorkEntryManual = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const newEntry: any = {
      id,
      date: formData.get('date') as string,
      startTime: formData.get('start') as string,
      endTime: formData.get('end') as string,
      breakTime: 0,
      userId: user.uid,
      createdAt: serverTimestamp(),
    };
    
    try {
      await setDoc(doc(db, `users/${user.uid}/workEntries/${id}`), newEntry);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'manual work entry');
    }
  };

  const addTravelEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const routeIndex = formData.get('route') as string;
    const isReturn = formData.get('return') === 'on';
    
    let distance = 0;
    let description = "";

    if (routeIndex !== "custom") {
      const route = PRESET_ROUTES[Number(routeIndex)];
      distance = route.km * (isReturn ? 2 : 1);
      description = `${route.label} ${isReturn ? '(H&T)' : ''}`;
    } else {
      distance = Number(formData.get('distance'));
      description = `Aangepast traject`;
    }

    const id = crypto.randomUUID();
    const newEntry: any = {
      id,
      date: formData.get('date') as string,
      description,
      distance,
      type: formData.get('type') as TransportType,
      userId: user.uid,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, `users/${user.uid}/travelEntries/${id}`), newEntry);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'travel entry');
    }
  };

  const deleteWork = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/workEntries/${id}`));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/workEntries/${id}`);
    }
  };

  const deleteTravel = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/travelEntries/${id}`));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/travelEntries/${id}`);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error(error);
    }
  };

  const formatMonoTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.floor(totalMinutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  if (!authReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-brand-bg">
        <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-brand-bg p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-panel p-10 max-w-md w-full text-center flex flex-col items-center gap-8"
        >
          <div className="w-16 h-16 bg-brand-primary rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-xl shadow-brand-primary/20">W</div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Welkom bij Werktijd</h2>
            <p className="text-slate-500 text-sm">Log in om je gewerkte uren en verplaatsingen te synchroniseren over al je toestellen.</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 py-4 rounded-xl font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <LogIn size={20} />
            Inloggen met Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-brand-bg text-slate-800 font-sans h-screen overflow-hidden">
      {/* Sidebar Nav */}
      <aside className="w-16 md:w-20 bg-brand-sidebar flex flex-col items-center py-6 md:py-8 gap-8 md:gap-10 shrink-0 z-50">
        <div className="w-8 h-8 md:w-10 md:h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-lg shadow-brand-primary/20">W</div>
        <nav className="flex flex-col gap-6 md:gap-8">
          <button 
            id="nav-hours"
            onClick={() => setActiveTab('hours')}
            className={`p-2.5 md:p-3 rounded-lg transition-all ${activeTab === 'hours' ? 'bg-brand-primary/20 text-brand-primary' : 'text-slate-400 hover:text-white'}`}
          >
            <Clock size={20} className="md:w-6 md:h-6" />
          </button>
          <button 
            id="nav-travel"
            onClick={() => setActiveTab('travel')}
            className={`p-2.5 md:p-3 rounded-lg transition-all ${activeTab === 'travel' ? 'bg-brand-primary/20 text-brand-primary' : 'text-slate-400 hover:text-white'}`}
          >
            <Car size={20} className="md:w-6 md:h-6" />
          </button>
          <button 
            id="nav-reports"
            onClick={() => setActiveTab('reports')}
            className={`p-2.5 md:p-3 rounded-lg transition-all ${activeTab === 'reports' ? 'bg-brand-primary/20 text-brand-primary' : 'text-slate-400 hover:text-white'}`}
          >
            <BarChart3 size={20} className="md:w-6 md:h-6" />
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 md:p-8 gap-6 overflow-y-auto">
        {/* Header Section */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end shrink-0 gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">
              {activeTab === 'hours' ? 'Tijdregistratie' : activeTab === 'travel' ? 'Verplaatsingen' : 'Maandoverzichten'}
            </h1>
            <p className="text-slate-500 text-sm font-medium">Welkom, {user.displayName || 'Gebruiker'}</p>
          </div>
          <div className="flex gap-2 md:gap-4 w-full sm:w-auto">
            <button 
              onClick={handleLogout}
              className="bg-white p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-100 transition-all group"
              title="Uitloggen"
            >
              <LogOut size={20} className="group-hover:scale-110 transition-transform" />
            </button>
            <div className="bg-white px-3 md:px-4 py-2 rounded-xl shadow-sm border border-slate-200 flex-1 sm:min-w-32">
              <span className="label-tiny">Doel</span>
              <span className="text-base md:text-lg mono-value block">30:35</span>
            </div>
            <div className="bg-white px-3 md:px-4 py-2 rounded-xl shadow-sm border border-slate-200 flex-1 sm:min-w-32">
              <span className="label-tiny">Gewerkte uren</span>
              <span className={`text-base md:text-lg mono-value block ${progressPercent >= 100 ? 'text-green-600' : 'text-brand-primary'}`}>
                {formatMonoTime(totalWorkMin)}
              </span>
            </div>
          </div>
        </header>

        {/* Layout Grid */}
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 flex-1 min-h-0">
          
          {/* Input Section (Left/Top) */}
          {activeTab !== 'reports' && (
            <section className="lg:col-span-4 flex flex-col gap-6 overflow-visible lg:overflow-y-auto pr-0 lg:pr-2">
              {activeTab === 'hours' && (
                <div className="card-panel p-6 flex flex-col shrink-0 bg-gradient-to-br from-white to-indigo-50/30">
                  <h3 className="label-tiny mb-4">Live Sessie</h3>
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <div className="text-5xl font-mono font-light text-slate-800 tracking-tighter">
                      {formatTimer(liveMinutes)}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${timer.isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {timer.isActive ? 'Actief aan het werk' : 'Inactief'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {!timer.isActive ? (
                      <button onClick={startTimer} className="col-span-2 btn-primary bg-indigo-600 py-4 shadow-xl border-none">
                        Start Nieuwe Sessie
                      </button>
                    ) : (
                      <button onClick={stopTimer} className="col-span-2 bg-red-100 text-red-700 font-bold py-4 rounded-xl hover:bg-red-200 transition-colors">
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
                      <button type="submit" className="mt-2 w-full btn-primary bg-slate-800 hover:bg-slate-900 border-none">
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
                        <label className="label-tiny">Selecteer Traject</label>
                        <select name="route" className="input-field" defaultValue="0">
                          {PRESET_ROUTES.map((route, i) => (
                            <option key={i} value={i}>{route.label} ({route.km} km)</option>
                          ))}
                          <option value="custom">Aangepast traject...</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-3 py-2">
                         <input type="checkbox" name="return" id="is-return" className="w-4 h-4 rounded text-brand-primary" />
                         <label htmlFor="is-return" className="text-xs font-bold text-slate-500 uppercase cursor-pointer">Heen en terug rit</label>
                      </div>
                      <div className="space-y-1">
                        <label className="label-tiny">Vervoer</label>
                        <select name="type" className="input-field">
                          <option value="auto">Auto (€0,4004/km)</option>
                          <option value="fiets">Fiets (€0,21/km)</option>
                        </select>
                      </div>
                      <button type="submit" className="mt-4 w-full btn-primary bg-slate-800 hover:bg-slate-900 border-none">
                        Toevoegen
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* List Section (Right/Bottom) */}
          <section className={`${activeTab === 'reports' ? 'lg:col-span-12' : 'lg:col-span-8'} flex flex-col gap-6 min-h-0`}>

            {/* Progress/Stats Summary */}
            <div className="card-panel p-4 md:p-6 shrink-0">
              <h3 className="label-tiny mb-4">Focus & Voortgang</h3>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6">
                <div className="flex-1">
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <motion.div 
                      key="progress-bar"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      className="h-full bg-brand-primary"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 font-medium">
                    {progressPercent.toFixed(1)}% van je wekelijkse doel bereikt
                  </p>
                </div>
                <div className="flex gap-4 border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-6 shrink-0">
                  <div className="text-right flex-1 sm:flex-none">
                    <span className="label-tiny">KM Totaal</span>
                    <span className="mono-value text-slate-900">{totalKm.toFixed(1)}</span>
                  </div>
                  <div className="text-right flex-1 sm:flex-none">
                    <span className="label-tiny">Vergoeding</span>
                    <span className="mono-value text-green-600">€{totalComp.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* List Table */}
            <div className="card-panel flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                <h3 className="label-tiny !mb-0">
                  {activeTab === 'hours' ? 'Geregistreerde Uren' : activeTab === 'travel' ? 'Verplaatsing Historiek' : 'Overzicht per Maand'}
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  {activeTab === 'hours' ? `${prunedWorkEntries.length} items` : activeTab === 'travel' ? `${prunedTravelEntries.length} items` : `${groupedMonthlyData.length} maanden`}
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
                      <table className="hidden md:table w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm shadow-slate-100/50">
                          <tr className="label-tiny text-slate-400">
                            <th className="p-4 pl-6">Datum</th>
                            <th className="p-4">Tijdstip</th>
                            <th className="p-4 text-right pr-6">Totaal</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                          {prunedWorkEntries.map(entry => (
                            <tr key={entry.id} className="group hover:bg-slate-50 transition-colors">
                              <td className="p-4 pl-6">
                                <span className="font-semibold">{new Date(entry.date).toLocaleDateString('nl', { day: '2-digit', month: 'short' })}</span>
                                <span className="block text-[10px] text-slate-400 uppercase font-bold">{new Date(entry.date).toLocaleDateString('nl', { weekday: 'short' })}</span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-medium text-slate-600">{entry.startTime}</span>
                                  <ChevronRight size={10} className="text-slate-300" />
                                  <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-medium text-slate-600">{entry.endTime}</span>
                                </div>
                              </td>
                              <td className="p-4 text-right pr-6">
                                <div className="flex items-center justify-end gap-4">
                                  <span className="mono-value">{formatMonoTime(calculateDuration(entry.startTime, entry.endTime, entry.breakTime))}</span>
                                  <button onClick={() => deleteWork(entry.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      
                      {/* Mobile Cards */}
                      <div className="md:hidden divide-y divide-slate-100">
                        {prunedWorkEntries.map(entry => (
                          <div key={entry.id} className="p-4 flex justify-between items-center bg-white active:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="bg-slate-100 px-2 py-1 rounded text-center min-w-12">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase">{new Date(entry.date).toLocaleDateString('nl', { month: 'short' })}</span>
                                <span className="text-sm font-bold text-slate-700">{new Date(entry.date).getDate()}</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-1">
                                  <span>{entry.startTime}</span>
                                  <ChevronRight size={10} className="text-slate-300" />
                                  <span>{entry.endTime}</span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(entry.date).toLocaleDateString('nl', { weekday: 'long' })}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="mono-value text-sm">{formatMonoTime(calculateDuration(entry.startTime, entry.endTime, entry.breakTime))}</span>
                              <button onClick={() => deleteWork(entry.id)} className="p-2 text-slate-300 hover:text-red-500 transition-all">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
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
                      <table className="hidden md:table w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm shadow-slate-100/50">
                          <tr className="label-tiny text-slate-400">
                            <th className="p-4 pl-6">Datum</th>
                            <th className="p-4">Traject</th>
                            <th className="p-4">Vervoer</th>
                            <th className="p-4 text-right pr-6">KM / €</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                          {prunedTravelEntries.map(entry => (
                            <tr key={entry.id} className="group hover:bg-slate-50 transition-colors">
                              <td className="p-4 pl-6">
                                <span className="font-semibold">{new Date(entry.date).toLocaleDateString('nl', { day: '2-digit', month: 'short' })}</span>
                              </td>
                              <td className="p-4">
                                <div className="font-medium">{entry.description}</div>
                              </td>
                              <td className="p-4 uppercase text-[10px] font-bold">
                                <span className={`px-2 py-1 rounded ${
                                  entry.type === 'auto' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                                }`}>
                                  {entry.type}
                                </span>
                              </td>
                              <td className="p-4 text-right pr-6">
                                <div className="flex items-center justify-end gap-4">
                                  <div className="text-right">
                                    <div className="mono-value text-slate-900">{entry.distance.toFixed(1)} km</div>
                                    <div className="text-[10px] text-green-600 font-bold">€{(entry.distance * TRANSPORT_RATES[entry.type]).toFixed(2)}</div>
                                  </div>
                                  <button onClick={() => deleteTravel(entry.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
 
                      {/* Mobile Cards */}
                      <div className="md:hidden divide-y divide-slate-100">
                        {prunedTravelEntries.map(entry => (
                          <div key={entry.id} className="p-4 bg-white active:bg-slate-50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-3">
                                <div className="bg-slate-100 px-2 py-1 rounded text-center min-w-12">
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase">{new Date(entry.date).toLocaleDateString('nl', { month: 'short' })}</span>
                                  <span className="text-sm font-bold text-slate-700">{new Date(entry.date).getDate()}</span>
                                </div>
                                <div className="text-sm font-semibold text-slate-800">{entry.description}</div>
                              </div>
                              <button onClick={() => deleteTravel(entry.id)} className="p-2 text-slate-300 hover:text-red-500 transition-all">
                                <Trash2 size={16} />
                              </button>
                            </div>
                            <div className="flex justify-between items-center pl-[60px]">
                              <span className={`uppercase text-[10px] font-bold px-2 py-0.5 rounded ${
                                entry.type === 'auto' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                              }`}>
                                {entry.type}
                              </span>
                              <div className="text-right">
                                <span className="mono-value text-xs text-slate-900 block">{entry.distance.toFixed(1)} km</span>
                                <span className="text-[10px] text-green-600 font-bold">€{(entry.distance * TRANSPORT_RATES[entry.type]).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="reports-grid"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
                    >
                      {groupedMonthlyData.map(([key, stats]) => (
                        <div key={key} className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm hover:border-brand-primary/30 transition-all group">
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <h4 className="text-base md:text-lg font-bold text-slate-900 capitalize">{key}</h4>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Maandrapport</p>
                            </div>
                            <button 
                              onClick={() => exportToExcel(key)}
                              className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                            >
                              <Download size={14} /> <span className="hidden sm:inline">Excel</span>
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 md:gap-4">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center sm:text-left">
                              <span className="label-tiny">Gewerkte Uren</span>
                              <span className="block text-lg md:text-xl mono-value text-slate-900">{formatMonoTime(stats.workMin)}</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center sm:text-left">
                              <span className="label-tiny">Reiskosten</span>
                              <span className="block text-lg md:text-xl mono-value text-green-600">€{stats.travelComp.toFixed(2)}</span>
                            </div>
                            <div className="col-span-2 flex items-center justify-between px-2 pt-2 border-t border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Afstand</span>
                              <span className="text-xs font-bold text-slate-500">{stats.travelKm.toFixed(1)} km</span>
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
                    </motion.div>
                  )}
                </AnimatePresence>
                {(activeTab === 'hours' ? prunedWorkEntries.length : activeTab === 'travel' ? prunedTravelEntries.length : 0) === 0 && activeTab !== 'reports' && (
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
