import React, { useState, useEffect } from 'react';
import TabGlobalMarket from './TabGlobalMarket';
import TabBasicInfo from './TabBasicInfo';
import TabPrices from './TabPrices';
import TabDividends from './TabDividends';
import TabFillAnalysis from './TabFillAnalysis';
import { LayoutDashboard, Receipt, LineChart, PieChart, TrendingUp, Users } from 'lucide-react';
import AdSenseBlock from './AdSenseBlock';

const TabAnalysisHub: React.FC = () => {
  // Default to the first tab ('market') so the screen isn't empty
  const [activeTab, setActiveTab] = useState<string>('market');
  const [visitorCount, setVisitorCount] = useState<number>(12045);

  // --- SHARED FILTER STATE (For Linkage) ---
  // Default values changed to '季配' and '季一' as requested
  const [sharedMainFilter, setSharedMainFilter] = useState('季配');
  const [sharedSubFilter, setSharedSubFilter] = useState('季一');

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

  // Define shared props
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
    <div className="flex flex-col h-full bg-primary-50">
      {/* Top Section: Toolbar (Buttons Left, Counter Right) */}
      <div className="bg-white border-b border-primary-200 shadow-sm z-20 flex-none p-2 flex items-center gap-2">
         
         {/* Buttons Area */}
         <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 pb-1">
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
        
        {/* Visitor Counter */}
        <div className="flex-none flex items-center gap-1.5 bg-primary-50 px-2.5 py-1.5 rounded-full border border-primary-100 shadow-sm">
            <Users className="w-3.5 h-3.5 text-primary-600" />
            <span className="text-xs font-bold text-primary-700 font-mono">{visitorCount.toLocaleString()}</span>
        </div>

      </div>
      
      {/* Main Content Area: Split Layout (Left: Content, Right: Ad) */}
      {/* Added min-h-0 to ensure flex child scrolling works correctly */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        
        {/* Left: The Active Sub-form (Takes remaining space) */}
        {/* Use flex-col and min-h-0 to strictly constrain children */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
            {activeFeature?.component}
        </div>

        {/* Right: Vertical Ad Sidebar (Hidden on mobile, visible on desktop) */}
        <div className="hidden lg:flex flex-none w-[200px] border-l border-primary-200 bg-gray-50 flex-col items-center p-2 z-10 min-h-0 overflow-hidden">
            <div className="text-[10px] text-gray-400 mb-2 font-mono tracking-widest flex-none">SPONSORED</div>
            <div className="w-full flex-1 flex flex-col gap-4 overflow-y-auto no-scrollbar">
                 {/* Ad Block 1 - Vertical Skyscraper style */}
                 <div className="w-full rounded bg-white border border-gray-200 shadow-sm overflow-hidden flex-shrink-0" style={{ minHeight: '400px' }}>
                     <AdSenseBlock 
                         slot="0987654321" 
                         format="vertical" 
                         style={{ display: 'block', width: '100%', height: '100%' }}
                         label="熱門推薦"
                     />
                 </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default TabAnalysisHub;