import React, { useState, useEffect } from 'react';
import { getDividendData, getBasicInfo, exportToCSV } from '../services/dataService';
import { DividendData, BasicInfo } from '../types';
import { Database, Download, Megaphone, X, Calendar } from 'lucide-react';

const TabDividends: React.FC = () => {
  const [divData, setDivData] = useState<DividendData[]>([]);
  const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
  const [selectedEtf, setSelectedEtf] = useState<string | null>(null);

  // Filters
  const [catFilter, setCatFilter] = useState('ALL');
  const [freqFilter, setFreqFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('');
  const [showAnnoModal, setShowAnnoModal] = useState(false);

  useEffect(() => {
    Promise.all([getDividendData(), getBasicInfo()]).then(([d, b]) => {
        setDivData(d);
        setBasicInfo(b);
        setEndDate(new Date().toISOString().split('T')[0]);
    });
  }, []);

  const getFilteredMaster = () => {
      return basicInfo.filter(b => {
          if (catFilter !== 'ALL' && b.category !== catFilter) return false;
          if (freqFilter !== 'ALL' && b.dividendFreq !== freqFilter) return false;
          if (typeFilter !== 'ALL' && b.etfType !== typeFilter) return false;
          return divData.some(d => d.etfCode === b.etfCode);
      }).sort((a,b) => a.etfCode.localeCompare(b.etfCode));
  };
  const filteredMaster = getFilteredMaster();

  const getDetailData = () => {
      if (!selectedEtf) return [];
      return divData.filter(d => {
          if (d.etfCode !== selectedEtf) return false;
          const ex = d.exDate.replace(/\//g, '-');
          if (startDate && ex < startDate) return false;
          if (endDate && ex > endDate) return false;
          return true;
      }).sort((a,b) => b.yearMonth.localeCompare(a.yearMonth));
  };
  const detailData = getDetailData();

  const handleExport = () => {
      if (!selectedEtf) return alert("請先選擇一檔 ETF");
      exportToCSV(`${selectedEtf}_Dividends`, ['代碼', '名稱', '年月', '除息日', '除息金額', '發放日'], detailData);
  }

  const getAnnouncements = () => {
      const today = new Date().toISOString().split('T')[0];
      const future = divData.filter(d => d.exDate.replace(/\//g, '-') >= today);
      return future.map(d => {
          const info = basicInfo.find(b => b.etfCode === d.etfCode);
          return {
              ...d,
              category: info?.category || '其他',
              freq: info?.dividendFreq || '未知',
              status: '公告中'
          };
      }).sort((a,b) => a.exDate.localeCompare(b.exDate));
  };

  const categories = ['ALL', ...Array.from(new Set(basicInfo.map(b => b.category).filter(Boolean)))];
  const freqs = ['ALL', ...Array.from(new Set(basicInfo.map(b => b.dividendFreq).filter(Boolean)))];
  const types = ['ALL', ...Array.from(new Set(basicInfo.map(b => b.etfType).filter(Boolean)))];
  const fmt = (num: number) => num ? num.toFixed(2) : '0.00';

  return (
    <div className="h-full flex flex-col p-2 gap-2 bg-primary-50">
       {/* Controls - Compact */}
       <div className="bg-white p-2 rounded-lg shadow-sm border border-primary-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
               <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="border rounded px-2 py-1.5 text-xs bg-gray-50 outline-none"><option value="ALL">分類:全部</option>{categories.filter(x=>x!=='ALL').map(x=><option key={x} value={x}>{x}</option>)}</select>
               <select value={freqFilter} onChange={e=>setFreqFilter(e.target.value)} className="border rounded px-2 py-1.5 text-xs bg-gray-50 outline-none"><option value="ALL">週期:全部</option>{freqs.filter(x=>x!=='ALL').map(x=><option key={x} value={x}>{x}</option>)}</select>
               <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="border rounded px-2 py-1.5 text-xs bg-gray-50 outline-none"><option value="ALL">類型:全部</option>{types.filter(x=>x!=='ALL').map(x=><option key={x} value={x}>{x}</option>)}</select>
          </div>
          
          <div className="flex items-center gap-2 ml-auto shrink-0">
             <div className="flex items-center gap-1 bg-gray-50 border rounded px-2 py-1">
                  <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="bg-transparent text-xs w-40 font-mono outline-none"/>
                  <span className="text-xs">~</span>
                  <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="bg-transparent text-xs w-40 font-mono outline-none"/>
             </div>

             <div className="flex gap-1">
                <button onClick={() => setShowAnnoModal(true)} className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md hover:bg-purple-100 font-bold text-sm">
                    <Megaphone className="w-4 h-4" /> <span className="hidden sm:inline">公告</span>
                </button>
                <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 font-bold text-sm" disabled={!selectedEtf}>
                    <Download className="w-4 h-4" /> <span className="hidden sm:inline">匯出</span>
                </button>
             </div>
          </div>
      </div>

       {/* Content */}
       <div className="flex-1 flex gap-2 overflow-hidden">
          {/* Master */}
          <div className="w-64 flex-none bg-white rounded-xl shadow-sm border border-primary-200 flex flex-col overflow-hidden">
              <div className="p-2 bg-gray-50 border-b font-bold text-gray-700 flex justify-between text-sm">
                  <span>ETF 列表</span>
                  <span className="bg-gray-200 px-1.5 rounded-full text-xs flex items-center">{filteredMaster.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                  {filteredMaster.map(item => (
                      <div 
                        key={item.etfCode} 
                        onClick={() => setSelectedEtf(item.etfCode)}
                        className={`p-2 border-b flex justify-between items-center cursor-pointer hover:bg-purple-50 ${selectedEtf === item.etfCode ? 'bg-purple-100 border-l-4 border-l-purple-600' : ''}`}
                      >
                          <div>
                              <div className="font-bold text-gray-800 text-sm">{item.etfCode}</div>
                              <div className="text-xs text-gray-500 truncate w-32">{item.etfName}</div>
                          </div>
                          <div className="text-xs text-purple-600 bg-purple-50 px-1 rounded">{item.dividendFreq}</div>
                      </div>
                  ))}
              </div>
          </div>

          {/* Detail */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-primary-200 flex flex-col overflow-hidden">
                {!selectedEtf ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Database className="w-12 h-12 mb-3 opacity-30" />
                        <p className="text-sm">請選擇左側 ETF</p>
                    </div>
                ) : (
                    <>
                         <div className="p-2 bg-purple-50 border-b border-purple-100 flex justify-between items-center">
                            <h3 className="font-bold text-purple-900 text-sm">{selectedEtf} 除息明細</h3>
                            <span className="text-xs text-purple-600">共 {detailData.length} 筆</span>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 sticky top-0 text-sm">
                                    <tr>
                                        <th className="p-2 pl-4">年月</th>
                                        <th className="p-2">日期</th>
                                        <th className="p-2 text-right">金額</th>
                                        <th className="p-2 pr-4">發放日</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-sm">
                                    {detailData.map((d, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="p-2 pl-4 font-bold text-gray-700">{d.yearMonth}</td>
                                            <td className="p-2 text-primary-600 font-mono"><div className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{d.exDate}</div></td>
                                            <td className="p-2 text-right font-bold text-emerald-600">{fmt(d.amount)}</td>
                                            <td className="p-2 pr-4 text-gray-500">{d.paymentDate}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
          </div>
       </div>

       {/* Announcement Modal */}
       {showAnnoModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
                   <div className="p-4 border-b flex justify-between items-center bg-purple-50 rounded-t-xl">
                       <h3 className="font-bold text-lg text-purple-900">配息公告</h3>
                       <button onClick={()=>setShowAnnoModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
                   </div>
                   <div className="flex-1 overflow-auto p-4">
                       <table className="w-full text-sm">
                           <thead className="bg-gray-100 text-gray-600 sticky top-0">
                               <tr>
                                   <th className="p-2 text-left">日期</th>
                                   <th className="p-2 text-left">代碼/名稱</th>
                                   <th className="p-2 text-left">分類</th>
                                   <th className="p-2 text-right">金額</th>
                                   <th className="p-2 text-center">狀態</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y">
                               {getAnnouncements().length === 0 ? (
                                   <tr><td colSpan={5} className="p-8 text-center text-gray-400">目前無未來配息公告資料</td></tr>
                               ) : getAnnouncements().map((d, i) => (
                                   <tr key={i} className="hover:bg-purple-50">
                                       <td className="p-2 font-mono text-purple-700">{d.exDate}</td>
                                       <td className="p-2">
                                           <div className="font-bold">{d.etfCode}</div>
                                           <div className="text-xs text-gray-500">{d.etfName}</div>
                                       </td>
                                       <td className="p-2">
                                           <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{d.category}</span>
                                       </td>
                                       <td className="p-2 text-right font-bold text-emerald-600">{fmt(d.amount)}</td>
                                       <td className="p-2 text-center text-orange-500 text-xs font-bold">{d.status}</td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               </div>
          </div>
       )}
    </div>
  );
};

export default TabDividends;