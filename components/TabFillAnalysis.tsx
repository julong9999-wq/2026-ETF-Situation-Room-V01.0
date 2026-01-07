import React, { useState, useEffect } from 'react';
import { getFillAnalysisData, getBasicInfo, exportToCSV } from '../services/dataService';
import { FillAnalysisData, BasicInfo } from '../types';
import { Download, CheckCircle, Clock, Database } from 'lucide-react';

interface TabFillAnalysisProps {
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

const TabFillAnalysis: React.FC<TabFillAnalysisProps> = ({ 
    mainFilter = '全部', 
    subFilter = 'ALL', 
    setMainFilter = (_v: string) => {}, 
    setSubFilter = (_v: string) => {} 
}) => {
  const [data, setData] = useState<FillAnalysisData[]>([]);
  const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);

  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    Promise.all([getFillAnalysisData(), getBasicInfo()]).then(([f, b]) => {
        setData(f);
        setBasicInfo(b);
        setEndDate(new Date().toISOString().split('T')[0]);
    });
  }, []);

  const getFilteredData = () => {
      // 1. Create a set of valid codes based on the linked filter
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

      const validCodes = new Set(result.map(r => r.etfCode));

      return data.filter(d => {
          if (!validCodes.has(d.etfCode)) return false;
          const ex = d.exDate.replace(/\//g, '-');
          if (startDate && ex < startDate) return false;
          if (endDate && ex > endDate) return false;
          return true;
      });
  };
  const filteredData = getFilteredData();

  const handleExport = () => {
      // Headers matching the table display order exactly
      const headers = ['代碼', '名稱', '所屬年月', '除息日期', '配息金額', '除息前一日', '除息參考價', '填息狀態', '幾天填息'];
      
      const csvData = filteredData.map(d => ({
          '代碼': d.etfCode,
          '名稱': d.etfName,
          '所屬年月': d.yearMonth,
          '除息日期': d.exDate,
          '配息金額': d.amount,
          '除息前一日': d.pricePreEx,
          '除息參考價': d.priceReference,
          '填息狀態': d.isFilled ? '成功' : '未填息',
          '幾天填息': d.daysToFill
      }));

      exportToCSV('FillAnalysis', headers, csvData);
  };

  const filledCount = filteredData.filter(d => d.isFilled).length;
  const getSubFilterOptions = () => {
      if (mainFilter === '全部') return ['全部', '季一', '季二', '季三', '月配', '半年', '年配', '無配'];
      if (mainFilter === '債券') return ['全部', '月配', '季一', '季二', '季三'];
      if (mainFilter === '季配') return ['全部', '季一', '季二', '季三'];
      return [];
  };

  const subOptions = getSubFilterOptions();
  const showSubFilters = subOptions.length > 0;
  const fmt = (num: number) => num ? num.toFixed(2) : '0.00';

  return (
    <div className="h-full flex flex-col p-2 gap-2 bg-primary-50">
       {/* Controls - Copied from Basic Info */}
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

              <div className="flex items-center px-2 py-1 bg-orange-50 rounded border border-orange-100 whitespace-nowrap">
                <span className="text-xs text-orange-600 font-bold">成功: {filledCount}</span>
                <span className="text-xs text-gray-500 ml-1">/ {filteredData.length}</span>
              </div>

              <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 font-bold text-sm">
                <Download className="w-4 h-4" /> <span className="hidden sm:inline">匯出</span>
              </button>
          </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-primary-200">
          <table className="w-full text-left">
              <thead className="bg-orange-50 sticky top-0 border-b border-orange-100 text-sm">
                  <tr>
                      <th className="p-3 text-orange-900">代碼</th>
                      <th className="p-3 text-orange-900">名稱</th>
                      <th className="p-3 text-orange-900">所屬年月</th>
                      <th className="p-3 text-orange-900">除息日期</th>
                      <th className="p-3 text-orange-900 text-right">配息金額</th>
                      <th className="p-3 text-orange-900 text-right">除息前一日</th>
                      <th className="p-3 text-orange-900 text-right">除息參考價</th>
                      <th className="p-3 text-orange-900 text-center">填息狀態</th>
                      <th className="p-3 text-orange-900 text-center">幾天填息</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-orange-50/30">
                          <td className="p-3 font-bold font-mono text-gray-800">{row.etfCode}</td>
                          <td className="p-3 text-sm text-gray-600">{row.etfName}</td>
                          <td className="p-3 text-sm">{row.yearMonth}</td>
                          <td className="p-3 font-mono">{row.exDate}</td>
                          <td className="p-3 font-mono text-right font-bold text-gray-800">{fmt(row.amount)}</td>
                          <td className="p-3 font-mono text-right text-gray-500">{row.pricePreEx > 0 ? fmt(row.pricePreEx) : '-'}</td>
                          <td className="p-3 font-mono text-right text-gray-500">{row.priceReference > 0 ? fmt(row.priceReference) : '-'}</td>
                          <td className="p-3 text-center">
                              {row.isFilled ? (
                                  <span className="inline-flex items-center gap-1 text-green-600 font-bold text-sm"><CheckCircle className="w-4 h-4"/> 成功</span>
                              ) : (
                                  <span className="text-gray-400 text-sm">未填息</span>
                              )}
                          </td>
                          <td className="p-3 text-center font-mono">
                              {row.isFilled ? (
                                  <span className="text-green-600 font-bold">{row.daysToFill}天</span>
                              ) : (
                                  <span className="inline-flex items-center gap-1 text-gray-400 text-xs"><Clock className="w-3 h-3"/> {row.daysToFill}</span>
                              )}
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>

    </div>
  );
};

export default TabFillAnalysis;