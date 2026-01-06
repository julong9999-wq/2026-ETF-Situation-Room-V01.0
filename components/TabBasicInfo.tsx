import React, { useState, useEffect, useMemo } from 'react';
import { getBasicInfo, getSizeData, exportToCSV } from '../services/dataService';
import { BasicInfo, SizeData } from '../types';

// Helper: Check seasonality logic (1,4,7,10 vs 2,5,8,11 etc)
const checkSeason = (freqStr: string | undefined, season: 'Q1'|'Q2'|'Q3') => {
    const f = String(freqStr || '').replace(/\s/g, ''); 
    // Q1: 1, 4, 7, 10
    if (season === 'Q1') return f.includes('季一') || f.includes('1,4,7,10') || f.includes('01,04,07,10') || (f.includes('1') && f.includes('4'));
    // Q2: 2, 5, 8, 11
    if (season === 'Q2') return f.includes('季二') || f.includes('2,5,8,11') || f.includes('02,05,08,11') || (f.includes('2') && f.includes('5'));
    // Q3: 3, 6, 9, 12
    if (season === 'Q3') return f.includes('季三') || f.includes('3,6,9,12') || f.includes('03,06,09,12') || (f.includes('3') && f.includes('6'));
    return false;
};

const TabBasicInfo: React.FC = () => {
  const [data, setData] = useState<BasicInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  // Level 1: [全部, 季配, 月配, 債券, 主動, 國際]
  const [mainFilter, setMainFilter] = useState('全部'); 
  // Level 2: Sub filters dependent on Level 1
  const [subFilter, setSubFilter] = useState('ALL'); 

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
        try {
            const basic = await getBasicInfo();
            const sizes = await getSizeData();
            
            if (!mounted) return;

            // Prepare Size Map
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
            
            const baseList = Array.isArray(basic) ? basic : [];
            const joined: BasicInfo[] = [];
            
            for (const b of baseList) {
                // Defensive check to ensure we have a valid object
                if (!b || typeof b !== 'object' || !b.etfCode) continue;

                const sizeRecs = sMap.get(b.etfCode) || [];
                const latestSize = sizeRecs[0]?.size || 0;
                let trend = '持平';
                
                if (sizeRecs.length >= 2) {
                    const prev = sizeRecs[1].size || 0;
                    if (latestSize > prev) trend = '成長';
                    else if (latestSize < prev) trend = '衰退';
                }
                
                joined.push({ ...b, size: latestSize, trend });
            }

            // Sort by Code
            joined.sort((a,b) => String(a.etfCode || '').localeCompare(String(b.etfCode || '')));
            setData(joined);
            setError(null);
        } catch (e: any) {
            console.error("TabBasicInfo Fetch Error:", e);
            setError(e.message || "資料載入失敗");
            setData([]);
        } finally {
            if (mounted) setLoading(false);
        }
    };
    fetchData();
    return () => { mounted = false; };
  }, []);

  const filteredData = useMemo(() => {
      if (!Array.isArray(data)) return [];
      
      try {
        let result = data;
        const getStr = (val: string | undefined) => String(val || '');

        // --- 第一層過濾 (Level 1) ---
        if (mainFilter !== '全部') {
            
            if (mainFilter === '債券') {
                // 規則：只要分類含「債」，全部進來。不分頻率。
                result = result.filter(d => getStr(d.category).includes('債'));

            } else if (mainFilter === '季配') {
                // 規則：頻率含「季」 且 分類【絕對不能】含「債」
                result = result.filter(d => 
                    getStr(d.dividendFreq).includes('季') && 
                    !getStr(d.category).includes('債')
                );

            } else if (mainFilter === '月配') {
                // 規則：頻率含「月」 且 分類【絕對不能】含「債」
                // 修正：嚴格排除「主動」 (Exclude Active ETFs like 00985A)
                // Also check ETF Name and Type for "主動"
                result = result.filter(d => 
                    getStr(d.dividendFreq).includes('月') && 
                    !getStr(d.category).includes('債') &&
                    !getStr(d.category).includes('主動') && 
                    !getStr(d.etfType).includes('主動') &&
                    !getStr(d.etfName).includes('主動')
                );

            } else if (mainFilter === '主動') {
                result = result.filter(d => getStr(d.category).includes('主動') || getStr(d.etfType).includes('主動') || getStr(d.etfName).includes('主動'));

            } else if (mainFilter === '國際') {
                result = result.filter(d => getStr(d.category).includes('國際') || getStr(d.etfType).includes('國際') || getStr(d.marketType).includes('國外'));
            }
        }

        // --- 第二層過濾 (Level 2) ---
        if (subFilter !== 'ALL') {
            const freqStr = (d: BasicInfo) => String(d.dividendFreq || '');

            if (mainFilter === '季配') {
                // 只有在選「季配」時，才有季1/2/3的區別
                if (subFilter === '季一') result = result.filter(d => checkSeason(freqStr(d), 'Q1'));
                if (subFilter === '季二') result = result.filter(d => checkSeason(freqStr(d), 'Q2'));
                if (subFilter === '季三') result = result.filter(d => checkSeason(freqStr(d), 'Q3'));
            } 
            else if (mainFilter === '債券') {
                // 在「債券」池中，再濾出月配或季配
                if (subFilter === '月配') result = result.filter(d => freqStr(d).includes('月'));
                if (subFilter === '季配') result = result.filter(d => freqStr(d).includes('季'));
            }
        }
        return result;
      } catch (e) {
        console.error("Filter Error:", e);
        return [];
      }
  }, [data, mainFilter, subFilter]);

  const handleExport = () => {
      try {
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
      } catch (e) {
          alert("匯出失敗");
      }
  }

  // UI Helper: Determine which sub-filters to show
  const getSubFilterOptions = () => {
      if (mainFilter === '季配') return ['全部', '季一', '季二', '季三'];
      if (mainFilter === '債券') return ['全部', '月配', '季配']; // Allow filtering bond frequency
      return [];
  };

  const subOptions = getSubFilterOptions();
  const showSubFilters = subOptions.length > 0;

  // Manual Reset Handler
  const handleForceReset = () => {
      if(confirm('確定要清除所有資料嗎？您需要重新匯入 CSV。')) {
          localStorage.clear();
          window.location.reload();
      }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">資料載入中...</div>;

  if (error || (data.length === 0 && !loading)) {
      return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center bg-gray-50 rounded-xl border border-gray-200 m-4">
        <div className="text-6xl mb-4">📂</div>
        <h3 className="text-xl font-bold text-gray-700 mb-2">無資料或資料讀取異常</h3>
        <p className="text-gray-500 mb-6 text-sm">請前往「資料維護」匯入 CSV，或點擊下方按鈕重置系統。</p>
        <button 
            onClick={handleForceReset}
            className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg font-bold flex items-center gap-2"
        >
            ⚠️ 清除所有資料並重置
        </button>
      </div>
  );
  }

  return (
    <div className="h-full flex flex-col p-2 space-y-2">
      {/* Filter Panel */}
      <div className="bg-white p-2 rounded-lg shadow-sm border border-primary-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            
            {/* Level 1: Main Buttons (商品分類層級) */}
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
                        {/* 修正：回復原始顯示名稱，不加 (股) */}
                        {cat}
                    </button>
                ))}
            </div>

            {/* Level 2: Sub Buttons (細節層級) */}
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

        {/* Count & Export */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
            <div className="flex items-center gap-1 text-primary-400 text-xs font-medium bg-primary-50 px-2 py-1 rounded border border-primary-100">
                <span className="font-bold">Count:</span>
                {filteredData.length}
            </div>
            <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-sm font-bold hover:bg-emerald-100 whitespace-nowrap">
                <span>↓ 匯出</span>
            </button>
        </div>
      </div>

      {/* Table */}
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
                    <tr key={String(row?.etfCode) || `row-${index}`} className="hover:bg-primary-50">
                        <td className="p-3 font-mono font-bold text-primary-700">{row?.etfCode || '-'}</td>
                        <td className="p-3 font-bold text-primary-800">{row?.etfName || '-'}</td>
                        <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${
                                String(row?.category || '').includes('債') ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                            }`}>
                                {row?.category || '-'}
                            </span>
                        </td>
                        <td className="p-3 text-primary-600 whitespace-nowrap">{row?.dividendFreq || '-'}</td>
                        <td className="p-3 text-primary-600 whitespace-nowrap">{row?.issuer || '-'}</td>
                        <td className="p-3 text-primary-600 whitespace-nowrap">{row?.etfType || '-'}</td>
                        <td className="p-3 text-right font-mono font-bold text-primary-800">{typeof row?.size === 'number' ? row.size.toLocaleString() : '0'}</td>
                        <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${
                                row?.trend === '成長' ? 'bg-red-100 text-red-700' : 
                                row?.trend === '衰退' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                                {row?.trend || '-'}
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