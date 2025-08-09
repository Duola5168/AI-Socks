/**
 * This file contains a structured list of available endpoints for the
 * Taiwan Stock Exchange (TWSE) OpenAPI.
 * This information is used to provide context to the AI models, allowing them
 * to make more informed analyses and suggestions based on what official data
 * is potentially available.
 */

interface ApiEndpoint {
    endpoint: string;
    description: string;
}

type ApiCategory = {
    [key: string]: ApiEndpoint[];
};

export const TWSE_API_ENDPOINTS: ApiCategory = {
    "公司治理": [
        { endpoint: "t187ap45_L", description: "上市公司股利分派情形" },
        { endpoint: "t187ap46_L_20", description: "上市公司企業ESG資訊揭露彙總資料-反競爭行為法律訴訟" },
        { endpoint: "t187ap46_L_19", description: "上市公司企業ESG資訊揭露彙總資料-風險管理政策" },
        { endpoint: "t187ap46_L_18", description: "上市公司企業ESG資訊揭露彙總資料-持股及控制力" },
        { endpoint: "t187ap46_L_17", description: "上市公司企業ESG資訊揭露彙總資料-普惠金融" },
        { endpoint: "t187ap46_L_15", description: "上市公司企業ESG資訊揭露彙總資料-資訊安全" },
        { endpoint: "t187ap46_L_14", description: "上市公司企業ESG資訊揭露彙總資料-社區關係" },
        { endpoint: "t187ap46_L_13", description: "上市公司企業ESG資訊揭露彙總資料-產品品質與安全" },
        { endpoint: "t187ap46_L_12", description: "上市公司企業ESG資訊揭露彙總資料-供應鏈管理" },
        { endpoint: "t187ap46_L_11", description: "上市公司企業ESG資訊揭露彙總資料-食品安全" },
        { endpoint: "t187ap46_L_10", description: "上市公司企業ESG資訊揭露彙總資料-產品生命週期" },
        { endpoint: "t187ap46_L_9", description: "上市公司企業ESG資訊揭露彙總資料-燃料管理" },
        { endpoint: "t187ap46_L_8", description: "上市公司企業ESG資訊揭露彙總資料-功能性委員會" },
        { endpoint: "t187ap46_L_7", description: "上市公司企業ESG資訊揭露彙總資料-投資人溝通" },
        { endpoint: "t187ap46_L_6", description: "上市公司企業ESG資訊揭露彙總資料-董事會" },
        { endpoint: "t187ap46_L_5", description: "上市公司企業ESG資訊揭露彙總資料-人力發展" },
        { endpoint: "t187ap46_L_4", description: "上市公司企業ESG資訊揭露彙總資料-廢棄物管理" },
        { endpoint: "t187ap46_L_3", description: "上市公司企業ESG資訊揭露彙總資料-水資源管理" },
        { endpoint: "t187ap46_L_2", description: "上市公司企業ESG資訊揭露彙總資料-能源管理" },
        { endpoint: "t187ap46_L_1", description: "上市公司企業ESG資訊揭露彙總資料-溫室氣體排放" },
        { endpoint: "t187ap04_L", description: "上市公司每日重大訊息" },
        { endpoint: "t187ap03_L", description: "上市公司基本資料" },
        { endpoint: "t187ap02_L", description: "上市公司持股逾 10% 大股東名單" },
        { endpoint: "t187ap08_L", description: "上市公司董事、監察人持股不足法定成數彙總表" },
        { endpoint: "t187ap11_L", description: "上市公司董監事持股餘額明細資料" },
        { endpoint: "t187ap12_L", description: "上市公司每日內部人持股轉讓事前申報表-持股轉讓日報表" },
        { endpoint: "t187ap13_L", description: "上市公司每日內部人持股轉讓事前申報表-持股未轉讓日報表" },
        { endpoint: "t187ap22_L", description: "上市公司金管會證券期貨局裁罰案件專區" },
        { endpoint: "t187ap30_L", description: "上市公司獨立董監事兼任情形彙總表" },
        { endpoint: "t187ap29_A_L", description: "上市公司董事酬金相關資訊" },
        { endpoint: "t187ap23_L", description: "上市公司違反資訊申報、重大訊息及說明記者會規定專區" },
        { endpoint: "t187ap10_L", description: "上市公司董事、監察人持股不足法定成數連續達3個月以上彙總表" },
        { endpoint: "t187ap38_L", description: "上市公司股東會公告-召集股東常(臨時)會公告資料彙總表" },
        { endpoint: "t187ap24_L", description: "上市公司經營權異動公司" },
        { endpoint: "t187ap41_L", description: "上市公司召開股東常 (臨時) 會日期、地點及採用電子投票情形等資料彙總表" },
    ],
    "證券交易": [
        { endpoint: "BWIBBU_ALL", description: "上市個股日本益比、殖利率及股價淨值比（依代碼查詢）" },
        { endpoint: "STOCK_DAY_AVG_ALL", description: "上市個股日收盤價及月平均價" },
        { endpoint: "STOCK_DAY_ALL", description: "上市個股日成交資訊" },
        { endpoint: "FMSRFK_ALL", description: "上市個股月成交資訊" },
        { endpoint: "FMNPTK_ALL", description: "上市個股年成交資訊" },
        { endpoint: "MI_INDEX", description: "每日收盤行情-大盤統計資訊" },
        { endpoint: "MI_QFIIS_cat", description: "集中市場外資及陸資投資類股持股比率表" },
        { endpoint: "MI_QFIIS_sort_20", description: "集中市場外資及陸資持股前 20 名彙總表" },
        { endpoint: "TWT88U", description: "上市個股首五日無漲跌幅" },
        { endpoint: "BFZFZU_T", description: "投資理財節目異常推介個股" },
        { endpoint: "TWTB4U", description: "上市股票每日當日沖銷交易標的及統計" },
        { endpoint: "MI_5MINS", description: "每 5 秒委託成交統計" },
        { endpoint: "FMTQIK", description: "集中市場每日市場成交資訊" },
        { endpoint: "MI_INDEX20", description: "集中市場每日成交量前二十名證券" },
        { endpoint: "TWT53U", description: "集中市場零股交易行情單" },
        { endpoint: "TWTAWU", description: "集中市場暫停交易證券" },
        { endpoint: "BFT41U", description: "集中市場盤後定價交易" },
        { endpoint: "BFI84U", description: "集中市場停資停券預告表" },
        { endpoint: "MI_MARGN", description: "集中市場融資融券餘額" },
        { endpoint: "TWT84U", description: "上市個股股價升降幅度" },
        { endpoint: "twtazu_od", description: "集中市場漲跌證券數統計表" },
        { endpoint: "notetrans", description: "集中市場公布注意累計次數異常資訊" },
        { endpoint: "notice", description: "集中市場當日公布注意股票" },
        { endpoint: "TWT48U_ALL", description: "上市股票除權除息預告表" },
    ],
    "財務報表": [
        { endpoint: "t187ap05_L", description: "上市公司每月營業收入彙總表" },
        { endpoint: "t187ap17_L", description: "上市公司營益分析查詢彙總表" },
        { endpoint: "t187ap06_L_ci", description: "上市公司綜合損益表(一般業)" },
        { endpoint: "t187ap07_L_ci", description: "上市公司資產負債表(一般業)" },
    ],
    "指數": [
        { endpoint: "MI_INDEX4", description: "每日上市上櫃跨市場成交資訊" },
        { endpoint: "TAI50I", description: "臺灣 50 指數歷史資料" },
        { endpoint: "MI_5MINS_HIST", description: "發行量加權股價指數歷史資料" },
    ],
    "券商資料": [
        { endpoint: "ETFRank", description: "定期定額前十名交易戶數證券統計" },
    ],
};
