import { MarketData, BasicInfo, PriceData, DividendData, FillAnalysisData, SizeData, HistoryData } from '../types';

// --- STORAGE KEYS ---
const KEYS = {
    MARKET: 'db_market_data',
    BASIC: 'db_basic_info',
    PRICE: 'db_price_data',
    DIVIDEND: 'db_dividend_data',
    SIZE: 'db_size_data',
    HISTORY: 'db_history_data'
};

// --- SYSTEM DEFAULTS (HARDCODED URLs) ---
export const DEFAULT_SYSTEM_URLS = {
    // AP211 (TW) + AP212 (US) - Combined
    market: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ825Haq0XnIX_UDCtnyd5t94U943OJ_sCJdLj2-6XfbWT4KkLaQ-RWBL_esd4HHaQGJTW3hOV2qtax/pub?gid=779511679&single=true&output=csv|https://docs.google.com/spreadsheets/d/e/2PACX-1vRuulQ6E-VFeNU6otpWOOIZQOwcG8ybE0EdR_RooQLW1VYi6Xhtcl4KnADees6YIALU29jmBlODPeQQ/pub?gid=779511679&single=true&output=csv',
    // AP213 (Price) - Updated GID 462296829
    price: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQaRKeSBt4XfeC9uNf56p38DwscoPK0-eFM3J4-Vz8LeVBdgsClDZy0baU-FHyFv5cz-QNCXUVMwBfr/pub?gid=462296829&single=true&output=csv',
    // AP214 (Basic) - Updated Link
    basic: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTc6ZANKmAJQCXC9k7np_eIhAwC2hF_w9KSpseD0qogcPP0I2rPPhtesNEbHvG48b_tLh9qeu4tr21Q/pub?output=csv',
    // AP215 (Dividend) - Updated Link
    dividend: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR5JvOGT3eB4xq9phw2dXHApJKOgQkUZcs69CsJfL0Iw3s6egADwA8HdbimrWUceQZl_73pnsSLVnQw/pub?output=csv',
    // AP216 (Size)
    size: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTV4TXRt6GUxvN7ZPQYMfSMzaBskjCLKUQbHOJcOcyCBMwyrDYCbHK4MghK8N-Cfp_we_LkvV-bz9zg/pub?output=csv',
    // AP217 (History) - Updated Link
    history: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQJKO3upGfGOWStHGuktI2c0ULLQrysCe-B2qbSl3HwgZA1x8ZFekV7Vl_XeSoInKGiyoJD88iAB3q3/pub?output=csv'
};

// --- HELPER: ROBUST CSV PARSER ---
const parseCSV = (text: string): any[] => {
    // 1. Sanity Check: Reject HTML Error Pages immediately
    if (text.trim().match(/^<!DOCTYPE/i) || 
        text.trim().match(/^<html/i) || 
        text.includes('檔案可能已遭到移動') || 
        text.includes('File might have been moved') ||
        text.includes('does not exist')) {
        return [];
    }

    const cleanText = text.replace(/^\uFEFF/, '');
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentVal = '';
    let inQuotes = false;
    
    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        const nextChar = cleanText[i + 1];
        
        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                currentVal += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                currentVal += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                currentRow.push(currentVal.trim());
                currentVal = '';
            } else if (char === '\r' && nextChar === '\n') {
                currentRow.push(currentVal.trim());
                rows.push(currentRow);
                currentRow = [];
                currentVal = '';
                i++;
            } else if (char === '\n' || char === '\r') {
                currentRow.push(currentVal.trim());
                rows.push(currentRow);
                currentRow = [];
                currentVal = '';
            } else {
                currentVal += char;
            }
        }
    }
    
    if (currentVal || currentRow.length > 0) {
        currentRow.push(currentVal.trim());
        rows.push(currentRow);
    }
    
    if (rows.length < 2) return [];

    const originalHeaders = rows[0].map(h => h.trim());
    const result = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length <= 1 && !row[0]) continue;
        
        const obj: any = {};
        originalHeaders.forEach((h, idx) => {
            obj[h] = row[idx];
            const normH = h.replace(/\s+/g, ''); 
            if (normH !== h) obj[normH] = row[idx];
        });
        result.push(obj);
    }
    return result;
};

