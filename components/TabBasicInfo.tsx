import React, { useState, useEffect, useMemo } from 'react';
import { getBasicInfo, getSizeData, exportToCSV } from '../services/dataService';
import { BasicInfo, SizeData } from '../types';

interface TabBasicInfoProps {
    mainFilter?: string;
    subFilter?: string;
    setMainFilter?: (val: string) => void;
    setSubFilter?: (val: string) => void;
}

const checkSeason = (freqStr: string | undefined, season: 'Q1'|'Q2'|'Q3') => {
    const f = String(freqStr || '').replace(/\s/g, ''); 
    if (season === 'Q1') return f.includes('季一') || f.includes('1,4') || (f.includes('1') && f.includes('4'));
    if (season === 'Q2') return f.includes('季二') || f.includes('2,5') || (f.includes('2') && f.includes('5'));
    if (season === 'Q3') return f.includes('季三') || f.includes('3,6') || (f.includes('3') && f.includes('6'));
    return false;
};

const getSmartCategoryClass = (d: BasicInfo) => {
    const cat = (d.category || '').trim();
    const freq = (d.dividendFreq || '').trim();
    if (cat.includes('債')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (cat.includes('主動')) return 'bg-rose-100 text-rose-800 border-rose-200';
    if (cat.includes('國際') || cat.includes('國外')) return 'bg-sky-100 text-sky-800 border-sky-200';
    if (freq.includes('月')) return 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200';
    if (freq.includes('季')) return 'bg-teal-100 text-teal-800 border-teal-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
};

const TabBasicInfo: React.FC<TabBasicInfoProps> = ({ 
    mainFilter = '季配', 
    subFilter = '季一', 
    setMainFilter = (_v: string) => {}, 
    setSubFilter = (_v: string) => {} 
}) => {
  const [data, setData] = useState<BasicInfo[]>([]);
  const [loading, setLoading] = useState(true);
  
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
        } catch(e) { console.error(e); setData([]); } finally { setLoading(false); }
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

  const getSubFilterOptions = () => {
      if (mainFilter === '全部') return ['全部', '季一', '季二', '季三', '月配', '半年', '年配', '無配'];
      if (mainFilter === '債券') return ['全部', '月配', '季一', '季二', '季三'];
      if (mainFilter === '季配') return ['全部', '季一', '季二', '季三'];
      return [];
  };
  const subOptions = getSubFilterOptions();

  return (
    <div className="h-full flex flex-col p-2 gap-2 relative overflow-hidden">
      <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-200 flex items-center justify-between gap-2 flex-none overflow-hidden">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient-right flex-1">
            {['全部', '季配', '月配', '債券', '主動', '國際', '半年'].map(cat => (
                <button key={cat} onClick={() => { setMainFilter(cat); setSubFilter('ALL'); }}
                    className={`px-3 py-1.5 rounded-lg text-base font-bold whitespace-nowrap transition-all border shrink-0
                        ${mainFilter === cat ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 hover:text-blue-700'}`}>
                    {cat}
                </button>
            ))}
            {subOptions.length > 0 && (<><div className="h-6 w-px bg-gray-300 shrink-0 mx-1"></div>
            {subOptions.map(sub => (
                <button key={sub} onClick={() => setSubFilter(sub === '全部' ? 'ALL' : sub)} 
                    className={`px-3 py-1.5 rounded-lg text-base whitespace-nowrap transition-colors font-bold border shrink-0
                        ${(subFilter === sub || (subFilter === 'ALL' && sub === '全部')) 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                            : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 hover:text-blue-700'}`}>
                    {sub}
                </button>
            ))}</>)}
        </div>
        <div className="flex items-center gap-2 shrink-0 border-l border-gray-100 pl-2">
            <div className="flex items-center gap-2 text-blue-600 text-base font-bold bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 whitespace-nowrap"><span>Count:</span>{filteredData.length}</div>
            <button onClick={handleExport} className="flex items-center justify-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-bold text-base whitespace-nowrap shadow-sm">匯出表單</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow-sm border border-blue-200 min-h-0">
        <table className="w-full text-left border-collapse">
            <thead className="bg-blue-50 sticky top-0 z-10 shadow-sm border-b border-blue-200">
                <tr>
                    <th className="p-2.5 font-bold text-blue-900 text-base">ETF 代碼</th><th className="p-2.5 font-bold text-blue-900 text-base">ETF 名稱</th><th className="p-2.5 font-bold text-blue-900 text-base">商品分類</th><th className="p-2.5 font-bold text-blue-900 text-base">配息週期</th><th className="p-2.5 font-bold text-blue-900 text-base">發行投信</th><th className="p-2.5 font-bold text-blue-900 text-base">ETF類型</th><th className="p-2.5 font-bold text-blue-900 text-right text-base">規模(億)</th><th className="p-2.5 font-bold text-blue-900 text-base">規模趨勢</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-base font-bold">
                {filteredData.map((row, index) => (
                    <tr key={index} className="hover:bg-blue-50 transition-colors">
                        <td className="p-2.5 font-mono font-bold text-blue-800">{row.etfCode}</td><td className="p-2.5 font-bold text-gray-800">{row.etfName}</td><td className="p-2.5"><span className={`px-2 py-0.5 rounded text-sm font-bold whitespace-nowrap border ${getSmartCategoryClass(row)}`}>{row.category}</span></td><td className="p-2.5"><span className="px-2 py-0.5 rounded text-sm font-bold whitespace-nowrap bg-gray-100 text-gray-600 border border-gray-200">{row.dividendFreq}</span></td><td className="p-2.5 text-gray-700">{row.issuer}</td><td className="p-2.5 text-gray-700">{row.etfType}</td><td className="p-2.5 text-right font-mono font-bold text-blue-900">{row.size > 0 ? row.size.toLocaleString() : '-'}</td><td className="p-2.5"><span className={`px-2 py-0.5 rounded text-sm font-bold whitespace-nowrap ${row.trend === '成長' ? 'bg-red-100 text-red-700' : row.trend === '衰退' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{row.trend}</span></td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default TabBasicInfo;