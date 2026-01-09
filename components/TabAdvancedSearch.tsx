import React, { useState, useEffect, useMemo } from 'react';
import { 
    getMarketData, getBasicInfo, getPriceData, getDividendData, getFillAnalysisData, exportToCSV 
} from '../services/dataService';
import { 
    MarketData, BasicInfo, PriceData, DividendData, FillAnalysisData 
} from '../types';
import { 
    Calendar, Search, FileText, Download, TrendingUp, Filter, Code, AlertCircle 
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

    // --- REPORT DATA PROCESSING (Visual Preview Only) ---
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
                return a.date.localeCompare(b.date);
            });
    }, [marketData, mainTab, reportType, dateRange]);

    const reportPrice = useMemo(() => {
        if (mainTab !== 'WEEKLY' || reportType !== 'PRICE') return { headers: [], rows: [] };
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
            
            // Logic: Filter International generally, UNLESS it is Quarterly
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
    }, [basicInfo, priceData, mainTab, reportType, dateRange]);

    const reportDividend = useMemo(() => {
        if (mainTab !== 'WEEKLY' || reportType !== 'DIVIDEND') return [];
        const start = dateRange.thisMonday;
        const end = dateRange.thisFriday;
        
        return divData
            .filter(d => d.exDate >= start && d.exDate <= end)
            .sort((a,b) => a.exDate.localeCompare(b.exDate));
    }, [divData, mainTab, reportType, dateRange]);

    const reportFill = useMemo(() => {
        if (mainTab !== 'WEEKLY' || reportType !== 'FILL') return [];
        const start = dateRange.thisMonday;
        const end = dateRange.thisFriday;

        return fillData
            .filter(d => {
                const exYear = parseInt(d.exDate.split('-')[0]);
                // LOGIC SYNC: Must be 2026+, Filled, and Fill Date in THIS week
                return d.isFilled && d.fillDate >= start && d.fillDate <= end && exYear >= 2026;
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

    // --- GOOGLE APPS SCRIPT GENERATOR (ALL-IN-ONE) ---
    const handleCopyScript = () => {
        const scriptContent = `
/**
 * ETF 戰情室 - 自動化週報生成腳本
 * 修正版: V3.0 (回應使用者回饋)
 * 1. 國際大盤資料抓取修正 (增強欄位偵測)
 * 2. ETF代碼強制文字格式 (解決 0050 變 50 問題)
 * 3. 過濾邏輯修正 (國際但季配者保留，其餘國際/半年配排除)
 * 4. 填息資料抓取增強 (修正欄位別名)
 */

var CONFIG = {
  urls: {
    market: [
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ825Haq0XnIX_UDCtnyd5t94U943OJ_sCJdLj2-6XfbWT4KkLaQ-RWBL_esd4HHaQGJTW3hOV2qtax/pub?gid=779511679&single=true&output=csv',
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vRuulQ6E-VFeNU6otpWOOIZQOwcG8ybE0EdR_RooQLW1VYi6Xhtcl4KnADees6YIALU29jmBlODPeQQ/pub?gid=779511679&single=true&output=csv'
    ],
    price: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQaRKeSBt4XfeC9uNf56p38DwscoPK0-eFM3J4-Vz8LeVBdgsClDZy0baU-FHyFv5cz-QNCXUVMwBfr/pub?gid=462296829&single=true&output=csv',
    basic: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTc6ZANKmAJQCXC9k7np_eIhAwC2hF_w9KSpseD0qogcPP0I2rPPhtesNEbHvG48b_tLh9qeu4tr21Q/pub?output=csv',
    dividend: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR5JvOGT3eB4xq9phw2dXHApJKOgQkUZcs69CsJfL0Iw3s6egADwA8HdbimrWUceQZl_73pnsSLVnQw/pub?output=csv',
    history: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQJKO3upGfGOWStHGuktI2c0ULLQrysCe-B2qbSl3HwgZA1x8ZFekV7Vl_XeSoInKGiyoJD88iAB3q3/pub?output=csv'
  }
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('ETF戰情室')
      .addItem('執行全部更新', 'main_RunAll')
      .addToUi();
}

function step2_UpdateETFPrice() {
  main_RunAll(); 
}

function main_RunAll() {
  var dates = getWeeklyDates();
  console.log("Date Range: " + JSON.stringify(dates));
  
  step1_UpdateMarket(dates);
  step2_ExecETFPrice(dates);
  step3_UpdateDividend(dates);
  step4_UpdateFill(dates);
}

// === 1. 國際大盤 ===
function step1_UpdateMarket(dates) {
  var sheetName = "國際大盤";
  var allRows = [["日期", "指數名稱", "昨日收盤", "開盤", "高價", "低價", "現價", "漲跌點數", "漲跌幅度"]];
  
  CONFIG.urls.market.forEach(function(url) {
    var csv = fetchCsv(url);
    if (csv.length < 2) return;
    var h = csv[0];
    // 增加更多欄位別名
    var idx = {
      name: findIdx(h, ['指數名稱', 'IndexName', '名稱']), 
      date: findIdx(h, ['日期', 'tradetime', 'Date']),
      prev: findIdx(h, ['昨日收盤', 'closeyest', 'Prev']), 
      open: findIdx(h, ['開盤', 'priceopen', 'open', 'Open']),
      high: findIdx(h, ['高價', 'high', 'High']), 
      low: findIdx(h, ['低價', 'low', 'Low']),
      price: findIdx(h, ['現價', 'price', 'Close', '收盤價', '收盤']), 
      chg: findIdx(h, ['漲跌點數', 'change', '漲跌']),
      pct: findIdx(h, ['漲跌幅度', 'percent', 'changepercent', '幅度'])
    };
    
    // 如果找不到關鍵欄位，跳過此 CSV
    if (idx.name === -1 || idx.price === -1) return;

    for (var i = 1; i < csv.length; i++) {
      var r = csv[i];
      var d = formatDate(r[idx.date]);
      if (!d) continue; // Skip invalid dates
      
      // 區間判斷 (字串比較 yyyy-MM-dd)
      if (d >= dates.lastFriday && d <= dates.thisFriday) {
        allRows.push([
          d, 
          r[idx.name], 
          safeVal(r[idx.prev]), 
          safeVal(r[idx.open]), 
          safeVal(r[idx.high]), 
          safeVal(r[idx.low]), 
          safeVal(r[idx.price]), 
          safeVal(r[idx.chg]), 
          safeVal(r[idx.pct])
        ]);
      }
    }
  });
  
  allRows.sort(function(a,b) {
     if(a[0]==='日期') return -1;
     var wA = getIndexWeight(a[1]); var wB = getIndexWeight(b[1]);
     if(wA !== wB) return wA - wB;
     return a[0].localeCompare(b[0]);
  });
  writeToSheet(sheetName, allRows);
}

// === 2. ETF 股價 (Pivot) ===
function step2_ExecETFPrice(dates) {
  var sheetName = "ETF 股價";
  var basicCsv = fetchCsv(CONFIG.urls.basic);
  var validCodes = {};
  var etfList = [];
  
  if (basicCsv.length > 1) {
    var h = basicCsv[0];
    var idx = {
      code: findIdx(h, ['代碼', 'Code']), 
      name: findIdx(h, ['名稱', 'Name']),
      cat: findIdx(h, ['分類', 'Category']), 
      freq: findIdx(h, ['週期', 'Freq']),
      type: findIdx(h, ['類型', 'Type']), 
      mkt: findIdx(h, ['市場', 'Market'])
    };
    
    for (var i = 1; i < basicCsv.length; i++) {
      var r = basicCsv[i];
      var code = String(r[idx.code]).trim();
      var name = String(r[idx.name]);
      var cat = String(r[idx.cat]);
      var freq = String(r[idx.freq]);
      var type = String(r[idx.type]);
      var mkt = String(r[idx.mkt]);

      // === 過濾邏輯 ===
      var keep = true;
      
      // 1. 排除 00911 (User specific)
      if (code === '00911') keep = false;
      
      // 2. 排除 "半年配"
      if (keep && (freq.indexOf('半年') > -1 || cat.indexOf('半年') > -1)) keep = false;
      
      // 3. 處理 "國際"
      var isForeign = (cat.indexOf('國外') > -1 || type.indexOf('國外') > -1 || mkt.indexOf('國外') > -1 || cat.indexOf('國際') > -1 || type.indexOf('國際') > -1 || name.indexOf('國際') > -1);
      
      if (keep && isForeign) {
         // 規則: 國際商品若為「季配」則保留，否則排除
         // (User request: Filter International BUT keep if Quarterly)
         if (freq.indexOf('季') > -1) {
             keep = true;
         } else {
             keep = false;
         }
      }
      
      if (keep) {
        validCodes[code] = { name: name, cat: cat, freq: freq, type: type };
        etfList.push(code);
      }
    }
  }

  // 抓取股價
  var priceCsv = fetchCsv(CONFIG.urls.price);
  var priceMap = {};
  var uniqueDates = [];
  var dateSet = {};
  
  if (priceCsv.length > 1) {
    var h = priceCsv[0];
    var idxP = { code: findIdx(h, ['代碼']), date: findIdx(h, ['日期']), price: findIdx(h, ['收盤', 'price', 'Close']) };
    for (var i = 1; i < priceCsv.length; i++) {
      var r = priceCsv[i];
      var d = formatDate(r[idxP.date]);
      var c = String(r[idxP.code]).trim();
      
      if (validCodes[c] && d >= dates.lastFriday && d <= dates.thisFriday) {
        if (!priceMap[c]) priceMap[c] = {};
        priceMap[c][d] = r[idxP.price];
        if (!dateSet[d]) { dateSet[d] = true; uniqueDates.push(d); }
      }
    }
  }
  uniqueDates.sort();

  // 輸出
  var output = [];
  var header = ['商品分類', '配息週期', 'ETF代碼', 'ETF名稱', 'ETF類型'].concat(uniqueDates);
  output.push(header);
  
  var rows = [];
  etfList.forEach(function(code) {
    var info = validCodes[code];
    var prices = priceMap[code] || {};
    var hasData = false;
    // 檢查是否有任一天的資料
    uniqueDates.forEach(function(d) {
      if (prices[d]) hasData = true;
    });
    
    if (hasData) {
        // *** 修正: 代碼前加 ' 以強制文字格式 ***
        var row = [info.cat, info.freq, "'" + code, info.name, info.type];
        uniqueDates.forEach(function(d) {
          row.push(prices[d] || "");
        });
        rows.push(row);
    }
  });
  
  // 排序 (類別權重 -> 代碼)
  rows.sort(function(a, b) {
     var wA = getWeight(a[0], a[1]);
     var wB = getWeight(b[0], b[1]);
     if (wA !== wB) return wA - wB;
     return String(a[2]).localeCompare(String(b[2]));
  });
  
  output = output.concat(rows);
  writeToSheet(sheetName, output);
}

// === 3. 本週除息 ===
function step3_UpdateDividend(dates) {
  var sheetName = "本周除息";
  var csv = fetchCsv(CONFIG.urls.dividend);
  var output = [["ETF代碼", "ETF名稱", "除息日期", "除息金額", "股利發放日"]];
  
  if (csv.length > 1) {
    var h = csv[0];
    // 擴充欄位別名
    var idx = { 
        code: findIdx(h, ['ETF代碼', '代碼', 'Code']), 
        name: findIdx(h, ['ETF名稱', '名稱', 'Name']), 
        ex: findIdx(h, ['除息日期', '除息日', 'ExDate', '除息']), 
        amt: findIdx(h, ['除息金額', '金額', 'Amount']), 
        pay: findIdx(h, ['股利發放', '發放日', 'PayDate']) 
    };
    
    for (var i = 1; i < csv.length; i++) {
      var r = csv[i];
      var d = formatDate(r[idx.ex]);
      if (d >= dates.thisMonday && d <= dates.thisFriday) {
        output.push(["'" + r[idx.code], r[idx.name], d, r[idx.amt], r[idx.pay]]);
      }
    }
  }
  writeToSheet(sheetName, output);
}

// === 4. 本週填息 ===
function step4_UpdateFill(dates) {
  var sheetName = "本周填息";
  
  var priceMap = {}; 
  var loadP = function(u) {
    var c = fetchCsv(u);
    if (c.length < 2) return;
    var h = c[0];
    var idx = { code: findIdx(h,['代碼']), date: findIdx(h,['日期']), price: findIdx(h,['價','Price','收盤']) };
    for (var i=1; i<c.length; i++) {
      var d = formatDate(c[i][idx.date]);
      if (d > '2025-12-01') { 
        var code = String(c[i][idx.code]).trim();
        if (!priceMap[code]) priceMap[code] = [];
        priceMap[code].push({ d: d, p: parseFloat(c[i][idx.price]) });
      }
    }
  };
  loadP(CONFIG.urls.price);
  loadP(CONFIG.urls.history);
  
  for(var k in priceMap) { priceMap[k].sort(function(a,b){ return a.d.localeCompare(b.d); }); }

  var divCsv = fetchCsv(CONFIG.urls.dividend);
  var output = [["ETF代碼", "ETF名稱", "除息日期", "除息金額", "除息前一天股價", "分析比對日期", "分析比對價格", "分析是否填息成功", "幾天填息"]];
  
  if (divCsv.length > 1) {
    var h = divCsv[0];
    var idx = { 
        code: findIdx(h,['ETF代碼', '代碼']), 
        name: findIdx(h,['ETF名稱', '名稱']), 
        ex: findIdx(h,['除息日期', '除息日', 'ExDate', '除息']), 
        amt: findIdx(h,['除息金額', '金額']) 
    };
    
    for (var i=1; i<divCsv.length; i++) {
      var r = divCsv[i];
      var exDate = formatDate(r[idx.ex]);
      if (!exDate) continue;

      var exYear = parseInt(exDate.split('-')[0]);
      if (isNaN(exYear) || exYear < 2026) continue;

      var code = String(r[idx.code]).trim();
      var prices = priceMap[code];
      if (!prices) continue;
      
      var preExPrice = 0;
      var exIdx = -1;
      for (var k=0; k<prices.length; k++) {
        if (prices[k].d >= exDate) {
          exIdx = k;
          if (k > 0) preExPrice = prices[k-1].p;
          break;
        }
      }
      
      if (exIdx === -1 || preExPrice === 0) continue;
      
      for (var k=exIdx; k<prices.length; k++) {
        if (prices[k].p >= preExPrice) {
          if (prices[k].d >= dates.thisMonday && prices[k].d <= dates.thisFriday) {
            var days = Math.floor((new Date(prices[k].d) - new Date(exDate)) / (86400000));
            output.push(["'" + code, r[idx.name], exDate, r[idx.amt], preExPrice, prices[k].d, prices[k].p, "是", days]);
          }
          break; 
        }
      }
    }
  }
  writeToSheet(sheetName, output);
}

// === UTILS ===
function getWeeklyDates() {
  var t = new Date(); 
  var day = t.getDay(); 
  // Mon: 1, Sun: 0. 
  // Diff to Mon: t - day + (day==0?-6:1)
  var diff = t.getDate() - day + (day === 0 ? -6 : 1);
  
  var mon = new Date(t); mon.setDate(diff); // This Monday
  var fri = new Date(mon); fri.setDate(mon.getDate() + 4); // This Friday
  var lFri = new Date(mon); lFri.setDate(mon.getDate() - 3); // Last Friday
  
  return {
    thisMonday: Utilities.formatDate(mon, Session.getScriptTimeZone(), "yyyy-MM-dd"),
    thisFriday: Utilities.formatDate(fri, Session.getScriptTimeZone(), "yyyy-MM-dd"),
    lastFriday: Utilities.formatDate(lFri, Session.getScriptTimeZone(), "yyyy-MM-dd")
  };
}

function formatDate(d) { 
  if(!d) return "";
  // 處理 yyyy/MM/dd 格式
  var s = String(d).replace(/\\//g, "-").trim();
  // 簡單檢查格式
  if (s.match(/^\\d{4}-\\d{1,2}-\\d{1,2}/)) {
     // 補零 (e.g. 2023-1-1 -> 2023-01-01)
     var p = s.split('-');
     return p[0] + '-' + (p[1].length<2?'0'+p[1]:p[1]) + '-' + (p[2].length<2?'0'+p[2]:p[2]);
  }
  return s;
}

function safeVal(v) {
  return (v === undefined || v === null) ? "" : v;
}

function fetchCsv(url) {
  try { 
    var r = UrlFetchApp.fetch(url, {muteHttpExceptions:true}); 
    if (r.getResponseCode() !== 200) return [];
    var txt = r.getContentText();
    // 簡單過濾 HTML 錯誤頁面
    if (txt.indexOf("<!DOCTYPE") > -1) return [];
    return Utilities.parseCsv(txt); 
  } catch(e){ return []; }
}

function findIdx(h, keys) { 
  if (!h) return -1;
  for(var i=0; i<h.length; i++) {
    var cell = String(h[i]).trim();
    for(var k=0; k<keys.length; k++) {
       if (cell.indexOf(keys[k]) > -1) return i;
    }
  }
  return -1;
}

function writeToSheet(name, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(name);
  if (s) ss.deleteSheet(s);
  s = ss.insertSheet(name);
  if(data.length>0) {
    // 設為文字格式避免 0050 變成 50
    s.getRange(1,1,data.length,data[0].length).setNumberFormat("@");
    s.getRange(1,1,data.length,data[0].length).setValues(data);
  } else {
    s.getRange(1,1).setValue("無符合條件資料");
  }
}

function getIndexWeight(name) {
  if (name.indexOf('加權')>-1) return 1;
  if (name.indexOf('道瓊')>-1) return 2;
  if (name.indexOf('那斯')>-1) return 3;
  if (name.indexOf('費')>-1) return 4;
  if (name.indexOf('標普')>-1 || name.indexOf('S&P')>-1) return 5;
  return 6;
}

function getWeight(cat, freq) {
  if (cat.indexOf('債') > -1) return 5;
  if (freq.indexOf('月') > -1) return 4;
  if (freq.indexOf('季一') > -1) return 1;
  if (freq.indexOf('季二') > -1) return 2;
  if (freq.indexOf('季三') > -1) return 3;
  return 6;
}
        `;

        navigator.clipboard.writeText(scriptContent).then(() => {
            alert("✅ 自動化腳本已更新！(V3.0 同步版)\n\n修正重點：\n1. 擴充資料欄位偵測 (修復國際大盤/填息資料空白)\n2. ETF代碼前補單引號，確保顯示為 0050 而非 50\n3. 過濾邏輯修正：排除半年配，排除國際 (除非是季配)\n\n請前往 Google Apps Script 貼上並執行。");
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
                                    <Code className="w-4 h-4" /> 複製自動化腳本
                                </button>
                                <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                                    <Download className="w-4 h-4" /> 匯出 CSV
                                </button>
                            </div>
                        </div>

                        {/* Report Type Tabs */}
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