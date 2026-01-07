import React, { useState, useEffect, useMemo } from 'react';
import { getDividendData, getBasicInfo, exportToCSV } from '../services/dataService';
import { DividendData, BasicInfo } from '../types';
import { Database, Download, Megaphone, X, Calendar } from 'lucide-react';

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

const getRowColor = (freq: string | undefined, isSelected: boolean) => {
    const f = String(freq || '');
    let baseClass = 'bg-gray-100 text-gray-600 border-gray-200';

    if (f.includes('季一') || f.includes('1,4,7,10') || (f.includes('1') && f.includes('4'))) {
        baseClass = 'bg-blue-100 text-blue-900 border-blue-200';
    } else if (f.includes('季二') || f.includes('2,5,8,11') || (f.includes('2') && f.includes('5'))) {
        baseClass = 'bg-green-100 text-green-900 border-green-200';
    } else if (f.includes('季三') || f.includes('3,6,9,12') || (f.includes('3') && f.includes('6'))) {
        baseClass = 'bg-orange-100 text-orange-900 border-orange-200';
    } else if (f.includes('月')) {
        baseClass = 'bg-amber-100 text-amber-900 border-amber-200';
    }

    if (isSelected) {
        return `${baseClass} ring-2 ring-inset ring-purple-500 font-bold shadow-md transform scale-[1.01] z-10`;
    }
    return `${baseClass} hover:opacity-90`;
};

