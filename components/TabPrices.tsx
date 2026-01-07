import React, { useState, useEffect } from 'react';
import { getPriceData, getBasicInfo, exportToCSV } from '../services/dataService';
import { PriceData, BasicInfo } from '../types';
import { ChevronRight, Info, Download, Database, TrendingUp, TrendingDown, X } from 'lucide-react';

interface TabPricesProps {
    mainFilter?: string;
    subFilter?: string;
    setMainFilter?: (val: string) => void;
    setSubFilter?: (val: string) => void;
}

// Helper duplicated from BasicInfo to ensure identical logic
const checkSeason = (freqStr: string | undefined, season: 'Q1'|'Q2'|'Q3') => {
    const f = String(freqStr || '').replace(/\s/g, ''); 
    if (season === 'Q1') return f.includes('季一') || f.includes('1,4,7,10') || f.includes('01,04,07,10') || (f.includes('1') && f.includes('4'));
    if (season === 'Q2') return f.includes('季二') || f.includes('2,5,8,11') || f.includes('02,05,08,11') || (f.includes('2') && f.includes('5'));
    if (season === 'Q3') return f.includes('季三') || f.includes('3,6,9,12') || f.includes('03,06,09,12') || (f.includes('3') && f.includes('6'));
    return false;
};

const TabPrices: React.FC<TabPricesProps> = ({ 
    mainFilter = '全部', 
    subFilter = 'ALL', 
    setMainFilter = (_v: string) => {}, 
    setSubFilter = (_v: string) => {} 
}) => {
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
  const [selectedEtf, setSelectedEtf] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showRecentModal, setShowRecentModal] = useState(false);

  useEffect(() => {
    Promise.all([getPriceData(), getBasicInfo()]).then(([p, b]) => {
        setPriceData(p);
        setBasicInfo(b);
        if (p.length > 0) {
             const sorted = [...p].sort((a,b) => b.date.localeCompare(a.date));
             const latest = sorted[0].date;
             if (latest && !isNaN(new Date(latest).getTime())) {
                setEndDate(latest);
                const start = new Date(latest);
                start.setDate(start.getDate() - 20);
                setStartDate(start.toISOString().split('T')[0]);
             } else {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 20);
                setEndDate(end.toISOString().split('T')[0]);
                setStartDate(start.toISOString().split('T')[0]);
             }
        }
    });
  }, []);

  const getFilteredMasterList = () => {
      // 1. Filter BasicInfo using the exact logic from TabBasicInfo
      let result = basicInfo;
      const getStr = (val: string | undefined) => String(val || '');

      // Apply Main Filter
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
              result = result.filter(d => getStr(d.category).includes('國際') || getStr(d.etfType).includes('國際') || getStr(d.marketType).includes('國外'));
          }
      }

      // Apply Sub Filter
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

      // 2. Filter valid codes that have price data
      return result.filter(b => priceData.some(p => p.etfCode === b.etfCode)).sort((a,b) => a.etfCode.localeCompare(b.etfCode));
  };
  const filteredMaster = getFilteredMasterList();

  const getDetailData = () => {
      if (!selectedEtf) return [];
      return priceData.filter(d => {
          if (d.etfCode !== selectedEtf) return false;
          if (startDate && d.date < startDate) return false;
          if (endDate && d.date > endDate) return false;
          return true;
      }).sort((a,b) => b.date.localeCompare(a.date));
  };
  const detailData = getDetailData();

  const fmt = (num: number) => num ? num.toFixed(2) : '0.00';

  const handleExport = () => {
      if (!selectedEtf) return alert("請先選擇一檔 ETF");
      const headers = ['代碼', '名稱', '日期', '昨收', '開盤', '最高', '最低', '收盤', '漲跌'];
      const csvData = detailData.map(d => {
          const change = d.price - d.prevClose;
          return {
            '代碼': d.etfCode,
            '名稱': d.etfName,
            '日期': d.date,
            '昨收': fmt(d.prevClose),
            '開盤': fmt(d.open),
            '最高': fmt(d.high),
            '最低': fmt(d.low),
            '收盤': fmt(d.price),
            '漲跌': (change > 0 ? '+' : '') + fmt(change)
          };
      });
      exportToCSV(`${selectedEtf}_PriceHistory`, headers, csvData);
  };

  const getRecentInfo = () => {
      const result = [];
      for (const etf of filteredMaster) {
          const recs = priceData.filter(p => p.etfCode === etf.etfCode);
          if (recs.length > 0) {
              const sorted = recs.sort((a,b) => b.date.localeCompare(a.date));
              result.push(sorted[0]);
          }
      }
      return result.sort((a,b) => a.etfCode.localeCompare(b.etfCode));
  };

  const getSubFilterOptions = () => {
      if (mainFilter === '全部') return ['全部', '季一', '季二', '季三', '月配', '半年', '年配', '無配'];
      if (mainFilter === '債券') return ['全部', '月配', '季一', '季二', '季三'];
      if (mainFilter === '季配') return ['全部', '季一', '季二', '季三'];
      return [];
  };

  const subOptions = getSubFilterOptions();
  const showSubFilters = subOptions.length > 0;

  return (
    <div className="h-full flex flex-col p-2 gap-2 bg-primary-50">
      {/* 1. Filter Panel - Copied from Basic Info */}
      <div className="bg-white p-2 rounded-lg shadow-sm border border-primary-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
               {/* Level 1: Main Buttons */}
               <div className="flex gap-1 shrink-0 bg-primary-50 p-1 rounded-lg">
                {['全部', '季配', '月配', '債券', '主動', '國際'].map(cat => (
                    <button
                        key={cat}
                        onClick={() => { setMainFilter(cat); setSubFilter('ALL'); }}
                        className={`
                            px-3 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-all 
                            ${mainFilter === cat 
                                ? 'bg-white text-primary-700 shadow border border-primary-200' 
                                : 'text-primary-500 hover:bg-primary-100 hover:text-primary-700'}
                        `}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Level 2: Sub Buttons */}
            {showSubFilters && (
                <div className="flex items-center animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="h-6 w-px bg-primary-200 mx-2"></div>
                    <div className="flex gap-1 shrink-0">
                        {subOptions.map(sub => (
                            <button 
                                key={sub}
                                onClick={() => setSubFilter(sub === '全部' ? 'ALL' : sub)} 
                                className={`
                                    px-2 py-1 rounded text-xs whitespace-nowrap transition-colors font-medium
                                    ${(subFilter === sub || (subFilter === 'ALL' && sub === '全部'))
                                        ? 'bg-primary-600 text-white shadow-sm' 
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}
                                `}
                            >
                                {sub}
                            </button>
                        ))}
                    </div>
                </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 ml-auto shrink-0">
             <div className="flex items-center gap-1 bg-gray-50 border rounded px-2 py-1">
                 <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="bg-transparent text-xs w-40 font-mono outline-none"/>
                 <span className="text-xs">~</span>
                 <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="bg-transparent text-xs w-40 font-mono outline-none"/>
             </div>

             <div className="flex gap-1">
                <button onClick={() => setShowRecentModal(true)} className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md hover:bg-amber-100 font-bold text-sm">
                    <Info className="w-4 h-4" /> <span className="hidden sm:inline">近期</span>
                </button>
                <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 font-bold text-sm" disabled={!selectedEtf}>
                    <Download className="w-4 h-4" /> <span className="hidden sm:inline">匯出</span>
                </button>
             </div>
          </div>
      </div>

      {/* 2. Content Area (Master Detail) */}
      <div className="flex-1 flex gap-2 overflow-hidden">
          {/* Left: Master List */}
          <div className="w-64 flex-none bg-white rounded-xl shadow-sm border border-primary-200 flex flex-col overflow-hidden">
              <div className="p-2 bg-gray-50 border-b font-bold text-gray-700 flex justify-between text-sm">
                  <span>ETF 列表</span>
                  <span className="bg-gray-200 px-1.5 rounded-full text-xs flex items-center">{filteredMaster.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                  {filteredMaster.map(item => (
                      <div 
                        key={item.etfCode} 
                        onClick={() => setSelectedEtf(item.etfCode)}
                        className={`p-2 border-b flex justify-between items-center cursor-pointer hover:bg-blue-50 ${selectedEtf === item.etfCode ? 'bg-blue-100 border-l-4 border-l-blue-600' : ''}`}
                      >
                          <div>
                              <div className="font-bold text-gray-800 text-sm">{item.etfCode}</div>
                              <div className="text-xs text-gray-500 truncate w-32">{item.etfName}</div>
                          </div>
                          <div className="text-xs text-gray-400">{item.dividendFreq}</div>
                      </div>
                  ))}
              </div>
          </div>

          {/* Right: Detail Table */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-primary-200 flex flex-col overflow-hidden">
                {!selectedEtf ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Database className="w-12 h-12 mb-3 opacity-30" />
                        <p className="text-sm">請選擇左側 ETF</p>
                    </div>
                ) : (
                    <>
                        <div className="p-2 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                            <h3 className="font-bold text-blue-900 text-sm">{selectedEtf} 歷史股價</h3>
                            <span className="text-xs text-blue-600">共 {detailData.length} 筆</span>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 sticky top-0 text-sm text-gray-600">
                                    <tr>
                                        <th className="p-2 pl-4">日期</th>
                                        <th className="p-2 text-right">昨收</th>
                                        <th className="p-2 text-right">開盤</th>
                                        <th className="p-2 text-right">最高</th>
                                        <th className="p-2 text-right">最低</th>
                                        <th className="p-2 text-right">收盤</th>
                                        <th className="p-2 text-right pr-4">漲跌</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-sm">
                                    {detailData.map((d, i) => {
                                        const change = d.price - d.prevClose;
                                        return (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="p-2 pl-4 font-mono">{d.date}</td>
                                                <td className="p-2 text-right font-mono text-gray-500">{fmt(d.prevClose)}</td>
                                                <td className="p-2 text-right font-mono">{fmt(d.open)}</td>
                                                <td className="p-2 text-right font-mono text-red-500">{fmt(d.high)}</td>
                                                <td className="p-2 text-right font-mono text-green-500">{fmt(d.low)}</td>
                                                <td className="p-2 text-right font-mono font-bold">{fmt(d.price)}</td>
                                                <td className={`p-2 text-right pr-4 font-mono font-medium ${change >=0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    {change > 0 ? '+' : ''}{fmt(change)}
                                                </td>
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

      {/* Recent Info Modal */}
      {showRecentModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
                   <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                       <h3 className="font-bold text-lg">近期資訊</h3>
                       <button onClick={()=>setShowRecentModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
                   </div>
                   <div className="flex-1 overflow-auto p-4">
                       <table className="w-full text-sm">
                           <thead className="bg-gray-100 text-gray-600 sticky top-0">
                               <tr>
                                   <th className="p-2 text-left">代碼</th>
                                   <th className="p-2 text-left">名稱</th>
                                   <th className="p-2 text-left">日期</th>
                                   <th className="p-2 text-right">收盤</th>
                                   <th className="p-2 text-right">漲跌</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y">
                               {getRecentInfo().map((row, idx) => (
                                   <tr key={idx} className="hover:bg-blue-50">
                                       <td className="p-2 font-bold text-blue-800">{row.etfCode}</td>
                                       <td className="p-2">{row.etfName}</td>
                                       <td className="p-2 font-mono text-gray-500">{row.date}</td>
                                       <td className="p-2 text-right font-bold">{fmt(row.price)}</td>
                                       <td className={`p-2 text-right ${row.price - row.prevClose >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                           {fmt(row.price - row.prevClose)}
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               </div>
          </div>
      )}

    </div>
  );
};

export default TabPrices;