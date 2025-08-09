/**
 * This file contains a structured list of available datasets for the FinMind API.
 * This information is used to provide context to the AI models, allowing them
 * to make more informed analyses and suggestions.
 * Note: This is a static list based on official documentation, as the FinMind
 * HTTP API does not currently offer an endpoint to dynamically list all datasets.
 */

interface ApiEndpoint {
    dataset: string;
    description: string;
    params: string[];
}

type ApiCategory = {
    [key: string]: ApiEndpoint[];
};

export const FINMIND_API_ENDPOINTS: ApiCategory = {
    "台灣股市 (Taiwan Market)": [
        { dataset: "TaiwanStockInfo", description: "台灣上市櫃股票基本資料", params: [] },
        { dataset: "TaiwanStockPrice", description: "台灣股價日成交資訊", params: ["data_id", "start_date", "end_date"] },
        { dataset: "TaiwanStockMonthRevenue", description: "台灣上市櫃公司月營收", params: ["data_id", "start_date"] },
        { dataset: "TaiwanStockPER", description: "個股 PER、PBR、股價淨值比", params: ["data_id", "start_date"] },
        { dataset: "TaiwanStockDividend", description: "歷年股利政策", params: ["data_id", "start_date"] },
        { dataset: "TaiwanStockOddLotTrading", description: "盤後零股交易", params: ["data_id", "start_date"] },
        { dataset: "TaiwanExchangeRate", description: "匯率資料", params: ["data_id", "start_date", "end_date"] },
    ],
    "籌碼面 (Institutional Trading)": [
        { dataset: "TaiwanStockInstitutionalInvestorsBuySell", description: "三大法人買賣超", params: ["data_id", "start_date"] },
        { dataset: "TaiwanStockShareholding", description: "集保股權分散表", params: ["data_id", "start_date"] },
        { dataset: "TaiwanStockMarginPurchaseShortSale", description: "融資融券", params: ["data_id", "start_date"] },
    ],
    "財務報表 (Financials)": [
        { dataset: "FinancialStatements", description: "綜合損益表、資產負債表等", params: ["data_id", "start_date"] },
    ],
    "美股 (US Market)": [
        { dataset: "USStockInfo", description: "美國股票基本資料", params: [] },
        { dataset: "USStockPrice", description: "美國股價日成交資訊", params: ["data_id", "start_date", "end_date"] },
        { dataset: "USStockFinancialStatements", description: "美國個股財務報表", params: ["data_id", "start_date"] },
    ]
};
