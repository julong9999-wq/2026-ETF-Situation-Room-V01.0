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
    market: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ825Haq0XnIX_UDCtnyd5t94U943OJ_sCJdLj2-6XfbWT4KkLaQ-RWBL_esd4HHaQGJTW3hOV2qtax/pub?gid=779511679&single=true&output=csv|https://docs.google.com/spreadsheets/d/e/2PACX-1vRuulQ6E-VFeNU6otpWOOIZQOwcG8ybE0EdR_RooQLW1VYi6Xhtcl4KnADees6YIALU29jmBlODPeQQ/pub?gid=779511679&single=true&output=csv',
    price: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQaRKeSBt4XfeC9uNf56p38DwscoPK0-eFM3J4-Vz8LeVBdgsClDZy0baU-FHyFv5cz-QNCXUVMwBfr/pub?gid=462296829&single=true&output=csv',
    basic: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTc6ZANKmAJQCXC9k7np_eIhAwC2hF_w9KSpseD0qogcPP0I2rPPhtesNEbHvG48b_tLh9qeu4tr21Q/pub?output=csv',
    dividend: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR5JvOGT3eB4xq9phw2dXHApJKOgQkUZcs69CsJfL0Iw3s6egADwA8HdbimrWUceQZl_73pnsSLVnQw/pub?output=csv',
    size: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTV4TXRt6GUxvN7ZPQYMfSMzaBskjCLKUQbHOJcOcyCBMwyrDYCbHK4MghK8N-Cfp_we_LkvV-bz9zg/pub?output=csv',
    history: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQJKO3upGfGOWStHGuktI2c0ULLQrysCe-B2qbSl3HwgZA1x8ZFekV7Vl_XeSoInKGiyoJD88iAB3q3/pub?output=csv'
};

// --- HELPER: ROBUST CSV PARSER ---
const parseCSV = (text: string): any[] => {
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
            // Also store normalized key for easier access later
            const normH = h.replace(/\s+/g, ''); 
            if (normH !== h) obj[normH] = row[idx];
        });
        result.push(obj);
    }
    return result;
};

const safeFloat = (val: any): number => {
    if (!val) return 0;
    const str = String(val).replace(/,/g, '').trim();
    if (str === '-' || str === '') return 0;
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
        if (y.length === 3 && parseInt(y) < 1900) {
            y = String(parseInt(y) + 1911);
        }
        const m = parts[1].padStart(2, '0');
        const d = parts[2].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return dateStr;
};

// --- ROBUST PROPERTY GETTER (V3.2 COMPLIANT) ---
// keys: candidates to look for
// exclude: if the found key contains any of these, ignore it (case-insensitive)
const getVal = (row: any, keys: string[], exclude: string[] = []): string | undefined => {
    const isExcluded = (k: string) => {
        if (exclude.length === 0) return false;
        const lowerK = k.toLowerCase();
        return exclude.some(ex => lowerK.includes(ex.toLowerCase()));
    };

    // 1. Try Direct Match on Keys
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && row[k] !== '') {
            if (!isExcluded(k)) return row[k];
        }
    }

    // 2. Try Normalized Match (ignore spaces/case)
    const rowKeys = Object.keys(row);
    for (const k of keys) {
        const normTarget = k.replace(/\s+/g, '').toLowerCase();
        const foundKey = rowKeys.find(rk => {
            return rk.replace(/\s+/g, '').toLowerCase() === normTarget;
        });
        
        if (foundKey && row[foundKey] !== undefined && !isExcluded(foundKey)) {
            return row[foundKey];
        }
    }

    return undefined;
};

// --- DATA ACCESSORS ---
const isCorrupted = (item: any) => {
    const json = JSON.stringify(item).toLowerCase();
    return json.includes('doctype') || json.includes('html');
};

