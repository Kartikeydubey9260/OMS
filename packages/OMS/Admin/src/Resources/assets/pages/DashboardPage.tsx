import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { formatMoney, formatCount } from "../utils/formatters";

interface SummaryData {
    total_orders: number;
    pending_orders: number;
    confirmed_orders: number;
    processing_orders: number;
    ready_orders?: number;
    completed_orders: number;
    cancelled_orders: number;
    total_revenue: number;
    average_order_value: number;
    total_customers: number;
    total_products: number;
}

interface StatusDistributionItem {
    status: string;
    count: number;
}

interface RevenueTrendItem {
    label: string;
    revenue: number;
}

export const DashboardPage: React.FC = () => {
    const [summary, setSummary] = useState<SummaryData | null>(null);
    const [distribution, setDistribution] = useState<StatusDistributionItem[]>([]);
    const [trend, setTrend] = useState<RevenueTrendItem[]>([]);
    const [period, setPeriod] = useState<"day" | "week" | "month">("day");

    const fetchSummaryAndDist = async () => {
        try {
            const [sumRes, distRes] = await Promise.all([
                api.get<SummaryData>("/dashboard/summary"),
                api.get<StatusDistributionItem[]>("/dashboard/status-distribution"),
            ]);
            setSummary(sumRes.data);
            setDistribution(distRes.data || []);
        } catch {
            // Error handled
        }
    };

    const fetchTrend = async (p: "day" | "week" | "month") => {
        try {
            const res = await api.get<RevenueTrendItem[]>(`/dashboard/revenue-trend?period=${p}`);
            setTrend(res.data || []);
        } catch {
            // Error handled
        }
    };

    useEffect(() => {
        Promise.all([fetchSummaryAndDist(), fetchTrend("day")]);
    }, []);

    const handlePeriodChange = (newPeriod: "day" | "week" | "month") => {
        setPeriod(newPeriod);
        fetchTrend(newPeriod);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    Dashboard Overview
                </h1>
                <div className="text-sm text-gray-500">Real-time Operations & Analytics</div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Orders</span>
                    <span data-testid="stat-total-orders" className="text-2xl font-bold text-gray-900 mt-2">
                        {summary ? formatCount(summary.total_orders) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending</span>
                    <span data-testid="stat-pending" className="text-2xl font-bold text-amber-700 mt-2">
                        {summary ? formatCount(summary.pending_orders) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Confirmed</span>
                    <span data-testid="stat-confirmed" className="text-2xl font-bold text-blue-700 mt-2">
                        {summary ? formatCount(summary.confirmed_orders) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Processing</span>
                    <span data-testid="stat-processing" className="text-2xl font-bold text-purple-700 mt-2">
                        {summary ? formatCount(summary.processing_orders) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Completed</span>
                    <span data-testid="stat-completed" className="text-2xl font-bold text-emerald-700 mt-2">
                        {summary ? formatCount(summary.completed_orders) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Cancelled</span>
                    <span data-testid="stat-cancelled" className="text-2xl font-bold text-rose-700 mt-2">
                        {summary ? formatCount(summary.cancelled_orders) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Customers</span>
                    <span data-testid="stat-customers" className="text-2xl font-bold text-gray-900 mt-2">
                        {summary ? formatCount(summary.total_customers) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Products</span>
                    <span data-testid="stat-products" className="text-2xl font-bold text-gray-900 mt-2">
                        {summary ? formatCount(summary.total_products) : "0"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between md:col-span-2">
                    <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Total Revenue</span>
                    <span data-testid="stat-revenue" className="text-2xl font-bold text-indigo-700 mt-2">
                        {summary ? formatMoney(summary.total_revenue) : "$0.00"}
                    </span>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between md:col-span-2 lg:col-span-2">
                    <span className="text-xs font-semibold text-cyan-600 uppercase tracking-wider">Avg Order Value</span>
                    <span data-testid="stat-avg" className="text-2xl font-bold text-cyan-700 mt-2">
                        {summary ? formatMoney(summary.average_order_value) : "$0.00"}
                    </span>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Status Distribution */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Orders Status Distribution</h2>
                    <div data-testid="chart-status" className="w-full min-h-[260px] flex flex-col justify-center">
                        <div className="space-y-3">
                            {distribution.map((item) => {
                                const total = summary?.total_orders || 1;
                                const pct = Math.round((item.count / total) * 100) || 0;
                                return (
                                    <div key={item.status} className="space-y-1">
                                        <div className="flex justify-between text-xs font-semibold">
                                            <span className="capitalize text-gray-700">{item.status}</span>
                                            <span className="text-gray-500">{formatCount(item.count)} ({pct}%)</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                            <div
                                                className={`h-3 rounded-full transition-all duration-500 ${
                                                    item.status === "completed"
                                                        ? "bg-emerald-500"
                                                        : item.status === "cancelled"
                                                        ? "bg-rose-500"
                                                        : item.status === "pending"
                                                        ? "bg-amber-500"
                                                        : item.status === "confirmed"
                                                        ? "bg-blue-500"
                                                        : "bg-purple-500"
                                                }`}
                                                style={{ width: `${Math.max(pct, 2)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Revenue Trend */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <h2 className="text-lg font-bold text-gray-900">Revenue Trend</h2>
                        <div className="inline-flex rounded-md shadow-sm">
                            <button
                                type="button"
                                data-testid="revenue-period-day"
                                onClick={() => handlePeriodChange("day")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-l-md border min-h-[36px] ${
                                    period === "day"
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                }`}
                            >
                                Day
                            </button>
                            <button
                                type="button"
                                data-testid="revenue-period-week"
                                onClick={() => handlePeriodChange("week")}
                                className={`px-3 py-1.5 text-xs font-semibold border-t border-b min-h-[36px] ${
                                    period === "week"
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                }`}
                            >
                                Week
                            </button>
                            <button
                                type="button"
                                data-testid="revenue-period-month"
                                onClick={() => handlePeriodChange("month")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-r-md border min-h-[36px] ${
                                    period === "month"
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                }`}
                            >
                                Month
                            </button>
                        </div>
                    </div>

                    <div data-testid="chart-revenue" className="w-full min-h-[240px] flex items-end gap-2 pt-6">
                        {trend.length === 0 ? (
                            <div className="w-full text-center text-xs text-gray-500 py-12">No trend data available</div>
                        ) : (
                            trend.map((point, idx) => {
                                const maxRev = Math.max(...trend.map((t) => Number(t.revenue)), 1);
                                const heightPct = Math.round((Number(point.revenue) / maxRev) * 100);
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                                        <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                                            {formatMoney(point.revenue)}
                                        </span>
                                        <div
                                            className="w-full bg-indigo-500 hover:bg-indigo-600 rounded-t transition-all"
                                            style={{ height: `${Math.max(heightPct, 6)}%`, minHeight: "8px" }}
                                        />
                                        <span className="text-[10px] text-gray-500 truncate w-full text-center">
                                            {point.label}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
