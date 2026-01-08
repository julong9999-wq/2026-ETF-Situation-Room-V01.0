import React, { useState, useEffect, useMemo } from 'react';
import { getFillAnalysisData, getBasicInfo, getPriceData, getHistoryData, getDividendData, exportToCSV } from '../services/dataService';
import { FillAnalysisData, BasicInfo, PriceData, HistoryData, DividendData } from '../types';
import { Download, CheckCircle, Clock, Database } from 'lucide-react';

interface TabFillAnalysisProps {
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

// Helper: Get background color based on frequency
const getRowBgColor = (etf: BasicInfo, isSelected: boolean) => {
    const freq = String(etf.dividendFreq || '');
    let colorClass = 'bg-gray-50'; // Default / Half / Year / None

    if (freq.includes('月')) {
        colorClass = 'bg-amber-50'; // Light Tea/Amber
    } else if (checkSeason(freq, 'Q1')) {
        colorClass = 'bg-sky-50'; // Light Blue
    } else if (checkSeason(freq, 'Q2')) {
        colorClass = 'bg-green-50'; // Light Green
    } else if (checkSeason(freq, 'Q3')) {
        colorClass = 'bg-orange-50'; // Light Orange
    }

    if (isSelected) {
        return `${colorClass} border-2 border-orange-500 shadow-md z-10`;
    }
    return `${colorClass} border border-gray-100 hover:brightness-95`;
};

const TabFillAnalysis: React.FC<TabFillAnalysisProps> = ({ 
    mainFilter = '全部', 
    subFilter = 'ALL', 
    setMainFilter = (_v: string) => {}, 
    setSubFilter = (_v: string) => {} 
}) => {
  const [fillData, setFillData] = useState<FillAnalysisData[]>([]);
  const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [divData, setDivData] = useState<DividendData[]>([]);
  const [selectedEtf, setSelectedEtf] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    Promise.all([getFillAnalysisData(), getBasicInfo(), getPriceData(), getHistoryData(), getDividendData()]).then(([f, b, p, h, d]) => {
        setFillData(f);
        setBasicInfo(b);
        setPriceData(p);
        setHistoryData(h);
        setDivData(d);
        
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
          if (mainFilter === '債券') {
              result = result.filter(d => getStr(d.category).includes('債'));
          } else if (mainFilter === '季配') {
              result = result.filter(d => getStr(d.dividendFreq).includes('季') && !getStr(d.category).includes('債'));
          } else if (mainFilter === '月配') {
              result = result.filter(d => getStr(d.dividendFreq).includes('月') && !getStr(d.category).includes('債') && !getStr(d.category).includes('主動') && !getStr(d.etfType).includes('主動') && !getStr(d.etfName).includes('主動'));
          } else if (mainFilter === '主動') {
              result = result.filter(d => getStr(d.category).includes('主動') || getStr(d.etfType).includes('主動') || getStr(d.etfName).includes('主動'));
          } else if (mainFilter === '國際') {
              result = result.filter(d => d.etfCode === '00911' || getStr(d.category).includes('國際') || getStr(d.etfType).includes('國際') || getStr(d.marketType).includes('國外'));
          } else if (mainFilter === '半年') {
              result = result.filter(d => d.etfCode !== '00911' && (getStr(d.category).includes('半年') || getStr(d.dividendFreq).includes('半年')));
          }
      }

      if (subFilter !== 'ALL') {
          const freqStr = (d: BasicInfo) => String(d.dividendFreq || '');
          if (subFilter === '季一') result = result.filter(d => checkSeason(freqStr(d), 'Q1'));
          else if (subFilter === '季二') result = result.filter(d => checkSeason(freqStr(d), 'Q2'));
          else if (subFilter === '季三') result = result.filter(d => checkSeason(freqStr(d), 'Q3'));
          else if (subFilter === '月配') result = result.filter(d => freqStr(d).includes('月'));
          else if (subFilter === '半年') result = result.filter(d => freqStr(d).includes('半年'));
          else if (subFilter === '年配') result = result.filter(d => freqStr(d).includes('年') && !freqStr(d).includes('半年'));
          else if (subFilter === '無配') result = result.filter(d => freqStr(d).includes('不') || freqStr(d) === '' || freqStr(d).includes('無'));
      }

      const validCodes = new Set(fillData.map(f => f.etfCode));
      return result.filter(d => validCodes.has(d.etfCode)).sort((a,b) => a.etfCode.localeCompare(b.etfCode));
  }, [basicInfo, mainFilter, subFilter, fillData]);

