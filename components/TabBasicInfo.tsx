import React, { useState, useEffect, useMemo } from 'react';
import { getBasicInfo, getSizeData, exportToCSV } from '../services/dataService';
import { BasicInfo, SizeData } from '../types';

interface TabBasicInfoProps {
    mainFilter?: string;
    subFilter?: string;
    setMainFilter?: (val: string) => void;
    setSubFilter?: (val: string) => void;
}

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

// NEW Helper: Smart Category Styling
const getSmartCategoryClass = (d: BasicInfo) => {
    const cat = (d.category || '').trim();
    const type = (d.etfType || '').trim();
    const name = (d.etfName || '').trim();
    const freq = (d.dividendFreq || '').trim();
    const market = (d.marketType || '').trim();

    // 0. 特殊組合: 季配 + 主動 (Quarterly + Active) - Highest Priority Specific
    // 使用深藍紫色 (Indigo) 區隔
    if (freq.includes('季') && (cat.includes('主動') || type.includes('主動') || name.includes('主動'))) {
        return 'bg-indigo-100 text-indigo-800 border-indigo-200 font-bold'; 
    }

    // 1. 債券商品 (Bond)
    if (cat.includes('債')) {
        return 'bg-amber-100 text-amber-800 border-amber-200'; // Amber/Yellow
    }

    // 2. 主動商品 (Active) - General Active (Non-Quarterly)
    if (cat.includes('主動') || type.includes('主動') || name.includes('主動')) {
        return 'bg-rose-100 text-rose-800 border-rose-200'; // Rose/Red
    }

    // 3. 國際商品 (International)
    if (cat.includes('國際') || type.includes('國際') || market.includes('國外') || d.etfCode === '00911') {
        return 'bg-sky-100 text-sky-800 border-sky-200'; // Sky Blue
    }

    // 4. 月配商品 (Monthly)
    if (freq.includes('月')) {
        return 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200'; // Fuchsia/Purple
    }

    // 5. 季配商品 (Quarterly) - General Quarterly (Passive)
    if (freq.includes('季')) {
        return 'bg-teal-100 text-teal-800 border-teal-200'; // Teal/Cyan
    }

    // 6. 半年配 (Half-Year)
    if ((freq.includes('半年') || cat.includes('半年')) && d.etfCode !== '00911') {
        return 'bg-purple-100 text-purple-800 border-purple-200';
    }

    // Others
    return 'bg-gray-100 text-gray-600 border-gray-200';
};