const safelyParse = <T>(json: string | null): T[] => {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) return parsed.filter(p => !isCorrupted(p));
        return [];
    } catch (e) {
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
    const today = new Date().toISOString().split('T')[0];

    for (const div of dividends) {
        let pricePreEx: number | string = 0;
        let priceReference: number | string = 0;
        let isFilled = false;
        let daysToFill: number | string = '無資料';
        let preExDate = '';
        let fillDate = '';
        let fillPrice: number | string = '';
        
        const isFuture = div.exDate > today;
        const exYear = parseInt(div.exDate.split('-')[0]);

        if (priceMap.has(div.etfCode)) {
            const etfPrices = priceMap.get(div.etfCode)!;
            const exDate = div.exDate;
            const sortedDates = Array.from(etfPrices.keys()).sort();
            const exDateIndex = sortedDates.findIndex(d => d >= exDate);
            let preExIndex = -1;

            if (exDateIndex > 0) preExIndex = exDateIndex - 1;

            if (preExIndex >= 0) {
                preExDate = sortedDates[preExIndex];
                pricePreEx = etfPrices.get(preExDate) || 0;
                if (typeof pricePreEx === 'number' && pricePreEx > 0) {
                    priceReference = pricePreEx - div.amount;
                }
            }
            
            if (isFuture) {
                 pricePreEx = "待除息資訊"; priceReference = "待除息資訊"; fillDate = ""; fillPrice = "待除息資訊"; daysToFill = "待除息資訊"; isFilled = false; if(!preExDate) preExDate = "待除息資訊"; 
            } 
            else if (exYear < 2026 && !pricePreEx) { 
                 pricePreEx = "無資料"; priceReference = "無資料"; fillDate = ""; fillPrice = "無資料"; daysToFill = "無資料"; isFilled = false; if(!preExDate) preExDate = "無資料";
            } 
            else {
                if (pricePreEx === 0 || typeof pricePreEx !== 'number') {
                    daysToFill = '無資料'; isFilled = false; if(!preExDate) preExDate = "無資料";
                } else {
                    const datesAfter = sortedDates.filter(d => d >= exDate);
                    for (const d of datesAfter) {
                        const p = etfPrices.get(d) || 0;
                        if (p >= (pricePreEx as number)) {
                            isFilled = true; fillDate = d; fillPrice = p;
                            const start = new Date(exDate).getTime();
                            const end = new Date(d).getTime();
                            daysToFill = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
                            break;
                        }
                    }
                    if (!isFilled) daysToFill = '未填息';
                }
            }
        } else {
             if (isFuture) {
                 pricePreEx = "待除息資訊"; priceReference = "待除息資訊"; fillPrice = "待除息資訊"; daysToFill = "待除息資訊"; preExDate = "待除息資訊";
             } else {
                 daysToFill = "無資料";
             }
        }
        results.push({ ...div, preExDate, pricePreEx, priceReference, fillDate, fillPrice, isFilled, daysToFill });
    }
    return results.sort((a,b) => b.exDate.localeCompare(a.exDate));
};

// --- FETCH & IMPORT ---
const fetchGoogleSheet = async (urlStr: string): Promise<any[]> => {
    if (!urlStr) throw new Error("缺少 CSV 連結");
    const urls = urlStr.split('|').map(u => u.trim()).filter(u => u);
    try {
        const fetchPromises = urls.map(async (url) => {
            if (!url.startsWith('http')) return [];
            let fetchUrl = url;
            if (url.includes('docs.google.com/spreadsheets') && !url.includes('output=csv')) {
                 if (url.includes('?')) fetchUrl += '&output=csv'; else fetchUrl += '?output=csv';
            }
            const response = await fetch(fetchUrl);
            if (!response.ok) return [];
            const text = await response.text();
            return parseCSV(text);
        });
        const results = await Promise.all(fetchPromises);
        const flattened = results.flat();
        if (flattened.length === 0) throw new Error("匯入失敗：內容為空。");
        return flattened;
    } catch (error: any) {
        console.error("CSV Fetch Error:", error);
        throw new Error(error.message);
    }
};

