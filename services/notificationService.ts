import { PortfolioHolding } from '../types';
import { config, IS_BREVO_CONFIGURED } from './config';

const SENDER_EMAIL = 'no-reply@ai-investor.com';
const SENDER_NAME = 'AI 智慧投資平台';

export const sendStopLossEmail = async (holding: PortfolioHolding, alertMessage: string): Promise<boolean> => {
  if (!IS_BREVO_CONFIGURED) {
    console.warn('Brevo API Key or User Email not configured. Skipping email notification.');
    return false;
  }

  const subject = `停損警示: ${holding.name} (${holding.ticker})`;
  const htmlContent = `
    <html>
      <body style="font-family: sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; padding: 20px; border: 1px solid #ddd;">
          <h1 style="color: #c9302c; border-bottom: 2px solid #eee; padding-bottom: 10px;">智慧投資平台 - 停損警示</h1>
          <p>請注意，您的持股 <strong>${holding.name} (${holding.ticker})</strong> 已觸發停損條件。</p>
          <div style="background-color: #f8d7da; border-left: 5px solid #c9302c; color: #721c24; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <strong>警示訊息：</strong> ${alertMessage}
          </div>
          <h3 style="color: #333;">持股詳情：</h3>
          <ul style="list-style-type: none; padding: 0;">
            <li style="background-color: #f9f9f9; padding: 8px 12px; border-radius: 4px; margin-bottom: 5px;"><strong>股票名稱：</strong> ${holding.name} (${holding.ticker})</li>
            <li style="background-color: #f9f9f9; padding: 8px 12px; border-radius: 4px; margin-bottom: 5px;"><strong>平均成本：</strong> $${holding.entryPrice.toFixed(2)}</li>
            <li style="background-color: #f9f9f9; padding: 8px 12px; border-radius: 4px; margin-bottom: 5px;"><strong>目前股價：</strong> $${holding.currentPrice.toFixed(2)}</li>
            <li style="background-color: #f9f9f9; padding: 8px 12px; border-radius: 4px; margin-bottom: 5px;"><strong>持有股數：</strong> ${holding.shares}</li>
            <li style="background-color: #f9f9f9; padding: 8px 12px; border-radius: 4px; margin-bottom: 5px;"><strong>目前損益：</strong> <span style="color: ${((holding.currentPrice - holding.entryPrice) * holding.shares) >= 0 ? 'green' : 'red'}; font-weight: bold;">$${((holding.currentPrice - holding.entryPrice) * holding.shares).toFixed(2)}</span></li>
          </ul>
          <p>請登入平台檢視詳情並評估是否需要執行賣出操作。</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #777;">這是一封自動通知郵件，請勿直接回覆。</p>
        </div>
      </body>
    </html>
  `;

  const body = {
    sender: { email: SENDER_EMAIL, name: SENDER_NAME },
    to: [{ email: config.userEmail }],
    subject,
    htmlContent,
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': config.brevoApiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Brevo API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    console.log(`Stop-loss email sent successfully for ${holding.ticker}`);
    return true;
  } catch (error) {
    console.error(`Failed to send stop-loss email for ${holding.ticker}:`, error);
    return false;
  }
};