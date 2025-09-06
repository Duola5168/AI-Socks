import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { ScoredStock, ChatMessage, StrategySettings } from '../types';
import { XCircleIcon, BrainCircuitIcon } from './icons';
import { config } from '../services/config';

interface AIChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    stock: ScoredStock;
    settings: StrategySettings; // Add settings to props
}

const TypingIndicator: React.FC = () => (
    <div className="flex items-center space-x-1">
        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
    </div>
);

export const AIChatModal: React.FC<AIChatModalProps> = ({ isOpen, onClose, stock: scoredStock, settings }) => {
    const { stock, collaborativeReport } = scoredStock;
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen && config.geminiApiKey && !chat) {
            const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
            
            const klineSummary = stock.kline.slice(-30).map(d => `{d:${d.time},c:${d.close}}`).join(',');
            
            let reportContext = '';
            if (collaborativeReport?.finalDecision) {
                const fd = collaborativeReport.finalDecision;
                reportContext = `
                AI 專家小組最終決策:
                - 綜合分數: ${fd.compositeScore}, 建議動作: ${fd.action}, 信心度: ${fd.confidence}
                - 裁決理由: ${fd.synthesisReasoning}
                - 操作策略: ${fd.operationalStrategy}
                `;
            }

            const initialContext = `
                這是關於 ${stock.name}(${stock.ticker}) 的對話。
                當前股價: ${stock.kline[stock.kline.length - 1].close.toFixed(2)}。
                關鍵數據: 營收年增率=${stock.revenueGrowth?.toFixed(2)}%, 波動率=${(stock.volatility * 100).toFixed(2)}%。
                ${reportContext}
                最近30日K線(部分): [${klineSummary}]
            `;

            const newChat = ai.chats.create({
                model: settings.analystPanel.geminiModel, // Use model from settings
                config: {
                    systemInstruction: `你是一位頂尖的金融分析師，專門針對單一股票提供深度見解。使用者會針對你已知的股票資訊提問，請根據上下文簡潔、專業地回答。上下文資訊: ${initialContext}`,
                },
            });
            setChat(newChat);
            setMessages([
                { role: 'system', content: '對話已建立。' },
                { role: 'model', content: `你好！我是您的 AI 分析師。我們已經完成了對 ${stock.name} 的專家小組評比，您還有什麼想深入了解的嗎？` }
            ]);
            setError(null);
        } else if (isOpen && !config.geminiApiKey) {
            setError("Gemini API Key 未設定，無法使用對話功能。");
        }
    }, [isOpen, stock, collaborativeReport, chat, settings.analystPanel.geminiModel]);
    

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || !chat || isLoading) return;

        const newUserMessage: ChatMessage = { role: 'user', content: userInput };
        setMessages(prev => [...prev, newUserMessage]);
        setUserInput('');
        setIsLoading(true);
        setError(null);
        
        let fullResponse = '';
        let modelMessageIndex = -1;

        try {
            const responseStream = await chat.sendMessageStream({ message: userInput });
            for await (const chunk of responseStream) {
                 fullResponse += chunk.text;
                 if (modelMessageIndex === -1) {
                    modelMessageIndex = messages.length + 1; // +1 for user msg, +1 for this new model msg
                    setMessages(prev => [...prev, { role: 'model', content: fullResponse }]);
                 } else {
                    setMessages(prev => prev.map((msg, index) => 
                        index === modelMessageIndex ? { ...msg, content: fullResponse } : msg
                    ));
                 }
            }
        } catch (err: any) {
            console.error("Chat error:", err);
            setError(`AI 回應時發生錯誤: ${err.message || '未知問題'}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <BrainCircuitIcon className="w-6 h-6 text-purple-400" />
                        <h3 className="text-lg font-bold text-white">AI 分析師對話: {stock.name}</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <XCircleIcon className="w-8 h-8"/>
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.filter(m => m.role !== 'system').map((msg, index) => (
                        <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                             {msg.role === 'model' && <BrainCircuitIcon className="w-6 h-6 text-purple-400 self-start shrink-0" />}
                             <div className={`max-w-md lg:max-w-lg p-3 rounded-2xl ${msg.role === 'user' ? 'bg-cyan-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                         <div className="flex items-end gap-2">
                             <BrainCircuitIcon className="w-6 h-6 text-purple-400 self-start shrink-0" />
                             <div className="max-w-md lg:max-w-lg p-3 rounded-2xl bg-gray-700 text-gray-200 rounded-bl-none">
                                <TypingIndicator />
                            </div>
                        </div>
                    )}
                    {error && <p className="text-red-400 text-center text-sm">{error}</p>}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-gray-700">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder={chat ? "輸入您的問題..." : "正在初始化 AI..."}
                            className="flex-1 w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition"
                            disabled={!chat || isLoading}
                        />
                        <button type="submit" disabled={!chat || isLoading || !userInput.trim()} className="px-4 py-2.5 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
                            傳送
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};