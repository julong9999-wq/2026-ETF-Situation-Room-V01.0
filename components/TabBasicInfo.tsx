import React, { useState, useEffect, useMemo } from 'react';
import { getBasicInfo, getSizeData, exportToCSV } from '../services/dataService';
import { BasicInfo, SizeData } from '../types';
import { Download } from 'lucide-react';

interface TabBasicInfoProps {
    mainFilter?: string; subFilter?: string; setMainFilter?: (val: string) => void; setSubFilter?: (val: string) => void;
}

const checkSeason = (freqStr: string | undefined, season: 'Q1'|'Q2'|'Q3') => {
    const f = String(freqStr || '').replace(/\s/g, ''); 
    if (season === 'Q1') return f.includes('季一') || f.includes('1,4');
    if (season === 'Q2') return f.includes('季二') || f.includes('2,5');
    if (season === 'Q3') return f.includes('季三') || f.includes('3,6');
    return false;
};

const TabBasicInfo: React.FC<TabBasicInfoProps> = ({ 
    mainFilter = '季配', subFilter = '季一', setMainFilter = (_v: string) => {}, setSubFilter = (_v: string) => {} 
}) => {
  const [data, setData] = useState<BasicInfo[]>([]);
  
  useEffect(() => {
    const fetchData = async () => {
        try {
            const basic = await getBasicInfo();
            const sizes = await getSizeData();
            const sMap = new Map<string, SizeData[]>();
            sizes.forEach(s => { if(s.etfCode) { const c = s.etfCode.trim(); if(!sMap.has(c)) sMap.set(c,[]); sMap.get(c)!.push(s); }});
            const joined = basic.map(b => {
                const code = b.etfCode.trim();
                const sizeRecs = sMap.get(code) || [];
                sizeRecs.sort((x,y) => (y.date||'').localeCompare(x.date||''));
                const latestSize = sizeRecs.length > 0 ? sizeRecs[0].size : 0;
                let trend = '持平';
                if(sizeRecs.length>=2) { const curr = sizeRecs[0].size; const prev = sizeRecs[1].size; if(curr>prev) trend='成長'; else if(curr<prev) trend='衰退'; }
                return { ...b, size: latestSize, trend };
            }).sort((a,b) => a.etfCode.localeCompare(b.etfCode));
            setData(joined);
        } catch(e) { console.error(e); }
    };
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
      let result = data;
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
          else if (subFilter === '無配') result = result.filter(d => freqStr(d).includes('不') || freqStr(d) === '' || freqStr(d).includes('無'));
      }
      return result;
  }, [data, mainFilter, subFilter]);

  const handleExport = () => {
      const headers = ['ETF代碼', 'ETF名稱', '商品分類', '配息週期', '發行投信', 'ETF類型', '規模(億)', '規模趨勢'];
      const csvData = filteredData.map(d => ({ 'ETF代碼': d.etfCode, 'ETF名稱': d.etfName, '商品分類': d.category, '配息週期': d.dividendFreq, '發行投信': d.issuer, 'ETF類型': d.etfType, '規模(億)': d.size, '規模趨勢': d.trend }));
      exportToCSV('BasicInfo', headers, csvData);
  }

  const subOptions = mainFilter === '全部' ? ['全部', '季一', '季二', '季三', '月配', '半年', '年配', '無配'] : mainFilter === '債券' ? ['全部', '月配', '季一', '季二', '季三'] : mainFilter === '季配' ? ['全部', '季一', '季二', '季三'] : [];

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
            <span className="text-blue-900 text-sm font-bold bg-blue-50 px-2 py-1 rounded border border-blue-100">筆數: {filteredData.length}</span>
            <button onClick={handleExport} className={btnClass}><Download className="w-4 h-4" /> 匯出資料</button>
        </div>
      </div>

      {/* UNIFIED TABLE STYLE - 16px (text-base) */}
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow-sm border border-blue-200 min-h-0">
        <table className="w-full text-left border-collapse text-base">
            <thead className="bg-blue-50 sticky top-0 z-10 border-b border-blue-200 font-bold text-blue-900">
                <tr>
                    <th className="p-3">ETF 代碼</th><th className="p-3">ETF 名稱</th><th className="p-3">商品分類</th><th className="p-3">配息週期</th><th className="p-3">發行投信</th><th className="p-3">ETF類型</th><th className="p-3 text-right">規模(億)</th><th className="p-3">規模趨勢</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-blue-50 font-bold text-gray-700">
                {filteredData.map((row, index) => (
                    <tr key={index} className="hover:bg-blue-50 transition-colors">
                        <td className="p-3 text-blue-800 font-mono">{row.etfCode}</td><td className="p-3 text-gray-900">{row.etfName}</td><td className="p-3 text-gray-600">{row.category}</td><td className="p-3 text-gray-600">{row.dividendFreq}</td><td className="p-3 text-gray-600">{row.issuer}</td><td className="p-3 text-gray-600">{row.etfType}</td><td className="p-3 text-right font-mono text-blue-900">{row.size > 0 ? row.size.toLocaleString() : '-'}</td><td className={`p-3 ${row.trend === '成長' ? 'text-red-600' : row.trend === '衰退' ? 'text-green-600' : 'text-gray-400'}`}>{row.trend}</td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default TabBasicInfo;