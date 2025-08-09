// Using node-fetch v2 as Netlify functions environment might not support v3 syntax well.
const fetch = require('node-fetch');

const TWSE_BASE_URL = "https://openapi.twse.com.tw/v1";

// FinMind token must be set in Netlify environment variables
const { VITE_FINMIND_API_TOKEN, VITE_NEWS_API_KEY } = process.env;

exports.handler = async function (event) {
  const { source, ...queryParams } = event.queryStringParameters;

  const headers = {
    'Access-Control-Allow-Origin': '*', // Or your specific domain
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    let targetUrl;
    let fetchOptions = { method: 'GET', headers: {} };

    switch (source) {
      case 'twse':
        if (!queryParams.endpoint) {
          throw new Error('TWSE endpoint is required');
        }
        targetUrl = `${TWSE_BASE_URL}/exchangeReport/${queryParams.endpoint}`;
        break;

      case 'finmind':
        if (!VITE_FINMIND_API_TOKEN) {
          throw new Error("FinMind API token is not configured on the server.");
        }
        const finmindParams = new URLSearchParams(queryParams);
        finmindParams.set('token', VITE_FINMIND_API_TOKEN);
        targetUrl = `https://api.finmindtrade.com/api/v4/data?${finmindParams.toString()}`;
        break;
      
      case 'newsapi':
        if (!VITE_NEWS_API_KEY) {
            throw new Error("News API key is not configured on the server.");
        }
        // remove 'source' from queryParams before passing to newsapi
        delete queryParams.source;
        const newsParams = new URLSearchParams(queryParams);
        targetUrl = `https://newsapi.org/v2/everything?${newsParams.toString()}`;
        fetchOptions.headers = { 'X-Api-Key': VITE_NEWS_API_KEY };
        break;

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
