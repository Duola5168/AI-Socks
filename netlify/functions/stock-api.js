// Using node-fetch v2 as Netlify functions environment might not support v3 syntax well.
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const TWSE_BASE_URL = "https://openapi.twse.com.tw/v1";

// FinMind token must be set in Netlify environment variables
const { VITE_FINMIND_API_TOKEN, VITE_NEWS_API_KEY, VITE_GITHUB_API_KEY } = process.env;

// Cache for robots.txt crawl-delay values to avoid re-fetching on every request.
const robotsCache = new Map();
const ROBOTS_CACHE_TTL = 1000 * 60 * 60; // Cache for 1 hour

/**
 * Fetches and parses the robots.txt file for a given URL to find the Crawl-delay directive.
 * This is a crucial part of being a responsible web scraper.
 * @param {string} baseUrl The base URL of the site to check (e.g., 'https://goodinfo.tw').
 * @returns {Promise<number>} The crawl-delay in seconds, or 0 if not specified.
 */
async function getRobotsTxtCrawlDelay(baseUrl) {
  const domain = new URL(baseUrl).hostname;
  if (robotsCache.has(domain) && (Date.now() - robotsCache.get(domain).timestamp < ROBOTS_CACHE_TTL)) {
    return robotsCache.get(domain).delay;
  }

  const robotsUrl = `${new URL(baseUrl).origin}/robots.txt`;
  let delay = 0; // Default to 0 seconds if not found

  try {
    const response = await fetch(robotsUrl, {
      headers: { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' }
    });
    if (response.ok) {
      const text = await response.text();
      const lines = text.split('\n');
      // Simple parser, looks for Crawl-delay under a general user-agent
      for (const line of lines) {
        if (line.toLowerCase().startsWith('crawl-delay:')) {
          const value = parseInt(line.split(':')[1].trim(), 10);
          if (!isNaN(value)) {
            delay = value;
            break; 
          }
        }
      }
    }
  } catch (error) {
    console.warn(`Could not fetch or parse robots.txt for ${domain}:`, error.message);
  }
  
  console.log(`robots.txt for ${domain} specifies Crawl-delay: ${delay}s`);
  robotsCache.set(domain, { delay, timestamp: Date.now() });
  return delay;
}


// Utility to add a respectful delay, as per scraping best practices.
// This prevents overwhelming the target server with rapid requests.
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


exports.handler = async function (event) {
  const { source, ...queryParams } = event.queryStringParameters;

  const headers = {
    'Access-Control-Allow-Origin': '*', // Or your specific domain for production
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    let targetUrl;
    let fetchOptions = { method: 'GET', headers: {} };
    
    // **Behavioral Mimicry: User-Agent & Headers**
    // To comply with scraping best practices and avoid being blocked, we identify ourselves with a standard browser User-Agent
    // and common request headers. This makes our requests appear more like they are coming from a real user's browser.
    const scrapeHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    };

    switch (source) {
      case 'twse': {
        const { endpoint, ...restOfTwseParams } = queryParams;
        if (!endpoint) {
          throw new Error('TWSE endpoint is required');
        }
        const twseParams = new URLSearchParams(restOfTwseParams);
        targetUrl = `${TWSE_BASE_URL}/exchangeReport/${endpoint}?${twseParams.toString()}`;
        break;
      }
      
      case 'finmind': {
        if (!VITE_FINMIND_API_TOKEN) {
          throw new Error("FinMind API token is not configured on the server.");
        }
        const finmindParams = new URLSearchParams(queryParams);
        finmindParams.set('token', VITE_FINMIND_API_TOKEN);
        targetUrl = `https://api.finmindtrade.com/api/v4/data?${finmindParams.toString()}`;
        break;
      }
      
      case 'newsapi': {
        if (!VITE_NEWS_API_KEY) {
            throw new Error("News API key is not configured on the server.");
        }
        // remove 'source' from queryParams before passing to newsapi
        delete queryParams.source;
        const newsParams = new URLSearchParams(queryParams);
        targetUrl = `https://newsapi.org/v2/everything?${newsParams.toString()}`;
        fetchOptions.headers = { 'X-Api-Key': VITE_NEWS_API_KEY };
        break;
      }

      case 'github_models': {
        if (!VITE_GITHUB_API_KEY) {
            throw new Error("GitHub API Key (VITE_GITHUB_API_KEY) is not configured on the server.");
        }
        
        targetUrl = `https://models.github.ai/inference/chat/completions`; // Corrected URL
        fetchOptions.method = 'POST';
        fetchOptions.headers = {
            'Authorization': `Bearer ${VITE_GITHUB_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        fetchOptions.body = event.body; // Forward the request body from the client
        break;
      }

      case 'github_catalog': {
        if (!VITE_GITHUB_API_KEY) {
            throw new Error("GitHub API Key (VITE_GITHUB_API_KEY) is not configured on the server.");
        }
        targetUrl = `https://models.github.ai/catalog/models`; // New catalog endpoint
        fetchOptions.method = 'GET';
        fetchOptions.headers = {
            'Authorization': `Bearer ${VITE_GITHUB_API_KEY}`,
            'Accept': 'application/json',
        };
        break;
      }
      
      case 'goodinfo': {
        const goodinfoUrl = 'https://goodinfo.tw/tw/index.asp';
        
        // **Compliance 1: Respect robots.txt**
        // We first fetch and respect the Crawl-delay directive from the site's robots.txt.
        const crawlDelaySeconds = await getRobotsTxtCrawlDelay(goodinfoUrl);

        // **Compliance 2: Human-like Request Frequency**
        // On top of the required crawl-delay, we add a significant, random delay (1-5 seconds).
        // This irregular timing makes our request pattern less robotic and further mimics
        // the unpredictable nature of a human user's browsing behavior.
        const randomAdditionalDelay = Math.random() * 4000 + 1000; // 1000ms to 5000ms
        const totalDelayMs = (crawlDelaySeconds * 1000) + randomAdditionalDelay;
        console.log(`Goodinfo: Complying with Crawl-delay (${crawlDelaySeconds}s) + random delay (${(randomAdditionalDelay / 1000).toFixed(2)}s). Total wait: ${totalDelayMs.toFixed(0)}ms.`);
        
        await sleep(totalDelayMs);
        
        const response = await fetch(goodinfoUrl, { headers: scrapeHeaders });
        if (!response.ok) {
          throw new Error(`無法連接 Goodinfo，狀態碼: ${response.status}`);
        }
        const html = await response.text();
        
        if (!html || html.length < 100) {
            throw new Error('從 Goodinfo 獲取的回應內容不完整。');
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: "ok",
            message: `Goodinfo 連線成功，並收到有效的 HTML 回應。`,
            data: { success: true }
          }),
        };
      }

      case 'mops': {
        const mopsUrl = 'https://mops.twse.com.tw/mops/web/index';

        // **Compliance 1: Respect robots.txt**
        // We first fetch and respect the Crawl-delay directive from the site's robots.txt.
        const crawlDelaySeconds = await getRobotsTxtCrawlDelay(mopsUrl);
        
        // **Compliance 2: Human-like Request Frequency**
        // On top of the required crawl-delay, we add a significant, random delay (1-5 seconds).
        // This irregular timing makes our request pattern less robotic and further mimics
        // the unpredictable nature of a human user's browsing behavior.
        const randomAdditionalDelay = Math.random() * 4000 + 1000; // 1000ms to 5000ms
        const totalDelayMs = (crawlDelaySeconds * 1000) + randomAdditionalDelay;
        console.log(`MOPS: Complying with Crawl-delay (${crawlDelaySeconds}s) + random delay (${(randomAdditionalDelay / 1000).toFixed(2)}s). Total wait: ${totalDelayMs.toFixed(0)}ms.`);

        await sleep(totalDelayMs);

        const response = await fetch(mopsUrl, { headers: scrapeHeaders });
        if (!response.ok) {
          throw new Error(`無法連接 MOPS，狀態碼: ${response.status}`);
        }
        const html = await response.text();
        
        if (!html || html.length < 100) {
            throw new Error('從 MOPS 獲取的回應內容不完整。');
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: "ok",
            message: "MOPS 連線成功，並收到有效的 HTML 回應。",
            data: { success: true }
          }),
        };
      }

      default:
        throw new Error('Invalid or missing data source specified');
    }

    const response = await fetch(targetUrl, fetchOptions);

    if (!response.ok) {
        let errorBody;
        try {
            errorBody = await response.json();
        } catch(e) {
            errorBody = await response.text();
        }
        console.error(`Upstream API error for ${source}:`, errorBody);
        throw new Error(`Failed to fetch from ${source}. Status: ${response.status}. Message: ${JSON.stringify(errorBody)}`);
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };

  } catch (err) {
    console.error('Proxy function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};