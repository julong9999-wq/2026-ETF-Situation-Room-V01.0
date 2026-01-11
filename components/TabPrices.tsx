import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getPriceData, getBasicInfo, getHistoryData, getFillAnalysisData, getDividendData, exportToCSV } from '../services/dataService';
import { PriceData, BasicInfo, HistoryData, FillAnalysisData, DividendData } from '../types';
import { Download, Database, CheckCircle2, AlertCircle, LineChart, PieChart, TrendingUp, Info, X } from 'lucide-react';
import { createChart, ColorType } from 'lightweight-charts';

interface TabPricesProps {
    mainFilter?: string;
    subFilter?: string;
    setMainFilter?: (val: string) => void;
    setSubFilter?: (val: string) => void;
}

const checkSeason = (freqStr: string | undefined, season: 'Q1'|'Q2'|'Q3') => {
    const f = String(freqStr || '').replace(/\s/g, ''); 
    if (season === 'Q1') return f.includes('季一') || f.includes('1,4,7,10') || f.includes('01,04,07,10') || (f.includes('1') && f.includes('4'));
    if (season === 'Q2') return f.includes('季二') || f.includes('2,5,8,11') || f.includes('02,05,08,11') || (f.includes('2') && f.includes('5'));
    if (season === 'Q3') return f.includes('季三') || f.includes('3,6,9,12') || f.includes('03,06,09,12') || (f.includes('3') && f.includes('6'));
    return false;
};

const getRowBgColor = (etf: BasicInfo, isSelected: boolean) => {
    const freq = String(etf.dividendFreq || '');
    let colorClass = 'bg-gray-50'; 
    if (freq.includes('月')) colorClass = 'bg-amber-50'; 
    else if (checkSeason(freq, 'Q1')) colorClass = 'bg-sky-50'; 
    else if (checkSeason(freq, 'Q2')) colorClass = 'bg-green-50'; 
    else if (checkSeason(freq, 'Q3')) colorClass = 'bg-orange-50'; 

    if (isSelected) return `${colorClass} border-2 border-blue-600 shadow-md z-10`;
    return `${colorClass} border border-gray-100 hover:brightness-95`;
};

// ... (KEEP MODAL COMPONENTS AS IS, omitted for brevity, assuming standard chart/modal implementation) ...
const TechChartModal = ({ data, title, onClose }: { data: any[], title: string, onClose: () => void }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!containerRef.current || data.length === 0) return;
        const chartData = [...data].reverse().map(d => ({ time: d.date, open: d.open, high: d.high, low: d.low, close: d.price })).filter(d => d.open && d.high);
        const chart = createChart(containerRef.current, {
            layout: { background: { type: ColorType.Solid, color: 'white' }, textColor: '#333' },
            grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
            width: containerRef.current.clientWidth,
            height: 400,
        });
        const series = chart.addCandlestickSeries({ upColor: '#ef4444', downColor: '#22c55e', borderVisible: false, wickUpColor: '#ef4444', wickDownColor: '#22c55e', });
        series.setData(chartData);
        chart.timeScale().fitContent();
        const handleResize = () => chart.applyOptions({ width: containerRef.current?.clientWidth || 0 });
        window.addEventListener('resize', handleResize);
        return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
    }, [data]);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-5xl h-[80vh] shadow-2xl flex flex-col animate-in zoom-in-95">
                <div className="p-4 border-b flex justify-between items-center bg-blue-50 rounded-t-xl">
                    <h3 className="font-bold text-lg">{title} - 技術線圖</h3>
                    <button onClick={onClose}><X className="w-6 h-6 text-gray-500" /></button>
                </div>
                <div className="flex-1 p-4 min-h-0">
                    <div ref={containerRef} className="w-full h-full border rounded shadow-inner" />
                </div>
            </div>
        </div>
    );
};

