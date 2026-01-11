import React, { useState, useEffect, useMemo } from 'react';
import { getFillAnalysisData, getBasicInfo } from '../services/dataService';
import { FillAnalysisData, BasicInfo } from '../types';
import { Download } from 'lucide-react';

const TabFillAnalysis: React.FC<any> = ({ 
    mainFilter = '季配', subFilter = '季一', setMainFilter = (_v: string) => {}, setSubFilter = (_v: string) => {} 
}) => {
  const [fillData, setFillData] = useState<FillAnalysisData[]>([]);
  const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
  const [subOptions, setSubOptions] = useState<string[]>([]);

  useEffect(() => {
      Promise.all([getFillAnalysisData(), getBasicInfo()]).then(([f, b]) => {
          setFillData(f); setBasicInfo(b);
      });
  }, []);

  useEffect(() => {
      if (mainFilter === '全部') setSubOptions(['全部', '季一', '季二', '季三', '月配', '半年', '年配', '無配']);
      else if (mainFilter === '債券') setSubOptions(['全部', '月配', '季一', '季二', '季三']);
      else if (mainFilter === '季配') setSubOptions(['全部', '季一', '季二', '季三']);
      else setSubOptions([]);
  }, [mainFilter]);

  const filteredData = useMemo(() => {
      const getStr = (val: string | undefined) => String(val || '');
      const checkSeason = (freqStr: string | undefined, season: 'Q1'|'Q2'|'Q3') => {
        const f = String(freqStr || '').replace(/\s/g, ''); 
        if (season === 'Q1') return f.includes('季一') || f.includes('1,4');
        if (season === 'Q2') return f.includes('季二') || f.includes('2,5');
        if (season === 'Q3') return f.includes('季三') || f.includes('3,6');
        return false;
      };

      // Filter Basic Info
      let targets = basicInfo;
      if (mainFilter !== '全部') {
        if (mainFilter === '債券') targets = targets.filter(d => getStr(d.category).includes('債')); 
        else if (mainFilter === '季配') targets = targets.filter(d => getStr(d.dividendFreq).includes('季') && !getStr(d.category).includes('債'));
        else if (mainFilter === '月配') targets = targets.filter(d => getStr(d.dividendFreq).includes('月') && !getStr(d.category).includes('債') && !getStr(d.category).includes('主動'));
        else if (mainFilter === '主動') targets = targets.filter(d => getStr(d.category).includes('主動'));
        else if (mainFilter === '國際') targets = targets.filter(d => getStr(d.category).includes('國際') || getStr(d.category).includes('國外') || getStr(d.marketType).includes('國外'));
        else if (mainFilter === '半年') targets = targets.filter(d => (getStr(d.category).includes('半年') || getStr(d.dividendFreq).includes('半年')) && !getStr(d.category).includes('國際') && !getStr(d.category).includes('國外') && !getStr(d.marketType).includes('國外'));
      }

      if (subFilter !== 'ALL') {
         const freqStr = (d: BasicInfo) => String(d.dividendFreq || '');
         if (subFilter === '季一') targets = targets.filter(d => checkSeason(freqStr(d), 'Q1'));
         else if (subFilter === '季二') targets = targets.filter(d => checkSeason(freqStr(d), 'Q2'));
         else if (subFilter === '季三') targets = targets.filter(d => checkSeason(freqStr(d), 'Q3'));
         else if (subFilter === '月配') targets = targets.filter(d => freqStr(d).includes('月'));
         else if (subFilter === '半年') targets = targets.filter(d => freqStr(d).includes('半年'));
         else if (subFilter === '年配') targets = targets.filter(d => freqStr(d).includes('年') && !freqStr(d).includes('半年'));
         else if (subFilter === '無配') targets = targets.filter(d => freqStr(d).includes('不'));
      }

      const validCodes = new Set(targets.map(t => t.etfCode));
      return fillData.filter(d => validCodes.has(d.etfCode)).sort((a,b) => b.exDate.localeCompare(a.exDate));
  }, [fillData, basicInfo, mainFilter, subFilter]);

  const fmt = (n: number | string) => {
      if (typeof n === 'string') return n;
      return n ? n.toFixed(2) : '-';
  };

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
            <button className={btnClass}><Download className="w-4 h-4" /> 匯出資料</button>
          </div>
      </div>

      {/* UNIFIED CONTENT AREA */}
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow-sm border border-blue-200 min-h-0">
         <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-blue-50 sticky top-0 z-10 border-b border-blue-200 font-bold text-blue-900">
                <tr>
                    <th className="p-3">ETF代碼</th>
                    <th className="p-3">ETF名稱</th>
                    <th className="p-3">除息日期</th>
                    <th className="p-3 text-right">除息金額</th>
                    <th className="p-3 text-right">除息前股價</th>
                    <th className="p-3 text-right">參考價</th>
                    <th className="p-3 text-center">填息日期</th>
                    <th className="p-3 text-right">填息價</th>
                    <th className="p-3 text-center">狀態</th>
                    <th className="p-3 text-right">天數</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-blue-50 font-bold text-gray-700">
                {filteredData.map((d, i) => (
                    <tr key={i} className="hover:bg-blue-50 transition-colors">
                        <td className="p-3 font-mono text-blue-800">{d.etfCode}</td>
                        <td className="p-3 text-gray-900">{d.etfName}</td>
                        <td className="p-3 font-mono text-gray-600">{d.exDate}</td>
                        <td className="p-3 text-right font-mono text-emerald-600">{fmt(d.amount)}</td>
                        <td className="p-3 text-right font-mono text-gray-500">{fmt(d.pricePreEx)}</td>
                        <td className="p-3 text-right font-mono text-gray-500">{fmt(d.priceReference)}</td>
                        <td className="p-3 text-center font-mono text-gray-800">{d.fillDate || '-'}</td>
                        <td className="p-3 text-right font-mono text-gray-800">{fmt(d.fillPrice)}</td>
                        <td className={`p-3 text-center ${d.isFilled ? 'text-green-600 font-bold' : 'text-gray-400'}`}>{d.isFilled ? '已填息' : '未填息'}</td>
                        <td className="p-3 text-right font-mono text-gray-600">{d.daysToFill}</td>
                    </tr>
                ))}
                {filteredData.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-gray-400">無符合條件的填息資料</td></tr>}
            </tbody>
         </table>
      </div>
    </div>
  );
};

export default TabFillAnalysis;