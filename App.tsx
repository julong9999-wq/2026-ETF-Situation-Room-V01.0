import React, { useState, useEffect } from 'react';
import AdminPanel from './components/AdminPanel';
import TabAnalysisHub from './components/TabAnalysisHub';
import { UserRole } from './types';
import { clearAllData, checkAndFetchSystemData } from './services/dataService';
import { Loader2 } from 'lucide-react';

// --- SYSTEM VERSION CONTROL ---
const APP_VERSION = 'V.01.2'; 
const STORAGE_VERSION_KEY = 'app_system_version';

// Placeholders
const TabPerformance = () => <div className="p-8 text-center text-primary-500 text-xl font-bold">績效分析功能區 (規劃中)</div>;
const TabExport = () => <div className="p-8 text-center text-primary-500 text-xl font-bold">表單匯出功能區 (規劃中)</div>;

type NavItem = {
  id: string;
  name: string;
  icon: string;
  component: React.ReactNode;
};

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole>(UserRole.GUEST);
  const [userEmail, setUserEmail] = useState<string>('訪客模式');
  const [activeTab, setActiveTab] = useState('ANALYSIS'); 
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);

  // --- 1. Version Check, 2. Corruption Healing, 3. AUTO DATA FETCH ---
  useEffect(() => {
    const initApp = async () => {
        // A. Version Check
        const savedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
        if (savedVersion !== APP_VERSION) {
            console.log(`Version mismatch: Local(${savedVersion}) vs App(${APP_VERSION}). Cleaning up...`);
            clearAllData(); 
            localStorage.setItem(STORAGE_VERSION_KEY, APP_VERSION);
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

        // C. Auto Fetch Data (The new requirement)
        // We do this every time to ensure fresh data from the Google Sheets "History"
        await checkAndFetchSystemData();
        
        setIsInitializing(false);
    };

    initApp();
  }, []);

  const handleAdminLoginSuccess = (role: UserRole, email: string) => {
    setUserRole(role);
    setUserEmail(email);
  };

  const handleLogout = () => {
    setUserRole(UserRole.GUEST);
    setUserEmail('訪客模式');
  };

  const navItems: NavItem[] = [
    {
      id: 'MAINTENANCE',
      name: '資料維護',
      icon: '🛠️',
      component: <AdminPanel userRole={userRole} onLoginSuccess={handleAdminLoginSuccess} />
    },
    {
      id: 'ANALYSIS',
      name: '資料分析',
      icon: '📊',
      component: <TabAnalysisHub />
    },
    {
      id: 'PERFORMANCE',
      name: '績效分析',
      icon: '🏆',
      component: <TabPerformance />
    },
    {
      id: 'EXPORT',
      name: '表單匯出',
      icon: '📥',
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
              <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary-600" />
              <h2 className="text-xl font-bold">系統資料更新中...</h2>
              <p className="text-sm text-primary-400 mt-2">正在從 Google 雲端資料庫同步最新股市數據</p>
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
                    <span className="text-xl">📈</span>
                    <span className="font-bold text-lg tracking-wider truncate">ETF 戰情室</span>
                 </div>
                 <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-primary-800 rounded-lg text-primary-200 hover:text-white">
                    <span className="text-xl">☰</span>
                 </button>
             </div>
             <div className={`${!sidebarOpen && 'hidden'} px-1`}>
                <span className="inline-block px-2 py-0.5 rounded bg-primary-800 text-primary-300 text-xs font-mono border border-primary-700">
                    {APP_VERSION}
                </span>
             </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1.5 px-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
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
                  <span className={`text-lg ${sidebarOpen ? 'mr-3' : ''}`}>{item.icon}</span>
                  {sidebarOpen && <span className="text-base font-bold tracking-wide">{item.name}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-primary-800 bg-primary-950/50">
            <div className={`flex items-center ${sidebarOpen ? '' : 'justify-center'}`}>
                <div className={`w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center border border-primary-600 ${!sidebarOpen && 'mb-2'}`}>
                    <span className="text-sm">👤</span>
                </div>
                {sidebarOpen && (
                    <div className="ml-2.5 overflow-hidden">
                        <p className="text-sm font-bold text-white truncate">{userEmail}</p>
                        <p className="text-xs text-primary-400">{userRole === UserRole.ADMIN ? '管理員' : '訪客'}</p>
                    </div>
                )}
            </div>
             {userRole === UserRole.ADMIN && (
                 <button 
                    onClick={handleLogout}
                    className={`mt-3 w-full flex items-center justify-center p-2 rounded-lg hover:bg-red-900/50 text-red-300 hover:text-white transition-colors border border-transparent hover:border-red-900 ${!sidebarOpen && 'mt-1'}`}
                 >
                    <span className="text-sm">🚪</span>
                    {sidebarOpen && <span className="ml-2 text-sm font-medium">登出</span>}
                 </button>
             )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white shadow-sm border-b border-primary-200 p-4 flex justify-between items-center md:hidden z-10">
            <div className="flex items-center gap-2">
                <div className="font-bold text-primary-900 text-lg">ETF 戰情室</div>
                <span className="px-1.5 py-0.5 rounded bg-primary-100 text-primary-600 text-xs font-bold">{APP_VERSION}</span>
            </div>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-primary-700"><span className="text-xl">☰</span></button>
        </header>
        <main className="flex-1 overflow-hidden relative bg-primary-50">
          {getCurrentComponent()}
        </main>
      </div>
    </div>
  );
};

export default App;