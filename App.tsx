import React, { useState, useEffect } from 'react';
import TabAnalysisHub from './components/TabAnalysisHub';
import TabExport from './components/TabExport';
import { clearAllData, checkAndFetchSystemData } from './services/dataService';
import { Loader2, RefreshCw, CheckCircle2, LayoutDashboard, TrendingUp, Download, Presentation, Settings, Power, RotateCcw, X, CloudLightning, Zap, ArrowRight } from 'lucide-react';
import AdSenseBlock from './components/AdSenseBlock';

// --- SYSTEM VERSION CONTROL ---
const APP_VERSION = 'V.01.17'; // Internal Logic Version 
const DISPLAY_VERSION = 'V1.11'; // UI Display Version (Fix Update Logic)
const STORAGE_VERSION_KEY = 'app_system_version';

// Placeholders
const TabPerformance = () => <div className="p-8 text-center text-blue-500 text-xl font-bold">績效分析功能區 (規劃中)</div>;

type NavItem = {
  id: string;
  name: string;
  icon: React.ElementType;
  component: React.ReactNode;
};

// --- UPDATE PROMPT COMPONENT ---
const UpdateOverlay = ({ serverVersion, onUpdate }: { serverVersion: string, onUpdate: () => void }) => (
    <div className="fixed inset-0 z-[100] bg-blue-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white animate-in fade-in duration-300">
        <div className="bg-white/10 p-6 rounded-full mb-6 animate-bounce">
            <CloudLightning className="w-16 h-16 text-yellow-400" />
        </div>
        <h1 className="text-3xl font-bold mb-4 text-center">發現新版本 {serverVersion}</h1>
        <p className="text-blue-200 mb-8 text-center max-w-md text-lg">
            系統已發布更新 (V1.11)。我們優化了更新機制，解決了點擊更新無效的問題。
        </p>
        <button 
            onClick={onUpdate}
            className="group relative bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold text-xl px-8 py-4 rounded-xl shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
        >
            <span>立即更新</span>
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
        <div className="mt-8 text-sm text-blue-300/60 font-mono">Current: {DISPLAY_VERSION}</div>
    </div>
);

// --- SYSTEM MODAL COMPONENT ---
interface SystemModalProps {
    onClose: () => void;
    currentVersion: string;
    displayVersion: string;
}

