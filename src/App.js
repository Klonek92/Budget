import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Trash2, CreditCard, Settings, RotateCcw, 
  FileText, Activity, Target, ShieldCheck, Landmark, LogOut 
} from 'lucide-react';

// Firebase Imports
import { db, auth } from './firebase';
import { doc, getDoc, setDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const INITIAL_RECURRING = [
  { id: 1, label: 'Gehalt 1', type: 'income', values: Array(12).fill(3257) },
  { id: 2, label: 'Kindergeld', type: 'income', values: Array(12).fill(500) },
  { id: 3, label: 'Hypothek', type: 'expense', values: Array(12).fill(1650) },
  { id: 4, label: 'Sparrate Instandhaltung', type: 'expense', values: Array(12).fill(400) }
];

const App = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  
  const [activeTab, setActiveTab] = useState('summary');
  const [isLoaded, setIsLoaded] = useState(false);
  const [startBalance, setStartBalance] = useState(2115.91);
  const [recurringItems, setRecurringItems] = useState(INITIAL_RECURRING);
  const [transactions, setTransactions] = useState([]);
  const [reserves, setReserves] = useState([
    { id: 1, label: 'Notgroschen', initial: 5000, monthlyLink: null },
    { id: 2, label: 'Instandhaltung Haus', initial: 2000, monthlyLink: 'Sparrate Instandhaltung' }
  ]);

  const [newRes, setNewRes] = useState({ label: '', initial: '', monthlyLink: '' });
  const [newTrans, setNewTrans] = useState({ 
    date: new Date().toISOString().split('T')[0], label: '', type: 'expense', amount: '', linkedReserveId: '' 
  });

  // AUTH STATE OBSERVER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (!currentUser) setIsLoaded(false);
    });
    return () => unsubscribe();
  }, []);

  // LOGIN FUNKTION
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPass);
    } catch (err) {
      alert("Login fehlgeschlagen: " + err.message);
    }
  };

  // DATEN LADEN (Nur wenn User eingeloggt)
  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        const docRef = doc(db, "users", user.uid, "budget", "herrenberg_2026");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStartBalance(data.startBalance);
          setRecurringItems(data.recurringItems);
          setTransactions(data.transactions);
          setReserves(data.reserves);
        }
        setIsLoaded(true);
      } catch (error) {
        console.error("Ladefehler:", error);
      }
    };
    loadData();
  }, [user]);

  // DATEN SPEICHERN (Debounced)
  useEffect(() => {
    if (!user || !isLoaded) return;
    const saveData = async () => {
      try {
        await setDoc(doc(db, "users", user.uid, "budget", "herrenberg_2026"), {
          startBalance, recurringItems, transactions, reserves, updatedAt: new Date().toISOString()
        });
      } catch (error) { console.error("Speicherfehler:", error); }
    };
    const timer = setTimeout(saveData, 1500);
    return () => clearTimeout(timer);
  }, [startBalance, recurringItems, transactions, reserves, user, isLoaded]);

  // LOGIK Dashboard & Formatierung (Bleibt gleich)
  const dashboardData = useMemo(() => {
    let runningTotalBalance = startBalance;
    return MONTHS.map((_, mIdx) => {
      const fixInc = recurringItems.filter(i => i.type === 'income').reduce((sum, i) => sum + (i.values[mIdx] || 0), 0);
      const varInc = transactions.filter(t => new Date(t.date).getMonth() === mIdx && t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
      const fixExp = recurringItems.filter(i => i.type === 'expense').reduce((sum, i) => sum + (i.values[mIdx] || 0), 0);
      const varExpNormal = transactions.filter(t => new Date(t.date).getMonth() === mIdx && t.type === 'expense' && !t.linkedReserveId).reduce((sum, t) => sum + (t.amount || 0), 0);
      const varExpReserve = transactions.filter(t => new Date(t.date).getMonth() === mIdx && t.type === 'expense' && t.linkedReserveId).reduce((sum, t) => sum + (t.amount || 0), 0);
      const operativeSaldo = (fixInc + varInc) - (fixExp + varExpNormal);
      const realCashflow = (fixInc + varInc) - (fixExp + varExpNormal + varExpReserve);
      runningTotalBalance += realCashflow;
      const currentReservesStatus = reserves.map(res => {
        const linkedItem = recurringItems.find(i => i.label === res.monthlyLink);
        const savedUntilNow = linkedItem ? linkedItem.values.slice(0, mIdx + 1).reduce((a, b) => a + b, 0) : 0;
        const spentUntilNow = transactions.filter(t => String(t.linkedReserveId) === String(res.id) && new Date(t.date).getMonth() <= mIdx).reduce((sum, t) => sum + t.amount, 0);
        return { label: res.label, balance: Number(res.initial) + savedUntilNow - spentUntilNow };
      });
      return { fixInc, varInc, fixExp, varExpNormal, operativeSaldo, reservesDetail: currentReservesStatus, totalReserves: currentReservesStatus.reduce((sum, r) => sum + r.balance, 0), liquidBalance: runningTotalBalance - currentReservesStatus.reduce((sum, r) => sum + r.balance, 0), realTotalBalance: runningTotalBalance };
    });
  }, [recurringItems, transactions, startBalance, reserves]);

  const formatCurrency = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);

  // AUTH LOADING SCREEN
  if (authLoading) return <div className="min-h-screen flex items-center justify-center font-black uppercase text-slate-400">Verifiziere Zugriff...</div>;

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="bg-slate-900 w-12 h-12 rounded-xl flex items-center justify-center text-white mx-auto mb-4"><ShieldCheck/></div>
            <h2 className="font-black uppercase tracking-tighter text-2xl">Hauskonto Login</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Herrenberg Private Access</p>
          </div>
          <div className="space-y-4">
            <input type="email" placeholder="E-Mail" className="w-full p-4 bg-slate-100 rounded-xl font-bold outline-none focus:ring-2 ring-indigo-500" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
            <input type="password" placeholder="Passwort" className="w-full p-4 bg-slate-100 rounded-xl font-bold outline-none focus:ring-2 ring-indigo-500" value={loginPass} onChange={e => setLoginPass(e.target.value)} />
            <button type="submit" className="w-full bg-indigo-600 text-white p-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">Entsperren</button>
          </div>
        </form>
      </div>
    );
  }

  // HAUPT-APP UI (Gekürzt auf Navigation/Header für Übersicht)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      {!isLoaded && <div className="fixed inset-0 bg-white/90 z-50 flex items-center justify-center font-black uppercase animate-pulse">Synchronisiere...</div>}
      
      <div className="max-w-[1600px] mx-auto p-2 md:p-6">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-lg text-white"><Landmark size={20}/></div>
            <div>
              <h1 className="text-lg font-black uppercase leading-none">Hauskonto</h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">User: {user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <nav className="flex bg-white p-1 rounded-xl shadow-sm border flex-1 overflow-x-auto no-scrollbar">
              {['summary', 'overview', 'journal', 'reserves', 'settings'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
                  {tab}
                </button>
              ))}
            </nav>
            <button onClick={() => signOut(auth)} className="bg-rose-50 text-rose-600 p-2.5 rounded-xl hover:bg-rose-100 transition-all"><LogOut size={20}/></button>
          </div>
        </header>

        {/* Tab-Inhalte wie zuvor... */}
        {activeTab === 'summary' && (
           <div className="space-y-4 animate-in fade-in duration-300">
             <div className="bg-white rounded-2xl shadow-sm border overflow-hidden overflow-x-auto no-scrollbar">
                <table className="w-full text-[11px] md:text-xs text-left border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase border-b">
                      <th className="p-4 sticky left-0 bg-slate-50 z-20 border-r w-56">Kennzahl</th>
                      <th className="p-4 text-center border-r bg-slate-100 italic w-24">Basis 25</th>
                      {MONTHS.map(m => <th key={m} className="p-4 text-center border-r w-24">{m}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-slate-500 border-t italic">
                      <td className="p-3 pl-8 sticky left-0 bg-white z-10 border-r">Fixe Einnahmen</td>
                      <td className="bg-slate-50 border-r text-center opacity-30">---</td>
                      {dashboardData.map((d, i) => <td key={i} className="p-3 text-center border-r">{formatCurrency(d.fixInc)}</td>)}
                    </tr>
                    {/* ... Restliche Zeilen des Dashboards (Identisch mit deinem Code) ... */}
                    <tr className="text-slate-500 border-t italic">
                      <td className="p-3 pl-8 sticky left-0 bg-white z-10 border-r">Variable Einnahmen</td>
                      <td className="bg-slate-50 border-r text-center opacity-30">---</td>
                      {dashboardData.map((d, i) => <td key={i} className="p-3 text-center border-r">{formatCurrency(d.varInc)}</td>)}
                    </tr>
                    <tr className="text-slate-500 border-t italic">
                      <td className="p-3 pl-8 sticky left-0 bg-white z-10 border-r">Fixe Ausgaben</td>
                      <td className="bg-slate-50 border-r text-center opacity-30">---</td>
                      {dashboardData.map((d, i) => <td key={i} className="p-3 text-center border-r text-rose-400">-{formatCurrency(d.fixExp)}</td>)}
                    </tr>
                    <tr className="bg-indigo-600 text-white font-black">
                      <td className="p-4 sticky left-0 bg-indigo-600 z-10 border-r uppercase text-[10px] italic">Monatssaldo (Op.)</td>
                      <td className="bg-indigo-700 border-r text-center opacity-50">---</td>
                      {dashboardData.map((d, i) => <td key={i} className="p-4 text-center border-r">{formatCurrency(d.operativeSaldo)}</td>)}
                    </tr>
                    {/* Rücklagen Zeilen */}
                    {reserves.map(res => (
                      <tr key={res.id} className="text-slate-600 border-t">
                        <td className="p-4 pl-8 sticky left-0 bg-white z-10 border-r font-bold">{res.label}</td>
                        <td className="bg-slate-50 border-r text-center font-bold text-slate-400">{formatCurrency(res.initial)}</td>
                        {dashboardData.map((d, i) => (
                          <td key={i} className="p-4 text-center border-r opacity-70">
                            {formatCurrency(d.reservesDetail.find(r => r.label === res.label)?.balance || 0)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-300 font-black bg-emerald-50 text-emerald-900 italic">
                      <td className="p-4 sticky left-0 bg-emerald-50 z-10 border-r uppercase text-[10px]">Liquidität (Frei)</td>
                      <td className="bg-slate-50 border-r text-center text-emerald-700">{formatCurrency(startBalance - reserves.reduce((s, r) => s + Number(r.initial), 0))}</td>
                      {dashboardData.map((d, i) => <td key={i} className="p-4 text-center border-r">{formatCurrency(d.liquidBalance)}</td>)}
                    </tr>
                    <tr className="border-t border-slate-200 font-black bg-slate-900 text-white">
                      <td className="p-4 sticky left-0 bg-slate-900 z-10 border-r uppercase text-[10px]">Realer Kontostand</td>
                      <td className="p-4 text-center border-r border-slate-700 bg-slate-800 italic">{formatCurrency(startBalance)}</td>
                      {dashboardData.map((d, i) => <td key={i} className="p-4 text-center border-r border-slate-700 font-black">{formatCurrency(d.realTotalBalance)}</td>)}
                    </tr>
                  </tbody>
                </table>
             </div>
           </div>
        )}

        {/* Die restlichen Tabs (overview, journal, reserves, settings) folgen hier - Logik identisch wie zuvor */}
        {activeTab === 'overview' && (
           <div className="bg-white rounded-2xl shadow-sm border overflow-hidden animate-in slide-in-from-left duration-300">
             <div className="p-4 bg-slate-50 font-black border-b flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-500">
               Jahresplanung Fixkosten
               <button onClick={() => setRecurringItems([...recurringItems, { id: Date.now(), label: 'Neue Position', type: 'expense', values: Array(12).fill(0) }])} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2"><Plus size={12}/> Zeile</button>
             </div>
             <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1300px]">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase border-b">
                      <th className="p-4 sticky left-0 bg-slate-50 z-20 border-r w-80">Bezeichnung</th>
                      <th className="p-4 border-r w-32 text-center">Typ</th>
                      {MONTHS.map(m => <th key={m} className="p-4 text-center border-r">{m}</th>)}
                      <th className="p-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {recurringItems.map(item => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="p-0 sticky left-0 bg-white z-10 border-r">
                          <input className="w-full p-4 font-bold outline-none focus:bg-slate-50 uppercase" value={item.label} onChange={(e) => setRecurringItems(recurringItems.map(i => i.id === item.id ? {...i, label: e.target.value} : i))} />
                        </td>
                        <td className="p-2 border-r text-center">
                          <button onClick={() => setRecurringItems(recurringItems.map(i => i.id === item.id ? {...i, type: i.type === 'income' ? 'expense' : 'income'} : i))} className={`w-full py-2 rounded-lg text-[9px] font-black uppercase ${item.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{item.type === 'income' ? 'EIN' : 'AUS'}</button>
                        </td>
                        {item.values.map((v, idx) => (
                          <td key={idx} className="p-0 border-r">
                            <input type="number" className="w-full p-4 text-center outline-none focus:bg-indigo-50 font-medium" value={v === 0 ? '' : v} onChange={(e) => {
                              const newVals = [...item.values];
                              newVals[idx] = parseFloat(e.target.value) || 0;
                              setRecurringItems(recurringItems.map(i => i.id === item.id ? {...i, values: newVals} : i));
                            }} />
                          </td>
                        ))}
                        <td className="p-2 text-center">
                          <button onClick={() => setRecurringItems(recurringItems.filter(i => i.id !== item.id))} className="text-slate-200 hover:text-rose-500"><Trash2 size={14}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
           </div>
        )}

        {/* ... (Die restlichen Tabs 'journal', 'reserves', 'settings' einfügen) ... */}

      </div>
    </div>
  );
};

export default App;