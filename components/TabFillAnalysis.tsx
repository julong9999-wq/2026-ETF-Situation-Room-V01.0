import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getFillAnalysisData, getBasicInfo, getPriceData, getHistoryData, getDividendData, exportToCSV } from '../services/dataService';
import { FillAnalysisData, BasicInfo, PriceData, HistoryData, DividendData } from '../types';
import { Download, CheckCircle, Clock, Database, ChevronRight, ArrowRight, AlertCircle, CheckCircle2, LineChart, PieChart, TrendingUp, X } from 'lucide-react';
import { createChart, ColorType } from 'lightweight-charts';

// --- SHARED MODAL COMPONENTS ---
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
                <div className="flex-1 p-4 min-h-0"><div ref={containerRef} className="w-full h-full border rounded shadow-inner" /></div>
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
        const lineSeries1 = chart.addLineSeries({ color: '#2563eb', title: '股價變化', lineWidth: 2 });
        const lineSeries2 = chart.addLineSeries({ color: '#d97706', title: '含息累積', lineWidth: 2 });
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
                        <thead className="bg-gray-100 sticky top-0 border-b z-10"><tr>{columns.map((c:string) => <th key={c} className="p-4 font-bold">{c}</th>)}</tr></thead>
                        <tbody className="divide-y">{data.map((row: any, i: number) => { let rowClass = "hover:bg-gray-50"; if (type === 'DIV') { const exDate = row['除息日']; if (exDate > today) rowClass = "bg-red-50 hover:bg-red-100 text-red-900"; } return ( <tr key={i} className={rowClass}> {Object.entries(row).map(([key, val]: [string, any], j) => ( <td key={j} className="p-4 font-mono"><span className={key === '金額' || key === '現價' || key === '單次殖利率' ? 'font-bold' : ''}>{val}</span></td> ))} </tr> ); })} {data.length === 0 && <tr><td colSpan={columns.length} className="p-8 text-center text-gray-400">無資料</td></tr>}</tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
interface TabFillAnalysisProps {
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
    if (isSelected) return `${colorClass} border-2 border-orange-500 shadow-md z-10`;
    return `${colorClass} border border-gray-100 hover:brightness-95`;
};

