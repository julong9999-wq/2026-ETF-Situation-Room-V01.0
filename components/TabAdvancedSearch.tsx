import React, { useState, useEffect, useMemo } from 'react';
import { 
    getMarketData, getBasicInfo, getPriceData, getDividendData, getFillAnalysisData, getHistoryData, getSizeData, exportToCSV 
} from '../services/dataService';
import { 
    MarketData, BasicInfo, PriceData, DividendData, FillAnalysisData, HistoryData, SizeData 
} from '../types';
import { 
    Calendar, Search, FileText, Download, TrendingUp, Filter, Code, AlertCircle, PieChart, Table as TableIcon, Zap, Moon
} from 'lucide-react';

const TabAdvancedSearch: React.FC = () => {
    // --- STATE ---
    const [mainTab, setMainTab] = useState<'PRE_MARKET' | 'POST_MARKET' | 'WEEKLY' | 'SELF_MONTHLY'>('WEEKLY');
    const [reportType, setReportType] = useState<'MARKET' | 'PRICE' | 'DIVIDEND' | 'FILL'>('MARKET');
    const [dataCount, setDataCount] = useState(0);

    // Mock data loading effect
    useEffect(() => {
        const loadCounts = async () => {
            let count = 0;
            if (reportType === 'MARKET') count = (await getMarketData()).length;
            else if (reportType === 'PRICE') count = (await getPriceData()).length;
            else if (reportType === 'DIVIDEND') count = (await getDividendData()).length;
            else if (reportType === 'FILL') count = (await getFillAnalysisData()).length;
            setDataCount(count);
        };
        loadCounts();
    }, [reportType]);

    const handleExport = async () => {
        alert("Advanced Export Feature Coming Soon for: " + reportType);
    };

    return (
        <div className="h-full flex flex-col p-4 bg-blue-50">
            {/* Header / Filter Area */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 mb-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <Search className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-blue-900">進階查詢中心</h2>
                            <p className="text-sm text-blue-500">自定義多維度數據分析報表</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                        {[
                            { id: 'WEEKLY', label: '週報表' },
                            { id: 'SELF_MONTHLY', label: '自訂月報' },
                            { id: 'PRE_MARKET', label: '盤前分析' },
                            { id: 'POST_MARKET', label: '盤後統計' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setMainTab(tab.id as any)}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                                    mainTab === tab.id 
                                    ? 'bg-white text-blue-700 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                    <span className="text-sm font-bold text-gray-400 py-2">資料類型:</span>
                    {[
                        { id: 'MARKET', icon: TrendingUp, label: '大盤行情' },
                        { id: 'PRICE', icon: TableIcon, label: '個股股價' },
                        { id: 'DIVIDEND', icon: PieChart, label: '除息資訊' },
                        { id: 'FILL', icon: Zap, label: '填息分析' }
                    ].map(type => {
                        const Icon = type.icon;
                        return (
                            <button
                                key={type.id}
                                onClick={() => setReportType(type.id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-bold transition-all ${
                                    reportType === type.id
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {type.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Placeholder */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-blue-100 flex flex-col items-center justify-center p-8 text-center">
                <div className="max-w-md space-y-4">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                        <Filter className="w-10 h-10 text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800">
                        {mainTab === 'WEEKLY' ? '週報表查詢' : 
                         mainTab === 'SELF_MONTHLY' ? '自訂月報查詢' :
                         mainTab === 'PRE_MARKET' ? '盤前分析系統' : '盤後統計系統'}
                    </h3>
                    <p className="text-gray-500">
                        目前選擇資料庫：<span className="font-bold text-blue-600">{reportType}</span>
                        <br/>
                        資料筆數：{dataCount} 筆
                    </p>
                    <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-100 flex items-start gap-2 text-left">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <div>
                            此進階功能模組正在開發中。未來將提供交叉比對、自定義日期區間篩選以及多維度樞紐分析功能。
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleExport}
                        className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2 w-full"
                    >
                        <Download className="w-5 h-5" />
                        匯出範例報表
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TabAdvancedSearch;