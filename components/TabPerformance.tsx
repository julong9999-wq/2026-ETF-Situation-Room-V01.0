import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Wallet, TrendingUp, Plus, Upload, Download, 
    Trash2, Edit, X, LayoutDashboard, ChevronDown, ChevronRight,
    Book, Eraser, Briefcase, Coins, Layers
} from 'lucide-react';
import { UserTransaction, UserPosition, BasicInfo, DividendData } from '../types';
import { getBasicInfo, getDividendData, exportToCSV } from '../services/dataService';

const LOCAL_STORAGE_KEY = 'user_transactions_v1';
const KEY_BROKERS = 'user_lexicon_brokers';
const KEY_CATEGORIES = 'user_lexicon_categories';

const DEFAULT_BROKERS = ["國泰_爸", "國泰_媽", "國泰_小孩"];
const DEFAULT_CATEGORIES = ["自存退休", "質押貸款", "勞退理財"];

const TabPerformance: React.FC = () => {
    // --- STATE ---
    const [topTab, setTopTab] = useState<'HOLDINGS' | 'DIVIDEND' | 'PERFORMANCE'>('HOLDINGS');
    
    // Data
    const [transactions, setTransactions] = useState<UserTransaction[]>([]);
    const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
    const [systemDividends, setSystemDividends] = useState<DividendData[]>([]); 
    const [selectedCode, setSelectedCode] = useState<string | null>(null);

    // Lexicon
    const [brokerOptions, setBrokerOptions] = useState<string[]>(DEFAULT_BROKERS);
    const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_CATEGORIES);

    // Filters
    const [selectedBroker, setSelectedBroker] = useState<string>('ALL');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showLexiconModal, setShowLexiconModal] = useState<'BROKER' | 'CATEGORY' | null>(null);
    const [showSummaryModal, setShowSummaryModal] = useState(false);

    // Summary State
    const [summaryViewMode, setSummaryViewMode] = useState<'ACCOUNT' | 'DETAIL'>('ACCOUNT');
    const [expandedSummaryRows, setExpandedSummaryRows] = useState<Set<string>>(new Set());

    // Import State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importLog, setImportLog] = useState<string>('');

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        broker: '', category: '', code: '', name: '', price: '', quantity: '', totalAmount: '', fee: '', cost: 0          
    });
    const [lexiconInput, setLexiconInput] = useState('');

    // --- INITIALIZATION ---
    useEffect(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) { try { setTransactions(JSON.parse(saved)); } catch (e) { console.error(e); } }
        Promise.all([getBasicInfo(), getDividendData()]).then(([info, divs]) => {
            setBasicInfo(info); setSystemDividends(divs);
        });
        const savedBrokers = localStorage.getItem(KEY_BROKERS);
        if (savedBrokers) setBrokerOptions(JSON.parse(savedBrokers));
        const savedCats = localStorage.getItem(KEY_CATEGORIES);
        if (savedCats) setCategoryOptions(JSON.parse(savedCats));
    }, []);

    // Form Auto-fill Logic
    useEffect(() => {
        if (formData.code && basicInfo.length > 0) {
            const found = basicInfo.find(b => b.etfCode === formData.code);
            if (found) setFormData(prev => ({ ...prev, name: found.etfName }));
        }
    }, [formData.code, basicInfo]);

    useEffect(() => {
        const p = parseFloat(formData.price);
        const q = parseFloat(formData.quantity);
        if (!isNaN(p) && !isNaN(q) && p > 0 && q > 0) {
            setFormData(prev => ({ ...prev, totalAmount: Math.floor(p * q).toString() }));
        }
    }, [formData.price, formData.quantity]);

    useEffect(() => {
        const amt = parseFloat(formData.totalAmount) || 0;
        const fee = parseFloat(formData.fee) || 0;
        setFormData(prev => ({ ...prev, cost: amt + fee }));
    }, [formData.totalAmount, formData.fee]);

    // --- CALCULATIONS ---
    const availableBrokers = useMemo(() => Array.from(new Set(transactions.map(t => t.broker))).filter(Boolean).sort(), [transactions]);
    
    // Linked Filter: Categories depend on Selected Broker
    const availableCategories = useMemo(() => {
        let source = transactions;
        if (selectedBroker !== 'ALL') {
            source = source.filter(t => t.broker === selectedBroker);
        }
        return Array.from(new Set(source.map(t => t.category))).filter(Boolean).sort();
    }, [transactions, selectedBroker]);

    // Update Category Selection if it becomes invalid when Broker changes
    useEffect(() => {
        if (selectedCategory !== 'ALL' && !availableCategories.includes(selectedCategory)) {
            setSelectedCategory('ALL');
        }
    }, [selectedBroker, availableCategories]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            if (selectedBroker !== 'ALL' && t.broker !== selectedBroker) return false;
            if (selectedCategory !== 'ALL' && t.category !== selectedCategory) return false;
            return true;
        });
    }, [transactions, selectedBroker, selectedCategory]);

    // Left Panel Aggregation
    const positions: UserPosition[] = useMemo(() => {
        const map = new Map<string, UserPosition>();
        filteredTransactions.forEach(t => {
            if (t.type !== 'Buy') return;
            if (!map.has(t.code)) {
                map.set(t.code, { code: t.code, name: t.name, totalQty: 0, avgCost: 0, totalCost: 0, broker: '', category: '' });
            }
            const pos = map.get(t.code)!;
            pos.totalQty += t.quantity;
            pos.totalCost += t.cost;
        });
        map.forEach(pos => { if (pos.totalQty > 0) pos.avgCost = pos.totalCost / pos.totalQty; });
        return Array.from(map.values()).sort((a,b) => a.code.localeCompare(b.code));
    }, [filteredTransactions, basicInfo]);

    // Auto-select logic
    useEffect(() => {
        if (positions.length > 0) {
            const exists = positions.find(p => p.code === selectedCode);
            if (!selectedCode || !exists) setSelectedCode(positions[0].code);
        } else {
            setSelectedCode(null);
        }
    }, [positions, selectedCode]);

    // Detail Data: Transactions
    const holdingsDetailData = useMemo(() => {
        if (!selectedCode) return [];
        return filteredTransactions.filter(t => t.code === selectedCode).sort((a, b) => b.date.localeCompare(a.date));
    }, [selectedCode, filteredTransactions]);

    // Detail Data: Dividends
    const dividendDetailData = useMemo(() => {
        if (!selectedCode || systemDividends.length === 0) return [];
        const targetDividends = systemDividends.filter(d => d.etfCode === selectedCode).sort((a, b) => b.exDate.localeCompare(a.exDate));
        const results: any[] = [];
        targetDividends.forEach(div => {
            const validTrans = transactions.filter(t => t.code === selectedCode && t.date < div.exDate && t.type === 'Buy');
            const groupMap = new Map<string, number>();
            validTrans.forEach(t => {
                if (selectedBroker !== 'ALL' && t.broker !== selectedBroker) return;
                if (selectedCategory !== 'ALL' && t.category !== selectedCategory) return;
                const key = `${t.broker}|${t.category}`;
                const current = groupMap.get(key) || 0;
                groupMap.set(key, current + t.quantity);
            });
            groupMap.forEach((qty, key) => {
                if (qty > 0) {
                    const [broker, category] = key.split('|');
                    results.push({
                        exDate: div.exDate, amount: div.amount, broker, category, qty, totalDiv: qty * div.amount, paymentDate: div.paymentDate, yearMonth: div.yearMonth
                    });
                }
            });
        });
        return results;
    }, [selectedCode, systemDividends, transactions, selectedBroker, selectedCategory]);

    // Summary Data
    const summaryData = useMemo(() => {
        const source = transactions.filter(t => t.type === 'Buy');
        if (summaryViewMode === 'ACCOUNT') {
            const hierarchy = new Map<string, { broker: string, totalQty: number, totalCost: number, categories: Map<string, { category: string, totalQty: number, totalCost: number, items: Map<string, { code: string, name: string, qty: number, cost: number }> }> }>();
            source.forEach(t => {
                const bKey = t.broker || '未分類';
                const cKey = t.category || '未分類';
                if (!hierarchy.has(bKey)) hierarchy.set(bKey, { broker: bKey, totalQty: 0, totalCost: 0, categories: new Map() });
                const bGroup = hierarchy.get(bKey)!;
                bGroup.totalQty += t.quantity; bGroup.totalCost += t.cost;
                if (!bGroup.categories.has(cKey)) bGroup.categories.set(cKey, { category: cKey, totalQty: 0, totalCost: 0, items: new Map() });
                const cGroup = bGroup.categories.get(cKey)!;
                cGroup.totalQty += t.quantity; cGroup.totalCost += t.cost;
                const iKey = t.code;
                if (!cGroup.items.has(iKey)) cGroup.items.set(iKey, { code: t.code, name: t.name, qty: 0, cost: 0 });
                const item = cGroup.items.get(iKey)!;
                item.qty += t.quantity; item.cost += t.cost;
            });
            return Array.from(hierarchy.values()).map(b => ({
                id: b.broker, label: b.broker, totalQty: b.totalQty, totalCost: b.totalCost,
                children: Array.from(b.categories.values()).map(c => ({
                    id: `${b.broker}|${c.category}`, label: c.category, totalQty: c.totalQty, totalCost: c.totalCost,
                    children: Array.from(c.items.values()).sort((x,y) => x.code.localeCompare(y.code))
                })).sort((x,y) => x.label.localeCompare(y.label))
            })).sort((x,y) => x.label.localeCompare(y.label));
        } else {
            const hierarchy = new Map<string, { code: string, name: string, totalQty: number, totalCost: number, items: Map<string, { broker: string, category: string, qty: number, cost: number }> }>();
            source.forEach(t => {
                const key = t.code;
                if (!hierarchy.has(key)) hierarchy.set(key, { code: t.code, name: t.name, totalQty: 0, totalCost: 0, items: new Map() });
                const group = hierarchy.get(key)!;
                group.totalQty += t.quantity; group.totalCost += t.cost;
                const iKey = `${t.broker}|${t.category}`;
                if (!group.items.has(iKey)) group.items.set(iKey, { broker: t.broker, category: t.category, qty: 0, cost: 0 });
                const item = group.items.get(iKey)!;
                item.qty += t.quantity; item.cost += t.cost;
            });
            return Array.from(hierarchy.values()).map(g => ({
                id: g.code, label: g.code, subLabel: g.name, totalQty: g.totalQty, totalCost: g.totalCost,
                children: Array.from(g.items.values()).sort((x,y) => (x.broker+x.category).localeCompare(y.broker+y.category))
            })).sort((a,b) => a.label.localeCompare(b.label));
        }
    }, [transactions, summaryViewMode]);

    // --- HANDLERS ---
    const handleSaveTransaction = () => {
        if (!formData.code || !formData.price || !formData.quantity) { alert('請填寫完整資料'); return; }
        const newItem: UserTransaction = {
            id: editingId || crypto.randomUUID(), date: formData.date, code: formData.code, name: formData.name, type: 'Buy',
            price: parseFloat(formData.price), quantity: parseFloat(formData.quantity), totalAmount: parseFloat(formData.totalAmount) || 0,
            fee: parseFloat(formData.fee) || 0, cost: formData.cost, broker: formData.broker || brokerOptions[0] || '',
            category: formData.category || categoryOptions[0] || '', tax: 0, note: ''
        };
        const updated = editingId ? transactions.map(t => t.id === editingId ? newItem : t) : [...transactions, newItem];
        setTransactions(updated);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        
        if (newItem.broker && !brokerOptions.includes(newItem.broker)) {
             const n = [...brokerOptions, newItem.broker]; setBrokerOptions(n); localStorage.setItem(KEY_BROKERS, JSON.stringify(n));
        }
        if (newItem.category && !categoryOptions.includes(newItem.category)) {
             const n = [...categoryOptions, newItem.category]; setCategoryOptions(n); localStorage.setItem(KEY_CATEGORIES, JSON.stringify(n));
        }

        setFormData({ date: new Date().toISOString().split('T')[0], broker: '', category: '', code: '', name: '', price: '', quantity: '', totalAmount: '', fee: '', cost: 0 });
        setEditingId(null);
        setShowAddModal(false);
    };

    const handleDeleteTransaction = (id: string) => {
        if (confirm("確定刪除此筆紀錄？")) {
            const updated = transactions.filter(t => t.id !== id);
            setTransactions(updated);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        }
    };

    const handleEditTransaction = (t: UserTransaction) => {
        setEditingId(t.id);
        setFormData({ date: t.date, broker: t.broker, category: t.category, code: t.code, name: t.name, price: String(t.price), quantity: String(t.quantity), totalAmount: String(t.totalAmount), fee: String(t.fee), cost: t.cost });
        setShowAddModal(true);
    };

    const handleClearAll = () => {
        if (confirm("警告：這將清除所有「持股明細」資料！\n\n確定要執行嗎？")) {
            setTransactions([]);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target?.result as string;
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            const newTrans: UserTransaction[] = [];
            let success = 0;
            let skipped = 0;
            const existingSigs = new Set(transactions.map(t => `${t.date}-${t.code}-${t.broker}-${t.category}-${t.price}-${t.quantity}`));

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                if (cols.length < 5) continue; 
                try {
                    const price = parseFloat(cols[5]);
                    const qty = parseFloat(cols[6]);
                    const t: UserTransaction = {
                        id: crypto.randomUUID(), date: cols[0].trim(), broker: cols[1].trim(), category: cols[2].trim(), code: cols[3].trim(), name: cols[4].trim(), price: price, quantity: qty,
                        totalAmount: price * qty, fee: parseFloat(cols[8] || '0'), tax: 0, cost: 0, type: 'Buy', note: cols[10]?.trim() || ''
                    };
                    t.cost = t.totalAmount + t.fee;
                    const sig = `${t.date}-${t.code}-${t.broker}-${t.category}-${t.price}-${t.quantity}`;
                    if (t.code && t.quantity > 0 && !existingSigs.has(sig)) { newTrans.push(t); existingSigs.add(sig); success++; } else { skipped++; }
                } catch(e) {}
            }
            if (success > 0) {
                const combined = [...transactions, ...newTrans];
                setTransactions(combined);
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(combined));
                setImportLog(`匯入成功：${success} 筆資料 (跳過重複：${skipped} 筆)`);
                setTimeout(() => { setShowImportModal(false); setImportLog(''); }, 2000);
            } else {
                setImportLog(`匯入完成：無新資料 (跳過重複：${skipped} 筆)`);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleExport = () => {
        const headers = ['日期','證券戶','自訂分類','股號','股名','單價','股數','成交價金','手續費','總成本','備註'];
        const data = filteredTransactions.map(t => ({ '日期': t.date, '證券戶': t.broker, '自訂分類': t.category, '股號': t.code, '股名': t.name, '單價': t.price, '股數': t.quantity, '成交價金': t.totalAmount, '手續費': t.fee, '總成本': t.cost, '備註': t.note || '' }));
        exportToCSV('Transactions_Export', headers, data);
    };

    const handleLexiconSave = () => {
        if (!lexiconInput.trim()) return;
        const val = lexiconInput.trim();
        if (showLexiconModal === 'BROKER') { if (!brokerOptions.includes(val)) { const newOpts = [...brokerOptions, val]; setBrokerOptions(newOpts); localStorage.setItem(KEY_BROKERS, JSON.stringify(newOpts)); } }
        else { if (!categoryOptions.includes(val)) { const newOpts = [...categoryOptions, val]; setCategoryOptions(newOpts); localStorage.setItem(KEY_CATEGORIES, JSON.stringify(newOpts)); } }
        setLexiconInput('');
    };

    const handleDeleteLexiconItem = (val: string) => {
        if (!confirm(`確定要刪除 "${val}" 嗎？`)) return;
        if (showLexiconModal === 'BROKER') { const newOpts = brokerOptions.filter(o => o !== val); setBrokerOptions(newOpts); localStorage.setItem(KEY_BROKERS, JSON.stringify(newOpts)); }
        else { const newOpts = categoryOptions.filter(o => o !== val); setCategoryOptions(newOpts); localStorage.setItem(KEY_CATEGORIES, JSON.stringify(newOpts)); }
    };

    const fmtMoney = (n: number) => Math.round(n).toLocaleString();

    // Unified Button Style
    const btnClass = "flex items-center gap-1 px-3 py-1.5 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 font-bold text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    const btnClassRed = "flex items-center gap-1 px-3 py-1.5 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 font-bold text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <div className="h-full flex flex-col p-2 gap-2 bg-blue-50 overflow-hidden">
             
             {/* Top Level Tabs */}
             <div className="flex gap-2 flex-none bg-white p-2 rounded-lg border border-blue-200 shadow-sm">
                 {[ { id: 'HOLDINGS', label: '持股明細', icon: Layers }, { id: 'DIVIDEND', label: '股息分析', icon: Coins }, { id: 'PERFORMANCE', label: '績效分析', icon: TrendingUp } ].map(tab => (
                     <button key={tab.id} onClick={() => setTopTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all border 
                        ${topTab === tab.id ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}>
                         <tab.icon className="w-4 h-4"/> {tab.label}
                     </button>
                 ))}
             </div>

             {/* Action Bar */}
             <div className="bg-white p-2 rounded-lg shadow-sm border border-blue-200 flex flex-col gap-2 flex-none">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    
                    {/* Filters */}
                    <div className={`flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 transition-opacity ${transactions.length === 0 ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                         {/* Broker Group */}
                         <button onClick={() => setSelectedBroker('ALL')} className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all border shrink-0 ${selectedBroker === 'ALL' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}>全部</button>
                         {availableBrokers.map(b => (
                             <button key={b} onClick={() => setSelectedBroker(b)} className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all border shrink-0 ${selectedBroker === b ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}>{b}</button>
                         ))}

                         {/* Separator */}
                         <div className="h-6 w-px bg-gray-300 mx-1 shrink-0"></div>

                         {/* Category Group */}
                         <button onClick={() => setSelectedCategory('ALL')} className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all border shrink-0 ${selectedCategory === 'ALL' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}>全部</button>
                         {availableCategories.map(c => (
                             <button key={c} onClick={() => setSelectedCategory(c)} className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all border shrink-0 ${selectedCategory === c ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}>{c}</button>
                         ))}
                    </div>
                    
                    {/* Actions - Unified Blue Theme */}
                    {topTab === 'HOLDINGS' && (
                        <div className="flex items-center gap-2 shrink-0 ml-auto border-l border-gray-100 pl-2">
                            <button onClick={() => setShowSummaryModal(true)} disabled={transactions.length===0} className={btnClass}><LayoutDashboard className="w-4 h-4" /> 總表分析</button>
                            <button onClick={() => { setEditingId(null); setFormData({ ...formData, broker: brokerOptions[0]||'', category: categoryOptions[0]||'' }); setShowAddModal(true); }} className={btnClass}><Plus className="w-4 h-4" /> 新增交易</button>
                            <button onClick={() => setShowImportModal(true)} className={btnClass}><Upload className="w-4 h-4" /> 匯入資料</button>
                            <button onClick={handleExport} disabled={transactions.length===0} className={btnClass}><Download className="w-4 h-4" /> 匯出資料</button>
                            <button onClick={handleClearAll} disabled={transactions.length===0} className={btnClassRed}><Eraser className="w-4 h-4" /> 清除全部</button>
                        </div>
                    )}
                </div>
             </div>

             {/* Main Content */}
             <div className="flex-1 flex gap-2 overflow-hidden min-h-0">
                 {/* Left Panel */}
                 <div className="w-[280px] flex-none bg-white rounded-lg shadow-sm border border-blue-200 flex flex-col overflow-hidden">
                    <div className="p-2 bg-blue-50 border-b border-blue-200 grid grid-cols-3 gap-1 text-center shrink-0">
                        <div className="bg-white p-1 rounded border border-blue-100"><span className="text-xs text-gray-500 block">檔數</span><span className="font-bold text-blue-900">{positions.length}</span></div>
                        <div className="bg-white p-1 rounded border border-blue-100"><span className="text-xs text-gray-500 block">股數</span><span className="font-bold text-gray-900">{fmtMoney(positions.reduce((a,b)=>a+b.totalQty,0))}</span></div>
                        <div className="bg-white p-1 rounded border border-blue-100"><span className="text-xs text-gray-500 block">成本</span><span className="font-bold text-blue-700">{fmtMoney(positions.reduce((a,b)=>a+b.totalCost,0))}</span></div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-gray-50">
                        {positions.length === 0 ? <div className="p-4 text-center text-gray-400 text-sm">無持倉資料</div> : positions.map(pos => (
                            <div key={pos.code} onClick={() => setSelectedCode(pos.code)} className={`p-2 rounded-lg cursor-pointer border transition-all ${selectedCode === pos.code ? 'bg-blue-600 text-white shadow-md border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold font-mono">{pos.code}</span>
                                    <span className="font-bold truncate opacity-90">{pos.name}</span>
                                </div>
                                <div className="flex justify-between text-xs opacity-80">
                                    <span>{fmtMoney(pos.totalQty)} 股</span>
                                    <span>${fmtMoney(pos.totalCost)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>

                 {/* Right Panel */}
                 <div className="flex-1 bg-white rounded-lg shadow-sm border border-blue-200 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-auto p-0 bg-white">
                        {!selectedCode ? <div className="h-full flex flex-col items-center justify-center text-gray-400"><Wallet className="w-16 h-16 mb-4 opacity-30" /><p>請選擇左側 ETF 查看詳情</p></div> : (
                            <>
                                {topTab === 'HOLDINGS' && (
                                    <table className="w-full text-left border-collapse text-base">
                                        <thead className="bg-blue-50 sticky top-0 border-b border-blue-200 font-bold text-blue-900 z-10">
                                            <tr>
                                                <th className="p-3 whitespace-nowrap">日期</th><th className="p-3 whitespace-nowrap">證券戶</th><th className="p-3 whitespace-nowrap">分類</th><th className="p-3 whitespace-nowrap">股號</th><th className="p-3 whitespace-nowrap">股名</th><th className="p-3 whitespace-nowrap text-right">成交單價</th><th className="p-3 whitespace-nowrap text-right">成交股數</th><th className="p-3 whitespace-nowrap text-right">成交價金</th><th className="p-3 whitespace-nowrap text-right">手續費</th><th className="p-3 whitespace-nowrap text-right">購買成本</th><th className="p-3 whitespace-nowrap text-center">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-blue-50 font-bold text-gray-700">
                                            {holdingsDetailData.map(t => (
                                                <tr key={t.id} className="hover:bg-blue-50 transition-colors">
                                                    <td className="p-3 font-mono text-gray-900">{t.date}</td><td className="p-3 text-blue-800">{t.broker}</td><td className="p-3 text-gray-600">{t.category}</td><td className="p-3 font-mono text-blue-700">{t.code}</td><td className="p-3 text-gray-800">{t.name}</td>
                                                    <td className="p-3 text-right font-mono">{t.price}</td><td className="p-3 text-right font-mono text-blue-700">{t.quantity.toLocaleString()}</td><td className="p-3 text-right font-mono text-gray-600">{fmtMoney(t.totalAmount)}</td><td className="p-3 text-right font-mono text-gray-500">{t.fee}</td><td className="p-3 text-right font-mono text-gray-900">{fmtMoney(t.cost)}</td>
                                                    <td className="p-3 text-center flex items-center justify-center gap-2"><button onClick={() => handleEditTransaction(t)} className="p-1 hover:bg-gray-200 rounded text-blue-600"><Edit className="w-4 h-4" /></button><button onClick={() => handleDeleteTransaction(t.id)} className="p-1 hover:bg-gray-200 rounded text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                                {topTab === 'DIVIDEND' && (
                                    <table className="w-full text-left border-collapse text-base">
                                        <thead className="bg-blue-50 sticky top-0 border-b border-blue-200 font-bold text-blue-900 z-10">
                                            <tr><th className="p-3 whitespace-nowrap">證券戶</th><th className="p-3 whitespace-nowrap">分類</th><th className="p-3 whitespace-nowrap">年月</th><th className="p-3 whitespace-nowrap text-right">除息金額</th><th className="p-3 whitespace-nowrap text-right">持有張數</th><th className="p-3 whitespace-nowrap text-right">股息金額</th><th className="p-3 whitespace-nowrap text-right">除息日期</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-blue-50 font-bold text-gray-700">
                                            {dividendDetailData.map((d: any, i) => (
                                                <tr key={i} className="hover:bg-blue-50 transition-colors">
                                                    <td className="p-3 text-gray-800">{d.broker}</td><td className="p-3 text-blue-700">{d.category}</td><td className="p-3 font-mono text-gray-600">{d.yearMonth}</td><td className="p-3 text-right font-mono text-emerald-600">{d.amount}</td><td className="p-3 text-right font-mono text-gray-600">{(d.qty/1000).toFixed(2)}張</td><td className="p-3 text-right font-mono text-orange-600 text-base">{fmtMoney(d.totalDiv)}</td><td className="p-3 text-right font-mono text-gray-500">{d.exDate}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                                {topTab === 'PERFORMANCE' && (
                                    <div className="p-12 text-center text-gray-400 font-bold text-lg flex flex-col items-center gap-4">
                                        <TrendingUp className="w-12 h-12 opacity-50" />
                                        開發 "績效分析" 重點說明<br/>
                                        "資料分析" 資料來源, 為 "系統規畫者" , 建立 GOOGLE 表單, 長期持續更新, 資料來源為公開資訊<br/>
                                        "績效分析" 資料來源, 為 "使用者" 單筆單筆建立, 或用 EXCEL 匯入資料 , 屬於 個人裝置或PC 內部管理, 資料不上傳網路
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                 </div>
             </div>

             {/* MODALS (Restored) */}
             {showSummaryModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-5xl h-[85vh] shadow-2xl animate-in zoom-in-95 flex flex-col overflow-hidden">
                        <div className="bg-blue-600 p-4 border-b border-blue-700 flex justify-between items-center shrink-0 text-white">
                            <h3 className="font-bold text-xl flex items-center gap-2"><LayoutDashboard className="w-6 h-6" /> 持有明細 - 總表分析</h3>
                            <div className="flex gap-2">
                                <button onClick={() => setSummaryViewMode('ACCOUNT')} className={`px-4 py-2 rounded-lg font-bold text-base transition-colors ${summaryViewMode === 'ACCOUNT' ? 'bg-white text-blue-600 shadow' : 'bg-blue-700 text-white border border-blue-500'}`}>帳戶</button>
                                <button onClick={() => setSummaryViewMode('DETAIL')} className={`px-4 py-2 rounded-lg font-bold text-base transition-colors ${summaryViewMode === 'DETAIL' ? 'bg-white text-blue-600 shadow' : 'bg-blue-700 text-white border border-blue-500'}`}>明細</button>
                                <button onClick={() => setShowSummaryModal(false)} className="ml-4 p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto bg-white p-0">
                            <table className="w-full text-left border-collapse text-base">
                                <thead className="bg-blue-50 sticky top-0 z-10 border-b border-blue-200 font-bold text-blue-900">
                                    <tr><th className="p-3 w-12 text-center">#</th><th className="p-3">{summaryViewMode === 'ACCOUNT' ? '證券戶' : '股號'}</th><th className="p-3">{summaryViewMode === 'ACCOUNT' ? '' : '股名'}</th><th className="p-3 text-right">持有張數 (總計)</th><th className="p-3 text-right">持有金額 (總計)</th></tr>
                                </thead>
                                <tbody className="text-base">
                                    {summaryData.map((group) => {
                                        const isExpanded = expandedSummaryRows.has(group.id);
                                        return (
                                            <React.Fragment key={group.id}>
                                                <tr className={`cursor-pointer transition-colors border-b border-blue-50 hover:bg-blue-50 ${isExpanded ? 'bg-blue-50/50' : 'bg-white'}`} onClick={() => { const s = new Set(expandedSummaryRows); if(s.has(group.id)) s.delete(group.id); else s.add(group.id); setExpandedSummaryRows(s); }}>
                                                    <td className="p-3 text-center text-gray-400">{isExpanded ? <ChevronDown className="w-5 h-5 mx-auto" /> : <ChevronRight className="w-5 h-5 mx-auto" />}</td>
                                                    {summaryViewMode === 'ACCOUNT' ? (
                                                        <><td className="p-3 font-bold text-lg text-blue-900">{group.label}</td><td></td><td className="p-3 text-right font-mono font-bold text-lg text-blue-900">{(group.totalQty/1000).toFixed(2)}張</td><td className="p-3 text-right font-mono font-bold text-lg text-blue-900">{fmtMoney(group.totalCost)}</td></>
                                                    ) : (
                                                        <><td className="p-3 font-bold text-base text-blue-700 font-mono">{group.label}</td><td className="p-3 font-bold text-base text-gray-700">{group.subLabel}</td><td className="p-3 text-right font-mono font-bold text-base text-gray-700">{(group.totalQty/1000).toFixed(2)}張</td><td className="p-3 text-right font-mono font-bold text-base text-gray-700">{fmtMoney(group.totalCost)}</td></>
                                                    )}
                                                </tr>
                                                {isExpanded && group.children.map((child: any) => (
                                                    <React.Fragment key={child.id}>
                                                        {summaryViewMode === 'ACCOUNT' ? (
                                                            <tr className="hover:bg-blue-50 border-b border-blue-50"><td></td><td className="p-2 pl-8 font-bold text-base text-blue-600">{child.label}</td><td></td><td className="p-2 text-right font-mono font-bold text-base text-blue-600">{(child.totalQty/1000).toFixed(2)}張</td><td className="p-2 text-right font-mono font-bold text-base text-blue-600">{fmtMoney(child.totalCost)}</td></tr>
                                                        ) : (
                                                             <tr className="hover:bg-blue-50 border-b border-blue-50"><td></td><td className="p-2 pl-12 font-bold text-base text-gray-600">{child.broker}</td><td className="p-2 font-bold text-base text-gray-600">{child.category}</td><td className="p-2 text-right font-mono font-bold text-base text-gray-600">{(child.qty/1000).toFixed(2)}張</td><td className="p-2 text-right font-mono font-bold text-base text-gray-600">{fmtMoney(child.cost)}</td></tr>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
             )}

             {showAddModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl flex flex-col animate-in zoom-in-95 max-h-[90vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-blue-50 rounded-t-xl">
                            <h3 className="font-bold text-lg text-blue-900">{editingId ? '編輯交易' : '新增交易'}</h3>
                            <button onClick={() => setShowAddModal(false)}><X className="w-6 h-6 text-gray-500" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">日期*</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border p-2 rounded" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">股號*</label><input type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} placeholder="例如: 00878" className="w-full border p-2 rounded font-mono" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">證券戶*</label><div className="flex gap-2"><select value={formData.broker} onChange={e => setFormData({...formData, broker: e.target.value})} className="w-full border p-2 rounded"><option value="">請選擇</option>{brokerOptions.map(o => <option key={o} value={o}>{o}</option>)}</select><button onClick={() => setShowLexiconModal('BROKER')} className="bg-gray-100 p-2 rounded hover:bg-gray-200"><Book className="w-4 h-4" /></button></div></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">分類*</label><div className="flex gap-2"><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border p-2 rounded"><option value="">請選擇</option>{categoryOptions.map(o => <option key={o} value={o}>{o}</option>)}</select><button onClick={() => setShowLexiconModal('CATEGORY')} className="bg-gray-100 p-2 rounded hover:bg-gray-200"><Book className="w-4 h-4" /></button></div></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">成交單價*</label><input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full border p-2 rounded font-mono" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">成交股數*</label><input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full border p-2 rounded font-mono" /></div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
                                <div className="flex justify-between items-center"><span className="text-sm font-bold text-gray-600">成交價金</span><input type="number" value={formData.totalAmount} onChange={e => setFormData({...formData, totalAmount: e.target.value})} className="w-32 text-right border p-1 rounded font-mono" /></div>
                                <div className="flex justify-between items-center"><span className="text-sm font-bold text-gray-600">手續費</span><input type="number" value={formData.fee} onChange={e => setFormData({...formData, fee: e.target.value})} className="w-32 text-right border p-1 rounded font-mono" /></div>
                                <div className="border-t border-gray-300 pt-2 flex justify-between items-center"><span className="text-base font-bold text-gray-900">購買成本</span><span className="text-xl font-bold text-blue-700 font-mono">{fmtMoney(formData.cost)}</span></div>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex gap-3">
                            <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-lg">取消</button>
                            <button onClick={handleSaveTransaction} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md">存檔</button>
                        </div>
                    </div>
                </div>
             )}

             {showImportModal && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                     <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-6">
                         <h3 className="font-bold text-lg mb-4 text-blue-900">匯入資料</h3>
                         <p className="text-sm text-gray-600 mb-4">請選擇 CSV 檔案 (轉檔 CSV UTF-8 (逗號分隔))。</p>
                         <div className="bg-gray-100 p-3 rounded mb-4 text-xs font-mono text-gray-500 leading-relaxed">
                             所需欄位和順序:<br/>
                             Date, Broker, Category, Code, Name, Price, Qty, Amount, Fee, Cost, Note
                         </div>
                         <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportFile} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-4"/>
                         {importLog && <div className="text-sm font-bold text-green-600 mb-4">{importLog}</div>}
                         <button onClick={() => setShowImportModal(false)} className="w-full bg-gray-200 text-gray-700 py-2 rounded font-bold hover:bg-gray-300">關閉</button>
                     </div>
                 </div>
             )}

             {showLexiconModal && (
                 <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                     <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6">
                         <h3 className="font-bold text-lg mb-4">{showLexiconModal === 'BROKER' ? '編輯券商詞庫' : '編輯分類詞庫'}</h3>
                         <div className="flex gap-2 mb-4"><input type="text" value={lexiconInput} onChange={e => setLexiconInput(e.target.value)} placeholder="輸入新名稱" className="flex-1 border p-2 rounded" /><button onClick={handleLexiconSave} className="bg-green-600 text-white px-4 rounded font-bold">新增</button></div>
                         <div className="space-y-2 max-h-60 overflow-y-auto">
                             {(showLexiconModal === 'BROKER' ? brokerOptions : categoryOptions).map(opt => (
                                 <div key={opt} className="flex justify-between items-center bg-gray-50 p-2 rounded border mb-2"><span>{opt}</span><button onClick={() => handleDeleteLexiconItem(opt)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div>
                             ))}
                         </div>
                         <button onClick={() => setShowLexiconModal(null)} className="w-full mt-4 bg-gray-200 text-gray-700 py-2 rounded font-bold">關閉</button>
                     </div>
                 </div>
             )}
        </div>
    );
};

export default TabPerformance;