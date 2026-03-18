import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Trash2, CreditCard, Settings, RotateCcw, 
  FileText, Activity, Target, ShieldCheck, Landmark, LogOut 
} from 'lucide-react';

// Firebase Imports
import { db, auth } from './firebase';
import { doc, getDoc, setDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const INITIAL_PLANUNG = [
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

  // States
  const [startBalance, setStartBalance] = useState(2115.91);
  const [recurringItems, setRecurringItems] = useState(INITIAL_PLANUNG);
  const [transactions, setTransactions] = useState([]);
  const [reserves, setReserves] = useState([
    { id: 1, label: 'Notgroschen', initial: 5000, monthlyLink: null },
    { id: 2, label: 'Instandhaltung Haus', initial: 2000, monthlyLink: 'Sparrate Instandhaltung' }
  ]);

  const [newRes, setNewRes] = useState({ label: '', initial: '', monthlyLink: '' });
  const [newTrans, setNewTrans] = useState({ 
    date: new Date().toISOString().split('T')[0], label: '', type: 'expense', amount: '', linkedReserveId: '' 
  });

  // AUTH OBSERVER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // LOGIN
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPass);
    } catch (err) {
      alert("Login fehlgeschlagen: Prüfen Sie E-Mail und Passwort.");
    }
  };

  // LOAD DATA
  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      const docRef = doc(db, "users", user.uid, "budget", "herrenberg_2026");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStartBalance(data.startBalance || 0);
        setRecurringItems(data.recurringItems || INITIAL_PLANUNG);
        setTransactions(data.transactions || []);
        setReserves(data.reserves || []);
      }
      setIsLoaded(true);
    };
    loadData();
  }, [user]);

  // SAVE DATA
  useEffect(() => {
    if (!user || !isLoaded) return;
    const timer = setTimeout(async () => {
      await setDoc(doc(db, "users", user.uid, "budget", "herrenberg_2026"), {
        startBalance, recurringItems, transactions, reserves, updatedAt: new Date().toISOString()
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [startBalance, recurringItems, transactions, reserves, user, isLoaded]);

  // BERECHNUNGEN (Sales Controller Logik)
  const dashboardData = useMemo(() => {
    let runningTotalBalance = startBalance;
    return MONATE.map((_, mIdx) => {
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

      const totalRes = currentReservesStatus.reduce((sum, r) => sum + r.balance, 0);
      return { 
        fixInc, varInc, fixExp, varExpNormal, operativeSaldo, 
        reservesDetail: currentReservesStatus, totalReserves: totalRes, 
        liquidBalance: runningTotalBalance - totalRes, realTotalBalance: runningTotalBalance 
      };
    });
  }, [recurringItems, transactions, startBalance, reserves]);

  const formatCurrency = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center font-black text-slate-400 uppercase">Sicherheits-Check...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="bg-slate-900 w-12 h-12 rounded-xl flex items-center justify-center text-white mx-auto mb-4"><ShieldCheck/></div>
            <h2 className="font-black uppercase text-2xl tracking-tighter">Hauskonto Login</h2>
          </div>
          <div className="space-y-4">
            <input type="email" placeholder="E-Mail" className="w-full p-4 bg-slate-100 rounded-xl font-bold outline-none focus:ring-2 ring-indigo-500" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
            <input type="password" placeholder="Passwort" className="w-full p-4 bg-slate-100 rounded-xl font-bold outline-none focus:ring-2 ring-indigo-500" value={loginPass} onChange={e => setLoginPass(e.target.value)} />
            <button type="submit" className="w-full bg-indigo-600 text-white p-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">Anmelden</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      {!isLoaded && <div className="fixed inset-0 bg-white/90 z-50 flex items-center justify-center font-black uppercase animate-pulse">Daten werden geladen...</div>}
      
      <div className="max-w-[1600px] mx-auto p-2 md:p-6">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-lg text-white"><Landmark size={20}/></div>
            <div>
              <h1 className="text-lg font-black uppercase leading-none">Hauskonto</h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Herrenberg 2026 | {user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <nav className="flex bg-white p-1 rounded-xl shadow-sm border flex-1 overflow-x-auto no-scrollbar">
              {[
                { id: 'summary', label: 'Dashboard', icon: Activity },
                { id: 'overview', label: 'Planung', icon: FileText },
                { id: 'journal', label: 'Journal', icon: CreditCard },
                { id: 'reserves', label: 'Rücklagen', icon: ShieldCheck },
                { id: 'settings', label: 'Setup', icon: Settings }
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>
                  <tab.icon size={14}/> {tab.label}
                </button>
              ))}
            </nav>
            <button onClick={() => signOut(auth)} className="bg-rose-50 text-rose-600 p-2.5 rounded-xl hover:bg-rose-100 transition-all"><LogOut size={20}/></button>
          </div>
        </header>

        {/* 1. DASHBOARD */}
        {activeTab === 'summary' && (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden overflow-x-auto no-scrollbar">
            <table className="w-full text-[11px] md:text-xs text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase border-b">
                  <th className="p-4 sticky left-0 bg-slate-50 z-20 border-r w-56">Kennzahl</th>
                  <th className="p-4 text-center border-r bg-slate-100 italic w-24">Basis 25</th>
                  {MONATE.map(m => <th key={m} className="p-4 text-center border-r w-24">{m}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="text-slate-500 border-t italic">
                  <td className="p-3 pl-8 sticky left-0 bg-white z-10 border-r">Fixe Einnahmen</td>
                  <td className="bg-slate-50 border-r text-center opacity-30">---</td>
                  {dashboardData.map((d, i) => <td key={i} className="p-3 text-center border-r">{formatCurrency(d.fixInc)}</td>)}
                </tr>
                <tr className="text-slate-500 border-t italic">
                  <td className="p-3 pl-8 sticky left-0 bg-white z-10 border-r">Variable Einnahmen</td>
                  <td className="bg-slate-50 border-r text-center opacity-30">---</td>
                  {dashboardData.map((d, i) => <td key={i} className="p-3 text-center border-r">{formatCurrency(d.varInc)}</td>)}
                </tr>
                <tr className="text-slate-500 border-t italic">
                  <td className="p-3 pl-8 sticky left-0 bg-white z-10 border-r text-rose-400">Fixe Ausgaben (-)</td>
                  <td className="bg-slate-50 border-r text-center opacity-30">---</td>
                  {dashboardData.map((d, i) => <td key={i} className="p-3 text-center border-r text-rose-400">-{formatCurrency(d.fixExp)}</td>)}
                </tr>
                <tr className="bg-indigo-600 text-white font-black">
                  <td className="p-4 sticky left-0 bg-indigo-600 z-10 border-r uppercase text-[10px]">Monatssaldo (Op.)</td>
                  <td className="bg-indigo-700 border-r text-center opacity-50 italic">---</td>
                  {dashboardData.map((d, i) => <td key={i} className="p-4 text-center border-r">{formatCurrency(d.operativeSaldo)}</td>)}
                </tr>
                <tr className="bg-slate-100 text-[8px] font-black uppercase text-slate-400 border-t"><td colSpan={14} className="p-2 px-5">Rücklagen-Stände</td></tr>
                {reserves.map(res => (
                  <tr key={res.id} className="text-slate-600 border-t">
                    <td className="p-3 pl-8 sticky left-0 bg-white z-10 border-r font-bold">{res.label}</td>
                    <td className="bg-slate-50 border-r text-center font-bold text-slate-400">{formatCurrency(res.initial)}</td>
                    {dashboardData.map((d, i) => <td key={i} className="p-3 text-center border-r opacity-70">{formatCurrency(d.reservesDetail.find(r => r.label === res.label)?.balance || 0)}</td>)}
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
        )}

        {/* 2. PLANUNG */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 bg-slate-50 font-black border-b flex justify-between items-center text-[10px] uppercase text-slate-500">
              Fixkosten Jahresmatrix
              <button onClick={() => setRecurringItems([...recurringItems, { id: Date.now(), label: 'Neue Position', type: 'expense', values: Array(12).fill(0) }])} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2"><Plus size={14}/> Zeile</button>
            </div>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1300px]">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase border-b">
                    <th className="p-4 sticky left-0 bg-slate-50 z-20 border-r w-80">Bezeichnung</th>
                    <th className="p-4 border-r w-32 text-center">Typ</th>
                    {MONATE.map(m => <th key={m} className="p-4 text-center border-r">{m}</th>)}
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
                            const n = [...item.values]; n[idx] = parseFloat(e.target.value) || 0;
                            setRecurringItems(recurringItems.map(i => i.id === item.id ? {...i, values: n} : i));
                          }} />
                        </td>
                      ))}
                      <td className="p-2 text-center">
                        <button onClick={() => setRecurringItems(recurringItems.filter(i => i.id !== item.id))} className="text-slate-200 hover:text-rose-500"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. JOURNAL (War leer) */}
        {activeTab === 'journal' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl border shadow-sm sticky top-6 space-y-4">
                <h2 className="font-black text-[10px] uppercase text-slate-400 border-b pb-2 tracking-widest flex items-center gap-2"><CreditCard size={14}/> Beleg buchen</h2>
                <input type="date" className="w-full p-3 rounded-xl border bg-slate-50 text-xs font-bold" value={newTrans.date} onChange={e => setNewTrans({...newTrans, date: e.target.value})} />
                <input type="text" placeholder="Zweck..." className="w-full p-3 rounded-xl border bg-slate-50 text-xs font-bold" value={newTrans.label} onChange={e => setNewTrans({...newTrans, label: e.target.value})} />
                <input type="number" placeholder="Betrag €" className="w-full p-3 rounded-xl border bg-slate-50 text-xs font-black" value={newTrans.amount} onChange={e => setNewTrans({...newTrans, amount: e.target.value})} />
                <div className="p-3 bg-indigo-50 rounded-xl space-y-2">
                  <label className="text-[8px] font-black text-indigo-400 uppercase block ml-1">Finanzierung</label>
                  <select className="w-full p-2.5 rounded-lg border text-[10px] font-bold outline-none cursor-pointer" value={newTrans.linkedReserveId} onChange={e => setNewTrans({...newTrans, linkedReserveId: e.target.value})}>
                    <option value="">Laufendes Konto</option>
                    {reserves.map(r => <option key={r.id} value={r.id}>Rücklage: {r.label}</option>)}
                  </select>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button type="button" onClick={() => setNewTrans({...newTrans, type: 'expense'})} className={`flex-1 py-2 rounded-lg text-[9px] font-black ${newTrans.type === 'expense' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500'}`}>AUSGABE</button>
                  <button type="button" onClick={() => setNewTrans({...newTrans, type: 'income'})} className={`flex-1 py-2 rounded-lg text-[9px] font-black ${newTrans.type === 'income' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}>EINNAHME</button>
                </div>
                <button onClick={() => { if(newTrans.label && newTrans.amount) { setTransactions([{...newTrans, id: Date.now(), amount: parseFloat(newTrans.amount)}, ...transactions]); setNewTrans({...newTrans, label: '', amount: ''}); }}} className="w-full bg-slate-900 text-white p-4 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-600 shadow-lg">Buchen</button>
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b">
                    <tr><th className="p-5">Datum</th><th className="p-5">Zweck</th><th className="p-5">Quelle</th><th className="p-5 text-right">Betrag</th><th className="p-5 w-10"></th></tr>
                  </thead>
                  <tbody>
                    {transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).map(t => (
                      <tr key={t.id} className="border-b hover:bg-slate-50 italic">
                        <td className="p-5 text-slate-400 font-bold">{new Date(t.date).toLocaleDateString('de-DE')}</td>
                        <td className="p-5 font-black text-slate-800 uppercase">{t.label}</td>
                        <td className="p-5">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${t.linkedReserveId ? 'bg-indigo-500 text-white' : 'border text-slate-400'}`}>
                            {t.linkedReserveId ? reserves.find(r => String(r.id) === String(t.linkedReserveId))?.label : 'Konto'}
                          </span>
                        </td>
                        <td className={`p-5 text-right font-black ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</td>
                        <td className="p-5 text-center"><button onClick={() => setTransactions(transactions.filter(x => x.id !== t.id))} className="text-slate-200 hover:text-rose-500"><Trash2 size={16}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. RÜCKLAGEN (War leer) */}
        {activeTab === 'reserves' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
                <h2 className="text-[10px] font-black uppercase text-slate-400 border-b pb-2 tracking-widest flex items-center gap-2"><Target size={16}/> Topf erstellen</h2>
                <input type="text" placeholder="Bezeichnung (z.B. Haus)" className="w-full p-3 rounded-xl border bg-slate-50 text-xs font-bold" value={newRes.label} onChange={e => setNewRes({...newRes, label: e.target.value})} />
                <input type="number" placeholder="Startbestand €" className="w-full p-3 rounded-xl border bg-slate-50 text-xs font-bold" value={newRes.initial} onChange={e => setNewRes({...newRes, initial: e.target.value})} />
                <select className="w-full p-3 rounded-xl border bg-slate-50 text-xs font-bold" value={newRes.monthlyLink} onChange={e => setNewRes({...newRes, monthlyLink: e.target.value})}>
                  <option value="">Keine Sparrate koppeln</option>
                  {recurringItems.filter(i => i.type === 'expense').map(i => <option key={i.id} value={i.label}>{i.label}</option>)}
                </select>
                <button onClick={() => { if(newRes.label) { setReserves([...reserves, { id: Date.now(), ...newRes }]); setNewRes({label:'', initial:'', monthlyLink:''}); }}} className="w-full bg-slate-900 text-white p-4 rounded-xl font-black text-[10px] uppercase shadow-xl hover:bg-indigo-600">Topf Aktivieren</button>
              </div>
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {reserves.map(res => (
                <div key={res.id} className="bg-white p-6 rounded-2xl border shadow-sm group hover:border-indigo-200 transition-all">
                  <div className="flex justify-between mb-4">
                    <div>
                      <h3 className="font-black text-slate-900 text-sm uppercase">{res.label}</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{res.monthlyLink ? `Gekoppelt: ${res.monthlyLink}` : 'Statischer Topf'}</p>
                    </div>
                    <button onClick={() => setReserves(reserves.filter(r => r.id !== res.id))} className="text-slate-200 hover:text-rose-500"><Trash2 size={16}/></button>
                  </div>
                  <div className="text-2xl font-black text-indigo-600">
                    {formatCurrency(Number(res.initial) + (recurringItems.find(i => i.label === res.monthlyLink)?.values.reduce((a, b) => a + b, 0) || 0) - transactions.filter(t => String(t.linkedReserveId) === String(res.id)).reduce((sum, t) => sum + t.amount, 0))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. SETUP (War leer) */}
        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto bg-white p-8 rounded-3xl border shadow-sm space-y-8">
            <div className="text-center">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 italic">Startkontostand (Basis 2026)</label>
              <input type="number" step="0.01" className="w-full p-5 rounded-2xl border bg-slate-100 text-3xl font-black text-center outline-none focus:bg-white shadow-inner" value={startBalance} onChange={(e) => setStartBalance(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="pt-8 border-t">
              <button onClick={() => { if(window.confirm('Alle Daten unwiderruflich löschen?')) { setTransactions([]); setRecurringItems(INITIAL_PLANUNG); setReserves([]); }}} className="w-full py-4 text-rose-600 rounded-xl border-2 border-rose-100 hover:bg-rose-50 font-black text-[10px] uppercase flex items-center justify-center gap-3"><RotateCcw size={18}/> App Reset</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;