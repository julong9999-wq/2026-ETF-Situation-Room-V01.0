import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getDividendData, getBasicInfo, getPriceData, getHistoryData, getFillAnalysisData, exportToCSV } from '../services/dataService';
import { DividendData, BasicInfo, PriceData, HistoryData, FillAnalysisData } from '../types';
import { Database, Download, Megaphone, X, Calendar, LineChart, TrendingUp, CheckCircle2 } from 'lucide-react';
import { createChart, ColorType } from 'lightweight-charts';

// --- MODAL COMPONENTS (COPIED FOR INDEPENDENCE) ---

const TechChartModal = ({ data, title, onClose }: { data: any[], title: string, onClose: () => void }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!containerRef.current || data.length === 0) return;
        const chartData = [...data].reverse().map(d => ({
            time: d.date,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.price
        })).filter(d => d.open && d.high);

        const chart = createChart(containerRef.current, {
            layout: { background: { type: ColorType.Solid, color: 'white' }, textColor: '#333' },
            grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
            width: containerRef.current.clientWidth,
            height: 400,
        });

        const series = chart.addCandlestickSeries({
            upColor: '#ef4444', downColor: '#22c55e', borderVisible: false, wickUpColor: '#ef4444', wickDownColor: '#22c55e',
        });
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
            if (!seenMonths.has(ym)) {
                seenMonths.add(ym);
                monthlyPoints.push(d);
            }
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
                        <p className="text-xs text-gray-500">單位: 月 (每月初價格) | 藍線: 股價 | 橘線: 含息報酬 (股價+累計配息)</p>
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
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl h-[70vh] shadow-2xl flex flex-col animate-in zoom-in-95">
                <div className={`p-4 border-b flex justify-between items-center rounded-t-xl ${type === 'FILL' ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <h3 className="font-bold text-lg">{title}</h3>
                    <button onClick={onClose}><X className="w-6 h-6 text-gray-500" /></button>
                </div>
                <div className="flex-1 overflow-auto p-0 min-h-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 sticky top-0 border-b z-10">
                            <tr>{columns.map((c:string) => <th key={c} className="p-3">{c}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.map((row: any, i: number) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    {Object.entries(row).map(([key, val]: [string, any], j) => (
                                        <td key={j} className="p-3 font-mono"><span className={key === '金額' ? 'font-bold' : ''}>{val}</span></td>
                                    ))}
                                </tr>
                            ))}
                            {data.length === 0 && <tr><td colSpan={columns.length} className="p-8 text-center text-gray-400">無資料</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

interface TabDividendsProps {
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
    if (isSelected) return `${colorClass} border-2 border-purple-500 shadow-md z-10`;
    return `${colorClass} border border-gray-100 hover:brightness-95`;
};

const TabDividends: React.FC<TabDividendsProps> = ({ 
    mainFilter = '全部', 
    subFilter = 'ALL', 
    setMainFilter = (_v: string) => {}, 
    setSubFilter = (_v: string) => {} 
}) => {
  const [divData, setDivData] = useState<DividendData[]>([]);
  const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [fillData, setFillData] = useState<FillAnalysisData[]>([]); // Added for Fill Analysis
  const [selectedEtf, setSelectedEtf] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAnnoModal, setShowAnnoModal] = useState(false);
  const [annoFilter, setAnnoFilter] = useState<'ALL'|'季配'|'月配'|'債券'|'其他'>('ALL');
  
  // New Modal State
  const [activeModal, setActiveModal] = useState<'NONE' | 'TECH' | 'TREND' | 'FILL'>('NONE');

  useEffect(() => {
    Promise.all([getDividendData(), getBasicInfo(), getPriceData(), getHistoryData(), getFillAnalysisData()]).then(([d, b, p, h, f]) => {
        setDivData(d);
        setBasicInfo(b);
        setPriceData(p);
        setHistoryData(h);
        setFillData(f);
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

  // Updated calculateMetrics to match TabPrices (Added Start Price, Return, Total Return)
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

      let returnVal = 0;
      if (startPrice > 0 && latestPrice > 0) returnVal = ((latestPrice - startPrice) / startPrice) * 100;

      let totalReturnVal = 0;
      if (startPrice > 0 && latestPrice > 0) {
          const startIso = `${targetDateStr}-01`;
          const periodDivs = pastDivs.filter(d => d.exDate >= startIso && d.exDate <= todayDateStr);
          const totalDivs = periodDivs.reduce((acc, c) => acc + c.amount, 0);
          totalReturnVal = ((latestPrice + totalDivs - startPrice) / startPrice) * 100;
      }

      return { latestPrice, startPrice, yieldVal, returnVal, totalReturnVal };
  };

  const fmtP = (n: number) => n === 0 ? '-' : n.toFixed(2);
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
      
      // Calculate Latest Price for Export
      const latestPrice = priceData.filter(p => p.etfCode === selectedEtf).sort((a,b) => b.date.localeCompare(a.date))[0]?.price || 0;

      const headers = ['代碼', '名稱', '年月', '除息日', '除息金額', '單次殖利率', '發放日'];
      const dataForExport = detailData.map(d => {
          let yieldStr = '-';
          if (latestPrice > 0) {
              yieldStr = ((d.amount / latestPrice) * 100).toFixed(2) + '%';
          }
          return {
              '代碼': d.etfCode, '名稱': d.etfName, '年月': d.yearMonth, 
              '除息日': d.exDate, '除息金額': fmtP(d.amount), 
              '單次殖利率': yieldStr, '發放日': d.paymentDate
          };
      });
      exportToCSV(`${selectedEtf}_Dividends`, headers, dataForExport);
  }

  const getAnnouncements = () => {
      const today = new Date().toISOString().split('T')[0];
      const future = divData.filter(d => d.exDate.replace(/\//g, '-') >= today);
      return future.map(d => ({
          ...d,
          category: basicInfo.find(b => b.etfCode === d.etfCode)?.category || '其他',
          freq: basicInfo.find(b => b.etfCode === d.etfCode)?.dividendFreq || '未知',
          status: '公告中'
      })).filter(d => {
          if (annoFilter === 'ALL') return true;
          if (annoFilter === '季配') return d.freq.includes('季');
          if (annoFilter === '月配') return d.freq.includes('月');
          if (annoFilter === '債券') return d.category.includes('債');
          return annoFilter === '其他' ? !d.freq.includes('季') && !d.freq.includes('月') && !d.category.includes('債') : true;
      }).sort((a,b) => a.exDate.localeCompare(b.exDate));
  };

  const subOptions = mainFilter === '全部' ? ['全部', '季一', '季二', '季三', '月配', '半年', '年配', '無配'] : 
                     mainFilter === '債券' ? ['全部', '月配', '季一', '季二', '季三'] : 
                     mainFilter === '季配' ? ['全部', '季一', '季二', '季三'] : [];

  // Data Getters for Modals
  const getModalData = () => {
      if (!selectedEtf) return [];
      if (activeModal === 'TECH') {
          // Construct Price History for Tech Chart
          const daily = priceData.filter(d => d.etfCode === selectedEtf);
          const history = historyData.filter(d => d.etfCode === selectedEtf).map(h => ({
             etfCode: h.etfCode, etfName: h.etfName, date: h.date, open: h.open || h.price, high: h.high || h.price, low: h.low || h.price, price: h.price, prevClose: 0 
          }));
          const map = new Map<string, PriceData>();
          history.forEach(d => map.set(d.date, d as any));
          daily.forEach(d => map.set(d.date, d)); 
          return Array.from(map.values()).sort((a,b) => b.date.localeCompare(a.date));
      }
      if (activeModal === 'TREND') return []; // Handled inside TrendModal props
      if (activeModal === 'DIV') {
          // Calculate Yield
          // Yield = Div Amount / Latest Price
          const latestPrice = priceData.filter(p => p.etfCode === selectedEtf).sort((a,b) => b.date.localeCompare(a.date))[0]?.price || 0;
          
          return divData.filter(d => d.etfCode === selectedEtf).sort((a,b) => b.exDate.localeCompare(a.exDate)).map(d => {
              let yieldStr = '-';
              if (latestPrice > 0) {
                  yieldStr = ((d.amount / latestPrice) * 100).toFixed(2) + '%';
              }
              return {
                  '年月': d.yearMonth, '除息日': d.exDate, '金額': d.amount, '單次殖利率': yieldStr, '發放日': d.paymentDate || '-'
              };
          });
      }
      if (activeModal === 'FILL') {
          return fillData.filter(d => d.etfCode === selectedEtf).sort((a,b) => b.exDate.localeCompare(a.exDate)).map(d => ({
              '除息日': d.exDate, '金額': d.amount, '前日股價': d.pricePreEx, '參考價': d.priceReference, '填息日': d.fillDate || '-', '填息天數': d.daysToFill
          }));
      }
      return [];
  };

  return (
    <div className="h-full flex flex-col p-2 gap-2 bg-primary-50 overflow-hidden">
       
      {/* Filters */}
      <div className="bg-white p-2 rounded-lg shadow-sm border border-primary-200 flex flex-col gap-2 flex-none">
          <div className="flex items-center justify-between">
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {['全部', '季配', '月配', '債券', '主動', '國際', '半年'].map(cat => (
                    <button key={cat} onClick={() => { setMainFilter(cat); setSubFilter('ALL'); }}
                        className={`px-3 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-all border ${mainFilter === cat ? 'bg-primary-600 text-white border-primary-600 shadow-sm' : 'bg-white text-primary-500 border-primary-100 hover:bg-primary-50 hover:text-primary-700'}`}>
                        {cat}
                    </button>
                ))}
              </div>
              <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-gray-100">
                 <div className="flex items-center gap-1 bg-gray-50 px-2 py-1.5 rounded-md border border-gray-200 shadow-inner">
                     <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="bg-transparent text-xs w-36 font-mono outline-none text-gray-700"/>
                     <span className="text-xs text-gray-400">~</span>
                     <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="bg-transparent text-xs w-36 font-mono outline-none text-gray-700"/>
                 </div>
                 <button onClick={() => setShowAnnoModal(true)} className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md hover:bg-purple-100 font-bold text-sm whitespace-nowrap"><Megaphone className="w-4 h-4" /> <span className="hidden sm:inline">配息公告</span></button>
                <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 font-bold text-sm whitespace-nowrap" disabled={!selectedEtf}><Download className="w-4 h-4" /> <span>匯出表單</span></button>
              </div>
          </div>
          {subOptions.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-gray-100 pt-2 animate-in fade-in slide-in-from-top-1">
                  {subOptions.map(sub => (
                      <button key={sub} onClick={() => setSubFilter(sub === '全部' ? 'ALL' : sub)} className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors font-medium border ${(subFilter === sub || (subFilter === 'ALL' && sub === '全部')) ? 'bg-gray-700 text-white border-gray-700' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>{sub}</button>
                  ))}
              </div>
          )}
      </div>

       {/* Content */}
       <div className="flex-1 flex gap-2 overflow-hidden min-h-0">
          
          {/* Left Panel */}
          <div className="w-[280px] flex-none bg-white rounded-xl shadow-sm border border-primary-200 flex flex-col overflow-hidden min-h-0">
              <div className="p-2 bg-gray-50 border-b font-bold text-gray-700 flex justify-between items-center text-[14px] flex-none">
                  <div className="flex gap-2"><span>起始: <span className="font-mono">{systemDates.start}</span></span><span>現值: <span className="font-mono">{systemDates.end}</span></span></div>
                  <span className="bg-gray-200 px-1.5 rounded-full text-xs flex items-center">{filteredMaster.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
                  {filteredMaster.map(item => {
                      const metrics = calculateMetrics(item);
                      return (
                      <div key={item.etfCode} onClick={() => setSelectedEtf(item.etfCode)} className={`rounded-xl p-2 cursor-pointer transition-all duration-200 flex flex-col gap-1 relative ${getRowBgColor(item, selectedEtf === item.etfCode)}`}>
                          <div className="flex items-baseline gap-2 border-b border-gray-200/50 pb-1 mb-0.5">
                              <span className="text-[18px] font-bold text-sky-600 font-mono">{item.etfCode}</span>
                              <span className="text-[16px] font-light text-gray-500 truncate">{item.etfName}</span>
                          </div>
                          <div className="flex justify-between items-center leading-none">
                              <div className="flex items-baseline gap-1"><span className="text-[11px] text-gray-500">現</span><span className="text-[16px] font-bold text-black font-mono">{fmtP(metrics.latestPrice)}</span></div>
                              <div className="flex items-baseline gap-1"><span className="text-[11px] text-gray-500">殖</span><span className="text-[16px] font-bold text-black font-mono">{fmtPct(metrics.yieldVal)}</span></div>
                              <div className="flex items-baseline gap-1"><span className="text-[11px] text-gray-500">報</span><span className={`text-[16px] font-bold font-mono ${fmtCol(metrics.returnVal)}`}>{fmtPct(metrics.returnVal)}</span></div>
                          </div>
                          <div className="flex justify-between items-center leading-none mt-1">
                               <div className="flex items-baseline gap-1"><span className="text-[11px] text-gray-500">起</span><span className="text-[16px] font-light text-gray-500 font-mono">{fmtP(metrics.startPrice)}</span></div>
                               <div className="flex items-baseline gap-1"><span className="text-[11px] text-gray-500">含</span><span className={`text-[16px] font-light font-mono ${fmtCol(metrics.totalReturnVal)}`}>{fmtPct(metrics.totalReturnVal)}</span></div>
                          </div>
                      </div>
                  )})}
              </div>
          </div>

          {/* Right Panel */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-primary-200 flex flex-col overflow-hidden min-h-0">
                {!selectedEtf ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Database className="w-12 h-12 mb-3 opacity-30" />
                        <p className="text-sm">請選擇左側 ETF</p>
                    </div>
                ) : (
                    <>
                         <div className="p-2 bg-purple-50 border-b border-purple-100 flex flex-wrap justify-between items-center flex-none gap-2">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-purple-900 text-sm">{selectedEtf} 除息明細</h3>
                                <span className="text-xs text-purple-600">共 {detailData.length} 筆</span>
                            </div>
                            {/* New Buttons */}
                            <div className="flex items-center gap-1">
                                <button onClick={() => setActiveModal('TECH')} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm">
                                    <LineChart className="w-3.5 h-3.5" /> 技術線圖
                                </button>
                                <button onClick={() => setActiveModal('TREND')} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-md text-xs font-bold hover:bg-orange-600 transition-colors shadow-sm">
                                    <TrendingUp className="w-3.5 h-3.5" /> 月趨勢圖
                                </button>
                                <button onClick={() => setActiveModal('FILL')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> 填息分析
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 sticky top-0 text-sm z-10 text-gray-700">
                                    <tr>
                                        <th className="p-1.5 pl-3 w-1/6">年月</th>
                                        <th className="p-1.5 w-1/6">除息日期</th>
                                        <th className="p-1.5 text-right w-1/6">除息金額</th>
                                        <th className="p-1.5 text-right w-1/6">單次殖利率</th>
                                        <th className="p-1.5 pr-3 text-right w-1/6">股利發放</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-sm">
                                    {detailData.map((d, i) => {
                                        const isFuture = d.exDate > new Date().toISOString().split('T')[0];
                                        
                                        // Use latest price for yield calc
                                        const latestPrice = priceData.filter(p => p.etfCode === selectedEtf).sort((a,b) => b.date.localeCompare(a.date))[0]?.price || 0;
                                        
                                        let yieldStr = '-';
                                        if (latestPrice > 0) {
                                            yieldStr = ((d.amount / latestPrice) * 100).toFixed(2) + '%';
                                        }

                                        return (
                                            <tr key={i} className={`hover:bg-gray-50 ${isFuture ? 'bg-red-50' : ''}`}>
                                                <td className="p-1.5 pl-3 font-bold text-gray-700">{d.yearMonth}</td>
                                                <td className="p-1.5 text-primary-600 font-mono"><div className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{d.exDate}</div></td>
                                                <td className="p-1.5 text-right font-bold text-emerald-600">{fmtP(d.amount)}</td>
                                                <td className="p-1.5 text-right font-bold text-amber-600 font-mono">{yieldStr}</td>
                                                <td className="p-1.5 pr-3 text-right text-gray-500">{d.paymentDate}</td>
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
               <div className="bg-white rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95">
                   <div className="p-4 border-b flex flex-col gap-2 bg-purple-50 rounded-t-xl shrink-0">
                       <div className="flex justify-between items-center">
                           <h3 className="font-bold text-lg text-purple-900">配息公告</h3>
                           <button onClick={()=>setShowAnnoModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
                       </div>
                       <div className="flex gap-1">
                           {['ALL', '季配', '月配', '債券', '其他'].map((f) => (
                               <button key={f} onClick={() => setAnnoFilter(f as any)} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${annoFilter === f ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 border border-purple-200 hover:bg-purple-100'}`}>
                                   {f === 'ALL' ? '全部' : f}
                               </button>
                           ))}
                       </div>
                   </div>
                   <div className="flex-1 overflow-auto p-4 min-h-0">
                       <table className="w-full text-sm">
                           <thead className="bg-gray-100 text-gray-600 sticky top-0">
                               <tr><th className="p-2 text-left">日期</th><th className="p-2 text-left">代碼/名稱</th><th className="p-2 text-left">分類</th><th className="p-2 text-right">金額</th><th className="p-2 text-center">狀態</th></tr>
                           </thead>
                           <tbody className="divide-y">
                               {getAnnouncements().length === 0 ? (<tr><td colSpan={5} className="p-8 text-center text-gray-400">目前無相關配息公告資料</td></tr>) : getAnnouncements().map((d, i) => (
                                   <tr key={i} className="hover:bg-purple-50 bg-red-50">
                                       <td className="p-2 font-mono text-purple-700">{d.exDate}</td>
                                       <td className="p-2"><div className="font-bold">{d.etfCode}</div><div className="text-xs text-gray-500">{d.etfName}</div></td>
                                       <td className="p-2"><span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{d.category}</span></td>
                                       <td className="p-2 text-right font-bold text-emerald-600">{fmtP(d.amount)}</td>
                                       <td className="p-2 text-center text-orange-500 text-xs font-bold">{d.status}</td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               </div>
          </div>
       )}

       {/* Render Modals */}
       {activeModal === 'TECH' && selectedEtf && <TechChartModal data={getModalData()} title={`${selectedEtf} ${basicInfo.find(b=>b.etfCode===selectedEtf)?.etfName || ''}`} onClose={() => setActiveModal('NONE')} />}
       {activeModal === 'TREND' && selectedEtf && <TrendChartModal historyData={historyData.filter(d => d.etfCode === selectedEtf)} priceData={priceData.filter(d => d.etfCode === selectedEtf)} divData={divData.filter(d => d.etfCode === selectedEtf)} title={`${selectedEtf} ${basicInfo.find(b=>b.etfCode===selectedEtf)?.etfName || ''}`} onClose={() => setActiveModal('NONE')} />}
       {activeModal === 'FILL' && selectedEtf && <InfoListModal title={`${selectedEtf} 填息分析`} columns={['除息日','金額','前日股價','參考價','填息日','填息天數']} data={getModalData()} onClose={() => setActiveModal('NONE')} type="FILL" />}

    </div>
  );
};

export default TabDividends;