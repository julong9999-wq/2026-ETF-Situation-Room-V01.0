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
        const y = parts[0];
        const m = parts[1].padStart(2, '0');
        const d = parts[2].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return dateStr;
};

// --- DATA ACCESSORS & SANITIZERS ---
// Helper to detect if a record looks like a parsed HTML error page
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
            // Filter out corrupted rows immediately
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
const fetchGoogleSheet = async (url: string): Promise<any[]> => {
    if (!url) throw new Error("缺少 CSV 連結");
    if (!url.startsWith('http')) throw new Error("網址格式錯誤");

    try {
        const response = await fetch(url);
        if (!response.ok) {
             if(response.status === 404) throw new Error("連結失效 (404): 檔案找不到");
             throw new Error(`連線失敗 (HTTP ${response.status})`);
        }

        const text = await response.text();

        // 2. Double Check for Error Text in Body
        if (text.includes('檔案可能已遭到移動') || 
            text.includes('File might have been moved') || 
            text.includes('<!DOCTYPE html>')) {
             throw new Error("連結失效：Google 檔案可能已移除或權限不足。");
        }

        const parsed = parseCSV(text);
        if (parsed.length === 0) {
            throw new Error("匯入失敗：CSV 內容為空或無法解析。");
        }
        return parsed;
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
    }
    return undefined;
};

// Generic Import Handler
const genericImport = async <T>(url: string, key: string, mapper: (row: any) => T, validator: (item: T) => boolean) => {
    const rawData = await fetchGoogleSheet(url);
    const newItems = rawData.map(mapper).filter(validator);
    return newItems;
};

export const importMarketData = async (url: string) => {
    const rawData = await fetchGoogleSheet(url);
    const newItems = rawData.map(row => ({
        indexName: getProp(row, '指數名稱', 'IndexName') || '',
        code: getProp(row, '代碼', 'Code') || '',
        date: normalizeDate(getProp(row, '日期 tradetime', '日期')),
        prevClose: safeFloat(getProp(row, '昨日收盤 closeyest', '昨日收盤')),
        open: safeFloat(getProp(row, '開盤 priceopen', '開盤')),
        high: safeFloat(getProp(row, '高價 high', '高價')),
        low: safeFloat(getProp(row, '低價 low', '低價')),
        price: safeFloat(getProp(row, '現價 price', '現價')),
        volume: safeFloat(getProp(row, '成交量 volume', '成交量')),
        change: safeFloat(getProp(row, '漲跌點數', '漲跌')),
        changePercent: safeFloat(getProp(row, '漲跌幅度', '漲跌幅 changepercent', '漲跌幅')),
        type: ((getProp(row, '代碼', 'Code') && String(getProp(row, '代碼', 'Code')).length > 4) ? 'US' : 'TW') as 'TW' | 'US' 
    })).filter(item => item.indexName && item.date);

    const existingItems = await getMarketData();
    const dataMap = new Map();
    existingItems.concat(newItems).forEach(i => dataMap.set(`${i.indexName}_${i.date}`, i));
    const merged = Array.from(dataMap.values()).sort((a: any,b: any) => b.date.localeCompare(a.date));
    localStorage.setItem(KEYS.MARKET, JSON.stringify(merged));
    return { count: merged.length, noChange: false };
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
    existingItems.concat(newItems).forEach(i => dataMap.set(`${i.etfCode}_${i.date}`, i));
    const merged = Array.from(dataMap.values()).sort((a: any,b: any) => b.date.localeCompare(a.date));
    localStorage.setItem(KEYS.PRICE, JSON.stringify(merged));
    return { count: merged.length, noChange: false };
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
    const merged = [...existingItems, ...newItems]; 
    const unique = Array.from(new Map(merged.map(item => [`${item.etfCode}_${item.exDate}`, item])).values());
    unique.sort((a,b) => b.exDate.localeCompare(a.exDate));
    
    localStorage.setItem(KEYS.DIVIDEND, JSON.stringify(unique));
    return { count: unique.length, noChange: false };
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
        price: safeFloat(getProp(row, '收盤價', 'Price', 'Close'))
    })).filter(d => d.etfCode && d.date);

    const existingItems = await getHistoryData();
    const dataMap = new Map();
    existingItems.concat(newItems).forEach(i => dataMap.set(`${i.etfCode}_${i.date}`, i));
    const merged = Array.from(dataMap.values()).sort((a: any,b: any) => b.date.localeCompare(a.date));
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(merged));
    return { count: merged.length, noChange: false };
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