const TrendChartModal = ({ historyData, priceData, divData, title, onClose }: { historyData: HistoryData[], priceData: PriceData[], divData: DividendData[], title: string, onClose: () => void }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!containerRef.current) return;
        const combinedRaw = [
            ...historyData.filter(h => h.date >= '2025-01-01').map(h => ({ date: h.date, price: h.price })),
            ...priceData.filter(p => p.date >= '2025-01-01').map(p => ({ date: p.date, price: p.price }))
        ];
        if (combinedRaw.length === 0) return;
        const uniqueMap = new Map<string, number>();
        combinedRaw.forEach(d => uniqueMap.set(d.date, d.price));
        const sortedDaily = Array.from(uniqueMap.entries()).map(([date, price]) => ({ date, price })).sort((a,b) => a.date.localeCompare(b.date));
        const monthlyPoints: { date: string, price: number }[] = [];
        const seenMonths = new Set<string>();
        for (const d of sortedDaily) {
            const ym = d.date.substring(0, 7);
            if (!seenMonths.has(ym)) { seenMonths.add(ym); monthlyPoints.push(d); }
        }
        const line1Data = []; 
        const line2Data = []; 
        const relevantDivs = divData.filter(d => d.exDate >= '2025-01-01').sort((a,b) => a.exDate.localeCompare(b.exDate));
        for (const p of monthlyPoints) {
            const cumDiv = relevantDivs.filter(d => d.exDate <= p.date).reduce((sum, d) => sum + d.amount, 0);
            line1Data.push({ time: p.date, value: p.price });
            line2Data.push({ time: p.date, value: p.price + cumDiv });
        }
        const chart = createChart(containerRef.current, {
            layout: { background: { type: ColorType.Solid, color: 'white' }, textColor: '#333' },
            grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
            width: containerRef.current.clientWidth,
            height: 400,
        });
        const lineSeries1 = chart.addLineSeries({ color: '#2563eb', title: '股價變化', lineWidth: 2 });
        const lineSeries2 = chart.addLineSeries({ color: '#d97706', title: '含息累積', lineWidth: 2 });
        lineSeries1.setData(line1Data);
        lineSeries2.setData(line2Data);
        chart.timeScale().fitContent();
        const handleResize = () => chart.applyOptions({ width: containerRef.current?.clientWidth || 0 });
        window.addEventListener('resize', handleResize);
        return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
    }, [historyData, priceData, divData]);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-5xl h-[80vh] shadow-2xl flex flex-col animate-in zoom-in-95">
                <div className="p-4 border-b flex justify-between items-center bg-orange-50 rounded-t-xl">
                    <div>
                        <h3 className="font-bold text-lg">{title} - 月趨勢圖 (2025至今)</h3>
                        <p className="text-sm text-gray-500">單位: 月 (每月初價格) | 藍線: 股價 | 橘線: 含息報酬 (股價+累計配息)</p>
                    </div>
                    <button onClick={onClose}><X className="w-6 h-6 text-gray-500" /></button>
                </div>
                <div className="flex-1 p-4 min-h-0">
                     <div ref={containerRef} className="w-full h-full border rounded shadow-inner" />
                </div>
            </div>
        </div>
    );
};