  useEffect(() => {
      if (filteredMaster.length > 0) setSelectedEtf(filteredMaster[0].etfCode);
      else setSelectedEtf(null);
  }, [filteredMaster]);

  // Header Dates
  const systemDates = useMemo(() => {
      if (priceData.length === 0) return { start: '-', end: '-' };
      let maxDate = '';
      for(const p of priceData) {
          if(p.date > maxDate) maxDate = p.date;
      }
      if(!maxDate) return { start: '-', end: '-' };
      
      const d = new Date(maxDate);
      d.setFullYear(d.getFullYear() - 1);
      const startStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      return { start: startStr, end: maxDate };
  }, [priceData]);

  // --- CALCULATION LOGIC ---
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
      if (startPrice > 0 && latestPrice > 0) {
          returnVal = ((latestPrice - startPrice) / startPrice) * 100;
      }

      let totalReturnVal = 0;
      if (startPrice > 0 && latestPrice > 0) {
          const startIso = `${targetDateStr}-01`;
          const periodDivs = pastDivs.filter(d => d.exDate >= startIso && d.exDate <= todayDateStr);
          const totalDivs = periodDivs.reduce((acc, c) => acc + c.amount, 0);
          totalReturnVal = ((latestPrice + totalDivs - startPrice) / startPrice) * 100;
      }

