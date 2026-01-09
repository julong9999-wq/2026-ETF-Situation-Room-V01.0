import React, { useState, useEffect } from 'react';
import TabAnalysisHub from './components/TabAnalysisHub';
import TabExport from './components/TabExport';
import { clearAllData, checkAndFetchSystemData } from './services/dataService';
import { Loader2, RefreshCw, CheckCircle2, LayoutDashboard, TrendingUp, Download, Presentation, Settings, Power, RotateCcw, X, CloudLightning, Zap, ArrowRight, Moon, Search, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import AdSenseBlock from './components/AdSenseBlock';

// --- SYSTEM VERSION CONTROL ---
const APP_VERSION = 'V.01.38'; // Internal Logic Version (Bumped for V1.32)
const DISPLAY_VERSION = 'V1.32'; // UI Display Version
const BUILD_TIME = new Date().toLocaleString('zh-TW', { hour12: false }); // Captures build time
const STORAGE_VERSION_KEY = 'app_system_version';

// Placeholders
const TabPerformance = () => <div className="p-8 text-center text-violet-500 text-xl font-bold">績效分析功能區 (規劃中)</div>;

type NavItem = {
  id: string;
  name: string;
  icon: React.ElementType;
  component: React.ReactNode;
};

// --- UPDATE PROMPT COMPONENT ---
const UpdateOverlay = ({ serverVersion, onUpdate }: { serverVersion: string, onUpdate: () => void }) => (
    <div className="fixed inset-0 z-[100] bg-violet-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white animate-in fade-in duration-300">
        <div className="bg-white/10 p-6 rounded-full mb-6 animate-bounce">
            <Zap className="w-16 h-16 text-yellow-300 fill-yellow-300" />
        </div>
        <h1 className="text-3xl font-bold mb-4 text-center">偵測到版本更新 {serverVersion}</h1>
        <p className="text-violet-200 mb-8 text-center max-w-md text-lg">
            新版本 {serverVersion} 已發布，請立即更新以獲取最佳體驗。
        </p>
        <button 
            onClick={onUpdate}
            className="group relative bg-white hover:bg-gray-100 text-violet-900 font-bold text-xl px-10 py-4 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
        >
            <span>立即更新 {serverVersion}</span>
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
        <div className="mt-8 text-sm text-violet-400/60 font-mono">Current: {DISPLAY_VERSION}</div>
    </div>
);

// --- SYSTEM MODAL COMPONENT ---
interface SystemModalProps {
    onClose: () => void;
    currentVersion: string;
    displayVersion: string;
    buildTime: string;
    onCheckUpdate: () => Promise<string>;
}

const SystemModal: React.FC<SystemModalProps> = ({ onClose, currentVersion, displayVersion, buildTime, onCheckUpdate }) => {
    const [isReloading, setIsReloading] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [checkResult, setCheckResult] = useState<string | null>(null);

    const handleSoftReload = async () => {
        setIsReloading(true);
        // 1. Unregister Service Workers (PWA killer)
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
            } catch(e) { console.warn(e); }
        }
        // 2. Clear Cache Storage
        if ('caches' in window) {
            try {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
            } catch (e) { console.warn(e); }
        }
        // 3. Force Navigation with Timestamp to bust cache
        const timestamp = Date.now();
        window.location.href = window.location.pathname + '?v=' + timestamp;
    };

    const handleCheckUpdateClick = async () => {
        setIsChecking(true);
        setCheckResult(null);
        const result = await onCheckUpdate();
        setIsChecking(false);
        setCheckResult(result);
    };

    const handleFactoryReset = () => {
        if (confirm('警告：這將刪除所有本地暫存的 CSV 資料並將系統還原至初始狀態。\n\n確定要執行嗎？')) {
            setIsReloading(true);
            clearAllData();
            localStorage.clear(); 
            setTimeout(() => {
                window.location.href = window.location.pathname + '?reset=' + Date.now();
            }, 500);
        }
    };

    // Snapshot URL Detection Logic
    const isSnapshotUrl = window.location.hostname.includes('vercel.app') && 
                          window.location.hostname.split('-').length > 4; // Rudimentary check for long hash URL

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-violet-900 text-white p-4 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Settings className="w-5 h-5" /> 系統設定與資訊
                    </h3>
                    <button onClick={onClose} className="hover:bg-violet-700 p-1 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Version Info */}
                    <div className="text-center space-y-1">
                        <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <ShieldCheck className="w-8 h-8 text-violet-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">ETF 戰情室</h2>
                        <div className="flex justify-center gap-2 text-sm text-gray-500 font-mono">
                            <span className="bg-gray-100 px-2 py-0.5 rounded">UI: {displayVersion}</span>
                            <span className="bg-gray-100 px-2 py-0.5 rounded">Core: {currentVersion}</span>
                        </div>
                        <div className="text-xs text-gray-400 font-mono mt-1">Built: {buildTime}</div>
                        
                        {isSnapshotUrl && (
                            <div className="mt-3 bg-amber-50 border border-amber-200 p-2 rounded text-xs text-amber-700 flex items-start gap-2 text-left">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <div>
                                    <span className="font-bold">注意：</span> 您目前使用的是歷史快照網址 (Snapshot)，此網址不會自動更新。請使用短網址以獲取最新版本。
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-100 my-4"></div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">維護選項</div>
                        
                         <button 
                            onClick={handleCheckUpdateClick}
                            disabled={isChecking}
                            className="w-full flex flex-col p-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl transition-all border border-emerald-100 group"
                        >
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white p-2 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                                        <Search className={`w-5 h-5 text-emerald-500 ${isChecking ? 'animate-pulse' : ''}`} />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-sm">檢查是否有新版本</div>
                                        <div className="text-xs text-emerald-600 opacity-70">連線伺服器比對 Metadata</div>
                                    </div>
                                </div>
                                {isChecking && <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />}
                            </div>
                            
                            {/* Inline Check Result */}
                            {checkResult && (
                                <div className="mt-3 w-full bg-white/50 p-2 rounded text-xs text-left font-mono text-emerald-800 border border-emerald-100 whitespace-pre-wrap">
                                    {checkResult}
                                </div>
                            )}
                        </button>

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
                                    <div className="font-bold text-sm">強制重新整理</div>
                                    <div className="text-xs text-blue-400">清除快取並強制從伺服器下載</div>
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

                <div className="bg-gray-50 p-3 text-center text-xs text-gray-400 shrink-0">
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

  // --- AUTO UPDATER LOGIC (DUAL FALLBACK & AGGRESSIVE CACHE BUSTING) ---
  const checkForUpdates = async (manual = false): Promise<string> => {
      try {
          if (window.location.protocol === 'file:') {
              return "本機檔案模式 (File Protocol) 無法使用自動更新功能。";
          }

          console.log("Checking for updates...");
          let serverVersion = null;
          let source = 'metadata';

          // 1. Try metadata.json with NO-STORE headers
          try {
              const targetUrl = new URL('metadata.json', window.location.href).href;
              const response = await fetch(`${targetUrl}?t=${Date.now()}`, {
                  cache: 'no-store', // Force network
                  headers: {
                      'Pragma': 'no-cache',
                      'Cache-Control': 'no-cache'
                  }
              });
              
              if (response.ok) {
                  const data = await response.json();
                  serverVersion = data.version;
              } else {
                  console.warn(`metadata.json check failed: ${response.status}. Trying fallback.`);
              }
          } catch (e) {
              console.warn("metadata.json fetch error", e);
          }

          // 2. Fallback to index.html parsing if metadata failed
          if (!serverVersion) {
              source = 'html_fallback';
              try {
                  console.log("Attempting HTML fallback check...");
                  // Use window.location.origin to get the root domain, avoiding specific file paths
                  const pageUrl = window.location.origin + window.location.pathname;
                  const response = await fetch(`${pageUrl}?t=${Date.now()}`, { 
                      cache: 'no-store',
                      headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
                  });
                  if (response.ok) {
                      const text = await response.text();
                      const match = text.match(/<title>.*?ETF Master Dashboard (V\d+\.\d+).*?<\/title>/i);
                      if (match && match[1]) {
                          serverVersion = match[1];
                      }
                  }
              } catch (e) {
                  console.error("Fallback check failed", e);
              }
          }

          if (serverVersion && serverVersion !== DISPLAY_VERSION) {
               console.log(`Update Detected (${source}): Server(${serverVersion}) vs Local(${DISPLAY_VERSION})`);
               setUpdateAvailable(serverVersion);
               return `偵測到新版本 ${serverVersion}！(來源: ${source})\n請點擊更新按鈕。`;
          } else {
               if (serverVersion) {
                   return `檢查結果：目前已是最新。\n\n伺服器版本: ${serverVersion}\n本地版本: ${DISPLAY_VERSION}\n來源: ${source}`;
               } else {
                   return `檢查更新失敗：無法讀取伺服器版本資訊 (Metadata/HTML 皆失敗)`;
               }
          }

      } catch (e: any) {
          console.error("Failed to check version", e);
          return `檢查過程發生錯誤: ${e.message}`;
      }
      return "";
  };

  useEffect(() => {
    const initApp = async () => {
        // 1. Check for updates FIRST (Silent check)
        const checkMsg = await checkForUpdates(false);
        // The check function sets updateAvailable state internally if found
        
        // If update detected, STOP everything and show the overlay.
        // We rely on the state update in checkForUpdates to trigger re-render with overlay.
        
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
      // 1. Unregister Service Workers
      if ('serviceWorker' in navigator) {
          try {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (const registration of registrations) {
                  await registration.unregister();
              }
          } catch(e) {}
      }
      // 2. Clear Caches
      if ('caches' in window) {
          try {
              const keys = await caches.keys();
              await Promise.all(keys.map(key => caches.delete(key)));
          } catch (e) {}
      }
      // 3. Force navigation with timestamp and replace
      const timestamp = Date.now();
      window.location.href = window.location.pathname + '?v=' + timestamp;
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
          <div className="flex flex-col items-center justify-center h-screen bg-violet-50 text-violet-900">
              <Loader2 className="w-16 h-16 animate-spin mb-6 text-violet-600" />
              <h2 className="text-2xl font-bold mb-2">系統載入中 ({DISPLAY_VERSION})...</h2>
              <div className="bg-white/50 px-6 py-4 rounded-xl text-center border border-violet-200 max-w-sm">
                  <p className="text-sm text-violet-800 font-bold mb-1">正在套用 {DISPLAY_VERSION} 更新</p>
                  <p className="text-xs text-violet-600">優化更新檢查機制</p>
              </div>
          </div>
      );
  }

  // --- MAIN LAYOUT (UPDATED TO VIOLET THEME V1.32) ---
  return (
    <div className="flex h-screen bg-violet-50 overflow-hidden">
      {/* Sidebar - VIOLET 950 for V1.32 */}
      <div className={`${sidebarOpen ? 'w-60' : 'w-20'} bg-violet-950 text-white transition-all duration-300 flex flex-col shadow-2xl z-20 border-r border-violet-900`}>
        <div className="p-5 border-b border-violet-800 bg-[#2e1065]">
          <div className={`flex flex-col ${!sidebarOpen && 'items-center'}`}>
             <div className="flex items-center justify-between w-full mb-1">
                 <div className={`flex items-center gap-2 ${!sidebarOpen && 'hidden'}`}>
                    <CloudLightning className="w-6 h-6 text-yellow-400" />
                    <span className="font-bold text-lg tracking-wider truncate">ETF 戰情室</span>
                 </div>
                 <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-violet-800 rounded-lg text-violet-400 hover:text-white">
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
        
        <div className="flex-1 overflow-y-auto py-4 flex flex-col bg-violet-950">
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
                      ? 'bg-violet-800 text-white shadow-lg border border-violet-700' 
                      : 'text-violet-400 hover:bg-violet-800 hover:text-white border border-transparent'
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
          
          {/* V1.32 Feature Highlight */}
          {sidebarOpen && (
            <div className="mx-2 mb-2 p-3 bg-violet-900/50 rounded-lg border border-violet-800 shadow-inner group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1 opacity-20">
                     <Moon className="w-12 h-12 text-violet-500" />
                </div>
                <div className="text-xs font-bold text-violet-300 mb-1 flex items-center gap-1.5 relative z-10">
                    <Zap className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" /> 
                    <span>Version {DISPLAY_VERSION}</span>
                </div>
                <p className="text-[10px] text-violet-400 leading-relaxed font-mono relative z-10">
                    Violet Theme Edition<br/>
                    Build: {BUILD_TIME.split(' ')[0]}
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
            className="p-4 border-t border-violet-900 bg-[#2e1065] cursor-pointer hover:bg-violet-900 transition-colors group"
        >
            <div className={`flex flex-col items-center ${sidebarOpen ? 'items-start' : 'items-center'}`}>
                {sidebarOpen ? (
                    <div className="w-full flex justify-between items-end">
                        <div>
                            <p className="text-sm font-bold text-white tracking-wide">julong chen</p>
                            <div className="flex items-center gap-1">
                                <p className="text-xs text-violet-400 mt-0.5">版本 {DISPLAY_VERSION}</p>
                                <span className="text-[9px] text-violet-500 opacity-70 border border-violet-700 px-1 rounded">{BUILD_TIME.split(' ')[0]}</span>
                            </div>
                        </div>
                        <Settings className="w-4 h-4 text-violet-400 group-hover:text-white group-hover:rotate-90 transition-all" />
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1">
                        <div className="text-xs text-violet-500 font-mono text-center">
                            <div>V1</div>
                            <div>.{DISPLAY_VERSION.split('.')[1]}</div>
                        </div>
                        <Settings className="w-3 h-3 text-violet-400 group-hover:text-violet-300" />
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white shadow-sm border-b border-violet-200 p-4 flex justify-between items-center md:hidden z-10">
            <div className="flex items-center gap-2">
                <Presentation className="w-5 h-5 text-violet-900" />
                <div className="font-bold text-violet-900 text-lg">ETF 戰情室</div>
            </div>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-violet-700"><span className="text-xl">☰</span></button>
        </header>
        <main className="flex-1 overflow-hidden relative bg-violet-50">
          {getCurrentComponent()}
        </main>
      </div>

      {showSystemModal && (
          <SystemModal 
            onClose={() => setShowSystemModal(false)}
            currentVersion={APP_VERSION}
            displayVersion={DISPLAY_VERSION}
            buildTime={BUILD_TIME}
            onCheckUpdate={() => checkForUpdates(true)}
          />
      )}
    </div>
  );
};

export default App;