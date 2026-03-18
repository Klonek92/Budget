import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Trash2, CreditCard, Settings, RotateCcw, 
  FileText, Activity, Target, ShieldCheck, Landmark
} from 'lucide-react';

const MONTHS = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
];

const INITIAL_RECURRING = [
  { id: 1, label: 'Gehalt 1', type: 'income', values: Array(12).fill(3257) },
  { id: 2, label: 'Kindergeld', type: 'income', values: Array(12).fill(500) },
  { id: 3, label: 'Hypothek', type: 'expense', values: Array(12).fill(1650) },
  { id: 4, label: 'Sparrate Instandhaltung', type: 'expense', values: Array(12).fill(400) }
];

const App = () => {
  const [activeTab, setActiveTab] = useState('summary');
  
  const [startBalance, setStartBalance] = useState(() => {
    const saved = localStorage.getItem('h_budget_start_2025');
    return saved ? parseFloat(saved) : 2115.91;
  });

  const [recurringItems, setRecurringItems] = useState(() => {
    const saved = localStorage.getItem('h_budget_rec_2026_v11');
    return saved ? JSON.parse(saved) : INITIAL_RECURRING;
  });

  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('h_budget_trans_2026_v11');
    return saved ? JSON.parse(saved) : [];
  });

  const [reserves, setReserves] = useState(() => {
    const saved = localStorage.getItem('h_budget_reserves_v11');
    return saved ? JSON.parse(saved) : [
      { id: 1, label: 'Notgroschen', initial: 5000, monthlyLink: null },
      { id: 2, label: 'Instandhaltung Haus', initial: 2000, monthlyLink: 'Sparrate Instandhaltung' }
    ];
  });

  const [newRes, setNewRes] = useState({ label: '', initial: '', monthlyLink: '' });
  const [newTrans, setNewTrans] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    label: '', 
    type: 'expense', 
    amount: '',
    linkedReserveId: '' 
  });

  useEffect(() => {
    localStorage.setItem('h_budget_rec_2026_v11', JSON.stringify(recurringItems));
    localStorage.setItem('h_budget_trans_2026_v11', JSON.stringify(transactions));
    localStorage.setItem('h_budget_reserves_v11', JSON.stringify(reserves));
    localStorage.setItem('h_budget_start_2025', startBalance.toString());
  }, [recurringItems, transactions, reserves, startBalance]);

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
        const spentUntilNow = transactions
          .filter(t => String(t.linkedReserveId) === String(res.id) && new Date(t.date).getMonth() <= mIdx)
          .reduce((sum, t) => sum + t.amount, 0);
        return { label: res.label, balance: Number(res.initial) + savedUntilNow - spentUntilNow };
      });

      const totalResBalance = currentReservesStatus.reduce((sum, r) => sum + r.balance, 0);

      return {
        fixInc, varInc, fixExp, varExpNormal, varExpReserve,
        operativeSaldo,
        reservesDetail: currentReservesStatus,
        totalReserves: totalResBalance,
        liquidBalance: runningTotalBalance - totalResBalance,
        realTotalBalance: runningTotalBalance
      };
    });
  }, [recurringItems, transactions, startBalance, reserves]);

  const formatCurrency = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12 overflow-x-hidden">
      <div className="max-w-[1600px] mx-auto p-2 md:p-6">
        
        {/* Navigation */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 md:gap-3 px-2">
            <div className="bg-slate-900 p-2 rounded-lg text-white shadow-lg"><Landmark size={20}/></div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tighter uppercase leading-none">Hauskonto</h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Herrenberg 2026</p>
            </div>
          </div>
          <nav className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-full lg:w-auto overflow-x-auto no-scrollbar">
            {[
              { id: 'summary', label: 'Dashboard', icon: Activity },
              { id: 'overview', label: 'Planung', icon: FileText },
              { id: 'journal', label: 'Journal', icon: CreditCard },
              { id: 'reserves', label: 'Rücklagen', icon: ShieldCheck },
              { id: 'settings', label: 'Setup', icon: Settings }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 md:px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        {/* DASHBOARD */}
        {activeTab === 'summary' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-[11px] md:text-xs text-left border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-slate-50 text-[9px] md:text-[10px] font-black text-slate-400 uppercase border-b">
                      <th className="p-3 md:p-4 sticky left-0 bg-slate-50 z-20 border-r w-32 md:w-56 shadow-sm">Kennzahl</th>
                      <th className="p-3 md:p-4 text-center border-r bg-slate-100 italic w-24">Basis 25</th>
                      {MONTHS.map(m => <th key={m} className="p-3 md:p-4 text-center border-r w-24">{m}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-slate-500 border-t border-slate-100 italic">
                      <td className="p-2 md:p-3 pl-4 md:pl-8 sticky left-0 bg-white z-10 border-r truncate max-w-[128px] md:max-w-none">Fixe Einnahmen</td>
                      <td className="bg-slate-50 border-r text-center opacity-30">---</td>
                      {dashboardData.map((d, i) => <td key={i} className="p-2 md:p-3 text-center border-r">{formatCurrency(d.fixInc)}</td>)}
                    </tr>
                    <tr className="text-slate-500 border-t border-slate-100 italic">
                      <td className="p-2 md:p-3 pl-4 md:pl-8 sticky left-0 bg-white z-10 border-r truncate max-w-[128px] md:max-w-none">Variable Einnahmen</td>
                      <td className="bg-slate-50 border-r text-center opacity-30">---</td>
                      {dashboardData.map((d, i) => <td key={i} className="p-2 md:p-3 text-center border-r">{formatCurrency(d.varInc)}</td>)}
                    </tr>
                    <tr className="text-slate-500 border-t border-slate-100 italic">
                      <td className="p-2 md:p-3 pl-4 md:pl-8 sticky left-0 bg-white z-10 border-r truncate max-w-[128px] md:max-w-none">Fixe Ausgaben</td>
                      <td className="bg-slate-50 border-r text-center opacity-30">---</td>
                      {dashboardData.map((d, i) => <td key={i} className="p-2 md:p-3 text-center border-r text-rose-400">-{formatCurrency(d.fixExp)}</td>)}
                    </tr>
                    <tr className="text-slate-500 border-t border-slate-100 italic">
                      <td className="p-2 md:p-3 pl-4 md:pl-8 sticky left-0 bg-white z-10 border-r truncate max-w-[128px] md:max-w-none">Variable Ausgaben (Op.)</td>
                      <td className="bg-slate-50 border-r text-center opacity-30">---</td>
                      {dashboardData.map((d, i) => <td key={i} className="p-2 md:p-3 text-center border-r text-rose-400">-{formatCurrency(d.varExpNormal)}</td>)}
                    </tr>

                    <tr className="bg-indigo-600 text-white font-black border-t-2 border-indigo-700">
                      <td className="p-3 md:p-4 sticky left-0 bg-indigo-600 z-10 border-r uppercase text-[9px] md:text-[10px] tracking-widest italic truncate max-w-[128px] md:max-w-none">Monatssaldo (Op.)</td>
                      <td className="bg-indigo-700 border-r text-center opacity-50 italic">---</td>
                      {dashboardData.map((d, i) => <td key={i} className="p-3 md:p-4 text-center border-r font-bold">{formatCurrency(d.operativeSaldo)}</td>)}
                    </tr>

                    <tr className="bg-slate-100 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-400 border-t border-slate-200">
                      <td colSpan={14} className="p-2 px-3 md:px-5 sticky left-0 z-10">Rücklagen-Stände</td>
                    </tr>
                    {reserves.map(res => (
                      <tr key={res.id} className="text-slate-600 border-t border-slate-100">
                        <td className="p-3 md:p-4 pl-4 md:pl-8 sticky left-0 bg-white z-10 border-r text-[10px] md:text-[11px] font-bold truncate max-w-[128px] md:max-w-none">{res.label}</td>
                        <td className="bg-slate-50 border-r text-center font-bold text-slate-400">{formatCurrency(res.initial)}</td>
                        {dashboardData.map((d, i) => (
                          <td key={i} className="p-3 md:p-4 text-center border-r opacity-70">
                            {formatCurrency(d.reservesDetail.find(r => r.label === res.label)?.balance || 0)}
                          </td>
                        ))}
                      </tr>
                    ))}

                    <tr className="border-t-2 border-slate-300 font-black bg-emerald-50 text-emerald-900 italic">
                      <td className="p-3 md:p-4 sticky left-0 bg-emerald-50 z-10 border-r uppercase text-[9px] md:text-[10px] tracking-widest truncate max-w-[128px] md:max-w-none">Liquidität (Frei)</td>
                      <td className="bg-slate-50 border-r text-center text-emerald-700 font-bold">{formatCurrency(startBalance - reserves.reduce((s, r) => s + Number(r.initial), 0))}</td>
                      {dashboardData.map((d, i) => <td key={i} className="p-3 md:p-4 text-center border-r font-black">{formatCurrency(d.liquidBalance)}</td>)}
                    </tr>

                    <tr className="border-t border-slate-200 font-black bg-slate-900 text-white">
                      <td className="p-3 md:p-4 sticky left-0 bg-slate-900 z-10 border-r uppercase text-[9px] md:text-[10px] tracking-widest truncate max-w-[128px] md:max-w-none">Realer Kontostand</td>
                      <td className="p-3 md:p-4 text-center border-r border-slate-700 bg-slate-800 italic">{formatCurrency(startBalance)}</td>
                      {dashboardData.map((d, i) => <td key={i} className="p-3 md:p-4 text-center border-r border-slate-700 font-black">{formatCurrency(d.realTotalBalance)}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PLANUNG (FIXKOSTEN MATRIX) */}
        {activeTab === 'overview' && (
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in slide-in-from-left duration-300">
             <div className="p-3 md:p-4 bg-slate-50 font-black border-b flex items-center justify-between text-[9px] md:text-[10px] uppercase tracking-widest text-slate-500">
               Jahresplanung Fixkosten
               <button onClick={() => setRecurringItems([...recurringItems, { id: Date.now(), label: 'Neue Position', type: 'expense', values: Array(12).fill(0) }])} className="bg-indigo-600 text-white text-[8px] md:text-[9px] font-black uppercase flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-sm hover:bg-indigo-700"><Plus size={12}/> Zeile</button>
             </div>
             <div className="overflow-x-auto no-scrollbar">
               <table className="w-full text-left border-collapse min-w-[1100px] md:min-w-[1300px]">
                 <thead>
                   <tr className="bg-slate-50 text-[9px] md:text-[10px] font-black text-slate-500 uppercase border-b">
                     <th className="p-3 md:p-4 sticky left-0 bg-slate-50 z-20 border-r w-32 md:w-80 shadow-sm">Zweck / Bezeichnung</th>
                     <th className="p-3 md:p-4 border-r w-24 md:w-32 text-center">Typ</th>
                     {MONTHS.map(m => <th key={m} className="p-2 md:p-4 text-center border-r">{m}</th>)}
                     <th className="p-3 w-10"></th>
                   </tr>
                 </thead>
                 <tbody className="text-[11px] md:text-xs">
                   {recurringItems.map(item => (
                     <tr key={item.id} className="border-t border-slate-100 group">
                       <td className="p-0 sticky left-0 bg-white z-10 border-r w-32 md:w-80">
                         <input className="w-full p-2.5 md:p-4 font-bold bg-transparent outline-none focus:bg-slate-50 text-slate-800 uppercase tracking-tighter truncate" value={item.label} onChange={(e) => setRecurringItems(recurringItems.map(i => i.id === item.id ? {...i, label: e.target.value} : i))} />
                       </td>
                       <td className="p-1 md:p-2 border-r text-center">
                          <button onClick={() => setRecurringItems(recurringItems.map(i => i.id === item.id ? {...i, type: i.type === 'income' ? 'expense' : 'income'} : i))} className={`w-full py-1.5 md:py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase ${item.type === 'income' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>{item.type === 'income' ? 'EIN' : 'AUS'}</button>
                       </td>
                       {item.values.map((v, idx) => (
                         <td key={idx} className="p-0 border-r">
                           <input type="number" step="0.01" className={`w-full p-2.5 md:p-4 text-center outline-none focus:bg-indigo-50 font-medium ${item.type === 'income' ? 'text-emerald-600 font-black' : 'text-slate-800 font-bold'}`} value={v === 0 ? '' : v} onChange={(e) => {
                             const newVals = [...item.values];
                             newVals[idx] = parseFloat(e.target.value) || 0;
                             setRecurringItems(recurringItems.map(i => i.id === item.id ? {...i, values: newVals} : i));
                           }} />
                         </td>
                       ))}
                       <td className="p-1 md:p-2 text-center">
                         <button onClick={() => setRecurringItems(recurringItems.filter(i => i.id !== item.id))} className="text-slate-200 hover:text-rose-500"><Trash2 size={14}/></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
        )}

        {/* JOURNAL */}
        {activeTab === 'journal' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in slide-in-from-right duration-200">
            <div className="lg:col-span-1">
              <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-6">
                <h2 className="font-black text-[9px] md:text-[10px] uppercase text-slate-400 mb-6 border-b pb-2 tracking-widest italic flex items-center gap-2">
                   <CreditCard size={14}/> Beleg buchen
                </h2>
                <form onSubmit={(e) => { 
                  e.preventDefault(); 
                  const amt = parseFloat(newTrans.amount); 
                  if(newTrans.label && amt) { 
                    setTransactions([{ ...newTrans, id: Date.now(), amount: amt }, ...transactions]); 
                    setNewTrans({ ...newTrans, label: '', amount: '', linkedReserveId: '' }); 
                  }
                }} className="space-y-3">
                  <input type="date" className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold" value={newTrans.date} onChange={e => setNewTrans({...newTrans, date: e.target.value})} />
                  <input type="text" placeholder="Zweck / Beleg..." className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs" value={newTrans.label} onChange={e => setNewTrans({...newTrans, label: e.target.value})} />
                  <input type="number" step="0.01" placeholder="Betrag €" className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-black" value={newTrans.amount} onChange={e => setNewTrans({...newTrans, amount: e.target.value})} />
                  
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 space-y-2">
                    <label className="text-[8px] md:text-[9px] font-black text-indigo-400 uppercase tracking-widest block ml-1 italic">Finanzierung</label>
                    <select className="w-full p-2.5 rounded-lg border border-indigo-200 bg-white text-[10px] font-bold outline-none cursor-pointer" value={newTrans.linkedReserveId} onChange={e => setNewTrans({...newTrans, linkedReserveId: e.target.value})}>
                      <option value="">Laufendes Konto</option>
                      {reserves.map(r => <option key={r.id} value={r.id}>Rücklage: {r.label}</option>)}
                    </select>
                  </div>

                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button type="button" onClick={() => setNewTrans({...newTrans, type: 'expense'})} className={`flex-1 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all ${newTrans.type === 'expense' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500'}`}>AUSGABE</button>
                    <button type="button" onClick={() => setNewTrans({...newTrans, type: 'income'})} className={`flex-1 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all ${newTrans.type === 'income' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}>EINNAME</button>
                  </div>
                  <button type="submit" className="w-full bg-slate-900 text-white p-4 rounded-xl font-black text-[10px] md:text-xs uppercase hover:bg-indigo-600 transition-all shadow-lg tracking-widest mt-2">Buchen</button>
                </form>
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-[11px] md:text-xs text-left">
                  <thead className="bg-slate-50 text-[9px] md:text-[10px] font-black uppercase text-slate-400 border-b">
                    <tr>
                      <th className="p-3 md:p-5 w-24">Datum</th>
                      <th className="p-3 md:p-5">Zweck</th>
                      <th className="p-3 md:p-5 w-32 md:w-48">Gezahlt aus</th>
                      <th className="p-3 md:p-5 text-right w-24 md:w-32">Betrag</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).map(t => (
                      <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-all italic">
                        <td className="p-3 md:p-5 text-slate-400 font-bold">{new Date(t.date).toLocaleDateString('de-DE')}</td>
                        <td className="p-3 md:p-5 font-black text-slate-800 uppercase tracking-tighter truncate max-w-[100px] md:max-w-none">{t.label}</td>
                        <td className="p-3 md:p-5">
                          {t.linkedReserveId ? (
                            <span className="text-[8px] font-black uppercase text-white bg-indigo-500 px-2 py-0.5 rounded-full inline-block">
                              {reserves.find(r => String(r.id) === String(t.linkedReserveId))?.label}
                            </span>
                          ) : (
                            <span className="text-[8px] font-black uppercase text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full inline-block">Konto</span>
                          )}
                        </td>
                        <td className={`p-3 md:p-5 text-right font-black ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </td>
                        <td className="p-3 text-center">
                          <button onClick={() => setTransactions(transactions.filter(x => x.id !== t.id))} className="text-slate-200 hover:text-rose-500"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* RÜCKLAGEN */}
        {activeTab === 'reserves' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-8">
                  <h2 className="text-[10px] font-black uppercase text-slate-400 mb-6 border-b pb-2 tracking-widest flex items-center gap-2">
                    <Target size={16}/> Topf erstellen
                  </h2>
                  <div className="space-y-4">
                    <input type="text" placeholder="Zweck (z.B. Heizung)" className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white" value={newRes.label} onChange={e => setNewRes({...newRes, label: e.target.value})} />
                    <input type="number" placeholder="Bestand 01.01.26" className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white" value={newRes.initial} onChange={e => setNewRes({...newRes, initial: e.target.value})} />
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block ml-1 italic tracking-widest">Rate koppeln an:</label>
                      <select className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none cursor-pointer" value={newRes.monthlyLink} onChange={e => setNewRes({...newRes, monthlyLink: e.target.value})}>
                        <option value="">Keine Kopplung</option>
                        {recurringItems.filter(i => i.type === 'expense').map(i => <option key={i.id} value={i.label}>{i.label}</option>)}
                      </select>
                    </div>
                    <button onClick={() => { if(newRes.label) { setReserves([...reserves, { id: Date.now(), ...newRes }]); setNewRes({label:'', initial:'', monthlyLink:''}); }}} className="w-full bg-slate-900 text-white p-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all italic">Topf Aktivieren</button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {reserves.map(res => (
                  <div key={res.id} className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm relative group hover:border-indigo-200 transition-all">
                    <div className="flex justify-between mb-4">
                      <div>
                        <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight">{res.label}</h3>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Typ: {res.monthlyLink ? `Dynamisch` : 'Statisch'}</p>
                      </div>
                      <button onClick={() => setReserves(reserves.filter(r => r.id !== res.id))} className="text-slate-200 hover:text-rose-500 transition-colors p-2"><Trash2 size={16}/></button>
                    </div>
                    <div className="text-xl md:text-2xl font-black text-indigo-600 mb-6 flex items-baseline gap-1">
                      {formatCurrency(Number(res.initial) + (recurringItems.find(i => i.label === res.monthlyLink)?.values.reduce((a, b) => a + b, 0) || 0) - transactions.filter(t => String(t.linkedReserveId) === String(res.id)).reduce((sum, t) => sum + t.amount, 0))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SETUP */}
        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-300">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
              <div className="text-center">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest italic">Startbestand Konto (31.12.2025)</label>
                <input type="number" step="0.01" className="w-full p-4 md:p-5 rounded-2xl border border-slate-200 bg-slate-100 text-2xl md:text-3xl font-black outline-none focus:bg-white shadow-inner text-center" value={startBalance} onChange={(e) => setStartBalance(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="pt-8 border-t border-slate-100">
                <button onClick={() => { if(window.confirm('Daten löschen?')) { localStorage.clear(); window.location.reload(); }}} className="w-full py-4 text-rose-600 rounded-xl border-2 border-rose-100 hover:bg-rose-50 transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3"><RotateCcw size={18}/> Datenbank Reset</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;