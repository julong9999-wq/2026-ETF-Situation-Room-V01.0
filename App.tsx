import React, { useState, useEffect } from 'react';
import TabAnalysisHub from './components/TabAnalysisHub';
import TabExport from './components/TabExport';
import { clearAllData, checkAndFetchSystemData } from './services/dataService';
import { Loader2, RefreshCw, CheckCircle2, LayoutDashboard, TrendingUp, Download, Presentation, Settings, Power, RotateCcw, X, CloudLightning, Zap, ArrowRight, Moon, Search, Clock, ShieldCheck } from 'lucide-react';
import AdSenseBlock from './components/AdSenseBlock';

// --- SYSTEM VERSION CONTROL ---
const APP_VERSION = 'V.01.00'; // Reset Logic Version
const DISPLAY_VERSION = 'V01.0'; // UI Display Version
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
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white animate-in fade-in duration-300">
        <div className="bg-white/10 p-6 rounded-full mb-6 animate-bounce">
            <Zap className="w-16 h-16 text-yellow-300 fill-yellow-300" />
        </div>
        <h1 className="text-3xl font-bold mb-4 text-center">偵測到版本更新 {serverVersion}</h1>
        <p className="text-slate-200 mb-8 text-center max-w-md text-lg">
            新版本 {serverVersion} 已發布，請立即更新以獲取最佳體驗。
        </p>
        <button 
            onClick={onUpdate}
            className="group relative bg-white hover:bg-gray-100 text-slate-900 font-bold text-xl px-10 py-4 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
        >
            <span>立即更新 {serverVersion}</span>
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
        <div className="mt-8 text-sm text-slate-400/60 font-mono">Current: {DISPLAY_VERSION}</div>
    </div>
);

// --- SYSTEM MODAL COMPONENT ---
interface SystemModalProps {
    onClose: () => void;
    currentVersion: string;
    displayVersion: string;
    onCheckUpdate: () => Promise<string>;
}

