import React, { useState, useEffect } from 'react';
import { getMarketData, exportToCSV } from '../services/dataService';
import { MarketData } from '../types';
import { TrendingUp, TrendingDown, Download, Info, X } from 'lucide-react';

const TabGlobalMarket: React.FC = () => {
  const [data, setData] = useState<MarketData[]>([]);
  
  // Filters
  const [mainFilter, setMainFilter] = useState<'ALL' | 'TW' | 'US'>('ALL');
  // Unified sub-filter state (replaces specific usSubFilter)
  const [subFilter, setSubFilter] = useState<string>('ALL');
  
  // Date Input
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [showRecentModal, setShowRecentModal] = useState(false);

  useEffect(() => {
    getMarketData().then((fetched) => {
        const sorted = [...fetched].sort((a, b) => b.date.localeCompare(a.date));
        setData(sorted);
        
        if (sorted.length > 0) {
            const latestDateStr = sorted[0].date;
            if (latestDateStr && !isNaN(new Date(latestDateStr).getTime())) {
                setEndDate(latestDateStr);
                const start = new Date(latestDateStr);
                start.setDate(start.getDate() - 20);
                setStartDate(start.toISOString().split('T')[0]);
                return;
            }
        }
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 20);
        setEndDate(end.toISOString().split('T')[0]);
        setStartDate(start.toISOString().split('T')[0]);
    });
  }, []);

  // Robust Detection Helpers
  const isTaiwanStock = (name: string, type: string) => {
      const n = name.toLowerCase();
      if (n.includes('加權') || n.includes('櫃買') || n.includes('taiwan') || n.includes('twse') || n.includes('tpex')) return true;
      if (type === 'TW' && !isUSStock(name, type)) return true;
      return false;
  };

  const isUSStock = (name: string, type: string) => {
      const n = name.toLowerCase();
      if (n.includes('道瓊') || n.includes('dow')) return true;
      if (n.includes('那斯') || n.includes('nasdaq')) return true;
      if (n.includes('費城') || n.includes('費半') || n.includes('sox') || n.includes('semiconductor')) return true;
      if (n.includes('標普') || n.includes('s&p') || n.includes('spx')) return true;
      if (type === 'US') return true;
      return false;
  };

  const getFilteredData = () => {
    return data.filter(item => {
        const name = item.indexName || '';
        const type = item.type || '';
        const n = name.toLowerCase();

        // 1. Main Filter Logic
        if (mainFilter === 'TW') {
            if (!isTaiwanStock(name, type)) return false;
            // TW Sub-filters
            if (subFilter !== 'ALL') {
                if (subFilter === '加權' && !n.includes('加權') && !n.includes('twse')) return false;
                if (subFilter === '櫃買' && !n.includes('櫃買') && !n.includes('tpex')) return false;
            }
        }
        
        if (mainFilter === 'US') {
            if (!isUSStock(name, type)) return false;
            // US Sub-filters
            if (subFilter !== 'ALL') {
                if (subFilter === '道瓊' && !n.includes('道瓊') && !n.includes('dow')) return false;
                if (subFilter === '那斯' && !n.includes('那斯') && !n.includes('nasdaq')) return false;
                if (subFilter === '費半' && !n.includes('費城') && !n.includes('sox') && !n.includes('semi')) return false;
                if (subFilter === '標普' && !n.includes('s&p') && !n.includes('標普') && !n.includes('spx')) return false;
            }
        }
        
        // 2. Date Range
        if (startDate && item.date < startDate) return false;
        if (endDate && item.date > endDate) return false;
    
        return true;
      }).sort((a, b) => {
        if (mainFilter === 'US') {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            const getRank = (nStr: string) => {
                const n = nStr.toLowerCase();
                if (n.includes('道瓊') || n.includes('dow')) return 1;
                if (n.includes('那斯') || n.includes('nasdaq')) return 2;
                if (n.includes('s&p') || n.includes('標普')) return 3; 
                if (n.includes('費城') || n.includes('sox')) return 4;
                return 5;
            };
            return getRank(a.indexName) - getRank(b.indexName);
        }
        return b.date.localeCompare(a.date);
      });
  };

  const filteredData = getFilteredData();

  const fmt = (num: number) => num ? num.toFixed(2) : '0.00';

  const handleExport = () => {
      const headers = ['指數名稱', '日期', '昨日收盤', '開盤', '高價', '低價', '現價', '成交量', '漲跌', '幅度'];
      const csvData = filteredData.map(d => {
          let volStr = '';
          if (d.indexName.includes('加權')) {
             // Source is already in billions (億), so no division needed.
             volStr = `${(d.volume).toFixed(2)}億`;
          } else {
             // For US/Other, assume raw unit needs conversion to Millions
             volStr = `${(d.volume / 1000000).toFixed(2)}M`;
          }

          return {
              '指數名稱': d.indexName,
              '日期': d.date,
              '昨日收盤': fmt(d.prevClose),
              '開盤': fmt(d.open),
              '高價': fmt(d.high),
              '低價': fmt(d.low),
              '現價': fmt(d.price),
              '成交量': volStr,
              '漲跌': (d.change > 0 ? '+' : '') + fmt(d.change),
              '幅度': fmt(d.changePercent) + '%'
          };
      });
      exportToCSV('GlobalMarket', headers, csvData);
  };

  const getRecentData = () => {
      const targets = [
          { name: '台灣加權', matcher: (d: MarketData) => isTaiwanStock(d.indexName, d.type) },
          { name: '道瓊工業', matcher: (d: MarketData) => (d.indexName.includes('道瓊') || d.indexName.includes('Dow')) },
          { name: '那斯達克', matcher: (d: MarketData) => (d.indexName.includes('那斯達克') || d.indexName.includes('Nasdaq')) },
          { name: '費城半導體', matcher: (d: MarketData) => (d.indexName.includes('費城') || d.indexName.includes('SOX') || d.indexName.includes('Semiconductor')) },
          { name: 'S&P 500', matcher: (d: MarketData) => (d.indexName.includes('S&P') || d.indexName.includes('標普') || d.indexName.includes('SPX')) }
      ];

      const results: MarketData[] = [];
      targets.forEach(t => {
          const matches = data.filter(t.matcher);
          matches.sort((a,b) => b.date.localeCompare(a.date));
          if (matches.length > 0) results.push(matches[0]);
      });
      return results;
  };

  // UI Helper: Determine sub-filters options
  const getSubFilterOptions = () => {
      if (mainFilter === 'US') {
          return ['全部', '道瓊', '那斯', '費半', '標普'];
      }
      if (mainFilter === 'TW') {
          return ['全部', '加權', '櫃買'];
      }
      return [];
  };

  const subOptions = getSubFilterOptions();
  const showSubFilters = subOptions.length > 0;

  return (
    <div className="h-full flex flex-col p-2 space-y-2 relative">
      {/* 1. Filter Bar - Styled exactly like TabBasicInfo */}
      <div className="bg-white p-2 rounded-lg shadow-sm border border-primary-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {/* Level 1: Main Buttons */}
              <div className="flex gap-1 shrink-0 bg-primary-50 p-1 rounded-lg">
                  {['ALL', 'TW', 'US'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setMainFilter(cat as any); setSubFilter('ALL'); }}
                        className={`
                            px-3 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-all 
                            ${mainFilter === cat 
                                ? 'bg-white text-primary-700 shadow border border-primary-200' 
                                : 'text-primary-500 hover:bg-primary-100 hover:text-primary-700'}
                        `}
                      >
                          {cat === 'ALL' ? '全部' : cat === 'TW' ? '台股' : '美股'}
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

          {/* Date Range & Actions */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
             <div className="flex items-center gap-1 bg-primary-50 px-2 py-1 rounded-md border border-primary-100">
                 <span className="text-xs font-bold text-primary-700 whitespace-nowrap">區間:</span>
                 <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white border border-primary-200 rounded px-2 py-1 text-xs w-40 text-primary-800 font-mono" />
                 <span className="text-primary-400 text-xs">~</span>
                 <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white border border-primary-200 rounded px-2 py-1 text-xs w-40 text-primary-800 font-mono" />
             </div>

             <div className="flex gap-1">
                 <button onClick={() => setShowRecentModal(true)} className="flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md hover:bg-amber-100 font-bold text-sm">
                     <Info className="w-4 h-4" /> <span className="hidden sm:inline">近期</span>
                 </button>
                 <button onClick={handleExport} className="flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 font-bold text-sm">
                     <Download className="w-4 h-4" /> <span className="hidden sm:inline">匯出</span>
                 </button>
             </div>
          </div>
      </div>

      {/* 2. Data Table */}
      <div className="flex-1 overflow-auto bg-white rounded-xl shadow-sm border border-primary-200">
        <table className="w-full text-left border-collapse">
            <thead className="bg-primary-100 sticky top-0 z-10 shadow-sm">
                <tr>
                    <th className="p-3 font-bold text-primary-900 text-sm whitespace-nowrap">指數名稱</th>
                    <th className="p-3 font-bold text-primary-900 text-sm whitespace-nowrap">日期</th>
                    <th className="p-3 font-bold text-primary-900 text-sm whitespace-nowrap text-right">昨日收盤</th>
                    <th className="p-3 font-bold text-primary-900 text-sm whitespace-nowrap text-right">開盤</th>
                    <th className="p-3 font-bold text-primary-900 text-sm whitespace-nowrap text-right">高價</th>
                    <th className="p-3 font-bold text-primary-900 text-sm whitespace-nowrap text-right">低價</th>
                    <th className="p-3 font-bold text-primary-900 text-sm whitespace-nowrap text-right">現價</th>
                    <th className="p-3 font-bold text-primary-900 text-sm whitespace-nowrap text-right">成交量</th>
                    <th className="p-3 font-bold text-primary-900 text-sm whitespace-nowrap text-right">漲跌</th>
                    <th className="p-3 font-bold text-primary-900 text-sm whitespace-nowrap text-right">幅度</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-primary-100 text-sm">
                {filteredData.length === 0 ? (
                    <tr>
                        <td colSpan={10} className="p-8 text-center text-gray-400">
                            無符合條件的資料。請檢查日期區間或重新匯入。
                        </td>
                    </tr>
                ) : filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-primary-50">
                        <td className="p-3 font-bold text-primary-900">{row.indexName}</td>
                        <td className="p-3 text-primary-600 font-mono">{row.date}</td>
                        <td className="p-3 text-right font-mono text-gray-500">{fmt(row.prevClose)}</td>
                        <td className="p-3 text-right font-mono">{fmt(row.open)}</td>
                        <td className="p-3 text-right font-mono text-red-400">{fmt(row.high)}</td>
                        <td className="p-3 text-right font-mono text-green-400">{fmt(row.low)}</td>
                        <td className="p-3 text-right font-mono font-bold text-primary-800">{fmt(row.price)}</td>
                        <td className="p-3 text-right font-mono text-primary-400 text-xs">
                             {/* Volume Logic: If Taiex ('加權'), show raw value (already in Yi), else use 'M' */}
                             {row.indexName.includes('加權') 
                                ? `${(row.volume).toFixed(2)}億` 
                                : `${(row.volume / 1000000).toFixed(2)}M`
                             }
                        </td>
                        <td className={`p-3 text-right font-mono font-medium ${row.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {row.change > 0 ? '+' : ''}{fmt(row.change)}
                        </td>
                        <td className={`p-3 text-right font-mono font-medium flex justify-end items-center gap-1 ${row.changePercent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {row.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {fmt(row.changePercent)}%
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* 3. Recent Info Modal */}
      {showRecentModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-4xl min-h-[400px] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-5 border-b border-primary-100 flex justify-between items-center bg-primary-50 rounded-t-xl">
                      <div>
                          <h3 className="text-xl font-bold text-primary-900">近期市場資訊 (最新收盤)</h3>
                      </div>
                      <button onClick={() => setShowRecentModal(false)} className="p-2 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-primary-400" /></button>
                  </div>
                  <div className="flex-1 overflow-auto p-0">
                      <table className="w-full text-base">
                          <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                              <tr>
                                  <th className="p-4 text-left">指數名稱</th>
                                  <th className="p-4 text-left">資料日期</th>
                                  <th className="p-4 text-right">現價</th>
                                  <th className="p-4 text-right">漲跌</th>
                                  <th className="p-4 text-right">幅度</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {getRecentData().map((d, i) => (
                                  <tr key={i} className="hover:bg-primary-50/50 transition-colors">
                                      <td className="p-5 font-bold text-gray-800">{d.indexName}</td>
                                      <td className="p-5 text-gray-500 font-mono">
                                          {d.date} 
                                      </td>
                                      <td className="p-5 text-right font-mono font-bold text-lg">{fmt(d.price)}</td>
                                      <td className={`p-5 text-right font-mono font-medium text-lg ${d.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                          {d.change > 0 ? '+' : ''}{fmt(d.change)}
                                      </td>
                                      <td className={`p-5 text-right font-mono font-medium text-lg ${d.changePercent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                          {fmt(d.changePercent)}%
                                      </td>
                                  </tr>
                              ))}
                              {getRecentData().length === 0 && (
                                  <tr>
                                      <td colSpan={5} className="p-10 text-center text-gray-400">
                                          目前無資料，請先至「資料維護」匯入國際大盤數據。
                                      </td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default TabGlobalMarket;