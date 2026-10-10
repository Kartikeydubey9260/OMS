import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/auth";
import { api } from "../api/client";

interface Customer {
    id: number;
    name: string;
    email: string;
    phone?: string;
    orders_count?: number;
    created_at: string;
}

export const CustomersListPage: React.FC = () => {
    const { hasRole } = useAuth();
    const canCreate = hasRole(["admin", "super-admin", "manager"]);

    const [search, setSearch] = useState("");
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCustomers = async (query = "") => {
        setLoading(true);
        try {
            const url = query.trim()
                ? `/customers?search=${encodeURIComponent(query.trim())}`
                : "/customers";
            const res = await api.get(url);
            setCustomers(res.data || []);
        } catch {
            // Error handled
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCustomers(search);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    Customers Directory
                </h1>
                {canCreate && (
                    <Link
                        to="/customers/new"
                        data-testid="customer-new"
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 min-h-[38px]"
                    >
                        + New Customer
                    </Link>
                )}
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <label htmlFor="customers-search" className="block text-xs font-semibold text-gray-500 mb-1">
                    Search Customers
                </label>
                <input
                    id="customers-search"
                    type="text"
                    data-testid="customers-search"
                    placeholder="Search by name, email or phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                />
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                </div>
            ) : customers.length === 0 ? (
                <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-100">
                    No customers found.
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left">Customer Name</th>
                                <th scope="col" className="px-6 py-3 text-left">Email</th>
                                <th scope="col" className="px-6 py-3 text-left">Phone</th>
                                <th scope="col" className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {customers.map((c) => (
                                <tr key={c.id} data-testid="customer-row" className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4 font-semibold text-gray-900">
                                        <Link to={`/customers/${c.id}`} className="hover:underline text-indigo-600">
                                            {c.name}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{c.email}</td>
                                    <td className="px-6 py-4 text-gray-500">{c.phone || "—"}</td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            to={`/customers/${c.id}`}
                                            className="text-indigo-600 hover:text-indigo-900 font-medium min-h-[36px] inline-flex items-center px-2 py-1"
                                        >
                                            View Details
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
