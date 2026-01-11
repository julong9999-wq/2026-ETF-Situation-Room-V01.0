import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Wallet, PieChart, TrendingUp, Plus, Upload, Download, 
    Trash2, Edit, X, FileSpreadsheet, AlertCircle, ChevronRight,
    Book, Save, Filter, RefreshCcw, AlertTriangle, Coins,
    LayoutDashboard, ChevronDown, ChevronUp, FolderOpen, Layers,
    Check
} from 'lucide-react';
import { UserTransaction, UserPosition, BasicInfo, DividendData } from '../types';
import { getBasicInfo, getDividendData, exportToCSV } from '../services/dataService';

const LOCAL_STORAGE_KEY = 'user_transactions_v1';
const KEY_BROKERS = 'user_lexicon_brokers';
const KEY_CATEGORIES = 'user_lexicon_categories';

// Default Lexicon Values
const DEFAULT_BROKERS = ["國泰_爸", "國泰_媽", "國泰_小孩"];
const DEFAULT_CATEGORIES = ["自存退休", "質押貸款", "勞退理財"];

// Helper for Frequency Logic
const checkSeason = (freqStr: string | undefined, season: 'Q1'|'Q2'|'Q3') => {
    const f = String(freqStr || '').replace(/\s/g, ''); 
    if (season === 'Q1') return f.includes('季一') || f.includes('1,4') || f.includes('01,04') || (f.includes('1') && f.includes('4'));
    if (season === 'Q2') return f.includes('季二') || f.includes('2,5') || f.includes('02,05') || (f.includes('2') && f.includes('5'));
    if (season === 'Q3') return f.includes('季三') || f.includes('3,6') || f.includes('03,06') || (f.includes('3') && f.includes('6'));
    return false;
};

