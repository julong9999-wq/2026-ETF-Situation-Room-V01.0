import React, { useState, useEffect } from 'react';
import TabGlobalMarket from './TabGlobalMarket';
import TabBasicInfo from './TabBasicInfo';
import TabPrices from './TabPrices';
import TabDividends from './TabDividends';
import TabFillAnalysis from './TabFillAnalysis';
import { LayoutDashboard, Receipt, LineChart, PieChart, TrendingUp, Users } from 'lucide-react';

const TabAnalysisHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('market');
  const [visitorCount, setVisitorCount] = useState<number>(12045);

  const [sharedMainFilter, setSharedMainFilter] = useState('季配');
  const [sharedSubFilter, setSharedSubFilter] = useState('季一');

  useEffect(() => {
      const stored = localStorage.getItem('app_visitor_count');
      let count = stored ? parseInt(stored) : 12045;
      
      if (!sessionStorage.getItem('visited')) {
        count += Math.floor(Math.random() * 3) + 1; 
        localStorage.setItem('app_visitor_count', count.toString());
        sessionStorage.setItem('visited', 'true');
      }
      setVisitorCount(count);
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
      {/* Top Section */}
      <div className="bg-white border-b border-blue-200 shadow-sm z-20 flex-none p-4 flex items-center gap-4">
         
         <div className="flex items-center gap-3 overflow-x-auto no-scrollbar flex-1 pb-1">
            {features.map((feature) => {
                const isActive = activeTab === feature.id;
                const Icon = feature.icon;
                return (
                    <button
                        key={feature.id}
                        onClick={() => setActiveTab(feature.id)}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg text-base font-bold whitespace-nowrap transition-all duration-200 border
                            ${isActive 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' 
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
        
        <div className="flex-none flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-full border border-blue-200 shadow-sm">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="text-base font-bold text-blue-700 font-mono">{visitorCount.toLocaleString()}</span>
        </div>

      </div>
      
      {/* Main Content Area - Full width, No Ads */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
            {activeFeature?.component}
        </div>
      </div>
    </div>
  );
};

export default TabAnalysisHub;