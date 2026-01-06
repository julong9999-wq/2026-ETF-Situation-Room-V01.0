import React, { useState, useEffect } from 'react';
import { getBasicInfo, getSizeData, exportToCSV } from '../services/dataService';
import { BasicInfo, SizeData } from '../types';
import { Database, Download } from 'lucide-react';

const TabBasicInfo: React.FC = () => {
  const [data, setData] = useState<BasicInfo[]>([]);
  
  // Filters
  // Level 1: 全部, 季配, 月配, 債券, 主動, 國際
  const [mainFilter, setMainFilter] = useState('全部'); 
  // Level 2: ALL, 季一, 季二, 季三, 月配(only for Bond)
  const [subFilter, setSubFilter] = useState('ALL'); 

  useEffect(() => {
    const fetchData = async () => {
        try {
            const basic = await getBasicInfo() || [];
            const sizes = await getSizeData() || [];
            
            // Safe map creation with checks
            const sMap = new Map<string, SizeData[]>();
            if (Array.isArray(sizes)) {
                sizes.forEach(s => {
                    if (s && s.etfCode) {
                        if (!sMap.has(s.etfCode)) sMap.set(s.etfCode, []);
                        sMap.get(s.etfCode)!.push(s);
                    }
                });
            }

            sMap.forEach(arr => arr.sort((a,b) => (b.date || '').localeCompare(a.date || '')));
            
            if (Array.isArray(basic)) {
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
                }).sort((a,b) => (a.etfCode || '').localeCompare(b.etfCode || '')); 
                setData(joined);
            }
        } catch (e) {
            console.error("TabBasicInfo Data Fetch Error:", e);
            // Fallback to empty array to prevent crash
            setData([]);
        }
    };
    fetchData();
  }, []);

  // Safe check helper for Seasons - Converts input to string to prevent crashes
  const checkSeason = (freqStr: string | undefined, season: 'Q1'|'Q2'|'Q3') => {
      const f = String(freqStr || '').replace(/\s/g, ''); 
      
      if (season === 'Q1') {
          return f.includes('季一') || f.includes('1,4,7,10') || f.includes('01,04,07,10');
      }
      if (season === 'Q2') {
          return f.includes('季二') || f.includes('2,5,8,11') || f.includes('02,05,08,11');
      }
      if (season === 'Q3') {
          return f.includes('季三') || f.includes('3,6,9,12') || f.includes('03,06,09,12');
      }
      return false;
  };

  const getFilteredData = () => {
      if (!Array.isArray(data)) return [];
      
      let result = data;

      // 1. Main Filter Logic - Defensive coding with String() casting
      if (mainFilter !== '全部') {
          if (mainFilter === '債券') {
              result = result.filter(d => String(d.category || '').includes('債'));
          } else if (mainFilter === '主動') {
              result = result.filter(d => String(d.category || '').includes('主動') || String(d.etfType || '').includes('主動'));
          } else if (mainFilter === '國際') {
              result = result.filter(d => String(d.etfType || '').includes('國際') || String(d.category || '').includes('國際'));
          } else if (mainFilter === '季配') {
              result = result.filter(d => String(d.dividendFreq || '').includes('季'));
          } else if (mainFilter === '月配') {
              result = result.filter(d => String(d.dividendFreq || '').includes('月'));
          }
      }

      // 2. Sub Filter Logic
      if (subFilter !== 'ALL') {
          if (subFilter === '月配') {
               result = result.filter(d => String(d.dividendFreq || '').includes('月'));
          } else if (subFilter === '季一') {
               result = result.filter(d => checkSeason(d.dividendFreq, 'Q1'));
          } else if (subFilter === '季二') {
               result = result.filter(d => checkSeason(d.dividendFreq, 'Q2'));
          } else if (subFilter === '季三') {
               result = result.filter(d => checkSeason(d.dividendFreq, 'Q3'));
          }
      }
      return result;
  };

  const filteredData = getFilteredData();

  const handleExport = () => {
      const headers = ['ETF代碼', 'ETF名稱', '商品分類', '配息週期', '發行投信', 'ETF類型', '規模(億)', '規模趨勢'];
      const csvData = filteredData.map(d => ({
          'ETF代碼': d.etfCode || '',
          'ETF名稱': d.etfName || '',
          '商品分類': d.category || '',
          '配息週期': d.dividendFreq || '',
          '發行投信': d.issuer || '',
          'ETF類型': d.etfType || '',
          '規模(億)': d.size || 0,
          '規模趨勢': d.trend || ''
      }));
      exportToCSV('BasicInfo', headers, csvData);
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

            {/* Sub Buttons (Conditional) */}
            {showSubFilters && (
                <div className="flex gap-1 p-1 bg-primary-50 rounded-md shrink-0 animate-in fade-in duration-200 border-l border-primary-200 pl-2 ml-1">
                    <button 
                        onClick={() => setSubFilter('ALL')} 
                        className={`px-2 py-0.5 rounded text-xs transition-colors ${subFilter === 'ALL' ? 'bg-white shadow text-primary-700 font-bold border border-primary-100' : 'text-primary-500 hover:text-primary-700'}`}
                    >
                        全部
                    </button>
                    
                    {/* Quarterly Options */}
                    <button 
                        onClick={() => setSubFilter('季一')} 
                        className={`px-2 py-0.5 rounded text-xs transition-colors ${subFilter === '季一' ? 'bg-white shadow text-primary-700 font-bold border border-primary-100' : 'text-primary-500 hover:text-primary-700'}`}
                    >
                        季一
                    </button>
                    <button 
                        onClick={() => setSubFilter('季二')} 
                        className={`px-2 py-0.5 rounded text-xs transition-colors ${subFilter === '季二' ? 'bg-white shadow text-primary-700 font-bold border border-primary-100' : 'text-primary-500 hover:text-primary-700'}`}
                    >
                        季二
                    </button>
                    <button 
                        onClick={() => setSubFilter('季三')} 
                        className={`px-2 py-0.5 rounded text-xs transition-colors ${subFilter === '季三' ? 'bg-white shadow text-primary-700 font-bold border border-primary-100' : 'text-primary-500 hover:text-primary-700'}`}
                    >
                        季三
                    </button>
                    
                    {/* Bond Extra Option */}
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
                    <th className="p-3 font-bold text-primary-900 border-b border-primary-200 text-sm whitespace-nowrap">ETF 代碼</th>
                    <th className="p-3 font-bold text-primary-900 border-b border-primary-200 text-sm whitespace-nowrap">ETF 名稱</th>
                    <th className="p-3 font-bold text-primary-900 border-b border-primary-200 text-sm whitespace-nowrap">商品分類</th>
                    <th className="p-3 font-bold text-primary-900 border-b border-primary-200 text-sm whitespace-nowrap">配息週期</th>
                    <th className="p-3 font-bold text-primary-900 border-b border-primary-200 text-sm whitespace-nowrap">發行投信</th>
                    <th className="p-3 font-bold text-primary-900 border-b border-primary-200 text-sm whitespace-nowrap">ETF類型</th>
                    <th className="p-3 font-bold text-primary-900 text-right border-b border-primary-200 text-sm whitespace-nowrap">規模(億)</th>
                    <th className="p-3 font-bold text-primary-900 border-b border-primary-200 text-sm whitespace-nowrap">規模趨勢</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-primary-100 text-sm">
                {filteredData.length === 0 ? (
                    <tr>
                        <td colSpan={8} className="p-8 text-center text-gray-400">
                            無符合條件的資料。
                        </td>
                    </tr>
                ) : filteredData.map((row, index) => (
                    <tr key={row.etfCode || index} className="hover:bg-primary-50">
                        <td className="p-3 font-mono font-bold text-primary-700">{row.etfCode}</td>
                        <td className="p-3 font-bold text-primary-800">{row.etfName}</td>
                        <td className="p-3"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700 whitespace-nowrap">{row.category}</span></td>
                        <td className="p-3 text-primary-600 whitespace-nowrap">{row.dividendFreq}</td>
                        <td className="p-3 text-primary-600 whitespace-nowrap">{row.issuer}</td>
                        <td className="p-3 text-primary-600 whitespace-nowrap">{row.etfType}</td>
                        <td className="p-3 text-right font-mono font-bold text-primary-800">{row.size?.toLocaleString()}</td>
                        <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${
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