const safeFloat = (val: any): number => {
    if (!val) return 0;
    const str = String(val).replace(/,/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

const normalizeDate = (dateVal: any): string => {
    if (!dateVal) return '';
    const dateStr = String(dateVal).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
        let y = parts[0];
        // Handle 民國 year if mistakenly entered? usually just pass through 4 digits
        if (y.length === 2 || y.length === 3) {
             // Heuristic: if year < 1911, maybe add 1911? But safer to trust data
        }
        const m = parts[1].padStart(2, '0');
        const d = parts[2].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return dateStr;
};

// --- DATA ACCESSORS & SANITIZERS ---
const isCorrupted = (item: any) => {
    const json = JSON.stringify(item).toLowerCase();
    return json.includes('doctype') || 
           json.includes('html') || 
           json.includes('檔案可能已遭到移動') ||
           json.includes('file might have been moved');
};

const safelyParse = <T>(json: string | null): T[] => {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
            const valid = parsed.filter(p => !isCorrupted(p));
            return valid;
        }
        return [];
    } catch (e) {
        console.error("JSON Parse Error:", e);
        return [];
    }
};

export const getMarketData = async (): Promise<MarketData[]> => safelyParse<MarketData>(localStorage.getItem(KEYS.MARKET)).filter(d => d.indexName && d.date);
export const getBasicInfo = async (): Promise<BasicInfo[]> => safelyParse<BasicInfo>(localStorage.getItem(KEYS.BASIC));
export const getPriceData = async (): Promise<PriceData[]> => safelyParse<PriceData>(localStorage.getItem(KEYS.PRICE));
export const getDividendData = async (): Promise<DividendData[]> => safelyParse<DividendData>(localStorage.getItem(KEYS.DIVIDEND));
export const getSizeData = async (): Promise<SizeData[]> => safelyParse<SizeData>(localStorage.getItem(KEYS.SIZE));
export const getHistoryData = async (): Promise<HistoryData[]> => safelyParse<HistoryData>(localStorage.getItem(KEYS.HISTORY));

export const getFillAnalysisData = async (): Promise<FillAnalysisData[]> => {
    const dividends = await getDividendData();
    const history = await getHistoryData(); 
    const prices = await getPriceData();

    if (dividends.length === 0) return [];

    const priceMap = new Map<string, Map<string, number>>();
    const addToMap = (code: string, date: string, price: number) => {
        if (!priceMap.has(code)) priceMap.set(code, new Map());
        priceMap.get(code)!.set(date, price);
    };

    history.forEach(h => addToMap(h.etfCode, h.date, h.price));
    prices.forEach(p => addToMap(p.etfCode, p.date, p.price));

    const results: FillAnalysisData[] = [];

    for (const div of dividends) {
        let pricePreEx = 0;
        let isFilled = false;
        let daysToFill: number | string = '無資料';
        let priceReference = 0;

        if (priceMap.has(div.etfCode)) {
            const etfPrices = priceMap.get(div.etfCode)!;
            const exDate = div.exDate;
            const sortedDates = Array.from(etfPrices.keys()).sort();
            const exDateIndex = sortedDates.findIndex(d => d >= exDate);
            
            if (exDateIndex > 0) {
                pricePreEx = etfPrices.get(sortedDates[exDateIndex - 1]) || 0;
            } else if (exDateIndex === -1 && sortedDates.length > 0) {
                pricePreEx = etfPrices.get(sortedDates[sortedDates.length - 1]) || 0;
            }

            priceReference = pricePreEx - div.amount;
            
            const datesAfter = sortedDates.filter(d => d >= exDate);
            for (const d of datesAfter) {
                const p = etfPrices.get(d) || 0;
                if (p >= pricePreEx && pricePreEx > 0) {
                    isFilled = true;
                    // Calculate days
                    const start = new Date(exDate).getTime();
                    const end = new Date(d).getTime();
                    daysToFill = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
                    break;
                }
            }
            if (!isFilled) daysToFill = '未填息';
        }

        results.push({
            ...div,
            pricePreEx,
            priceReference,
            isFilled,
            daysToFill
        });
    }

    return results.sort((a,b) => b.exDate.localeCompare(a.exDate));
}

