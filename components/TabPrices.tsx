import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getPriceData, getBasicInfo, getHistoryData, getFillAnalysisData, getDividendData, exportToCSV } from '../services/dataService';
import { PriceData, BasicInfo, HistoryData, FillAnalysisData, DividendData } from '../types';
import { Download, Info, LineChart } from 'lucide-react';

interface TabPricesProps {
    mainFilter?: string; subFilter?: string; setMainFilter?: (val: string) => void; setSubFilter?: (val: string) => void;
}

const checkSeason = (freqStr: string | undefined, season: 'Q1'|'Q2'|'Q3') => {
    const f = String(freqStr || '').replace(/\s/g, ''); 
    if (season === 'Q1') return f.includes('季一') || f.includes('1,4');
    if (season === 'Q2') return f.includes('季二') || f.includes('2,5');
    if (season === 'Q3') return f.includes('季三') || f.includes('3,6');
    return false;
};

const TabPrices: React.FC<TabPricesProps> = ({ 
    mainFilter = '季配', subFilter = '季一', setMainFilter = (_v: string) => {}, setSubFilter = (_v: string) => {} 
}) => {
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
  const [selectedEtf, setSelectedEtf] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPriceData(), getBasicInfo()]).then(([p, b]) => {
        setPriceData(p); setBasicInfo(b);
        if (b.length > 0) setSelectedEtf(b[0].etfCode);
    });
  }, []);

  const filteredMaster = useMemo(() => {
      let result = basicInfo;
      const getStr = (val: string | undefined) => String(val || '');
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
      // Only show items that have Price Data
      return result.filter(b => priceData.some(p => p.etfCode === b.etfCode)).sort((a,b) => a.etfCode.localeCompare(b.etfCode));
  }, [basicInfo, mainFilter, subFilter, priceData]);

  // Detail Data for the selected ETF
  const detailData = useMemo(() => {
      if (!selectedEtf) return [];
      return priceData.filter(p => p.etfCode === selectedEtf).sort((a,b) => b.date.localeCompare(a.date));
  }, [selectedEtf, priceData]);

  const subOptions = mainFilter === '全部' ? ['全部', '季一', '季二', '季三', '月配', '半年', '年配', '無配'] : mainFilter === '債券' ? ['全部', '月配', '季一', '季二', '季三'] : mainFilter === '季配' ? ['全部', '季一', '季二', '季三'] : [];

  const fmt = (n: number) => n.toFixed(2);

  // Unified Button Style
  const btnClass = "flex items-center gap-1 px-3 py-1.5 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 font-bold text-sm shadow-sm transition-colors";

  return (
    <div className="h-full flex flex-col p-2 gap-2 bg-blue-50 overflow-hidden">
      
      {/* UNIFIED ACTION BAR */}
      <div className="bg-white p-2 rounded-lg shadow-sm border border-blue-200 flex items-center justify-between gap-2 flex-none">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
              <div className="flex gap-1 shrink-0">
                {['全部', '季配', '月配', '債券', '主動', '國際', '半年'].map(cat => (
                    <button key={cat} onClick={() => { setMainFilter(cat); setSubFilter('ALL'); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all border 
                            ${mainFilter === cat ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}>
                        {cat}
                    </button>
                ))}
              </div>
              {subOptions.length > 0 && (
                  <>
                    <div className="h-5 w-px bg-gray-300 mx-1"></div>
                    <div className="flex gap-1 shrink-0">
                        {subOptions.map(sub => (
                            <button key={sub} onClick={() => setSubFilter(sub === '全部' ? 'ALL' : sub)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all border 
                                    ${(subFilter === sub || (subFilter === 'ALL' && sub === '全部')) ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}>
                                {sub}
                            </button>
                        ))}
                    </div>
                  </>
              )}
          </div>
          <div className="flex items-center gap-2 shrink-0 border-l border-gray-100 pl-2">
            <button className={btnClass}><Info className="w-4 h-4" /> 近期資訊</button>
            <button className={btnClass}><Download className="w-4 h-4" /> 匯出資料</button>
          </div>
      </div>

      {/* UNIFIED CONTENT AREA */}
      <div className="flex-1 flex gap-2 overflow-hidden min-h-0">
           {/* Left: ETF List */}
           <div className="w-[280px] flex-none bg-white rounded-lg shadow-sm border border-blue-200 flex flex-col overflow-hidden">
                <div className="p-3 border-b border-blue-200 bg-blue-50 font-bold text-blue-900 text-sm">
                    符合條件 ({filteredMaster.length})
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredMaster.map(b => (
                        <div key={b.etfCode} onClick={() => setSelectedEtf(b.etfCode)} className={`p-2 rounded cursor-pointer border transition-colors ${selectedEtf === b.etfCode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-blue-50'}`}>
                            <div className="font-bold flex justify-between">
                                <span className="font-mono">{b.etfCode}</span>
                                <span className="text-xs bg-white/20 px-1 rounded">{b.dividendFreq}</span>
                            </div>
                            <div className="text-sm truncate opacity-90">{b.etfName}</div>
                        </div>
                    ))}
                </div>
           </div>

           {/* Right: Detail Table - 16px (text-base) */}
           <div className="flex-1 bg-white rounded-lg shadow-sm border border-blue-200 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto bg-white p-0">
                    <table className="w-full text-left border-collapse text-base">
                        <thead className="bg-blue-50 sticky top-0 border-b border-blue-200 font-bold text-blue-900 z-10">
                            <tr>
                                <th className="p-3 whitespace-nowrap">日期</th>
                                <th className="p-3 whitespace-nowrap text-right">開盤</th>
                                <th className="p-3 whitespace-nowrap text-right">最高</th>
                                <th className="p-3 whitespace-nowrap text-right">最低</th>
                                <th className="p-3 whitespace-nowrap text-right">收盤</th>
                                <th className="p-3 whitespace-nowrap text-right">昨收</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-50 font-bold text-gray-700">
                            {detailData.map((d, i) => (
                                <tr key={i} className="hover:bg-blue-50 transition-colors">
                                    <td className="p-3 font-mono text-gray-900">{d.date}</td>
                                    <td className="p-3 text-right font-mono text-gray-600">{fmt(d.open)}</td>
                                    <td className="p-3 text-right font-mono text-red-600">{fmt(d.high)}</td>
                                    <td className="p-3 text-right font-mono text-green-600">{fmt(d.low)}</td>
                                    <td className="p-3 text-right font-mono text-blue-800">{fmt(d.price)}</td>
                                    <td className="p-3 text-right font-mono text-gray-500">{fmt(d.prevClose)}</td>
                                </tr>
                            ))}
                            {detailData.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">請選擇左側 ETF</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
           </div>
      </div>
    </div>
  );
};

export default TabPrices;