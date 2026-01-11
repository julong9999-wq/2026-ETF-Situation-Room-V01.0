import React, { useState, useEffect, useMemo } from 'react';
import { 
    Wallet, PieChart, TrendingUp, Plus, Upload, Download, 
    Trash2, Edit, X, FileSpreadsheet, AlertCircle, ChevronRight,
    Book, Settings, Save
} from 'lucide-react';
import { UserTransaction, UserPosition, BasicInfo } from '../types';
import { getBasicInfo } from '../services/dataService';

const LOCAL_STORAGE_KEY = 'user_transactions_v1';
const KEY_BROKERS = 'user_lexicon_brokers';
const KEY_CATEGORIES = 'user_lexicon_categories';

// Default Lexicon Values
const DEFAULT_BROKERS = ["國泰_爸", "國泰_媽", "國泰_小孩"];
const DEFAULT_CATEGORIES = ["自存退休", "質押貸款", "勞退理財"];

const TabPerformance: React.FC = () => {
    // --- STATE ---
    const [activeSubTab, setActiveSubTab] = useState<'HOLDINGS' | 'DIVIDEND' | 'PERFORMANCE'>('HOLDINGS');
    
    // Data State
    const [transactions, setTransactions] = useState<UserTransaction[]>([]);
    const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
    const [selectedCode, setSelectedCode] = useState<string | null>(null);

    // Lexicon State
    const [brokerOptions, setBrokerOptions] = useState<string[]>(DEFAULT_BROKERS);
    const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_CATEGORIES);

    // Filters
    const [selectedBroker, setSelectedBroker] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showLexiconModal, setShowLexiconModal] = useState<'BROKER' | 'CATEGORY' | null>(null);

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
        totalAmount: '', // 成交價金
        fee: '',         // 手續費
        cost: 0          // 購買成本 (Calculated)
    });

    // Lexicon Edit State
    const [lexiconInput, setLexiconInput] = useState('');

    // --- INITIALIZATION ---
    useEffect(() => {
        // Load Transactions
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
            try { setTransactions(JSON.parse(saved)); } catch (e) { console.error(e); }
        }

        // Load Basic Info for Auto-fill
        getBasicInfo().then(setBasicInfo);

        // Load Lexicons
        const savedBrokers = localStorage.getItem(KEY_BROKERS);
        if (savedBrokers) setBrokerOptions(JSON.parse(savedBrokers));
        
        const savedCats = localStorage.getItem(KEY_CATEGORIES);
        if (savedCats) setCategoryOptions(JSON.parse(savedCats));
    }, []);

    // --- AUTO-FILL LOGIC ---
    // 1. Auto-fill Name when Code changes
    useEffect(() => {
        if (formData.code && basicInfo.length > 0) {
            const found = basicInfo.find(b => b.etfCode === formData.code);
            if (found) {
                setFormData(prev => ({ ...prev, name: found.etfName }));
            }
        }
    }, [formData.code, basicInfo]);

    // 2. Auto-calc Total Amount (Suggestion) when Price or Qty changes
    useEffect(() => {
        const p = parseFloat(formData.price);
        const q = parseFloat(formData.quantity);
        if (!isNaN(p) && !isNaN(q) && p > 0 && q > 0) {
            // Only auto-fill if amount is empty or looks calculated
            // Only if user hasn't manually set it? For simplicity, we auto-calc
            setFormData(prev => ({ ...prev, totalAmount: Math.floor(p * q).toString() }));
        }
    }, [formData.price, formData.quantity]);

    // 3. Auto-calc Cost (System Calculation)
    useEffect(() => {
        const amt = parseFloat(formData.totalAmount) || 0;
        const fee = parseFloat(formData.fee) || 0;
        setFormData(prev => ({ ...prev, cost: amt + fee }));
    }, [formData.totalAmount, formData.fee]);


    // --- CALCULATIONS (Master List) ---
    const positions: UserPosition[] = useMemo(() => {
        const map = new Map<string, UserPosition>();
        transactions.forEach(t => {
            if (t.type !== 'Buy') return;
            if (!map.has(t.code)) {
                map.set(t.code, {
                    code: t.code, name: t.name, totalQty: 0, avgCost: 0, totalCost: 0,
                    broker: t.broker, category: t.category
                });
            }
            const pos = map.get(t.code)!;
            pos.totalQty += t.quantity;
            pos.totalCost += t.cost;
        });
        map.forEach(pos => {
            if (pos.totalQty > 0) pos.avgCost = pos.totalCost / pos.totalQty;
        });
        return Array.from(map.values()).sort((a,b) => a.code.localeCompare(b.code));
    }, [transactions]);

    const detailData = useMemo(() => {
        if (!selectedCode) return [];
        return transactions.filter(t => t.code === selectedCode).sort((a, b) => b.date.localeCompare(a.date));
    }, [selectedCode, transactions]);

    // --- HANDLERS ---
    const handleSaveTransaction = () => {
        if (!formData.code || !formData.price || !formData.quantity) {
            alert('請填寫完整資料');
            return;
        }

        const newItem: UserTransaction = {
            id: editingId || crypto.randomUUID(),
            date: formData.date,
            code: formData.code,
            name: formData.name,
            type: 'Buy',
            price: parseFloat(formData.price),
            quantity: parseFloat(formData.quantity),
            totalAmount: parseFloat(formData.totalAmount) || 0,
            fee: parseFloat(formData.fee) || 0,
            cost: formData.cost,
            broker: formData.broker || brokerOptions[0] || '',
            category: formData.category || categoryOptions[0] || '',
            tax: 0,
            note: ''
        };

        let updatedTransactions;
        if (editingId) {
            updatedTransactions = transactions.map(t => t.id === editingId ? newItem : t);
        } else {
            updatedTransactions = [...transactions, newItem];
        }

        setTransactions(updatedTransactions);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTransactions));
        
        // Reset Form
        setFormData({
            date: new Date().toISOString().split('T')[0],
            broker: '', category: '', code: '', name: '',
            price: '', quantity: '', totalAmount: '', fee: '', cost: 0
        });
        setEditingId(null);
        setShowAddModal(false);
    };

    const handleEdit = (t: UserTransaction) => {
        setEditingId(t.id);
        setFormData({
            date: t.date,
            broker: t.broker,
            category: t.category,
            code: t.code,
            name: t.name,
            price: t.price.toString(),
            quantity: t.quantity.toString(),
            totalAmount: t.totalAmount.toString(),
            fee: t.fee.toString(),
            cost: t.cost
        });
        setShowAddModal(true);
    };

    const handleDelete = (id: string) => {
        if(window.confirm('確定要刪除這筆交易嗎？')) {
            const updated = transactions.filter(t => t.id !== id);
            setTransactions(updated);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        }
    };

    // --- LEXICON HANDLERS ---
    const handleAddLexiconItem = () => {
        if (!lexiconInput.trim()) return;
        if (showLexiconModal === 'BROKER') {
            const newOpts = [...brokerOptions, lexiconInput.trim()];
            setBrokerOptions(newOpts);
            localStorage.setItem(KEY_BROKERS, JSON.stringify(newOpts));
        } else {
            const newOpts = [...categoryOptions, lexiconInput.trim()];
            setCategoryOptions(newOpts);
            localStorage.setItem(KEY_CATEGORIES, JSON.stringify(newOpts));
        }
        setLexiconInput('');
    };

    const handleDeleteLexiconItem = (item: string) => {
        if (!confirm(`確定刪除詞庫項目 "${item}" 嗎？`)) return;
        if (showLexiconModal === 'BROKER') {
            const newOpts = brokerOptions.filter(i => i !== item);
            setBrokerOptions(newOpts);
            localStorage.setItem(KEY_BROKERS, JSON.stringify(newOpts));
        } else {
            const newOpts = categoryOptions.filter(i => i !== item);
            setCategoryOptions(newOpts);
            localStorage.setItem(KEY_CATEGORIES, JSON.stringify(newOpts));
        }
    };

    const openAddModal = () => {
        setEditingId(null);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            broker: brokerOptions[0] || '',
            category: categoryOptions[0] || '',
            code: '', name: '',
            price: '', quantity: '', totalAmount: '', fee: '', cost: 0
        });
        setShowAddModal(true);
    };

    const fmtNum = (n: number) => n?.toLocaleString() || '0';
    
    // --- RENDER ---
    return (
        <div className="flex flex-col h-full bg-blue-50">
            {/* 1. Top Navigation Tabs */}
            <div className="bg-white border-b border-blue-200 p-2 flex items-center gap-2 flex-none">
                {[
                    { id: 'HOLDINGS', label: '持股明細', icon: Wallet },
                    { id: 'DIVIDEND', label: '股息分析', icon: PieChart },
                    { id: 'PERFORMANCE', label: '績效分析', icon: TrendingUp },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id as any)}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-base transition-all
                            ${activeSubTab === tab.id 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'bg-white text-blue-500 border border-blue-100 hover:bg-blue-50'
                            }
                        `}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 2. Main Content Area */}
            {activeSubTab === 'HOLDINGS' ? (
                <div className="flex-1 flex gap-2 p-2 overflow-hidden min-h-0">
                    
                    {/* LEFT PANEL: Master List (Positions) */}
                    <div className="w-[340px] flex-none bg-white rounded-xl shadow-sm border border-blue-200 flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="p-3 bg-blue-50 border-b border-blue-100 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-blue-900 text-lg flex items-center gap-2">
                                    <Wallet className="w-5 h-5" /> 庫存總覽
                                </h3>
                                <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded text-sm font-bold">
                                    {positions.length} 檔
                                </span>
                            </div>
                            
                            {/* Filter Dropdowns */}
                            {positions.length > 0 && (
                                <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                                    <select value={selectedBroker} onChange={e => setSelectedBroker(e.target.value)} className="w-1/2 p-1.5 rounded border border-blue-200 text-base font-bold text-gray-700 bg-white">
                                        <option value="">全部證券戶</option>
                                        {brokerOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                    <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-1/2 p-1.5 rounded border border-blue-200 text-base font-bold text-gray-700 bg-white">
                                        <option value="">全部分類</option>
                                        {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/50">
                            {positions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                                    <Wallet className="w-12 h-12 mb-2 opacity-20" />
                                    <p className="text-base font-bold">尚無庫存資料</p>
                                    <p className="text-sm font-bold">請點擊右側新增或匯入</p>
                                </div>
                            ) : (
                                positions.map(pos => (
                                    <div 
                                        key={pos.code}
                                        onClick={() => setSelectedCode(pos.code)}
                                        className={`
                                            p-3 rounded-lg cursor-pointer border transition-all relative group
                                            ${selectedCode === pos.code 
                                                ? 'bg-blue-50 border-blue-500 shadow-md ring-1 ring-blue-500' 
                                                : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                                            }
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div>
                                                <span className="text-lg font-bold text-blue-800 font-mono mr-2">{pos.code}</span>
                                                <span className="text-base font-bold text-gray-700">{pos.name}</span>
                                            </div>
                                            <span className="text-sm bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                                                {pos.broker || '未分類'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-base mt-2">
                                            <div className="flex flex-col">
                                                <span className="text-gray-400 text-sm font-bold">累積股數</span>
                                                <span className="font-bold font-mono text-gray-800">{fmtNum(pos.totalQty)}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-gray-400 text-sm font-bold">平均成本</span>
                                                <span className="font-bold font-mono text-gray-800">{fmtNum(Math.round(pos.avgCost * 100) / 100)}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-gray-400 text-sm font-bold">累積金額</span>
                                                <span className="font-bold font-mono text-blue-600">{fmtNum(pos.totalCost)}</span>
                                            </div>
                                        </div>
                                        <div className={`absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity ${selectedCode === pos.code ? 'text-blue-500' : 'text-gray-300'}`}>
                                            <ChevronRight className="w-6 h-6" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANEL: Details & Transactions */}
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-blue-200 flex flex-col overflow-hidden">
                        <div className="p-3 bg-white border-b border-blue-100 flex items-center justify-between flex-none">
                            <div className="flex items-center gap-3">
                                {selectedCode ? (
                                    <>
                                        <div className="bg-blue-100 p-2 rounded-lg"><FileSpreadsheet className="w-5 h-5 text-blue-600" /></div>
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-800">{selectedCode} 交易明細</h2>
                                            <p className="text-sm font-bold text-gray-500">共 {detailData.length} 筆紀錄</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <AlertCircle className="w-5 h-5" /><span className="font-bold text-base">請選擇左側標的查看明細</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button onClick={openAddModal} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm transition-colors text-base">
                                    <Plus className="w-4 h-4" /> 新增資料
                                </button>
                                <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold hover:bg-emerald-100 shadow-sm transition-colors text-base">
                                    <Upload className="w-4 h-4" /> 匯入資料
                                </button>
                                <button className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg font-bold hover:bg-gray-100 shadow-sm transition-colors text-base" disabled={transactions.length === 0}>
                                    <Download className="w-4 h-4" /> 匯出報表
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto bg-white min-h-0">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                                    <tr>
                                        <th className="p-3 font-bold text-gray-700 text-base whitespace-nowrap">證券戶</th>
                                        <th className="p-3 font-bold text-gray-700 text-base whitespace-nowrap">分類</th>
                                        <th className="p-3 font-bold text-gray-700 text-base whitespace-nowrap">日期</th>
                                        <th className="p-3 font-bold text-gray-700 text-base whitespace-nowrap">股號</th>
                                        <th className="p-3 font-bold text-gray-700 text-base whitespace-nowrap">股名</th>
                                        <th className="p-3 font-bold text-gray-700 text-base text-right whitespace-nowrap">成交單價</th>
                                        <th className="p-3 font-bold text-gray-700 text-base text-right whitespace-nowrap">成交股數</th>
                                        <th className="p-3 font-bold text-gray-700 text-base text-right whitespace-nowrap">成交價金</th>
                                        <th className="p-3 font-bold text-gray-700 text-base text-right whitespace-nowrap">手續費</th>
                                        <th className="p-3 font-bold text-gray-700 text-base text-right whitespace-nowrap">購買成本</th>
                                        <th className="p-3 font-bold text-gray-700 text-base text-center whitespace-nowrap">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-base font-bold">
                                    {detailData.map((t) => (
                                        <tr key={t.id} className="hover:bg-blue-50/50 transition-colors group">
                                            <td className="p-3 text-gray-700">{t.broker}</td>
                                            <td className="p-3 text-gray-600"><span className="bg-gray-100 px-2 py-0.5 rounded text-sm">{t.category}</span></td>
                                            <td className="p-3 font-mono text-gray-600">{t.date}</td>
                                            <td className="p-3 font-mono text-blue-600 font-bold">{t.code}</td>
                                            <td className="p-3 text-gray-800 font-bold">{t.name}</td>
                                            <td className="p-3 font-mono text-right">{fmtNum(t.price)}</td>
                                            <td className="p-3 font-mono text-right font-bold">{fmtNum(t.quantity)}</td>
                                            <td className="p-3 font-mono text-right text-gray-500">{fmtNum(t.totalAmount)}</td>
                                            <td className="p-3 font-mono text-right text-gray-400">{fmtNum(t.fee)}</td>
                                            <td className="p-3 font-mono text-right font-bold text-blue-700">{fmtNum(t.cost)}</td>
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(t); }} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors" title="編輯">
                                                        <Edit className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors" title="刪除">
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {detailData.length === 0 && (<tr><td colSpan={11} className="p-10 text-center text-gray-400 font-bold">{selectedCode ? '此標的尚無交易紀錄' : '👈 請先從左側選擇一檔標的'}</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-blue-400">
                    <p className="text-xl font-bold">功能開發中 ({activeSubTab})</p>
                </div>
            )}

            {/* --- ADD/EDIT TRANSACTION MODAL --- */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b bg-blue-50 rounded-t-xl flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-xl text-blue-900 flex items-center gap-2">
                                {editingId ? <Edit className="w-6 h-6" /> : <Plus className="w-6 h-6" />} 
                                {editingId ? '編輯交易資料' : '新增交易資料'}
                            </h3>
                            <button onClick={() => setShowAddModal(false)}><X className="w-6 h-6 text-gray-500" /></button>
                        </div>
                        
                        <div className="p-6 space-y-5 overflow-y-auto">
                            {/* 1. Date */}
                            <div className="space-y-1">
                                <label className="text-base font-bold text-gray-700">日期</label>
                                <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full border rounded-lg p-2.5 text-base font-mono font-bold bg-gray-50 focus:bg-white focus:ring-2 ring-blue-200 outline-none transition-all" />
                            </div>

                            {/* 2. Broker with Lexicon */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-end">
                                    <label className="text-base font-bold text-gray-700">證券戶</label>
                                    <button onClick={() => setShowLexiconModal('BROKER')} className="text-sm font-bold text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"><Book className="w-4 h-4"/> 詞庫管理</button>
                                </div>
                                <select value={formData.broker} onChange={e => setFormData({...formData, broker: e.target.value})} className="w-full border rounded-lg p-2.5 text-base font-bold bg-white focus:ring-2 ring-blue-200 outline-none">
                                    {brokerOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            {/* 3. Category with Lexicon */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-end">
                                    <label className="text-base font-bold text-gray-700">分類</label>
                                    <button onClick={() => setShowLexiconModal('CATEGORY')} className="text-sm font-bold text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"><Book className="w-4 h-4"/> 詞庫管理</button>
                                </div>
                                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border rounded-lg p-2.5 text-base font-bold bg-white focus:ring-2 ring-blue-200 outline-none">
                                    {categoryOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            {/* 4. Code & Name */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-base font-bold text-gray-700">股號</label>
                                    <input type="text" placeholder="輸入代碼" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full border rounded-lg p-2.5 text-base font-mono font-bold text-blue-700 focus:ring-2 ring-blue-200 outline-none uppercase" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-base font-bold text-gray-700">股名 (自動帶入)</label>
                                    <input type="text" placeholder="系統自動搜尋" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded-lg p-2.5 text-base font-bold bg-gray-50 text-gray-600 focus:bg-white focus:ring-2 ring-blue-200 outline-none" />
                                </div>
                            </div>

                            {/* 5. Price & Qty */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-base font-bold text-gray-700">成交單價</label>
                                    <input type="number" placeholder="0.00" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full border rounded-lg p-2.5 text-base font-mono font-bold text-right focus:ring-2 ring-blue-200 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-base font-bold text-gray-700">成交股數</label>
                                    <input type="number" placeholder="0" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full border rounded-lg p-2.5 text-base font-mono font-bold text-right focus:ring-2 ring-blue-200 outline-none" />
                                </div>
                            </div>

                            {/* 6. Amount & Fee */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-base font-bold text-gray-700">成交價金</label>
                                    <input type="number" placeholder="0" value={formData.totalAmount} onChange={e => setFormData({...formData, totalAmount: e.target.value})} className="w-full border rounded-lg p-2.5 text-base font-mono font-bold text-right focus:ring-2 ring-blue-200 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-base font-bold text-gray-700">手續費</label>
                                    <input type="number" placeholder="0" value={formData.fee} onChange={e => setFormData({...formData, fee: e.target.value})} className="w-full border rounded-lg p-2.5 text-base font-mono font-bold text-right focus:ring-2 ring-blue-200 outline-none" />
                                </div>
                            </div>

                            {/* 7. Cost (Calculated) */}
                            <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center border border-blue-200">
                                <span className="font-bold text-base text-blue-900">購買成本 (系統計算)</span>
                                <span className="font-mono font-bold text-2xl text-blue-700">{fmtNum(formData.cost)}</span>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex gap-3 shrink-0">
                            <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 font-bold hover:bg-gray-100 transition-colors text-base">取消</button>
                            <button onClick={handleSaveTransaction} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2 text-base">
                                <Save className="w-5 h-5" /> 存檔
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- LEXICON MODAL --- */}
            {showLexiconModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 flex flex-col h-[500px]">
                        <div className="p-4 border-b bg-gray-50 rounded-t-xl flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <Book className="w-5 h-5 text-blue-600" />
                                編輯{showLexiconModal === 'BROKER' ? '證券戶' : '分類'}詞庫
                            </h3>
                            <button onClick={() => setShowLexiconModal(null)}><X className="w-6 h-6 text-gray-500" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {(showLexiconModal === 'BROKER' ? brokerOptions : categoryOptions).map((item) => (
                                <div key={item} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors group shadow-sm">
                                    <span className="font-bold text-base text-gray-700">{item}</span>
                                    <button onClick={() => handleDeleteLexiconItem(item)} className="text-gray-400 hover:text-red-500 p-1">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t bg-gray-50 rounded-b-xl">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={lexiconInput}
                                    onChange={e => setLexiconInput(e.target.value)}
                                    placeholder="輸入新名稱..."
                                    className="flex-1 border rounded-lg px-3 py-2 outline-none focus:ring-2 ring-blue-200 text-base font-bold"
                                    onKeyDown={e => e.key === 'Enter' && handleAddLexiconItem()}
                                />
                                <button onClick={handleAddLexiconItem} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-sm text-base">新增</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- IMPORT MODAL --- */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95">
                        <div className="p-4 border-b bg-emerald-50 rounded-t-xl flex justify-between items-center">
                            <h3 className="font-bold text-lg text-emerald-900 flex items-center gap-2">
                                <FileSpreadsheet className="w-5 h-5" /> 匯入 Excel / CSV
                            </h3>
                            <button onClick={() => setShowImportModal(false)}><X className="w-6 h-6 text-gray-500" /></button>
                        </div>
                        <div className="p-8 flex flex-col items-center text-center space-y-6">
                            <div className="w-full border-2 border-dashed border-gray-300 rounded-xl p-10 bg-gray-50 hover:bg-emerald-50/50 hover:border-emerald-400 transition-colors cursor-pointer group">
                                <Upload className="w-12 h-12 text-gray-400 group-hover:text-emerald-500 mx-auto mb-4 transition-colors" />
                                <p className="text-lg font-bold text-gray-600 group-hover:text-emerald-700">點擊選擇檔案 或 拖曳至此</p>
                                <p className="text-base text-gray-400 mt-2 font-bold">支援格式: .csv, .xlsx</p>
                            </div>

                            <div className="w-full text-left bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm space-y-2">
                                <div className="font-bold text-base text-blue-800 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    匯入說明與欄位順序
                                </div>
                                <ul className="list-disc list-inside text-blue-700 space-y-1 ml-1 text-base font-bold">
                                    <li>檔案第一列必須為標題列。</li>
                                    <li>建議欄位順序：<span className="font-mono bg-white px-1 rounded border">日期, 股號, 股名, 買賣別, 價格, 股數, 手續費, 證券戶, 分類</span></li>
                                    <li>系統將自動比對資料，<span className="font-bold text-blue-900">相同的交易紀錄將自動略過 (不會重複匯入)</span>。</li>
                                    <li>「分類」欄位可空白，其餘欄位為必填。</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TabPerformance;