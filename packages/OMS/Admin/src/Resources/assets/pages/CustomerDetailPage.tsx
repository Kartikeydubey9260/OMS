import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { formatMoney, formatCount } from "../utils/formatters";

interface CustomerDetail {
    id: number;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    total_orders?: number;
    pending_orders?: number;
    completed_orders?: number;
    cancelled_orders?: number;
    total_order_value?: number | string;
    recent_orders?: {
        id: number;
        order_number: string;
        total: number | string;
        status: string;
        order_date: string;
    }[];
}

export const CustomerDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [customer, setCustomer] = useState<CustomerDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        api.get<CustomerDetail>(`/customers/${id}`)
            .then((res) => setCustomer(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
                <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse" />
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500">
                Customer not found.
            </div>
        );
    }

    const stats = {
        total_orders: Number(customer.total_orders || 0),
        pending_orders: Number(customer.pending_orders || 0),
        completed_orders: Number(customer.completed_orders || 0),
        cancelled_orders: Number(customer.cancelled_orders || 0),
        total_spent: Number(customer.total_order_value || 0),
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
                <div>
                    <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        {customer.name}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">{customer.email} {customer.phone ? `• ${customer.phone}` : ""}</p>
                </div>
                <Link
                    to="/customers"
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50 min-h-[38px] flex items-center"
                >
                    Back to Customers
                </Link>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Total Orders</span>
                    <div data-testid="customer-stat-total" className="text-2xl font-bold text-gray-900 mt-2">
                        {formatCount(stats.total_orders)}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <span className="text-xs font-semibold text-amber-600 uppercase">Pending</span>
                    <div data-testid="customer-stat-pending" className="text-2xl font-bold text-amber-700 mt-2">
                        {formatCount(stats.pending_orders)}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <span className="text-xs font-semibold text-emerald-600 uppercase">Completed</span>
                    <div data-testid="customer-stat-completed" className="text-2xl font-bold text-emerald-700 mt-2">
                        {formatCount(stats.completed_orders)}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                    <span className="text-xs font-semibold text-rose-600 uppercase">Cancelled</span>
                    <div data-testid="customer-stat-cancelled" className="text-2xl font-bold text-rose-700 mt-2">
                        {formatCount(stats.cancelled_orders)}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 col-span-2 md:col-span-1">
                    <span className="text-xs font-semibold text-indigo-600 uppercase">Total Spent</span>
                    <div data-testid="customer-stat-value" className="text-2xl font-bold text-indigo-700 mt-2">
                        {formatMoney(stats.total_spent)}
                    </div>
                </div>
            </div>

            {/* Recent Orders Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900">Recent Customer Orders</h2>
                <div data-testid="customer-recent-orders" className="overflow-x-auto">
                    {(customer.recent_orders || []).length === 0 ? (
                        <div className="text-sm text-gray-500 py-4">No recent orders for this customer.</div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                                <tr>
                                    <th scope="col" className="px-4 py-2 text-left">Order #</th>
                                    <th scope="col" className="px-4 py-2 text-left">Date</th>
                                    <th scope="col" className="px-4 py-2 text-left">Status</th>
                                    <th scope="col" className="px-4 py-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {customer.recent_orders?.map((ro) => (
                                    <tr key={ro.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-semibold text-indigo-600">
                                            <Link to={`/orders/${ro.id}`} className="hover:underline">
                                                {ro.order_number}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">{ro.order_date}</td>
                                        <td className="px-4 py-3 capitalize">{ro.status}</td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                                            {formatMoney(ro.total)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
