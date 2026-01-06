import React, { useState, useEffect } from 'react';
import TabGlobalMarket from './TabGlobalMarket';
import TabBasicInfo from './TabBasicInfo';
import TabPrices from './TabPrices';
import TabDividends from './TabDividends';
import TabFillAnalysis from './TabFillAnalysis';
import { LayoutDashboard, Receipt, LineChart, PieChart, TrendingUp, Users } from 'lucide-react';

const TabAnalysisHub: React.FC = () => {
  // Default to the first tab ('market') so the screen isn't empty
  const [activeTab, setActiveTab] = useState<string>('market');
  const [visitorCount, setVisitorCount] = useState<number>(12045);

  useEffect(() => {
      // Simulate a visitor counter
      const stored = localStorage.getItem('app_visitor_count');
      let count = stored ? parseInt(stored) : 12045;
      
      // Increment once per session load
      if (!sessionStorage.getItem('visited')) {
        count += Math.floor(Math.random() * 3) + 1; // Increment by 1-3 randomly
        localStorage.setItem('app_visitor_count', count.toString());
        sessionStorage.setItem('visited', 'true');
      }
      setVisitorCount(count);
  }, []);

  const features = [
    { id: 'market', title: '國際大盤', icon: LayoutDashboard, component: <TabGlobalMarket /> },
    { id: 'basic', title: '基本資料', icon: Receipt, component: <TabBasicInfo /> },
    { id: 'price', title: '股價資訊', icon: LineChart, component: <TabPrices /> },
    { id: 'dividend', title: '除息資訊', icon: PieChart, component: <TabDividends /> },
    { id: 'fill', title: '填息分析', icon: TrendingUp, component: <TabFillAnalysis /> },
  ];

  const activeComponent = features.find(f => f.id === activeTab)?.component;

  return (
    <div className="flex flex-col h-full bg-primary-50">
      {/* Top Section: Sub-function Buttons (Toolbar) - Compact Version */}
      <div className="bg-white border-b border-primary-200 shadow-sm z-20 flex-none flex justify-between items-center pr-3 py-1">
        <div className="flex items-center gap-1.5 px-3 overflow-x-auto no-scrollbar">
            {features.map((feature) => {
                const isActive = activeTab === feature.id;
                const Icon = feature.icon;
                return (
                    <button
                        key={feature.id}
                        onClick={() => setActiveTab(feature.id)}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-all duration-200 border
                            ${isActive 
                                ? 'bg-primary-700 text-white border-primary-700 shadow-sm' 
                                : 'bg-primary-50 text-primary-600 border-primary-100 hover:bg-primary-100 hover:border-primary-200'
                            }
                        `}
                    >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-primary-500'}`} />
                        {feature.title}
                    </button>
                );
            })}
        </div>

        {/* Visitor Counter - Compact */}
        <div className="hidden md:flex items-center gap-2 bg-primary-50 px-2 py-1 rounded-full border border-primary-100">
            <Users className="w-3 h-3 text-primary-600" />
            <span className="text-xs font-bold text-primary-700 font-mono">{visitorCount.toLocaleString()}</span>
        </div>
      </div>

      {/* Bottom Section: Form Content / Output Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeComponent}
      </div>
    </div>
  );
};

export default TabAnalysisHub;