import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getDividendData, getBasicInfo, getPriceData, getHistoryData, getFillAnalysisData, exportToCSV } from '../services/dataService';
import { DividendData, BasicInfo, PriceData, HistoryData, FillAnalysisData } from '../types';
import { Database, Download, Megaphone, X, Calendar, LineChart, TrendingUp, CheckCircle2 } from 'lucide-react';
import { createChart, ColorType, CandlestickSeries, LineSeries } from 'lightweight-charts';

// --- MODAL COMPONENTS ---
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
        const series = chart.addSeries(CandlestickSeries, { upColor: '#ef4444', downColor: '#22c55e', borderVisible: false, wickUpColor: '#ef4444', wickDownColor: '#22c55e', });
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
        const combinedRaw = [ ...historyData.filter(h => h.date >= '2025-01-01').map(h => ({ date: h.date, price: h.price })), ...priceData.filter(p => p.date >= '2025-01-01').map(p => ({ date: p.date, price: p.price })) ];
        if (combinedRaw.length === 0) return;
        const uniqueMap = new Map<string, number>();
        combinedRaw.forEach(d => uniqueMap.set(d.date, d.price));
        const sortedDaily = Array.from(uniqueMap.entries()).map(([date, price]) => ({ date, price })).sort((a,b) => a.date.localeCompare(b.date));
        const monthlyPoints: { date: string, price: number }[] = [];
        const seenMonths = new Set<string>();
        for (const d of sortedDaily) { const ym = d.date.substring(0, 7); if (!seenMonths.has(ym)) { seenMonths.add(ym); monthlyPoints.push(d); } }
        const line1Data = []; const line2Data = []; 
        const relevantDivs = divData.filter(d => d.exDate >= '2025-01-01').sort((a,b) => a.exDate.localeCompare(b.exDate));
        for (const p of monthlyPoints) {
            const cumDiv = relevantDivs.filter(d => d.exDate <= p.date).reduce((sum, d) => sum + d.amount, 0);
            line1Data.push({ time: p.date, value: p.price });
            line2Data.push({ time: p.date, value: p.price + cumDiv });
        }
        const chart = createChart(containerRef.current, { layout: { background: { type: ColorType.Solid, color: 'white' }, textColor: '#333' }, grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } }, width: containerRef.current.clientWidth, height: 400, });
        const lineSeries1 = chart.addSeries(LineSeries, { color: '#2563eb', title: '股價變化', lineWidth: 2 });
        const lineSeries2 = chart.addSeries(LineSeries, { color: '#d97706', title: '含息累積', lineWidth: 2 });
        lineSeries1.setData(line1Data); lineSeries2.setData(line2Data);
        chart.timeScale().fitContent();
        const handleResize = () => chart.applyOptions({ width: containerRef.current?.clientWidth || 0 });
        window.addEventListener('resize', handleResize);
        return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
    }, [historyData, priceData, divData]);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-5xl h-[80vh] shadow-2xl flex flex-col animate-in zoom-in-95">
                <div className="p-4 border-b flex justify-between items-center bg-orange-50 rounded-t-xl">
                    <div><h3 className="font-bold text-lg">{title} - 月趨勢圖 (2025至今)</h3><p className="text-sm text-gray-500">單位: 月 (每月初價格) | 藍線: 股價 | 橘線: 含息報酬 (股價+累計配息)</p></div>
                    <button onClick={onClose}><X className="w-6 h-6 text-gray-500" /></button>
                </div>
                <div className="flex-1 p-4 min-h-0"><div ref={containerRef} className="w-full h-full border rounded shadow-inner" /></div>
            </div>
        </div>
    );
};