const TabDividends: React.FC<TabDividendsProps> = ({ 
    mainFilter = '全部', 
    subFilter = 'ALL', 
    setMainFilter = (_v: string) => {}, 
    setSubFilter = (_v: string) => {} 
}) => {
  const [divData, setDivData] = useState<DividendData[]>([]);
  const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
  const [selectedEtf, setSelectedEtf] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [showAnnoModal, setShowAnnoModal] = useState(false);
  const [annoFilter, setAnnoFilter] = useState<'ALL'|'季配'|'月配'|'債券'|'其他'>('ALL');

  useEffect(() => {
    Promise.all([getDividendData(), getBasicInfo()]).then(([d, b]) => {
        setDivData(d);
        setBasicInfo(b);
        
        // Default Range: 2025/1/1 ~ End of Current Month
        setStartDate('2025-01-01');
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
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
              // FORCE 00911 to be in International
              result = result.filter(d => d.etfCode === '00911' || getStr(d.category).includes('國際') || getStr(d.etfType).includes('國際') || getStr(d.marketType).includes('國外'));
          } else if (mainFilter === '半年') {
              // EXCLUDE 00911 from Half-Year
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

      return result.filter(b => divData.some(d => d.etfCode === b.etfCode)).sort((a,b) => a.etfCode.localeCompare(b.etfCode));
  }, [basicInfo, mainFilter, subFilter, divData]);

  // AUTO-SELECT FIRST ETF ON FILTER CHANGE
  useEffect(() => {
      if (filteredMaster.length > 0) {
          // Select the first one whenever the filtered list changes content
          setSelectedEtf(filteredMaster[0].etfCode);
      } else {
          setSelectedEtf(null);
      }
  }, [filteredMaster]);

  const getDetailData = () => {
      if (!selectedEtf) return [];
      return divData.filter(d => {
          if (d.etfCode !== selectedEtf) return false;
          const ex = d.exDate.replace(/\//g, '-');
          if (startDate && ex < startDate) return false;
          if (endDate && ex > endDate) return false;
          return true;
      }).sort((a,b) => b.yearMonth.localeCompare(a.yearMonth));
  };
  // IMPORTANT: Call this every render or useMemo to ensure it's up to date for export
  const detailData = getDetailData();

  const handleExport = () => {
      if (!selectedEtf) return alert("請先選擇一檔 ETF");
      // Use the 'detailData' variable directly which is calculated in scope
      if (detailData.length === 0) return alert("目前條件下無資料可匯出");
      
      exportToCSV(`${selectedEtf}_Dividends`, ['代碼', '名稱', '年月', '除息日', '除息金額', '發放日'], detailData);
  }

  const getAnnouncements = () => {
      const today = new Date().toISOString().split('T')[0];
      const future = divData.filter(d => d.exDate.replace(/\//g, '-') >= today);
      
      const enriched = future.map(d => {
          const info = basicInfo.find(b => b.etfCode === d.etfCode);
          return {
              ...d,
              category: info?.category || '其他',
              freq: info?.dividendFreq || '未知',
              status: '公告中'
          };
      });

      return enriched.filter(d => {
          if (annoFilter === 'ALL') return true;
          if (annoFilter === '季配') return d.freq.includes('季');
          if (annoFilter === '月配') return d.freq.includes('月');
          if (annoFilter === '債券') return d.category.includes('債');
          if (annoFilter === '其他') {
              return !d.freq.includes('季') && !d.freq.includes('月') && !d.category.includes('債');
          }
          return true;
      }).sort((a,b) => a.exDate.localeCompare(b.exDate));
  };

  const getSubFilterOptions = () => {
      if (mainFilter === '全部') return ['全部', '季一', '季二', '季三', '月配', '半年', '年配', '無配'];
      if (mainFilter === '債券') return ['全部', '月配', '季一', '季二', '季三'];
      if (mainFilter === '季配') return ['全部', '季一', '季二', '季三'];
      return [];
  };

  const subOptions = getSubFilterOptions();
  const showSubFilters = subOptions.length > 0;
  const fmt = (num: number) => num ? num.toFixed(2) : '0.00';
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="h-full flex flex-col p-2 gap-2 bg-primary-50">
       <div className="bg-white p-2 rounded-lg shadow-sm border border-primary-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
               <div className="flex gap-1 shrink-0 bg-primary-50 p-1 rounded-lg">
                {['全部', '季配', '月配', '債券', '主動', '國際', '半年'].map(cat => (
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
                <button onClick={() => setShowAnnoModal(true)} className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md hover:bg-purple-100 font-bold text-sm">
                    <Megaphone className="w-4 h-4" /> <span className="hidden sm:inline">公告</span>
                </button>
                <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 font-bold text-sm" disabled={!selectedEtf}>
                    <Download className="w-4 h-4" /> <span className="hidden sm:inline">匯出</span>
                </button>
             </div>
          </div>
      </div>

       <div className="flex-1 flex gap-2 overflow-hidden">
          <div className="w-96 flex-none bg-white rounded-xl shadow-sm border border-primary-200 flex flex-col overflow-hidden">
              <div className="p-2 bg-gray-50 border-b font-bold text-gray-700 flex justify-between text-sm">
                  <span>ETF 列表</span>
                  <span className="bg-gray-200 px-1.5 rounded-full text-xs flex items-center">{filteredMaster.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-1 space-y-1">
                  {filteredMaster.map(item => (
                      <div 
                        key={item.etfCode} 
                        onClick={() => setSelectedEtf(item.etfCode)}
                        className={`
                            px-3 py-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-2
                            ${getRowColor(item.dividendFreq, selectedEtf === item.etfCode)}
                        `}
                      >
                          <span className="font-bold font-mono text-base whitespace-nowrap min-w-[3.5rem]">{item.etfCode}</span>
                          <span className="text-sm font-medium truncate flex-1" title={item.etfName}>{item.etfName}</span>
                          <span className="text-xs opacity-60 whitespace-nowrap ml-1 bg-white/30 px-1 rounded">{item.dividendFreq}</span>
                      </div>
                  ))}
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
                         <div className="p-2 bg-purple-50 border-b border-purple-100 flex justify-between items-center">
                            <h3 className="font-bold text-purple-900 text-sm">{selectedEtf} 除息明細</h3>
                            <span className="text-xs text-purple-600">共 {detailData.length} 筆</span>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 sticky top-0 text-sm">
                                    <tr>
                                        <th className="p-2 pl-4">年月</th>
                                        <th className="p-2">日期</th>
                                        <th className="p-2 text-right">金額</th>
                                        <th className="p-2 pr-4">發放日</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-sm">
                                    {detailData.map((d, i) => {
                                        const isFuture = d.exDate > todayStr;
                                        return (
                                            <tr key={i} className={`hover:bg-gray-50 ${isFuture ? 'bg-red-50' : ''}`}>
                                                <td className="p-2 pl-4 font-bold text-gray-700">{d.yearMonth}</td>
                                                <td className="p-2 text-primary-600 font-mono"><div className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{d.exDate}</div></td>
                                                <td className="p-2 text-right font-bold text-emerald-600">{fmt(d.amount)}</td>
                                                <td className="p-2 pr-4 text-gray-500">{d.paymentDate}</td>
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
               <div className="bg-white rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl">
                   <div className="p-4 border-b flex flex-col gap-2 bg-purple-50 rounded-t-xl shrink-0">
                       <div className="flex justify-between items-center">
                           <h3 className="font-bold text-lg text-purple-900">配息公告</h3>
                           <button onClick={()=>setShowAnnoModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
                       </div>
                       
                       <div className="flex gap-1">
                           {['ALL', '季配', '月配', '債券', '其他'].map((f) => (
                               <button 
                                key={f}
                                onClick={() => setAnnoFilter(f as any)}
                                className={`
                                    px-3 py-1 rounded-full text-xs font-bold transition-colors
                                    ${annoFilter === f 
                                        ? 'bg-purple-600 text-white' 
                                        : 'bg-white text-purple-600 border border-purple-200 hover:bg-purple-100'}
                                `}
                               >
                                   {f === 'ALL' ? '全部' : f}
                               </button>
                           ))}
                       </div>
                   </div>
                   <div className="flex-1 overflow-auto p-4">
                       <table className="w-full text-sm">
                           <thead className="bg-gray-100 text-gray-600 sticky top-0">
                               <tr>
                                   <th className="p-2 text-left">日期</th>
                                   <th className="p-2 text-left">代碼/名稱</th>
                                   <th className="p-2 text-left">分類</th>
                                   <th className="p-2 text-right">金額</th>
                                   <th className="p-2 text-center">狀態</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y">
                               {getAnnouncements().length === 0 ? (
                                   <tr><td colSpan={5} className="p-8 text-center text-gray-400">目前無相關配息公告資料</td></tr>
                               ) : getAnnouncements().map((d, i) => (
                                   <tr key={i} className="hover:bg-purple-50 bg-red-50">
                                       <td className="p-2 font-mono text-purple-700">{d.exDate}</td>
                                       <td className="p-2">
                                           <div className="font-bold">{d.etfCode}</div>
                                           <div className="text-xs text-gray-500">{d.etfName}</div>
                                       </td>
                                       <td className="p-2">
                                           <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{d.category}</span>
                                       </td>
                                       <td className="p-2 text-right font-bold text-emerald-600">{fmt(d.amount)}</td>
                                       <td className="p-2 text-center text-orange-500 text-xs font-bold">{d.status}</td>
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

export default TabDividends;