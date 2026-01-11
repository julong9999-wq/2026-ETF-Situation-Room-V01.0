import React, { useState, useEffect, useRef } from 'react';
import { getMarketData, exportToCSV } from '../services/dataService';
import { MarketData } from '../types';
import { TrendingUp, TrendingDown, Download, Info, X, LineChart as LineChartIcon, Maximize2 } from 'lucide-react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';

const TabGlobalMarket: React.FC = () => {
  const [data, setData] = useState<MarketData[]>([]);
  const [mainFilter, setMainFilter] = useState<'TW' | 'US'>('TW');
  const [subFilter, setSubFilter] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showRecentModal, setShowRecentModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);

  useEffect(() => {
    getMarketData().then((fetched) => {
        const sorted = [...fetched].sort((a, b) => b.date.localeCompare(a.date));
        setData(sorted);
        if (sorted.length > 0) {
            const latestDateStr = sorted[0].date;
            if (latestDateStr && !isNaN(new Date(latestDateStr).getTime())) {
                setEndDate(latestDateStr);
                const start = new Date(latestDateStr);
                start.setDate(start.getDate() - 20); // Last 20 days
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

  const handleMainFilterChange = (cat: 'TW' | 'US') => {
      setMainFilter(cat);
      if (cat === 'US') {
          setSubFilter('道瓊'); 
      } else {
          setSubFilter('');
      }
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
        const n = name.toLowerCase();
        if (mainFilter === 'TW') {
            if (!n.includes('加權') && !n.includes('twse')) return false;
        } else if (mainFilter === 'US') {
            if (!isUSStock(name, item.type)) return false;
            if (subFilter === '道瓊' && (!n.includes('道瓊') && !n.includes('dow'))) return false;
            if (subFilter === '那斯' && (!n.includes('那斯') && !n.includes('nasdaq'))) return false;
            if (subFilter === '費半' && (!n.includes('費城') && !n.includes('sox') && !n.includes('semi'))) return false;
            if (subFilter === '標普' && (!n.includes('s&p') && !n.includes('標普') && !n.includes('spx'))) return false;
        }
        if (startDate && item.date < startDate) return false;
        if (endDate && item.date > endDate) return false;
        return true;
      }).sort((a, b) => {
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
             volStr = `${(d.volume).toFixed(2)}億`;
          } else {
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
          { name: '台灣加權', matcher: (d: MarketData) => (d.indexName.includes('加權') || d.indexName.toLowerCase().includes('twse')) },
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

  const usSubOptions = ['道瓊', '那斯', '費半', '標普'];

  return (
    <div className="h-full flex flex-col p-2 gap-2 relative overflow-hidden">
      
      {/* Header Row */}
      <div className="bg-white p-3 rounded-lg shadow-sm border border-blue-200 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar flex-none">
          
          {/* Left: Filters */}
          <div className="flex items-center gap-2 flex-1">
              <div className="flex gap-1 shrink-0 bg-blue-50 p-1 rounded-lg border border-blue-100">
                  {['TW', 'US'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => handleMainFilterChange(cat as 'TW'|'US')}
                        className={`
                            px-4 py-1.5 rounded-md text-base font-bold whitespace-nowrap transition-all 
                            ${mainFilter === cat 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}
                        `}
                      >
                          {cat === 'TW' ? '台股' : '美股'}
                      </button>
                  ))}
              </div>
              
              {mainFilter === 'US' && (
                  <div className="flex items-center animate-in fade-in slide-in-from-left-2 duration-300">
                      <div className="h-6 w-px bg-blue-200 mx-2"></div>
                      <div className="flex gap-1 shrink-0">
                           {usSubOptions.map(sub => (
                               <button 
                                    key={sub} 
                                    onClick={() => setSubFilter(sub)}
                                    className={`
                                        px-3 py-1.5 rounded-md text-base whitespace-nowrap transition-colors font-bold
                                        ${subFilter === sub
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}
                                    `}
                               >
                                   {sub}
                               </button>
                           ))}
                      </div>
                  </div>
              )}
          </div>

          {/* Right: Dates & Actions */}
          <div className="flex items-center gap-2 shrink-0 ml-2 border-l pl-2 border-gray-200">
             <div className="flex items-center gap-1 bg-gray-50 px-2 py-1.5 rounded-md border border-gray-200 shadow-inner">
                 <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-[15px] w-32 font-mono outline-none text-gray-700 font-bold" />
                 <span className="text-gray-400 text-sm">~</span>
                 <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-[15px] w-32 font-mono outline-none text-gray-700 font-bold" />
             </div>
             
             <div className="flex gap-2">
                <button onClick={() => setShowChartModal(true)} className="flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-bold text-base whitespace-nowrap shadow-sm transition-colors">
                    <LineChartIcon className="w-4 h-4" /> 技術線圖
                </button>
                <button onClick={() => setShowRecentModal(true)} className="flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 font-bold text-base whitespace-nowrap shadow-sm">
                    <Info className="w-4 h-4" /> 近期資訊
                </button>
                <button onClick={handleExport} className="flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-bold text-base whitespace-nowrap shadow-sm">
                    <Download className="w-4 h-4" /> 匯出表單
                </button>
             </div>
          </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow-sm border border-blue-200 min-h-0">
        <table className="w-full text-left border-collapse">
            <thead className="bg-blue-50 sticky top-0 z-10 shadow-sm border-b border-blue-100">
                <tr>
                    <th className="p-2.5 font-bold text-blue-900 text-base whitespace-nowrap">指數名稱</th>
                    <th className="p-2.5 font-bold text-blue-900 text-base whitespace-nowrap">日期</th>
                    <th className="p-2.5 font-bold text-blue-900 text-base whitespace-nowrap text-right">昨日收盤</th>
                    <th className="p-2.5 font-bold text-blue-900 text-base whitespace-nowrap text-right">開盤</th>
                    <th className="p-2.5 font-bold text-blue-900 text-base whitespace-nowrap text-right">高價</th>
                    <th className="p-2.5 font-bold text-blue-900 text-base whitespace-nowrap text-right">低價</th>
                    <th className="p-2.5 font-bold text-blue-900 text-base whitespace-nowrap text-right">現價</th>
                    <th className="p-2.5 font-bold text-blue-900 text-base whitespace-nowrap text-right">成交量</th>
                    <th className="p-2.5 font-bold text-blue-900 text-base whitespace-nowrap text-right">漲跌</th>
                    <th className="p-2.5 font-bold text-blue-900 text-base whitespace-nowrap text-right">幅度</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-blue-100 text-[15px]">
                {filteredData.length === 0 ? (
                    <tr>
                        <td colSpan={10} className="p-8 text-center text-gray-500 text-base font-medium">
                            無符合條件的資料。請檢查日期區間或重新匯入。
                        </td>
                    </tr>
                ) : filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-blue-50 transition-colors">
                        <td className="p-2.5 font-bold text-gray-900">{row.indexName}</td>
                        <td className="p-2.5 text-blue-800 font-mono font-medium">{row.date}</td>
                        <td className="p-2.5 text-right font-mono text-gray-600">{fmt(row.prevClose)}</td>
                        <td className="p-2.5 text-right font-mono text-gray-800">{fmt(row.open)}</td>
                        <td className="p-2.5 text-right font-mono text-red-600 font-medium">{fmt(row.high)}</td>
                        <td className="p-2.5 text-right font-mono text-green-600 font-medium">{fmt(row.low)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-blue-900 text-lg">{fmt(row.price)}</td>
                        <td className="p-2.5 text-right font-mono text-gray-500 text-sm font-medium">
                             {row.indexName.includes('加權') 
                                ? `${(row.volume).toFixed(2)}億` 
                                : `${(row.volume / 1000000).toFixed(2)}M`
                             }
                        </td>
                        <td className={`p-2.5 text-right font-mono font-bold ${row.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {row.change > 0 ? '+' : ''}{fmt(row.change)}
                        </td>
                        <td className={`p-2.5 text-right font-mono font-bold flex justify-end items-center gap-1 ${row.changePercent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {row.changePercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {fmt(row.changePercent)}%
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* Modal */}
      {showRecentModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-4xl min-h-[400px] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-blue-100 flex justify-between items-center bg-blue-50 rounded-t-xl">
                      <h3 className="text-lg font-bold text-blue-900">近期市場資訊 (最新收盤)</h3>
                      <button onClick={() => setShowRecentModal(false)} className="p-1 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-blue-400" /></button>
                  </div>
                  <div className="flex-1 overflow-auto p-0">
                      <table className="w-full text-base">
                          <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                              <tr>
                                  <th className="p-4 text-left font-bold">指數名稱</th>
                                  <th className="p-4 text-left font-bold">資料日期</th>
                                  <th className="p-4 text-right font-bold">現價</th>
                                  <th className="p-4 text-right font-bold">漲跌</th>
                                  <th className="p-4 text-right font-bold">幅度</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {getRecentData().map((d, i) => (
                                  <tr key={i} className="hover:bg-blue-50 transition-colors">
                                      <td className="p-4 font-bold text-gray-900 text-lg">{d.indexName}</td>
                                      <td className="p-4 text-gray-600 font-mono text-base">{d.date}</td>
                                      <td className="p-4 text-right font-mono font-bold text-xl text-blue-900">{fmt(d.price)}</td>
                                      <td className={`p-4 text-right font-mono font-bold text-xl ${d.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                          {d.change > 0 ? '+' : ''}{fmt(d.change)}
                                      </td>
                                      <td className={`p-4 text-right font-mono font-bold text-xl ${d.changePercent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                          {fmt(d.changePercent)}%
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {showChartModal && (
        <KLineChartModal 
            data={filteredData} 
            title={mainFilter === 'TW' ? '台股加權指數' : `美股指數 (${subFilter})`}
            onClose={() => setShowChartModal(false)} 
        />
      )}
    </div>
  );
};

// ... ChartModalProps ... (Wrapper)
interface ChartModalProps {
    data: MarketData[];
    title: string;
    onClose: () => void;
}

const KLineChartModal: React.FC<ChartModalProps> = ({ data, title, onClose }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!chartContainerRef.current || data.length === 0) return;
        const chartData = [...data].reverse().map(d => ({ time: d.date, open: d.open, high: d.high, low: d.low, close: d.price })).filter(d => d.open && d.high);
        const chart = createChart(chartContainerRef.current, {
            layout: { background: { type: ColorType.Solid, color: 'white' }, textColor: '#333' },
            grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
            width: chartContainerRef.current.clientWidth,
            height: 400,
        });
        const series = chart.addSeries(CandlestickSeries, { upColor: '#ef4444', downColor: '#22c55e', borderVisible: false, wickUpColor: '#ef4444', wickDownColor: '#22c55e' });
        series.setData(chartData);
        chart.timeScale().fitContent();
        const handleResize = () => chart.applyOptions({ width: chartContainerRef.current?.clientWidth || 0 });
        window.addEventListener('resize', handleResize);
        return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
    }, [data]);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-5xl h-[80vh] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-blue-100 flex justify-between items-center bg-blue-50 rounded-t-xl shrink-0">
                      <div className="flex items-center gap-3">
                          <div className="bg-blue-100 p-2 rounded-lg"><LineChartIcon className="w-6 h-6 text-blue-600" /></div>
                          <div><h3 className="text-xl font-bold text-blue-900">{title} - 技術線圖 (K線)</h3><p className="text-sm text-blue-500">顯示區間: {data.length > 0 ? `${data[data.length-1].date} ~ ${data[0].date}` : '無資料'}</p></div>
                      </div>
                      <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors"><X className="w-6 h-6 text-blue-400" /></button>
                  </div>
                  <div className="flex-1 p-4 flex flex-col min-h-0">
                      {data.length === 0 ? <div className="flex-1 flex items-center justify-center text-gray-400 text-lg">無資料可顯示</div> : <div ref={chartContainerRef} className="w-full h-full border border-gray-100 rounded-lg shadow-inner"></div>}
                  </div>
              </div>
          </div>
    );
};

export default TabGlobalMarket;