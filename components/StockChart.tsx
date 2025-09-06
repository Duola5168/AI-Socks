import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { createChart, IChartApi, ISeriesApi, CrosshairMode, CandlestickData, LineData, LineStyle, SeriesMarker, Time } from 'lightweight-charts';
import { KLineData } from '../types';

interface StockChartProps {
    klineData: KLineData[];
    entryPrice?: number;
}

const StockChart: React.FC<StockChartProps> = ({ klineData, entryPrice }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const ma5SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const priceLineRef = useRef<any>(null); // PriceLine does not have a dedicated type in the library

    const [showMA5, setShowMA5] = useState(() => {
        try {
            const saved = localStorage.getItem('stockChartShowMA5');
            return saved !== null ? JSON.parse(saved) : true;
        } catch {
            return true;
        }
    });
    const [showMA20, setShowMA20] = useState(() => {
        try {
            const saved = localStorage.getItem('stockChartShowMA20');
            return saved !== null ? JSON.parse(saved) : true;
        } catch {
            return true;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('stockChartShowMA5', JSON.stringify(showMA5));
        } catch (error) {
            console.error('Failed to save MA5 visibility to localStorage', error);
        }
    }, [showMA5]);

    useEffect(() => {
        try {
            localStorage.setItem('stockChartShowMA20', JSON.stringify(showMA20));
        } catch (error) {
            console.error('Failed to save MA20 visibility to localStorage', error);
        }
    }, [showMA20]);

    const { ma5Data, ma20Data } = useMemo(() => {
        const calculateMA = (data: KLineData[], period: number): LineData[] => {
            if (data.length < period) return [];
            const result: LineData[] = [];
            for (let i = period - 1; i < data.length; i++) {
                let sum = 0;
                for (let j = 0; j < period; j++) {
                    sum += data[i - j].close;
                }
                result.push({ time: data[i].time as Time, value: sum / period });
            }
            return result;
        };
        return {
            ma5Data: calculateMA(klineData, 5),
            ma20Data: calculateMA(klineData, 20),
        };
    }, [klineData]);
    
    const signalMarkers = useMemo((): SeriesMarker<Time>[] => {
        const markers: SeriesMarker<Time>[] = [];
        if (ma5Data.length === 0 || ma20Data.length === 0) return markers;

        const ma5Map = new Map(ma5Data.map(d => [d.time, d.value]));
        const ma20Map = new Map(ma20Data.map(d => [d.time, d.value]));
        const commonTimes = ma5Data.filter(d => ma20Map.has(d.time)).map(d => d.time).sort((a,b) => (a as string).localeCompare(b as string));

        for (let i = 1; i < commonTimes.length; i++) {
            const prevTime = commonTimes[i - 1];
            const currentTime = commonTimes[i];
            
            const prevMa5 = ma5Map.get(prevTime);
            const prevMa20 = ma20Map.get(prevTime);
            const currentMa5 = ma5Map.get(currentTime);
            const currentMa20 = ma20Map.get(currentTime);

            if (prevMa5 === undefined || prevMa20 === undefined || currentMa5 === undefined || currentMa20 === undefined) continue;

            // Golden Cross (Buy Signal)
            if (prevMa5 <= prevMa20 && currentMa5 > currentMa20) {
                markers.push({ time: currentTime, position: 'belowBar', color: '#22c55e', shape: 'arrowUp', size: 1 });
            }
            // Death Cross (Sell Signal)
            if (prevMa5 >= prevMa20 && currentMa5 < currentMa20) {
                markers.push({ time: currentTime, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', size: 1 });
            }
        }
        return markers;
    }, [ma5Data, ma20Data]);

    // Initialize chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 300,
            layout: { background: { color: 'transparent' }, textColor: 'rgba(229, 231, 235, 0.9)' },
            grid: { vertLines: { color: 'rgba(75, 85, 99, 0.5)' }, horzLines: { color: 'rgba(75, 85, 99, 0.5)' } },
            crosshair: { mode: CrosshairMode.Normal },
            timeScale: { borderColor: '#4b5563' },
        });
        chartRef.current = chart;
        
        candleSeriesRef.current = (chart as any).addCandlestickSeries({
            upColor: '#10b981', downColor: '#ef4444', borderDownColor: '#ef4444',
            borderUpColor: '#10b981', wickDownColor: '#ef4444', wickUpColor: '#10b981',
        });
        ma5SeriesRef.current = (chart as any).addLineSeries({ color: 'cyan', lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
        ma20SeriesRef.current = (chart as any).addLineSeries({ color: 'yellow', lineWidth: 1, lastValueVisible: false, priceLineVisible: false });

        const handleResize = () => chartContainerRef.current && chart.resize(chartContainerRef.current.clientWidth, 300);
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            chartRef.current = null;
        };
    }, []);

    // Update data, markers, and price line
    useEffect(() => {
        if (candleSeriesRef.current) {
            const candleData: CandlestickData[] = klineData.map(d => ({
                time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close
            }));
            candleSeriesRef.current.setData(candleData);
            // FIX: Cast to 'any' to bypass a potential type definition issue for 'setMarkers'.
            (candleSeriesRef.current as any).setMarkers(signalMarkers);
        }
        if (ma5SeriesRef.current) ma5SeriesRef.current.setData(ma5Data);
        if (ma20SeriesRef.current) ma20SeriesRef.current.setData(ma20Data);
        
        if (candleSeriesRef.current) {
            if (priceLineRef.current) {
                candleSeriesRef.current.removePriceLine(priceLineRef.current);
                priceLineRef.current = null;
            }
            if (entryPrice) {
                priceLineRef.current = candleSeriesRef.current.createPriceLine({
                    price: entryPrice, color: '#e5e7eb', lineWidth: 1,
                    lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '成本價',
                });
            }
        }

        if(chartRef.current) chartRef.current.timeScale().fitContent();

    }, [klineData, ma5Data, ma20Data, signalMarkers, entryPrice]);

    // Update visibility of MA lines
    useEffect(() => {
        if (ma5SeriesRef.current) ma5SeriesRef.current.applyOptions({ visible: showMA5 });
    }, [showMA5]);

    useEffect(() => {
        if (ma20SeriesRef.current) ma20SeriesRef.current.applyOptions({ visible: showMA20 });
    }, [showMA20]);

    return (
        <div className="bg-gray-900/50 p-4 rounded-lg">
            <div className="flex items-center gap-x-6 gap-y-2 mb-2 flex-wrap">
                <h3 className="text-lg font-semibold text-gray-200">近期日 K 線圖</h3>
                <div className="flex items-center gap-4">
                    <label className="flex items-center text-xs text-cyan-400 cursor-pointer select-none">
                        <input type="checkbox" checked={showMA5} onChange={() => setShowMA5(s => !s)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500" />
                        <span className="ml-2">MA5</span>
                    </label>
                    <label className="flex items-center text-xs text-yellow-400 cursor-pointer select-none">
                        <input type="checkbox" checked={showMA20} onChange={() => setShowMA20(s => !s)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-yellow-500 focus:ring-yellow-500" />
                        <span className="ml-2">MA20</span>
                    </label>
                </div>
            </div>
            <div ref={chartContainerRef} className="w-full h-[300px]" />
        </div>
    );
};

export default memo(StockChart);