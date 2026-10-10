import React, { useState, useEffect } from "react";
import { useAuth } from "../state/auth";
import { api } from "../api/client";
import { ForbiddenPage } from "./ForbiddenPage";

interface UserItem {
    id: number;
    name: string;
    email: string;
    role: string;
    status: string;
    created_at: string;
}

export const UsersPage: React.FC = () => {
    const { hasRole } = useAuth();
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);

    const isAdmin = hasRole(["admin", "super-admin"]);

    useEffect(() => {
        if (!isAdmin) return;
        setLoading(true);
        api.get<UserItem[]>("/users")
            .then((res) => setUsers(res.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [isAdmin]);

    if (!isAdmin) {
        return <ForbiddenPage />;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    User Management
                </h1>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left">Name</th>
                                <th scope="col" className="px-6 py-3 text-left">Email</th>
                                <th scope="col" className="px-6 py-3 text-left">Role</th>
                                <th scope="col" className="px-6 py-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {users.map((u) => (
                                <tr key={u.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-semibold text-gray-900">{u.name}</td>
                                    <td className="px-6 py-4 text-gray-600">{u.email}</td>
                                    <td className="px-6 py-4 capitalize font-medium text-indigo-600">{u.role}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-emerald-100 text-emerald-800">
                                            {u.status || "active"}
                                        </span>
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