// --- FETCH & IMPORT ---
const fetchGoogleSheet = async (urlStr: string): Promise<any[]> => {
    if (!urlStr) throw new Error("缺少 CSV 連結");

    // Support multiple URLs separated by |
    const urls = urlStr.split('|').map(u => u.trim()).filter(u => u);
    
    try {
        const fetchPromises = urls.map(async (url) => {
            if (!url.startsWith('http')) return [];

            // Robustness: ensure output=csv if it looks like a google sheet link
            let fetchUrl = url;
            if (url.includes('docs.google.com/spreadsheets') && !url.includes('output=csv')) {
                 if (url.includes('?')) fetchUrl += '&output=csv';
                 else fetchUrl += '?output=csv';
            }

            const response = await fetch(fetchUrl);
            if (!response.ok) {
                 if(response.status === 404) console.warn(`連結失效 (404): ${url}`);
                 return [];
            }

            const text = await response.text();

            // Double Check for Error Text
            if (text.includes('檔案可能已遭到移動') || 
                text.includes('File might have been moved') || 
                text.includes('<!DOCTYPE html>')) {
                 console.warn(`連結回傳非 CSV 內容: ${url}`);
                 return [];
            }
            return parseCSV(text);
        });

        const results = await Promise.all(fetchPromises);
        const flattened = results.flat();

        if (flattened.length === 0) {
            throw new Error("匯入失敗：所有連結皆無法讀取或內容為空。");
        }
        return flattened;

    } catch (error: any) {
        console.error("CSV Fetch Error:", error);
        throw new Error(error.message);
    }
};

const getProp = (row: any, ...keys: string[]) => {
    for (const k of keys) {
        if (row[k] !== undefined) return row[k];
        const normK = k.replace(/\s+/g, '');
        if (row[normK] !== undefined) return row[normK];
        // Handle case insensitive match
        const lowerK = k.toLowerCase();
        const found = Object.keys(row).find(key => key.toLowerCase() === lowerK || key.replace(/\s+/g, '').toLowerCase() === lowerK.replace(/\s+/g, ''));
        if (found) return row[found];
    }
    return undefined;
};

export const importMarketData = async (url: string) => {
    const rawData = await fetchGoogleSheet(url);
    const newItems = rawData.map(row => ({
        indexName: getProp(row, '指數名稱', 'IndexName') || '',
        code: getProp(row, '代碼', 'Code') || '',
        date: normalizeDate(getProp(row, '日期 tradetime', '日期', 'Date')),
        prevClose: safeFloat(getProp(row, '昨日收盤 closeyest', '昨日收盤')),
        open: safeFloat(getProp(row, '開盤 priceopen', '開盤')),
        high: safeFloat(getProp(row, '高價 high', '高價')),
        low: safeFloat(getProp(row, '低價 low', '低價')),
        price: safeFloat(getProp(row, '現價 price', '現價', '收盤價', 'Price', 'Close', '收盤')),
        volume: safeFloat(getProp(row, '成交量 volume', '成交量')),
        change: safeFloat(getProp(row, '漲跌點數', '漲跌')),
        changePercent: safeFloat(getProp(row, '漲跌幅度', '漲跌幅 changepercent', '漲跌幅')),
        type: ((getProp(row, '代碼', 'Code') && String(getProp(row, '代碼', 'Code')).length > 4) ? 'US' : 'TW') as 'TW' | 'US' 
    })).filter(item => item.indexName && item.date);

    const existingItems = await getMarketData();
    const dataMap = new Map();
    existingItems.forEach(i => dataMap.set(`${i.indexName}_${i.date}`, i));
    
    // Check for changes
    let addedCount = 0;
    newItems.forEach(i => {
        const key = `${i.indexName}_${i.date}`;
        if (!dataMap.has(key)) {
            dataMap.set(key, i);
            addedCount++;
        } else {
             dataMap.set(key, i); 
        }
    });

    const merged = Array.from(dataMap.values()).sort((a: any,b: any) => b.date.localeCompare(a.date));
    localStorage.setItem(KEYS.MARKET, JSON.stringify(merged));
    
    return { count: merged.length, noChange: addedCount === 0 && existingItems.length === merged.length };
};

