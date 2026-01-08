import React, { useState, useEffect } from 'react';
import { 
    getMarketData, getBasicInfo, getPriceData, getDividendData, 
    getSizeData, getHistoryData, getFillAnalysisData, exportToCSV 
} from '../services/dataService';
import { Database, FileSpreadsheet, DownloadCloud, HardDrive, Calculator, Archive } from 'lucide-react';

const TabExport: React.FC = () => {
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loadingState, setLoadingState] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadCounts();
    }, []);

    const loadCounts = async () => {
        const m = (await getMarketData()).length;
        const b = (await getBasicInfo()).length;
        const p = (await getPriceData()).length;
        const d = (await getDividendData()).length;
        const s = (await getSizeData()).length;
        const h = (await getHistoryData()).length;
        // Fill Analysis is calculated, count matches dividend records roughly
        setCounts({ market: m, basic: b, price: p, dividend: d, size: s, history: h, fill: d });
    };

    const handleExport = async (type: string, title: string) => {
        setLoadingState(prev => ({ ...prev, [type]: true }));
        
        try {
            const dateStr = new Date().toISOString().split('T')[0];
            
            if (type === 'market') {
                const data = await getMarketData();
                const headers = ['指數名稱', '日期', '昨日收盤', '開盤', '高價', '低價', '現價', '成交量', '漲跌', '漲跌幅'];
                const rows = data.map(d => ({
                    '指數名稱': d.indexName, 
                    '日期': d.date,
                    '昨日收盤': d.prevClose, 
                    '開盤': d.open, 
                    '高價': d.high, 
                    '低價': d.low, 
                    '現價': d.price,
                    '成交量': d.volume, 
                    '漲跌': d.change, 
                    '漲跌幅': d.changePercent
                }));
                exportToCSV(`DB_國際大盤_${dateStr}`, headers, rows);
            }
            else if (type === 'basic') {
                const data = await getBasicInfo();
                const headers = ['ETF代碼', 'ETF名稱', '商品分類', '配息週期', '發行投信', 'ETF類型', '上市櫃'];
                const rows = data.map(d => ({
                    'ETF代碼': d.etfCode, 'ETF名稱': d.etfName, '商品分類': d.category,
                    '配息週期': d.dividendFreq, '發行投信': d.issuer, 'ETF類型': d.etfType, '上市櫃': d.marketType
                }));
                exportToCSV(`DB_基本資料_${dateStr}`, headers, rows);
            }
            else if (type === 'price') {
                const data = await getPriceData();
                const headers = ['ETF代碼', 'ETF名稱', '日期', '昨日收盤', '開盤', '最高', '最低', '股價'];
                const rows = data.map(d => ({
                    'ETF代碼': d.etfCode, 'ETF名稱': d.etfName, '日期': d.date,
                    '昨日收盤': d.prevClose, '開盤': d.open, '最高': d.high, '最低': d.low, '股價': d.price
                }));
                exportToCSV(`DB_每日股價_${dateStr}`, headers, rows);
            }
            else if (type === 'dividend') {
                const data = await getDividendData();
                const headers = ['ETF代碼', 'ETF名稱', '年月', '除息日期', '除息金額', '發放日'];
                const rows = data.map(d => ({
                    'ETF代碼': d.etfCode, 'ETF名稱': d.etfName, '年月': d.yearMonth,
                    '除息日期': d.exDate, '除息金額': d.amount, '發放日': d.paymentDate
                }));
                exportToCSV(`DB_除息資料_${dateStr}`, headers, rows);
            }
            else if (type === 'size') {
                const data = await getSizeData();
                const headers = ['ETF代碼', 'ETF名稱', '日期', '規模(億)'];
                const rows = data.map(d => ({
                    'ETF代碼': d.etfCode, 'ETF名稱': d.etfName, '日期': d.date, '規模(億)': d.size
                }));
                exportToCSV(`DB_規模資料_${dateStr}`, headers, rows);
            }
            else if (type === 'history') {
                const data = await getHistoryData();
                const headers = ['ETF代碼', 'ETF名稱', '日期', '收盤價'];
                const rows = data.map(d => ({
                    'ETF代碼': d.etfCode, 'ETF名稱': d.etfName, '日期': d.date, '收盤價': d.price
                }));
                exportToCSV(`DB_歷史股價_${dateStr}`, headers, rows);
            }
            else if (type === 'fill') {
                const data = await getFillAnalysisData();
                const headers = ['ETF代碼', 'ETF名稱', '除息日期', '除息金額', '除息前股價', '參考價', '填息日期', '填息價', '是否填息', '填息天數'];
                const rows = data.map(d => ({
                    'ETF代碼': d.etfCode, 'ETF名稱': d.etfName, '除息日期': d.exDate, '除息金額': d.amount,
                    '除息前股價': d.pricePreEx, '參考價': d.priceReference, '填息日期': d.fillDate, '填息價': d.fillPrice,
                    '是否填息': d.isFilled ? '是' : '否', '填息天數': d.daysToFill
                }));
                exportToCSV(`REPORT_全市場填息分析_${dateStr}`, headers, rows);
            }

        } catch (e) {
            alert("匯出失敗，請檢查資料完整性。");
            console.error(e);
        } finally {
            setTimeout(() => setLoadingState(prev => ({ ...prev, [type]: false })), 500);
        }
    };

    const cards = [
        { id: 'market', title: '國際大盤資料', icon: Database, desc: '美股指數與台股加權指數行情。', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
        { id: 'basic', title: 'ETF 基本資料', icon: FileSpreadsheet, desc: 'ETF 清單、分類與發行資訊。', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
        { id: 'price', title: '每日股價 (最新)', icon: HardDrive, desc: '近期自動更新的收盤行情。', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        { id: 'history', title: '歷史股價 (封存)', icon: Archive, desc: '手動匯入的歷史長區間數據。', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
        { id: 'dividend', title: '除息紀錄', icon: FileSpreadsheet, desc: '所有 ETF 歷史除息與日期紀錄。', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
        { id: 'size', title: '規模變化', icon: Database, desc: 'ETF 的資產規模歷史紀錄。', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
        { id: 'fill', title: '填息分析總表', icon: Calculator, desc: '系統自動計算的全市場填息報告。', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
    ];

    return (
        <div className="h-full flex flex-col p-6 bg-primary-50 overflow-y-auto">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-primary-900 flex items-center gap-2">
                    <DownloadCloud className="w-8 h-8 text-primary-600" />
                    全域資料匯出中心
                </h2>
                <p className="text-primary-500 mt-1">
                    此處可匯出系統資料庫中的完整原始數據，不包含任何過濾條件。
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
                {cards.map(card => {
                    const Icon = card.icon;
                    const count = counts[card.id] || 0;
                    const isProcessing = loadingState[card.id];

                    return (
                        <div key={card.id} className={`bg-white rounded-xl shadow-sm border ${card.border} p-4 flex flex-col hover:shadow-md transition-shadow gap-3`}>
                            {/* Line 1: Icon + Title + Count */}
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${card.bg} shrink-0`}>
                                    <Icon className={`w-5 h-5 ${card.color}`} />
                                </div>
                                <h3 className="text-base font-bold text-gray-900 truncate flex-1">{card.title}</h3>
                                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-md font-mono shrink-0">
                                    {count.toLocaleString()} 筆
                                </span>
                            </div>
                            
                            {/* Line 2: Description */}
                            <div className="text-sm text-gray-500 leading-snug line-clamp-1 min-h-[1.25rem]">
                                {card.desc}
                            </div>

                            {/* Line 3: Button */}
                            <button
                                onClick={() => handleExport(card.id, card.title)}
                                disabled={isProcessing || count === 0}
                                className={`
                                    w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95
                                    ${count === 0 
                                        ? 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100' 
                                        : 'bg-white border border-gray-200 text-gray-700 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50'
                                    }
                                `}
                            >
                                {isProcessing ? (
                                    <span className="flex items-center gap-2 animate-pulse">
                                        <DownloadCloud className="w-4 h-4" /> 處理中...
                                    </span>
                                ) : (
                                    <>
                                        <DownloadCloud className="w-4 h-4" />
                                        匯出 CSV
                                    </>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
            
            <div className="mt-auto text-center text-xs text-gray-400">
                系統資料最後更新檢查: {new Date().toLocaleDateString()}
            </div>
        </div>
    );
};

export default TabExport;