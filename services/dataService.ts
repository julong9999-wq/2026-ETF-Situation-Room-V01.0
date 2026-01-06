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

// --- HELPER: ROBUST CSV PARSER (State Machine) ---
const parseCSV = (text: string): any[] => {
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

    // Normalize headers: trim and create a lookup map
    const originalHeaders = rows[0].map(h => h.trim());
    
    // Create a helper to find value by loosely matching header
    const result = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // Skip empty rows
        if (row.length <= 1 && !row[0]) continue;
        
        // Return a "Smart Row" object with normalized keys
        const obj: any = {};
        originalHeaders.forEach((h, idx) => {
            obj[h] = row[idx];
            // Also add normalized key (remove spaces)
            const normH = h.replace(/\s+/g, ''); 
            if (normH !== h) obj[normH] = row[idx];
        });
        result.push(obj);
    }
    return result;
};

const safeFloat = (val: string | undefined): number => {
    if (!val) return 0;
    return parseFloat(val.toString().replace(/,/g, '')) || 0;
};

// Helper: Normalize date to YYYY-MM-DD for consistent sorting/filtering
const normalizeDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    // If it's already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    // Handle YYYY/M/D or YYYY-M-D
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
        const y = parts[0];
        const m = parts[1].padStart(2, '0');
        const d = parts[2].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return dateStr;
};

// --- DATA ACCESSORS ---
export const getMarketData = async (): Promise<MarketData[]> => {
    const json = localStorage.getItem(KEYS.MARKET);
    return json ? JSON.parse(json) : [];
};
export const getBasicInfo = async (): Promise<BasicInfo[]> => {
    const json = localStorage.getItem(KEYS.BASIC);
    return json ? JSON.parse(json) : [];
};
export const getPriceData = async (): Promise<PriceData[]> => {
    const json = localStorage.getItem(KEYS.PRICE);
    return json ? JSON.parse(json) : [];
};
export const getDividendData = async (): Promise<DividendData[]> => {
    const json = localStorage.getItem(KEYS.DIVIDEND);
    return json ? JSON.parse(json) : [];
};
export const getSizeData = async (): Promise<SizeData[]> => {
    const json = localStorage.getItem(KEYS.SIZE);
    return json ? JSON.parse(json) : [];
};
export const getHistoryData = async (): Promise<HistoryData[]> => {
    const json = localStorage.getItem(KEYS.HISTORY);
    return json ? JSON.parse(json) : [];
};

/**
 * Calculates Fill Analysis Data by combining Dividend Data and History (Price) Data.
 */
