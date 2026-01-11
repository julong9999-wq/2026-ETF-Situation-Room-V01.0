import React, { useState, useEffect, useRef } from 'react';
import { getMarketData, exportToCSV } from '../services/dataService';
import { MarketData } from '../types';
import { TrendingUp, TrendingDown, Download, Info, X, LineChart as LineChartIcon } from 'lucide-react';
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

  const handleMainFilterChange = (cat: 'TW' | 'US') => {
      setMainFilter(cat);
      if (cat === 'US') setSubFilter('道瓊'); else setSubFilter('');
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
    }).sort((a, b) => b.date.localeCompare(a.date));
  };

  const filteredData = getFilteredData();
  const fmt = (num: number) => num ? num.toFixed(2) : '0.00';

  const handleExport = () => {
      const headers = ['指數名稱', '日期', '昨日收盤', '開盤', '高價', '低價', '現價', '成交量', '漲跌', '幅度'];
      const csvData = filteredData.map(d => ({
          '指數名稱': d.indexName, '日期': d.date, '昨日收盤': fmt(d.prevClose), '開盤': fmt(d.open), '高價': fmt(d.high), '低價': fmt(d.low), '現價': fmt(d.price),
          '成交量': d.indexName.includes('加權') ? `${(d.volume).toFixed(2)}億` : `${(d.volume / 1000000).toFixed(2)}M`,
          '漲跌': (d.change > 0 ? '+' : '') + fmt(d.change), '幅度': fmt(d.changePercent) + '%'
      }));
      exportToCSV('GlobalMarket', headers, csvData);
  };

  const usSubOptions = ['道瓊', '那斯', '費半', '標普'];

  // Unified Button Style
  const btnClass = "flex items-center gap-1 px-3 py-1.5 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 font-bold text-sm shadow-sm transition-colors";

  return (
    <div className="h-full flex flex-col p-2 gap-2 bg-blue-50 overflow-hidden">
      
      {/* UNIFIED ACTION BAR */}
      <div className="bg-white p-2 rounded-lg shadow-sm border border-blue-200 flex items-center justify-between gap-2 flex-none">
          <div className="flex items-center gap-2">
              <div className="flex gap-1 shrink-0">
                  {['TW', 'US'].map(cat => (
                      <button key={cat} onClick={() => handleMainFilterChange(cat as 'TW'|'US')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all border 
                            ${mainFilter === cat ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}>
                          {cat === 'TW' ? '台股' : '美股'}
                      </button>
                  ))}
              </div>
              {mainFilter === 'US' && (
                  <>
                    <div className="h-5 w-px bg-gray-300 mx-1"></div>
                    <div className="flex gap-1 shrink-0">
                        {usSubOptions.map(sub => (
                            <button key={sub} onClick={() => setSubFilter(sub)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all border 
                                    ${subFilter === sub ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}>
                                {sub}
                            </button>
                        ))}
                    </div>
                  </>
              )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
             <div className="flex items-center gap-1 bg-white px-2 py-1.5 rounded-lg border border-blue-200 shadow-sm">
                 <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-sm w-28 font-mono outline-none text-blue-900 font-bold" />
                 <span className="text-gray-400 text-xs">~</span>
                 <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-sm w-28 font-mono outline-none text-blue-900 font-bold" />
             </div>
             <button onClick={() => setShowChartModal(true)} className={btnClass}><LineChartIcon className="w-4 h-4" /> 查看線圖</button>
             <button onClick={() => setShowRecentModal(true)} className={btnClass}><Info className="w-4 h-4" /> 近期資訊</button>
             <button onClick={handleExport} className={btnClass}><Download className="w-4 h-4" /> 匯出資料</button>
          </div>
      </div>

      {/* UNIFIED TABLE STYLE */}
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow-sm border border-blue-200 min-h-0">
        <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-blue-50 sticky top-0 z-10 border-b border-blue-200 font-bold text-blue-900">
                <tr>
                    <th className="p-3 whitespace-nowrap">指數名稱</th>
                    <th className="p-3 whitespace-nowrap">日期</th>
                    <th className="p-3 whitespace-nowrap text-right">昨日收盤</th>
                    <th className="p-3 whitespace-nowrap text-right">開盤</th>
                    <th className="p-3 whitespace-nowrap text-right">高價</th>
                    <th className="p-3 whitespace-nowrap text-right">低價</th>
                    <th className="p-3 whitespace-nowrap text-right">現價</th>
                    <th className="p-3 whitespace-nowrap text-right">成交量</th>
                    <th className="p-3 whitespace-nowrap text-right">漲跌</th>
                    <th className="p-3 whitespace-nowrap text-right">幅度</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-blue-50 font-bold text-gray-700">
                {filteredData.length === 0 ? <tr><td colSpan={10} className="p-8 text-center text-gray-400">無符合條件的資料</td></tr> : filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-blue-50 transition-colors">
                        <td className="p-3 text-gray-900">{row.indexName}</td>
                        <td className="p-3 text-blue-800 font-mono">{row.date}</td>
                        <td className="p-3 text-right font-mono text-gray-500">{fmt(row.prevClose)}</td>
                        <td className="p-3 text-right font-mono text-gray-600">{fmt(row.open)}</td>
                        <td className="p-3 text-right font-mono text-red-600">{fmt(row.high)}</td>
                        <td className="p-3 text-right font-mono text-green-600">{fmt(row.low)}</td>
                        <td className="p-3 text-right font-mono font-bold text-blue-900">{fmt(row.price)}</td>
                        <td className="p-3 text-right font-mono text-gray-500">{row.indexName.includes('加權') ? `${(row.volume).toFixed(2)}億` : `${(row.volume / 1000000).toFixed(2)}M`}</td>
                        <td className={`p-3 text-right font-mono ${row.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>{row.change > 0 ? '+' : ''}{fmt(row.change)}</td>
                        <td className={`p-3 text-right font-mono flex justify-end items-center gap-1 ${row.changePercent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {row.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{fmt(row.changePercent)}%
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {showChartModal && (
        <KLineChartModal data={filteredData} title={mainFilter === 'TW' ? '台股加權指數' : `美股指數 (${subFilter})`} onClose={() => setShowChartModal(false)} />
      )}
      {showRecentModal && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowRecentModal(false)}><div className="bg-white p-6 rounded-lg text-center font-bold">近期資訊視窗 (範例)</div></div>}
    </div>
  );
};

interface ChartModalProps { data: MarketData[]; title: string; onClose: () => void; }
const KLineChartModal: React.FC<ChartModalProps> = ({ data, title, onClose }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!chartContainerRef.current || data.length === 0) return;
        const chartData = [...data].reverse().map(d => ({ time: d.date, open: d.open, high: d.high, low: d.low, close: d.price })).filter(d => d.open);
        const chart = createChart(chartContainerRef.current, { layout: { background: { type: ColorType.Solid, color: 'white' }, textColor: '#333' }, grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } }, width: chartContainerRef.current.clientWidth, height: 400 });
        chart.addSeries(CandlestickSeries, { upColor: '#ef4444', downColor: '#22c55e', borderVisible: false, wickUpColor: '#ef4444', wickDownColor: '#22c55e' }).setData(chartData);
        chart.timeScale().fitContent();
        return () => chart.remove();
    }, [data]);
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-5xl h-[500px] shadow-2xl flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-blue-200 flex justify-between items-center bg-blue-50">
                      <h3 className="text-lg font-bold text-blue-900">{title} - K線圖</h3>
                      <button onClick={onClose}><X className="w-6 h-6 text-blue-400" /></button>
                  </div>
                  <div className="flex-1 p-2"><div ref={chartContainerRef} className="w-full h-full"></div></div>
              </div>
          </div>
    );
};

export default TabGlobalMarket;