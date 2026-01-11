
// Data Models matching the Google Sheets structure

export interface MarketData {
  indexName: string; // 指數名稱
  code: string; // 代碼
  date: string; // 日期 tradetime
  prevClose: number; // 昨日收盤 closeyest
  open: number; // 開盤 priceopen
  high: number; // 高價 high
  low: number; // 低價 low
  price: number; // 現價 price
  volume: number; // 成交量 volume
  change: number; // 漲跌點數
  changePercent: number; // 漲跌幅 changepercent
  type: 'TW' | 'US'; // 台股 or 美股 (derived from sheet logic)
}

export interface BasicInfo {
  etfCode: string; // ETF 代碼
  etfName: string; // ETF 名稱
  category: string; // 商品分類
  dividendFreq: string; // 配息週期
  issuer: string; // 發行投信
  etfType: string; // ETF類型
  marketType: string; // 上市/上櫃
  size?: number; // 規模大小 (Joined from Size sheet)
  trend?: string; // 規模趨勢 (Calculated)
}

export interface PriceData {
  etfCode: string; // ETF 代碼
  etfName: string; // ETF 名稱
  date: string; // 日期
  prevClose: number; // 昨日收盤價
  open: number; // 開盤
  high: number; // 最高
  low: number; // 最低
  price: number; // 股價
}

export interface HistoryData {
  etfCode: string; // ETF 代碼
  etfName: string; // ETF 名稱
  date: string; // 日期
  price: number; // 收盤價/股價
  open?: number; // 開盤 (Optional)
  high?: number; // 最高 (Optional)
  low?: number; // 最低 (Optional)
  volume?: number; // 成交量 (Optional)
}

export interface DividendData {
  etfCode: string; // ETF 代碼
  etfName: string; // ETF 名稱
  yearMonth: string; // 年月
  exDate: string; // 除息日期
  amount: number; // 除息金額
  paymentDate?: string; // 股利發放
  yield?: number; // 殖利率 (Calculated)
}

export interface SizeData {
  etfCode: string; // ETF 代碼
  etfName: string; // ETF 名稱
  date?: string; // 資料日期 (Optional, if implied by import time)
  size: number; // 規模
}

export interface FillAnalysisData extends DividendData {
  preExDate: string; // 除息前一天 (日期)
  pricePreEx: number | string; // 除息前一天股價 (Number or "歷史資料"/"待除息")
  priceReference: number | string; // 除息參考價 (Number or "歷史資料"/"待除息")
  fillDate: string; // 分析比對日期 (填息發生的日期)
  fillPrice: number | string; // 分析比對價格 (填息當日的收盤價)
  isFilled: boolean; // 是否填息
  daysToFill: number | string; // 幾天填息
  statusNote?: string; // 狀態備註 (e.g., 歷史資料, 待除息資訊)
}

// --- NEW TYPES FOR PERFORMANCE ANALYSIS ---

// 單筆交易紀錄 (Raw Data)
export interface UserTransaction {
  id: string;           // UUID
  date: string;         // 交易日期 (YYYY-MM-DD)
  code: string;         // 股號
  name: string;         // 股名
  type: 'Buy' | 'Sell' | 'Div'; // 買入 | 賣出 | 配息 (預留)
  price: number;        // 成交單價
  quantity: number;     // 成交股數
  fee: number;          // 手續費
  tax: number;          // 交易稅
  totalAmount: number;  // 成交價金 (不含費稅)
  cost: number;         // 購買成本 (價金 + 手續費) / 賣出收入 (價金 - 費 - 稅)
  broker: string;       // 證券戶 (e.g. 元大, 凱基)
  category: string;     // 自訂分類 (e.g. 核心, 衛星, 高股息)
  note?: string;        // 備註
}

// 持倉彙整 (Calculated View)
export interface UserPosition {
  code: string;
  name: string;
  totalQty: number;     // 累積股數 (庫存)
  avgCost: number;      // 平均成本
  totalCost: number;    // 累積金額 (總成本)
  currentPrice?: number;// 現價 (from market data)
  marketValue?: number; // 市值
  pl?: number;          // 損益
  plPercent?: number;   // 損益率
  broker: string;       // 主要證券戶 (若有多個可能顯示 '多個' 或第一筆)
  category: string;     // 分類
}

export enum UserRole {
  ADMIN = 'ADMIN',
  VIEWER = 'VIEWER',
  GUEST = 'GUEST'
}

export const ADMIN_EMAILS = [
  'julong9999@gmail.com',
  'julong.ipad@gmail.com',
  'julong.ipad2@gmail.com'
];