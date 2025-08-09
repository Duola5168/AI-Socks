import React from 'react';
import { CloudIcon, DatabaseIcon, ChatBubbleLeftIcon, GroqIcon, NewspaperIcon, ServerStackIcon } from './icons';

interface StatusIconProps {
  serviceName: string;
  isConfigured: boolean;
  Icon: React.FC<{ className?: string }>;
}

const StatusIcon: React.FC<StatusIconProps> = ({ serviceName, isConfigured, Icon }) => {
  const title = isConfigured ? `${serviceName} 已連接` : `${serviceName} 未設定或連接失敗`;
  const iconColor = isConfigured ? 'text-green-400' : 'text-yellow-500';

  return (
    <div title={title}>
      <Icon className={`w-5 h-5 transition-colors ${iconColor}`} />
    </div>
  );
};

interface ServiceStatusProps {
    firebase: boolean;
    finmind: boolean;
    gemini: boolean;
    groq: boolean;
    news: boolean;
    proxy: boolean;
}

export const ServiceStatus: React.FC<ServiceStatusProps> = ({ firebase, finmind, gemini, groq, news, proxy }) => {
    return (
        <div className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700">
            <StatusIcon serviceName="代理伺服器" isConfigured={proxy} Icon={ServerStackIcon} />
            <StatusIcon serviceName="Firebase 雲端同步" isConfigured={firebase} Icon={CloudIcon} />
            <StatusIcon serviceName="FinMind 市場數據" isConfigured={finmind} Icon={DatabaseIcon} />
            <StatusIcon serviceName="Gemini AI 分析" isConfigured={gemini} Icon={ChatBubbleLeftIcon} />
            <StatusIcon serviceName="Groq 第二意見" isConfigured={groq} Icon={GroqIcon} />
            <StatusIcon serviceName="News API 輿情" isConfigured={news} Icon={NewspaperIcon} />
        </div>
    );
}