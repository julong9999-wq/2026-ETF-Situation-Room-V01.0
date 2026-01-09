import React, { useState, useEffect } from 'react';
import TabGlobalMarket from './TabGlobalMarket';
import TabBasicInfo from './TabBasicInfo';
import TabPrices from './TabPrices';
import TabDividends from './TabDividends';
import TabFillAnalysis from './TabFillAnalysis';
import { LayoutDashboard, Receipt, LineChart, PieChart, TrendingUp, Users } from 'lucide-react';

const TabAnalysisHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('market');
  const [onlineUsers, setOnlineUsers] = useState<number>(1245);

  // Default values set to 季配 (Quarterly) and 季一 (Q1/Jan)
  const [sharedMainFilter, setSharedMainFilter] = useState('季配');
  const [sharedSubFilter, setSharedSubFilter] = useState('季一');

  useEffect(() => {
      // Simulate "Online Users" instead of static visitor count
      // Base around 1200, fluctuate by +/- 50
      const base = 1200;
      const getNoise = () => Math.floor(Math.random() * 100) - 20; // -20 to +80
      
      setOnlineUsers(base + getNoise());

      const interval = setInterval(() => {
          setOnlineUsers(prev => {
              const change = Math.floor(Math.random() * 7) - 3; // -3 to +3 change
              let next = prev + change;
              if (next < 800) next = 800; // Floor
              return next;
          });
      }, 5000); // Update every 5 seconds

      return () => clearInterval(interval);
  }, []);

  const sharedProps = {
      mainFilter: sharedMainFilter,
      subFilter: sharedSubFilter,
      setMainFilter: setSharedMainFilter,
      setSubFilter: setSharedSubFilter
  };

  const features = [
    { id: 'market', title: '國際大盤', icon: LayoutDashboard, component: <TabGlobalMarket /> },
    { id: 'basic', title: '基本資料', icon: Receipt, component: <TabBasicInfo {...sharedProps} /> },
    { id: 'price', title: '股價資訊', icon: LineChart, component: <TabPrices {...sharedProps} /> },
    { id: 'dividend', title: '除息資訊', icon: PieChart, component: <TabDividends {...sharedProps} /> },
    { id: 'fill', title: '填息分析', icon: TrendingUp, component: <TabFillAnalysis {...sharedProps} /> },
  ];

  const activeFeature = features.find(f => f.id === activeTab);

  return (
    <div className="flex flex-col h-full bg-blue-50">
      {/* Top Section - Reduced Padding p-2 */}
      <div className="bg-white border-b border-blue-200 shadow-sm z-20 flex-none p-2 flex items-center gap-3">
         
         <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 pb-0.5">
            {features.map((feature) => {
                const isActive = activeTab === feature.id;
                const Icon = feature.icon;
                return (
                    <button
                        key={feature.id}
                        onClick={() => setActiveTab(feature.id)}
                        className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg text-base font-bold whitespace-nowrap transition-all duration-200 border
                            ${isActive 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm transform scale-[1.02]' 
                                : 'bg-white text-blue-600 border-blue-100 hover:bg-blue-50 hover:border-blue-200'
                            }
                        `}
                    >
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-blue-500'}`} />
                        {feature.title}
                    </button>
                );
            })}
        </div>
        
        <div className="flex-none flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200 shadow-sm">
            <div className="relative">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white"></span>
            </div>
            <span className="text-sm font-bold text-blue-700 font-mono">
                {onlineUsers.toLocaleString()} <span className="text-xs font-normal text-blue-400">線上</span>
            </span>
        </div>

      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
            {activeFeature?.component}
        </div>
      </div>
    </div>
  );
};

export default TabAnalysisHub;