// --- DEMO DATA GENERATOR ---
export const injectDemoData = () => {
    const market: MarketData[] = [
        { indexName: '台灣加權', code: 'TWSE', date: '2025-05-20', price: 21500, change: 150, changePercent: 0.7, prevClose: 21350, open: 21400, high: 21600, low: 21380, volume: 450000000000, type: 'TW' },
        { indexName: '道瓊工業', code: 'DJI', date: '2025-05-19', price: 40100, change: -50, changePercent: -0.12, prevClose: 40150, open: 40150, high: 40200, low: 40000, volume: 300000000, type: 'US' },
        { indexName: '那斯達克', code: 'IXIC', date: '2025-05-19', price: 17800, change: 120, changePercent: 0.68, prevClose: 17680, open: 17700, high: 17850, low: 17650, volume: 500000000, type: 'US' }
    ];
    localStorage.setItem(KEYS.MARKET, JSON.stringify(market));

    const basic: BasicInfo[] = [
        { etfCode: '0050', etfName: '元大台灣50', category: '股票', dividendFreq: '半年配', issuer: '元大', etfType: '市值型', marketType: '上市', size: 3000, trend: '成長' },
        { etfCode: '0056', etfName: '元大高股息', category: '股票', dividendFreq: '季配', issuer: '元大', etfType: '高息型', marketType: '上市', size: 2500, trend: '持平' },
        { etfCode: '00878', etfName: '國泰永續高股息', category: '股票', dividendFreq: '季配', issuer: '國泰', etfType: 'ESG型', marketType: '上市', size: 2800, trend: '成長' },
        { etfCode: '00679B', etfName: '元大美債20年', category: '債券', dividendFreq: '季配', issuer: '元大', etfType: '債券型', marketType: '上櫃', size: 1500, trend: '衰退' }
    ];
    localStorage.setItem(KEYS.BASIC, JSON.stringify(basic));

    const prices: PriceData[] = [];
    const codes = ['0050', '0056', '00878', '00679B'];
    const basePrice: Record<string, number> = { '0050': 160, '0056': 40, '00878': 23, '00679B': 30 };
    
    for(let i=0; i<10; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        codes.forEach(c => {
            const p = basePrice[c] + (Math.random() * 2 - 1);
            prices.push({
                etfCode: c, etfName: basic.find(b=>b.etfCode===c)?.etfName || '', 
                date: dateStr, price: p, prevClose: p-0.5, open: p-0.2, high: p+0.5, low: p-0.5
            });
        });
    }
    localStorage.setItem(KEYS.PRICE, JSON.stringify(prices));

    const divs: DividendData[] = [
        { etfCode: '0056', etfName: '元大高股息', yearMonth: '202504', exDate: '2025-04-18', amount: 0.79, paymentDate: '2025-05-15', yield: 0 },
        { etfCode: '00878', etfName: '國泰永續高股息', yearMonth: '202502', exDate: '2025-02-27', amount: 0.40, paymentDate: '2025-03-25', yield: 0 }
    ];
    localStorage.setItem(KEYS.DIVIDEND, JSON.stringify(divs));

    const sizes: SizeData[] = codes.map(c => ({
        etfCode: c, etfName: '', size: basePrice[c] * 10, date: '2025-05-20'
    }));
    localStorage.setItem(KEYS.SIZE, JSON.stringify(sizes));

    return { count: 5, noChange: false };
}