const TabBasicInfo: React.FC<TabBasicInfoProps> = ({ 
    mainFilter = '全部', 
    subFilter = 'ALL', 
    setMainFilter = (_v: string) => {}, 
    setSubFilter = (_v: string) => {} 
}) => {
  const [data, setData] = useState<BasicInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
        try {
            const basic = await getBasicInfo();
            const sizes = await getSizeData();
            
            if (!mounted) return;

            // Prepare Size Map with Trimmed Keys and Case Insensitivity
            const sMap = new Map<string, SizeData[]>();
            if (Array.isArray(sizes)) {
                sizes.forEach(s => {
                    if (s && s.etfCode) {
                        const code = String(s.etfCode).trim().toUpperCase();
                        if (!sMap.has(code)) sMap.set(code, []);
                        sMap.get(code)!.push(s);
                    }
                });
            }
            
            const baseList = Array.isArray(basic) ? basic : [];
            const joined: BasicInfo[] = [];
            
            for (const b of baseList) {
                if (!b || typeof b !== 'object' || !b.etfCode) continue;

                const code = String(b.etfCode).trim().toUpperCase();
                const sizeRecs = sMap.get(code) || [];
                
                sizeRecs.sort((x, y) => (y.date || '').localeCompare(x.date || ''));

                const latestSize = sizeRecs.length > 0 ? sizeRecs[0].size : 0;
                let trend = '持平';
                
                if (sizeRecs.length >= 2) {
                    const current = sizeRecs[0].size || 0;
                    const prev = sizeRecs[1].size || 0;
                    if (current > prev) trend = '成長';
                    else if (current < prev) trend = '衰退';
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

        // --- Step 1: Apply Main Filter ---
        if (mainFilter !== '全部') {
            if (mainFilter === '債券') {
                result = result.filter(d => getStr(d.category).includes('債'));
            } else if (mainFilter === '季配') {
                // 股票型季配 (排除債券)
                result = result.filter(d => 
                    getStr(d.dividendFreq).includes('季') && 
                    !getStr(d.category).includes('債')
                );
            } else if (mainFilter === '月配') {
                // 股票型月配 (排除債券、排除主動)
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
                // FORCE 00911 to be in International
                result = result.filter(d => d.etfCode === '00911' || getStr(d.category).includes('國際') || getStr(d.etfType).includes('國際') || getStr(d.marketType).includes('國外'));
            } else if (mainFilter === '半年') {
                // EXCLUDE 00911 from Half-Year
                result = result.filter(d => d.etfCode !== '00911' && (getStr(d.category).includes('半年') || getStr(d.dividendFreq).includes('半年')));
            }
        }

        // --- Step 2: Apply Sub Filter ---
        if (subFilter !== 'ALL') {
            const freqStr = (d: BasicInfo) => String(d.dividendFreq || '');
            
            if (subFilter === '季一') {
                result = result.filter(d => checkSeason(freqStr(d), 'Q1'));
            } else if (subFilter === '季二') {
                result = result.filter(d => checkSeason(freqStr(d), 'Q2'));
            } else if (subFilter === '季三') {
                result = result.filter(d => checkSeason(freqStr(d), 'Q3'));
            } else if (subFilter === '月配') {
                result = result.filter(d => freqStr(d).includes('月'));
            } else if (subFilter === '半年') {
                result = result.filter(d => freqStr(d).includes('半年'));
            } else if (subFilter === '年配') {
                result = result.filter(d => freqStr(d).includes('年') && !freqStr(d).includes('半年'));
            } else if (subFilter === '無配') {
                result = result.filter(d => freqStr(d).includes('不') || freqStr(d) === '' || freqStr(d).includes('無'));
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

  const getSubFilterOptions = () => {
      if (mainFilter === '全部') {
          return ['全部', '季一', '季二', '季三', '月配', '半年', '年配', '無配'];
      }
      if (mainFilter === '債券') {
          return ['全部', '月配', '季一', '季二', '季三'];
      }
      if (mainFilter === '季配') {
          return ['全部', '季一', '季二', '季三'];
      }
      return [];
  };

  const subOptions = getSubFilterOptions();
  const showSubFilters = subOptions.length > 0;

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
    <div className="h-full flex flex-col p-2 gap-2 relative overflow-hidden">
      {/* 
        Redesigned 2-Row Layout 
        Row 1: Main Filters (Left) + Actions (Right)
        Row 2: Sub Filters (Full Width)
      */}
      <div className="bg-white p-2 rounded-lg shadow-sm border border-primary-200 flex flex-col gap-2 flex-none">
        {/* ROW 1: Main Category Buttons & Actions */}
        <div className="flex items-center justify-between">
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {['全部', '季配', '月配', '債券', '主動', '國際', '半年'].map(cat => (
                    <button
                        key={cat}
                        onClick={() => { setMainFilter(cat); setSubFilter('ALL'); }}
                        className={`
                            px-3 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-all border
                            ${mainFilter === cat 
                                ? 'bg-primary-600 text-white border-primary-600 shadow-sm' 
                                : 'bg-white text-primary-500 border-primary-100 hover:bg-primary-50 hover:text-primary-700'}
                        `}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Actions: Count + Export */}
            <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-gray-100">
                <div className="flex items-center gap-1 text-primary-400 text-xs font-medium bg-primary-50 px-2 py-1 rounded border border-primary-100">
                    <span className="font-bold">Count:</span>
                    {filteredData.length}
                </div>
                <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-sm font-bold hover:bg-emerald-100 whitespace-nowrap">
                    <span>匯出表單</span>
                </button>
            </div>
        </div>

        {/* ROW 2: Sub Filters (Conditionally Rendered) */}
        {showSubFilters && (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-gray-100 pt-2 animate-in fade-in slide-in-from-top-1">
                {/* Remove Label "細項:" */}
                {subOptions.map(sub => (
                    <button 
                        key={sub}
                        onClick={() => setSubFilter(sub === '全部' ? 'ALL' : sub)} 
                        className={`
                            px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors font-medium border
                            ${(subFilter === sub || (subFilter === 'ALL' && sub === '全部'))
                                ? 'bg-gray-700 text-white border-gray-700' 
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}
                        `}
                    >
                        {sub}
                    </button>
                ))}
            </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-primary-200 min-h-0">
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
                            <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap border ${getSmartCategoryClass(row)}`}>
                                {row?.category || '-'}
                            </span>
                        </td>
                        <td className="p-3">
                             <span className="px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap bg-gray-50 text-gray-500 border border-gray-100">
                                {row?.dividendFreq || '-'}
                            </span>
                        </td>
                        <td className="p-3 text-primary-600 whitespace-nowrap">{row?.issuer || '-'}</td>
                        <td className="p-3 text-primary-600 whitespace-nowrap">{row?.etfType || '-'}</td>
                        <td className="p-3 text-right font-mono font-bold text-primary-800">
                            {row.size > 0 ? row.size.toLocaleString() : <span className="text-gray-300">-</span>}
                        </td>
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