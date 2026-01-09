import React, { useState, useEffect, useMemo } from 'react';
import { 
    getMarketData, getBasicInfo, getPriceData, getDividendData, getFillAnalysisData, exportToCSV 
} from '../services/dataService';
import { 
    MarketData, BasicInfo, PriceData, DividendData, FillAnalysisData 
} from '../types';
import { 
    Calendar, Search, FileText, Download, TrendingUp, Filter, AlertCircle, Code, Copy 
} from 'lucide-react';

const TabAdvancedSearch: React.FC = () => {
    // --- STATE ---
    const [mainTab, setMainTab] = useState<'PRE_MARKET' | 'POST_MARKET' | 'WEEKLY'>('WEEKLY');
    const [reportType, setReportType] = useState<'MARKET' | 'PRICE' | 'DIVIDEND' | 'FILL'>('MARKET');
    const [refDate, setRefDate] = useState(new Date().toISOString().split('T')[0]);
    
    // --- RAW DATA ---
    const [marketData, setMarketData] = useState<MarketData[]>([]);
    const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
    const [priceData, setPriceData] = useState<PriceData[]>([]);
    const [divData, setDivData] = useState<DividendData[]>([]);
    const [fillData, setFillData] = useState<FillAnalysisData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [m, b, p, d, f] = await Promise.all([
                    getMarketData(),
                    getBasicInfo(),
                    getPriceData(),
                    getDividendData(),
                    getFillAnalysisData()
                ]);
                setMarketData(m);
                setBasicInfo(b);
                setPriceData(p);
                setDivData(d);
                setFillData(f);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // --- DATE LOGIC ---
    const dateRange = useMemo(() => {
        const base = new Date(refDate);
        const day = base.getDay(); // 0 (Sun) - 6 (Sat)
        // Calculate "This Monday"
        const diffToMon = base.getDate() - day + (day === 0 ? -6 : 1);
        
        const thisMondayObj = new Date(base);
        thisMondayObj.setDate(diffToMon);
        
        const thisFridayObj = new Date(thisMondayObj);
        thisFridayObj.setDate(thisMondayObj.getDate() + 4);

        const lastFridayObj = new Date(thisMondayObj);
        lastFridayObj.setDate(thisMondayObj.getDate() - 3);

        const fmt = (d: Date) => d.toISOString().split('T')[0];

        return {
            thisMonday: fmt(thisMondayObj),
            thisFriday: fmt(thisFridayObj),
            lastFriday: fmt(lastFridayObj)
        };
    }, [refDate]);

    // --- HELPERS FOR SORTING ---
    const getIndexWeight = (name: string) => {
        if (name.includes('加權')) return 1;
        if (name.includes('道瓊')) return 2;
        if (name.includes('那斯')) return 3;
        if (name.includes('費半') || name.includes('費城')) return 4;
        if (name.includes('標普') || name.includes('S&P')) return 5;
        return 6;
    };

    const getEtfSortWeight = (row: any) => {
        const cat = String(row['商品分類'] || '');
        const freq = String(row['配息週期'] || '');
        
        // Priority 5: Bonds (Last in specific list)
        if (cat.includes('債')) return 5;

        // Priority 4: Monthly
        if (freq.includes('月')) return 4;

        // Priority 1: Q1
        if (freq.includes('季一') || freq.includes('1,4') || freq.includes('01,04')) return 1;

        // Priority 2: Q2
        if (freq.includes('季二') || freq.includes('2,5') || freq.includes('02,05')) return 2;

        // Priority 3: Q3
        if (freq.includes('季三') || freq.includes('3,6') || freq.includes('03,06')) return 3;

        return 6;
    };

    // --- REPORT DATA PROCESSING ---

    // 1. GLOBAL MARKET: Last Fri -> This Fri
    // Sort: Index Priority -> Date Ascending (Far to Near)
    const reportMarket = useMemo(() => {
        if (mainTab !== 'WEEKLY' || reportType !== 'MARKET') return [];
        const start = dateRange.lastFriday;
        const end = dateRange.thisFriday;
        return marketData
            .filter(d => d.date >= start && d.date <= end)
            .sort((a,b) => {
                const wA = getIndexWeight(a.indexName);
                const wB = getIndexWeight(b.indexName);
                if (wA !== wB) return wA - wB;
                // Date Ascending (Old -> New)
                return a.date.localeCompare(b.date);
            });
    }, [marketData, mainTab, reportType, dateRange]);

    // 2. ETF PRICE: Last Fri -> This Fri (Exclude International & Semi-Annual)
    // Sort: Category Priority -> Code Ascending
    const reportPrice = useMemo(() => {
        if (mainTab !== 'WEEKLY' || reportType !== 'PRICE') return { headers: [], rows: [] };
        
        const start = dateRange.lastFriday;
        const end = dateRange.thisFriday;

        // Filter valid ETFs first
        const validEtfs = basicInfo.filter(b => {
            const cat = (b.category || '').trim();
            const type = (b.etfType || '').trim();
            const freq = (b.dividendFreq || '').trim();
            const market = (b.marketType || '').trim();
            const name = (b.etfName || '').trim();
            const code = (b.etfCode || '').trim();

            // 1. Specific Exclusions
            if (code === '00911') return false; 

            // 2. Exclude Semi-Annual (半年配)
            if (freq.includes('半年') || cat.includes('半年')) return false;

            // 3. Exclude "International" (國際) - Strict keyword filtering
            if (cat.includes('國際') || type.includes('國際') || name.includes('國際')) return false;

            // 4. Handle "Foreign" (國外)
            // Rule: Filter "Foreign" generally, BUT keep "Quarterly" (季配) Foreign products.
            // We also keep Monthly and Bonds as they are often foreign components but desired.
            const isForeign = cat.includes('國外') || type.includes('國外') || market.includes('國外');
            
            if (isForeign) {
                if (freq.includes('季')) return true; // Keep Quarterly Foreign
                if (freq.includes('月')) return true; // Keep Monthly Foreign
                if (cat.includes('債')) return true;   // Keep Bond Foreign
                return false; // Filter other Foreign (e.g. Annual Foreign Equity)
            }

            return true;
        });

        const validCodes = new Set(validEtfs.map(e => e.etfCode));

        // Get Prices in range
        const pricesInRange = priceData.filter(p => validCodes.has(p.etfCode) && p.date >= start && p.date <= end);
        
        // Find all unique dates in range for columns, sorted ASC (Old -> New)
        const uniqueDates = Array.from(new Set(pricesInRange.map(p => p.date))).sort();

        // Pivot Data
        const pivotRows = validEtfs.map(etf => {
            const row: any = {
                '商品分類': etf.category,
                '配息週期': etf.dividendFreq,
                'ETF代碼': etf.etfCode,
                'ETF名稱': etf.etfName,
                'ETF類型': etf.etfType
            };
            let hasData = false;
            uniqueDates.forEach((d: string) => {
                const found = pricesInRange.find(p => p.etfCode === etf.etfCode && p.date === d);
                row[d] = found ? found.price : '';
                if (found) hasData = true;
            });
            return hasData ? row : null;
        }).filter(r => r !== null);

        // Sort by Custom Weight then Code
        pivotRows.sort((a: any, b: any) => {
            const wA = getEtfSortWeight(a);
            const wB = getEtfSortWeight(b);
            if (wA !== wB) return wA - wB;
            return a['ETF代碼'].localeCompare(b['ETF代碼']);
        });

        return { headers: uniqueDates, rows: pivotRows };
    }, [basicInfo, priceData, mainTab, reportType, dateRange]);

    // 3. DIVIDEND: This Mon -> This Fri
    const reportDividend = useMemo(() => {
        if (mainTab !== 'WEEKLY' || reportType !== 'DIVIDEND') return [];
        const start = dateRange.thisMonday;
        const end = dateRange.thisFriday;
        
        return divData
            .filter(d => d.exDate >= start && d.exDate <= end)
            .sort((a,b) => a.exDate.localeCompare(b.exDate));
    }, [divData, mainTab, reportType, dateRange]);

    // 4. FILL: This Mon -> This Fri (Filled Only, ExDate >= 2026)
    const reportFill = useMemo(() => {
        if (mainTab !== 'WEEKLY' || reportType !== 'FILL') return [];
        const start = dateRange.thisMonday;
        const end = dateRange.thisFriday;

        return fillData
            .filter(d => {
                const exYear = parseInt(d.exDate.split('-')[0]);
                // Filter: Must be filled, Fill Date within range, AND Ex-Date Year >= 2026
                return d.isFilled && 
                       d.fillDate >= start && 
                       d.fillDate <= end && 
                       exYear >= 2026;
            })
            .sort((a,b) => a.fillDate.localeCompare(b.fillDate));
    }, [fillData, mainTab, reportType, dateRange]);


    // --- EXPORT HANDLER ---
    const handleExport = () => {
        const timestamp = new Date().toISOString().split('T')[0];
        if (reportType === 'MARKET') {
            const headers = ['日期', '指數名稱', '昨日收盤', '開盤', '高價', '低價', '現價', '漲跌點數', '漲跌幅度'];
            const data = reportMarket.map(d => ({
                '日期': d.date, '指數名稱': d.indexName, '昨日收盤': d.prevClose, '開盤': d.open, '高價': d.high, '低價': d.low, '現價': d.price, '漲跌點數': d.change, '漲跌幅度': `${d.changePercent}%`
            }));
            exportToCSV(`周報_國際大盤_${timestamp}`, headers, data);
        } else if (reportType === 'PRICE') {
            const { headers: dateHeaders, rows } = reportPrice;
            const fixedHeaders = ['商品分類', '配息週期', 'ETF代碼', 'ETF名稱', 'ETF類型'];
            const allHeaders = [...fixedHeaders, ...dateHeaders];
            exportToCSV(`周報_ETF股價_${timestamp}`, allHeaders, rows);
        } else if (reportType === 'DIVIDEND') {
            const headers = ['ETF代碼', 'ETF名稱', '除息日期', '除息金額', '股利發放'];
            const data = reportDividend.map(d => ({
                'ETF代碼': d.etfCode, 'ETF名稱': d.etfName, '除息日期': d.exDate, '除息金額': d.amount, '股利發放': d.paymentDate || '-'
            }));
            exportToCSV(`周報_除息_${timestamp}`, headers, data);
        } else if (reportType === 'FILL') {
            const headers = ['ETF代碼', 'ETF名稱', '除息日期', '除息金額', '除息前一天股價', '分析比對日期', '分析比對價格', '分析是否填息成功', '幾天填息'];
            const data = reportFill.map(d => ({
                'ETF代碼': d.etfCode, 'ETF名稱': d.etfName, '除息日期': d.exDate, '除息金額': d.amount, '除息前一天股價': d.pricePreEx, '分析比對日期': d.fillDate, '分析比對價格': d.fillPrice, '分析是否填息成功': '是', '幾天填息': d.daysToFill
            }));
            exportToCSV(`周報_填息_${timestamp}`, headers, data);
        }
    };

    // --- GOOGLE APPS SCRIPT GENERATOR ---
    const handleCopyScript = () => {
        // This generates a GAS code string that matches the current React logic
        const scriptContent = `
/**
 * ETF 戰情室 - 自動化週報生成腳本 (Generated by ETF Dashboard)
 * 
 * 使用說明:
 * 1. 在 Google Sheet 中點擊「擴充功能」->「Apps Script」。
 * 2. 將此代碼貼上並儲存。
 * 3. 重新整理試算表，上方會出現「ETF戰情室」選單。
 * 4. 點擊「生成每週股價報表」即可。
 * 
 * 假設您的試算表有名為 'BasicInfo' (基本資料) 和 'PriceData' (股價資料) 的工作表。
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('ETF戰情室')
      .addItem('生成每週股價報表', 'generateWeeklyPriceReport')
      .addToUi();
}

function generateWeeklyPriceReport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 設定日期範圍 (上週五 ~ 本週五)
  // 注意: 這裡以執行腳本當下為基準推算
  var today = new Date(); // 假設今天執行
  var day = today.getDay(); // 0(Sun) - 6(Sat)
  var diffToMon = today.getDate() - day + (day === 0 ? -6 : 1);
  var thisMon = new Date(today.setDate(diffToMon));
  
  var thisFri = new Date(thisMon); thisFri.setDate(thisMon.getDate() + 4);
  var lastFri = new Date(thisMon); lastFri.setDate(thisMon.getDate() - 3);
  
  var formatDate = function(d) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
  };
  
  var startStr = formatDate(lastFri);
  var endStr = formatDate(thisFri);
  
  // 2. 讀取基本資料 (BasicInfo)
  var sheetBasic = ss.getSheetByName('BasicInfo');
  if (!sheetBasic) { Browser.msgBox("找不到 'BasicInfo' 工作表"); return; }
  var dataBasic = sheetBasic.getDataRange().getValues();
  var headerBasic = dataBasic.shift(); // Remove header
  
  // 建立 Basic Info Map: Code -> {Category, Freq, Name, Type, Market}
  // 假設欄位順序: 代碼(0), 名稱(1), 分類(2), 週期(3), 投信(4), 類型(5), 市場(6) ... 請依實際調整
  var validCodes = {};
  var etfList = [];
  
  dataBasic.forEach(function(row) {
    var code = String(row[0]).trim();
    var name = String(row[1]);
    var cat = String(row[2]);
    var freq = String(row[3]);
    var type = String(row[5]);
    var market = String(row[6]);
    
    // --- 核心過濾邏輯 (與網頁版一致) ---
    var keep = true;
    
    // 1. 排除 00911
    if (code === '00911') keep = false;
    
    // 2. 排除 半年配
    if (keep && (freq.indexOf('半年') > -1 || cat.indexOf('半年') > -1)) keep = false;
    
    // 3. 排除 "國際" 關鍵字
    if (keep && (cat.indexOf('國際') > -1 || type.indexOf('國際') > -1 || name.indexOf('國際') > -1)) keep = false;
    
    // 4. 處理 "國外" (Foreign)
    if (keep) {
      var isForeign = (cat.indexOf('國外') > -1 || type.indexOf('國外') > -1 || market.indexOf('國外') > -1);
      if (isForeign) {
        // 例外保留: 季配、月配、債券
        if (freq.indexOf('季') > -1) { /* keep */ }
        else if (freq.indexOf('月') > -1) { /* keep */ }
        else if (cat.indexOf('債') > -1) { /* keep */ }
        else { keep = false; }
      }
    }
    
    if (keep) {
      validCodes[code] = {
        name: name,
        cat: cat,
        freq: freq,
        type: type
      };
      etfList.push(code);
    }
  });
  
  // 3. 讀取股價資料 (PriceData)
  var sheetPrice = ss.getSheetByName('PriceData');
  if (!sheetPrice) { Browser.msgBox("找不到 'PriceData' 工作表"); return; }
  var dataPrice = sheetPrice.getDataRange().getValues();
  var headerPrice = dataPrice.shift();
  
  // 假設 PriceData 格式: 代碼, 名稱, 日期, 收盤...
  // 找出日期範圍內的數據
  var priceMap = {}; // code -> { date -> price }
  var uniqueDates = [];
  var dateSet = {};
  
  dataPrice.forEach(function(row) {
    var pCode = String(row[0]).trim();
    var pDate = "";
    if (row[2] instanceof Date) pDate = formatDate(row[2]);
    else pDate = String(row[2]);
    
    var pPrice = row[7]; // 假設收盤價在第 8 欄 (Index 7)
    
    if (validCodes[pCode] && pDate >= startStr && pDate <= endStr) {
       if (!priceMap[pCode]) priceMap[pCode] = {};
       priceMap[pCode][pDate] = pPrice;
       
       if (!dateSet[pDate]) {
         dateSet[pDate] = true;
         uniqueDates.push(pDate);
       }
    }
  });
  
  uniqueDates.sort(); // 日期由舊到新
  
  // 4. 準備輸出資料 (Pivot)
  var outputRows = [];
  var outputHeader = ['商品分類', '配息週期', 'ETF代碼', 'ETF名稱', 'ETF類型'].concat(uniqueDates);
  outputRows.push(outputHeader);
  
  etfList.forEach(function(code) {
    var info = validCodes[code];
    var prices = priceMap[code] || {};
    var hasData = false;
    
    var rowData = [info.cat, info.freq, code, info.name, info.type];
    
    uniqueDates.forEach(function(d) {
      var val = prices[d];
      if (val) hasData = true;
      rowData.push(val || "");
    });
    
    if (hasData) outputRows.push(rowData);
  });
  
  // 5. 排序邏輯 (自定義權重)
  // 跳過 Header (index 0)
  var dataToSort = outputRows.slice(1);
  
  var getWeight = function(cat, freq) {
      if (cat.indexOf('債') > -1) return 5;
      if (freq.indexOf('月') > -1) return 4;
      if (freq.indexOf('季一') > -1 || freq.indexOf('1,4') > -1) return 1;
      if (freq.indexOf('季二') > -1 || freq.indexOf('2,5') > -1) return 2;
      if (freq.indexOf('季三') > -1 || freq.indexOf('3,6') > -1) return 3;
      return 6;
  };
  
  dataToSort.sort(function(a, b) {
      var wA = getWeight(String(a[0]), String(a[1]));
      var wB = getWeight(String(b[0]), String(b[1]));
      if (wA !== wB) return wA - wB;
      return String(a[2]).localeCompare(String(b[2])); // Compare Code
  });
  
  var finalOutput = [outputHeader].concat(dataToSort);
  
  // 6. 寫入新工作表
  var reportSheetName = '週報_ETF股價_' + startStr + '_' + endStr;
  var targetSheet = ss.getSheetByName(reportSheetName);
  if (targetSheet) ss.deleteSheet(targetSheet);
  targetSheet = ss.insertSheet(reportSheetName);
  
  targetSheet.getRange(1, 1, finalOutput.length, finalOutput[0].length).setValues(finalOutput);
  Browser.msgBox("報表已生成: " + reportSheetName);
}
        `;

        navigator.clipboard.writeText(scriptContent).then(() => {
            alert("✅ Google Apps Script 已複製到剪貼簿！\n\n使用步驟：\n1. 開啟您的 Google 試算表\n2. 點選「擴充功能」->「Apps Script」\n3. 貼上程式碼並儲存\n4. 重新整理試算表即可在選單看到功能。");
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert("複製失敗，請手動選取程式碼。");
        });
    };

    const fmtNum = (n: number) => n !== undefined && n !== null ? n.toFixed(2) : '-';

    return (
        <div className="flex flex-col h-full bg-blue-50">
            {/* Top Navigation for Advanced Search */}
            <div className="bg-white border-b border-blue-200 p-2 flex items-center justify-between flex-none">
                <div className="flex gap-2">
                    {[
                        { id: 'PRE_MARKET', label: '每日盤前' },
                        { id: 'POST_MARKET', label: '每日盤後' },
                        { id: 'WEEKLY', label: '每週報告' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setMainTab(tab.id as any)}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${mainTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-blue-50'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="text-sm font-bold text-blue-800 bg-blue-100 px-3 py-1 rounded-full">
                    進階資料中心
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden p-2">
                {mainTab === 'WEEKLY' ? (
                    <div className="h-full flex flex-col bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden">
                        {/* Weekly Report Controls */}
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-center justify-between flex-none">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm">
                                    <Calendar className="w-5 h-5 text-blue-600" />
                                    <span className="font-bold text-gray-700">基準日期:</span>
                                    <input 
                                        type="date" 
                                        value={refDate} 
                                        onChange={(e) => setRefDate(e.target.value)} 
                                        className="outline-none font-mono font-bold text-gray-800 bg-transparent"
                                    />
                                </div>
                                
                                <div className="text-sm font-bold text-gray-600 flex gap-3">
                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">上週五: {dateRange.lastFriday}</span>
                                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded">本週一: {dateRange.thisMonday}</span>
                                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">本週五: {dateRange.thisFriday}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button onClick={handleCopyScript} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm">
                                    <Code className="w-4 h-4" /> 複製程式
                                </button>
                                <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                                    <Download className="w-4 h-4" /> 匯出 CSV
                                </button>
                            </div>
                        </div>

                        {/* Report Type Tabs - SHORTENED LABELS */}
                        <div className="p-2 border-b border-gray-200 bg-white flex gap-2 flex-none overflow-x-auto">
                            {[
                                { id: 'MARKET', label: '國際大盤', icon: TrendingUp, color: 'text-blue-600' },
                                { id: 'PRICE', label: 'ETF股價', icon: FileText, color: 'text-indigo-600' },
                                { id: 'DIVIDEND', label: '本週除息', icon: Filter, color: 'text-purple-600' },
                                { id: 'FILL', label: '本週填息', icon: Search, color: 'text-emerald-600' }
                            ].map(btn => (
                                <button
                                    key={btn.id}
                                    onClick={() => setReportType(btn.id as any)}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-lg font-bold border transition-all whitespace-nowrap min-w-[120px] justify-center
                                        ${reportType === btn.id 
                                            ? `bg-gray-800 text-white border-gray-800 shadow-md` 
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                        }
                                    `}
                                >
                                    <btn.icon className={`w-4 h-4 ${reportType === btn.id ? 'text-white' : btn.color}`} />
                                    {btn.label}
                                </button>
                            ))}
                        </div>

                        {/* Data Display */}
                        <div className="flex-1 overflow-auto bg-white p-0">
                            {/* 1. MARKET TABLE */}
                            {reportType === 'MARKET' && (
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-blue-50 text-blue-900 sticky top-0 font-bold z-10">
                                        <tr>
                                            <th className="p-3">日期</th>
                                            <th className="p-3">指數名稱</th>
                                            <th className="p-3 text-right">昨日收盤</th>
                                            <th className="p-3 text-right">開盤</th>
                                            <th className="p-3 text-right">高價</th>
                                            <th className="p-3 text-right">低價</th>
                                            <th className="p-3 text-right">現價</th>
                                            <th className="p-3 text-right">漲跌點數</th>
                                            <th className="p-3 text-right">漲跌幅度</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {reportMarket.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-gray-400">無資料</td></tr> :
                                        reportMarket.map((d, i) => (
                                            <tr key={i} className="hover:bg-blue-50">
                                                <td className="p-3 font-mono">{d.date}</td>
                                                <td className="p-3 font-bold">{d.indexName}</td>
                                                <td className="p-3 text-right font-mono text-gray-500">{fmtNum(d.prevClose)}</td>
                                                <td className="p-3 text-right font-mono">{fmtNum(d.open)}</td>
                                                <td className="p-3 text-right font-mono text-red-500">{fmtNum(d.high)}</td>
                                                <td className="p-3 text-right font-mono text-green-500">{fmtNum(d.low)}</td>
                                                <td className="p-3 text-right font-mono font-bold text-blue-900">{fmtNum(d.price)}</td>
                                                <td className={`p-3 text-right font-mono font-bold ${d.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>{d.change >= 0 ? '+' : ''}{fmtNum(d.change)}</td>
                                                <td className={`p-3 text-right font-mono font-bold ${d.changePercent >= 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtNum(d.changePercent)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {/* 2. PRICE PIVOT TABLE */}
                            {reportType === 'PRICE' && (
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-indigo-50 text-indigo-900 sticky top-0 font-bold z-10 shadow-sm">
                                        <tr>
                                            <th className="p-3 whitespace-nowrap bg-indigo-50 sticky left-0 z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">ETF代碼</th>
                                            <th className="p-3 whitespace-nowrap bg-indigo-50 sticky left-[90px] z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">ETF名稱</th>
                                            <th className="p-3 whitespace-nowrap">商品分類</th>
                                            <th className="p-3 whitespace-nowrap">配息週期</th>
                                            <th className="p-3 whitespace-nowrap">ETF類型</th>
                                            {reportPrice.headers.map(d => (
                                                <th key={d} className="p-3 whitespace-nowrap text-right font-mono bg-indigo-100/50">{d}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {reportPrice.rows.length === 0 ? <tr><td colSpan={5 + reportPrice.headers.length} className="p-8 text-center text-gray-400">無資料 (或全部被排除)</td></tr> :
                                        reportPrice.rows.map((row: any, i: number) => (
                                            <tr key={i} className="hover:bg-indigo-50">
                                                <td className="p-3 font-mono font-bold text-indigo-700 bg-white sticky left-0 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] group-hover:bg-indigo-50">{row['ETF代碼']}</td>
                                                <td className="p-3 font-bold text-gray-700 bg-white sticky left-[90px] z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] group-hover:bg-indigo-50">{row['ETF名稱']}</td>
                                                <td className="p-3">{row['商品分類']}</td>
                                                <td className="p-3"><span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-bold text-gray-600">{row['配息週期']}</span></td>
                                                <td className="p-3">{row['ETF類型']}</td>
                                                {reportPrice.headers.map(d => (
                                                    <td key={d} className="p-3 text-right font-mono font-medium text-gray-800 bg-gray-50/30">
                                                        {row[d] !== '' ? fmtNum(row[d]) : '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {/* 3. DIVIDEND TABLE */}
                            {reportType === 'DIVIDEND' && (
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-purple-50 text-purple-900 sticky top-0 font-bold z-10">
                                        <tr>
                                            <th className="p-3">ETF代碼</th>
                                            <th className="p-3">ETF名稱</th>
                                            <th className="p-3">除息日期</th>
                                            <th className="p-3 text-right">除息金額</th>
                                            <th className="p-3 text-right">股利發放</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {reportDividend.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-400">本週無除息資料</td></tr> :
                                        reportDividend.map((d, i) => (
                                            <tr key={i} className="hover:bg-purple-50">
                                                <td className="p-3 font-mono font-bold text-purple-700">{d.etfCode}</td>
                                                <td className="p-3 font-bold">{d.etfName}</td>
                                                <td className="p-3 font-mono">{d.exDate}</td>
                                                <td className="p-3 text-right font-bold text-emerald-600">{fmtNum(d.amount)}</td>
                                                <td className="p-3 text-right font-mono">{d.paymentDate || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {/* 4. FILL TABLE */}
                            {reportType === 'FILL' && (
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-emerald-50 text-emerald-900 sticky top-0 font-bold z-10">
                                        <tr>
                                            <th className="p-3">ETF代碼</th>
                                            <th className="p-3">ETF名稱</th>
                                            <th className="p-3">除息日期</th>
                                            <th className="p-3 text-right">除息金額</th>
                                            <th className="p-3 text-right">除息前股價</th>
                                            <th className="p-3 text-center">填息日期 (比對日)</th>
                                            <th className="p-3 text-right">填息價格 (比對價)</th>
                                            <th className="p-3 text-center">狀態</th>
                                            <th className="p-3 text-right">天數</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {reportFill.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-gray-400">本週無填息資料 (僅顯示2026年起之除息)</td></tr> :
                                        reportFill.map((d, i) => (
                                            <tr key={i} className="hover:bg-emerald-50">
                                                <td className="p-3 font-mono font-bold text-emerald-700">{d.etfCode}</td>
                                                <td className="p-3 font-bold">{d.etfName}</td>
                                                <td className="p-3 font-mono text-gray-500">{d.exDate}</td>
                                                <td className="p-3 text-right font-bold text-gray-700">{fmtNum(d.amount)}</td>
                                                <td className="p-3 text-right font-mono text-gray-500">{fmtNum(d.pricePreEx)}</td>
                                                <td className="p-3 text-center font-mono font-bold text-emerald-800">{d.fillDate}</td>
                                                <td className="p-3 text-right font-mono font-bold text-emerald-800">{fmtNum(d.fillPrice)}</td>
                                                <td className="p-3 text-center font-bold text-emerald-600">填息成功</td>
                                                <td className="p-3 text-right font-mono">{d.daysToFill}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                ) : (
                    // Placeholders for other tabs
                    <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-blue-200 text-gray-400">
                        <AlertCircle className="w-16 h-16 mb-4 opacity-50" />
                        <h2 className="text-xl font-bold text-gray-600">功能開發中</h2>
                        <p>{mainTab === 'PRE_MARKET' ? '每日盤前分析模組' : '每日盤後統計模組'} 即將上線</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TabAdvancedSearch;