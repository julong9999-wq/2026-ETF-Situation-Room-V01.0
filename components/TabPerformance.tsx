import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Wallet, PieChart, TrendingUp, Plus, Upload, Download, 
    Trash2, Edit, X, FileSpreadsheet, AlertCircle, ChevronRight,
    Book, Save, Filter, RefreshCcw, AlertTriangle, Coins,
    LayoutDashboard, ChevronDown, ChevronUp, FolderOpen, Layers,
    Check, Eraser, FileText
} from 'lucide-react';
import { UserTransaction, UserPosition, BasicInfo, DividendData } from '../types';
import { getBasicInfo, getDividendData, exportToCSV } from '../services/dataService';

const LOCAL_STORAGE_KEY = 'user_transactions_v1';
const KEY_BROKERS = 'user_lexicon_brokers';
const KEY_CATEGORIES = 'user_lexicon_categories';

const DEFAULT_BROKERS = ["國泰_爸", "國泰_媽", "國泰_小孩"];
const DEFAULT_CATEGORIES = ["自存退休", "質押貸款", "勞退理財"];

// --- HELPERS ---
const checkSeason = (freqStr: string | undefined, season: 'Q1'|'Q2'|'Q3') => {
    const f = String(freqStr || '').replace(/\s/g, ''); 
    if (season === 'Q1') return f.includes('季一') || f.includes('1,4') || f.includes('01,04') || (f.includes('1') && f.includes('4'));
    if (season === 'Q2') return f.includes('季二') || f.includes('2,5') || f.includes('02,05') || (f.includes('2') && f.includes('5'));
    if (season === 'Q3') return f.includes('季三') || f.includes('3,6') || f.includes('03,06') || (f.includes('3') && f.includes('6'));
    return false;
};

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

    // Update Category Selection if it becomes invalid
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
        
        // SORTING: Month > Q1 > Q2 > Q3 > Others > Code
        return Array.from(map.values()).sort((a,b) => {
            const getFreq = (code: string) => basicInfo.find(i => i.etfCode === code)?.dividendFreq || '';
            const getScore = (f: string) => {
                if (f.includes('月')) return 1;
                if (checkSeason(f, 'Q1')) return 2;
                if (checkSeason(f, 'Q2')) return 3;
                if (checkSeason(f, 'Q3')) return 4;
                return 5;
            };
            const sA = getScore(getFreq(a.code));
            const sB = getScore(getFreq(b.code));
            if (sA !== sB) return sA - sB;
            return a.code.localeCompare(b.code);
        });
    }, [filteredTransactions, basicInfo]);

    const getPositionColor = (code: string, isSelected: boolean) => {
        const info = basicInfo.find(i => i.etfCode === code);
        const f = info ? (info.dividendFreq || '') : '';
        let baseClass = 'bg-gray-50 text-gray-700';
        // Q1=Blue, Q2=Green, Q3=Orange, Month=Tea(Amber), Other=Gray
        if (f.includes('月')) baseClass = 'bg-amber-50 text-amber-900 border-amber-200';
        else if (checkSeason(f, 'Q1')) baseClass = 'bg-sky-50 text-blue-900 border-blue-200';
        else if (checkSeason(f, 'Q2')) baseClass = 'bg-green-50 text-green-900 border-green-200';
        else if (checkSeason(f, 'Q3')) baseClass = 'bg-orange-50 text-orange-900 border-orange-200';
        
        if (isSelected) return `${baseClass} ring-2 ring-blue-500 shadow-md transform scale-[1.01] z-10 border`;
        return `${baseClass} border border-gray-100 hover:brightness-95 hover:shadow-sm`;
    };

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

    // Detail Data: Dividends (Based on Qty BEFORE ExDate)
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
        
        // Auto-save to lexicon if new
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
            // Simple Parse (Assume headers: Date,Broker,Category,Code,Name,Price,Qty,Fee,Note)
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            const newTrans: UserTransaction[] = [];
            let success = 0;
            
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                if (cols.length < 5) continue; 
                // Flexible mapping logic could be added here
                // For now, assuming standard export format or simple columns
                // Expected: Date, Broker, Category, Code, Name, Price, Qty, Fee
                try {
                    const t: UserTransaction = {
                        id: crypto.randomUUID(),
                        date: cols[0].trim(),
                        broker: cols[1].trim(),
                        category: cols[2].trim(),
                        code: cols[3].trim(),
                        name: cols[4].trim(),
                        price: parseFloat(cols[5]),
                        quantity: parseFloat(cols[6]),
                        totalAmount: parseFloat(cols[5]) * parseFloat(cols[6]),
                        fee: parseFloat(cols[8] || '0'),
                        tax: 0,
                        cost: 0,
                        type: 'Buy',
                        note: cols[10]?.trim() || ''
                    };
                    t.cost = t.totalAmount + t.fee;
                    if (t.code && t.quantity > 0) {
                        newTrans.push(t);
                        success++;
                    }
                } catch(e) {}
            }
            if (success > 0) {
                const combined = [...transactions, ...newTrans];
                setTransactions(combined);
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(combined));
                setImportLog(`匯入成功：${success} 筆資料`);
                setTimeout(() => { setShowImportModal(false); setImportLog(''); }, 1500);
            } else {
                setImportLog('匯入失敗：格式不符或無有效資料');
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
        if (showLexiconModal === 'BROKER') {
            if (!brokerOptions.includes(val)) {
                const newOpts = [...brokerOptions, val];
                setBrokerOptions(newOpts);
                localStorage.setItem(KEY_BROKERS, JSON.stringify(newOpts));
            }
        } else {
            if (!categoryOptions.includes(val)) {
                const newOpts = [...categoryOptions, val];
                setCategoryOptions(newOpts);
                localStorage.setItem(KEY_CATEGORIES, JSON.stringify(newOpts));
            }
        }
        setLexiconInput('');
    };

    const handleDeleteLexiconItem = (val: string) => {
        if (!confirm(`確定要刪除 "${val}" 嗎？`)) return;
        if (showLexiconModal === 'BROKER') {
            const newOpts = brokerOptions.filter(o => o !== val);
            setBrokerOptions(newOpts);
            localStorage.setItem(KEY_BROKERS, JSON.stringify(newOpts));
        } else {
            const newOpts = categoryOptions.filter(o => o !== val);
            setCategoryOptions(newOpts);
            localStorage.setItem(KEY_CATEGORIES, JSON.stringify(newOpts));
        }
    };

    const fmtMoney = (n: number) => Math.round(n).toLocaleString();
    const fmtPrice = (n: number) => n?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

    return (
        <div className="h-full flex flex-col p-2 gap-2 bg-blue-50 overflow-hidden">
             
             {/* Top Level Tabs */}
             <div className="flex gap-2 flex-none bg-white p-2 rounded-lg border border-blue-200 shadow-sm">
                 {[
                     { id: 'HOLDINGS', label: '持股明細', icon: Layers },
                     { id: 'DIVIDEND', label: '股息分析', icon: Coins },
                     { id: 'PERFORMANCE', label: '績效分析', icon: TrendingUp }
                 ].map(tab => (
                     <button
                        key={tab.id}
                        onClick={() => setTopTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-base transition-all ${topTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-blue-600 hover:bg-blue-50'}`}
                     >
                         <tab.icon className="w-4 h-4"/> {tab.label}
                     </button>
                 ))}
             </div>

             {/* Action Bar (Filters + Buttons) */}
             <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-200 flex flex-col gap-3 flex-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Filters */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                         <div className="flex items-center gap-1 bg-blue-50 p-1 rounded border border-blue-200 shrink-0">
                             <span className="text-blue-400 px-2"><Filter className="w-4 h-4" /></span>
                             <select value={selectedBroker} onChange={(e) => setSelectedBroker(e.target.value)} className="bg-transparent text-sm font-bold text-blue-900 outline-none">
                                 <option value="ALL">全部證券戶</option>
                                 {availableBrokers.map(b => <option key={b} value={b}>{b}</option>)}
                             </select>
                         </div>
                         <div className="flex items-center gap-1 bg-blue-50 p-1 rounded border border-blue-200 shrink-0">
                             <span className="text-blue-400 px-2"><Book className="w-4 h-4" /></span>
                             <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-transparent text-sm font-bold text-blue-900 outline-none">
                                 <option value="ALL">全部策略</option>
                                 {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                         </div>
                    </div>
                    
                    {/* Actions */}
                    {topTab === 'HOLDINGS' && (
                        <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => setShowSummaryModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold text-sm shadow-sm transition-colors"><LayoutDashboard className="w-4 h-4" /> 總表</button>
                            <button onClick={() => { setEditingId(null); setFormData({ ...formData, broker: brokerOptions[0]||'', category: categoryOptions[0]||'' }); setShowAddModal(true); }} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm shadow-sm transition-colors"><Plus className="w-4 h-4" /> 新增</button>
                            <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-bold text-sm shadow-sm transition-colors"><Upload className="w-4 h-4" /> 匯入</button>
                            <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 font-bold text-sm shadow-sm transition-colors"><Download className="w-4 h-4" /> 匯出</button>
                            <button onClick={handleClearAll} className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-bold text-sm shadow-sm transition-colors"><Eraser className="w-4 h-4" /> 清除</button>
                        </div>
                    )}
                </div>
             </div>

             {/* Main Content Area */}
             <div className="flex-1 flex gap-2 overflow-hidden min-h-0">
                 
                 {/* Left Panel: Position List */}
                 <div className="w-[300px] flex-none bg-white rounded-lg shadow-sm border border-blue-200 flex flex-col overflow-hidden min-h-0">
                    <div className="p-2 bg-blue-100 border-b border-blue-200 grid grid-cols-3 gap-2 shrink-0 text-center">
                        <div className="bg-blue-50 p-1 rounded border border-blue-100"><span className="text-xs text-gray-500 block">檔數</span><span className="font-bold text-blue-900">{positions.length}</span></div>
                        <div className="bg-blue-50 p-1 rounded border border-blue-100"><span className="text-xs text-gray-500 block">股數</span><span className="font-bold text-gray-900">{fmtMoney(positions.reduce((a,b)=>a+b.totalQty,0))}</span></div>
                        <div className="bg-blue-50 p-1 rounded border border-blue-100"><span className="text-xs text-gray-500 block">成本</span><span className="font-bold text-blue-700">{fmtMoney(positions.reduce((a,b)=>a+b.totalCost,0))}</span></div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0 bg-gray-50/50">
                        {positions.length === 0 ? <div className="p-4 text-center text-gray-400 text-sm">無持倉資料</div> : positions.map(pos => (
                            <div key={pos.code} onClick={() => setSelectedCode(pos.code)} className={`p-2 rounded-lg cursor-pointer border transition-all relative group flex flex-col gap-0.5 ${getPositionColor(pos.code, selectedCode === pos.code)}`}>
                                <div className="flex justify-between items-center border-b border-black/5 pb-1 mb-1">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-lg font-bold font-mono leading-none">{pos.code}</span>
                                        <span className="text-base font-bold truncate leading-none opacity-90">{pos.name}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-1 text-center">
                                    <div className="font-mono font-bold text-sm">{fmtMoney(pos.totalQty)}</div>
                                    <div className="font-mono font-bold text-sm">{fmtPrice(Math.round(pos.avgCost * 100) / 100)}</div>
                                    <div className="font-mono font-bold text-sm">{fmtMoney(pos.totalCost)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>

                 {/* Right Panel: Details */}
                 <div className="flex-1 bg-white rounded-lg shadow-sm border border-blue-200 flex flex-col overflow-hidden min-h-0">
                    <div className="flex-1 overflow-auto p-0 bg-white">
                        {!selectedCode ? <div className="h-full flex flex-col items-center justify-center text-gray-400"><Wallet className="w-16 h-16 mb-4 opacity-30" /><p>請選擇左側 ETF 查看詳情</p></div> : (
                            <>
                                {topTab === 'HOLDINGS' && (
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-sm font-bold text-gray-700">
                                            <tr>
                                                <th className="p-3 whitespace-nowrap">證券戶</th><th className="p-3 whitespace-nowrap">分類</th><th className="p-3 whitespace-nowrap">日期</th><th className="p-3 whitespace-nowrap">股號</th><th className="p-3 whitespace-nowrap">股名</th><th className="p-3 whitespace-nowrap text-right">成交單價</th><th className="p-3 whitespace-nowrap text-right">成交股數</th><th className="p-3 whitespace-nowrap text-right">成交價金</th><th className="p-3 whitespace-nowrap text-right">手續費</th><th className="p-3 whitespace-nowrap text-right">購買成本</th><th className="p-3 whitespace-nowrap text-center">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-sm font-bold">
                                            {holdingsDetailData.map(t => (
                                                <tr key={t.id} className="hover:bg-blue-50 transition-colors">
                                                    <td className="p-3 text-blue-800">{t.broker}</td><td className="p-3 text-gray-600">{t.category}</td><td className="p-3 font-mono text-gray-600">{t.date}</td><td className="p-3 font-mono text-blue-700">{t.code}</td><td className="p-3 text-gray-800">{t.name}</td>
                                                    <td className="p-3 text-right font-mono">{t.price}</td><td className="p-3 text-right font-mono text-blue-700">{t.quantity.toLocaleString()}</td><td className="p-3 text-right font-mono text-gray-600">{fmtMoney(t.totalAmount)}</td><td className="p-3 text-right font-mono text-gray-500">{t.fee}</td><td className="p-3 text-right font-mono text-gray-900">{fmtMoney(t.cost)}</td>
                                                    <td className="p-3 text-center flex items-center justify-center gap-2"><button onClick={() => handleEditTransaction(t)} className="p-1 hover:bg-gray-200 rounded text-blue-600"><Edit className="w-4 h-4" /></button><button onClick={() => handleDeleteTransaction(t.id)} className="p-1 hover:bg-gray-200 rounded text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                                {topTab === 'DIVIDEND' && (
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-purple-50 sticky top-0 border-b border-purple-200 text-sm font-bold text-purple-900">
                                            <tr><th className="p-3 whitespace-nowrap">證券戶</th><th className="p-3 whitespace-nowrap">分類</th><th className="p-3 whitespace-nowrap">年月</th><th className="p-3 whitespace-nowrap text-right">除息金額</th><th className="p-3 whitespace-nowrap text-right">持有張數</th><th className="p-3 whitespace-nowrap text-right">股息金額</th><th className="p-3 whitespace-nowrap text-right">除息日期</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-purple-50 text-sm font-bold">
                                            {dividendDetailData.map((d: any, i) => (
                                                <tr key={i} className="hover:bg-purple-50/50 transition-colors">
                                                    <td className="p-3 text-gray-800">{d.broker}</td><td className="p-3 text-purple-700">{d.category}</td><td className="p-3 font-mono text-gray-600">{d.yearMonth}</td><td className="p-3 text-right font-mono text-emerald-600">{d.amount}</td><td className="p-3 text-right font-mono text-gray-600">{(d.qty/1000).toFixed(2)}張</td><td className="p-3 text-right font-mono text-orange-600 text-base">{fmtMoney(d.totalDiv)}</td><td className="p-3 text-right font-mono text-gray-500">{d.exDate}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                                {topTab === 'PERFORMANCE' && (
                                    <div className="p-8 text-center text-gray-400 font-bold text-lg">績效分析模組開發中...</div>
                                )}
                            </>
                        )}
                    </div>
                 </div>
             </div>

             {/* SUMMARY MODAL */}
             {showSummaryModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-5xl h-[85vh] shadow-2xl animate-in zoom-in-95 flex flex-col overflow-hidden">
                        <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-xl text-indigo-900 flex items-center gap-2"><LayoutDashboard className="w-6 h-6" /> 持有明細 - 總表分析</h3>
                            <div className="flex gap-2">
                                <button onClick={() => setSummaryViewMode('ACCOUNT')} className={`px-4 py-2 rounded-lg font-bold text-base transition-colors ${summaryViewMode === 'ACCOUNT' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-200'}`}>帳戶</button>
                                <button onClick={() => setSummaryViewMode('DETAIL')} className={`px-4 py-2 rounded-lg font-bold text-base transition-colors ${summaryViewMode === 'DETAIL' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-200'}`}>明細</button>
                                <button onClick={() => setShowSummaryModal(false)} className="ml-2 p-2 hover:bg-white rounded-full text-gray-500"><X className="w-6 h-6" /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto bg-white p-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-blue-50 sticky top-0 z-10 border-b border-blue-200 text-base font-bold text-blue-900">
                                    <tr><th className="p-3 w-12 text-center">#</th><th className="p-3">{summaryViewMode === 'ACCOUNT' ? '證券戶' : '股號'}</th><th className="p-3">{summaryViewMode === 'ACCOUNT' ? '' : '股名'}</th><th className="p-3 text-right">持有張數 (總計)</th><th className="p-3 text-right">持有金額 (總計)</th></tr>
                                </thead>
                                <tbody className="text-base">
                                    {summaryData.map((group) => {
                                        const isExpanded = expandedSummaryRows.has(group.id);
                                        return (
                                            <React.Fragment key={group.id}>
                                                <tr className={`cursor-pointer transition-colors border-b border-gray-100 hover:bg-gray-50 ${isExpanded ? 'bg-blue-50/50' : 'bg-white'}`} onClick={() => { const s = new Set(expandedSummaryRows); if(s.has(group.id)) s.delete(group.id); else s.add(group.id); setExpandedSummaryRows(s); }}>
                                                    <td className="p-3 text-center text-gray-400">{isExpanded ? <ChevronDown className="w-5 h-5 mx-auto" /> : <ChevronRight className="w-5 h-5 mx-auto" />}</td>
                                                    {summaryViewMode === 'ACCOUNT' ? (
                                                        <><td className="p-3 font-bold text-[18px] text-blue-900">{group.label}</td><td></td><td className="p-3 text-right font-mono font-bold text-[18px] text-blue-900">{(group.totalQty/1000).toFixed(2)}張</td><td className="p-3 text-right font-mono font-bold text-[18px] text-blue-900">{fmtMoney(group.totalCost)}</td></>
                                                    ) : (
                                                        <><td className="p-3 font-bold text-[16px] text-blue-600 font-mono">{group.label}</td><td className="p-3 font-bold text-[16px] text-blue-600">{group.subLabel}</td><td className="p-3 text-right font-mono font-bold text-[16px] text-blue-600">{(group.totalQty/1000).toFixed(2)}張</td><td className="p-3 text-right font-mono font-bold text-[16px] text-blue-600">{fmtMoney(group.totalCost)}</td></>
                                                    )}
                                                </tr>
                                                {isExpanded && group.children.map((child: any) => {
                                                    const isL2Expanded = expandedSummaryRows.has(child.id);
                                                    if (summaryViewMode === 'ACCOUNT') {
                                                        return (
                                                            <React.Fragment key={child.id}>
                                                                <tr className="cursor-pointer hover:bg-gray-50 border-b border-gray-100" onClick={() => { const s = new Set(expandedSummaryRows); if(s.has(child.id)) s.delete(child.id); else s.add(child.id); setExpandedSummaryRows(s); }}>
                                                                    <td className="p-2 text-center"></td> <td className="p-2 pl-8 flex items-center gap-2">{isL2Expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}<span className="font-bold text-[16px] text-blue-600">{child.label}</span></td><td></td><td className="p-2 text-right font-mono font-bold text-[16px] text-blue-600">{(child.totalQty/1000).toFixed(2)}張</td><td className="p-2 text-right font-mono font-bold text-[16px] text-blue-600">{fmtMoney(child.totalCost)}</td>
                                                                </tr>
                                                                {isL2Expanded && child.children.map((item: any, idx: number) => (
                                                                    <tr key={idx} className="hover:bg-gray-50 border-b border-gray-50"><td></td><td className="p-2 pl-16 font-bold text-[16px] text-gray-500 font-mono">{item.code}</td><td className="p-2 font-bold text-[16px] text-gray-500">{item.name}</td><td className="p-2 text-right font-mono font-bold text-[16px] text-gray-500">{(item.qty/1000).toFixed(2)}張</td><td className="p-2 text-right font-mono font-bold text-[16px] text-gray-500">{fmtMoney(item.cost)}</td></tr>
                                                                ))}
                                                            </React.Fragment>
                                                        );
                                                    } else {
                                                        return (
                                                            <tr key={child.id} className="hover:bg-gray-50 border-b border-gray-50"><td></td><td className="p-2 pl-12 font-bold text-[16px] text-gray-500">{child.broker}</td><td className="p-2 font-bold text-[16px] text-gray-500">{child.category}</td><td className="p-2 text-right font-mono font-bold text-[16px] text-gray-500">{(child.qty/1000).toFixed(2)}張</td><td className="p-2 text-right font-mono font-bold text-[16px] text-gray-500">{fmtMoney(child.cost)}</td></tr>
                                                        );
                                                    }
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
             )}

             {/* Add/Edit Modal */}
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

             {/* Import Modal */}
             {showImportModal && (
                 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                     <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-6">
                         <h3 className="font-bold text-lg mb-4 text-blue-900">匯入資料</h3>
                         <p className="text-sm text-gray-600 mb-4">請選擇 CSV 檔案 (轉檔 CSV UTF-8 (逗號分隔))。資料匯入前比對資料，是否相同資料，相同不匯入，匯入沒有的資料。</p>
                         <div className="bg-gray-100 p-3 rounded mb-4 text-xs font-mono text-gray-500">
                             所需欄位和順序:<br/>
                             Date, Broker, Category, Code, Name, Price, Qty, Amount, Fee, Cost, Note
                         </div>
                         <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportFile} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-4"/>
                         {importLog && <div className="text-sm font-bold text-green-600 mb-4">{importLog}</div>}
                         <button onClick={() => setShowImportModal(false)} className="w-full bg-gray-200 text-gray-700 py-2 rounded font-bold hover:bg-gray-300">關閉</button>
                     </div>
                 </div>
             )}

             {/* Lexicon Modal */}
             {showLexiconModal && (
                 <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                     <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6">
                         <h3 className="font-bold text-lg mb-4">{showLexiconModal === 'BROKER' ? '編輯券商詞庫' : '編輯分類詞庫'}</h3>
                         <div className="flex gap-2 mb-4"><input type="text" value={lexiconInput} onChange={e => setLexiconInput(e.target.value)} placeholder="輸入新名稱" className="flex-1 border p-2 rounded" /><button onClick={handleLexiconSave} className="bg-green-600 text-white px-4 rounded font-bold">新增</button></div>
                         <div className="space-y-2 max-h-60 overflow-y-auto">
                             {(showLexiconModal === 'BROKER' ? brokerOptions : categoryOptions).map(opt => (
                                 <div key={opt} className="flex justify-between items-center bg-gray-50 p-2 rounded border"><span>{opt}</span><button onClick={() => handleDeleteLexiconItem(opt)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></div>
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