export const importMarketData = async (url: string) => {
    const rawData = await fetchGoogleSheet(url);
    const exPrice = ['昨日', '前日', '開盤', '漲跌', 'Closeyest', 'Open', 'Change', 'Prev'];
    
    const newItems = rawData.map(row => ({
        indexName: getVal(row, ['指數名稱', 'IndexName', '名稱']) || '',
        code: getVal(row, ['代碼', 'Code']) || '',
        date: normalizeDate(getVal(row, ['日期 tradetime', '日期', 'Date', 'tradetime'])),
        prevClose: safeFloat(getVal(row, ['昨日收盤 closeyest', '昨日收盤', 'closeyest', '昨日'])),
        open: safeFloat(getVal(row, ['開盤 priceopen', '開盤', 'open'], ['漲跌'])),
        high: safeFloat(getVal(row, ['高價 high', '高價', 'high'])),
        low: safeFloat(getVal(row, ['低價 low', '低價', 'low'])),
        price: safeFloat(getVal(row, ['現價 price', '現價', '收盤價', 'Price', 'Close', '收盤'], exPrice)),
        volume: safeFloat(getVal(row, ['成交量 volume', '成交量', 'volume'])),
        change: safeFloat(getVal(row, ['漲跌點數', '漲跌', 'change'], ['幅度', 'Percent'])),
        changePercent: safeFloat(getVal(row, ['漲跌幅度', '漲跌幅 changepercent', '漲跌幅', '幅度(%)', 'percent', 'changepercent'])),
        type: ((getVal(row, ['代碼', 'Code']) && String(getVal(row, ['代碼', 'Code'])).length > 4) ? 'US' : 'TW') as 'TW' | 'US' 
    })).filter(item => item.indexName && item.date);

    const merged = mergeAndSave(KEYS.MARKET, await getMarketData(), newItems, 'indexName', 'date');
    return { count: merged.length, noChange: false };
};

export const importBasicInfo = async (url: string) => {
    const rawData = await fetchGoogleSheet(url);
    const newItems = rawData.map(row => {
        return {
            etfCode: String(getVal(row, ['ETF 代碼', '代碼', 'ETF代碼', 'Code']) || 'UNKNOWN').trim(),
            etfName: getVal(row, ['ETF 名稱', '名稱', 'ETF名稱', 'Name']) || '',
            category: getVal(row, ['商品分類', '分類', 'Category']) || '',
            dividendFreq: getVal(row, ['配息週期', '週期', 'Freq']) || '',
            issuer: getVal(row, ['發行投信', '投信', 'Issuer']) || '',
            etfType: getVal(row, ['ETF類型', '類型', 'Type']) || '',
            marketType: getVal(row, ['上市/ 上櫃', '上市/上櫃', '市場', 'Market']) || '',
            size: 0,
            trend: ''
        };
    }).filter(d => d.etfCode !== 'UNKNOWN') as BasicInfo[];

    localStorage.setItem(KEYS.BASIC, JSON.stringify(newItems)); 
    return { count: newItems.length, noChange: false };
};

