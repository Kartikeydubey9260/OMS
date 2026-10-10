import React, { useState, useEffect } from "react";
import { useAuth } from "../state/auth";
import { api } from "../api/client";
import { ForbiddenPage } from "./ForbiddenPage";

interface AuditLogItem {
    id: number;
    action: string;
    auditable_type: string;
    auditable_id: number;
    user?: { name: string };
    ip_address?: string;
    created_at: string;
}

export const AuditLogsPage: React.FC = () => {
    const { hasRole } = useAuth();
    const [logs, setLogs] = useState<AuditLogItem[]>([]);
    const [loading, setLoading] = useState(true);

    const isAdmin = hasRole(["admin", "super-admin"]);

    useEffect(() => {
        if (!isAdmin) return;
        setLoading(true);
        api.get<AuditLogItem[]>("/audit-logs")
            .then((res) => setLogs(res.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [isAdmin]);

    if (!isAdmin) {
        return <ForbiddenPage />;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 overflow-x-hidden">
            <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                System Audit Logs
            </h1>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left">Action</th>
                                <th scope="col" className="px-6 py-3 text-left">Entity</th>
                                <th scope="col" className="px-6 py-3 text-left">User</th>
                                <th scope="col" className="px-6 py-3 text-left">IP Address</th>
                                <th scope="col" className="px-6 py-3 text-left">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {logs.map((l) => (
                                <tr key={l.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-mono font-bold text-xs text-indigo-600 uppercase">
                                        {l.action}
                                    </td>
                                    <td className="px-6 py-4 text-gray-700">
                                        {l.auditable_type.split("\\").pop()} #{l.auditable_id}
                                    </td>
                                    <td className="px-6 py-4 text-gray-900 font-medium">
                                        {l.user?.name || "System"}
                                    </td>
                                    <td className="px-6 py-4 text-xs font-mono text-gray-500">
                                        {l.ip_address || "—"}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-400">
                                        {new Date(l.created_at).toLocaleString()}
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