      return { latestPrice, startPrice, yieldVal, estYieldVal, returnVal, totalReturnVal };
  };

  // Fixed fmtP to handle strings ("待除息資訊" etc.) without crashing
  const fmtP = (n: number | string) => {
    if (typeof n === 'string') return n;
    return n === 0 ? '-' : n.toFixed(2);
  };
  
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

      const headers = [
          '代碼', '名稱', '所屬年月', '除息日期', '除息金額', 
          '除息前一天', '除息前一天股價', '除息參考價', 
          '分析比對日期', '分析比對價格', '分析是否填息成功', '幾天填息'
      ];
      const csvData = detailData.map(d => ({
          '代碼': d.etfCode,
          '名稱': d.etfName,
          '所屬年月': d.yearMonth,
          '除息日期': d.exDate,
          '除息金額': d.amount,
          '除息前一天': d.preExDate,
          '除息前一天股價': d.pricePreEx,
          '除息參考價': d.priceReference,
          '分析比對日期': d.fillDate,
          '分析比對價格': d.fillPrice,
          '分析是否填息成功': d.isFilled ? '是' : '否',
          '幾天填息': d.daysToFill
      }));
      exportToCSV(`${selectedEtf}_FillAnalysis`, headers, csvData);
  };

  const getSubFilterOptions = () => {
      if (mainFilter === '全部') return ['全部', '季一', '季二', '季三', '月配', '半年', '年配', '無配'];
      if (mainFilter === '債券') return ['全部', '月配', '季一', '季二', '季三'];
      if (mainFilter === '季配') return ['全部', '季一', '季二', '季三'];
      return [];
  };

  const subOptions = getSubFilterOptions();

  const filledCount = detailData.filter(d => d.isFilled).length;

  return (
    <div className="h-full flex flex-col p-2 gap-2 bg-primary-50">
       <div className="bg-white p-2 rounded-lg shadow-sm border border-primary-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <div className="flex gap-1 shrink-0 bg-primary-50 p-1 rounded-lg">
                {['全部', '季配', '月配', '債券', '主動', '國際', '半年'].map(cat => (
                    <button key={cat} onClick={() => { setMainFilter(cat); setSubFilter('ALL'); }}
                        className={`px-3 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-all ${mainFilter === cat ? 'bg-white text-primary-700 shadow border border-primary-200' : 'text-primary-500 hover:bg-primary-100 hover:text-primary-700'}`}>
                        {cat}
                    </button>
                ))}
            </div>
             {subOptions.length > 0 && (
                  <div className="flex items-center animate-in fade-in slide-in-from-left-2 duration-300">
                      <div className="h-6 w-px bg-primary-200 mx-2"></div>
                      <div className="flex gap-1 shrink-0">
                          {subOptions.map(sub => (
                              <button key={sub} onClick={() => setSubFilter(sub === '全部' ? 'ALL' : sub)}
                                  className={`px-2 py-1 rounded text-xs whitespace-nowrap transition-colors font-medium ${(subFilter === sub || (subFilter === 'ALL' && sub === '全部')) ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                  {sub}
                              </button>
                          ))}
                      </div>
                  </div>
              )}
          </div>
          <div className="flex items-center gap-2 ml-auto shrink-0">
              <div className="flex items-center gap-1 bg-gray-50 border rounded px-2 py-1">
                  <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="bg-transparent text-xs w-32 font-mono outline-none"/>
                  <span className="text-xs">~</span>
                  <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="bg-transparent text-xs w-32 font-mono outline-none"/>
              </div>
              <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 font-bold text-sm" disabled={!selectedEtf}>
                <Download className="w-4 h-4" /> <span>匯出</span>
              </button>
          </div>
      </div>

      <div className="flex-1 flex gap-2 overflow-hidden">
          {/* LEFT SIDEBAR */}
          <div className="w-[360px] flex-none bg-white rounded-xl shadow-sm border border-primary-200 flex flex-col overflow-hidden">
              <div className="p-2 bg-gray-50 border-b font-bold text-gray-700 flex justify-between items-center text-[14px]">
                  <div className="flex gap-2">
                       <span>起始: <span className="font-mono">{systemDates.start}</span></span>
                       <span>現值: <span className="font-mono">{systemDates.end}</span></span>
                  </div>
                  <span className="bg-gray-200 px-1.5 rounded-full text-xs flex items-center">{filteredMaster.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filteredMaster.map(item => {
                      const metrics = calculateMetrics(item);
                      return (
                      <div 
                        key={item.etfCode} 
                        onClick={() => setSelectedEtf(item.etfCode)}
                        className={`
                            rounded-xl p-2 cursor-pointer transition-all duration-200 flex flex-col gap-1 relative
                            ${getRowBgColor(item, selectedEtf === item.etfCode)}
                        `}
                      >
                          {/* Row 1: Code & Name */}
                          <div className="flex items-baseline gap-2 border-b border-gray-200/50 pb-1 mb-0.5">
                              <span className="text-[18px] font-bold text-sky-600 font-mono">{item.etfCode}</span>
                              <span className="text-[16px] font-light text-gray-500 truncate">{item.etfName}</span>
                          </div>
                          
                          {/* Row 2: Price / Yield / Return (Inline) */}
                          <div className="flex justify-between items-center leading-none">
                              <div className="flex items-baseline gap-1">
                                  <span className="text-[11px] text-gray-500">現</span>
                                  <span className="text-[16px] font-bold text-black font-mono">{fmtP(metrics.latestPrice)}</span>
                              </div>
                              <div className="flex items-baseline gap-1">
                                  <span className="text-[11px] text-gray-500">殖</span>
                                  <span className="text-[16px] font-bold text-black font-mono">{fmtPct(metrics.yieldVal)}</span>
                              </div>
                              <div className="flex items-baseline gap-1">
                                  <span className="text-[11px] text-gray-500">報</span>
                                  <span className={`text-[16px] font-bold font-mono ${fmtCol(metrics.returnVal)}`}>{fmtPct(metrics.returnVal)}</span>
                              </div>
                          </div>

                          {/* Row 3: Start / Est / Total (Inline) */}
                          <div className="flex justify-between items-center leading-none">
                               <div className="flex items-baseline gap-1">
                                  <span className="text-[11px] text-gray-500">起</span>
                                  <span className="text-[16px] font-light text-gray-500 font-mono">{fmtP(metrics.startPrice)}</span>
                              </div>
                              <div className="flex items-baseline gap-1">
                                  <span className="text-[11px] text-gray-500">預</span>
                                  <span className="text-[16px] font-light text-gray-500 font-mono">
                                      {metrics.estYieldVal === null ? <span className="text-gray-400 text-xs">空值</span> : fmtPct(metrics.estYieldVal)}
                                  </span>
                              </div>
                              <div className="flex items-baseline gap-1">
                                  <span className="text-[11px] text-gray-500">含</span>
                                  <span className={`text-[16px] font-light font-mono ${fmtCol(metrics.totalReturnVal)}`}>{fmtPct(metrics.totalReturnVal)}</span>
                              </div>
                          </div>
                      </div>
                  )})}
              </div>
          </div>

          <div className="flex-1 bg-white rounded-xl shadow-sm border border-primary-200 flex flex-col overflow-hidden">
                {!selectedEtf ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Database className="w-12 h-12 mb-3 opacity-30" />
                        <p className="text-sm">請選擇左側 ETF</p>
                    </div>
                ) : (
                    <>
                         <div className="p-2 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
                            <h3 className="font-bold text-orange-900 text-sm">{selectedEtf} 填息分析</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-orange-600 font-bold">成功: {filledCount}</span>
                                <span className="text-xs text-orange-400">/ {detailData.length}</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 sticky top-0 text-sm">
                                    <tr>
                                        <th className="p-2 text-orange-900 whitespace-nowrap">除息日期</th>
                                        <th className="p-2 text-orange-900 text-right whitespace-nowrap">配息金額</th>
                                        <th className="p-2 text-orange-900 whitespace-nowrap">除息前一天</th>
                                        <th className="p-2 text-orange-900 text-right whitespace-nowrap">除息前股價</th>
                                        <th className="p-2 text-orange-900 text-right whitespace-nowrap">除息參考價</th>
                                        <th className="p-2 text-orange-900 text-center whitespace-nowrap">分析比對日期</th>
                                        <th className="p-2 text-orange-900 text-right whitespace-nowrap">分析比對價格</th>
                                        <th className="p-2 text-orange-900 text-center whitespace-nowrap">狀態</th>
                                        <th className="p-2 text-orange-900 text-center whitespace-nowrap">天數</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {detailData.map((row, idx) => {
                                        const isPending = row.daysToFill === '待除息資訊';
                                        return (
                                        <tr key={idx} className={`hover:bg-orange-50/30 ${isPending ? 'bg-red-50' : ''}`}>
                                            <td className="p-2 font-mono font-bold">{row.exDate}</td>
                                            <td className="p-2 font-mono text-right font-bold text-gray-800">{fmtP(row.amount)}</td>
                                            <td className="p-2 font-mono text-gray-600">{row.preExDate}</td>
                                            <td className="p-2 font-mono text-right text-gray-500">{fmtP(row.pricePreEx)}</td>
                                            <td className="p-2 font-mono text-right text-gray-500">{fmtP(row.priceReference)}</td>
                                            <td className="p-2 font-mono text-center text-gray-600">{row.fillDate}</td>
                                            <td className="p-2 font-mono text-right text-gray-600">{fmtP(row.fillPrice)}</td>
                                            <td className="p-2 text-center">
                                                {row.isFilled ? <span className="inline-flex items-center gap-1 text-green-600 font-bold text-xs"><CheckCircle className="w-3 h-3"/> 成功</span> : <span className={`text-xs font-medium ${isPending ? 'text-red-500' : 'text-gray-400'}`}>{row.daysToFill === '歷史資料' ? '歷史資料' : isPending ? '待除息' : '未填息'}</span>}
                                            </td>
                                            <td className="p-2 text-center font-mono">
                                                {row.isFilled ? <span className="text-green-600 font-bold">{row.daysToFill}天</span> : <span className="inline-flex items-center gap-1 text-gray-400 text-xs">{row.daysToFill === '歷史資料' ? '' : isPending ? '' : <Clock className="w-3 h-3"/>} {row.daysToFill}</span>}
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
          </div>
      </div>
    </div>
  );
};

export default TabFillAnalysis;