const InfoListModal = ({ title, columns, data, onClose, type = 'NORMAL' }: any) => {
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl h-[70vh] shadow-2xl flex flex-col animate-in zoom-in-95">
                <div className={`p-4 border-b flex justify-between items-center rounded-t-xl ${type === 'FILL' ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <h3 className="font-bold text-lg">{title}</h3>
                    <button onClick={onClose}><X className="w-6 h-6 text-gray-500" /></button>
                </div>
                <div className="flex-1 overflow-auto p-0 min-h-0">
                    <table className="w-full text-left text-base">
                        <thead className="bg-gray-100 sticky top-0 border-b z-10"><tr>{columns.map((c:string) => <th key={c} className="p-4 font-bold">{c}</th>)}</tr></thead>
                        <tbody className="divide-y">{data.map((row: any, i: number) => { let rowClass = "hover:bg-gray-50"; if (type === 'DIV') { const exDate = row['除息日']; if (exDate > 2099) rowClass = "bg-red-50 hover:bg-red-100 text-red-900"; } return ( <tr key={i} className={rowClass}> {Object.entries(row).map(([key, val]: [string, any], j) => ( <td key={j} className="p-4 font-mono"><span className={key === '金額' ? 'font-bold' : ''}>{val}</span></td> ))} </tr> ); })} {data.length === 0 && <tr><td colSpan={columns.length} className="p-8 text-center text-gray-400">無資料</td></tr>}</tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
interface TabDividendsProps {
    mainFilter?: string; subFilter?: string; setMainFilter?: (val: string) => void; setSubFilter?: (val: string) => void;
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
    if (isSelected) return `${colorClass} border-2 border-blue-600 shadow-md z-10`; // Changed to blue border to match blue theme
    return `${colorClass} border border-gray-100 hover:brightness-95`;
};

const TabDividends: React.FC<TabDividendsProps> = ({ 
    mainFilter = '季配', subFilter = '季一', setMainFilter = (_v: string) => {}, setSubFilter = (_v: string) => {} 
}) => {
  const [divData, setDivData] = useState<DividendData[]>([]);
  const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [fillData, setFillData] = useState<FillAnalysisData[]>([]);
  const [selectedEtf, setSelectedEtf] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAnnoModal, setShowAnnoModal] = useState(false);
  const [annoFilter, setAnnoFilter] = useState<'ALL'|'季配'|'月配'|'債券'|'其他'>('ALL');
  const [activeModal, setActiveModal] = useState<'NONE' | 'TECH' | 'TREND' | 'FILL'>('NONE');

  useEffect(() => {
    Promise.all([getDividendData(), getBasicInfo(), getPriceData(), getHistoryData(), getFillAnalysisData()]).then(([d, b, p, h, f]) => {
        setDivData(d); setBasicInfo(b); setPriceData(p); setHistoryData(h); setFillData(f);
        setStartDate('2025-01-01');
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0); 
        setEndDate(lastDay.toISOString().split('T')[0]);
    });
  }, []);

  const filteredMaster = useMemo(() => {
      let result = basicInfo;
      const getStr = (val: string | undefined) => String(val || '');
      // STRICT FILTERING LOGIC
      if (mainFilter !== '全部') {
          if (mainFilter === '債券') result = result.filter(d => getStr(d.category).includes('債'));
          else if (mainFilter === '季配') result = result.filter(d => getStr(d.dividendFreq).includes('季') && !getStr(d.category).includes('債'));
          else if (mainFilter === '月配') result = result.filter(d => getStr(d.dividendFreq).includes('月') && !getStr(d.category).includes('債') && !getStr(d.category).includes('主動')); // Exclude Active 00985A
          else if (mainFilter === '主動') result = result.filter(d => getStr(d.category).includes('主動'));
          else if (mainFilter === '國際') result = result.filter(d => getStr(d.category).includes('國際') || getStr(d.category).includes('國外') || getStr(d.marketType).includes('國外'));
          else if (mainFilter === '半年') result = result.filter(d => (getStr(d.category).includes('半年') || getStr(d.dividendFreq).includes('半年')) && !getStr(d.category).includes('國際') && !getStr(d.category).includes('國外') && !getStr(d.marketType).includes('國外')); // Exclude Intl 00911
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
      return result.filter(b => divData.some(d => d.etfCode === b.etfCode)).sort((a,b) => a.etfCode.localeCompare(b.etfCode));
  }, [basicInfo, mainFilter, subFilter, divData]);

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
      return { latestPrice, startPrice, yieldVal, returnVal, totalReturnVal, estYieldVal };
  };

  const fmtP = (n: number | string) => { if (typeof n === 'string') return n; return n === 0 ? '-' : n.toFixed(2); };
  const fmtDiv = (n: number | string) => { if (typeof n === 'string') return n; return n === 0 ? '-' : n.toFixed(3); };
  const fmtPct = (n: number) => n === 0 ? '0.00%' : `${n.toFixed(2)}%`;
  const fmtCol = (n: number) => n > 0 ? 'text-red-600' : n < 0 ? 'text-green-600' : 'text-gray-800';

  const detailData = useMemo(() => {
      if (!selectedEtf) return [];
      return divData.filter(d => {
          if (d.etfCode !== selectedEtf) return false;
          const ex = d.exDate.replace(/\//g, '-');
          if (startDate && ex < startDate) return false;
          if (endDate && ex > endDate) return false;
          return true;
      }).sort((a,b) => b.yearMonth.localeCompare(a.yearMonth));
  }, [selectedEtf, divData, startDate, endDate]);

  const handleExport = () => {
      if (!selectedEtf) return alert("請先選擇一檔 ETF");
      if (detailData.length === 0) return alert("目前條件下無資料可匯出");
      const latestPrice = priceData.filter(p => p.etfCode === selectedEtf).sort((a,b) => b.date.localeCompare(a.date))[0]?.price || 0;
      const headers = ['代碼', '名稱', '年月', '除息日', '除息金額', '單次殖利率', '發放日'];
      const dataForExport = detailData.map(d => {
          let yieldStr = '-';
          if (latestPrice > 0) { yieldStr = ((d.amount / latestPrice) * 100).toFixed(2) + '%'; }
          // Use fmtDiv for 3 decimals
          return { '代碼': d.etfCode, '名稱': d.etfName, '年月': d.yearMonth, '除息日': d.exDate, '除息金額': fmtDiv(d.amount), '單次殖利率': yieldStr, '發放日': d.paymentDate };
      });
      exportToCSV(`${selectedEtf}_Dividends`, headers, dataForExport);
  }

  const getAnnouncements = () => {
      const today = new Date().toISOString().split('T')[0];
      const future = divData.filter(d => d.exDate.replace(/\//g, '-') >= today);
      return future.map(d => ({ ...d, category: basicInfo.find(b => b.etfCode === d.etfCode)?.category || '其他', freq: basicInfo.find(b => b.etfCode === d.etfCode)?.dividendFreq || '未知', status: '公告中' })).filter(d => {
          if (annoFilter === 'ALL') return true;
          if (annoFilter === '季配') return d.freq.includes('季');
          if (annoFilter === '月配') return d.freq.includes('月');
          if (annoFilter === '債券') return d.category.includes('債');
          return annoFilter === '其他' ? !d.freq.includes('季') && !d.freq.includes('月') && !d.category.includes('債') : true;
      }).sort((a,b) => a.exDate.localeCompare(b.exDate));
  };
  const subOptions = mainFilter === '全部' ? ['全部', '季一', '季二', '季三', '月配', '半年', '年配', '無配'] : mainFilter === '債券' ? ['全部', '月配', '季一', '季二', '季三'] : mainFilter === '季配' ? ['全部', '季一', '季二', '季三'] : [];
  const getModalData = () => {
      if (!selectedEtf) return [];
      if (activeModal === 'TECH') {
          const daily = priceData.filter(d => d.etfCode === selectedEtf);
          const history = historyData.filter(d => d.etfCode === selectedEtf).map(h => ({ etfCode: h.etfCode, etfName: h.etfName, date: h.date, open: h.open || h.price, high: h.high || h.price, low: h.low || h.price, price: h.price, prevClose: 0 }));
          const map = new Map<string, PriceData>();
          history.forEach(d => map.set(d.date, d as any));
          daily.forEach(d => map.set(d.date, d)); 
          return Array.from(map.values()).sort((a,b) => b.date.localeCompare(a.date));
      }
      if (activeModal === 'TREND') return []; 
      if (activeModal === 'FILL') return fillData.filter(d => d.etfCode === selectedEtf).sort((a,b) => b.exDate.localeCompare(a.exDate)).map(d => ({ '除息日': d.exDate, '金額': d.amount, '前日股價': d.pricePreEx, '參考價': d.priceReference, '填息日': d.fillDate || '-', '填息天數': d.daysToFill }));
      return [];
  };

  return (
    <div className="h-full flex flex-col p-2 gap-2 bg-blue-50 overflow-hidden">
       
      {/* Filters */}
      <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-200 flex flex-col gap-3 flex-none">
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient-right">
                {['全部', '季配', '月配', '債券', '主動', '國際', '半年'].map(cat => (
                    <button key={cat} onClick={() => { setMainFilter(cat); setSubFilter('ALL'); }}
                        className={`px-3 py-1.5 rounded-lg text-base font-bold whitespace-nowrap transition-all border shrink-0 ${mainFilter === cat ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 hover:text-blue-700'}`}>
                        {cat}
                    </button>
                ))}
                {subOptions.length > 0 && <div className="h-6 w-px bg-gray-300 shrink-0 mx-1"></div>}
                {subOptions.map(sub => (
                      <button key={sub} onClick={() => setSubFilter(sub === '全部' ? 'ALL' : sub)} className={`px-3 py-1.5 rounded-lg text-base whitespace-nowrap transition-colors font-bold border shrink-0 ${(subFilter === sub || (subFilter === 'ALL' && sub === '全部')) ? 'bg-blue-800 text-white border-blue-800 shadow-sm' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 hover:text-blue-700'}`}>{sub}</button>
                  ))}
              </div>
              
              <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-gray-100">
                 <div className="flex items-center gap-2 bg-gray-50 px-2 py-1.5 rounded-md border border-gray-200 shadow-inner">
                     <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="bg-transparent text-[15px] w-32 font-mono outline-none text-gray-700 font-bold"/>
                     <span className="text-sm text-gray-400">~</span>
                     <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="bg-transparent text-[15px] w-32 font-mono outline-none text-gray-700 font-bold"/>
                 </div>
                 <button onClick={() => setShowAnnoModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-bold text-base whitespace-nowrap shadow-sm"><Megaphone className="w-4 h-4" /> 配息公告</button>
                <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-bold text-base whitespace-nowrap shadow-sm" disabled={!selectedEtf}><Download className="w-4 h-4" /> 匯出表單</button>
              </div>
          </div>
      </div>

       {/* Content */}
       <div className="flex-1 flex gap-2 overflow-hidden min-h-0">
          
          {/* Left Panel - UPDATED COMPACT UI */}
          <div className="w-[340px] flex-none bg-white rounded-lg shadow-sm border border-blue-200 flex flex-col overflow-hidden min-h-0">
              <div className="p-3 bg-blue-50 border-b border-blue-100 font-bold text-blue-900 flex justify-between items-center text-base flex-none">
                  <div className="flex gap-2 text-sm"><span>起始: <span className="font-mono">{systemDates.start}</span></span><span>現值: <span className="font-mono">{systemDates.end}</span></span></div>
                  <span className="bg-blue-200 text-blue-800 px-3 py-0.5 rounded-full text-sm flex items-center font-bold">{filteredMaster.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
                  {filteredMaster.map(item => {
                      const metrics = calculateMetrics(item);
                      return (
                      <div key={item.etfCode} onClick={() => setSelectedEtf(item.etfCode)} className={`rounded-lg p-2 cursor-pointer transition-all duration-200 flex flex-col gap-0.5 relative ${getRowBgColor(item, selectedEtf === item.etfCode)}`}>
                          <div className="flex items-center gap-2 border-b border-gray-200/50 pb-1 mb-1">
                              <span className="text-lg font-bold text-blue-700 font-mono leading-none">{item.etfCode}</span>
                              <span className="text-sm font-bold text-gray-700 truncate leading-none">{item.etfName}</span>
                          </div>
                          <div className="flex justify-between items-center leading-tight">
                              <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">現</span><span className="text-base font-bold text-gray-900 font-mono">{fmtP(metrics.latestPrice)}</span></div>
                              <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">殖</span><span className="text-base font-bold text-gray-900 font-mono">{fmtPct(metrics.yieldVal)}</span></div>
                              <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">報</span><span className={`text-base font-bold font-mono ${fmtCol(metrics.returnVal)}`}>{fmtPct(metrics.returnVal)}</span></div>
                          </div>
                          <div className="flex justify-between items-center leading-tight">
                               <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">起</span><span className="text-base font-medium text-gray-500 font-mono">{fmtP(metrics.startPrice)}</span></div>
                               <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">預</span><span className="text-base font-medium text-gray-500 font-mono">{metrics.estYieldVal === null ? <span className="text-gray-400 text-xs">空值</span> : fmtPct(metrics.estYieldVal)}</span></div>
                               <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">含</span><span className={`text-base font-medium font-mono ${fmtCol(metrics.totalReturnVal)}`}>{fmtPct(metrics.totalReturnVal)}</span></div>
                          </div>
                      </div>
                  )})}
              </div>
          </div>

          {/* Right Panel - UPDATED TABLE (Blue Theme) */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-blue-200 flex flex-col overflow-hidden min-h-0">
                {!selectedEtf ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Database className="w-16 h-16 mb-4 opacity-30" />
                        <p className="text-xl font-bold">請選擇左側 ETF</p>
                    </div>
                ) : (
                    <>
                         <div className="p-4 bg-blue-50 border-b border-blue-100 flex flex-wrap justify-between items-center flex-none gap-3">
                            <div className="flex items-center gap-3">
                                <h3 className="font-bold text-blue-900 text-lg">{selectedEtf} 除息明細</h3>
                                <span className="text-base font-medium text-blue-600">共 {detailData.length} 筆</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setActiveModal('TECH')} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-bold text-base whitespace-nowrap shadow-sm transition-colors">
                                    <LineChart className="w-4 h-4" /> 技術線圖
                                </button>
                                <button onClick={() => setActiveModal('TREND')} className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 font-bold text-base whitespace-nowrap shadow-sm transition-colors">
                                    <TrendingUp className="w-4 h-4" /> 月趨勢圖
                                </button>
                                <button onClick={() => setActiveModal('FILL')} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-bold text-base whitespace-nowrap shadow-sm transition-colors">
                                    <CheckCircle2 className="w-4 h-4" /> 填息分析
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-blue-50 sticky top-0 text-base z-10 text-blue-900 font-bold border-b border-blue-200">
                                    <tr>
                                        <th className="p-2.5 pl-4 w-1/6">年月</th>
                                        <th className="p-2.5 w-1/6">除息日期</th>
                                        <th className="p-2.5 text-right w-1/6">除息金額</th>
                                        <th className="p-2.5 text-right w-1/6">單次殖利率</th>
                                        <th className="p-2.5 pr-6 text-right w-1/6">股利發放</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-blue-50 text-[15px]">
                                    {detailData.map((d, i) => {
                                        const isFuture = d.exDate > new Date().toISOString().split('T')[0];
                                        const latestPrice = priceData.filter(p => p.etfCode === selectedEtf).sort((a,b) => b.date.localeCompare(a.date))[0]?.price || 0;
                                        let yieldStr = '-';
                                        if (latestPrice > 0) { yieldStr = ((d.amount / latestPrice) * 100).toFixed(2) + '%'; }
                                        return (
                                            <tr key={i} className={`hover:bg-blue-50/50 transition-colors ${isFuture ? 'bg-red-50' : ''}`}>
                                                <td className="p-2.5 pl-4 font-bold text-gray-800">{d.yearMonth}</td>
                                                <td className="p-2.5 text-blue-700 font-mono font-medium"><div className="flex items-center gap-2"><Calendar className="w-4 h-4"/>{d.exDate}</div></td>
                                                <td className="p-2.5 text-right font-bold text-emerald-600 text-lg">{fmtDiv(d.amount)}</td>
                                                <td className="p-2.5 text-right font-bold text-amber-600 font-mono text-lg">{yieldStr}</td>
                                                <td className="p-2.5 pr-6 text-right text-gray-600 font-medium">{d.paymentDate}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
          </div>
       </div>

       {showAnnoModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-xl w-full max-w-4xl h-[80vh] flex flex-col animate-in zoom-in-95">
                   <div className="p-4 border-b flex justify-between items-center bg-blue-50 rounded-t-xl">
                       <h3 className="font-bold text-lg text-blue-900 flex items-center gap-2"><Megaphone className="w-5 h-5"/> 即將除息公告 (公告中)</h3>
                       <button onClick={() => setShowAnnoModal(false)}><X className="w-6 h-6 text-gray-500" /></button>
                   </div>
                   <div className="p-2 bg-gray-50 border-b flex gap-2 overflow-x-auto">
                       {['ALL', '季配', '月配', '債券', '其他'].map(f => (
                           <button key={f} onClick={() => setAnnoFilter(f as any)} className={`px-3 py-1 rounded-full text-sm font-bold border ${annoFilter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>{f}</button>
                       ))}
                   </div>
                   <div className="flex-1 overflow-auto p-0">
                       <table className="w-full text-left">
                           <thead className="bg-gray-100 sticky top-0">
                               <tr><th className="p-3 font-bold">代碼</th><th className="p-3 font-bold">名稱</th><th className="p-3 font-bold">除息日</th><th className="p-3 text-right">金額</th><th className="p-3 font-bold">週期</th><th className="p-3 font-bold">發放日</th></tr>
                           </thead>
                           <tbody className="divide-y text-sm font-bold">
                               {getAnnouncements().map((d,i) => (
                                   <tr key={i} className="hover:bg-blue-50">
                                       <td className="p-3 font-mono text-blue-700">{d.etfCode}</td>
                                       <td className="p-3 text-gray-800">{d.etfName}</td>
                                       <td className="p-3 font-mono text-red-600">{d.exDate}</td>
                                       <td className="p-3 text-right font-mono text-lg text-emerald-600">{fmtDiv(d.amount)}</td>
                                       <td className="p-3 text-gray-500">{d.freq}</td>
                                       <td className="p-3 text-gray-500">{d.paymentDate}</td>
                                   </tr>
                               ))}
                               {getAnnouncements().length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">目前無符合條件的公告</td></tr>}
                           </tbody>
                       </table>
                   </div>
               </div>
            </div>
       )}
       
       {activeModal === 'TECH' && selectedEtf && <TechChartModal data={getModalData()} title={`${selectedEtf} ${basicInfo.find(b=>b.etfCode===selectedEtf)?.etfName || ''}`} onClose={() => setActiveModal('NONE')} />}
       {activeModal === 'TREND' && selectedEtf && <TrendChartModal historyData={historyData.filter(d => d.etfCode === selectedEtf)} priceData={priceData.filter(d => d.etfCode === selectedEtf)} divData={divData.filter(d => d.etfCode === selectedEtf)} title={`${selectedEtf} ${basicInfo.find(b=>b.etfCode===selectedEtf)?.etfName || ''}`} onClose={() => setActiveModal('NONE')} />}
       {activeModal === 'FILL' && selectedEtf && <InfoListModal title={`${selectedEtf} 填息分析`} columns={['除息日','金額','前日股價','參考價','填息日','填息天數']} data={getModalData()} onClose={() => setActiveModal('NONE')} type="FILL" />}
    </div>
  );
};

export default TabDividends;