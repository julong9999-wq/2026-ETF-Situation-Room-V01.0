import React, { useState, useEffect } from 'react';
import { getFillAnalysisData, getBasicInfo, exportToCSV } from '../services/dataService';
import { FillAnalysisData, BasicInfo } from '../types';
import { Download, CheckCircle, Clock, Database } from 'lucide-react';

const TabFillAnalysis: React.FC = () => {
  const [data, setData] = useState<FillAnalysisData[]>([]);
  const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);

  // Filters
  const [catFilter, setCatFilter] = useState('ALL');
  const [freqFilter, setFreqFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  
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
      const basicMap = new Map<string, BasicInfo>();
      basicInfo.forEach(b => basicMap.set(b.etfCode, b));
      return data.filter(d => {
          const info = basicMap.get(d.etfCode);
          if (!info) return false;
          if (catFilter !== 'ALL' && info.category !== catFilter) return false;
          if (freqFilter !== 'ALL' && info.dividendFreq !== freqFilter) return false;
          if (typeFilter !== 'ALL' && info.etfType !== typeFilter) return false;
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
  const categories = ['ALL', ...Array.from(new Set(basicInfo.map(b => b.category).filter(Boolean)))];
  const freqs = ['ALL', ...Array.from(new Set(basicInfo.map(b => b.dividendFreq).filter(Boolean)))];
  const types = ['ALL', ...Array.from(new Set(basicInfo.map(b => b.etfType).filter(Boolean)))];
  const fmt = (num: number) => num ? num.toFixed(2) : '0.00';

  return (
    <div className="h-full flex flex-col p-2 gap-2 bg-primary-50">
       {/* Controls - Compact */}
       <div className="bg-white p-2 rounded-lg shadow-sm border border-primary-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
               <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="border rounded px-2 py-1.5 text-xs bg-gray-50 outline-none"><option value="ALL">分類:全部</option>{categories.filter(x=>x!=='ALL').map(x=><option key={x} value={x}>{x}</option>)}</select>
               <select value={freqFilter} onChange={e=>setFreqFilter(e.target.value)} className="border rounded px-2 py-1.5 text-xs bg-gray-50 outline-none"><option value="ALL">週期:全部</option>{freqs.filter(x=>x!=='ALL').map(x=><option key={x} value={x}>{x}</option>)}</select>
               <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="border rounded px-2 py-1.5 text-xs bg-gray-50 outline-none"><option value="ALL">類型:全部</option>{types.filter(x=>x!=='ALL').map(x=><option key={x} value={x}>{x}</option>)}</select>
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