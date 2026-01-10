import React, { useState, useEffect, useMemo } from 'react';
import { 
    getMarketData, getBasicInfo, getPriceData, getDividendData, getFillAnalysisData, getHistoryData, getSizeData, exportToCSV 
} from '../services/dataService';
import { 
    MarketData, BasicInfo, PriceData, DividendData, FillAnalysisData, HistoryData, SizeData 
} from '../types';
import { 
    Calendar, Search, FileText, Download, TrendingUp, Filter, Code, AlertCircle, PieChart, Table as TableIcon, Zap, Moon, Check, AlertTriangle
} from 'lucide-react';

const TabAdvancedSearch: React.FC = () => {
    // --- STATE ---
    const [mainTab, setMainTab] = useState<'PRE_MARKET' | 'POST_MARKET' | 'WEEKLY' | 'SELF_MONTHLY'>('WEEKLY');
    const [reportType, setReportType] = useState<'MARKET' | 'PRICE' | 'DIVIDEND' | 'FILL'>('MARKET');
    const [selfMonthlySubTab, setSelfMonthlySubTab] = useState<'QUARTERLY_LIST' | 'EX_DIV_DATA'>('QUARTERLY_LIST');
    const [refDate, setRefDate] = useState(new Date().toISOString().split('T')[0]);
    
    // --- RAW DATA ---
    const [marketData, setMarketData] = useState<MarketData[]>([]);
    const [basicInfo, setBasicInfo] = useState<BasicInfo[]>([]);
    const [priceData, setPriceData] = useState<PriceData[]>([]);
    const [divData, setDivData] = useState<DividendData[]>([]);
    const [fillData, setFillData] = useState<FillAnalysisData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [sizeData, setSizeData] = useState<SizeData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [m, b, p, d, f, h, s] = await Promise.all([
                    getMarketData(),
                    getBasicInfo(),
                    getPriceData(),
                    getDividendData(),
                    getFillAnalysisData(),
                    getHistoryData(),
                    getSizeData()
                ]);
                setMarketData(m);
                setBasicInfo(b);
                setPriceData(p);
                setDivData(d);
                setFillData(f);
                setHistoryData(h);
                setSizeData(s);
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

    // --- HELPERS ---
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
        if (cat.includes('債')) return 5;
        if (freq.includes('月')) return 4;
        if (freq.includes('季一') || freq.includes('1,4') || freq.includes('01,04')) return 1;
        if (freq.includes('季二') || freq.includes('2,5') || freq.includes('02,05')) return 2;
        if (freq.includes('季三') || freq.includes('3,6') || freq.includes('03,06')) return 3;
        return 6;
    };

    const getSelfMonthlySortScore = (category: string, freq: string, code: string) => {
        // 排序規則:
        // 1. 商品分類 (季配 > 月配 > 債券)
        let catScore = 4;
        const c = String(category || '');
        const f = String(freq || '');
        
        if (c.includes('季配')) { catScore = 1; }
        else if (c.includes('月配')) { catScore = 2; }
        else if (c.includes('債')) { catScore = 3; }
        else { catScore = 4; } // 其他

        // 2. 配息週期 (月配 > 季一 > 季二 > 季三)
        let freqScore = 5;
        if (f.includes('月')) freqScore = 1;
        else if (f.includes('季一') || f.includes('1,4') || f.includes('01,04')) freqScore = 2;
        else if (f.includes('季二') || f.includes('2,5') || f.includes('02,05')) freqScore = 3;
        else if (f.includes('季三') || f.includes('3,6') || f.includes('03,06')) freqScore = 4;

        // 3. 股號由小至大
        return { catScore, freqScore, code };
    };

    const fmtNum = (n: number) => n !== undefined && n !== null ? n.toFixed(2) : '-';
    // New formatter for Dividends (3 decimal places)
    const fmtDiv = (n: number | string) => {
        if (typeof n === 'string') return n;
        if (n === undefined || n === null) return '-';
        return n.toFixed(3);
    };

    // --- REPORT DATA PROCESSING ---
    const reportMarket = useMemo(() => {
        // Always generate this, don't depend on reportType for existence, just mainTab for relevance
        if (mainTab !== 'WEEKLY') return [];
        const start = dateRange.lastFriday;
        const end = dateRange.thisFriday;
        return marketData
            .filter(d => d.date >= start && d.date <= end)
            .sort((a,b) => {
                const wA = getIndexWeight(a.indexName);
                const wB = getIndexWeight(b.indexName);
                if (wA !== wB) return wA - wB;
                return a.date.localeCompare(b.date);
            });
    }, [marketData, mainTab, dateRange]);

    const reportPrice = useMemo(() => {
        if (mainTab !== 'WEEKLY') return { headers: [], rows: [] };
        const start = dateRange.lastFriday;
        const end = dateRange.thisFriday;

        const validEtfs = basicInfo.filter(b => {
            const cat = (b.category || '').trim();
            const type = (b.etfType || '').trim();
            const freq = (b.dividendFreq || '').trim();
            const market = (b.marketType || '').trim();
            const name = (b.etfName || '').trim();
            const code = (b.etfCode || '').trim();

            if (code === '00911') return false; 
            if (freq.includes('半年') || cat.includes('半年')) return false;
            
            const isForeign = cat.includes('國外') || type.includes('國外') || market.includes('國外') || cat.includes('國際') || type.includes('國際') || name.includes('國際');
            if (isForeign) {
                if (freq.includes('季')) return true; 
                return false; 
            }
            return true;
        });

        const validCodes = new Set(validEtfs.map(e => e.etfCode));
        const pricesInRange = priceData.filter(p => validCodes.has(p.etfCode) && p.date >= start && p.date <= end);
        const uniqueDates = Array.from(new Set(pricesInRange.map(p => p.date))).sort();

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

        pivotRows.sort((a: any, b: any) => {
            const wA = getEtfSortWeight(a);
            const wB = getEtfSortWeight(b);
            if (wA !== wB) return wA - wB;
            return a['ETF代碼'].localeCompare(b['ETF代碼']);
        });

        return { headers: uniqueDates, rows: pivotRows };
    }, [basicInfo, priceData, mainTab, dateRange]);

    const reportDividend = useMemo(() => {
        if (mainTab !== 'WEEKLY') return [];
        const start = dateRange.thisMonday;
        const end = dateRange.thisFriday;
        return divData
            .filter(d => d.exDate >= start && d.exDate <= end)
            .sort((a,b) => a.exDate.localeCompare(b.exDate));
    }, [divData, mainTab, dateRange]);

    const reportFill = useMemo(() => {
        if (mainTab !== 'WEEKLY') return [];
        const start = dateRange.thisMonday;
        const end = dateRange.thisFriday;
        return fillData
            .filter(d => {
                if (!d.exDate) return false;
                const exYear = parseInt(d.exDate.split('-')[0]);
                return d.isFilled && d.fillDate >= start && d.fillDate <= end && exYear >= 2026;
            })
            .sort((a,b) => a.fillDate.localeCompare(b.fillDate));
    }, [fillData, mainTab, dateRange]);

    // --- SELF MONTHLY LOGIC (FIXED) ---
    const selfMonthlyData = useMemo(() => {
        if (mainTab !== 'SELF_MONTHLY') return { list: [], div: [] };

        // 1. Prepare Size Data
        const sizeMap = new Map<string, number>();
        const sizeGroups = new Map<string, SizeData[]>();
        sizeData.forEach(s => {
            if (s && s.etfCode) {
                const code = s.etfCode.trim();
                // For map, keep latest
                if (!sizeMap.has(code) || (s.date && s.date > (sizeMap.get(code + '_date') as any))) {
                     sizeMap.set(code, s.size);
                }
                // For groups
                if (!sizeGroups.has(code)) sizeGroups.set(code, []);
                sizeGroups.get(code)!.push(s);
            }
        });

        // 2. Filter Targets: "季配商品" and "季配(主動)商品" (Exclude Bonds)
        const targets = basicInfo.filter(b => {
            const freq = (b.dividendFreq || '').trim();
            const cat = (b.category || '').trim();
            const isQuarterly = freq.includes('季');
            const isBond = cat.includes('債');
            return isQuarterly && !isBond;
        });

        // 3. Date Calculation
        const refDateObj = new Date(refDate); 
        const currentYear = refDateObj.getFullYear();
        const currentMonth = refDateObj.getMonth() + 1;
        
        const targetYear = currentYear - 1;
        const targetMonth = currentMonth;
        const targetMonthStr = String(targetMonth).padStart(2, '0');
        const targetYearMonth = `${targetYear}-${targetMonthStr}`; 

        // 4. Build List Data (For "Quarterly List" Tab)
        const list = targets.map(etf => {
            // A. Recent Price
            const latestPrices = priceData.filter(p => p.etfCode === etf.etfCode).sort((a,b) => b.date.localeCompare(a.date));
            const latest = latestPrices.length > 0 ? latestPrices[0] : null;

            // B. Start Price Logic
            let startPrice = 0;
            let startDate = '-';
            let dateWarning = false;

            if (targetYear <= 2025) {
                const hist = historyData.find(h => h.etfCode === etf.etfCode && h.date.startsWith(targetYearMonth));
                if (hist) {
                    startPrice = hist.price;
                    startDate = hist.date;
                }
            } else {
                const dailyMatches = priceData
                    .filter(p => p.etfCode === etf.etfCode && p.date.startsWith(targetYearMonth))
                    .sort((a,b) => a.date.localeCompare(b.date));
                
                if (dailyMatches.length > 0) {
                    startPrice = dailyMatches[0].price;
                    startDate = dailyMatches[0].date;
                    const dayNum = parseInt(startDate.split('-')[2] || '1');
                    if (dayNum > 10) dateWarning = true;
                }
            }

            // C. Size
            const etfSizes = sizeGroups.get(etf.etfCode) || [];
            etfSizes.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
            const latestSize = etfSizes.length > 0 ? etfSizes[0].size : 0;

            return {
                '商品分類': etf.category,
                '配息週期': etf.dividendFreq,
                'ETF代碼': etf.etfCode,
                'ETF名稱': etf.etfName,
                'ETF類型': etf.etfType,
                '規模大小': latestSize ? Math.round(latestSize) : '-',
                '起始日期': startDate,
                '起始股價': startPrice || '-',
                '最近日期': latest ? latest.date : '-',
                '最近股價': latest ? latest.price : '-',
                'dateWarning': dateWarning
            };
        });

        // 5. Sort List
        list.sort((a, b) => {
            const scoreA = getSelfMonthlySortScore(a['商品分類'], a['配息週期'], a['ETF代碼']);
            const scoreB = getSelfMonthlySortScore(b['商品分類'], b['配息週期'], b['ETF代碼']);
            
            if (scoreA.catScore !== scoreB.catScore) return scoreA.catScore - scoreB.catScore;
            if (scoreA.freqScore !== scoreB.freqScore) return scoreA.freqScore - scoreB.freqScore;
            return scoreA.code.localeCompare(scoreB.code);
        });

        // 6. Build Dividend Data (FIXED: NO MONTH FILTERING, SHOW ALL ACTUAL DATA)
        const targetCodes = new Set(targets.map(t => t.etfCode));
        const divList = divData
            .filter(d => targetCodes.has(d.etfCode))
            .map(d => ({
                '商品分類': basicInfo.find(b => b.etfCode === d.etfCode)?.category || '',
                '配息週期': basicInfo.find(b => b.etfCode === d.etfCode)?.dividendFreq || '',
                'ETF代碼': d.etfCode,
                'ETF名稱': d.etfName,
                '年月': d.yearMonth,
                '除息日期': d.exDate,
                '除息金額': d.amount,
                'hasDiv': true 
            }));

        // 7. Sort Dividend List
        divList.sort((a, b) => {
            const scoreA = getSelfMonthlySortScore(a['商品分類'], a['配息週期'], a['ETF代碼']);
            const scoreB = getSelfMonthlySortScore(b['商品分類'], b['配息週期'], b['ETF代碼']);
            
            if (scoreA.catScore !== scoreB.catScore) return scoreA.catScore - scoreB.catScore;
            if (scoreA.freqScore !== scoreB.freqScore) return scoreA.freqScore - scoreB.freqScore;
            if (scoreA.code !== scoreB.code) return scoreA.code.localeCompare(scoreB.code);
            return b['除息日期'].localeCompare(a['除息日期']);
        });

        return { list, div: divList };
    }, [basicInfo, priceData, historyData, divData, sizeData, mainTab, refDate]);

    // --- HELPER TO GET CURRENT COUNT ---
    const getCurrentCount = () => {
        if (mainTab === 'WEEKLY') {
            if (reportType === 'MARKET') return reportMarket.length;
            if (reportType === 'PRICE') return reportPrice.rows.length;
            if (reportType === 'DIVIDEND') return reportDividend.length;
            if (reportType === 'FILL') return reportFill.length;
        } else if (mainTab === 'SELF_MONTHLY') {
            if (selfMonthlySubTab === 'QUARTERLY_LIST') return selfMonthlyData.list.length;
            if (selfMonthlySubTab === 'EX_DIV_DATA') return selfMonthlyData.div.length;
        }
        return 0;
    };

    // --- EXPORT HANDLER ---
    const handleExport = () => {
        const timestamp = new Date().toISOString().split('T')[0];
        
        if (mainTab === 'SELF_MONTHLY') {
            if (selfMonthlySubTab === 'QUARTERLY_LIST') {
                const headers = ['商品分類', '配息週期', 'ETF代碼', 'ETF名稱', 'ETF類型', '規模大小', '起始日期', '起始股價', '最近日期', '最近股價'];
                exportToCSV(`自主月配_季配名單_${timestamp}`, headers, selfMonthlyData.list);
            } else {
                const headers = ['ETF代碼', 'ETF名稱', '年月', '除息日期', '除息金額'];
                exportToCSV(`自主月配_除息資料_${timestamp}`, headers, selfMonthlyData.div.map(d => ({
                    ...d,
                    '除息日期': d['除息日期'],
                    '除息金額': fmtDiv(d['除息金額'])
                })));
            }
            return;
        }

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
                'ETF代碼': d.etfCode, 'ETF名稱': d.etfName, '除息日期': d.exDate, '除息金額': fmtDiv(d.amount), '股利發放': d.paymentDate || '-'
            }));
            exportToCSV(`周報_除息_${timestamp}`, headers, data);
        } else if (reportType === 'FILL') {
            const headers = ['ETF代碼', 'ETF名稱', '除息日期', '除息金額', '除息前一天股價', '分析比對日期', '分析比對價格', '分析是否填息成功', '幾天填息'];
            const data = reportFill.map(d => ({
                'ETF代碼': d.etfCode, 'ETF名稱': d.etfName, '除息日期': d.exDate, '除息金額': fmtDiv(d.amount), '除息前一天股價': d.pricePreEx, '分析比對日期': d.fillDate, '分析比對價格': d.fillPrice, '分析是否填息成功': '是', '幾天填息': d.daysToFill
            }));
            exportToCSV(`周報_填息_${timestamp}`, headers, data);
        }
    };

    // --- REVISED COPY SCRIPT HANDLER (Consolidated) ---
    const handleCopyScript = () => {
        const payload: Record<string, any[][]> = {};
        let titleMode = "";

        if (mainTab === 'SELF_MONTHLY') {
            titleMode = "自主月配 (名單+除息)";

            // 1. 季配名單
            const listHeaders = ['商品分類', '配息週期', 'ETF 代碼', 'ETF 名稱', 'ETF類型', '規模大小', '起始日期', '起始股價', '最近日期', '最近股價'];
            const listRows = selfMonthlyData.list.map((row: any) => [
                row['商品分類'], 
                row['配息週期'], 
                `'${row['ETF代碼']}`, 
                row['ETF名稱'], 
                row['ETF類型'], 
                row['規模大小'], 
                row['起始日期'], 
                row['起始股價'], 
                row['最近日期'], 
                row['最近股價']
            ]);
            payload['季配名單'] = [listHeaders, ...listRows];

            // 2. 除息資料
            const divHeaders = ['ETF 代碼', 'ETF 名稱', '年月', '除息日期', '除息金額'];
            const divRows = selfMonthlyData.div.map((d: any) => [
                `'${d['ETF代碼']}`, 
                d['ETF名稱'], 
                d['年月'], 
                d['除息日期'], 
                fmtDiv(d['除息金額'])
            ]);
            payload['除息資料'] = [divHeaders, ...divRows];

        } else if (mainTab === 'WEEKLY') {
            titleMode = "每週報告 (4表合一)";

            // 1. 國際大盤
            const marketHeaders = ['日期', '指數名稱', '昨日收盤', '開盤', '高價', '低價', '現價', '漲跌點數', '漲跌幅度'];
            const marketRows = reportMarket.map(d => [d.date, d.indexName, d.prevClose, d.open, d.high, d.low, d.price, d.change, d.changePercent]);
            payload['週報_國際大盤'] = [marketHeaders, ...marketRows];

            // 2. ETF 股價 (Pivot)
            const { headers: dateHeaders, rows: pricePivotRows } = reportPrice;
            const priceFixedHeaders = ['商品分類', '配息週期', 'ETF代碼', 'ETF名稱', 'ETF類型'];
            const priceFullHeaders = [...priceFixedHeaders, ...dateHeaders];
            const priceRows = pricePivotRows.map((row: any) => {
                const base = [row['商品分類'], row['配息週期'], `'${row['ETF代碼']}`, row['ETF名稱'], row['ETF類型']];
                const dynamic = dateHeaders.map(dateKey => row[dateKey] || '');
                return [...base, ...dynamic];
            });
            payload['週報_ETF股價'] = [priceFullHeaders, ...priceRows];

            // 3. 除息
            const divHeaders = ['ETF代碼', 'ETF名稱', '除息日期', '除息金額', '股利發放'];
            const divRows = reportDividend.map(d => [`'${d.etfCode}`, d.etfName, d.exDate, fmtDiv(d.amount), d.paymentDate || '-']);
            payload['週報_除息'] = [divHeaders, ...divRows];

            // 4. 填息
            const fillHeaders = ['ETF代碼', 'ETF名稱', '除息日期', '除息金額', '除息前一天股價', '分析比對日期', '分析比對價格', '分析是否填息成功', '幾天填息'];
            const fillRows = reportFill.map(d => [`'${d.etfCode}`, d.etfName, d.exDate, fmtDiv(d.amount), d.pricePreEx, d.fillDate, d.fillPrice, '是', d.daysToFill]);
            payload['週報_填息'] = [fillHeaders, ...fillRows];
        }

        const jsonString = JSON.stringify(payload, null, 2);

        const scriptContent = `
/**
 * ETF 戰情室 - 一鍵寫入多個分頁腳本
 * 模式: ${titleMode}
 * 產生時間: ${new Date().toLocaleString()}
 */
function importAllData() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var payload = ${jsonString};

  // 遍歷所有需要寫入的分頁
  for (var sheetName in payload) {
    if (payload.hasOwnProperty(sheetName)) {
      var data = payload[sheetName];
      var sheet = spreadsheet.getSheetByName(sheetName);
      
      // 若分頁不存在則建立
      if (!sheet) {
        sheet = spreadsheet.insertSheet(sheetName);
      } else {
        sheet.clear(); // 清除舊資料
      }
      
      if (data.length > 0) {
        // 批量寫入
        var range = sheet.getRange(1, 1, data.length, data[0].length);
        range.setValues(data);
        
        // 美化標題列
        sheet.getRange(1, 1, 1, data[0].length).setFontWeight("bold").setBackground("#e6f7ff");
        Logger.log("已寫入: " + sheetName + " (" + data.length + " 筆)");
      } else {
        Logger.log("無資料: " + sheetName);
      }
    }
  }
  SpreadsheetApp.getUi().alert("✅ 資料匯入完成！");
}
        `;
        
        navigator.clipboard.writeText(scriptContent).then(() => {
            alert(`✅ Google Apps Script 已複製！\n\n模式: [${titleMode}]\n\n現在只需執行一次 importAllData 函式，即可同時更新所有相關分頁。\n\n請至 Google Sheet -> 擴充功能 -> Apps Script 貼上並執行。`);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert("複製失敗");
        });
    };

    // --- RENDER ---
    // 1. Top Level Tabs (Main)
    const MAIN_TABS = [
        { id: 'PRE_MARKET', label: '每日盤前', icon: Zap, color: 'text-amber-500', theme: 'amber' },
        { id: 'POST_MARKET', label: '每日盤後', icon: Moon, color: 'text-indigo-500', theme: 'indigo' },
        { id: 'WEEKLY', label: '每週報告', icon: FileText, color: 'text-blue-500', theme: 'blue' },
        { id: 'SELF_MONTHLY', label: '自主月配', icon: Calendar, color: 'text-orange-500', theme: 'orange' }
    ];

    // 2. Weekly Report Sub-Tabs
    const WEEKLY_SUB = [
        { id: 'MARKET', label: '國際大盤', icon: TrendingUp, color: 'text-blue-500', theme: 'blue' },
        { id: 'PRICE', label: 'ETF股價', icon: FileText, color: 'text-indigo-500', theme: 'indigo' },
        { id: 'DIVIDEND', label: '本週除息', icon: Filter, color: 'text-purple-500', theme: 'purple' },
        { id: 'FILL', label: '本週填息', icon: Search, color: 'text-emerald-500', theme: 'emerald' }
    ];

    // 3. Self Monthly Sub-Tabs
    const MONTHLY_SUB = [
        { id: 'QUARTERLY_LIST', label: '季配名單', icon: TableIcon, color: 'text-orange-500', theme: 'orange' },
        { id: 'EX_DIV_DATA', label: '除息資料', icon: PieChart, color: 'text-rose-500', theme: 'rose' }
    ];

    let activeTheme = 'blue';
    const mainConfig = MAIN_TABS.find(t => t.id === mainTab);
    if (mainConfig) activeTheme = mainConfig.theme;

    if (mainTab === 'WEEKLY') {
        const found = WEEKLY_SUB.find(t => t.id === reportType);
        if (found) activeTheme = found.theme;
    } else if (mainTab === 'SELF_MONTHLY') {
        const found = MONTHLY_SUB.find(t => t.id === selfMonthlySubTab);
        if (found) activeTheme = found.theme;
    }

    const getTableHeadClass = () => `bg-${activeTheme}-50 text-${activeTheme}-800 sticky top-0 font-bold z-10 text-base`;
    const getTableBodyClass = () => `divide-y divide-${activeTheme}-100 text-[15px]`;
    const getRowHoverClass = () => `group hover:bg-${activeTheme}-50 text-gray-600 transition-colors`;

    return (
        <div className={`flex flex-col h-full bg-${activeTheme}-50`}>
            {/* Top Navigation */}
            <div className={`bg-white border-b border-${activeTheme}-200 p-2 flex items-center justify-between flex-none`}>
                <div className="flex gap-2">
                    {MAIN_TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setMainTab(tab.id as any)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-base transition-all 
                                ${mainTab === tab.id 
                                    ? `bg-gray-700 text-white shadow-md` 
                                    : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50' 
                                }
                            `}
                        >
                            <tab.icon className={`w-4 h-4 ${mainTab === tab.id ? 'text-white' : tab.color}`} />
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className={`text-base font-bold text-${activeTheme}-700 bg-${activeTheme}-100 px-3 py-1 rounded-full`}>
                    進階資料中心
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden p-2">
                {mainTab === 'WEEKLY' ? (
                    <div className={`h-full flex flex-col bg-white rounded-xl shadow-sm border border-${activeTheme}-200 overflow-hidden`}>
                        {/* Weekly Report Controls */}
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-center justify-between flex-none">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm">
                                    <Calendar className="w-5 h-5 text-blue-600" />
                                    <span className="font-bold text-gray-500 text-base">基準日期:</span>
                                    <input 
                                        type="date" 
                                        value={refDate} 
                                        onChange={(e) => setRefDate(e.target.value)} 
                                        className="outline-none font-mono font-bold text-gray-600 bg-transparent text-base"
                                    />
                                </div>
                                <div className="text-base font-bold text-gray-400 flex gap-3">
                                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">上週五: {dateRange.lastFriday}</span>
                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded">本週一: {dateRange.thisMonday}</span>
                                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">本週五: {dateRange.thisFriday}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-base font-bold text-gray-500 mr-2">(共 {getCurrentCount()} 筆)</span>
                                <button onClick={handleCopyScript} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm text-base">
                                    <Code className="w-4 h-4" /> 複製自動化腳本(全)
                                </button>
                                <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-sm text-base">
                                    <Download className="w-4 h-4" /> 匯出 CSV
                                </button>
                            </div>
                        </div>

                        {/* Report Type Tabs */}
                        <div className="p-2 border-b border-gray-200 bg-white flex gap-2 flex-none overflow-x-auto">
                            {WEEKLY_SUB.map(btn => (
                                <button
                                    key={btn.id}
                                    onClick={() => setReportType(btn.id as any)}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-base border transition-all whitespace-nowrap min-w-[120px] justify-center
                                        ${reportType === btn.id 
                                            ? `bg-gray-700 text-white border-gray-700 shadow-md` 
                                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
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
                            {/* ... (Market, Price, Dividend, Fill tables remain unchanged) ... */}
                            {reportType === 'MARKET' && (
                                <table className="w-full text-left border-collapse">
                                    <thead className={getTableHeadClass()}>
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
                                    <tbody className={getTableBodyClass()}>
                                        {reportMarket.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-gray-400 text-lg">無資料</td></tr> :
                                        reportMarket.map((d, i) => (
                                            <tr key={i} className={getRowHoverClass()}>
                                                <td className="p-3 font-mono">{d.date}</td>
                                                <td className="p-3 font-bold">{d.indexName}</td>
                                                <td className="p-3 text-right font-mono text-gray-400">{fmtNum(d.prevClose)}</td>
                                                <td className="p-3 text-right font-mono">{fmtNum(d.open)}</td>
                                                <td className="p-3 text-right font-mono text-red-500">{fmtNum(d.high)}</td>
                                                <td className="p-3 text-right font-mono text-green-500">{fmtNum(d.low)}</td>
                                                <td className="p-3 text-right font-mono font-bold text-blue-700">{fmtNum(d.price)}</td>
                                                <td className={`p-3 text-right font-mono font-bold ${d.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>{d.change >= 0 ? '+' : ''}{fmtNum(d.change)}</td>
                                                <td className={`p-3 text-right font-mono font-bold ${d.changePercent >= 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtNum(d.changePercent)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {reportType === 'PRICE' && (
                                <table className="w-full text-left border-collapse">
                                    <thead className={getTableHeadClass()}>
                                        <tr>
                                            <th className={`p-3 whitespace-nowrap bg-${activeTheme}-50 sticky left-0 z-20`}>ETF代碼</th>
                                            <th className={`p-3 whitespace-nowrap bg-${activeTheme}-50 sticky left-[90px] z-20`}>ETF名稱</th>
                                            <th className="p-3 whitespace-nowrap">商品分類</th>
                                            <th className="p-3 whitespace-nowrap">配息週期</th>
                                            <th className="p-3 whitespace-nowrap">ETF類型</th>
                                            {reportPrice.headers.map(d => (
                                                <th key={d} className="p-3 whitespace-nowrap text-right font-mono">{d}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className={getTableBodyClass()}>
                                        {reportPrice.rows.length === 0 ? <tr><td colSpan={5 + reportPrice.headers.length} className="p-8 text-center text-gray-400 text-lg">無資料 (或全部被排除)</td></tr> :
                                        reportPrice.rows.map((row: any, i: number) => (
                                            <tr key={i} className={getRowHoverClass()}>
                                                <td className={`p-3 font-mono font-bold text-indigo-600 bg-white sticky left-0 z-10 group-hover:bg-${activeTheme}-50 transition-colors`}>{row['ETF代碼']}</td>
                                                <td className={`p-3 font-bold text-gray-600 bg-white sticky left-[90px] z-10 group-hover:bg-${activeTheme}-50 transition-colors`}>{row['ETF名稱']}</td>
                                                <td className="p-3">{row['商品分類']}</td>
                                                <td className="p-3"><span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-bold text-gray-500">{row['配息週期']}</span></td>
                                                <td className="p-3">{row['ETF類型']}</td>
                                                {reportPrice.headers.map(d => (
                                                    <td key={d} className="p-3 text-right font-mono font-medium text-gray-600 bg-gray-50/30">
                                                        {row[d] !== '' ? fmtNum(row[d]) : '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {reportType === 'DIVIDEND' && (
                                <table className="w-full text-left border-collapse">
                                    <thead className={getTableHeadClass()}>
                                        <tr>
                                            <th className="p-3">ETF代碼</th>
                                            <th className="p-3">ETF名稱</th>
                                            <th className="p-3">除息日期</th>
                                            <th className="p-3 text-right">除息金額</th>
                                            <th className="p-3 text-right">股利發放</th>
                                        </tr>
                                    </thead>
                                    <tbody className={getTableBodyClass()}>
                                        {reportDividend.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-400 text-lg">本週無除息資料</td></tr> :
                                        reportDividend.map((d, i) => (
                                            <tr key={i} className={getRowHoverClass()}>
                                                <td className="p-3 font-mono font-bold text-purple-600">{d.etfCode}</td>
                                                <td className="p-3 font-bold">{d.etfName}</td>
                                                <td className="p-3 font-mono">{d.exDate}</td>
                                                {/* 3 decimals */}
                                                <td className="p-3 text-right font-bold text-emerald-600">{fmtDiv(d.amount)}</td>
                                                <td className="p-3 text-right font-mono">{d.paymentDate || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {reportType === 'FILL' && (
                                <table className="w-full text-left border-collapse">
                                    <thead className={getTableHeadClass()}>
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
                                    <tbody className={getTableBodyClass()}>
                                        {reportFill.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-gray-400 text-lg">本週無填息資料 (僅顯示2026年起之除息)</td></tr> :
                                        reportFill.map((d, i) => (
                                            <tr key={i} className={getRowHoverClass()}>
                                                <td className="p-3 font-mono font-bold text-emerald-600">{d.etfCode}</td>
                                                <td className="p-3 font-bold">{d.etfName}</td>
                                                <td className="p-3 font-mono text-gray-400">{d.exDate}</td>
                                                {/* 3 decimals */}
                                                <td className="p-3 text-right font-bold text-gray-600">{fmtDiv(d.amount)}</td>
                                                <td className="p-3 text-right font-mono text-gray-400">{fmtNum(d.pricePreEx)}</td>
                                                <td className="p-3 text-center font-mono font-bold text-emerald-700">{d.fillDate}</td>
                                                <td className="p-3 text-right font-mono font-bold text-emerald-700">{fmtNum(d.fillPrice)}</td>
                                                <td className="p-3 text-center font-bold text-emerald-600">填息成功</td>
                                                <td className="p-3 text-right font-mono">{d.daysToFill}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                ) : mainTab === 'SELF_MONTHLY' ? (
                    <div className={`h-full flex flex-col bg-white rounded-xl shadow-sm border border-${activeTheme}-200 overflow-hidden`}>
                        {/* SELF MONTHLY HEADER */}
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-center justify-between flex-none">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm">
                                    <Calendar className="w-5 h-5 text-orange-500" />
                                    <span className="font-bold text-gray-500 text-base">分析基準年月:</span>
                                    <input 
                                        type="date" 
                                        value={refDate} 
                                        onChange={(e) => setRefDate(e.target.value)} 
                                        className="outline-none font-mono font-bold text-gray-600 bg-transparent text-base"
                                    />
                                    <span className="text-sm text-orange-500 ml-2">(抓取前一年同月股價)</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-base font-bold text-gray-500 mr-2">(共 {getCurrentCount()} 筆)</span>
                                <button onClick={handleCopyScript} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm text-base">
                                    <Code className="w-4 h-4" /> 複製自動化腳本(全)
                                </button>
                                <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-sm text-base">
                                    <Download className="w-4 h-4" /> 匯出 CSV
                                </button>
                            </div>
                        </div>

                        {/* SELF MONTHLY SUB-TABS */}
                        <div className="p-2 border-b border-gray-200 bg-white flex gap-2 flex-none">
                            {MONTHLY_SUB.map(btn => (
                                <button
                                    key={btn.id}
                                    onClick={() => setSelfMonthlySubTab(btn.id as any)}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-base border transition-all 
                                        ${selfMonthlySubTab === btn.id 
                                            ? `bg-gray-700 text-white border-gray-700 shadow-md` 
                                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                        }
                                    `}
                                >
                                    <btn.icon className={`w-4 h-4 ${selfMonthlySubTab === btn.id ? 'text-white' : btn.color}`} />
                                    {btn.label}
                                </button>
                            ))}
                        </div>

                        {/* SELF MONTHLY CONTENT */}
                        <div className="flex-1 overflow-auto bg-white p-0">
                            {selfMonthlySubTab === 'QUARTERLY_LIST' && (
                                <table className="w-full text-left border-collapse">
                                    <thead className={getTableHeadClass()}>
                                        <tr>
                                            <th className="p-3 whitespace-nowrap">商品分類</th>
                                            <th className="p-3 whitespace-nowrap">配息週期</th>
                                            <th className="p-3 whitespace-nowrap">ETF代碼</th>
                                            <th className="p-3 whitespace-nowrap">ETF名稱</th>
                                            <th className="p-3 whitespace-nowrap">ETF類型</th>
                                            <th className="p-3 whitespace-nowrap text-right">規模大小</th>
                                            <th className={`p-3 whitespace-nowrap text-center bg-${activeTheme}-100`}>起始日期 (去年)</th>
                                            <th className={`p-3 whitespace-nowrap text-right bg-${activeTheme}-100`}>起始股價</th>
                                            <th className="p-3 whitespace-nowrap text-center">最近日期</th>
                                            <th className="p-3 whitespace-nowrap text-right">最近股價</th>
                                        </tr>
                                    </thead>
                                    <tbody className={getTableBodyClass()}>
                                        {selfMonthlyData.list.length === 0 ? <tr><td colSpan={10} className="p-8 text-center text-gray-400 text-lg">無符合「季配」之資料</td></tr> :
                                        selfMonthlyData.list.map((row: any, i: number) => (
                                            <tr key={i} className={getRowHoverClass()}>
                                                <td className="p-3">{row['商品分類']}</td>
                                                <td className="p-3"><span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-bold text-gray-500">{row['配息週期']}</span></td>
                                                <td className="p-3 font-mono font-bold text-blue-600">{row['ETF代碼']}</td>
                                                <td className="p-3 font-bold text-gray-600">{row['ETF名稱']}</td>
                                                <td className="p-3">{row['ETF類型']}</td>
                                                <td className="p-3 text-right font-mono">{row['規模大小'] !== '-' ? Number(row['規模大小']).toLocaleString() : '-'}</td>
                                                <td className="p-3 text-center font-mono text-orange-600 bg-orange-50/50 flex items-center justify-center gap-1">
                                                    {row['dateWarning'] && <AlertTriangle className="w-4 h-4 text-red-500" title="起始日期較晚，可能缺少月初資料" />}
                                                    {row['起始日期']}
                                                </td>
                                                <td className="p-3 text-right font-mono font-bold text-orange-600 bg-orange-50/50">{fmtNum(row['起始股價'])}</td>
                                                <td className="p-3 text-center font-mono text-gray-500">{row['最近日期']}</td>
                                                <td className="p-3 text-right font-mono font-bold text-blue-600">{fmtNum(row['最近股價'])}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {selfMonthlySubTab === 'EX_DIV_DATA' && (
                                <table className="w-full text-left border-collapse">
                                    <thead className={getTableHeadClass()}>
                                        <tr>
                                            <th className="p-3">ETF代碼</th>
                                            <th className="p-3">ETF名稱</th>
                                            <th className="p-3">年月</th>
                                            <th className="p-3">除息日期</th>
                                            <th className="p-3 text-right">除息金額</th>
                                        </tr>
                                    </thead>
                                    <tbody className={getTableBodyClass()}>
                                        {selfMonthlyData.div.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-400 text-lg">無相關除息資料</td></tr> :
                                        selfMonthlyData.div.map((d: any, i: number) => (
                                            <tr key={i} className={getRowHoverClass()}>
                                                <td className="p-3 font-mono font-bold text-blue-600">{d['ETF代碼']}</td>
                                                <td className="p-3 font-bold text-gray-600">{d['ETF名稱']}</td>
                                                <td className="p-3 font-mono">{d['年月']}</td>
                                                <td className="p-3 font-mono">{d['hasDiv'] ? d['除息日期'] : '無除息'}</td>
                                                {/* 3 decimals */}
                                                <td className={`p-3 text-right font-bold ${d['hasDiv'] ? 'text-emerald-600' : 'text-gray-400 italic'}`}>
                                                    {d['hasDiv'] ? fmtDiv(d['除息金額']) : '無除息'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className={`h-full flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-${activeTheme}-200 text-gray-400`}>
                        <AlertCircle className={`w-16 h-16 mb-4 opacity-50 text-${activeTheme}-400`} />
                        <h2 className="text-xl font-bold text-gray-600">功能開發中</h2>
                        <p className={`text-${activeTheme}-500`}>{mainTab === 'PRE_MARKET' ? '每日盤前分析模組' : '每日盤後統計模組'} 即將上線</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TabAdvancedSearch;