import React from 'react';

interface ConfigErrorProps {
    message: string;
}

export const ConfigError: React.FC<ConfigErrorProps> = ({ message }) => {
    return (
        <div className="mb-4 bg-yellow-800/50 border border-yellow-700 text-yellow-300 px-4 py-3 rounded-lg" role="alert">
            <p className="font-bold">設定警告</p>
            <span className="block sm:inline">{message} 部分功能可能無法正常使用。</span>
        </div>
    );
};