export const getFillAnalysisData = async (): Promise<FillAnalysisData[]> => {
    const dividends = await getDividendData();
    const history = await getHistoryData(); 
    const prices = await getPriceData();

    // Map history for fast lookup: Code -> Date -> Price
    const priceMap = new Map<string, Map<string, number>>();
    
    const addToMap = (code: string, date: string, price: number) => {
        if (!priceMap.has(code)) priceMap.set(code, new Map());
        priceMap.get(code)!.set(date, price);
    };

    history.forEach(h => addToMap(h.etfCode, h.date, h.price));
    prices.forEach(p => addToMap(p.etfCode, p.date, p.price));

    const results: FillAnalysisData[] = [];

    for (const div of dividends) {
        if (!priceMap.has(div.etfCode)) {
            results.push({
                ...div,
                pricePreEx: 0,
                priceReference: 0,
                isFilled: false,
                daysToFill: '無股價資料'
            });
            continue;
        }

        const etfPrices = priceMap.get(div.etfCode)!;
        const exDate = div.exDate; // Assumed normalized YYYY-MM-DD

        const sortedDates = Array.from(etfPrices.keys()).sort();
        const exDateIndex = sortedDates.findIndex(d => d >= exDate);
        
        let pricePreEx = 0;
        if (exDateIndex > 0) {
            const prevDate = sortedDates[exDateIndex - 1];
            pricePreEx = etfPrices.get(prevDate) || 0;
        } else if (exDateIndex === -1 && sortedDates.length > 0) {
             pricePreEx = etfPrices.get(sortedDates[sortedDates.length - 1]) || 0;
        }

        const priceReference = pricePreEx - div.amount;
        
        let isFilled = false;
        let filledDate = '';
        let daysToFill: number | string = '未填息';

        const datesAfter = sortedDates.filter(d => d >= exDate);
        
        for (const d of datesAfter) {
            const p = etfPrices.get(d) || 0;
            if (p >= pricePreEx && pricePreEx > 0) {
                isFilled = true;
                filledDate = d;
                break;
            }
        }

        if (isFilled && filledDate) {
            const start = new Date(exDate).getTime();
            const end = new Date(filledDate).getTime();
            const diffTime = Math.abs(end - start);
            daysToFill = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        } else {
             if (new Date(exDate).getTime() > new Date().getTime()) {
                 daysToFill = '待除息';
             }
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

// --- DATA IMPORTERS ---
const getProp = (row: any, ...keys: string[]) => {
    for (const k of keys) {
        if (row[k] !== undefined) return row[k];
        const normK = k.replace(/\s+/g, '');
        if (row[normK] !== undefined) return row[normK];
        
        const lowerK = k.toLowerCase();
        for(const rowKey of Object.keys(row)) {
            if(rowKey.toLowerCase() === lowerK) return row[rowKey];
        }
    }
    return undefined;
};

type ImportResult = { count: number; noChange: boolean };

const fetchGoogleSheet = async (url: string): Promise<any[]> => {
    if (!url) throw new Error("缺少 CSV 連結");
    if (!url.startsWith('http')) throw new Error("網址格式錯誤");

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`連線失敗 (HTTP ${response.status})`);
        const text = await response.text();
        if (text.trim().startsWith('<!DOCTYPE html>') || text.trim().startsWith('<html')) {
             throw new Error("連結回傳了網頁而非 CSV，請確認使用「發布到網路」的 CSV 連結");
        }
        return parseCSV(text);
    } catch (error: any) {
        console.error("CSV Fetch Error:", error);
        throw new Error(`${error.message}`);
    }
};

const sortByDateDesc = (a: any, b: any) => {
    return b.date.localeCompare(a.date);
};

const isDataIdentical = (oldData: any[], newData: any[]) => {
    return JSON.stringify(oldData) === JSON.stringify(newData);
};

export const importMarketData = async (url: string): Promise<ImportResult> => {
    const rawData = await fetchGoogleSheet(url);
    const newItems: MarketData[] = rawData.map(row => ({
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
        type: ((getProp(row, '代碼', 'Code') && getProp(row, '代碼', 'Code').length > 4) ? 'US' : 'TW') as 'TW' | 'US' 
    })).filter(item => item.indexName && item.date);

    const existingItems = await getMarketData();
    const dataMap = new Map<string, MarketData>();
    
    existingItems.forEach(item => dataMap.set(`${item.indexName}_${item.date}`, item));
    newItems.forEach(item => dataMap.set(`${item.indexName}_${item.date}`, item));

    const mergedData = Array.from(dataMap.values()).sort(sortByDateDesc);

    if (isDataIdentical(existingItems, mergedData)) {
        return { count: existingItems.length, noChange: true };
    }

    localStorage.setItem(KEYS.MARKET, JSON.stringify(mergedData));
    return { count: mergedData.length, noChange: false };
};

export const importPriceData = async (url: string): Promise<ImportResult> => {
    const rawData = await fetchGoogleSheet(url);
    const newItems: PriceData[] = rawData.map(row => ({
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
    const dataMap = new Map<string, PriceData>();

    existingItems.forEach(item => dataMap.set(`${item.etfCode}_${item.date}`, item));
    newItems.forEach(item => dataMap.set(`${item.etfCode}_${item.date}`, item));

    const mergedData = Array.from(dataMap.values()).sort(sortByDateDesc);
    
    if (isDataIdentical(existingItems, mergedData)) {
        return { count: existingItems.length, noChange: true };
    }

    localStorage.setItem(KEYS.PRICE, JSON.stringify(mergedData));
    return { count: mergedData.length, noChange: false };
};

export const importBasicInfo = async (url: string): Promise<ImportResult> => {
    const rawData = await fetchGoogleSheet(url);
    const newItems: BasicInfo[] = rawData.map(row => ({
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

    const existingItems = await getBasicInfo();
    const dataMap = new Map<string, BasicInfo>();

    existingItems.forEach(item => dataMap.set(item.etfCode, item));
    newItems.forEach(item => dataMap.set(item.etfCode, item));

    const mergedData = Array.from(dataMap.values());
    
    if (isDataIdentical(existingItems, mergedData)) {
        return { count: existingItems.length, noChange: true };
    }

    localStorage.setItem(KEYS.BASIC, JSON.stringify(mergedData));
    return { count: mergedData.length, noChange: false };
};

export const importDividendData = async (url: string): Promise<ImportResult> => {
    const rawData = await fetchGoogleSheet(url);
    const newItems: DividendData[] = rawData.map(row => ({
        etfCode: getProp(row, 'ETF 代碼', '代碼', 'ETF代碼') || '',
        etfName: getProp(row, 'ETF 名稱', '名稱', 'ETF名稱') || '',
        yearMonth: getProp(row, '年月') || '',
        exDate: normalizeDate(getProp(row, '除息日期', '除息日')),
        amount: safeFloat(getProp(row, '除息金額', '金額')),
        paymentDate: normalizeDate(getProp(row, '股利發放', '發放日')),
        yield: 0
    })).filter(item => item.etfCode && item.exDate);

    const existingItems = await getDividendData();
    const dataMap = new Map<string, DividendData>();

    const existingFreq: Record<string, number> = {};
    existingItems.forEach(item => {
        const baseKey = `${item.etfCode}_${item.exDate}_${item.amount}_${item.paymentDate || ''}`;
        existingFreq[baseKey] = (existingFreq[baseKey] || 0) + 1;
        dataMap.set(`${baseKey}_${existingFreq[baseKey]}`, item);
    });

    const newFreq: Record<string, number> = {};
    newItems.forEach(item => {
        const baseKey = `${item.etfCode}_${item.exDate}_${item.amount}_${item.paymentDate || ''}`;
        newFreq[baseKey] = (newFreq[baseKey] || 0) + 1;
        dataMap.set(`${baseKey}_${newFreq[baseKey]}`, item);
    });

    const mergedData = Array.from(dataMap.values())
        .sort((a, b) => b.exDate.localeCompare(a.exDate));
    
    if (isDataIdentical(existingItems, mergedData)) {
        return { count: existingItems.length, noChange: true };
    }

    localStorage.setItem(KEYS.DIVIDEND, JSON.stringify(mergedData));
    return { count: mergedData.length, noChange: false };
}

export const importSizeData = async (url: string): Promise<ImportResult> => {
    const rawData = await fetchGoogleSheet(url);
    const newItems: SizeData[] = rawData.map(row => ({
        etfCode: getProp(row, 'ETF 代碼', '代碼') || '',
        etfName: getProp(row, 'ETF 名稱', '名稱') || '',
        size: safeFloat(getProp(row, '規模', '規模(億)')),
        date: new Date().toISOString().split('T')[0] 
    })).filter(d => d.etfCode);

    const existingItems = await getSizeData();
    const dataMap = new Map<string, SizeData>();

    existingItems.forEach(item => dataMap.set(`${item.etfCode}_${item.date}`, item));
    newItems.forEach(item => dataMap.set(`${item.etfCode}_${item.date}`, item));

    const mergedData = Array.from(dataMap.values()).sort(sortByDateDesc);

    if (isDataIdentical(existingItems, mergedData)) {
        return { count: existingItems.length, noChange: true };
    }

    localStorage.setItem(KEYS.SIZE, JSON.stringify(mergedData));
    return { count: mergedData.length, noChange: false };
}

export const importHistoryData = async (url: string): Promise<ImportResult> => {
    const rawData = await fetchGoogleSheet(url);
    const sampleRow = rawData[0] || {};
    let newItems: HistoryData[] = [];

    const dateKey = Object.keys(sampleRow).find(k => 
        ['日期', 'Date', 'date', '資料日期', '年月日'].includes(k)
    );

    if (dateKey) {
        newItems = rawData.map(row => ({
            etfCode: getProp(row, 'ETF 代碼', '代碼', 'ETF代碼', 'Code') || '',
            etfName: getProp(row, 'ETF 名稱', '名稱', 'ETF名稱', 'Name') || '',
            date: normalizeDate(row[dateKey]),
            price: safeFloat(getProp(row, '收盤價', '股價', 'Price', 'Close', 'close', 'price', '收盤')),
            open: safeFloat(getProp(row, '開盤', 'Open', 'open', '開盤價')),
            high: safeFloat(getProp(row, '最高', 'High', 'high', '最高價')),
            low: safeFloat(getProp(row, '最低', 'Low', 'low', '最低價')),
            volume: safeFloat(getProp(row, '成交量', '量', 'Volume', 'volume', 'Vol'))
        })).filter(d => d.etfCode && d.date);
    } else {
        const keys = Object.keys(sampleRow);
        const dateCols = keys.filter(k => {
            if (!isNaN(Number(k))) return false; 
            const isDateLike = /\d{1,4}[-/]\d{1,2}/.test(k) || !isNaN(Date.parse(k));
            const isExcluded = ['代碼', '名稱', 'code', 'name', '分類', '規模'].some(ex => k.toLowerCase().includes(ex));
            return isDateLike && !isExcluded;
        });

        rawData.forEach(row => {
            const code = getProp(row, 'ETF 代碼', '代碼', 'ETF代碼', 'Code', 'Security Code');
            const name = getProp(row, 'ETF 名稱', '名稱', 'ETF名稱', 'Name', 'Security Name');
            
            if (!code) return;

            dateCols.forEach(dateStr => {
                const priceVal = row[dateStr];
                if (priceVal !== undefined && priceVal !== '' && priceVal !== null) {
                    newItems.push({
                        etfCode: code,
                        etfName: name || '',
                        date: normalizeDate(dateStr), 
                        price: safeFloat(priceVal)
                    });
                }
            });
        });
    }

    const existingItems = await getHistoryData();
    const dataMap = new Map<string, HistoryData>();

    existingItems.forEach(item => dataMap.set(`${item.etfCode}_${item.date}`, item));
    newItems.forEach(item => dataMap.set(`${item.etfCode}_${item.date}`, item));

    const mergedData = Array.from(dataMap.values()).sort(sortByDateDesc);

    if (isDataIdentical(existingItems, mergedData)) {
        return { count: existingItems.length, noChange: true };
    }

    localStorage.setItem(KEYS.HISTORY, JSON.stringify(mergedData));
    return { count: mergedData.length, noChange: false };
}

export const clearAllData = () => {
    localStorage.removeItem(KEYS.MARKET);
    localStorage.removeItem(KEYS.BASIC);
    localStorage.removeItem(KEYS.PRICE);
    localStorage.removeItem(KEYS.DIVIDEND);
    localStorage.removeItem(KEYS.SIZE);
    localStorage.removeItem(KEYS.HISTORY);
}

// --- UTILS ---
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