import React, { useState, useEffect, useMemo } from 'react';
import { getFillAnalysisData, getBasicInfo } from '../services/dataService';
import { FillAnalysisData, BasicInfo } from '../types';
import { Download } from 'lucide-react';

const TabFillAnalysis: React.FC<any> = ({ 
    mainFilter = '季配', subFilter = '季一', setMainFilter = (_v: string) => {}, setSubFilter = (_v: string) => {} 
}) => {
  const [subOptions, setSubOptions] = useState<string[]>([]);

  useEffect(() => {
      if (mainFilter === '全部') setSubOptions(['全部', '季一', '季二', '季三', '月配', '半年', '年配', '無配']);
      else if (mainFilter === '債券') setSubOptions(['全部', '月配', '季一', '季二', '季三']);
      else if (mainFilter === '季配') setSubOptions(['全部', '季一', '季二', '季三']);
      else setSubOptions([]);
  }, [mainFilter]);

  return (
    <div className="h-full flex flex-col p-2 gap-2 bg-blue-50 overflow-hidden">
      <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-200 flex flex-col gap-3 flex-none">
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient-right">
                {['全部', '季配', '月配', '債券', '主動', '國際', '半年'].map(cat => (
                    <button key={cat} onClick={() => { setMainFilter(cat); setSubFilter('ALL'); }}
                        className={`px-3 py-1.5 rounded-lg text-base font-bold whitespace-nowrap transition-all border shrink-0 ${mainFilter === cat ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 hover:text-blue-700'}`}>
                        {cat}
                    </button>
                ))}
                {subOptions.length > 0 && <div className="h-6 w-px bg-gray-300 shrink-0 mx-1"></div>}
                {subOptions.map(sub => (
                      <button key={sub} onClick={() => setSubFilter(sub === '全部' ? 'ALL' : sub)} className={`px-3 py-1.5 rounded-lg text-base whitespace-nowrap transition-colors font-bold border shrink-0 ${(subFilter === sub || (subFilter === 'ALL' && sub === '全部')) ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 hover:text-blue-700'}`}>{sub}</button>
                  ))}
              </div>
              <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-gray-100">
                <button className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-bold text-base whitespace-nowrap shadow-sm"><Download className="w-4 h-4" /> 匯出表單</button>
              </div>
          </div>
      </div>
       <div className="flex-1 flex gap-2 overflow-hidden min-h-0"><div className="flex-1 bg-white p-4 text-gray-400 text-center">填息分析內容區</div></div>
    </div>
  );
};

export default TabFillAnalysis;