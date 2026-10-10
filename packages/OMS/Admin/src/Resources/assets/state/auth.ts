import { useState, useEffect } from "react";

export interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    permissions: string[];
    status?: string;
}

export interface AuthState {
    token: string | null;
    user: User | null;
}

const STORAGE_KEY = "oms-auth";

export const getStoredAuth = (): AuthState => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { token: null, user: null };
        const parsed = JSON.parse(raw);
        return {
            token: parsed?.state?.token ?? null,
            user: parsed?.state?.user ?? null,
        };
    } catch {
        return { token: null, user: null };
    }
};

export const setStoredAuth = (token: string, user: User) => {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
            state: { token, user },
            version: 0,
        })
    );
    window.dispatchEvent(new Event("auth-changed"));
};

export const clearStoredAuth = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("auth-changed"));
};

export const useAuth = () => {
    const [auth, setAuth] = useState<AuthState>(getStoredAuth);

    useEffect(() => {
        const handler = () => {
            setAuth(getStoredAuth());
        };
        window.addEventListener("auth-changed", handler);
        window.addEventListener("storage", handler);
        return () => {
            window.removeEventListener("auth-changed", handler);
            window.removeEventListener("storage", handler);
        };
    }, []);

    const hasPermission = (permission: string): boolean => {
        if (!auth.user) return false;
        if (auth.user.role === "admin" || auth.user.role === "super-admin") return true;
        return auth.user.permissions?.includes(permission) ?? false;
    };

    const hasRole = (role: string | string[]): boolean => {
        if (!auth.user) return false;
        if (Array.isArray(role)) return role.includes(auth.user.role);
        return auth.user.role === role;
    };

    return {
        ...auth,
        isAuthenticated: !!auth.token,
        hasPermission,
        hasRole,
        setAuth: setStoredAuth,
        clearAuth: clearStoredAuth,
    };
};
