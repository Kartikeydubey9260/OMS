/* eslint-disable @typescript-eslint/no-explicit-any */
import { getStoredAuth, clearStoredAuth } from "../state/auth";

export class ApiClientError extends Error {
    status: number;
    code?: string;
    errors?: Record<string, string[]>;

    constructor(message: string, status: number, code?: string, errors?: Record<string, string[]>) {
        super(message);
        this.name = "ApiClientError";
        this.status = status;
        this.code = code;
        this.errors = errors;
    }
}

export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data: T;
    code?: string;
    meta?: {
        total?: number;
        per_page?: number;
        current_page?: number;
        last_page?: number;
    };
    errors?: Record<string, string[]>;
}

export async function request<T = any>(
    endpoint: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    const auth = getStoredAuth();
    const headers: Record<string, string> = {
        Accept: "application/json",
        ...(options.headers as Record<string, string>),
    };

    if (auth.token) {
        headers["Authorization"] = `Bearer ${auth.token}`;
    }

    if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    const url = endpoint.startsWith("http") ? endpoint : `/api${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

    let res: Response;
    try {
        res = await fetch(url, {
            ...options,
            headers,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Network error";
        throw new ApiClientError(msg, 0);
    }

    if (res.status === 401) {
        clearStoredAuth();
        if (window.location.pathname !== "/login") {
            window.location.href = "/login";
        }
    }

    let json: ApiResponse<T> | null = null;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        try {
            json = (await res.json()) as ApiResponse<T>;
        } catch {
            json = null;
        }
    }

    if (!res.ok) {
        const message = json?.message || `Request failed with status ${res.status}`;
        const code = json?.code;
        const errors = json?.errors;
        throw new ApiClientError(message, res.status, code, errors);
    }

    return json as ApiResponse<T>;
}

export const api = {
    get: <T = any>(url: string, options?: RequestInit) =>
        request<T>(url, { method: "GET", ...options }),
    post: <T = any>(url: string, body?: any, options?: RequestInit) =>
        request<T>(url, {
            method: "POST",
            body: body ? JSON.stringify(body) : undefined,
            ...options,
        }),
    put: <T = any>(url: string, body?: any, options?: RequestInit) =>
        request<T>(url, {
            method: "PUT",
            body: body ? JSON.stringify(body) : undefined,
            ...options,
        }),
    patch: <T = any>(url: string, body?: any, options?: RequestInit) =>
        request<T>(url, {
            method: "PATCH",
            body: body ? JSON.stringify(body) : undefined,
            ...options,
        }),
    delete: <T = any>(url: string, options?: RequestInit) =>
        request<T>(url, { method: "DELETE", ...options }),
};
