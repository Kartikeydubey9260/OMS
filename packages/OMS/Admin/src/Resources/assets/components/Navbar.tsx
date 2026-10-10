import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../state/auth";
import { api } from "../api/client";

interface NotificationItem {
    id: string;
    type: string;
    data: {
        message?: string;
        order_id?: number;
        order_number?: string;
        action?: string;
        [key: string]: unknown;
    };
    read_at: string | null;
    created_at: string;
}

export const Navbar: React.FC = () => {
    const { user, clearAuth } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [mobileOpen, setMobileOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    useEffect(() => {
        if (!user) return;
        const fetchNotifications = async () => {
            try {
                const countRes = await api.get<{ count?: number } | number>("/notifications/unread-count");
                const countVal = typeof countRes.data === "object" && countRes.data !== null && "count" in countRes.data
                    ? countRes.data.count
                    : countRes.data ?? 0;
                setUnreadCount(Number(countVal));

                const listRes = await api.get<NotificationItem[]>("/notifications?unread=1");
                setNotifications(listRes.data || []);
            } catch {
                // Ignore background error
            }
        };

        fetchNotifications();
        const interval = setInterval(fetchNotifications, 15000);
        return () => clearInterval(interval);
    }, [user, location.pathname]);

    const handleLogout = async () => {
        try {
            await api.post("/logout");
        } catch {
            // Ignore
        } finally {
            clearAuth();
            navigate("/login");
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.post("/notifications/read-all");
            setUnreadCount(0);
            setNotifications((prev) =>
                prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
            );
        } catch {
            // Ignore
        }
    };

    const handleNotificationClick = async (notif: NotificationItem) => {
        try {
            if (!notif.read_at) {
                await api.post(`/notifications/${notif.id}/read`);
                setUnreadCount((c) => Math.max(0, c - 1));
            }
        } catch {
            // Ignore
        }
        setNotifOpen(false);
        if (notif.data?.order_id) {
            navigate(`/orders/${notif.data.order_id}`);
        }
    };

    const isAdmin = user?.role === "admin" || user?.role === "super-admin";
    const isManager = user?.role === "manager";

    // Nav permissions per spec & test contracts:
    const showDashboard = isAdmin || isManager;
    const showOrders = true;
    const showCustomers = true;
    const showProducts = true;
    const showUsers = isAdmin;
    const showAudit = isAdmin;

    const navLinks = [
        showDashboard && { to: "/dashboard", label: "Dashboard", testId: "nav-dashboard" },
        showOrders && { to: "/orders", label: "Orders", testId: "nav-orders" },
        showCustomers && { to: "/customers", label: "Customers", testId: "nav-customers" },
        showProducts && { to: "/products", label: "Products", testId: "nav-products" },
        showUsers && { to: "/users", label: "Users", testId: "nav-users" },
        showAudit && { to: "/audit-logs", label: "Audit Logs", testId: "nav-audit" },
    ].filter(Boolean) as { to: string; label: string; testId: string }[];

    return (
        <header className="bg-slate-900 text-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Brand & Mobile Hamburger */}
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            data-testid="nav-toggle"
                            aria-label="Toggle navigation"
                            onClick={() => setMobileOpen((o) => !o)}
                            className="md:hidden p-2 rounded-md text-gray-500 hover:text-white hover:bg-slate-800 focus:outline-none min-h-[38px] min-w-[38px] flex items-center justify-center"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <Link to={showDashboard ? "/dashboard" : "/orders"} className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                            <span className="bg-indigo-600 px-2 py-0.5 rounded text-sm font-black">OMS</span>
                            <span>Enterprise</span>
                        </Link>
                    </div>

                    {/* Desktop Navigation Links */}
                    <nav className="hidden md:flex items-center space-x-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.to}
                                to={link.to}
                                data-testid={mobileOpen ? undefined : link.testId}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                    location.pathname.startsWith(link.to)
                                        ? "bg-slate-800 text-white"
                                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Right side: Notifications & User Menu */}
                    <div className="flex items-center space-x-3">
                        {/* Notification Bell */}
                        <div className="relative">
                            <button
                                type="button"
                                data-testid="notification-bell"
                                aria-label="Notifications"
                                onClick={() => {
                                    setNotifOpen((o) => !o);
                                    setUserMenuOpen(false);
                                }}
                                className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full focus:outline-none min-h-[38px] min-w-[38px] flex items-center justify-center"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                {unreadCount > 0 && (
                                    <span
                                        data-testid="notification-badge"
                                        className="absolute top-1 right-1 bg-red-600 text-white text-xs font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center"
                                    >
                                        {unreadCount}
                                    </span>
                                )}
                            </button>

                            {/* Notifications Dropdown */}
                            {notifOpen && (
                                <div className="absolute right-0 mt-2 w-80 bg-white text-gray-900 rounded-lg shadow-2xl py-2 z-50 border border-gray-200">
                                    <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                                        <span className="font-semibold text-sm">Notifications</span>
                                        <button
                                            type="button"
                                            data-testid="notification-mark-all"
                                            onClick={handleMarkAllRead}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                        >
                                            Mark all as read
                                        </button>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                                        {notifications.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-gray-500">No notifications</div>
                                        ) : (
                                            notifications.map((n) => (
                                                <div
                                                    key={n.id}
                                                    data-testid="notification-item"
                                                    onClick={() => handleNotificationClick(n)}
                                                    className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition ${
                                                        !n.read_at ? "bg-indigo-50/50 font-semibold" : ""
                                                    }`}
                                                >
                                                    <div className="text-gray-900">
                                                        {n.data?.message || `Order ${n.data?.order_number || ""} ${n.data?.action || "updated"}`}
                                                    </div>
                                                    <div className="text-gray-500 text-[10px] mt-1">
                                                        {new Date(n.created_at).toLocaleString()}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* User Profile / Menu */}
                        <div className="relative">
                            <button
                                type="button"
                                data-testid="user-menu"
                                onClick={() => {
                                    setUserMenuOpen((o) => !o);
                                    setNotifOpen(false);
                                }}
                                className="flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white px-2 py-1.5 rounded-md hover:bg-slate-800 focus:outline-none min-h-[38px]"
                            >
                                <span className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center font-bold text-xs uppercase">
                                    {user?.name?.charAt(0) || "U"}
                                </span>
                                <span>{user?.name || "User"}</span>
                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* User Menu Dropdown */}
                            {userMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-md shadow-xl py-1 z-50 border border-gray-200">
                                    <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-500">
                                        Signed in as <span className="font-semibold text-gray-700 capitalize">{user?.role}</span>
                                    </div>
                                    <button
                                        type="button"
                                        data-testid="logout-button"
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        Log out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation Drawer */}
                {mobileOpen && (
                    <nav className="md:hidden pt-2 pb-4 space-y-1 border-t border-slate-800">
                        {navLinks.map((link) => (
                            <Link
                                key={link.to}
                                to={link.to}
                                data-testid={link.testId}
                                onClick={() => setMobileOpen(false)}
                                className={`block px-3 py-2 rounded-md text-base font-medium ${
                                    location.pathname.startsWith(link.to)
                                        ? "bg-slate-800 text-white"
                                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                )}
            </div>
        </header>
    );
};