const TabPerformance: React.FC = () => {
    // --- STATE ---
    const [activeSubTab, setActiveSubTab] = useState<'HOLDINGS' | 'DIVIDEND' | 'PERFORMANCE'>('HOLDINGS');
    
    // Data State
    const [transactions, setTransactions] = useState<UserTransaction[]>([]);
    const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
    const [systemDividends, setSystemDividends] = useState<DividendData[]>([]); // New System Data
    const [selectedCode, setSelectedCode] = useState<string | null>(null);

    // Lexicon State
    const [brokerOptions, setBrokerOptions] = useState<string[]>(DEFAULT_BROKERS);
    const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_CATEGORIES);

    // Filters (Top Level)
    const [selectedBroker, setSelectedBroker] = useState<string>('ALL');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showLexiconModal, setShowLexiconModal] = useState<'BROKER' | 'CATEGORY' | null>(null);
    
    // File Input Ref for Import
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State for "Add/Edit Transaction"
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        broker: '',
        category: '',
        code: '',
        name: '',
        price: '',
        quantity: '',
        totalAmount: '', 
        fee: '',         
        cost: 0          
    });

    // Lexicon Edit State
    const [lexiconInput, setLexiconInput] = useState('');

    // --- INITIALIZATION ---
    useEffect(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
            try { setTransactions(JSON.parse(saved)); } catch (e) { console.error(e); }
        }
        
        // Fetch System Data
        Promise.all([getBasicInfo(), getDividendData()]).then(([info, divs]) => {
            setBasicInfo(info);
            setSystemDividends(divs);
        });

        const savedBrokers = localStorage.getItem(KEY_BROKERS);
        if (savedBrokers) setBrokerOptions(JSON.parse(savedBrokers));
        const savedCats = localStorage.getItem(KEY_CATEGORIES);
        if (savedCats) setCategoryOptions(JSON.parse(savedCats));
    }, []);

    // --- AUTO-FILL LOGIC ---
    useEffect(() => {
        if (formData.code && basicInfo.length > 0) {
            const found = basicInfo.find(b => b.etfCode === formData.code);
            if (found) {
                setFormData(prev => ({ ...prev, name: found.etfName }));
            }
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


    // --- CALCULATIONS (Master List) ---
    // 1. Dynamic Filter Lists
    const availableBrokers = useMemo(() => {
        return Array.from(new Set(transactions.map(t => t.broker))).filter(Boolean).sort();
    }, [transactions]);

    const availableCategories = useMemo(() => {
        let source = transactions;
        if (selectedBroker !== 'ALL') {
            source = source.filter(t => t.broker === selectedBroker);
        }
        return Array.from(new Set(source.map(t => t.category))).filter(Boolean).sort();
    }, [transactions, selectedBroker]);

    // 2. Filtered Transactions
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
                map.set(t.code, {
                    code: t.code, name: t.name, totalQty: 0, avgCost: 0, totalCost: 0,
                    broker: '', category: '' 
                });
            }
            const pos = map.get(t.code)!;
            pos.totalQty += t.quantity;
            pos.totalCost += t.cost;
        });
        map.forEach(pos => {
            if (pos.totalQty > 0) pos.avgCost = pos.totalCost / pos.totalQty;
        });
        
        // Sorting Logic: Month(1) > Q1(2) > Q2(3) > Q3(4) > Other(5) > Code
        return Array.from(map.values()).sort((a,b) => {
            const getFreq = (code: string) => {
                const info = basicInfo.find(i => i.etfCode === code);
                return info ? (info.dividendFreq || '') : '';
            };
            const fA = getFreq(a.code);
            const fB = getFreq(b.code);
            
            const getScore = (f: string) => {
                if (f.includes('月')) return 1;
                if (checkSeason(f, 'Q1')) return 2;
                if (checkSeason(f, 'Q2')) return 3;
                if (checkSeason(f, 'Q3')) return 4;
                return 5;
            };

            const sA = getScore(fA);
            const sB = getScore(fB);
            
            if (sA !== sB) return sA - sB;
            return a.code.localeCompare(b.code);
        });
    }, [filteredTransactions, basicInfo]);

    const getPositionColor = (code: string, isSelected: boolean) => {
        const info = basicInfo.find(i => i.etfCode === code);
        const f = info ? (info.dividendFreq || '') : '';
        let baseClass = 'bg-gray-50 text-gray-700'; // Default Gray

        if (f.includes('月')) baseClass = 'bg-amber-50 text-amber-900 border-amber-200'; // Light Tea/Brown
        else if (checkSeason(f, 'Q1')) baseClass = 'bg-sky-50 text-blue-900 border-blue-200'; // Light Blue
        else if (checkSeason(f, 'Q2')) baseClass = 'bg-green-50 text-green-900 border-green-200'; // Light Green
        else if (checkSeason(f, 'Q3')) baseClass = 'bg-orange-50 text-orange-900 border-orange-200'; // Light Orange
        
        if (isSelected) return `${baseClass} ring-2 ring-blue-500 shadow-md transform scale-[1.01] z-10 border`;
        return `${baseClass} border border-gray-100 hover:brightness-95 hover:shadow-sm`;
    };

    // --- AUTO-SELECT FIRST ITEM EFFECT ---
    useEffect(() => {
        if (positions.length > 0) {
            // Check if current selection is still valid
            const exists = positions.find(p => p.code === selectedCode);
            if (!selectedCode || !exists) {
                setSelectedCode(positions[0].code);
            }
        } else {
            setSelectedCode(null);
        }
    }, [positions, selectedCode]);

    // 3. Detail Data (Holdings View)
    const holdingsDetailData = useMemo(() => {
        if (!selectedCode) return [];
        return filteredTransactions.filter(t => t.code === selectedCode).sort((a, b) => b.date.localeCompare(a.date));
    }, [selectedCode, filteredTransactions]);

    // 4. Detail Data (Dividend Analysis View)
    const dividendDetailData = useMemo(() => {
        if (!selectedCode || systemDividends.length === 0) return [];

        const targetDividends = systemDividends
            .filter(d => d.etfCode === selectedCode)
            .sort((a, b) => b.exDate.localeCompare(a.exDate));

        const results: any[] = [];

        targetDividends.forEach(div => {
            const validTrans = transactions.filter(t => 
                t.code === selectedCode && 
                t.date < div.exDate && 
                t.type === 'Buy'
            );

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
                        exDate: div.exDate,
                        amount: div.amount,
                        broker,
                        category,
                        qty,
                        totalDiv: qty * div.amount,
                        paymentDate: div.paymentDate
                    });
                }
            });
        });

        return results;
    }, [selectedCode, systemDividends, transactions, selectedBroker, selectedCategory]);

    // --- HANDLERS ---
    const handleSaveTransaction = () => {
        if (!formData.code || !formData.price || !formData.quantity || !formData.broker || !formData.category) {
            alert("請填寫所有必填欄位 (*)");
            return;
        }

        const newTrans: UserTransaction = {
            id: editingId || crypto.randomUUID(),
            date: formData.date,
            code: formData.code,
            name: formData.name || 'Unknown',
            type: 'Buy',
            price: parseFloat(formData.price),
            quantity: parseFloat(formData.quantity),
            totalAmount: parseFloat(formData.totalAmount) || 0,
            fee: parseFloat(formData.fee) || 0,
            tax: 0,
            cost: parseFloat(formData.totalAmount) + (parseFloat(formData.fee) || 0),
            broker: formData.broker,
            category: formData.category,
            note: ''
        };

        let updated = [];
        if (editingId) {
            updated = transactions.map(t => t.id === editingId ? newTrans : t);
            setEditingId(null);
        } else {
            updated = [...transactions, newTrans];
        }
        
        setTransactions(updated);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        setShowAddModal(false);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            broker: '', category: '', code: '', name: '', price: '', quantity: '', totalAmount: '', fee: '', cost: 0
        });
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
        setFormData({
            date: t.date,
            broker: t.broker,
            category: t.category,
            code: t.code,
            name: t.name,
            price: String(t.price),
            quantity: String(t.quantity),
            totalAmount: String(t.totalAmount),
            fee: String(t.fee),
            cost: t.cost
        });
        setShowAddModal(true);
    };

    const handleLexiconSave = () => {
        if (!lexiconInput.trim()) return;
        const type = showLexiconModal;
        if (type === 'BROKER') {
            const newOpts = [...brokerOptions, lexiconInput.trim()];
            setBrokerOptions(newOpts);
            localStorage.setItem(KEY_BROKERS, JSON.stringify(newOpts));
        } else if (type === 'CATEGORY') {
            const newOpts = [...categoryOptions, lexiconInput.trim()];
            setCategoryOptions(newOpts);
            localStorage.setItem(KEY_CATEGORIES, JSON.stringify(newOpts));
        }
        setLexiconInput('');
        setShowLexiconModal(null);
    };

    const handleLexiconDelete = (type: 'BROKER'|'CATEGORY', val: string) => {
        if (type === 'BROKER') {
            const newOpts = brokerOptions.filter(o => o !== val);
            setBrokerOptions(newOpts);
            localStorage.setItem(KEY_BROKERS, JSON.stringify(newOpts));
        } else {
            const newOpts = categoryOptions.filter(o => o !== val);
            setCategoryOptions(newOpts);
            localStorage.setItem(KEY_CATEGORIES, JSON.stringify(newOpts));
        }
    };

    const handleExport = () => {
        const headers = ['日期','證券戶','自訂分類','股號','股名','單價','股數','成交價金','手續費','總成本','備註'];
        const data = filteredTransactions.map(t => ({
            '日期': t.date,
            '證券戶': t.broker,
            '自訂分類': t.category,
            '股號': t.code,
            '股名': t.name,
            '單價': t.price,
            '股數': t.quantity,
            '成交價金': t.totalAmount,
            '手續費': t.fee,
            '總成本': t.cost,
            '備註': t.note || ''
        }));
        exportToCSV('Transactions_Export', headers, data);
    };

    // --- RENDER ---
    const fmtMoney = (n: number) => Math.round(n).toLocaleString();

    return (
        <div className="h-full flex flex-col p-2 gap-2 bg-blue-50 overflow-hidden">
             
             {/* Header Controls */}
             <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-200 flex flex-col gap-3 flex-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                         <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                             <Filter className="w-4 h-4 text-blue-600" />
                             <select 
                                value={selectedBroker} 
                                onChange={(e) => setSelectedBroker(e.target.value)}
                                className="bg-transparent text-sm font-bold text-blue-900 outline-none"
                             >
                                 <option value="ALL">全部證券戶</option>
                                 {availableBrokers.map(b => <option key={b} value={b}>{b}</option>)}
                             </select>
                         </div>
                         <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                             <Filter className="w-4 h-4 text-blue-600" />
                             <select 
                                value={selectedCategory} 
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="bg-transparent text-sm font-bold text-blue-900 outline-none"
                             >
                                 <option value="ALL">全部策略</option>
                                 {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                         </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => { setEditingId(null); setFormData({ ...formData, broker: brokerOptions[0]||'', category: categoryOptions[0]||'' }); setShowAddModal(true); }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm shadow-sm transition-colors"
                        >
                            <Plus className="w-4 h-4" /> 新增交易
                        </button>
                        <button 
                            onClick={handleExport}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-bold text-sm whitespace-nowrap shadow-sm transition-colors"
                        >
                            <Download className="w-4 h-4" /> 匯出
                        </button>
                    </div>
                </div>
             </div>

             {/* Main Content Area */}
             <div className="flex-1 flex gap-2 overflow-hidden min-h-0">
                 
                 {/* Left Panel: Position List */}
                 <div className="w-[300px] flex-none bg-white rounded-lg shadow-sm border border-blue-200 flex flex-col overflow-hidden min-h-0">
                    <div className="p-3 bg-blue-50 border-b border-blue-100 font-bold text-blue-900 flex justify-between items-center text-sm flex-none">
                        <span>持倉總覽</span>
                        <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full text-xs font-bold">{positions.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
                        {positions.length === 0 ? (
                            <div className="p-4 text-center text-gray-400 text-sm">無持倉資料</div>
                        ) : positions.map(pos => (
                            <div 
                                key={pos.code}
                                onClick={() => setSelectedCode(pos.code)}
                                className={`rounded-lg p-3 cursor-pointer transition-all duration-200 flex flex-col gap-1 relative ${getPositionColor(pos.code, selectedCode === pos.code)}`}
                            >
                                <div className="flex justify-between items-center border-b border-black/5 pb-1 mb-1">
                                    <span className="font-mono font-bold text-lg">{pos.code}</span>
                                    <span className="font-bold text-sm truncate max-w-[120px]">{pos.name}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">庫存:</span>
                                    <span className="font-mono font-bold">{pos.totalQty.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">均價:</span>
                                    <span className="font-mono font-bold">{pos.avgCost.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">總投:</span>
                                    <span className="font-mono font-bold text-blue-800">{fmtMoney(pos.totalCost)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>

                 {/* Right Panel: Details */}
                 <div className="flex-1 bg-white rounded-lg shadow-sm border border-blue-200 flex flex-col overflow-hidden min-h-0">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 bg-gray-50">
                        <button 
                            onClick={() => setActiveSubTab('HOLDINGS')}
                            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeSubTab === 'HOLDINGS' ? 'bg-white text-blue-700 border-t-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Layers className="w-4 h-4" /> 交易明細
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('DIVIDEND')}
                            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeSubTab === 'DIVIDEND' ? 'bg-white text-blue-700 border-t-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Coins className="w-4 h-4" /> 配息試算
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto p-0 bg-white">
                        {!selectedCode ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Wallet className="w-16 h-16 mb-4 opacity-30" />
                                <p>請選擇左側 ETF 查看詳情</p>
                            </div>
                        ) : (
                            <>
                                {activeSubTab === 'HOLDINGS' && (
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-sm font-bold text-gray-700">
                                            <tr>
                                                <th className="p-3 whitespace-nowrap">日期</th>
                                                <th className="p-3 whitespace-nowrap">券商</th>
                                                <th className="p-3 whitespace-nowrap">策略</th>
                                                <th className="p-3 whitespace-nowrap text-right">單價</th>
                                                <th className="p-3 whitespace-nowrap text-right">股數</th>
                                                <th className="p-3 whitespace-nowrap text-right">手續費</th>
                                                <th className="p-3 whitespace-nowrap text-right">總成本</th>
                                                <th className="p-3 whitespace-nowrap text-center">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-sm">
                                            {holdingsDetailData.map(t => (
                                                <tr key={t.id} className="hover:bg-blue-50 transition-colors">
                                                    <td className="p-3 font-mono text-gray-600">{t.date}</td>
                                                    <td className="p-3 font-bold text-gray-800">{t.broker}</td>
                                                    <td className="p-3"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold">{t.category}</span></td>
                                                    <td className="p-3 text-right font-mono">{t.price}</td>
                                                    <td className="p-3 text-right font-mono font-bold text-blue-700">{t.quantity.toLocaleString()}</td>
                                                    <td className="p-3 text-right font-mono text-gray-500">{t.fee}</td>
                                                    <td className="p-3 text-right font-mono font-bold text-gray-900">{fmtMoney(t.cost)}</td>
                                                    <td className="p-3 text-center flex items-center justify-center gap-2">
                                                        <button onClick={() => handleEditTransaction(t)} className="p-1 hover:bg-gray-200 rounded text-blue-600"><Edit className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDeleteTransaction(t.id)} className="p-1 hover:bg-gray-200 rounded text-red-500"><Trash2 className="w-4 h-4" /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {holdingsDetailData.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-gray-400">無交易紀錄</td></tr>}
                                        </tbody>
                                    </table>
                                )}

                                {activeSubTab === 'DIVIDEND' && (
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-purple-50 sticky top-0 border-b border-purple-200 text-sm font-bold text-purple-900">
                                            <tr>
                                                <th className="p-3 whitespace-nowrap">除息日</th>
                                                <th className="p-3 whitespace-nowrap text-right">配息(元)</th>
                                                <th className="p-3 whitespace-nowrap">券商</th>
                                                <th className="p-3 whitespace-nowrap">策略</th>
                                                <th className="p-3 whitespace-nowrap text-right">參與股數</th>
                                                <th className="p-3 whitespace-nowrap text-right">預估領息</th>
                                                <th className="p-3 whitespace-nowrap text-right">發放日</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-purple-50 text-sm">
                                            {dividendDetailData.map((d: any, i) => (
                                                <tr key={i} className="hover:bg-purple-50/50 transition-colors">
                                                    <td className="p-3 font-mono text-gray-600">{d.exDate}</td>
                                                    <td className="p-3 text-right font-mono font-bold text-emerald-600">{d.amount}</td>
                                                    <td className="p-3 font-bold text-gray-800">{d.broker}</td>
                                                    <td className="p-3"><span className="bg-white border border-purple-100 px-2 py-0.5 rounded text-xs font-bold text-purple-700">{d.category}</span></td>
                                                    <td className="p-3 text-right font-mono text-gray-600">{d.qty.toLocaleString()}</td>
                                                    <td className="p-3 text-right font-mono font-bold text-orange-600 text-base">{fmtMoney(d.totalDiv)}</td>
                                                    <td className="p-3 text-right font-mono text-gray-500">{d.paymentDate || '-'}</td>
                                                </tr>
                                            ))}
                                            {dividendDetailData.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-400">無符合條件的配息紀錄</td></tr>}
                                        </tbody>
                                    </table>
                                )}
                            </>
                        )}
                    </div>
                 </div>
             </div>

             {/* Modals */}
             {showAddModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl flex flex-col animate-in zoom-in-95 max-h-[90vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-blue-50 rounded-t-xl">
                            <h3 className="font-bold text-lg text-blue-900">{editingId ? '編輯交易' : '新增交易'}</h3>
                            <button onClick={() => setShowAddModal(false)}><X className="w-6 h-6 text-gray-500" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">日期*</label>
                                    <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border p-2 rounded" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">代碼*</label>
                                    <input type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} placeholder="例如: 00878" className="w-full border p-2 rounded font-mono" />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">券商*</label>
                                    <div className="flex gap-2">
                                        <select value={formData.broker} onChange={e => setFormData({...formData, broker: e.target.value})} className="w-full border p-2 rounded">
                                            <option value="">請選擇</option>
                                            {brokerOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                        <button onClick={() => setShowLexiconModal('BROKER')} className="bg-gray-100 p-2 rounded hover:bg-gray-200"><Edit className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">策略*</label>
                                    <div className="flex gap-2">
                                        <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border p-2 rounded">
                                            <option value="">請選擇</option>
                                            {categoryOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                        <button onClick={() => setShowLexiconModal('CATEGORY')} className="bg-gray-100 p-2 rounded hover:bg-gray-200"><Edit className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">單價*</label>
                                    <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full border p-2 rounded font-mono" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">股數*</label>
                                    <input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full border p-2 rounded font-mono" />
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-gray-600">成交價金</span>
                                    <input type="number" value={formData.totalAmount} onChange={e => setFormData({...formData, totalAmount: e.target.value})} className="w-32 text-right border p-1 rounded font-mono" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-gray-600">手續費</span>
                                    <input type="number" value={formData.fee} onChange={e => setFormData({...formData, fee: e.target.value})} className="w-32 text-right border p-1 rounded font-mono" />
                                </div>
                                <div className="border-t border-gray-300 pt-2 flex justify-between items-center">
                                    <span className="text-base font-bold text-gray-900">總成本</span>
                                    <span className="text-xl font-bold text-blue-700 font-mono">{fmtMoney(formData.cost)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex gap-3">
                            <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-lg">取消</button>
                            <button onClick={handleSaveTransaction} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md">儲存</button>
                        </div>
                    </div>
                </div>
             )}

             {showLexiconModal && (
                 <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                     <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6">
                         <h3 className="font-bold text-lg mb-4">{showLexiconModal === 'BROKER' ? '編輯券商清單' : '編輯策略清單'}</h3>
                         <div className="flex gap-2 mb-4">
                             <input type="text" value={lexiconInput} onChange={e => setLexiconInput(e.target.value)} placeholder="輸入新名稱" className="flex-1 border p-2 rounded" />
                             <button onClick={handleLexiconSave} className="bg-green-600 text-white px-4 rounded font-bold">新增</button>
                         </div>
                         <div className="space-y-2 max-h-60 overflow-y-auto">
                             {(showLexiconModal === 'BROKER' ? brokerOptions : categoryOptions).map(opt => (
                                 <div key={opt} className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                                     <span>{opt}</span>
                                     <button onClick={() => handleLexiconDelete(showLexiconModal!, opt)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button>
                                 </div>
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
