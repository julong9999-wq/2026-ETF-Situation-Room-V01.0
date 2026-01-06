import React, { useState, useEffect } from 'react';
import { 
    Search, 
    Link as LinkIcon,
    Database,
    Trash2,
    AlertTriangle,
    Zap
} from 'lucide-react';
import { UserRole } from '../types';
import { 
    importMarketData, 
    importBasicInfo, 
    importPriceData, 
    importDividendData, 
    importSizeData,
    importHistoryData,
    getMarketData,
    getBasicInfo,
    getPriceData,
    getDividendData,
    getSizeData,
    getHistoryData,
    clearAllData,
    injectDemoData
} from '../services/dataService';

interface AdminPanelProps {
  userRole: UserRole | null;
  onLoginSuccess: (role: UserRole, email: string) => void;
}

// Default URLs - These might expire, so we rely on Demo Data as fallback
const DEFAULT_URLS = {
    market: '',
    price: '',
    basic: '',
    dividend: '',
    size: '',
    history: ''
};

const URL_STORAGE_KEY = 'admin_csv_urls';

const AdminPanel: React.FC<AdminPanelProps> = ({ userRole, onLoginSuccess }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{id: string, msg: string, type: 'success' | 'error' | 'warning'} | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  
  const [urls, setUrls] = useState(DEFAULT_URLS);

  useEffect(() => {
      const savedUrls = localStorage.getItem(URL_STORAGE_KEY);
      if (savedUrls) {
          setUrls({ ...DEFAULT_URLS, ...JSON.parse(savedUrls) });
      }
      loadCounts();
  }, []);

  const loadCounts = async () => {
      const m = (await getMarketData()).length;
      const p = (await getPriceData()).length;
      const b = (await getBasicInfo()).length;
      const d = (await getDividendData()).length;
      const s = (await getSizeData()).length;
      const h = (await getHistoryData()).length;
      setCounts({ market: m, price: p, basic: b, dividend: d, size: s, history: h });
  };

  const handleInputChange = (type: string, value: string) => {
      const newUrls = { ...urls, [type]: value.trim() };
      setUrls(newUrls);
      localStorage.setItem(URL_STORAGE_KEY, JSON.stringify(newUrls));
  };

  const handleImport = async (type: 'market' | 'basic' | 'price' | 'dividend' | 'size' | 'history', name: string) => {
    if (processingId) return;
    const url = (urls as any)[type];
    if (!url) return alert(`請輸入 [${name}] 的 CSV 連結`);

    setProcessingId(type);
    setStatusMsg(null);
    
    try {
        let result = { count: 0, noChange: false };
        switch(type) {
            case 'market': result = await importMarketData(url); break;
            case 'price': result = await importPriceData(url); break;
            case 'basic': result = await importBasicInfo(url); break;
            case 'dividend': result = await importDividendData(url); break;
            case 'size': result = await importSizeData(url); break;
            case 'history': result = await importHistoryData(url); break;
        }

        if (result.noChange) {
            setStatusMsg({ id: type, msg: '資料相同 , 無匯入', type: 'warning' });
        } else {
            setStatusMsg({ id: type, msg: `成功! 目前共 ${result.count} 筆`, type: 'success' });
        }
        
        loadCounts();
    } catch (e: any) {
        setStatusMsg({ id: type, msg: `錯誤: ${e.message}`, type: 'error' });
    } finally {
        setProcessingId(null);
    }
  };

  const handleClearAll = () => {
      if (window.confirm('確定要清空所有資料庫嗎？此操作無法復原。')) {
          clearAllData();
          loadCounts();
          setStatusMsg({ id: 'ALL', msg: '已清空所有資料', type: 'success' });
      }
  };

  const handleDemoData = () => {
      if (window.confirm('這將會覆蓋現有資料並寫入測試數據，確定嗎？')) {
          try {
            injectDemoData();
            loadCounts();
            setStatusMsg({ id: 'DEMO', msg: '測試資料已寫入', type: 'success' });
            alert("測試資料寫入成功！請前往「資料分析」頁面查看。");
          } catch(e) {
            alert("寫入失敗");
          }
      }
  };

  const items = [
    { id: 'market', label: 'a. 國際大盤 (Market)' },
    { id: 'price', label: 'b. 每日股價 (Price)' },
    { id: 'basic', label: 'c. 基本資料 (Basic)' },
    { id: 'dividend', label: 'd. 除息資料 (Dividend)' },
    { id: 'size', label: 'e. 規模大小 (Size)' },
    { id: 'history', label: 'f. 歷史資料 (History)' },
  ];

  return (
    <div className="h-full w-full flex flex-col p-4 bg-primary-50">
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-primary-200 overflow-hidden flex flex-col relative">
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-5 flex justify-between items-center text-white shadow-md flex-none">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                        <Database className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-lg font-bold tracking-wide">資料庫維護中心</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleDemoData}
                        className="bg-yellow-400 hover:bg-yellow-300 text-yellow-900 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1 transition-all"
                    >
                        <Zap className="w-4 h-4" />
                        一鍵生成測試資料
                    </button>
                    <div className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full border border-white/20">
                        總筆數: {Object.values(counts).reduce((a: number, b: number) => a + b, 0).toLocaleString()}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-primary-50/30">
                <div className="grid gap-4">
                    {items.map((item) => {
                        const count = counts[item.id] || 0;
                        const hasData = count > 0;
                        const isProcessing = processingId === item.id;
                        const status = statusMsg?.id === item.id ? statusMsg : null;

                        return (
                            <div key={item.id} className="group bg-white rounded-lg border border-primary-100 p-4 shadow-sm hover:shadow-md hover:border-primary-300 transition-all duration-200 flex flex-col lg:flex-row lg:items-center gap-4">
                                <div className="flex items-center gap-3 w-full lg:w-1/3">
                                    <div className={`w-2 h-10 rounded-full ${hasData ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-gray-300'}`}></div>
                                    <div>
                                        <h3 className="text-base font-bold text-primary-900">{item.label}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-sm font-mono font-bold ${hasData ? 'text-green-600' : 'text-gray-400'}`}>
                                                {count > 0 ? `${count.toLocaleString()} 筆` : '無資料'}
                                            </span>
                                            {status && (
                                                <span className={`text-sm animate-in fade-in flex items-center gap-1 
                                                    ${status.type === 'success' ? 'text-primary-600' : 
                                                      status.type === 'warning' ? 'text-amber-500' : 'text-red-500'}`}>
                                                    • {status.msg}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 w-full relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-300 group-hover:text-primary-500 transition-colors">
                                        <LinkIcon className="w-4 h-4" />
                                    </div>
                                    <input 
                                        type="text" 
                                        value={(urls as any)[item.id]}
                                        onChange={(e) => handleInputChange(item.id, e.target.value)}
                                        className="w-full pl-9 pr-3 py-2.5 bg-primary-50/50 border border-primary-100 rounded-lg text-sm text-primary-700 font-mono focus:bg-white focus:border-primary-400 focus:ring-4 focus:ring-primary-100 outline-none transition-all"
                                        placeholder="輸入 CSV 網址..."
                                    />
                                </div>

                                <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                                    <button 
                                        onClick={() => handleImport(item.id as any, item.label)}
                                        disabled={isProcessing}
                                        className={`
                                            h-10 px-5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 border
                                            ${isProcessing 
                                                ? 'bg-primary-50 text-primary-400 border-primary-100 cursor-wait' 
                                                : 'bg-primary-600 hover:bg-primary-700 text-white border-transparent shadow-primary-200'
                                            }
                                        `}
                                    >
                                        <Search className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                                        {isProcessing ? '處理中' : '匯入'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    <div className="mt-8 border-t border-red-100 pt-6">
                        <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2 rounded-full shadow-sm">
                                    <AlertTriangle className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-red-800">重置資料庫</h3>
                                    <p className="text-sm text-red-600">清除所有本地暫存資料 (Market, Basic, Price, Dividend, History)</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleClearAll}
                                className="px-5 py-2.5 bg-white text-red-600 border border-red-200 hover:bg-red-600 hover:text-white hover:border-transparent rounded-lg font-bold transition-all shadow-sm flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                全部清空
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default AdminPanel;