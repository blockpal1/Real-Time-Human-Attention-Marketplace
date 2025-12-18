import React, { useEffect, useState } from 'react';
import { wsClient } from '../services/wsClient';
import { api } from '../services/api';

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
    const [fillingOrder, setFillingOrder] = useState<string | null>(null);

    // Handle filling an x402 order
    const handleFillOrder = async (order: Order) => {
        // Only allow filling x402 orders (id starts with tx hash)
        if (order.id.startsWith('agg_')) return; // Skip aggregated rows

        try {
            setFillingOrder(order.id);
            await api.fillX402Order(order.id);

            // Remove from local state immediately
            setBids(prev => prev.filter(b => b.id !== order.id));
            console.log(`[OrderBook] Filled order: ${order.id.slice(0, 16)}...`);
        } catch (error: any) {
            console.error('Failed to fill order:', error.message);
            alert(`Failed to fill order: ${error.message}`);
        } finally {
            setFillingOrder(null);
        }
    };

    useEffect(() => {
        // Initial Fetch
        const fetchState = async () => {
            try {
                const [activeBids, activeAsks, x402Data] = await Promise.all([
                    api.getActiveBids(),
                    api.getActiveAsks(),
                    api.getX402Orders()
                ]);

                // Legacy bids from database
                const legacyBids = activeBids.map((b: any) => ({
                    id: b.id,
                    price: b.maxPricePerSecond / 1_000_000,
                    size: b.durationPerUser,
                    quantity: b.targetQuantity,
                    total: (b.maxPricePerSecond / 1_000_000) * b.durationPerUser * b.targetQuantity,
                    type: 'bid' as const
                }));

                // x402 orders from in-memory store
                const x402Bids = (x402Data.orders || []).map((o: any) => ({
                    id: o.tx_hash,
                    price: o.bid_per_second,
                    size: o.duration,
                    quantity: o.quantity,
                    total: o.total_escrow,
                    type: 'bid' as const
                }));

                // Merge both sources
                setBids([...legacyBids, ...x402Bids].sort((a, b) => b.price - a.price));

                setAsks(activeAsks.map((a: any) => ({
                    id: a.id,
                    price: a.priceFloor / 1_000_000,
                    size: 60, // Default for sessions
                    quantity: 1,
                    total: (a.priceFloor / 1_000_000) * 60,
                    type: 'ask'
                })));
            } catch (e) {
                console.error("Failed to load order book:", e);
            }
        };
        fetchState();

        const unsubBid = wsClient.subscribe('BID_CREATED', (data: any) => {
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
                id: data.bidId || data.id,
                price: price, // Normalized price
                size: duration,
                quantity: quantity,
                total: price * duration * quantity,
                type: 'bid'
            };

            if (!newOrder.id) return; // Ignore if no ID

            setBids(prev => {
                const exists = prev.find(o => o.id === newOrder.id);
                if (exists) {
                    return prev.map(o => o.id === newOrder.id ? newOrder : o);
                }
                const updated = [...prev, newOrder].sort((a, b) => b.price - a.price).slice(0, 50);
                return updated;
            });
        });

        // Event: BID_UPDATED (Partial Fill)
        const unsubBidUpdate = wsClient.subscribe('BID_UPDATED', (data: any) => {
            setBids(prev => prev.map(o => {
                if (o.id === data.bidId) {
                    return {
                        ...o,
                        quantity: data.remainingQuantity,
                        total: o.price * o.size * data.remainingQuantity
                    };
                }
                return o;
            }));
        });

        // Event: BID_FILLED (Remove)
        const unsubBidFilled = wsClient.subscribe('BID_FILLED', (data: any) => {
            setBids(prev => prev.filter(o => o.id !== data.bidId));
        });

        const unsubAsk = wsClient.subscribe('ASK_CREATED', (data: any) => {
            console.log("OrderBook received ASK_CREATED:", data);
            let price = 0;
            if (data.pricePerSecond) {
                // Asks come in as micros
                price = data.pricePerSecond / 1_000_000;
            }

            const newOrder: Order = {
                id: data.id, // Strict ID
                price: price,
                size: 60,
                quantity: 1,
                total: price * 60,
                type: 'ask'
            };

            if (!newOrder.id) return;

            setAsks(prev => {
                const exists = prev.find(o => o.id === newOrder.id);
                if (exists) return prev;
                return [...prev, newOrder];
            });
        });

        // Event: ASK_MATCHED (Remove)
        const unsubAskMatched = wsClient.subscribe('ASK_MATCHED', (data: any) => {
            setAsks(prev => prev.filter(o => o.id !== data.askId));
        });

        // Event: ASK_CANCELLED (Remove)
        const unsubAskCancelled = wsClient.subscribe('ASK_CANCELLED', (data: any) => {
            console.log("OrderBook received ASK_CANCELLED:", data);
            setAsks(prev => prev.filter(o => o.id !== data.id));
        });

        return () => {
            unsubBid();
            unsubBidUpdate();
            unsubBidFilled();
            unsubAsk();
            unsubAskMatched();
            unsubAskCancelled();
        };
    }, []);

    const renderRow = (order: Order, type: 'bid' | 'ask') => {
        const depthPercent = Math.min(100, (order.quantity / 50) * 100); // Visualizing based on quantity depth
        const tvps = order.price * order.quantity;
        const isFilling = fillingOrder === order.id;
        const isX402Order = !order.id.startsWith('agg_') && type === 'bid';

        const colorClass = type === 'bid' ? 'text-[#0EA5E9]' : 'text-white';
        const bgClass = type === 'bid' ? 'bg-[#0EA5E9]/10' : 'bg-white/10';

        return (
            <div
                key={order.id}
                className={`relative grid grid-cols-4 px-2 py-1 text-sm font-mono cursor-pointer hover:bg-white/5 transition-colors items-center ${isFilling ? 'opacity-50' : ''} ${isX402Order ? 'hover:bg-[#0EA5E9]/20' : ''}`}
                onClick={() => isX402Order && !isFilling && handleFillOrder(order)}
                title={isX402Order ? 'Click to fill this order' : ''}
            >
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

    // Aggregation Logic for DISPLAY ONLY
    // Note: State updates (BID_UPDATED, etc.) operate on raw `bids`/`asks` arrays with real IDs
    const aggregateForDisplay = (orders: Order[]) => {
        const groups = new Map<string, { quantity: number; total: number; size: number; price: number; type: 'bid' | 'ask' }>();
        orders.forEach(o => {
            const priceKey = o.price.toFixed(4);
            const existing = groups.get(priceKey);
            if (existing) {
                existing.quantity += o.quantity;
                existing.total += o.total;
                existing.size += o.size;
            } else {
                groups.set(priceKey, {
                    price: o.price,
                    quantity: o.quantity,
                    total: o.total,
                    size: o.size,
                    type: o.type
                });
            }
        });
        return Array.from(groups.entries()).map(([priceKey, agg]) => ({
            id: `agg_${priceKey}`,
            price: agg.price,
            size: agg.size,
            quantity: agg.quantity,
            total: agg.total,
            type: agg.type
        }));
    };

    const aggregatedAsks = aggregateForDisplay(filteredAsks);
    const aggregatedBids = aggregateForDisplay(filteredBids);

    const asksToRender = aggregatedAsks.sort((a, b) => b.price - a.price).slice(0, 15);
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
                <span className={`text-lg font-bold font-mono tracking-wider ${lastPrice > 0 ? 'text-[#0EA5E9]' : 'text-gray-600'}`}>
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