const SystemModal: React.FC<SystemModalProps> = ({ onClose, currentVersion, displayVersion }) => {
    const [isReloading, setIsReloading] = useState(false);

    const handleSoftReload = async () => {
        setIsReloading(true);
        console.log("Executing Aggressive Reload...");

        // 1. Try to clear Service Worker Caches (if any)
        if ('caches' in window) {
            try {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
                console.log("Caches cleared.");
            } catch (e) {
                console.warn("Failed to clear caches:", e);
            }
        }

        // 2. Force Navigation to a fresh URL
        // We append a timestamp to the URL to force the browser to treat it as a new page request
        // ignoring any cached index.html
        setTimeout(() => {
            const url = new URL(window.location.href);
            // Remove old timestamp if exists to keep URL clean(er)
            url.searchParams.delete('t'); 
            url.searchParams.set('t', Date.now().toString());
            window.location.href = url.toString();
        }, 100);
    };

    const handleFactoryReset = () => {
        if (confirm('警告：這將刪除所有本地暫存的 CSV 資料並將系統還原至初始狀態。\n\n確定要執行嗎？')) {
            setIsReloading(true);
            clearAllData();
            localStorage.clear(); 
            setTimeout(() => window.location.reload(), 500);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="bg-blue-800 text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Settings className="w-5 h-5" /> 系統設定與資訊
                    </h3>
                    <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* Version Info */}
                    <div className="text-center space-y-1">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CloudLightning className="w-8 h-8 text-blue-600" />
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
                            className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-all border border-blue-100 group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                                    <RefreshCw className={`w-5 h-5 ${isReloading ? 'animate-spin' : ''}`} />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-sm">強制重新整理 (強力版)</div>
                                    <div className="text-xs text-blue-400">清除快取並強制重載</div>
                                </div>
                            </div>
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
                                    <div className="text-xs text-red-400">清除所有資料庫快取</div>
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


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('ANALYSIS'); 
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isBackgroundUpdating, setIsBackgroundUpdating] = useState(false);
  const [lastUpdateStatus, setLastUpdateStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showSystemModal, setShowSystemModal] = useState(false);
  
  // New State for Auto Update
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);

  // --- AUTO UPDATER LOGIC ---
  const checkForUpdates = async () => {
      try {
          console.log("Checking for updates...");
          // Add random query param to bypass Vercel/Browser Cache
          const response = await fetch(`./metadata.json?t=${new Date().getTime()}`);
          if (response.ok) {
              const data = await response.json();
              const serverVersion = data.version; 
              
              // Simple string compare. If server != local, update.
              if (serverVersion && serverVersion !== DISPLAY_VERSION) {
                  console.log(`Update Detected: Server(${serverVersion}) vs Local(${DISPLAY_VERSION})`);
                  setUpdateAvailable(serverVersion);
                  return true;
              }
          }
      } catch (e) {
          console.error("Failed to check version", e);
      }
      return false;
  };

  useEffect(() => {
    const initApp = async () => {
        // 1. Check for updates FIRST
        const hasUpdate = await checkForUpdates();
        
        // If update detected, STOP everything and show the overlay.
        if (hasUpdate) {
             setIsInitializing(false);
             return; 
        }

        const savedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
        const hasCachedMarket = !!localStorage.getItem('db_market_data');
        const isVersionMatch = savedVersion === APP_VERSION;

        if (!isVersionMatch) {
            console.log(`Logic Version mismatch: Local(${savedVersion}) vs App(${APP_VERSION}). Cleaning up...`);
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

  const handleUpdateClick = async () => {
      // Use the same Aggressive Reload Logic as SystemModal
      if ('caches' in window) {
          try {
              const keys = await caches.keys();
              await Promise.all(keys.map(key => caches.delete(key)));
          } catch (e) {}
      }
      // Force navigation with timestamp query param
      const url = new URL(window.location.href);
      url.searchParams.delete('t');
      url.searchParams.set('t', Date.now().toString());
      window.location.href = url.toString();
  };

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

  // 1. Show Update Overlay if needed (Top Priority)
  if (updateAvailable) {
      return <UpdateOverlay serverVersion={updateAvailable} onUpdate={handleUpdateClick} />;
  }

  // 2. Show Loading
  if (isInitializing) {
      return (
          <div className="flex flex-col items-center justify-center h-screen bg-blue-50 text-blue-900">
              <Loader2 className="w-16 h-16 animate-spin mb-6 text-blue-600" />
              <h2 className="text-2xl font-bold mb-2">系統載入中 (V1.11)...</h2>
              <div className="bg-white/50 px-6 py-4 rounded-xl text-center border border-blue-200 max-w-sm">
                  <p className="text-sm text-blue-800 font-bold mb-1">正在套用藍色佈景主題</p>
              </div>
          </div>
      );
  }

  // --- MAIN LAYOUT (HARDCODED BLUE COLORS) ---
  return (
    <div className="flex h-screen bg-blue-50 overflow-hidden">
      {/* Sidebar - EXPLICIT BLUE 950 */}
      <div className={`${sidebarOpen ? 'w-60' : 'w-20'} bg-[#172554] text-white transition-all duration-300 flex flex-col shadow-2xl z-20 border-r border-blue-900`}>
        <div className="p-5 border-b border-blue-900">
          <div className={`flex flex-col ${!sidebarOpen && 'items-center'}`}>
             <div className="flex items-center justify-between w-full mb-1">
                 <div className={`flex items-center gap-2 ${!sidebarOpen && 'hidden'}`}>
                    <CloudLightning className="w-6 h-6 text-yellow-400" />
                    <span className="font-bold text-lg tracking-wider truncate">ETF 戰情室</span>
                 </div>
                 <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-blue-800 rounded-lg text-blue-200 hover:text-white">
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
                      : 'text-blue-200 hover:bg-blue-900 hover:text-white border border-transparent'
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
          
          {/* V1.11 Feature Highlight (Blue Style) */}
          {sidebarOpen && (
            <div className="mx-2 mb-2 p-3 bg-blue-900/50 rounded-lg border border-blue-800 shadow-inner group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1 opacity-20">
                     <CheckCircle2 className="w-12 h-12 text-blue-400" />
                </div>
                <div className="text-xs font-bold text-blue-300 mb-1 flex items-center gap-1.5 relative z-10">
                    <Zap className="w-3.5 h-3.5 fill-blue-400" /> 
                    <span>Version 1.11</span>
                </div>
                <p className="text-[10px] text-blue-200 leading-relaxed font-mono relative z-10">
                    更新機制優化: <br/>
                    強制清除快取並重載。
                </p>
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
            className="p-4 border-t border-blue-900 bg-[#172554] cursor-pointer hover:bg-blue-900 transition-colors group"
        >
            <div className={`flex flex-col items-center ${sidebarOpen ? 'items-start' : 'items-center'}`}>
                {sidebarOpen ? (
                    <div className="w-full flex justify-between items-end">
                        <div>
                            <p className="text-sm font-bold text-white tracking-wide">julong chen</p>
                            <p className="text-xs text-blue-400 mt-0.5">版本 {DISPLAY_VERSION}</p>
                        </div>
                        <Settings className="w-4 h-4 text-blue-500 group-hover:text-white group-hover:rotate-90 transition-all" />
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1">
                        <div className="text-xs text-blue-500 font-mono text-center">
                            <div>V1</div>
                            <div>.11</div>
                        </div>
                        <Settings className="w-3 h-3 text-blue-500 group-hover:text-blue-300" />
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white shadow-sm border-b border-blue-200 p-4 flex justify-between items-center md:hidden z-10">
            <div className="flex items-center gap-2">
                <Presentation className="w-5 h-5 text-blue-900" />
                <div className="font-bold text-blue-900 text-lg">ETF 戰情室</div>
            </div>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-blue-700"><span className="text-xl">☰</span></button>
        </header>
        <main className="flex-1 overflow-hidden relative bg-blue-50">
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