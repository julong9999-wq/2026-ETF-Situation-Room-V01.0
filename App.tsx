import React, { useState, useEffect } from 'react';
import AdminPanel from './components/AdminPanel';
import TabAnalysisHub from './components/TabAnalysisHub';
import { UserRole } from './types';
import { clearAllData } from './services/dataService';
// Remove imports to prevent crashes
// import { Database, BarChart3, LogOut, Menu, UserCircle, Trophy, Download, FileSpreadsheet } from 'lucide-react';

// --- SYSTEM VERSION CONTROL ---
// 每次發布新版若涉及資料結構變更或需要強制用戶更新，請修改此版號
const APP_VERSION = 'v1.0.2'; 
const STORAGE_VERSION_KEY = 'app_system_version';

// Placeholders for future features
const TabPerformance = () => <div className="p-8 text-center text-primary-500 text-xl font-bold">績效分析功能區 (規劃中)</div>;
const TabExport = () => <div className="p-8 text-center text-primary-500 text-xl font-bold">表單匯出功能區 (規劃中)</div>;

// Navigation Structure Definition
type NavItem = {
  id: string;
  name: string;
  icon: string; // Changed to string for emoji
  component: React.ReactNode;
};

const App: React.FC = () => {
  // Access Control
  const [userRole, setUserRole] = useState<UserRole>(UserRole.GUEST);
  const [userEmail, setUserEmail] = useState<string>('訪客模式');

  // Navigation State
  const [activeTab, setActiveTab] = useState('ANALYSIS'); // Default to Analysis Hub
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // --- Version Check Effect ---
  useEffect(() => {
    const savedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
    if (savedVersion !== APP_VERSION) {
      console.log(`Version mismatch: Local(${savedVersion}) vs App(${APP_VERSION}). Cleaning up...`);
      // 1. Clear Data Cache
      clearAllData(); 
      // 2. Update Version
      localStorage.setItem(STORAGE_VERSION_KEY, APP_VERSION);
      // 3. Optional: Clear other stale keys if needed, but keep 'admin_csv_urls' for convenience if possible
      // 4. Force specific tab or refresh if state is critical
      // window.location.reload(); // Uncomment if a hard reload is absolutely necessary
    }
  }, []);

  const handleAdminLoginSuccess = (role: UserRole, email: string) => {
    setUserRole(role);
    setUserEmail(email);
  };

  const handleLogout = () => {
    setUserRole(UserRole.GUEST);
    setUserEmail('訪客模式');
  };

  // Simplified Menu Structure (No Children)
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

  // Helper to find current component
  const getCurrentComponent = () => {
    const item = navItems.find(i => i.id === activeTab);
    return item ? item.component : <TabAnalysisHub />;
  };

  return (
    <div className="flex h-screen bg-primary-50 overflow-hidden">
      {/* Sidebar - Blue Series (Deep Blue) */}
      <div className={`${sidebarOpen ? 'w-60' : 'w-20'} bg-primary-900 text-white transition-all duration-300 flex flex-col shadow-2xl z-20 border-r border-primary-800`}>
        {/* Sidebar Header */}
        <div className="p-5 flex items-center justify-between border-b border-primary-800">
          <div className={`flex items-center gap-2 ${!sidebarOpen && 'hidden'}`}>
             <span className="text-xl">📈</span>
             <span className="font-bold text-lg tracking-wider truncate">ETF 戰情室</span>
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-primary-800 rounded-lg text-primary-200 hover:text-white mx-auto md:mx-0">
            <span className="text-xl">☰</span>
          </button>
        </div>
        
        {/* Navigation Menu */}
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

        {/* User Profile Footer */}
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
        {/* Mobile Header */}
        <header className="bg-white shadow-sm border-b border-primary-200 p-4 flex justify-between items-center md:hidden z-10">
            <div className="font-bold text-primary-900 text-lg">ETF 戰情室</div>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-primary-700"><span className="text-xl">☰</span></button>
        </header>
        <main className="flex-1 overflow-hidden relative bg-primary-50">
          {getCurrentComponent()}
        </main>
        
        {/* Version Indicator (Optional: Helps you debug if deployment worked) */}
        <div className="absolute bottom-1 right-1 text-[10px] text-primary-300 pointer-events-none z-0">
            {APP_VERSION}
        </div>
      </div>
    </div>
  );
};

export default App;