import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Wallet, PieChart, TrendingUp, Plus, Upload, Download, 
    Trash2, Edit, X, FileSpreadsheet, AlertCircle, ChevronRight,
    Book, Save, Filter, RefreshCcw, AlertTriangle, Coins,
    LayoutDashboard, ChevronDown, ChevronUp, FolderOpen, Layers
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
    const [showSummaryModal, setShowSummaryModal] = useState(false); // New Summary Modal

    // Summary Modal State
    const [summaryViewMode, setSummaryViewMode] = useState<'ACCOUNT' | 'STOCK'>('ACCOUNT');
    // Using a set to track expanded IDs. ID format: "L1:Key" or "L2:Key"
    const [expandedSummaryRows, setExpandedSummaryRows] = useState<Set<string>>(new Set());

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
        let baseClass = 'bg-gray-50 border-gray-200'; // Default Light Gray

        if (f.includes('月')) baseClass = 'bg-amber-50 border-amber-200 text-amber-900'; // Light Tea/Brown
        else if (checkSeason(f, 'Q1')) baseClass = 'bg-blue-50 border-blue-200 text-blue-900'; // Light Blue
        else if (checkSeason(f, 'Q2')) baseClass = 'bg-green-50 border-green-200 text-green-900'; // Light Green
        else if (checkSeason(f, 'Q3')) baseClass = 'bg-orange-50 border-orange-200 text-orange-900'; // Light Orange
        
        if (isSelected) return `${baseClass} ring-2 ring-blue-500 shadow-md transform scale-[1.01] z-10`;
        return `${baseClass} hover:brightness-95 hover:shadow-sm`;
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
                        id: `${div.etfCode}-${div.exDate}-${broker}-${category}`,
                        code: div.etfCode,
                        name: div.etfName,
                        broker: broker,
                        category: category,
                        yearMonth: div.yearMonth,
                        exDate: div.exDate,
                        divAmount: div.amount,
                        heldShares: qty,
                        totalReceived: Math.floor(qty * div.amount)
                    });
                }
            });
        });

        return results;
    }, [selectedCode, systemDividends, transactions, selectedBroker, selectedCategory]);

    // --- SUMMARY CALCULATIONS (New 3-Level Logic) ---
    const summaryData = useMemo(() => {
        const source = transactions.filter(t => t.type === 'Buy');

        if (summaryViewMode === 'ACCOUNT') {
            const hierarchy = new Map<string, {
                broker: string,
                totalQty: number,
                totalCost: number,
                categories: Map<string, {
                    category: string,
                    totalQty: number,
                    totalCost: number,
                    items: Map<string, { code: string, name: string, qty: number, cost: number }>
                }>
            }>();

            source.forEach(t => {
                const bKey = t.broker || '未分類';
                const cKey = t.category || '未分類';
                
                if (!hierarchy.has(bKey)) {
                    hierarchy.set(bKey, { broker: bKey, totalQty: 0, totalCost: 0, categories: new Map() });
                }
                const bGroup = hierarchy.get(bKey)!;
                bGroup.totalQty += t.quantity;
                bGroup.totalCost += t.cost;

                if (!bGroup.categories.has(cKey)) {
                    bGroup.categories.set(cKey, { category: cKey, totalQty: 0, totalCost: 0, items: new Map() });
                }
                const cGroup = bGroup.categories.get(cKey)!;
                cGroup.totalQty += t.quantity;
                cGroup.totalCost += t.cost;

                const iKey = t.code;
                if (!cGroup.items.has(iKey)) {
                    cGroup.items.set(iKey, { code: t.code, name: t.name, qty: 0, cost: 0 });
                }
                const item = cGroup.items.get(iKey)!;
                item.qty += t.quantity;
                item.cost += t.cost;
            });

            return Array.from(hierarchy.values()).map(b => ({
                id: b.broker,
                label: b.broker,
                totalQty: b.totalQty,
                totalCost: b.totalCost,
                children: Array.from(b.categories.values()).map(c => ({
                    id: `${b.broker}|${c.category}`,
                    label: c.category,
                    totalQty: c.totalQty,
                    totalCost: c.totalCost,
                    children: Array.from(c.items.values()).sort((x,y) => x.code.localeCompare(y.code))
                })).sort((x,y) => x.label.localeCompare(y.label))
            })).sort((x,y) => x.label.localeCompare(y.label));

        } else {
            const hierarchy = new Map<string, {
                code: string,
                name: string,
                totalQty: number,
                totalCost: number,
                items: Map<string, { broker: string, category: string, qty: number, cost: number }>
            }>();

            source.forEach(t => {
                const key = t.code;
                if (!hierarchy.has(key)) {
                    hierarchy.set(key, { code: t.code, name: t.name, totalQty: 0, totalCost: 0, items: new Map() });
                }
                const group = hierarchy.get(key)!;
                group.totalQty += t.quantity;
                group.totalCost += t.cost;

                const iKey = `${t.broker}|${t.category}`;
                if (!group.items.has(iKey)) {
                    group.items.set(iKey, { broker: t.broker, category: t.category, qty: 0, cost: 0 });
                }
                const item = group.items.get(iKey)!;
                item.qty += t.quantity;
                item.cost += t.cost;
            });

            return Array.from(hierarchy.values()).map(g => ({
                id: g.code,
                label: g.code,
                subLabel: g.name,
                totalQty: g.totalQty,
                totalCost: g.totalCost,
                children: Array.from(g.items.values()).sort((x,y) => (x.broker+x.category).localeCompare(y.broker+y.category))
            })).sort((a,b) => a.label.localeCompare(b.label));
        }
    }, [transactions, summaryViewMode]);

    const toggleSummaryRow = (id: string) => {
        const newSet = new Set(expandedSummaryRows);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedSummaryRows(newSet);
    };

    // --- HANDLERS ---
    const handleBrokerChange = (broker: string) => {
        setSelectedBroker(broker);
        setSelectedCategory('ALL'); 
    };

    // ... (Keep existing handlers for Save, Edit, Delete, Clear, Export, Import) ...
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
        if (newItem.broker && !brokerOptions.includes(newItem.broker)) {
             const newBrokers = [...brokerOptions, newItem.broker];
             setBrokerOptions(newBrokers);
             localStorage.setItem(KEY_BROKERS, JSON.stringify(newBrokers));
        }
        if (newItem.category && !categoryOptions.includes(newItem.category)) {
             const newCats = [...categoryOptions, newItem.category];
             setCategoryOptions(newCats);
             localStorage.setItem(KEY_CATEGORIES, JSON.stringify(newCats));
        }
        setFormData({ date: new Date().toISOString().split('T')[0], broker: '', category: '', code: '', name: '', price: '', quantity: '', totalAmount: '', fee: '', cost: 0 });
        setEditingId(null);
        setShowAddModal(false);
    };

    const handleEdit = (t: UserTransaction) => {
        setEditingId(t.id);
        setFormData({ date: t.date, broker: t.broker, category: t.category, code: t.code, name: t.name, price: t.price.toString(), quantity: t.quantity.toString(), totalAmount: t.totalAmount.toString(), fee: t.fee.toString(), cost: t.cost });
        setShowAddModal(true);
    };

    const handleDelete = (id: string) => {
        if(window.confirm('確定要刪除這筆交易嗎？')) {
            const updated = transactions.filter(t => t.id !== id);
            setTransactions(updated);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        }
    };

    const handleClearAllData = () => {
        if (transactions.length === 0) return;
        if (confirm('⚠️ 警告：即將清除所有「持股明細」資料！\n\n此動作無法復原，請確認您已備份 (匯出 CSV)。\n\n確定要刪除全部資料嗎？')) {
            if (confirm('再次確認：真的要刪除全部資料嗎？')) {
                setTransactions([]);
                localStorage.removeItem(LOCAL_STORAGE_KEY);
                setSelectedBroker('ALL');
                setSelectedCategory('ALL');
                setSelectedCode(null);
            }
        }
    };

    const handleExportReport = () => {
        if (transactions.length === 0) return alert('無資料可匯出');
        const headers = ['日期', '證券戶', '分類', '股號', '股名', '買賣別', '成交單價', '成交股數', '成交價金', '手續費', '購買成本'];
        const csvData = transactions.map(t => ({ '日期': t.date, '證券戶': t.broker, '分類': t.category, '股號': t.code, '股名': t.name, '買賣別': t.type, '成交單價': t.price.toFixed(2), '成交股數': t.quantity, '成交價金': t.totalAmount, '手續費': t.fee, '購買成本': t.cost }));
        exportToCSV(`交易紀錄備份_${new Date().toISOString().split('T')[0]}`, headers, csvData);
    };

    const handleExportDividendReport = () => {
        if (dividendDetailData.length === 0) return alert('無股息資料可匯出');
        const headers = ['證券戶', '分類', '股號', '股名', '年月', '除息日期', '除息金額', '持有股數', '股息金額'];
        const csvData = dividendDetailData.map(d => ({ '證券戶': d.broker, '分類': d.category, '股號': d.code, '股名': d.name, '年月': d.yearMonth, '除息日期': d.exDate, '除息金額': d.divAmount, '持有股數': d.heldShares, '股息金額': d.totalReceived }));
        exportToCSV(`${selectedCode || 'Portfolio'}_股息分析_${new Date().toISOString().split('T')[0]}`, headers, csvData);
    };

    // Import Logic
    const parseCSVRow = (str: string) => { const result = []; let current = ''; let inQuote = false; for(let i=0; i<str.length; i++) { const char = str[i]; if (char === '"') { inQuote = !inQuote; } else if (char === ',' && !inQuote) { result.push(current.trim()); current = ''; } else { current += char; } } result.push(current.trim()); return result.map(s => s.replace(/^"|"$/g, '').trim()); };
    const normalizeDate = (d: string) => { if (!d) return ''; const parts = d.replace(/\//g, '-').split('-'); if (parts.length === 3) { return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`; } return d; };
    const cleanNum = (v: string) => { if (!v) return 0; return parseFloat(v.replace(/,/g, '').replace(/"/g, '')) || 0; };
    const processCSVText = (text: string) => {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return { success: false, msg: '檔案內容為空' };
        const headers = parseCSVRow(lines[0]);
        const getIdx = (name: string) => headers.findIndex(h => h.includes(name));
        const dateIdx = Math.max(getIdx('日期'), getIdx('Date'));
        const codeIdx = Math.max(getIdx('股號'), getIdx('代碼'), getIdx('Code'));
        const nameIdx = Math.max(getIdx('股名'), getIdx('名稱'), getIdx('Name'));
        const priceIdx = Math.max(getIdx('價格'), getIdx('成交單價'), getIdx('單價'), getIdx('Price'));
        const qtyIdx = Math.max(getIdx('股數'), getIdx('成交股數'), getIdx('Qty'));
        const feeIdx = Math.max(getIdx('手續費'), getIdx('Fee'));
        const brokerIdx = Math.max(getIdx('證券戶'), getIdx('Broker'));
        const catIdx = Math.max(getIdx('分類'), getIdx('Category'));
        if (codeIdx === -1 || priceIdx === -1 || qtyIdx === -1) { return { success: false, msg: `找不到必要的欄位` }; }
        const newTransactions: UserTransaction[] = [];
        let dupCount = 0;
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const row = parseCSVRow(lines[i]);
            const rawDate = row[dateIdx] || new Date().toISOString().split('T')[0];
            const date = normalizeDate(rawDate);
            const code = row[codeIdx];
            const price = cleanNum(row[priceIdx]);
            const qty = cleanNum(row[qtyIdx]);
            if (code && price > 0 && qty > 0) {
                const isDup = transactions.some(t => t.code === code && t.date === date && t.price === price && t.quantity === qty);
                if (!isDup) {
                    const fee = feeIdx > -1 ? cleanNum(row[feeIdx]) : 0;
                    const totalAmt = Math.floor(price * qty);
                    newTransactions.push({ id: crypto.randomUUID(), date: date, code: code, name: row[nameIdx] || '', type: 'Buy', price: price, quantity: qty, fee: fee, tax: 0, totalAmount: totalAmt, cost: totalAmt + fee, broker: brokerIdx > -1 ? (row[brokerIdx] || brokerOptions[0] || '') : (brokerOptions[0] || ''), category: catIdx > -1 ? (row[catIdx] || categoryOptions[0] || '') : (categoryOptions[0] || '') });
                } else { dupCount++; }
            }
        }
        if (newTransactions.length > 0) { const updated = [...transactions, ...newTransactions]; setTransactions(updated); localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated)); return { success: true, msg: `成功匯入 ${newTransactions.length} 筆資料 (已忽略 ${dupCount} 筆重複)` }; } else { return { success: true, msg: `未發現新資料` }; }
    };
    const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { const buffer = e.target?.result as ArrayBuffer; if (!buffer) return; const text = new TextDecoder('utf-8').decode(buffer); const result = processCSVText(text); alert(result.msg); if (result.success) { setShowImportModal(false); } }; reader.readAsArrayBuffer(file); event.target.value = ''; };

    const fmtMoney = (n: number) => n?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0';
    const fmtPrice = (n: number) => n?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';
    const fmtDiv = (n: number) => n !== undefined && n !== null ? n.toFixed(3) : '0.000';

    const handleAddLexiconItem = () => { const val = lexiconInput.trim(); if (!val) return; if (showLexiconModal === 'BROKER') { if (!brokerOptions.includes(val)) { const updated = [...brokerOptions, val]; setBrokerOptions(updated); localStorage.setItem(KEY_BROKERS, JSON.stringify(updated)); } } else if (showLexiconModal === 'CATEGORY') { if (!categoryOptions.includes(val)) { const updated = [...categoryOptions, val]; setCategoryOptions(updated); localStorage.setItem(KEY_CATEGORIES, JSON.stringify(updated)); } } setLexiconInput(''); };
    const handleDeleteLexiconItem = (item: string) => { if (!confirm(`確定要刪除 "${item}" 嗎？`)) return; if (showLexiconModal === 'BROKER') { const updated = brokerOptions.filter(i => i !== item); setBrokerOptions(updated); localStorage.setItem(KEY_BROKERS, JSON.stringify(updated)); } else if (showLexiconModal === 'CATEGORY') { const updated = categoryOptions.filter(i => i !== item); setCategoryOptions(updated); localStorage.setItem(KEY_CATEGORIES, JSON.stringify(updated)); } };
    const openAddModal = () => { setEditingId(null); setFormData({ date: new Date().toISOString().split('T')[0], broker: '', category: '', code: '', name: '', price: '', quantity: '', totalAmount: '', fee: '', cost: 0 }); setShowAddModal(true); };

    const summaryShares = positions.reduce((acc, pos) => acc + pos.totalQty, 0);
    const summaryCost = positions.reduce((acc, pos) => acc + pos.totalCost, 0);

    // --- RENDER ---
    return (
        <div className="flex flex-col h-full bg-blue-50">
            {/* 1. Top Navigation */}
            <div className="bg-white border-b border-blue-200 p-2 flex flex-col gap-2 flex-none shadow-sm z-20">
                <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                        {[
                            { id: 'HOLDINGS', label: '持股明細', icon: Wallet },
                            { id: 'DIVIDEND', label: '股息分析', icon: PieChart },
                            { id: 'PERFORMANCE', label: '績效分析', icon: TrendingUp },
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveSubTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-base transition-all ${activeSubTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-blue-500 border border-blue-100 hover:bg-blue-50'}`}>
                                <tab.icon className="w-4 h-4" /> {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. Filters & Actions Row */}
            <div className="bg-white border-b border-blue-200 p-2 flex items-center justify-between gap-3 flex-none shadow-sm z-10">
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1 flex-1 min-w-0">
                    {transactions.length > 0 && (activeSubTab === 'HOLDINGS' || activeSubTab === 'DIVIDEND') && (
                        <>
                            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded border border-gray-200 shrink-0">
                                <span className="text-gray-400 px-2"><Filter className="w-4 h-4" /></span>
                                <button onClick={() => handleBrokerChange('ALL')} className={`px-3 py-1 rounded text-sm font-bold transition-colors whitespace-nowrap ${selectedBroker === 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>全部券商</button>
                                {availableBrokers.map(b => ( <button key={b} onClick={() => handleBrokerChange(b)} className={`px-3 py-1 rounded text-sm font-bold transition-colors whitespace-nowrap ${selectedBroker === b ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>{b}</button> ))}
                            </div>
                            <div className="h-6 w-px bg-gray-300 shrink-0"></div>
                            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded border border-gray-200 shrink-0">
                                <span className="text-gray-400 px-2"><Book className="w-4 h-4" /></span>
                                <button onClick={() => setSelectedCategory('ALL')} className={`px-3 py-1 rounded text-sm font-bold transition-colors whitespace-nowrap ${selectedCategory === 'ALL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>全部分類</button>
                                {availableCategories.map(c => ( <button key={c} onClick={() => setSelectedCategory(c)} className={`px-3 py-1 rounded text-sm font-bold transition-colors whitespace-nowrap ${selectedCategory === c ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>{c}</button> ))}
                            </div>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setShowSummaryModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 shadow-sm transition-colors text-sm"><LayoutDashboard className="w-4 h-4" /> 總表</button>
                    <button onClick={openAddModal} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-sm transition-colors text-sm"><Plus className="w-4 h-4" /> 新增</button>
                    <button onClick={() => { if(fileInputRef.current) fileInputRef.current.click(); else setShowImportModal(true); }} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold hover:bg-emerald-100 shadow-sm transition-colors text-sm"><Upload className="w-4 h-4" /> 匯入</button>
                    <button onClick={handleExportReport} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg font-bold hover:bg-gray-100 shadow-sm transition-colors text-sm" disabled={transactions.length === 0}><Download className="w-4 h-4" /> 匯出</button>
                    <button onClick={handleClearAllData} className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold hover:bg-red-100 shadow-sm transition-colors text-sm" disabled={transactions.length === 0}><Trash2 className="w-4 h-4" /> 清除</button>
                </div>
            </div>

            {/* 3. Main Content Area */}
            <div className="flex-1 flex gap-2 p-2 overflow-hidden min-h-0">
                
                {/* LEFT PANEL: Master List (Updated Layout) */}
                <div className="w-[360px] flex-none bg-white rounded-xl shadow-sm border border-blue-200 flex flex-col overflow-hidden">
                    <div className="p-2 bg-blue-100 border-b border-blue-200 grid grid-cols-3 gap-2 shrink-0">
                        <div className="flex flex-col items-center justify-center bg-blue-100 p-1.5 rounded-lg border border-blue-200 shadow-sm">
                            <span className="text-xs font-bold text-gray-500">檔數</span>
                            <span className="text-base font-bold text-blue-900 font-mono">{positions.length}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center bg-blue-100 p-1.5 rounded-lg border border-blue-200 shadow-sm">
                            <span className="text-xs font-bold text-gray-500">持有股數</span>
                            <span className="text-base font-bold text-gray-900 font-mono">{fmtMoney(summaryShares)}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center bg-blue-100 p-1.5 rounded-lg border border-blue-200 shadow-sm">
                            <span className="text-xs font-bold text-gray-500">持有金額</span>
                            <span className="text-sm font-bold text-blue-700 font-mono">{fmtMoney(summaryCost)}</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-gray-50/50">
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
                                        p-2 rounded-lg cursor-pointer border transition-all relative group flex flex-col gap-0.5
                                        ${getPositionColor(pos.code, selectedCode === pos.code)}
                                    `}
                                >
                                    <div className="flex justify-between items-center border-b border-black/5 pb-1 mb-1">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-lg font-bold font-mono leading-none">{pos.code}</span>
                                            <span className="text-base font-bold truncate leading-none opacity-90">{pos.name}</span>
                                        </div>
                                        <div className={`absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity ${selectedCode === pos.code ? 'text-blue-500' : 'text-gray-300'}`}>
                                            <ChevronRight className="w-5 h-5" />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-1 text-center">
                                        <div className="font-mono font-bold text-sm">{fmtMoney(pos.totalQty)}</div>
                                        <div className="font-mono font-bold text-sm">{fmtPrice(Math.round(pos.avgCost * 100) / 100)}</div>
                                        <div className="font-mono font-bold text-sm">{fmtMoney(pos.totalCost)}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL: Content Switch */}
                {/* ... (Right Panel remains unchanged) ... */}
                {activeSubTab === 'HOLDINGS' ? (
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-blue-200 flex flex-col overflow-hidden">
                        <div className="p-3 bg-white border-b border-blue-100 flex items-center justify-between flex-none">
                            <div className="flex items-center gap-3">
                                {selectedCode ? (
                                    <>
                                        <div className="bg-blue-100 p-2 rounded-lg"><FileSpreadsheet className="w-5 h-5 text-blue-600" /></div>
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">{selectedCode} 交易明細</h2>
                                            <p className="text-sm font-bold text-gray-500">共 {holdingsDetailData.length} 筆紀錄</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <AlertCircle className="w-5 h-5" /><span className="font-bold text-base">請選擇左側標的查看明細</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto bg-white min-h-0">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead className="bg-blue-50 sticky top-0 z-10 border-b border-blue-200">
                                    <tr>
                                        <th className="p-2 font-bold text-blue-900 text-base whitespace-nowrap">證券戶</th>
                                        <th className="p-2 font-bold text-blue-900 text-base whitespace-nowrap">分類</th>
                                        <th className="p-2 font-bold text-blue-900 text-base whitespace-nowrap">日期</th>
                                        <th className="p-2 font-bold text-blue-900 text-base text-right whitespace-nowrap">成交單價</th>
                                        <th className="p-2 font-bold text-blue-900 text-base text-right whitespace-nowrap">成交股數</th>
                                        <th className="p-2 font-bold text-blue-900 text-base text-right whitespace-nowrap">成交價金</th>
                                        <th className="p-2 font-bold text-blue-900 text-base text-right whitespace-nowrap">手續費</th>
                                        <th className="p-2 font-bold text-blue-900 text-base text-right whitespace-nowrap">購買成本</th>
                                        <th className="p-2 font-bold text-blue-900 text-base text-center whitespace-nowrap">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-base font-bold">
                                    {holdingsDetailData.map((t) => (
                                        <tr key={t.id} className="hover:bg-blue-50/50 transition-colors group">
                                            <td className="p-2 text-gray-800">{t.broker}</td>
                                            <td className="p-2 text-gray-600"><span className="bg-gray-100 px-2 py-0.5 rounded text-sm">{t.category}</span></td>
                                            <td className="p-2 font-mono text-gray-600">{t.date}</td>
                                            
                                            <td className="p-2 font-mono text-right text-gray-800">{fmtPrice(t.price)}</td>
                                            <td className="p-2 font-mono text-right font-bold text-gray-900">{fmtMoney(t.quantity)}</td>
                                            <td className="p-2 font-mono text-right text-gray-500">{fmtMoney(t.totalAmount)}</td>
                                            <td className="p-2 font-mono text-right text-gray-400">{fmtMoney(t.fee)}</td>
                                            <td className="p-2 font-mono text-right font-bold text-blue-800">{fmtMoney(t.cost)}</td>
                                            <td className="p-2 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(t); }} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors" title="編輯">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors" title="刪除">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {holdingsDetailData.length === 0 && (<tr><td colSpan={9} className="p-10 text-center text-gray-400 font-bold">{selectedCode ? '此標的尚無交易紀錄' : '👈 請先從左側選擇一檔標的'}</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : activeSubTab === 'DIVIDEND' ? (
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-blue-200 flex flex-col overflow-hidden">
                        <div className="p-3 bg-white border-b border-blue-100 flex items-center justify-between flex-none">
                            <div className="flex items-center gap-3">
                                {selectedCode ? (
                                    <>
                                        <div className="bg-purple-100 p-2 rounded-lg"><PieChart className="w-5 h-5 text-purple-600" /></div>
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">{selectedCode} 股息分析</h2>
                                            <p className="text-sm font-bold text-gray-500 flex items-center gap-2">
                                                累積領息: <span className="text-purple-700 text-base">{fmtMoney(dividendDetailData.reduce((a,b)=>a+b.totalReceived,0))}</span>
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <AlertCircle className="w-5 h-5" /><span className="font-bold text-base">請選擇左側標的查看股息</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <button onClick={handleExportDividendReport} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold hover:bg-emerald-100 shadow-sm transition-colors text-base" disabled={dividendDetailData.length===0}>
                                    <Download className="w-4 h-4" /> 匯出股息報表
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto bg-white min-h-0">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead className="bg-blue-50 sticky top-0 z-10 border-b border-blue-200">
                                    <tr>
                                        <th className="p-2 font-bold text-blue-900 text-base whitespace-nowrap">證券戶</th>
                                        <th className="p-2 font-bold text-blue-900 text-base whitespace-nowrap">分類</th>
                                        <th className="p-2 font-bold text-blue-900 text-base whitespace-nowrap">年月</th>
                                        <th className="p-2 font-bold text-blue-900 text-base whitespace-nowrap">除息日</th>
                                        <th className="p-2 font-bold text-blue-900 text-base text-right whitespace-nowrap">除息金額</th>
                                        <th className="p-2 font-bold text-blue-900 text-base text-right whitespace-nowrap">持有股數</th>
                                        <th className="p-2 font-bold text-blue-900 text-base text-right whitespace-nowrap">股息金額</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-base font-bold">
                                    {dividendDetailData.map((row) => (
                                        <tr key={row.id} className="hover:bg-purple-50 transition-colors group">
                                            <td className="p-2 text-gray-800">{row.broker}</td>
                                            <td className="p-2 text-gray-600"><span className="bg-gray-100 px-2 py-0.5 rounded text-sm">{row.category}</span></td>
                                            <td className="p-2 font-mono text-gray-600">{row.yearMonth}</td>
                                            <td className="p-2 font-mono text-blue-700">{row.exDate}</td>
                                            <td className="p-2 font-mono text-right text-emerald-600">{fmtDiv(row.divAmount)}</td>
                                            <td className="p-2 font-mono text-right text-gray-700">{fmtMoney(row.heldShares)}</td>
                                            <td className="p-2 font-mono text-right text-purple-800 text-lg">{fmtMoney(row.totalReceived)}</td>
                                        </tr>
                                    ))}
                                    {dividendDetailData.length === 0 && (<tr><td colSpan={7} className="p-10 text-center text-gray-400 font-bold">{selectedCode ? '此標的尚無領息紀錄 (或持有期間未遇除息)' : '👈 請先從左側選擇一檔標的'}</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-blue-400">
                        <p className="text-xl font-bold">功能開發中 ({activeSubTab})</p>
                    </div>
                )}
            </div>

            {/* --- SUMMARY ANALYSIS MODAL --- */}
            {/* ... (Keep existing modal code) ... */}
            {showSummaryModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-5xl h-[85vh] shadow-2xl animate-in zoom-in-95 flex flex-col overflow-hidden">
                        <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-xl text-indigo-900 flex items-center gap-2">
                                <LayoutDashboard className="w-6 h-6" /> 總資產分析表
                            </h3>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setSummaryViewMode('ACCOUNT')}
                                    className={`px-4 py-2 rounded-lg font-bold text-base transition-colors flex items-center gap-2 ${summaryViewMode === 'ACCOUNT' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-600 border border-indigo-200'}`}
                                >
                                    <FolderOpen className="w-4 h-4"/> 依帳戶檢視
                                </button>
                                <button 
                                    onClick={() => setSummaryViewMode('STOCK')}
                                    className={`px-4 py-2 rounded-lg font-bold text-base transition-colors flex items-center gap-2 ${summaryViewMode === 'STOCK' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-600 border border-indigo-200'}`}
                                >
                                    <Layers className="w-4 h-4"/> 依標的檢視
                                </button>
                                <div className="w-px h-8 bg-indigo-200 mx-2"></div>
                                <button onClick={() => setShowSummaryModal(false)} className="p-2 hover:bg-white rounded-full text-gray-500 transition-colors"><X className="w-6 h-6" /></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto bg-white p-0">
                            <table className="w-full text-left border-collapse">
                                {/* PARENT TABLE HEADER */}
                                <thead className="bg-blue-100 sticky top-0 z-10 border-b border-blue-200 text-base font-bold text-blue-900 shadow-sm">
                                    <tr>
                                        <th className="p-3 w-12 text-center">#</th>
                                        <th className="p-3">{summaryViewMode === 'ACCOUNT' ? '證券戶' : '股號'}</th>
                                        <th className="p-3">{summaryViewMode === 'ACCOUNT' ? '' : '股名'}</th>
                                        <th className="p-3 text-right">持股張數 (總計)</th>
                                        <th className="p-3 text-right">持股金額 (總計)</th>
                                    </tr>
                                </thead>
                                <tbody className="text-base">
                                    {summaryData.map((group) => {
                                        const isExpanded = expandedSummaryRows.has(group.id);
                                        return (
                                            <React.Fragment key={group.id}>
                                                {/* PARENT ROW (Level 1) */}
                                                <tr 
                                                    className={`cursor-pointer transition-colors border-b border-gray-100 hover:bg-gray-50 ${isExpanded ? 'bg-blue-50/50' : 'bg-white'}`}
                                                    onClick={() => toggleSummaryRow(group.id)}
                                                >
                                                    <td className="p-3 text-center text-gray-400">
                                                        {isExpanded ? <ChevronDown className="w-5 h-5 mx-auto text-blue-700" /> : <ChevronRight className="w-5 h-5 mx-auto" />}
                                                    </td>
                                                    <td className={`p-3 font-bold text-base ${summaryViewMode === 'ACCOUNT' ? 'text-blue-900' : 'text-blue-700 font-mono'}`}>
                                                        {group.label}
                                                    </td>
                                                    <td className="p-3 font-bold text-gray-700 text-base">
                                                        {summaryViewMode === 'STOCK' ? group.subLabel : ''}
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-bold text-gray-900 text-lg">{fmtMoney(group.totalQty)}</td>
                                                    <td className="p-3 text-right font-mono font-bold text-blue-800 text-lg">{fmtMoney(group.totalCost)}</td>
                                                </tr>

                                                {/* LEVEL 2 CHILDREN */}
                                                {isExpanded && group.children.map((child: any) => {
                                                    const isL2Expanded = expandedSummaryRows.has(child.id);
                                                    
                                                    if (summaryViewMode === 'ACCOUNT') {
                                                        return (
                                                            <React.Fragment key={child.id}>
                                                                <tr 
                                                                    className="cursor-pointer hover:bg-gray-50 border-b border-gray-100"
                                                                    onClick={() => toggleSummaryRow(child.id)}
                                                                >
                                                                    <td className="p-2 text-center"></td> 
                                                                    <td className="p-2 pl-4 flex items-center gap-2">
                                                                        {isL2Expanded ? <ChevronDown className="w-4 h-4 text-blue-500" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                                                        <span className="font-bold text-blue-700 text-base">{child.label}</span>
                                                                    </td>
                                                                    <td></td>
                                                                    <td className="p-2 text-right font-mono font-bold text-gray-800 text-base">{fmtMoney(child.totalQty)}</td>
                                                                    <td className="p-2 text-right font-mono font-bold text-blue-700 text-base">{fmtMoney(child.totalCost)}</td>
                                                                </tr>
                                                                {/* Level 3 */}
                                                                {isL2Expanded && child.children.map((item: any, idx: number) => (
                                                                    <tr key={idx} className="hover:bg-gray-50 border-b border-gray-50">
                                                                        <td></td>
                                                                        <td className="p-2 pl-12 font-bold text-blue-500 text-base font-mono">{item.code}</td>
                                                                        <td className="p-2 font-bold text-gray-600 text-base">{item.name}</td>
                                                                        <td className="p-2 text-right font-mono font-bold text-gray-700 text-base">{fmtMoney(item.qty)}</td>
                                                                        <td className="p-2 text-right font-mono font-bold text-blue-500 text-base">{fmtMoney(item.cost)}</td>
                                                                    </tr>
                                                                ))}
                                                            </React.Fragment>
                                                        );
                                                    } else {
                                                        return (
                                                            <tr key={child.id} className="hover:bg-gray-50 border-b border-gray-50">
                                                                <td></td>
                                                                <td className="p-2 pl-12 font-bold text-blue-500 text-base">{child.broker}</td>
                                                                <td className="p-2 font-bold text-gray-600 text-base">{child.category}</td>
                                                                <td className="p-2 text-right font-mono font-bold text-gray-700 text-base">{fmtMoney(child.qty)}</td>
                                                                <td className="p-2 text-right font-mono font-bold text-blue-500 text-base">{fmtMoney(child.cost)}</td>
                                                            </tr>
                                                        );
                                                    }
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                    {summaryData.length === 0 && (
                                        <tr><td colSpan={5} className="p-10 text-center text-gray-400 font-bold text-lg">無持股資料</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-3 bg-gray-50 border-t border-gray-200 text-right text-gray-500 text-sm font-bold">
                            資料來源：持股明細 (交易紀錄彙整)
                        </div>
                    </div>
                </div>
            )}

            {/* ... Other Modals ... */}
            {/* --- ADD/EDIT MODAL --- */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        {/* ... Modal Content ... */}
                        <div className="p-4 border-b bg-blue-50 rounded-t-xl flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-xl text-blue-900 flex items-center gap-2">
                                {editingId ? <Edit className="w-6 h-6" /> : <Plus className="w-6 h-6" />} 
                                {editingId ? '編輯交易資料' : '新增交易資料'}
                            </h3>
                            <button onClick={() => setShowAddModal(false)}><X className="w-6 h-6 text-gray-500" /></button>
                        </div>
                        
                        <div className="p-8 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                {/* ... Same Form Fields ... */}
                                {/* Left Column */}
                                <div className="space-y-6">
                                    {/* Date */}
                                    <div className="flex items-center gap-4">
                                        <label className="w-24 text-right text-base font-bold text-gray-500 shrink-0">日期</label>
                                        <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="flex-1 border rounded-lg p-2 text-base font-mono font-bold bg-gray-50 focus:bg-white focus:ring-2 ring-blue-200 outline-none" />
                                    </div>

                                    {/* Broker */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-24 flex flex-col items-end shrink-0">
                                            <label className="text-base font-bold text-gray-500">證券戶</label>
                                            <button onClick={() => setShowLexiconModal('BROKER')} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"><Book className="w-3 h-3"/>詞庫</button>
                                        </div>
                                        <select value={formData.broker} onChange={e => setFormData({...formData, broker: e.target.value})} className="flex-1 border rounded-lg p-2 text-base font-bold bg-white focus:ring-2 ring-blue-200 outline-none">
                                            {brokerOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>

                                    {/* Category */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-24 flex flex-col items-end shrink-0">
                                            <label className="text-base font-bold text-gray-500">分類</label>
                                            <button onClick={() => setShowLexiconModal('CATEGORY')} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"><Book className="w-3 h-3"/>詞庫</button>
                                        </div>
                                        <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="flex-1 border rounded-lg p-2 text-base font-bold bg-white focus:ring-2 ring-blue-200 outline-none">
                                            {categoryOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>

                                    {/* Code */}
                                    <div className="flex items-center gap-4">
                                        <label className="w-24 text-right text-base font-bold text-gray-500 shrink-0">股號</label>
                                        <input type="text" placeholder="輸入代碼" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="flex-1 border rounded-lg p-2 text-base font-mono font-bold text-blue-700 focus:ring-2 ring-blue-200 outline-none uppercase" />
                                    </div>

                                    {/* Name */}
                                    <div className="flex items-center gap-4">
                                        <label className="w-24 text-right text-base font-bold text-gray-500 shrink-0">股名</label>
                                        <input type="text" placeholder="系統自動帶入" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="flex-1 border rounded-lg p-2 text-base font-bold bg-gray-50 text-gray-600 focus:bg-white focus:ring-2 ring-blue-200 outline-none" />
                                    </div>
                                </div>

                                {/* Right Column */}
                                <div className="space-y-6">
                                    {/* Price */}
                                    <div className="flex items-center gap-4">
                                        <label className="w-24 text-right text-base font-bold text-gray-500 shrink-0">成交單價</label>
                                        <input type="number" step="0.01" placeholder="0.00" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="flex-1 border rounded-lg p-2 text-base font-mono font-bold text-right focus:ring-2 ring-blue-200 outline-none" />
                                    </div>

                                    {/* Qty */}
                                    <div className="flex items-center gap-4">
                                        <label className="w-24 text-right text-base font-bold text-gray-500 shrink-0">成交股數</label>
                                        <input type="number" placeholder="0" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="flex-1 border rounded-lg p-2 text-base font-mono font-bold text-right focus:ring-2 ring-blue-200 outline-none" />
                                    </div>

                                    {/* Amount */}
                                    <div className="flex items-center gap-4">
                                        <label className="w-24 text-right text-base font-bold text-gray-500 shrink-0">成交價金</label>
                                        <input type="number" placeholder="0" value={formData.totalAmount} onChange={e => setFormData({...formData, totalAmount: e.target.value})} className="flex-1 border rounded-lg p-2 text-base font-mono font-bold text-right focus:ring-2 ring-blue-200 outline-none" />
                                    </div>

                                    {/* Fee */}
                                    <div className="flex items-center gap-4">
                                        <label className="w-24 text-right text-base font-bold text-gray-500 shrink-0">手續費</label>
                                        <input type="number" placeholder="0" value={formData.fee} onChange={e => setFormData({...formData, fee: e.target.value})} className="flex-1 border rounded-lg p-2 text-base font-mono font-bold text-right focus:ring-2 ring-blue-200 outline-none" />
                                    </div>

                                    {/* Cost Display */}
                                    <div className="flex items-center gap-4 bg-blue-50 p-3 rounded-lg border border-blue-200">
                                        <label className="w-24 text-right text-base font-bold text-blue-900 shrink-0">購買成本</label>
                                        <div className="flex-1 text-right font-mono font-bold text-2xl text-blue-700">{fmtMoney(formData.cost)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex gap-3 shrink-0 justify-end">
                            <button onClick={() => setShowAddModal(false)} className="px-6 py-3 rounded-xl border border-gray-300 text-gray-600 font-bold hover:bg-gray-100 transition-colors text-base">取消</button>
                            <button onClick={handleSaveTransaction} className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2 text-base">
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
                            <div 
                                className="w-full border-2 border-dashed border-gray-300 rounded-xl p-10 bg-gray-50 hover:bg-emerald-50/50 hover:border-emerald-400 transition-colors cursor-pointer group relative"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept=".csv,.xlsx,.xls" 
                                    onChange={handleImportFile}
                                />
                                <Upload className="w-12 h-12 text-gray-400 group-hover:text-emerald-500 mx-auto mb-4 transition-colors" />
                                <p className="text-lg font-bold text-gray-600 group-hover:text-emerald-700">點擊選擇檔案 或 拖曳至此</p>
                                <p className="text-base text-gray-400 mt-2 font-bold">支援格式: .csv</p>
                            </div>

                            <div className="w-full text-left bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm space-y-2">
                                <div className="font-bold text-base text-blue-800 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    匯入說明與欄位順序 (CSV)
                                </div>
                                <ul className="list-disc list-inside text-blue-700 space-y-2 ml-1 text-base font-bold">
                                    <li className="text-red-600 bg-red-50 p-1 rounded">⚠️ 強烈建議使用 Excel 另存新檔為 <span className="font-mono border border-red-200 px-1 bg-white">CSV UTF-8 (逗號分隔)</span> 格式，以避免中文亂碼問題。</li>
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