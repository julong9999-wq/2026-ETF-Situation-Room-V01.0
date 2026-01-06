import React, { useState, useEffect } from 'react';
import { getBasicInfo, getSizeData, exportToCSV } from '../services/dataService';
import { BasicInfo, SizeData } from '../types';
import { Database, Download } from 'lucide-react';

const TabBasicInfo: React.FC = () => {
  const [data, setData] = useState<BasicInfo[]>([]);
  
  // Filters
  const [mainFilter, setMainFilter] = useState('全部'); 
  const [subFilter, setSubFilter] = useState('ALL'); 

  useEffect(() => {
    const fetchData = async () => {
        const basic = await getBasicInfo();
        const sizes = await getSizeData();
        const sMap = new Map<string, SizeData[]>();
        sizes.forEach(s => {
            if (!sMap.has(s.etfCode)) sMap.set(s.etfCode, []);
            sMap.get(s.etfCode)!.push(s);
        });
        sMap.forEach(arr => arr.sort((a,b) => b.date!.localeCompare(a.date!)));
        const joined = basic.map(b => {
            const sizeRecs = sMap.get(b.etfCode) || [];
            const latestSize = sizeRecs[0]?.size || 0;
            let trend = '持平';
            if (sizeRecs.length >= 2) {
                const prev = sizeRecs[1].size;
                if (latestSize > prev) trend = '成長';
                else if (latestSize < prev) trend = '衰退';
            }
            return { ...b, size: latestSize, trend };
        }).sort((a,b) => a.etfCode.localeCompare(b.etfCode)); 
        setData(joined);
    };
    fetchData();
  }, []);

  const getFilteredData = () => {
      let result = data;

      // 1. Main Filter Logic
      // Interpretation: Even though prompt said "filter by Category", 
      // "季配"/"月配" logically map to Dividend Frequency, while others map to Category/Type.
      if (mainFilter !== '全部') {
          if (mainFilter === '債券') {
              result = result.filter(d => d.category.includes('債'));
          } else if (mainFilter === '主動') {
              result = result.filter(d => d.category.includes('主動') || d.etfType.includes('主動'));
          } else if (mainFilter === '國際') {
              result = result.filter(d => d.etfType.includes('國際') || d.category.includes('國際'));
          } else if (mainFilter === '季配') {
              result = result.filter(d => d.dividendFreq.includes('季'));
          } else if (mainFilter === '月配') {
              result = result.filter(d => d.dividendFreq.includes('月'));
          }
      }

      // 2. Sub Filter Logic
      // Applies only when Main Filter is '季配' or '債券'
      if (subFilter !== 'ALL') {
          if (subFilter === '月配') {
              result = result.filter(d => d.dividendFreq.includes('月'));
          } else if (['季一', '季二', '季三'].includes(subFilter)) {
              // Check specifically for Q1/Q2/Q3 patterns
              result = result.filter(d => {
                  const freq = (d.dividendFreq || '').replace(/\s/g, ''); // Remove spaces
                  
                  // 1. Explicit tag match (e.g. "季一")
                  if (freq.includes(subFilter)) return true;

                  // 2. Month pattern match
                  // 季一: 1,4,7,10
                  if (subFilter === '季一') return /[1,01][,、][4,04][,、][7,07][,、]10/.test(freq) || freq.includes('1,4,7,10');
                  // 季二: 2,5,8,11
                  if (subFilter === '季二') return /[2,02][,、][5,05][,、][8,08][,、]11/.test(freq) || freq.includes('2,5,8,11');
                  // 季三: 3,6,9,12
                  if (subFilter === '季三') return /[3,03][,、][6,06][,、][9,09][,、]12/.test(freq) || freq.includes('3,6,9,12');
                  
                  return false;
              });
          }
      }
      return result;
  };

  const filteredData = getFilteredData();

  const handleExport = () => {
      exportToCSV('BasicInfo', ['ETF代碼', 'ETF名稱', '商品分類', '配息週期', '發行投信', 'ETF類型', '規模(億)', '規模趨勢'], 
        filteredData.map(d => ({
            ETF代碼: d.etfCode,
            ETF名稱: d.etfName,
            商品分類: d.category,
            配息週期: d.dividendFreq,
            發行投信: d.issuer,
            ETF類型: d.etfType,
            '規模(億)': d.size,
            規模趨勢: d.trend
        }))
      );
  }

  // Determine if sub-filters should be shown
  const showSubFilters = mainFilter === '季配' || mainFilter === '債券';
  
  return (
    <div className="h-full flex flex-col p-2 space-y-2">
      {/* 1. Filter Panel */}
      <div className="bg-white p-2 rounded-lg shadow-sm border border-primary-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {/* Main Buttons */}
            <div className="flex gap-1 shrink-0">
                {['全部', '季配', '月配', '債券', '主動', '國際'].map(cat => (
                    <button
                        key={cat}
                        onClick={() => { setMainFilter(cat); setSubFilter('ALL'); }}
                        className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${mainFilter === cat ? 'bg-primary-600 text-white shadow-sm' : 'bg-primary-50 text-primary-700 hover:bg-primary-100'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Sub Buttons */}
            {showSubFilters && (
                <div className="flex gap-1 p-1 bg-primary-50 rounded-md shrink-0 animate-in fade-in duration-200 border-l border-primary-200 pl-2 ml-1">
                    <button 
                        onClick={() => setSubFilter('ALL')} 
                        className={`px-2 py-0.5 rounded text-xs transition-colors ${subFilter === 'ALL' ? 'bg-white shadow text-primary-700 font-bold border border-primary-100' : 'text-primary-500 hover:text-primary-700'}`}
                    >
                        全部
                    </button>
                    
                    {/* Quarterly Sub Filters */}
                    {['季一', '季二', '季三'].map(q => (
                         <button 
                            key={q}
                            onClick={() => setSubFilter(q)} 
                            className={`px-2 py-0.5 rounded text-xs transition-colors ${subFilter === q ? 'bg-white shadow text-primary-700 font-bold border border-primary-100' : 'text-primary-500 hover:text-primary-700'}`}
                        >
                            {q}
                        </button>
                    ))}
                    
                    {/* Extra button for Bond only */}
                    {mainFilter === '債券' && (
                        <button 
                            onClick={() => setSubFilter('月配')} 
                            className={`px-2 py-0.5 rounded text-xs transition-colors ${subFilter === '月配' ? 'bg-white shadow text-primary-700 font-bold border border-primary-100' : 'text-primary-500 hover:text-primary-700'}`}
                        >
                            月配
                        </button>
                    )}
                </div>
            )}
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
            <div className="flex items-center gap-1 text-primary-400 text-xs font-medium bg-primary-50 px-2 py-1 rounded border border-primary-100">
                <Database className="w-3 h-3" />
                {filteredData.length}
            </div>
            <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-sm font-bold hover:bg-emerald-100">
                <Download className="w-4 h-4" /> <span className="hidden sm:inline">匯出</span>
            </button>
        </div>
      </div>

      {/* 2. Table */}
      <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-primary-200">
        <table className="w-full text-left border-collapse">
            <thead className="bg-primary-100 sticky top-0 z-10 shadow-sm">
                <tr>
                    <th className="p-3 font-bold text-primary-900 border-b border-primary-200 text-sm">ETF 代碼</th>
                    <th className="p-3 font-bold text-primary-900 border-b border-primary-200 text-sm">ETF 名稱</th>
                    <th className="p-3 font-bold text-primary-900 border-b border-primary-200 text-sm">商品分類</th>
                    <th className="p-3 font-bold text-primary-900 border-b border-primary-200 text-sm">配息週期</th>
                    <th className="p-3 font-bold text-primary-900 border-b border-primary-200 text-sm">發行投信</th>
                    <th className="p-3 font-bold text-primary-900 border-b border-primary-200 text-sm">ETF類型</th>
                    <th className="p-3 font-bold text-primary-900 text-right border-b border-primary-200 text-sm">規模(億)</th>
                    <th className="p-3 font-bold text-primary-900 border-b border-primary-200 text-sm">規模趨勢</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-primary-100 text-sm">
                {filteredData.length === 0 ? (
                    <tr>
                        <td colSpan={8} className="p-8 text-center text-gray-400">
                            無符合條件的資料。
                        </td>
                    </tr>
                ) : filteredData.map(row => (
                    <tr key={row.etfCode} className="hover:bg-primary-50">
                        <td className="p-3 font-mono font-bold text-primary-700">{row.etfCode}</td>
                        <td className="p-3 font-bold text-primary-800">{row.etfName}</td>
                        <td className="p-3"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700">{row.category}</span></td>
                        <td className="p-3 text-primary-600">{row.dividendFreq}</td>
                        <td className="p-3 text-primary-600">{row.issuer}</td>
                        <td className="p-3 text-primary-600">{row.etfType}</td>
                        <td className="p-3 text-right font-mono font-bold text-primary-800">{row.size?.toLocaleString()}</td>
                        <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                row.trend === '成長' ? 'bg-red-100 text-red-700' : 
                                row.trend === '衰退' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                                {row.trend}
                            </span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default TabBasicInfo;