const InfoListModal = ({ title, columns, data, onClose, type = 'NORMAL' }: any) => {
    const today = new Date().toISOString().split('T')[0];
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl h-[70vh] shadow-2xl flex flex-col animate-in zoom-in-95">
                <div className={`p-4 border-b flex justify-between items-center rounded-t-xl ${type === 'DIV' ? 'bg-purple-50' : type === 'FILL' ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <h3 className="font-bold text-lg">{title}</h3>
                    <button onClick={onClose}><X className="w-6 h-6 text-gray-500" /></button>
                </div>
                <div className="flex-1 overflow-auto p-0 min-h-0">
                    <table className="w-full text-left text-base">
                        <thead className="bg-gray-100 sticky top-0 border-b z-10">
                            <tr>{columns.map((c:string) => <th key={c} className="p-4 font-bold">{c}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.map((row: any, i: number) => {
                                let rowClass = "hover:bg-gray-50";
                                if (type === 'DIV') {
                                    const exDate = row['除息日'];
                                    if (exDate > today) rowClass = "bg-red-50 hover:bg-red-100 text-red-900";
                                }
                                return (
                                    <tr key={i} className={rowClass}>
                                        {Object.entries(row).map(([key, val]: [string, any], j) => (
                                            <td key={j} className="p-4 font-mono">
                                                <span className={key === '金額' || key === '現價' || key === '單次殖利率' ? 'font-bold' : ''}>{val}</span>
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                            {data.length === 0 && <tr><td colSpan={columns.length} className="p-8 text-center text-gray-400">無資料</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const RecentInfoModal = ({ allBasicInfo, allPriceData, onClose }: { allBasicInfo: BasicInfo[], allPriceData: PriceData[], onClose: () => void }) => {
    const [modalMainFilter, setModalMainFilter] = useState('季配');
    const [modalSubFilter, setModalSubFilter] = useState('季一');
    const fmt = (n: number) => n.toFixed(2);

    // Filter Logic inside Modal (Must match global Strict Logic)
    const filteredList = useMemo(() => {
        let result = allBasicInfo;
        const getStr = (val: string | undefined) => String(val || '');

        if (modalMainFilter !== '全部') {
            if (modalMainFilter === '債券') result = result.filter(d => getStr(d.category).includes('債'));
            else if (modalMainFilter === '季配') result = result.filter(d => getStr(d.dividendFreq).includes('季') && !getStr(d.category).includes('債'));
            else if (modalMainFilter === '月配') result = result.filter(d => getStr(d.dividendFreq).includes('月') && !getStr(d.category).includes('債')); // Removed Active exclusion
            else if (modalMainFilter === '主動') result = result.filter(d => getStr(d.category).includes('主動'));
            else if (modalMainFilter === '國際') result = result.filter(d => getStr(d.category).includes('國際') || getStr(d.category).includes('國外') || getStr(d.marketType).includes('國外'));
            else if (modalMainFilter === '半年') result = result.filter(d => getStr(d.category).includes('半年') || getStr(d.dividendFreq).includes('半年'));
        }
        if (modalSubFilter !== 'ALL') {
            const freqStr = (d: BasicInfo) => String(d.dividendFreq || '');
            if (modalSubFilter === '季一') result = result.filter(d => checkSeason(freqStr(d), 'Q1'));
            else if (modalSubFilter === '季二') result = result.filter(d => checkSeason(freqStr(d), 'Q2'));
            else if (modalSubFilter === '季三') result = result.filter(d => checkSeason(freqStr(d), 'Q3'));
            else if (modalSubFilter === '月配') result = result.filter(d => freqStr(d).includes('月'));
            else if (modalSubFilter === '半年') result = result.filter(d => freqStr(d).includes('半年'));
            else if (modalSubFilter === '年配') result = result.filter(d => freqStr(d).includes('年') && !freqStr(d).includes('半年'));
            else if (modalSubFilter === '無配') result = result.filter(d => freqStr(d).includes('不'));
        }
        return result.sort((a,b) => a.etfCode.localeCompare(b.etfCode));
    }, [allBasicInfo, modalMainFilter, modalSubFilter]);

    const displayData = useMemo(() => {
        return filteredList.map(etf => {
            const etfPrices = allPriceData.filter(p => p.etfCode === etf.etfCode).sort((a,b) => b.date.localeCompare(a.date));
            const latest = etfPrices[0];
            if (!latest) return null;
            return {
                code: etf.etfCode, name: etf.etfName, date: latest.date, price: latest.price,
                change: latest.price - latest.prevClose, pct: latest.prevClose > 0 ? (latest.price - latest.prevClose)/latest.prevClose * 100 : 0
            };
        }).filter(Boolean);
    }, [filteredList, allPriceData]);

    const getSubOptions = () => {
        if (modalMainFilter === '全部') return ['全部', '季一', '季二', '季三', '月配', '半年', '年配', '無配'];
        if (modalMainFilter === '債券') return ['全部', '月配', '季一', '季二', '季三'];
        if (modalMainFilter === '季配') return ['全部', '季一', '季二', '季三'];
        return [];
    };
    const subOptions = getSubOptions();

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-5xl h-[85vh] shadow-2xl flex flex-col animate-in zoom-in-95">
                <div className="bg-amber-50 rounded-t-xl flex flex-col border-b border-amber-100">
                    <div className="p-4 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-amber-900 flex items-center gap-2">
                            <Info className="w-5 h-5"/> 近期資訊 (最新交易日)
                        </h3>
                        <button onClick={onClose}><X className="w-6 h-6 text-gray-500" /></button>
                    </div>
                    <div className="px-4 pb-3">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                            {['全部', '季配', '月配', '債券', '主動', '國際', '半年'].map(cat => (
                                <button key={cat} onClick={() => { setModalMainFilter(cat); setModalSubFilter('ALL'); }}
                                    className={`flex-none h-9 px-4 rounded-md text-sm font-bold whitespace-nowrap transition-all border
                                        ${modalMainFilter === cat ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-100'}`}>
                                    {cat}
                                </button>
                            ))}
                            {subOptions.length > 0 && (<div className="w-px h-6 bg-amber-200 flex-none mx-1" />)}
                            {subOptions.map(sub => (
                                <button key={sub} onClick={() => setModalSubFilter(sub === '全部' ? 'ALL' : sub)}
                                    className={`flex-none h-9 px-4 rounded-md text-sm font-bold whitespace-nowrap transition-all border
                                        ${(modalSubFilter === sub || (modalSubFilter === 'ALL' && sub === '全部')) ? 'bg-slate-600 text-white border-slate-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                    {sub}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-0 min-h-0 bg-white">
                    <table className="w-full text-left text-base">
                        <thead className="bg-amber-100/50 sticky top-0 border-b z-10 text-amber-900">
                            <tr><th className="p-4 font-bold">ETF 代碼</th><th className="p-4 font-bold">ETF 名稱</th><th className="p-4 font-bold">日期</th><th className="p-4 text-right font-bold">收盤</th><th className="p-4 text-right font-bold">漲跌</th><th className="p-4 text-right font-bold">幅度</th></tr>
                        </thead>
                        <tbody className="divide-y text-sm">
                            {displayData.map((row: any, i: number) => (
                                <tr key={i} className="hover:bg-amber-50/30">
                                    <td className="p-4 font-mono font-bold text-blue-600 text-base">{row.code}</td>
                                    <td className="p-4 text-gray-700 font-medium text-base">{row.name}</td>
                                    <td className="p-4 font-mono text-gray-600">{row.date}</td>
                                    <td className="p-4 text-right font-mono font-bold text-base">{fmt(row.price)}</td>
                                    <td className={`p-4 text-right font-mono font-bold text-base ${row.change > 0 ? 'text-red-600' : row.change < 0 ? 'text-green-600' : 'text-gray-600'}`}>{row.change > 0 ? '+' : ''}{fmt(row.change)}</td>
                                    <td className={`p-4 text-right font-mono font-bold text-base ${row.pct > 0 ? 'text-red-600' : row.pct < 0 ? 'text-green-600' : 'text-gray-600'}`}>{fmt(row.pct)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
const TabPrices: React.FC<TabPricesProps> = ({ 
    mainFilter = '季配', 
    subFilter = '季一', 
    setMainFilter = (_v: string) => {}, 
    setSubFilter = (_v: string) => {} 
}) => {
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
  const [fillData, setFillData] = useState<FillAnalysisData[]>([]); 
  const [divData, setDivData] = useState<DividendData[]>([]);
  const [selectedEtf, setSelectedEtf] = useState<string | null>(null);
  
  // Date State for Lag Fix
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [inputStart, setInputStart] = useState('');
  const [inputEnd, setInputEnd] = useState('');

  const [activeModal, setActiveModal] = useState<'NONE' | 'TECH' | 'DIV' | 'FILL' | 'TREND' | 'RECENT'>('NONE');

  useEffect(() => {
    Promise.all([getPriceData(), getBasicInfo(), getHistoryData(), getFillAnalysisData(), getDividendData()]).then(([p, b, h, f, d]) => {
        setPriceData(p); setBasicInfo(b); setHistoryData(h); setFillData(f); setDivData(d);
        if (p.length > 0) {
             const sorted = [...p].sort((a,b) => b.date.localeCompare(a.date));
             const latest = sorted[0].date;
             if (latest && !isNaN(new Date(latest).getTime())) {
                const start = new Date(latest);
                start.setDate(start.getDate() - 30);
                const sStr = start.toISOString().split('T')[0];
                setEndDate(latest); setStartDate(sStr);
                setInputEnd(latest); setInputStart(sStr);
             }
        }
    });
  }, []);

  // --- FILTER HELPERS (Strict Category Only) ---
  const filteredMaster = useMemo(() => {
      let result = basicInfo;
      const getStr = (val: string | undefined) => String(val || '');
      if (mainFilter !== '全部') {
          if (mainFilter === '債券') result = result.filter(d => getStr(d.category).includes('債')); // Strict
          else if (mainFilter === '季配') result = result.filter(d => getStr(d.dividendFreq).includes('季') && !getStr(d.category).includes('債')); 
          else if (mainFilter === '月配') result = result.filter(d => getStr(d.dividendFreq).includes('月') && !getStr(d.category).includes('債')); // Strict: No name/type checks. No active exclusion.
          else if (mainFilter === '主動') result = result.filter(d => getStr(d.category).includes('主動')); // Strict
          else if (mainFilter === '國際') result = result.filter(d => getStr(d.category).includes('國際') || getStr(d.category).includes('國外') || getStr(d.marketType).includes('國外'));
          else if (mainFilter === '半年') result = result.filter(d => getStr(d.category).includes('半年') || getStr(d.dividendFreq).includes('半年'));
      }
      if (subFilter !== 'ALL') {
          const freqStr = (d: BasicInfo) => String(d.dividendFreq || '');
          if (subFilter === '季一') result = result.filter(d => checkSeason(freqStr(d), 'Q1'));
          else if (subFilter === '季二') result = result.filter(d => checkSeason(freqStr(d), 'Q2'));
          else if (subFilter === '季三') result = result.filter(d => checkSeason(freqStr(d), 'Q3'));
          else if (subFilter === '月配') result = result.filter(d => freqStr(d).includes('月'));
          else if (subFilter === '半年') result = result.filter(d => freqStr(d).includes('半年'));
          else if (subFilter === '年配') result = result.filter(d => freqStr(d).includes('年') && !freqStr(d).includes('半年'));
          else if (subFilter === '無配') result = result.filter(d => freqStr(d).includes('不'));
      }
      const validCodes = new Set([...priceData.map(p => p.etfCode), ...historyData.map(h => h.etfCode)]);
      return result.filter(b => validCodes.has(b.etfCode)).sort((a,b) => a.etfCode.localeCompare(b.etfCode));
  }, [basicInfo, mainFilter, subFilter, priceData, historyData]);

  useEffect(() => {
      if (filteredMaster.length > 0) setSelectedEtf(filteredMaster[0].etfCode);
      else setSelectedEtf(null);
  }, [filteredMaster]);

  const systemDates = useMemo(() => {
      if (priceData.length === 0) return { start: '-', end: '-' };
      let maxDate = '';
      for(const p of priceData) if(p.date > maxDate) maxDate = p.date;
      return { start: maxDate ? `${new Date(maxDate).getFullYear()-1}-${String(new Date(maxDate).getMonth()+1).padStart(2,'0')}` : '-', end: maxDate || '-' };
  }, [priceData]);

  const calculateMetrics = (etf: BasicInfo) => {
      const myPrices = priceData.filter(p => p.etfCode === etf.etfCode).sort((a,b) => b.date.localeCompare(a.date));
      const latestPriceRec = myPrices[0];
      const latestPrice = latestPriceRec ? latestPriceRec.price : 0;
      const todayDateStr = latestPriceRec ? latestPriceRec.date : new Date().toISOString().split('T')[0];
      const todayDate = new Date(todayDateStr);
      const targetYear = todayDate.getFullYear() - 1;
      const targetMonth = todayDate.getMonth() + 1;
      const targetDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      let startPrice = 0;
      if (targetYear <= 2025) {
          const hist = historyData.find(h => h.etfCode === etf.etfCode && h.date.startsWith(targetDateStr));
          if (hist) startPrice = hist.price;
      } else {
          const targetFullDate = `${targetDateStr}-01`;
          const ascPrices = [...myPrices].reverse(); 
          const found = ascPrices.find(p => p.date >= targetFullDate);
          if (found) startPrice = found.price;
      }
      const myDivs = divData.filter(d => d.etfCode === etf.etfCode).sort((a,b) => b.exDate.localeCompare(a.exDate));
      const todayStr = new Date().toISOString().split('T')[0];
      const pastDivs = myDivs.filter(d => d.exDate <= todayStr);
      const futureDivs = myDivs.filter(d => d.exDate > todayStr);
      let count = 0;
      if (etf.dividendFreq?.includes('季')) count = 4;
      else if (etf.dividendFreq?.includes('月')) count = 12;
      else if (etf.dividendFreq?.includes('半年')) count = 2;
      else if (etf.dividendFreq?.includes('年')) count = 1;
      let yieldVal = 0;
      if (count > 0 && pastDivs.length > 0) {
          const sumDiv = pastDivs.slice(0, count).reduce((acc, curr) => acc + curr.amount, 0);
          if (latestPrice > 0) yieldVal = (sumDiv / latestPrice) * 100;
      }
      let estYieldVal: number | null = null;
      if (futureDivs.length > 0 && count > 0) {
          const sumDiv = [...futureDivs, ...pastDivs].slice(0, count).reduce((acc, curr) => acc + curr.amount, 0);
          if (latestPrice > 0) estYieldVal = (sumDiv / latestPrice) * 100;
      }
      let returnVal = 0;
      if (startPrice > 0 && latestPrice > 0) returnVal = ((latestPrice - startPrice) / startPrice) * 100;
      let totalReturnVal = 0;
      if (startPrice > 0 && latestPrice > 0) {
          const startIso = `${targetDateStr}-01`;
          const periodDivs = pastDivs.filter(d => d.exDate >= startIso && d.exDate <= todayDateStr);
          const totalDivs = periodDivs.reduce((acc, c) => acc + c.amount, 0);
          totalReturnVal = ((latestPrice + totalDivs - startPrice) / startPrice) * 100;
      }
      return { latestPrice, startPrice, yieldVal, estYieldVal, returnVal, totalReturnVal };
  };

  const fmtP = (n: number | string) => { if (typeof n === 'string') return n; return n === 0 ? '-' : n.toFixed(2); };
  const fmtDiv = (n: number | string) => { if (typeof n === 'string') return n; return n === 0 ? '-' : n.toFixed(3); };
  const fmtPct = (n: number) => n === 0 ? '0.00%' : `${n.toFixed(2)}%`;
  const fmtCol = (n: number) => n > 0 ? 'text-red-600' : n < 0 ? 'text-green-600' : 'text-gray-800';

  const detailData = useMemo(() => {
      if (!selectedEtf) return [];
      const daily = priceData.filter(d => d.etfCode === selectedEtf);
      const history = historyData.filter(d => d.etfCode === selectedEtf).map(h => ({ etfCode: h.etfCode, etfName: h.etfName, date: h.date, open: h.open || h.price, high: h.high || h.price, low: h.low || h.price, price: h.price, prevClose: 0 }));
      const map = new Map<string, PriceData>();
      history.forEach(d => map.set(d.date, d));
      daily.forEach(d => map.set(d.date, d)); 
      const combined = Array.from(map.values()).sort((a,b) => b.date.localeCompare(a.date));
      for (let i = 0; i < combined.length - 1; i++) { if (combined[i].prevClose === 0) combined[i].prevClose = combined[i+1].price; }
      return combined.filter(d => {
          if (startDate && d.date < startDate) return false;
          if (endDate && d.date > endDate) return false;
          return true;
      });
  }, [selectedEtf, priceData, historyData, startDate, endDate]);

  const handleExport = () => {
      if (!selectedEtf) return alert("請先選擇一檔 ETF");
      const headers = ['代碼', '名稱', '日期', '昨日收盤價', '開盤', '最高', '最低', '股價', '漲跌', '幅度', '備註'];
      const csvData = detailData.map(d => {
          const exInfo = fillData.find(f => f.etfCode === selectedEtf && f.exDate === d.date);
          const fillInfo = fillData.find(f => f.etfCode === selectedEtf && f.fillDate === d.date);
          let note = '';
          if (exInfo) note = `除息: 配息${fmtDiv(exInfo.amount)}`;
          else if (fillInfo) note = `填息: ${fillInfo.daysToFill}天`;
          let calcPrev = d.prevClose;
          if (exInfo) calcPrev = d.prevClose - exInfo.amount;
          const change = d.price - calcPrev;
          return { '代碼': d.etfCode, '名稱': d.etfName, '日期': d.date, '昨日收盤價': fmtP(d.prevClose), '開盤': fmtP(d.open), '最高': fmtP(d.high), '最低': fmtP(d.low), '股價': fmtP(d.price), '漲跌': (change > 0 ? '+' : '') + fmtP(change), '幅度': fmtPct(calcPrev > 0 ? (change/calcPrev)*100 : 0), '備註': note };
      });
      exportToCSV(`${selectedEtf}_PriceHistory`, headers, csvData);
  };

  const subOptions = mainFilter === '全部' ? ['全部', '季一', '季二', '季三', '月配', '半年', '年配', '無配'] : 
                     mainFilter === '債券' ? ['全部', '月配', '季一', '季二', '季三'] : 
                     mainFilter === '季配' ? ['全部', '季一', '季二', '季三'] : [];

  const getModalData = () => {
      if (activeModal === 'RECENT') return []; 
      if (!selectedEtf) return [];
      if (activeModal === 'TECH') return detailData; 
      if (activeModal === 'TREND') return []; 
      if (activeModal === 'DIV') {
          const latestPrice = priceData.filter(p => p.etfCode === selectedEtf).sort((a,b) => b.date.localeCompare(a.date))[0]?.price || 0;
          return divData.filter(d => d.etfCode === selectedEtf).sort((a,b) => b.exDate.localeCompare(a.exDate)).map(d => {
              let yieldStr = '-';
              if (latestPrice > 0) yieldStr = ((d.amount / latestPrice) * 100).toFixed(2) + '%';
              return { '年月': d.yearMonth, '除息日': d.exDate, '金額': fmtDiv(d.amount), '單次殖利率': yieldStr, '發放日': d.paymentDate || '-' };
          });
      }
      if (activeModal === 'FILL') {
          return fillData.filter(d => d.etfCode === selectedEtf).sort((a,b) => b.exDate.localeCompare(a.exDate)).map(d => ({ '除息日': d.exDate, '金額': fmtDiv(d.amount), '前日股價': d.pricePreEx, '參考價': d.priceReference, '填息日': d.fillDate || '-', '填息天數': d.daysToFill }));
      }
      return [];
  };

  return (
    <div className="h-full flex flex-col p-2 gap-2 bg-blue-50">
      
      {/* 2-Row Filter Header */}
      <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-200 flex flex-col gap-3 flex-none">
          {/* Row 1 */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient-right">
                {['全部', '季配', '月配', '債券', '主動', '國際', '半年'].map(cat => (
                    <button key={cat} onClick={() => { setMainFilter(cat); setSubFilter('ALL'); }}
                        className={`px-3 py-1.5 rounded-lg text-base font-bold whitespace-nowrap transition-all border shrink-0 ${mainFilter === cat ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-blue-500 border-blue-100 hover:bg-blue-50 hover:text-blue-700'}`}>
                        {cat}
                    </button>
                ))}
                {subOptions.length > 0 && <div className="h-6 w-px bg-gray-300 shrink-0 mx-1"></div>}
                {subOptions.map(sub => (
                      <button key={sub} onClick={() => setSubFilter(sub === '全部' ? 'ALL' : sub)}
                          className={`px-3 py-1.5 rounded-lg text-base whitespace-nowrap transition-colors font-bold border shrink-0 ${(subFilter === sub || (subFilter === 'ALL' && sub === '全部')) ? 'bg-blue-800 text-white border-blue-800 shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-white hover:text-blue-600 hover:border-blue-200'}`}>{sub}</button>
                  ))}
              </div>
              
              <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-gray-100">
                <div className="flex items-center gap-2 bg-gray-50 px-2 py-1.5 rounded-md border border-gray-200 shadow-inner">
                    <input type="date" value={inputStart} onChange={e=>setInputStart(e.target.value)} onBlur={()=>setStartDate(inputStart)} onKeyDown={e=>e.key==='Enter'&&setStartDate(inputStart)} className="bg-transparent text-[15px] w-32 font-mono outline-none text-gray-700 font-bold"/>
                    <span className="text-sm text-gray-400">~</span>
                    <input type="date" value={inputEnd} onChange={e=>setInputEnd(e.target.value)} onBlur={()=>setEndDate(inputEnd)} onKeyDown={e=>e.key==='Enter'&&setEndDate(inputEnd)} className="bg-transparent text-[15px] w-32 font-mono outline-none text-gray-700 font-bold"/>
                </div>
                {/* RECENT INFO BUTTON */}
                <button onClick={() => setActiveModal('RECENT')} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 font-bold text-base whitespace-nowrap shadow-sm">
                    <Info className="w-4 h-4" /> 近期資訊
                </button>
                <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-bold text-base whitespace-nowrap shadow-sm" disabled={!selectedEtf}>
                    <Download className="w-4 h-4" /> 匯出表單
                </button>
              </div>
          </div>
      </div>

      {/* Main Content: Fixed Scroll Logic */}
      <div className="flex-1 flex gap-2 overflow-hidden min-h-0">
          
          {/* Left List */}
          <div className="w-[340px] flex-none bg-white rounded-lg shadow-sm border border-blue-200 flex flex-col overflow-hidden min-h-0">
              <div className="p-3 bg-blue-50 border-b border-blue-100 font-bold text-blue-900 flex justify-between items-center text-base flex-none">
                  <div className="flex gap-2 text-sm"><span>起始: <span className="font-mono">{systemDates.start}</span></span><span>現值: <span className="font-mono">{systemDates.end}</span></span></div>
                  <span className="bg-blue-200 text-blue-800 px-3 py-0.5 rounded-full text-sm flex items-center font-bold">{filteredMaster.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
                  {filteredMaster.map(item => {
                      const metrics = calculateMetrics(item);
                      return (
                      <div key={item.etfCode} onClick={() => setSelectedEtf(item.etfCode)} className={`rounded-lg p-3 cursor-pointer transition-all duration-200 flex flex-col gap-1 relative ${getRowBgColor(item, selectedEtf === item.etfCode)}`}>
                          <div className="flex items-baseline gap-3 border-b border-gray-200/50 pb-2 mb-2">
                              <span className="text-xl font-bold text-blue-700 font-mono">{item.etfCode}</span>
                              <span className="text-base font-bold text-gray-700 truncate">{item.etfName}</span>
                          </div>
                          <div className="flex justify-between items-center leading-none mb-1.5">
                              <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">現</span><span className="text-base font-bold text-gray-900 font-mono">{fmtP(metrics.latestPrice)}</span></div>
                              <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">殖</span><span className="text-base font-bold text-gray-900 font-mono">{fmtPct(metrics.yieldVal)}</span></div>
                              <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">報</span><span className={`text-base font-bold font-mono ${fmtCol(metrics.returnVal)}`}>{fmtPct(metrics.returnVal)}</span></div>
                          </div>
                          <div className="flex justify-between items-center leading-none">
                               <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">起</span><span className="text-base font-medium text-gray-500 font-mono">{fmtP(metrics.startPrice)}</span></div>
                               <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">預</span><span className="text-base font-medium text-gray-500 font-mono">{metrics.estYieldVal === null ? <span className="text-gray-400 text-xs">空值</span> : fmtPct(metrics.estYieldVal)}</span></div>
                               <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">含</span><span className={`text-base font-medium font-mono ${fmtCol(metrics.totalReturnVal)}`}>{fmtPct(metrics.totalReturnVal)}</span></div>
                          </div>
                      </div>
                  )})}
              </div>
          </div>

          {/* Right Detail Panel */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-blue-200 flex flex-col overflow-hidden min-h-0">
                {!selectedEtf ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Database className="w-16 h-16 mb-4 opacity-30" />
                        <p className="text-xl font-bold">請選擇左側 ETF</p>
                    </div>
                ) : (
                    <>
                        <div className="p-3 bg-blue-50 border-b border-blue-100 flex flex-wrap gap-4 justify-between items-center flex-none">
                            <div className="flex items-center gap-3">
                                <h3 className="font-bold text-blue-900 text-lg">{selectedEtf} 歷史股價</h3>
                                <span className="text-base font-medium text-blue-600">({detailData.length} 筆)</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button onClick={() => setActiveModal('TECH')} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-base font-bold hover:bg-blue-700 transition-colors shadow-sm">
                                    <LineChart className="w-4 h-4" /> 技術線圖
                                </button>
                                <button onClick={() => setActiveModal('DIV')} className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-base font-bold hover:bg-purple-700 transition-colors shadow-sm">
                                    <PieChart className="w-4 h-4" /> 除息資訊
                                </button>
                                <button onClick={() => setActiveModal('FILL')} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-base font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                                    <CheckCircle2 className="w-4 h-4" /> 填息分析
                                </button>
                                <button onClick={() => setActiveModal('TREND')} className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-base font-bold hover:bg-orange-600 transition-colors shadow-sm">
                                    <TrendingUp className="w-4 h-4" /> 月趨勢圖
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto min-h-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-blue-50 sticky top-0 text-base text-blue-900 border-b border-blue-200 z-10 font-bold">
                                    <tr>
                                        <th className="p-2.5 pl-4 whitespace-nowrap">日期</th>
                                        <th className="p-2.5 text-right whitespace-nowrap">昨日收盤</th>
                                        <th className="p-2.5 text-right whitespace-nowrap">開盤</th>
                                        <th className="p-2.5 text-right whitespace-nowrap">最高</th>
                                        <th className="p-2.5 text-right whitespace-nowrap">最低</th>
                                        <th className="p-2.5 text-right whitespace-nowrap">股價</th>
                                        <th className="p-2.5 text-right whitespace-nowrap">漲跌</th>
                                        <th className="p-2.5 text-right pr-4 whitespace-nowrap">幅度</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-[15px]">
                                    {detailData.map((d, i) => {
                                        const exInfo = fillData.find(f => f.etfCode === selectedEtf && f.exDate === d.date);
                                        const fillInfo = fillData.find(f => f.etfCode === selectedEtf && f.fillDate === d.date);
                                        
                                        let displayChange = d.price - d.prevClose;
                                        let displayPct = 0;
                                        
                                        if (exInfo) {
                                            const refPrice = d.prevClose - exInfo.amount;
                                            displayChange = d.price - refPrice;
                                            displayPct = refPrice > 0 ? (displayChange / refPrice) * 100 : 0;
                                        } else {
                                            displayPct = d.prevClose > 0 ? (displayChange / d.prevClose) * 100 : 0;
                                        }
                                        
                                        let rowClass = 'hover:bg-blue-50 transition-colors';
                                        if (exInfo) rowClass = 'bg-red-50 hover:bg-red-100'; 
                                        else if (fillInfo) rowClass = 'bg-green-50 hover:bg-green-100'; 

                                        return (
                                            <React.Fragment key={i}>
                                                <tr className={rowClass}>
                                                    <td className="p-2.5 pl-4 font-mono text-gray-700 font-bold">{d.date}</td>
                                                    <td className="p-2.5 text-right font-mono text-gray-500">{fmtP(d.prevClose)}</td>
                                                    <td className="p-2.5 text-right font-mono text-gray-700">{fmtP(d.open)}</td>
                                                    <td className="p-2.5 text-right font-mono text-red-600 font-medium">{fmtP(d.high)}</td>
                                                    <td className="p-2.5 text-right font-mono text-green-600 font-medium">{fmtP(d.low)}</td>
                                                    <td className="p-2.5 text-right font-mono font-bold text-blue-900 text-lg">{fmtP(d.price)}</td>
                                                    <td className={`p-2.5 text-right font-mono font-bold ${fmtCol(displayChange)}`}>{displayChange > 0 ? '+' : ''}{fmtP(displayChange)}</td>
                                                    <td className={`p-2.5 text-right font-mono font-bold pr-4 ${fmtCol(displayChange)}`}>{fmtPct(displayPct)}</td>
                                                </tr>
                                                {/* Ex-Dividend Note with 3 decimals */}
                                                {exInfo && (
                                                    <tr className="bg-red-50/50 border-b border-red-100">
                                                        <td colSpan={8} className="p-2 text-center text-sm font-bold tracking-wide animate-in fade-in">
                                                            <span className="text-red-700 flex items-center justify-center gap-2">
                                                                <AlertCircle className="w-4 h-4" />
                                                                {`*** 除息前一日股價: ${fmtP(d.prevClose)}, (除息金額: ${fmtDiv(exInfo.amount)}), 除息參考價: ${fmtP(d.prevClose - exInfo.amount)} ***`}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )}
                                                {fillInfo && (
                                                    <tr className="bg-green-50/50 border-b border-green-100">
                                                        <td colSpan={8} className="p-2 text-center text-sm font-bold tracking-wide animate-in fade-in">
                                                            <span className="text-green-700 flex items-center justify-center gap-2">
                                                                <CheckCircle2 className="w-4 h-4" />
                                                                {`*** 除息前一日股價: ${fmtP(fillInfo.pricePreEx)}, (填息天數: ${fillInfo.daysToFill}天), 今日股價: ${fmtP(d.price)} ***`}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
          </div>
      </div>

      {activeModal === 'RECENT' && <RecentInfoModal allBasicInfo={basicInfo} allPriceData={priceData} onClose={() => setActiveModal('NONE')} />}
      {activeModal === 'TECH' && selectedEtf && <TechChartModal data={getModalData()} title={`${selectedEtf} ${basicInfo.find(b=>b.etfCode===selectedEtf)?.etfName || ''}`} onClose={() => setActiveModal('NONE')} />}
      {activeModal === 'TREND' && selectedEtf && <TrendChartModal historyData={historyData.filter(d => d.etfCode === selectedEtf)} priceData={priceData.filter(d => d.etfCode === selectedEtf)} divData={divData.filter(d => d.etfCode === selectedEtf)} title={`${selectedEtf} ${basicInfo.find(b=>b.etfCode===selectedEtf)?.etfName || ''}`} onClose={() => setActiveModal('NONE')} />}
      {activeModal === 'DIV' && selectedEtf && <InfoListModal title={`${selectedEtf} 除息資訊`} columns={['年月','除息日','金額','單次殖利率','發放日']} data={getModalData()} onClose={() => setActiveModal('NONE')} type="DIV" />}
      {activeModal === 'FILL' && selectedEtf && <InfoListModal title={`${selectedEtf} 填息分析`} columns={['除息日','金額','前日股價','參考價','填息日','填息天數']} data={getModalData()} onClose={() => setActiveModal('NONE')} type="FILL" />}
    </div>
  );
};

export default TabPrices;