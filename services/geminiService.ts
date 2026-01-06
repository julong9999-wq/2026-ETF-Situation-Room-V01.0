import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeMarketTrend = async (data: any[]): Promise<string> => {
  try {
    const dataSample = JSON.stringify(data.slice(0, 20)); // Limit payload
    const prompt = `
      You are a financial analyst. Based on the following recent market data (JSON format), 
      provide a concise summary of the market trend (Bullish/Bearish/Neutral) and highlight 
      any significant anomalies or top performers. Keep it under 100 words in Traditional Chinese.
      
      Data: ${dataSample}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "無法產生分析結果。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "分析服務暫時無法使用，請檢查 API KEY。";
  }
};

export const assessProjectPlan = async (planText: string): Promise<string> => {
     try {
    const prompt = `
      You are a senior software architect. A user has provided a requirement document for an iPad-based 
      financial dashboard app relying on Google Sheets CSVs as a database.
      
      Please evaluate this plan:
      "${planText}"
      
      Provide a structured response in Traditional Chinese covering:
      1. Feasibility (可行性): Yes/No and why.
      2. Critical Risks (主要風險): Focus on CORS, Data Persistence (localStorage vs Database), and Sheet API quotas.
      3. Improvement Suggestions (建議): How to make it more robust.
      
      Use bullet points.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "無法產生評估報告。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "評估服務失敗。";
  }
}