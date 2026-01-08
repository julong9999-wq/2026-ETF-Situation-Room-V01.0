import React, { useState, useEffect } from 'react';
import TabAnalysisHub from './components/TabAnalysisHub';
import TabExport from './components/TabExport';
import { clearAllData, checkAndFetchSystemData } from './services/dataService';
import { Loader2, RefreshCw, CheckCircle2, LayoutDashboard, TrendingUp, Download, Presentation, Settings, Power, RotateCcw, X, Info } from 'lucide-react';
import AdSenseBlock from './components/AdSenseBlock';

// --- SYSTEM VERSION CONTROL ---
const APP_VERSION = 'V.01.8'; // Internal Logic Version
const DISPLAY_VERSION = 'V01.3'; // UI Display Version (Testing Update Mechanism)
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
        // Standard reload - usually fetches new index.html if headers allow
        setTimeout(() => window.location.reload(), 800);
    };

    const handleFactoryReset = () => {
        if (confirm('警告：這將刪除所有本地暫存的 CSV 資料並將系統還原至初始狀態。\n\n確定要執行嗎？')) {
            setIsReloading(true);
            clearAllData();
            localStorage.clear(); // Wipe everything
            setTimeout(() => window.location.reload(), 800);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Settings className="w-5 h-5" /> 系統設定與資訊
                    </h3>
                    <button onClick={onClose} className="hover:bg-gray-700 p-1 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* Version Info */}
                    <div className="text-center space-y-1">
                        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Presentation className="w-8 h-8 text-primary-600" />
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
// Helper icon for button
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

  // --- 1. Version Check, 2. Corruption Healing, 3. AUTO DATA FETCH ---
  useEffect(() => {
    const initApp = async () => {
        // A. Version Check
        const savedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
        // Check if we have essential data cached to allow "Instant Load"
        const hasCachedMarket = !!localStorage.getItem('db_market_data');
        const isVersionMatch = savedVersion === APP_VERSION;

        if (!isVersionMatch) {
            console.log(`Version mismatch: Local(${savedVersion}) vs App(${APP_VERSION}). Cleaning up...`);
            clearAllData(); 
            localStorage.removeItem('admin_csv_urls'); 
            localStorage.setItem(STORAGE_VERSION_KEY, APP_VERSION);
            // Must block UI if version changed (schema might have changed)
            setIsInitializing(true);
        } else if (hasCachedMarket) {
            // OPTIMIZATION: If we have data and version matches, let user in IMMEDIATELY
            setIsInitializing(false);
        }

        // B. Corruption Check
        const dbKeys = ['db_basic_info', 'db_market_data', 'db_price_data', 'db_dividend_data', 'db_size_data'];
        dbKeys.forEach(key => {
            const val = localStorage.getItem(key);
            if (val && (val.includes('<!DOCTYPE') || val.includes('<html') || val.includes('檔案可能已遭到移動'))) {
                console.error(`Detected corruption in ${key}`);
                localStorage.removeItem(key);
            }
        });

        // C. Data Fetch Strategy
        // If we are already initialized (optimistic load), this runs in background.
        // If we are waiting (first run), this runs and then sets initializing to false.
        setIsBackgroundUpdating(true);
        
        try {
            await checkAndFetchSystemData();
            setLastUpdateStatus('success');
            // Auto hide success status after 3 seconds
            setTimeout(() => setLastUpdateStatus('idle'), 3000);
        } catch (e) {
            console.error("Background update failed", e);
            setLastUpdateStatus('error');
        } finally {
            setIsBackgroundUpdating(false);
            setIsInitializing(false); // Ensure loader is gone in all cases
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
          <div className="flex flex-col items-center justify-center h-screen bg-primary-50 text-primary-700">
              <Loader2 className="w-16 h-16 animate-spin mb-6 text-primary-600" />
              <h2 className="text-2xl font-bold mb-2">系統更新中...</h2>
              <div className="bg-white/50 px-6 py-4 rounded-xl text-center border border-primary-100 max-w-sm">
                  <p className="text-sm text-primary-600 font-bold mb-1">正在升級至版本 {DISPLAY_VERSION}</p>
                  <p className="text-xs text-primary-400">系統正在重新建立資料庫結構 (約 10-15 秒)</p>
                  <p className="text-xs text-primary-400 mt-1">請勿關閉視窗，完成後將自動進入。</p>
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-primary-50 overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-60' : 'w-20'} bg-primary-900 text-white transition-all duration-300 flex flex-col shadow-2xl z-20 border-r border-primary-800`}>
        <div className="p-5 border-b border-primary-800">
          <div className={`flex flex-col ${!sidebarOpen && 'items-center'}`}>
             <div className="flex items-center justify-between w-full mb-1">
                 <div className={`flex items-center gap-2 ${!sidebarOpen && 'hidden'}`}>
                    <Presentation className="w-6 h-6 text-white" />
                    <span className="font-bold text-lg tracking-wider truncate">ETF 戰情室</span>
                 </div>
                 <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-primary-800 rounded-lg text-primary-200 hover:text-white">
                    <span className="text-xl">☰</span>
                 </button>
             </div>
             
             {/* Status Indicators (No Version Text at top) */}
             <div className={`${!sidebarOpen && 'hidden'} px-1 flex items-center h-5 mt-1`}>
                {/* Background Sync Indicator */}
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
                      ? 'bg-primary-700 text-white shadow-lg shadow-primary-950/30 border border-primary-600' 
                      : 'text-primary-200 hover:bg-primary-800 hover:text-white border border-transparent'
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
          
          {/* New Functional Slogans Section */}
          {sidebarOpen && (
            <div className="px-4 py-3 mb-2 mx-2 bg-primary-800/50 rounded-lg border border-primary-700/50">
                <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-primary-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
                    系統核心目標
                </div>
                <div className="space-y-1">
                    <div className="text-xs text-primary-100 flex items-center gap-2">
                        <span className="text-amber-400">⚡</span> 數據驅動精準決策
                    </div>
                    <div className="text-xs text-primary-100 flex items-center gap-2">
                        <span className="text-sky-400">💎</span> 洞察全市場獲利契機
                    </div>
                </div>
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

        {/* Footer: Author & Version (INTERACTIVE) */}
        <div 
            onClick={() => setShowSystemModal(true)}
            className="p-4 border-t border-primary-800 bg-primary-950/50 cursor-pointer hover:bg-primary-800/50 transition-colors group"
        >
            <div className={`flex flex-col items-center ${sidebarOpen ? 'items-start' : 'items-center'}`}>
                {sidebarOpen ? (
                    <div className="w-full flex justify-between items-end">
                        <div>
                            <p className="text-sm font-bold text-white tracking-wide">julong chen</p>
                            <p className="text-xs text-primary-400 mt-0.5">版本 {DISPLAY_VERSION}</p>
                        </div>
                        <Settings className="w-4 h-4 text-primary-500 group-hover:text-white group-hover:rotate-90 transition-all" />
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1">
                        <div className="text-xs text-primary-500 font-mono text-center">
                            <div>V01</div>
                            <div>.3</div>
                        </div>
                        <Settings className="w-3 h-3 text-primary-600 group-hover:text-primary-400" />
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white shadow-sm border-b border-primary-200 p-4 flex justify-between items-center md:hidden z-10">
            <div className="flex items-center gap-2">
                <Presentation className="w-5 h-5 text-primary-900" />
                <div className="font-bold text-primary-900 text-lg">ETF 戰情室</div>
                <div className="flex items-center gap-2">
                     {isBackgroundUpdating && <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />}
                </div>
            </div>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-primary-700"><span className="text-xl">☰</span></button>
        </header>
        <main className="flex-1 overflow-hidden relative bg-primary-50">
          {getCurrentComponent()}
        </main>
      </div>

      {/* RENDER SYSTEM MODAL */}
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