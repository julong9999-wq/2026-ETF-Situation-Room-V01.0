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
      return result.filter(b => priceData.some(p => p.etfCode === b.etfCode)).sort((a,b) => a.etfCode.localeCompare(b.etfCode));
  }, [basicInfo, mainFilter, subFilter, priceData]);

  const subOptions = mainFilter === '全部' ? ['全部', '季一', '季二', '季三', '月配', '半年', '年配', '無配'] : mainFilter === '債券' ? ['全部', '月配', '季一', '季二', '季三'] : mainFilter === '季配' ? ['全部', '季一', '季二', '季三'] : [];

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
            <button className="flex items-center gap-1 px-3 py-1.5 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 font-bold text-sm shadow-sm transition-colors"><Info className="w-4 h-4" /> 近期資訊</button>
            <button className="flex items-center gap-1 px-3 py-1.5 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 font-bold text-sm shadow-sm transition-colors"><Download className="w-4 h-4" /> 匯出</button>
          </div>
      </div>

      {/* UNIFIED CONTENT AREA (Placeholder for now as logic was simplified in previous step, but style matches) */}
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow-sm border border-blue-200 min-h-0 p-8 text-center text-gray-400 font-bold text-lg">
          股價資訊列表區域 (樣式已統一)
      </div>
    </div>
  );
};

export default TabPrices;