const SystemModal: React.FC<SystemModalProps> = ({ onClose, currentVersion, displayVersion, onCheckUpdate }) => {
    const [isReloading, setIsReloading] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [checkResult, setCheckResult] = useState<string | null>(null);

    const handleSoftReload = async () => {
        setIsReloading(true);
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) { await registration.unregister(); }
            } catch(e) { console.warn(e); }
        }
        if ('caches' in window) {
            try {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
            } catch (e) { console.warn(e); }
        }
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
        if (confirm('警告：這將刪除所有資料並將系統還原至初始狀態。\n\n確定要執行嗎？')) {
            setIsReloading(true);
            clearAllData();
            localStorage.clear(); 
            setTimeout(() => {
                window.location.href = window.location.pathname + '?reset=' + Date.now();
            }, 500);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Settings className="w-5 h-5" /> 系統設定
                    </h3>
                    <button onClick={onClose} className="hover:bg-slate-700 p-1 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto">
                    <div className="text-center space-y-1">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <ShieldCheck className="w-8 h-8 text-blue-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">ETF 戰情室</h2>
                        <div className="flex justify-center gap-2 text-sm text-gray-500 font-mono">
                            <span className="bg-gray-100 px-2 py-0.5 rounded">UI: {displayVersion}</span>
                            <span className="bg-gray-100 px-2 py-0.5 rounded">Core: {currentVersion}</span>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 my-4"></div>

                    <div className="space-y-4">
                         <button 
                            onClick={handleCheckUpdateClick}
                            disabled={isChecking}
                            className="w-full flex flex-col p-4 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-xl transition-all border border-blue-100 group"
                        >
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white p-2 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                                        <Search className={`w-6 h-6 text-blue-500 ${isChecking ? 'animate-pulse' : ''}`} />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-base">檢查更新</div>
                                        <div className="text-sm text-blue-600 opacity-70">Check for Updates</div>
                                    </div>
                                </div>
                                {isChecking && <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />}
                            </div>
                            
                            {checkResult && (
                                <div className="mt-3 w-full bg-white/50 p-2 rounded text-sm text-left font-mono text-blue-800 border border-blue-100 whitespace-pre-wrap">
                                    {checkResult}
                                </div>
                            )}
                        </button>

                        <button 
                            onClick={handleSoftReload}
                            disabled={isReloading}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl transition-all border border-slate-100 group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                                    <RefreshCw className={`w-6 h-6 ${isReloading ? 'animate-spin' : ''}`} />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-base">重新整理</div>
                                    <div className="text-sm text-slate-400">Reload System</div>
                                </div>
                            </div>
                        </button>

                        <button 
                            onClick={handleFactoryReset}
                            disabled={isReloading}
                            className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl transition-all border border-red-100 group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                                    <RotateCcw className="w-6 h-6 text-red-500" />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-base">系統重置 (Reset)</div>
                                    <div className="text-sm text-red-400">Clear Data & Cache</div>
                                </div>
                            </div>
                            <Power className="w-5 h-5 text-red-300" />
                        </button>
                    </div>
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
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);

  const checkForUpdates = async (manual = false): Promise<string> => {
      try {
          if (window.location.protocol === 'file:') return "本機檔案模式無法更新。";
          let serverVersion = null;
          
          try {
              const targetUrl = new URL('metadata.json', window.location.href).href;
              const response = await fetch(`${targetUrl}?t=${Date.now()}`, {
                  cache: 'no-store',
                  headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
              });
              if (response.ok) {
                  const data = await response.json();
                  serverVersion = data.version;
              }
          } catch (e) {}

          if (!serverVersion) {
              try {
                  const pageUrl = window.location.origin + window.location.pathname;
                  const response = await fetch(`${pageUrl}?t=${Date.now()}`, { cache: 'no-store' });
                  if (response.ok) {
                      const text = await response.text();
                      const match = text.match(/<title>.*?ETF Master Dashboard (V\d+\.\d+).*?<\/title>/i);
                      if (match && match[1]) serverVersion = match[1];
                  }
              } catch (e) {}
          }

          if (serverVersion && serverVersion !== DISPLAY_VERSION) {
               console.log(`Update Detected: Server(${serverVersion}) vs Local(${DISPLAY_VERSION})`);
               setUpdateAvailable(serverVersion);
               return `偵測到新版本 ${serverVersion}！`;
          } else {
               return serverVersion ? `檢查結果：目前已是最新 (${serverVersion})。` : `檢查更新失敗`;
          }

      } catch (e: any) {
          return `錯誤: ${e.message}`;
      }
  };

  useEffect(() => {
    const initApp = async () => {
        const savedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
        const hasCachedMarket = !!localStorage.getItem('db_market_data');
        const isVersionMatch = savedVersion === APP_VERSION;

        if (!isVersionMatch) {
            console.log(`Version Reset: Local(${savedVersion}) -> App(${APP_VERSION}). Clearing Data.`);
            clearAllData(); 
            localStorage.removeItem('admin_csv_urls'); 
            localStorage.setItem(STORAGE_VERSION_KEY, APP_VERSION);
            setIsInitializing(true);
        } else if (hasCachedMarket) {
            setIsInitializing(false);
        }

        checkForUpdates(false);

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
      if ('serviceWorker' in navigator) {
          try {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (const registration of registrations) { await registration.unregister(); }
          } catch(e) {}
      }
      if ('caches' in window) {
          try {
              const keys = await caches.keys();
              await Promise.all(keys.map(key => caches.delete(key)));
          } catch (e) {}
      }
      const timestamp = Date.now();
      window.location.href = window.location.pathname + '?v=' + timestamp;
  };

  const navItems: NavItem[] = [
    { id: 'ANALYSIS', name: '資料分析', icon: LayoutDashboard, component: <TabAnalysisHub /> },
    { id: 'PERFORMANCE', name: '績效分析', icon: TrendingUp, component: <TabPerformance /> },
    { id: 'EXPORT', name: '表單匯出', icon: Download, component: <TabExport /> }
  ];

  const getCurrentComponent = () => {
    const item = navItems.find(i => i.id === activeTab);
    return item ? item.component : <TabAnalysisHub />;
  };

  if (updateAvailable) {
      return <UpdateOverlay serverVersion={updateAvailable} onUpdate={handleUpdateClick} />;
  }

  if (isInitializing) {
      return (
          <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-900">
              <Loader2 className="w-16 h-16 animate-spin mb-6 text-blue-600" />
              <h2 className="text-2xl font-bold mb-2">系統重置中 ({DISPLAY_VERSION})...</h2>
              <div className="bg-white/50 px-6 py-4 rounded-xl text-center border border-slate-200 max-w-sm">
                  <p className="text-sm text-slate-600">正在清除舊版資料並初始化</p>
              </div>
          </div>
      );
  }

  // --- ORIGINAL BLUE/SLATE THEME ---
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Sidebar - Slate 900 (Original) */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white transition-all duration-300 flex flex-col shadow-2xl z-20 border-r border-slate-800`}>
        <div className="p-5 border-b border-slate-800 bg-slate-950">
          <div className={`flex flex-col ${!sidebarOpen && 'items-center'}`}>
             <div className="flex items-center justify-between w-full mb-1">
                 <div className={`flex items-center gap-3 ${!sidebarOpen && 'hidden'}`}>
                    <CloudLightning className="w-7 h-7 text-blue-400" />
                    <span className="font-bold text-xl tracking-wider truncate">ETF 戰情室</span>
                 </div>
                 <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                    <span className="text-2xl">☰</span>
                 </button>
             </div>
             
             {/* Status Indicators */}
             <div className={`${!sidebarOpen && 'hidden'} px-1 flex items-center h-5 mt-1`}>
                {isBackgroundUpdating ? (
                    <div className="flex items-center gap-1 text-sm text-amber-300 animate-pulse" title="背景資料更新中...">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>資料更新中</span>
                    </div>
                ) : lastUpdateStatus === 'success' ? (
                    <div className="flex items-center gap-1 text-sm text-green-300 animate-in fade-in zoom-in">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>系統已就緒</span>
                    </div>
                ) : null}
             </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 flex flex-col bg-slate-900">
          <nav className="space-y-2 px-3 flex-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center px-4 py-4 rounded-xl transition-all duration-200 mb-1 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  } ${!sidebarOpen && 'justify-center'}`}
                >
                  <span className={`${sidebarOpen ? 'mr-4' : ''}`}>
                      <Icon className="w-6 h-6" />
                  </span>
                  {sidebarOpen && <span className="text-base font-bold tracking-wide">{item.name}</span>}
                </button>
              );
            })}
          </nav>

          {/* SIDEBAR AD SLOT */}
          {sidebarOpen && (
              <div className="px-4 pb-4 mt-auto">
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
            className="p-4 border-t border-slate-800 bg-slate-950 cursor-pointer hover:bg-slate-900 transition-colors group"
        >
            <div className={`flex flex-col items-center ${sidebarOpen ? 'items-start' : 'items-center'}`}>
                {sidebarOpen ? (
                    <div className="w-full flex justify-between items-end">
                        <div>
                            <p className="text-base font-bold text-white tracking-wide">julong chen</p>
                            <div className="flex items-center gap-1">
                                <p className="text-sm text-slate-400 mt-0.5">版本 {DISPLAY_VERSION}</p>
                            </div>
                        </div>
                        <Settings className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:rotate-90 transition-all" />
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1">
                        <div className="text-xs text-slate-500 font-mono text-center">
                            <div>V1</div>
                            <div>.0</div>
                        </div>
                        <Settings className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white shadow-sm border-b border-slate-200 p-4 flex justify-between items-center md:hidden z-10">
            <div className="flex items-center gap-3">
                <Presentation className="w-6 h-6 text-blue-900" />
                <div className="font-bold text-slate-900 text-xl">ETF 戰情室</div>
            </div>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-700"><span className="text-2xl">☰</span></button>
        </header>
        <main className="flex-1 overflow-hidden relative bg-slate-50">
          {getCurrentComponent()}
        </main>
      </div>

      {showSystemModal && (
          <SystemModal 
            onClose={() => setShowSystemModal(false)}
            currentVersion={APP_VERSION}
            displayVersion={DISPLAY_VERSION}
            onCheckUpdate={() => checkForUpdates(true)}
          />
      )}
    </div>
  );
};

export default App;