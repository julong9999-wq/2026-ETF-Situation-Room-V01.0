import React, { useState, useEffect } from 'react';
import { Download, Megaphone } from 'lucide-react';

const TabDividends: React.FC<any> = ({ 
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
             <button className="flex items-center gap-1 px-3 py-1.5 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 font-bold text-sm shadow-sm transition-colors"><Megaphone className="w-4 h-4" /> 配息公告</button>
             <button className="flex items-center gap-1 px-3 py-1.5 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 font-bold text-sm shadow-sm transition-colors"><Download className="w-4 h-4" /> 匯出</button>
          </div>
      </div>

      {/* UNIFIED CONTENT AREA */}
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow-sm border border-blue-200 min-h-0 p-8 text-center text-gray-400 font-bold text-lg">
          除息資訊列表區域 (樣式已統一)
      </div>
    </div>
  );
};

export default TabDividends;