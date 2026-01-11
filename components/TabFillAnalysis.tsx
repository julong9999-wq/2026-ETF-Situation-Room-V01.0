import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getFillAnalysisData, getBasicInfo, getPriceData, getHistoryData, getDividendData, exportToCSV } from '../services/dataService';
import { FillAnalysisData, BasicInfo, PriceData, HistoryData, DividendData } from '../types';
import { Download, CheckCircle, Clock, Database, ChevronRight, ArrowRight, AlertCircle, CheckCircle2, LineChart, PieChart, TrendingUp, X, RefreshCw } from 'lucide-react';
import { createChart, ColorType, CandlestickSeries, LineSeries } from 'lightweight-charts';

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

// --- HELPER FUNCTIONS ---
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

// --- MAIN COMPONENT ---
interface TabFillAnalysisProps {
    mainFilter?: string; subFilter?: string; setMainFilter?: (val: string) => void; setSubFilter?: (val: string) => void;
}

const TabFillAnalysis: React.FC<TabFillAnalysisProps> = ({ 
    mainFilter = '季配', subFilter = '季一', setMainFilter = (_v: string) => {}, setSubFilter = (_v: string) => {} 
}) => {
  const [fillData, setFillData] = useState<FillAnalysisData[]>([]);
  const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [divData, setDivData] = useState<DividendData[]>([]);
  const [selectedEtf, setSelectedEtf] = useState<string | null>(null);
  
  const [activeModal, setActiveModal] = useState<'NONE' | 'TECH' | 'TREND'>('NONE');

  // Load Data
  useEffect(() => {
    Promise.all([getFillAnalysisData(), getBasicInfo(), getPriceData(), getHistoryData(), getDividendData()]).then(([f, b, p, h, d]) => {
        setFillData(f); setBasicInfo(b); setPriceData(p); setHistoryData(h); setDivData(d);
    });
  }, []);

  // Filter Master List
  const filteredMaster = useMemo(() => {
      let result = basicInfo;
      const getStr = (val: string | undefined) => String(val || '');
      // Strict Filter Logic
      if (mainFilter !== '全部') {
          if (mainFilter === '債券') result = result.filter(d => getStr(d.category).includes('債'));
          else if (mainFilter === '季配') result = result.filter(d => getStr(d.dividendFreq).includes('季') && !getStr(d.category).includes('債'));
          else if (mainFilter === '月配') result = result.filter(d => getStr(d.dividendFreq).includes('月') && !getStr(d.category).includes('債') && !getStr(d.category).includes('主動'));
          else if (mainFilter === '主動') result = result.filter(d => getStr(d.category).includes('主動'));
          else if (mainFilter === '國際') result = result.filter(d => getStr(d.category).includes('國際') || getStr(d.category).includes('國外') || getStr(d.marketType).includes('國外'));
          else if (mainFilter === '半年') result = result.filter(d => (getStr(d.category).includes('半年') || getStr(d.dividendFreq).includes('半年')) && !getStr(d.category).includes('國際') && !getStr(d.category).includes('國外') && !getStr(d.marketType).includes('國外'));
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
      // Ensure the ETF has fill analysis data available
      return result.filter(b => fillData.some(f => f.etfCode === b.etfCode)).sort((a,b) => a.etfCode.localeCompare(b.etfCode));
  }, [basicInfo, mainFilter, subFilter, fillData]);

  // Auto Select
  useEffect(() => {
      if (filteredMaster.length > 0) setSelectedEtf(filteredMaster[0].etfCode);
      else setSelectedEtf(null);
  }, [filteredMaster]);

  // Detail Data
  const detailData = useMemo(() => {
      if (!selectedEtf) return [];
      return fillData.filter(d => d.etfCode === selectedEtf).sort((a,b) => b.exDate.localeCompare(a.exDate));
  }, [selectedEtf, fillData]);

  // Formatting
  const fmtP = (n: number | string) => { if (typeof n === 'string') return n; return n === 0 ? '-' : n.toFixed(2); };
  const fmtDiv = (n: number | string) => { if (typeof n === 'string') return n; return n === 0 ? '-' : n.toFixed(3); };
  const fmtPct = (n: number) => n === 0 ? '0.00%' : `${n.toFixed(2)}%`;
  const fmtCol = (n: number) => n > 0 ? 'text-red-600' : n < 0 ? 'text-green-600' : 'text-gray-800';

  // Metrics for Left Panel
  const calculateMetrics = (etf: BasicInfo) => {
      const myFills = fillData.filter(f => f.etfCode === etf.etfCode);
      const total = myFills.length;
      const filledCount = myFills.filter(f => f.isFilled).length;
      const successRate = total > 0 ? (filledCount / total) * 100 : 0;
      
      const filledItems = myFills.filter(f => f.isFilled && typeof f.daysToFill === 'number');
      const avgDays = filledItems.length > 0 ? filledItems.reduce((acc, c) => acc + (c.daysToFill as number), 0) / filledItems.length : 0;
      
      // Latest Fill Status
      const latest = myFills.sort((a,b) => b.exDate.localeCompare(a.exDate))[0];
      
      return { total, filledCount, successRate, avgDays, latest };
  };

  const handleExport = () => {
      if (!selectedEtf) return alert("請先選擇一檔 ETF");
      const headers = ['代碼', '名稱', '除息日期', '除息金額', '除息前股價', '參考價', '填息日期', '填息價', '是否填息', '填息天數'];
      const csvData = detailData.map(d => ({
          '代碼': d.etfCode, '名稱': d.etfName, 
          '除息日期': d.exDate, '除息金額': fmtDiv(d.amount), 
          '除息前股價': fmtP(d.pricePreEx), '參考價': fmtP(d.priceReference),
          '填息日期': d.fillDate || '-', '填息價': fmtP(d.fillPrice),
          '是否填息': d.isFilled ? '是' : '否', '填息天數': d.daysToFill
      }));
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
                        className={`px-3 py-1.5 rounded-lg text-base font-bold whitespace-nowrap transition-all border shrink-0 ${mainFilter === cat ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-blue-500 border-blue-100 hover:bg-blue-50 hover:text-blue-700'}`}>
                        {cat}
                    </button>
                ))}
                {subOptions.length > 0 && <div className="h-6 w-px bg-gray-300 shrink-0 mx-1"></div>}
                {subOptions.map(sub => (
                      <button key={sub} onClick={() => setSubFilter(sub === '全部' ? 'ALL' : sub)} className={`px-3 py-1.5 rounded-lg text-base whitespace-nowrap transition-colors font-bold border shrink-0 ${(subFilter === sub || (subFilter === 'ALL' && sub === '全部')) ? 'bg-blue-800 text-white border-blue-800 shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-white hover:text-blue-600 hover:border-blue-200'}`}>{sub}</button>
                  ))}
              </div>
              <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-gray-100">
                <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-bold text-base whitespace-nowrap shadow-sm" disabled={!selectedEtf}><Download className="w-4 h-4" /> 匯出表單</button>
              </div>
          </div>
      </div>

       {/* Content */}
       <div className="flex-1 flex gap-2 overflow-hidden min-h-0">
          
          {/* Left Panel */}
          <div className="w-[340px] flex-none bg-white rounded-lg shadow-sm border border-blue-200 flex flex-col overflow-hidden min-h-0">
              <div className="p-3 bg-blue-50 border-b border-blue-100 font-bold text-blue-900 flex justify-between items-center text-base flex-none">
                  <span className="font-bold">ETF 填息概況</span>
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
                          <div className="flex justify-between items-center leading-tight mb-1">
                              <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">次數</span><span className="text-base font-bold text-gray-900 font-mono">{metrics.total}</span></div>
                              <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">成功</span><span className="text-base font-bold text-emerald-600 font-mono">{metrics.filledCount}</span></div>
                              <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">機率</span><span className="text-base font-bold text-blue-700 font-mono">{fmtP(metrics.successRate)}%</span></div>
                          </div>
                          <div className="flex justify-between items-center leading-tight">
                              <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">均天</span><span className="text-base font-medium text-gray-900 font-mono">{fmtP(metrics.avgDays)}</span></div>
                              <div className="flex items-baseline gap-1"><span className="text-sm font-bold text-gray-500">最近</span><span className={`text-base font-medium font-mono ${metrics.latest?.isFilled ? 'text-emerald-600' : 'text-red-500'}`}>{metrics.latest?.isFilled ? `${metrics.latest.daysToFill}天` : '未填'}</span></div>
                          </div>
                      </div>
                  )})}
              </div>
          </div>

          {/* Right Panel */}
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
                                <h3 className="font-bold text-blue-900 text-lg">{selectedEtf} 歷史填息分析</h3>
                                <span className="text-base font-medium text-blue-600">共 {detailData.length} 筆</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setActiveModal('TECH')} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-base font-bold hover:bg-blue-700 transition-colors shadow-sm">
                                    <LineChart className="w-4 h-4" /> 技術線圖
                                </button>
                                <button onClick={() => setActiveModal('TREND')} className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-base font-bold hover:bg-orange-600 transition-colors shadow-sm">
                                    <TrendingUp className="w-4 h-4" /> 月趨勢圖
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-blue-50 sticky top-0 text-base z-10 text-blue-900 font-bold border-b border-blue-200">
                                    <tr>
                                        <th className="p-2.5 pl-4 w-1/8">除息日期</th>
                                        <th className="p-2.5 text-right w-1/8">金額</th>
                                        <th className="p-2.5 text-right w-1/8">除息前股價</th>
                                        <th className="p-2.5 text-right w-1/8">除息參考價</th>
                                        <th className="p-2.5 text-center w-1/8">填息日期</th>
                                        <th className="p-2.5 text-right w-1/8">填息價</th>
                                        <th className="p-2.5 text-center w-1/8">狀態</th>
                                        <th className="p-2.5 pr-6 text-right w-1/8">天數</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-blue-50 text-[15px]">
                                    {detailData.map((d, i) => {
                                        const isSuccess = d.isFilled;
                                        return (
                                            <tr key={i} className={`hover:bg-blue-50/50 transition-colors ${isSuccess ? 'bg-green-50/30' : 'bg-red-50/30'}`}>
                                                <td className="p-2.5 pl-4 font-mono font-bold text-gray-700">{d.exDate}</td>
                                                <td className="p-2.5 text-right font-bold text-emerald-600 font-mono text-lg">{fmtDiv(d.amount)}</td>
                                                <td className="p-2.5 text-right font-mono text-gray-600">{fmtP(d.pricePreEx)}</td>
                                                <td className="p-2.5 text-right font-mono text-orange-600 font-bold">{fmtP(d.priceReference)}</td>
                                                <td className="p-2.5 text-center font-mono text-gray-800">{d.fillDate || '-'}</td>
                                                <td className="p-2.5 text-right font-mono text-blue-800 font-bold">{fmtP(d.fillPrice)}</td>
                                                <td className="p-2.5 text-center font-bold">
                                                    {isSuccess ? <span className="text-emerald-600 flex items-center justify-center gap-1"><CheckCircle2 className="w-4 h-4"/>成功</span> : <span className="text-red-500 flex items-center justify-center gap-1"><Clock className="w-4 h-4"/>未填</span>}
                                                </td>
                                                <td className="p-2.5 pr-6 text-right font-mono font-bold text-gray-900">{d.daysToFill}</td>
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
       
       {activeModal === 'TECH' && selectedEtf && <TechChartModal data={getModalData()} title={`${selectedEtf} ${basicInfo.find(b=>b.etfCode===selectedEtf)?.etfName || ''}`} onClose={() => setActiveModal('NONE')} />}
       {activeModal === 'TREND' && selectedEtf && <TrendChartModal historyData={historyData.filter(d => d.etfCode === selectedEtf)} priceData={priceData.filter(d => d.etfCode === selectedEtf)} divData={divData.filter(d => d.etfCode === selectedEtf)} title={`${selectedEtf} ${basicInfo.find(b=>b.etfCode===selectedEtf)?.etfName || ''}`} onClose={() => setActiveModal('NONE')} />}
    </div>
  );
};

export default TabFillAnalysis;