export const importBasicInfo = async (url: string) => {
    const rawData = await fetchGoogleSheet(url);
    const newItems = rawData.map(row => ({
        etfCode: getProp(row, 'ETF 代碼', '代碼') || 'UNKNOWN',
        etfName: getProp(row, 'ETF 名稱', '名稱') || '',
        category: getProp(row, '商品分類', '分類') || '',
        dividendFreq: getProp(row, '配息週期', '週期') || '',
        issuer: getProp(row, '發行投信', '投信') || '',
        etfType: getProp(row, 'ETF類型', '類型') || '',
        marketType: getProp(row, '上市/ 上櫃', '上市/上櫃', '市場') || '',
        size: 0,
        trend: ''
    })).filter(d => d.etfCode !== 'UNKNOWN');

    localStorage.setItem(KEYS.BASIC, JSON.stringify(newItems)); 
    return { count: newItems.length, noChange: false };
};

export const importPriceData = async (url: string) => {
    const rawData = await fetchGoogleSheet(url);
    const newItems = rawData.map(row => ({
        etfCode: getProp(row, 'ETF 代碼', '代碼') || '',
        etfName: getProp(row, 'ETF 名稱', '名稱') || '',
        date: normalizeDate(getProp(row, '日期')),
        prevClose: safeFloat(getProp(row, '昨日收盤價', '昨日收盤')),
        open: safeFloat(getProp(row, '開盤')),
        high: safeFloat(getProp(row, '最高')),
        low: safeFloat(getProp(row, '最低')),
        price: safeFloat(getProp(row, '股價'))
    })).filter(item => item.etfCode && item.date);
    
    const existingItems = await getPriceData();
    const dataMap = new Map();
    existingItems.forEach(i => dataMap.set(`${i.etfCode}_${i.date}`, i));
    
    let addedCount = 0;
    newItems.forEach(i => {
        const key = `${i.etfCode}_${i.date}`;
        if (!dataMap.has(key)) {
            dataMap.set(key, i);
            addedCount++;
        }
    });

    const merged = Array.from(dataMap.values()).sort((a: any,b: any) => b.date.localeCompare(a.date));
    localStorage.setItem(KEYS.PRICE, JSON.stringify(merged));
    return { count: merged.length, noChange: addedCount === 0 && existingItems.length === merged.length };
};

export const importDividendData = async (url: string) => {
    const rawData = await fetchGoogleSheet(url);
    const newItems = rawData.map(row => ({
        etfCode: getProp(row, 'ETF 代碼', '代碼', 'ETF代碼') || '',
        etfName: getProp(row, 'ETF 名稱', '名稱', 'ETF名稱') || '',
        yearMonth: getProp(row, '年月') || '',
        exDate: normalizeDate(getProp(row, '除息日期', '除息日')),
        amount: safeFloat(getProp(row, '除息金額', '金額')),
        paymentDate: normalizeDate(getProp(row, '股利發放', '發放日')),
        yield: 0
    })).filter(item => item.etfCode && item.exDate); 
    
    const existingItems = await getDividendData();
    const dataMap = new Map();
    
    existingItems.forEach(i => dataMap.set(`${i.etfCode}_${i.exDate}_${i.amount}`, i));
    
    let addedCount = 0;
    newItems.forEach(i => {
        const key = `${i.etfCode}_${i.exDate}_${i.amount}`;
        if (!dataMap.has(key)) {
            dataMap.set(key, i);
            addedCount++;
        }
    });
    
    const merged = Array.from(dataMap.values()).sort((a: any,b: any) => b.exDate.localeCompare(a.exDate));
    localStorage.setItem(KEYS.DIVIDEND, JSON.stringify(merged));
    return { count: merged.length, noChange: addedCount === 0 && existingItems.length === merged.length };
};

