import React, { useEffect, useState } from 'react';
import { wsClient } from '../services/wsClient';

interface Order {
    id: string;
    price: number;
    size: number; // Duration
    quantity: number; // Count
    total: number;
    type: 'bid' | 'ask';
}

interface OrderBookProps {
    filterDuration: number;
}

export const OrderBook: React.FC<OrderBookProps> = ({ filterDuration }) => {
    const [bids, setBids] = useState<Order[]>([]);
    const [asks, setAsks] = useState<Order[]>([]);
    const [lastPrice, setLastPrice] = useState<number>(0);

    useEffect(() => {
        const unsubBid = wsClient.subscribe('bid', (data: any) => {
            // Priority: Normalized 'price' field -> Raw 'max_price_per_second' / 1e6 -> 0
            let price = data.price;
            // Check if price is undefined OR if it looks like raw micros (e.g. integer > 100)
            if (price === undefined || price > 10) {
                if (data.max_price_per_second) {
                    price = data.max_price_per_second / 1_000_000;
                }
            }
            price = price || 0;

            const quantity = data.quantity || 1;
            const duration = data.duration || 30;

            const newOrder: Order = {
                id: data.bidId || Math.random().toString(),
                price: price,
                size: duration,
                quantity: quantity,
                total: price * duration * quantity,
                type: 'bid'
            };
            setBids(prev => {
                if (prev.some(o => o.id === newOrder.id)) return prev;
                const updated = [...prev, newOrder].sort((a, b) => b.price - a.price).slice(0, 50);
                return updated;
            });
        });

        const unsubAsk = wsClient.subscribe('ask', (data: any) => {
            let price = 0;
            if (data.pricePerSecond) {
                // Asks come in as micros
                price = data.pricePerSecond / 1_000_000;
            }

            const newOrder: Order = {
                id: data.id || Math.random().toString(),
                price: price,
                size: 60,
                quantity: 1, // Assumption for single user ask
                total: price * 60,
                type: 'ask'
            };

            if (Math.random() > 0.5) newOrder.size = 10;
            else if (Math.random() > 0.5) newOrder.size = 30;

            // Recalculate total
            newOrder.total = newOrder.price * newOrder.size * newOrder.quantity;

            setAsks(prev => {
                if (prev.some(o => o.id === newOrder.id)) return prev;
                const updated = [...prev, newOrder].sort((a, b) => a.price - b.price).slice(0, 50);
                return updated;
            });
        });

        return () => {
            unsubBid();
            unsubAsk();
        };
    }, []);

    const renderRow = (order: Order, type: 'bid' | 'ask') => {
        const depthPercent = Math.min(100, (order.quantity / 50) * 100); // Visualizing based on quantity depth
        const tvps = order.price * order.quantity;

        const colorClass = type === 'bid' ? 'text-green-400' : 'text-red-400';
        const bgClass = type === 'bid' ? 'bg-green-500/10' : 'bg-red-500/10';

        return (
            <div key={order.id} className="relative grid grid-cols-4 px-2 py-1 text-sm font-mono cursor-pointer hover:bg-white/5 transition-colors items-center">
                {/* Depth Bar */}
                <div className={`absolute top-0 bottom-0 right-0 z-0 ${bgClass}`} style={{ width: `${depthPercent}%` }} />

                <span className={`z-10 text-left ${colorClass}`}>{order.price.toFixed(4)}</span>
                <span className="z-10 text-center text-gray-300">{order.quantity}</span>
                <span className="z-10 text-right text-gray-400">{tvps.toFixed(4)}</span>
                <span className="z-10 text-right text-gray-500">{order.total.toFixed(4)}</span>
            </div>
        );
    };

    // Filter Logic
    const filteredAsks = asks.filter(a => Math.abs(a.size - filterDuration) < 5 || a.size >= filterDuration);
    const filteredBids = bids.filter(b => Math.abs(b.size - filterDuration) < 5);

    // Aggregation Logic
    const aggregate = (orders: Order[]) => {
        const groups = new Map<number, Order>();
        orders.forEach(o => {
            const existing = groups.get(o.price);
            if (existing) {
                existing.size += o.size; // Total Duration
                existing.quantity += o.quantity; // Total Quantity
                existing.total += o.total; // Total Value
            } else {
                groups.set(o.price, { ...o, id: `agg_${o.price}` });
            }
        });
        return Array.from(groups.values());
    };

    const aggregatedAsks = aggregate(filteredAsks);
    const aggregatedBids = aggregate(filteredBids);

    const asksToRender = aggregatedAsks.sort((a, b) => b.price - a.price).slice(0, 15); // Show highest asks... wait, asks usually sorted ascending? 
    // Standard Order Book:
    // Asks: Lowest Price at bottom (closest to spread). Sorted Descending visually for "Waterfall" but structurally Ascending price? 
    // Usually:
    // Asks (Top Half): Price desc (High -> Low). Bottom of Asks is lowest price (Best Ask).
    // Bids (Bottom Half): Price desc (High -> Low). Top of Bids is highest price (Best Bid).

    // Existing code: `asksToRender.sort((a, b) => b.price - a.price)` -> Descending. High asks at top. Low asks at bottom. Correct.
    // Wait, typical order book: 
    // Sell 110
    // Sell 105
    // Sell 100
    // --- Spread ---
    // Buy 99
    // Buy 95
    // Buy 90

    // So Asks sorted Descending (110, 105, 100). Yes.

    const bidsToRender = aggregatedBids.sort((a, b) => b.price - a.price).slice(0, 15);

    // Update last price based on visible book (Best Bid)
    useEffect(() => {
        if (bidsToRender.length > 0) setLastPrice(bidsToRender[0].price);
    }, [bidsToRender]);


    return (
        <div className="flex flex-col h-full glass-panel rounded overflow-hidden shadow-lg border-t-0 border-r border-[#333842]">
            {/* Header */}
            <div className="grid grid-cols-4 px-2 py-2 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800 bg-bg-panel">
                <span className="text-left">Price/s</span>
                <span className="text-center">Qty</span>
                <span className="text-right">TVPS</span>
                <span className="text-right">TV</span>
            </div>

            {/* ASKS (Red) */}
            <div className="flex-1 flex flex-col justify-end overflow-hidden">
                {asksToRender.length === 0 && <div className="text-center text-xs text-gray-600 py-4">No Asks</div>}
                {asksToRender.map(ask => renderRow(ask, 'ask'))}
            </div>

            {/* Price Indicator */}
            <div className="py-2 flex items-center justify-center border-y border-gray-800 bg-black/20 backdrop-blur">
                <span className={`text-lg font-bold font-mono tracking-wider ${lastPrice > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                    {lastPrice > 0 ? lastPrice.toFixed(4) : '0.0000'} <span className="text-xs text-gray-600">$</span>
                </span>
            </div>

            {/* BIDS (Green) */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {bidsToRender.length === 0 && <div className="text-center text-xs text-gray-600 py-4">No Bids</div>}
                {bidsToRender.map(bid => renderRow(bid, 'bid'))}
            </div>
        </div>
    );
};