const TabFillAnalysis: React.FC<TabFillAnalysisProps> = ({ 
    mainFilter = '全部', subFilter = 'ALL', setMainFilter = (_v: string) => {}, setSubFilter = (_v: string) => {} 
}) => {
  const [fillData, setFillData] = useState<FillAnalysisData[]>([]);
  const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [divData, setDivData] = useState<DividendData[]>([]);
  const [selectedEtf, setSelectedEtf] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeModal, setActiveModal] = useState<'NONE' | 'TECH' | 'DIV' | 'TREND'>('NONE');

  useEffect(() => {
    Promise.all([getFillAnalysisData(), getBasicInfo(), getPriceData(), getHistoryData(), getDividendData()]).then(([f, b, p, h, d]) => {
        setFillData(f); setBasicInfo(b); setPriceData(p); setHistoryData(h); setDivData(d);
        setStartDate('2025-01-01');
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0); 
        setEndDate(lastDay.toISOString().split('T')[0]);
    });
  }, []);

  const filteredMaster = useMemo(() => {
      let result = basicInfo;
      const getStr = (val: string | undefined) => String(val || '');
      if (mainFilter !== '全部') {
          if (mainFilter === '債券') result = result.filter(d => getStr(d.category).includes('債'));
          else if (mainFilter === '季配') result = result.filter(d => getStr(d.dividendFreq).includes('季') && !getStr(d.category).includes('債'));
          else if (mainFilter === '月配') result = result.filter(d => getStr(d.dividendFreq).includes('月') && !getStr(d.category).includes('債') && !getStr(d.category).includes('主動'));
          else if (mainFilter === '主動') result = result.filter(d => getStr(d.category).includes('主動') || getStr(d.etfType).includes('主動'));
          else if (mainFilter === '國際') result = result.filter(d => d.etfCode === '00911' || getStr(d.category).includes('國際') || getStr(d.marketType).includes('國外'));
          else if (mainFilter === '半年') result = result.filter(d => d.etfCode !== '00911' && (getStr(d.category).includes('半年') || getStr(d.dividendFreq).includes('半年')));
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
      const validCodes = new Set(fillData.map(f => f.etfCode));
      return result.filter(d => validCodes.has(d.etfCode)).sort((a,b) => a.etfCode.localeCompare(b.etfCode));
  }, [basicInfo, mainFilter, subFilter, fillData]);

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
  const fmtPct = (n: number) => n === 0 ? '0.00%' : `${n.toFixed(2)}%`;
  const fmtCol = (n: number) => n > 0 ? 'text-red-600' : n < 0 ? 'text-green-600' : 'text-gray-800';

  const getDetailData = () => {
      if (!selectedEtf) return [];
      return fillData.filter(d => {
          if (d.etfCode !== selectedEtf) return false;
          const ex = d.exDate.replace(/\//g, '-');
          if (startDate && ex < startDate) return false;
          if (endDate && ex > endDate) return false;
          return true;
      }).sort((a,b) => b.exDate.localeCompare(a.exDate));
  };
  const detailData = getDetailData();

  const handleExport = () => {
      if (!selectedEtf) return alert("請先選擇一檔 ETF");
      if (detailData.length === 0) return alert("無資料可匯出");
      const headers = ['代碼', '名稱', '所屬年月', '除息日期', '除息金額', '除息前一天', '除息前一天股價', '除息參考價', '分析比對日期', '分析比對價格', '分析是否填息成功', '幾天填息'];
      const csvData = detailData.map(d => ({ '代碼': d.etfCode, '名稱': d.etfName, '所屬年月': d.yearMonth, '除息日期': d.exDate, '除息金額': d.amount, '除息前一天': d.preExDate, '除息前一天股價': d.pricePreEx, '除息參考價': d.priceReference, '分析比對日期': d.fillDate, '分析比對價格': d.fillPrice, '分析是否填息成功': d.isFilled ? '是' : '否', '幾天填息': d.daysToFill }));
      exportToCSV(`${selectedEtf}_FillAnalysis`, headers, csvData);
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
      if (activeModal === 'DIV') {
          const latestPrice = priceData.filter(p => p.etfCode === selectedEtf).sort((a,b) => b.date.localeCompare(a.date))[0]?.price || 0;
          return divData.filter(d => d.etfCode === selectedEtf).sort((a,b) => b.exDate.localeCompare(a.exDate)).map(d => {
              let yieldStr = '-';
              if (latestPrice > 0) yieldStr = ((d.amount / latestPrice) * 100).toFixed(2) + '%';
              return { '年月': d.yearMonth, '除息日': d.exDate, '金額': d.amount, '單次殖利率': yieldStr, '發放日': d.paymentDate || '-' };
          });
      }
      return [];
  };

  return (
    <div className="h-full flex flex-col p-4 gap-4 bg-blue-50">
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-200 flex flex-col gap-4 flex-none">
          <div className="flex items-center justify-between">
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {['全部', '季配', '月配', '債券', '主動', '國際', '半年'].map(cat => (
                    <button key={cat} onClick={() => { setMainFilter(cat); setSubFilter('ALL'); }}
                        className={`px-4 py-2 rounded-lg text-base font-bold whitespace-nowrap transition-all border ${mainFilter === cat ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-blue-500 border-blue-100 hover:bg-blue-50 hover:text-blue-700'}`}>
                        {cat}
                    </button>
                ))}
              </div>
              <div className="flex items-center gap-3 shrink-0 pl-3 border-l border-gray-100">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-md border border-gray-200 shadow-inner">
                    <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="bg-transparent text-base w-40 font-mono outline-none text-gray-700 font-bold"/>
                    <span className="text-base text-gray-400">~</span>
                    <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="bg-transparent text-base w-40 font-mono outline-none text-gray-700 font-bold"/>
                </div>
                <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-bold text-base whitespace-nowrap shadow-sm" disabled={!selectedEtf}><Download className="w-5 h-5" /> <span>匯出表單</span></button>
              </div>
          </div>
          {subOptions.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-t border-gray-100 pt-3 animate-in fade-in slide-in-from-top-1">
                  {subOptions.map(sub => (
                      <button key={sub} onClick={() => setSubFilter(sub === '全部' ? 'ALL' : sub)}
                          className={`px-4 py-2 rounded-lg text-base whitespace-nowrap transition-colors font-bold border ${(subFilter === sub || (subFilter === 'ALL' && sub === '全部')) ? 'bg-blue-800 text-white border-blue-800 shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-white hover:text-blue-600 hover:border-blue-200'}`}>{sub}</button>
                  ))}
              </div>
          )}
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          
          {/* Left Panel */}
          <div className="w-[340px] flex-none bg-white rounded-xl shadow-sm border border-blue-200 flex flex-col overflow-hidden min-h-0">
              <div className="p-4 bg-blue-50 border-b border-blue-100 font-bold text-blue-900 flex justify-between items-center text-base">
                  <div className="flex gap-2 text-sm"><span>起始: <span className="font-mono">{systemDates.start}</span></span><span>現值: <span className="font-mono">{systemDates.end}</span></span></div>
                  <span className="bg-blue-200 text-blue-800 px-3 py-0.5 rounded-full text-sm flex items-center font-bold">{filteredMaster.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {filteredMaster.map(item => {
                      const metrics = calculateMetrics(item);
                      return (
                      <div key={item.etfCode} onClick={() => setSelectedEtf(item.etfCode)} className={`rounded-xl p-4 cursor-pointer transition-all duration-200 flex flex-col gap-1 relative ${getRowBgColor(item, selectedEtf === item.etfCode)}`}>
                          <div className="flex items-baseline gap-3 border-b border-gray-200/50 pb-2 mb-2">
                              <span className="text-xl font-bold text-blue-700 font-mono">{item.etfCode}</span>
                              <span className="text-base font-bold text-gray-700 truncate">{item.etfName}</span>
                          </div>
                          <div className="flex justify-between items-center leading-none mb-1.5">
                              <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">現</span><span className="text-base font-bold text-gray-900 font-mono">{fmtP(metrics.latestPrice)}</span></div>
                              <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">殖</span><span className="text-base font-bold text-gray-900 font-mono">{fmtPct(metrics.yieldVal)}</span></div>
                              <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">報</span><span className={`text-base font-bold font-mono ${fmtCol(metrics.returnVal)}`}>{fmtPct(metrics.returnVal)}</span></div>
                          </div>
                          <div className="flex justify-between items-center leading-none mt-1">
                               <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">起</span><span className="text-base font-medium text-gray-500 font-mono">{fmtP(metrics.startPrice)}</span></div>
                               <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">預</span><span className="text-base font-medium text-gray-500 font-mono">{metrics.estYieldVal === null ? <span className="text-gray-400 text-xs">空值</span> : fmtPct(metrics.estYieldVal)}</span></div>
                               <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">含</span><span className={`text-base font-medium font-mono ${fmtCol(metrics.totalReturnVal)}`}>{fmtPct(metrics.totalReturnVal)}</span></div>
                          </div>
                      </div>
                  )})}
              </div>
          </div>

          {/* Right Panel */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-blue-200 flex flex-col overflow-hidden min-h-0">
                {!selectedEtf ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Database className="w-16 h-16 mb-4 opacity-30" />
                        <p className="text-xl font-bold">請選擇左側 ETF</p>
                    </div>
                ) : (
                    <>
                        <div className="p-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center flex-none">
                            <div className="flex items-center gap-3">
                                <h3 className="font-bold text-blue-900 text-lg">{selectedEtf} 填息分析</h3>
                                <span className="text-base font-medium text-blue-600">({detailData.length} 筆)</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button onClick={() => setActiveModal('TECH')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-base font-bold hover:bg-blue-700 transition-colors shadow-sm">
                                    <LineChart className="w-5 h-5" /> 技術線圖
                                </button>
                                <button onClick={() => setActiveModal('DIV')} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-base font-bold hover:bg-purple-700 transition-colors shadow-sm">
                                    <PieChart className="w-5 h-5" /> 除息資訊
                                </button>
                                <button onClick={() => setActiveModal('TREND')} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-base font-bold hover:bg-orange-600 transition-colors shadow-sm">
                                    <TrendingUp className="w-5 h-5" /> 月趨勢圖
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto min-h-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-blue-50 sticky top-0 text-base text-blue-900 border-b border-blue-200 z-10 font-bold">
                                    <tr>
                                        <th className="p-4 pl-6 whitespace-nowrap">除息日</th>
                                        <th className="p-4 text-right whitespace-nowrap">金額</th>
                                        <th className="p-4 text-right whitespace-nowrap">前日股價</th>
                                        <th className="p-4 text-right whitespace-nowrap">參考價</th>
                                        <th className="p-4 text-right whitespace-nowrap">填息日</th>
                                        <th className="p-4 text-right whitespace-nowrap">填息價</th>
                                        <th className="p-4 text-center whitespace-nowrap">狀態</th>
                                        <th className="p-4 text-right pr-6 whitespace-nowrap">天數</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-[15px]">
                                    {detailData.map((d, i) => {
                                        let statusColor = "text-gray-400";
                                        if (d.isFilled) statusColor = "text-green-600 font-bold";
                                        else if (d.daysToFill === '未填息') statusColor = "text-red-500 font-bold";
                                        else if (d.daysToFill === '待除息資訊') statusColor = "text-red-500 font-bold"; 
                                        else if (d.daysToFill === '無資料') statusColor = "text-gray-400";
                                        
                                        return (
                                            <tr key={i} className="hover:bg-blue-50 transition-colors">
                                                <td className="p-4 pl-6 font-mono text-gray-700 font-bold">{d.exDate}</td>
                                                <td className="p-4 text-right font-bold text-emerald-600">{fmtP(d.amount)}</td>
                                                <td className="p-4 text-right font-mono text-gray-500">{fmtP(d.pricePreEx)}</td>
                                                <td className="p-4 text-right font-mono text-gray-500">{fmtP(d.priceReference)}</td>
                                                <td className="p-4 text-right font-mono text-gray-500">{d.fillDate || '-'}</td>
                                                <td className="p-4 text-right font-mono text-gray-500">{fmtP(d.fillPrice)}</td>
                                                <td className={`p-4 text-center text-sm ${statusColor}`}>{d.isFilled ? '已填息' : d.daysToFill === '未填息' ? '未填息' : d.daysToFill}</td>
                                                <td className="p-4 text-right font-mono pr-6">{d.daysToFill}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
          </div>
      </div>
      
      {activeModal === 'TECH' && selectedEtf && <TechChartModal data={getModalData()} title={`${selectedEtf} ${basicInfo.find(b=>b.etfCode===selectedEtf)?.etfName || ''}`} onClose={() => setActiveModal('NONE')} />}
      {activeModal === 'TREND' && selectedEtf && <TrendChartModal historyData={historyData.filter(d => d.etfCode === selectedEtf)} priceData={priceData.filter(d => d.etfCode === selectedEtf)} divData={divData.filter(d => d.etfCode === selectedEtf)} title={`${selectedEtf} ${basicInfo.find(b=>b.etfCode===selectedEtf)?.etfName || ''}`} onClose={() => setActiveModal('NONE')} />}
      {activeModal === 'DIV' && selectedEtf && <InfoListModal title={`${selectedEtf} 除息資訊`} columns={['年月','除息日','金額','單次殖利率','發放日']} data={getModalData()} onClose={() => setActiveModal('NONE')} type="DIV" />}

    </div>
  );
};

export default TabFillAnalysis;