export const importPriceData = async (url: string) => {
    const rawData = await fetchGoogleSheet(url);
    const newItems: PriceData[] = [];
    const ignoreKeys = ['代碼', '名稱', 'Code', 'Name', 'ETF', 'ETFName', 'ETFCode', 'ETF代碼', 'ETF名稱', '分類', '週期', '類型', 'Type', 'Category', 'Freq', '商品分類', '配息週期', 'ETF類型'];
    
    // Strict Exclusion List for Price
    const exPrice = ['Open', 'High', 'Low', 'Prev', 'Change', 'Volume', '開盤', '最高', '最低', '昨收', '漲跌', '昨日'];

    rawData.forEach(row => {
        const etfCode = String(getVal(row, ['ETF 代碼', '代碼', 'Code', 'ETFCode', 'Symbol']) || '').trim();
        const etfName = getVal(row, ['ETF 名稱', '名稱', 'Name', 'ETFName']) || '';
        
        if (!etfCode) return;

        // 3. Strategy A: Wide Format (Dates as Headers)
        Object.keys(row).forEach(key => {
            if (ignoreKeys.some(k => key.includes(k))) return;
            if (key.match(/\d{2,4}[-\/]\d{1,2}[-\/]\d{1,2}/)) {
                 const val = row[key];
                 const priceVal = safeFloat(val);
                 if (priceVal > 0) {
                     const dateStr = normalizeDate(key);
                     if (dateStr) {
                         newItems.push({ etfCode, etfName, date: dateStr, price: priceVal, prevClose: 0, open: 0, high: 0, low: 0 });
                     }
                 }
            }
        });

        // 4. Strategy B: Vertical Format
        const vDate = normalizeDate(getVal(row, ['日期', 'Date', 'Time']));
        // STRICTER Price Column Selection
        const vPrice = safeFloat(getVal(row, ['收盤價', '收盤', 'Close', 'Price', '股價', '現價'], exPrice));
        
        if (vDate && vPrice > 0) {
            newItems.push({
                etfCode,
                etfName,
                date: vDate,
                price: vPrice,
                prevClose: safeFloat(getVal(row, ['昨日收盤價', '昨日收盤', 'Prev'])),
                open: safeFloat(getVal(row, ['開盤', 'Open'], ['漲跌'])),
                high: safeFloat(getVal(row, ['最高', 'High'])),
                low: safeFloat(getVal(row, ['最低', 'Low']))
            });
        }
    });

    const merged = mergeAndSave(KEYS.PRICE, await getPriceData(), newItems, 'etfCode', 'date');
    return { count: merged.length, noChange: false };
};

export const importDividendData = async (url: string) => {
    const rawData = await fetchGoogleSheet(url);
    const newItems = rawData.map(row => ({
        etfCode: String(getVal(row, ['ETF 代碼', '代碼', 'ETF代碼', 'Code']) || '').trim(),
        etfName: getVal(row, ['ETF 名稱', '名稱', 'ETF名稱', 'Name']) || '',
        yearMonth: getVal(row, ['年月', 'YearMonth']) || '',
        exDate: normalizeDate(getVal(row, ['除息日期', '除息日', 'ExDate'])),
        amount: safeFloat(getVal(row, ['除息金額', '金額', 'Amount'])),
        paymentDate: normalizeDate(getVal(row, ['股利發放', '股利發放日', '發放日', 'PaymentDate'])),
        yield: 0
    })).filter(item => item.etfCode && item.exDate); 
    const merged = mergeAndSave(KEYS.DIVIDEND, await getDividendData(), newItems, 'etfCode', 'exDate', 'amount');
    return { count: merged.length, noChange: false };
};