export const importSizeData = async (url: string) => {
    const rawData = await fetchGoogleSheet(url);
    const newItems = rawData.map(row => ({
        etfCode: getProp(row, 'ETF 代碼', '代碼') || '',
        etfName: getProp(row, 'ETF 名稱', '名稱') || '',
        size: safeFloat(getProp(row, '規模', '規模(億)')),
        date: new Date().toISOString().split('T')[0] 
    })).filter(d => d.etfCode);

    localStorage.setItem(KEYS.SIZE, JSON.stringify(newItems));
    return { count: newItems.length, noChange: false };
};

export const importHistoryData = async (url: string) => {
    const rawData = await fetchGoogleSheet(url);
    const newItems = rawData.map(row => ({
        etfCode: getProp(row, 'ETF 代碼', '代碼') || '',
        etfName: getProp(row, 'ETF 名稱', '名稱') || '',
        date: normalizeDate(getProp(row, '日期', 'Date')),
        price: safeFloat(getProp(row, '收盤價', 'Price', 'Close', '收盤', '股價', 'close', 'price', '價格'))
    })).filter(d => d.etfCode && d.date);

    const existingItems = await getHistoryData();
    const dataMap = new Map();
    existingItems.forEach(i => dataMap.set(`${i.etfCode}_${i.date}`, i));
    
    let addedCount = 0;
    newItems.forEach(i => {
        const key = `${i.etfCode}_${i.date}`;
        if (!dataMap.has(key)) {
            dataMap.set(key, i);
            addedCount++;
        }
    });

    const merged = Array.from(dataMap.values()).sort((a: any,b: any) => b.date.localeCompare(a.date));
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(merged));
    return { count: merged.length, noChange: addedCount === 0 && existingItems.length === merged.length };
};

export const clearAllData = () => {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
};

export const exportToCSV = (filename: string, headers: string[], data: any[]) => {
    const BOM = "\uFEFF"; 
    const csvContent = BOM + [
        headers.join(','),
        ...data.map(row => headers.map(fieldName => {
            const val = row[fieldName] || '';
            return `"${String(val).replace(/"/g, '""')}"`;
        }).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const injectDemoData = () => {
    console.log("Demo data injection removed.");
}

// --- AUTO INITIALIZATION ---
export const checkAndFetchSystemData = async () => {
    // Check if critical data is missing (e.g. market data or basic info)
    const market = localStorage.getItem(KEYS.MARKET);
    const basic = localStorage.getItem(KEYS.BASIC);

    // Always fetch if missing, or maybe force update on start?
    // Strategy: Fetch in background on start.
    console.log("System Auto-Update: Starting...");
    
    try {
        await Promise.all([
            importMarketData(DEFAULT_SYSTEM_URLS.market),
            importBasicInfo(DEFAULT_SYSTEM_URLS.basic),
            importPriceData(DEFAULT_SYSTEM_URLS.price),
            importDividendData(DEFAULT_SYSTEM_URLS.dividend),
            importSizeData(DEFAULT_SYSTEM_URLS.size),
            importHistoryData(DEFAULT_SYSTEM_URLS.history)
        ]);
        console.log("System Auto-Update: Completed successfully.");
        return true;
    } catch (e) {
        console.error("System Auto-Update Failed:", e);
        return false;
    }
};