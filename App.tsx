import React, { useState, useEffect } from 'react';
import TabAnalysisHub from './components/TabAnalysisHub';
import TabExport from './components/TabExport';
import { clearAllData, checkAndFetchSystemData } from './services/dataService';
import { Loader2, RefreshCw, CheckCircle2, LayoutDashboard, TrendingUp, Download, Presentation, Settings, Power, RotateCcw, X, Info, Bell, Zap } from 'lucide-react';
import AdSenseBlock from './components/AdSenseBlock';

// --- SYSTEM VERSION CONTROL ---
const APP_VERSION = 'V.01.11'; // Internal Logic Version 
const DISPLAY_VERSION = 'V01.5'; // UI Display Version (Visual Test)
const STORAGE_VERSION_KEY = 'app_system_version';

// Placeholders
const TabPerformance = () => <div className="p-8 text-center text-primary-500 text-xl font-bold">績效分析功能區 (規劃中)</div>;

type NavItem = {
  id: string;
  name: string;
  icon: React.ElementType;
  component: React.ReactNode;
};

// --- SYSTEM MODAL COMPONENT ---
interface SystemModalProps {
    onClose: () => void;
    currentVersion: string;
    displayVersion: string;
}

const SystemModal: React.FC<SystemModalProps> = ({ onClose, currentVersion, displayVersion }) => {
    const [isReloading, setIsReloading] = useState(false);

    const handleSoftReload = () => {
        setIsReloading(true);
        setTimeout(() => window.location.reload(), 800);
    };

    const handleFactoryReset = () => {
        if (confirm('警告：這將刪除所有本地暫存的 CSV 資料並將系統還原至初始狀態。\n\n確定要執行嗎？')) {
            setIsReloading(true);
            clearAllData();
            localStorage.clear(); 
            setTimeout(() => window.location.reload(), 800);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Settings className="w-5 h-5" /> 系統設定與資訊
                    </h3>
                    <button onClick={onClose} className="hover:bg-slate-700 p-1 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* Version Info */}
                    <div className="text-center space-y-1">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Presentation className="w-8 h-8 text-slate-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">ETF 戰情室</h2>
                        <div className="flex justify-center gap-2 text-sm text-gray-500 font-mono">
                            <span className="bg-gray-100 px-2 py-0.5 rounded">UI: {displayVersion}</span>
                            <span className="bg-gray-100 px-2 py-0.5 rounded">Core: {currentVersion}</span>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 my-4"></div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">軟體更新</div>
                        <button 
                            onClick={handleSoftReload}
                            disabled={isReloading}
                            className="w-full flex items-center justify-between p-4 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-xl transition-all border border-primary-100 group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                                    <RefreshCw className={`w-5 h-5 ${isReloading ? 'animate-spin' : ''}`} />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-sm">重新載入 (檢查更新)</div>
                                    <div className="text-xs text-primary-400">重新整理頁面以取得最新版本</div>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-primary-300" />
                        </button>

                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mt-4">危險區域</div>
                        <button 
                            onClick={handleFactoryReset}
                            disabled={isReloading}
                            className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl transition-all border border-red-100 group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                                    <RotateCcw className="w-5 h-5 text-red-500" />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-sm">系統重置 (Factory Reset)</div>
                                    <div className="text-xs text-red-400">清除所有資料庫快取並修復異常</div>
                                </div>
                            </div>
                            <Power className="w-4 h-4 text-red-300" />
                        </button>
                    </div>
                </div>

                <div className="bg-gray-50 p-3 text-center text-xs text-gray-400">
                    System ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}
                </div>
            </div>
        </div>
    );
};
const ChevronRight = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6"/></svg>
);


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('ANALYSIS'); 
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isBackgroundUpdating, setIsBackgroundUpdating] = useState(false);
  const [lastUpdateStatus, setLastUpdateStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // New State for System Modal
  const [showSystemModal, setShowSystemModal] = useState(false);

  useEffect(() => {
    const initApp = async () => {
        const savedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
        const hasCachedMarket = !!localStorage.getItem('db_market_data');
        const isVersionMatch = savedVersion === APP_VERSION;

        if (!isVersionMatch) {
            console.log(`Version mismatch: Local(${savedVersion}) vs App(${APP_VERSION}). Cleaning up...`);
            clearAllData(); 
            localStorage.removeItem('admin_csv_urls'); 
            localStorage.setItem(STORAGE_VERSION_KEY, APP_VERSION);
            setIsInitializing(true);
        } else if (hasCachedMarket) {
            setIsInitializing(false);
        }

        const dbKeys = ['db_basic_info', 'db_market_data', 'db_price_data', 'db_dividend_data', 'db_size_data'];
        dbKeys.forEach(key => {
            const val = localStorage.getItem(key);
            if (val && (val.includes('<!DOCTYPE') || val.includes('<html') || val.includes('檔案可能已遭到移動'))) {
                localStorage.removeItem(key);
            }
        });

        setIsBackgroundUpdating(true);
        try {
            await checkAndFetchSystemData();
            setLastUpdateStatus('success');
            setTimeout(() => setLastUpdateStatus('idle'), 3000);
        } catch (e) {
            console.error("Background update failed", e);
            setLastUpdateStatus('error');
        } finally {
            setIsBackgroundUpdating(false);
            setIsInitializing(false); 
        }
    };

    initApp();
  }, []);

  const navItems: NavItem[] = [
    {
      id: 'ANALYSIS',
      name: '資料分析',
      icon: LayoutDashboard,
      component: <TabAnalysisHub />
    },
    {
      id: 'PERFORMANCE',
      name: '績效分析',
      icon: TrendingUp,
      component: <TabPerformance />
    },
    {
      id: 'EXPORT',
      name: '表單匯出',
      icon: Download,
      component: <TabExport />
    }
  ];

  const getCurrentComponent = () => {
    const item = navItems.find(i => i.id === activeTab);
    return item ? item.component : <TabAnalysisHub />;
  };

  if (isInitializing) {
      return (
          <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-700">
              <Loader2 className="w-16 h-16 animate-spin mb-6 text-slate-600" />
              <h2 className="text-2xl font-bold mb-2">系統升級中 (V01.5)...</h2>
              <div className="bg-white/50 px-6 py-4 rounded-xl text-center border border-slate-200 max-w-sm">
                  <p className="text-sm text-slate-600 font-bold mb-1">正在套用新的視覺介面</p>
                  <p className="text-xs text-slate-400">系統正在重新建立資料庫結構 (約 10-15 秒)</p>
              </div>
          </div>
      );
  }

  // --- VISUAL CHANGE: Use slate-900 instead of primary-900 for Sidebar to confirm update ---
  return (
    <div className="flex h-screen bg-primary-50 overflow-hidden">
      {/* Sidebar - NOW DARK GRAY (SLATE-900) */}
      <div className={`${sidebarOpen ? 'w-60' : 'w-20'} bg-slate-900 text-white transition-all duration-300 flex flex-col shadow-2xl z-20 border-r border-slate-800`}>
        <div className="p-5 border-b border-slate-800">
          <div className={`flex flex-col ${!sidebarOpen && 'items-center'}`}>
             <div className="flex items-center justify-between w-full mb-1">
                 <div className={`flex items-center gap-2 ${!sidebarOpen && 'hidden'}`}>
                    <Presentation className="w-6 h-6 text-white" />
                    <span className="font-bold text-lg tracking-wider truncate">ETF 戰情室</span>
                 </div>
                 <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-200 hover:text-white">
                    <span className="text-xl">☰</span>
                 </button>
             </div>
             
             {/* Status Indicators */}
             <div className={`${!sidebarOpen && 'hidden'} px-1 flex items-center h-5 mt-1`}>
                {isBackgroundUpdating ? (
                    <div className="flex items-center gap-1 text-xs text-amber-300 animate-pulse" title="背景資料更新中...">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>更新中</span>
                    </div>
                ) : lastUpdateStatus === 'success' ? (
                    <div className="flex items-center gap-1 text-xs text-green-300 animate-in fade-in zoom-in">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>已最新</span>
                    </div>
                ) : null}
             </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 flex flex-col">
          <nav className="space-y-1.5 px-2 flex-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 mb-1 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 border border-blue-500' 
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
                  } ${!sidebarOpen && 'justify-center'}`}
                >
                  <span className={`${sidebarOpen ? 'mr-3' : ''}`}>
                      <Icon className="w-5 h-5" />
                  </span>
                  {sidebarOpen && <span className="text-base font-bold tracking-wide">{item.name}</span>}
                </button>
              );
            })}
          </nav>
          
          {/* V1.5 Visual Confirmation Block */}
          {sidebarOpen && (
            <div className="mx-2 mb-2 p-3 bg-emerald-900/30 rounded-lg border border-emerald-500/30 shadow-inner group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1 opacity-20">
                     <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                </div>
                <div className="text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1.5 relative z-10">
                    <Zap className="w-3.5 h-3.5 fill-emerald-400" /> 
                    <span>更新測試成功</span>
                </div>
                <p className="text-[10px] text-emerald-100/80 leading-relaxed font-mono relative z-10">
                    目前版本: <span className="text-white font-bold">{DISPLAY_VERSION}</span><br/>
                    介面已切換為深色風格。
                </p>
                <button 
                    onClick={() => window.location.reload()}
                    className="mt-2 w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] rounded flex items-center justify-center gap-1 transition-colors"
                >
                    <RefreshCw className="w-3 h-3" /> 強制重新整理
                </button>
            </div>
          )}

          {/* SIDEBAR AD SLOT */}
          {sidebarOpen && (
              <div className="px-4 pb-2 mt-auto">
                 <AdSenseBlock 
                    slot="1234567890" 
                    format="rectangle"
                    style={{ minHeight: '150px', width: '100%' }}
                    className="rounded-lg overflow-hidden opacity-90 hover:opacity-100 transition-opacity"
                    label="贊助廣告"
                 />
              </div>
          )}
        </div>

        {/* Footer */}
        <div 
            onClick={() => setShowSystemModal(true)}
            className="p-4 border-t border-slate-800 bg-slate-950/50 cursor-pointer hover:bg-slate-800/50 transition-colors group"
        >
            <div className={`flex flex-col items-center ${sidebarOpen ? 'items-start' : 'items-center'}`}>
                {sidebarOpen ? (
                    <div className="w-full flex justify-between items-end">
                        <div>
                            <p className="text-sm font-bold text-white tracking-wide">julong chen</p>
                            <p className="text-xs text-slate-400 mt-0.5">版本 {DISPLAY_VERSION}</p>
                        </div>
                        <Settings className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:rotate-90 transition-all" />
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1">
                        <div className="text-xs text-slate-500 font-mono text-center">
                            <div>V01</div>
                            <div>.5</div>
                        </div>
                        <Settings className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white shadow-sm border-b border-primary-200 p-4 flex justify-between items-center md:hidden z-10">
            <div className="flex items-center gap-2">
                <Presentation className="w-5 h-5 text-slate-900" />
                <div className="font-bold text-slate-900 text-lg">ETF 戰情室</div>
            </div>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-700"><span className="text-xl">☰</span></button>
        </header>
        <main className="flex-1 overflow-hidden relative bg-primary-50">
          {getCurrentComponent()}
        </main>
      </div>

      {showSystemModal && (
          <SystemModal 
            onClose={() => setShowSystemModal(false)}
            currentVersion={APP_VERSION}
            displayVersion={DISPLAY_VERSION}
          />
      )}
    </div>
  );
};

export default App;