export const importSizeData = async (url: string) => {
    const rawData = await fetchGoogleSheet(url);
    const newItems: SizeData[] = [];
    rawData.forEach(row => {
        const etfCode = String(getVal(row, ['ETF 代碼', '代碼', 'Code', 'ETFCode']) || '').trim();
        const etfName = getVal(row, ['ETF 名稱', '名稱', 'Name', 'ETFName']) || '';
        if (!etfCode) return;
        let foundDateColumn = false;
        Object.keys(row).forEach(key => {
            if (key.match(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/)) {
                const val = row[key];
                if (val !== undefined && val !== '' && val !== null) {
                    const sizeVal = safeFloat(val);
                    if (sizeVal > 0) {
                         const dateMatch = key.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
                         if (dateMatch) {
                             const dateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[3].padStart(2,'0')}`;
                             newItems.push({ etfCode: etfCode, etfName: etfName, date: dateStr, size: sizeVal });
                             foundDateColumn = true;
                         }
                    }
                }
            }
        });
        if (!foundDateColumn) {
             const sizeVal = safeFloat(getVal(row, ['規模', '規模(億)', '資產規模', '最新規模', '基金規模', 'Size', 'Assets', 'AUM']));
             if (sizeVal > 0) {
                 newItems.push({ etfCode: etfCode, etfName: etfName, date: normalizeDate(getVal(row, ['日期', 'Date'])) || new Date().toISOString().split('T')[0], size: sizeVal });
             }
        }
    });
    localStorage.setItem(KEYS.SIZE, JSON.stringify(newItems));
    return { count: newItems.length, noChange: false };
};

export const importHistoryData = async (url: string) => {
    const rawData = await fetchGoogleSheet(url);
    const newItems: HistoryData[] = [];
    const ignoreKeys = ['代碼', '名稱', 'Code', 'Name', 'ETF', 'ETFName', 'ETFCode', 'ETF 代碼', 'ETF 名稱'];
    const exPrice = ['Open', 'High', 'Low', 'Prev', 'Change', 'Volume'];

    rawData.forEach(row => {
        const etfCode = String(getVal(row, ['ETF 代碼', '代碼', 'Code', 'ETFCode']) || '').trim();
        const etfName = getVal(row, ['ETF 名稱', '名稱', 'Name', 'ETFName']) || '';

        if (!etfCode) return;

        Object.keys(row).forEach(key => {
            if (ignoreKeys.some(k => key.includes(k))) return;
            if (key.match(/\d{2,4}[-\/]\d{1,2}[-\/]\d{1,2}/)) {
                 const val = row[key];
                 const priceVal = safeFloat(val);
                 if (priceVal > 0) {
                     const dateStr = normalizeDate(key);
                     if (dateStr) {
                         newItems.push({ etfCode, etfName, date: dateStr, price: priceVal });
                     }
                 }
            }
        });

        const vDate = normalizeDate(getVal(row, ['日期', 'Date']));
        const vPrice = safeFloat(getVal(row, ['收盤價', 'Price', 'Close', '收盤', '股價'], exPrice));
        if (vDate && vPrice > 0) {
             newItems.push({ etfCode: etfCode, etfName: etfName, date: vDate, price: vPrice });
        }
    });

    const merged = mergeAndSave(KEYS.HISTORY, await getHistoryData(), newItems, 'etfCode', 'date');
    return { count: merged.length, noChange: false };
};

const mergeAndSave = (key: string, existing: any[], newItems: any[], ...idKeys: string[]) => {
    const dataMap = new Map();
    existing.forEach(i => {
        const id = idKeys.map(k => String(i[k]||'')).join('_');
        dataMap.set(id, i);
    });
    newItems.forEach(i => {
        const id = idKeys.map(k => String(i[k]||'')).join('_');
        dataMap.set(id, i); 
    });
    const merged = Array.from(dataMap.values());
    localStorage.setItem(key, JSON.stringify(merged));
    return merged;
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
            let finalVal = String(val).replace(/"/g, '""');
            if (fieldName.match(/(代碼|Code|ID)/i)) {
                 return `="${finalVal}"`; 
            }
            return `"${finalVal}"`;
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

export const injectDemoData = () => { console.log("Demo data injection removed."); }

export const checkAndFetchSystemData = async () => {
    try {
        await Promise.all([
            importMarketData(DEFAULT_SYSTEM_URLS.market),
            importBasicInfo(DEFAULT_SYSTEM_URLS.basic),
            importPriceData(DEFAULT_SYSTEM_URLS.price),
            importDividendData(DEFAULT_SYSTEM_URLS.dividend),
            importSizeData(DEFAULT_SYSTEM_URLS.size),
            importHistoryData(DEFAULT_SYSTEM_URLS.history)
        ]);
        return true;
    } catch (e) {
        return false;
    }
};