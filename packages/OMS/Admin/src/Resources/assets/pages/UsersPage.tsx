import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../state/auth";
import { api, ApiClientError } from "../api/client";
import { toast } from "../components/ToastContainer";
import { Modal } from "../components/Modal";
import { ForbiddenPage } from "./ForbiddenPage";

interface UserItem {
    id: number;
    name: string;
    email: string;
    is_active?: boolean | number;
    roles?: { id: number; name: string }[];
    created_at: string;
}

interface RoleItem {
    id: number;
    name: string;
    users_count?: number;
    permissions?: { id: number; name: string }[];
    created_at?: string;
}

interface PermissionItem {
    id: number;
    name: string;
}

const roleOf = (u: UserItem): string => u.roles && u.roles.length > 0 ? u.roles[0].name : "";
const isActive = (u: UserItem): boolean => u.is_active !== false;

export const UsersPage: React.FC = () => {
    const { hasRole } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    const isAdmin = hasRole(["admin", "super-admin"]);

    const searchParam = searchParams.get("search") || "";
    const roleParam = searchParams.get("role") || "";
    const statusParam = searchParams.get("is_active") || "";
    const sortParam = searchParams.get("sort") || "created_at";
    const directionParam = (searchParams.get("direction") as "asc" | "desc") || "desc";
    const pageParam = parseInt(searchParams.get("page") || "1", 10);
    const perPageParam = parseInt(searchParams.get("per_page") || "10", 10);

    const [view, setView] = useState<"users" | "roles">("users");

    const [searchInput, setSearchInput] = useState(searchParam);
    const [roleFilter, setRoleFilter] = useState(roleParam);
    const [statusFilter, setStatusFilter] = useState(statusParam);
    const [sort, setSort] = useState(sortParam);
    const [direction, setDirection] = useState<"asc" | "desc">(directionParam);
    const [page, setPage] = useState(pageParam);
    const [perPage, setPerPage] = useState(perPageParam);

    const [users, setUsers] = useState<UserItem[]>([]);
    const [roles, setRoles] = useState<RoleItem[]>([]);
    const [permissions, setPermissions] = useState<PermissionItem[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rolesLoading, setRolesLoading] = useState(true);
    const [rolesError, setRolesError] = useState<string | null>(null);

    // Create user modal
    const [createOpen, setCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: "",
        email: "",
        password: "",
        role: "staff",
        is_active: true,
    });
    const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
    const [creating, setCreating] = useState(false);

    // Edit user modal
    const [editTarget, setEditTarget] = useState<UserItem | null>(null);
    const [editForm, setEditForm] = useState({
        name: "",
        email: "",
        password: "",
        role: "staff",
        is_active: true,
    });
    const [editErrors, setEditErrors] = useState<Record<string, string>>({});
    const [editing, setEditing] = useState(false);

    // Delete user modal
    const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
    const [deletingUser, setDeletingUser] = useState(false);

    // Role management modals
    const [roleCreateOpen, setRoleCreateOpen] = useState(false);
    const [roleName, setRoleName] = useState("");
    const [roleNameErrors, setRoleNameErrors] = useState<Record<string, string>>({});
    const [roleCreating, setRoleCreating] = useState(false);

    const [roleEditTarget, setRoleEditTarget] = useState<RoleItem | null>(null);
    const [roleEditName, setRoleEditName] = useState("");
    const [roleEditErrors, setRoleEditErrors] = useState<Record<string, string>>({});
    const [roleEditing, setRoleEditing] = useState(false);

    const [roleDeleteTarget, setRoleDeleteTarget] = useState<RoleItem | null>(null);
    const [roleDeleting, setRoleDeleting] = useState(false);

    const [permsTarget, setPermsTarget] = useState<RoleItem | null>(null);
    const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
    const [permDirty, setPermDirty] = useState(false);
    const [savingPerms, setSavingPerms] = useState(false);
    const [permError, setPermError] = useState<string | null>(null);
    const [permStatus, setPermStatus] = useState<string>("");

    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const updateParams = useCallback(
        (updates: Record<string, string | number | undefined>) => {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    Object.entries(updates).forEach(([k, v]) => {
                        if (v === undefined || v === "" || (k === "page" && v === 1)) {
                            next.delete(k);
                        } else {
                            next.set(k, String(v));
                        }
                    });
                    return next;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    const fetchUsers = useCallback(async () => {
        if (!isAdmin) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            const urlSearch = searchParams.get("search") || "";
            if (urlSearch.trim()) params.append("search", urlSearch.trim());
            if (roleFilter) params.append("role", roleFilter);
            if (statusFilter) params.append("is_active", statusFilter);
            if (sort) params.append("sort", sort);
            if (direction) params.append("direction", direction);
            params.append("page", String(page));
            params.append("per_page", String(perPage));

            const res = await api.get(`/users?${params.toString()}`);
            setUsers(res.data || []);
            if (res.meta) {
                setTotalPages(res.meta.last_page || 1);
                setTotal(res.meta.total || 0);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unable to load users.");
        } finally {
            setLoading(false);
        }
    }, [isAdmin, searchParams, roleFilter, statusFilter, sort, direction, page, perPage]);

    const fetchRolesAndPermissions = useCallback(async () => {
        if (!isAdmin) return;
        setRolesLoading(true);
        setRolesError(null);
        try {
            const [rolesRes, permsRes] = await Promise.all([api.get("/roles"), api.get("/permissions")]);
            setRoles((rolesRes.data || []) as RoleItem[]);
            setPermissions((permsRes.data || []) as PermissionItem[]);
        } catch (err: unknown) {
            setRolesError(err instanceof Error ? err.message : "Unable to load roles.");
        } finally {
            setRolesLoading(false);
        }
    }, [isAdmin]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    useEffect(() => {
        fetchRolesAndPermissions();
    }, [fetchRolesAndPermissions]);

    const handleSearchChange = (val: string) => {
        setSearchInput(val);
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setPage(1);
            updateParams({ search: val, page: 1 });
        }, 300);
    };

    const handleSortToggle = (col: string) => {
        let newDir: "asc" | "desc" = "asc";
        if (sort === col) {
            newDir = direction === "asc" ? "desc" : "asc";
        }
        setSort(col);
        setDirection(newDir);
        setPage(1);
        updateParams({ sort: col, direction: newDir, page: 1 });
    };

    const openCreateModal = () => {
        setCreateForm({ name: "", email: "", password: "", role: roles[0]?.name || "staff", is_active: true });
        setCreateErrors({});
        setCreateOpen(true);
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateErrors({});

        const localErrors: Record<string, string> = {};
        if (!createForm.name.trim()) localErrors.name = "User name is required.";
        if (!createForm.email.trim()) localErrors.email = "User email is required.";
        if (!createForm.password || createForm.password.length < 6) localErrors.password = "Password must be at least 6 characters.";
        if (!createForm.role) localErrors.role = "Role is required.";

        if (Object.keys(localErrors).length > 0) {
            setCreateErrors(localErrors);
            return;
        }

        setCreating(true);
        try {
            await api.post("/users", {
                name: createForm.name.trim(),
                email: createForm.email.trim(),
                password: createForm.password,
                role: createForm.role,
                is_active: createForm.is_active,
            });
            toast.success("User created successfully.");
            setCreateOpen(false);
            setCreateForm({ name: "", email: "", password: "", role: "staff", is_active: true });
            await fetchUsers();
        } catch (err: unknown) {
            if (err instanceof ApiClientError && err.errors) {
                const errMap: Record<string, string> = {};
                Object.entries(err.errors).forEach(([k, v]) => {
                    errMap[k] = Array.isArray(v) ? v[0] : String(v);
                });
                setCreateErrors(errMap);
            } else {
                setCreateErrors({ general: err instanceof Error ? err.message : "Failed to create user." });
            }
        } finally {
            setCreating(false);
        }
    };

    const openEditModal = (u: UserItem) => {
        setEditTarget(u);
        setEditForm({
            name: u.name,
            email: u.email,
            password: "",
            role: roleOf(u) || "staff",
            is_active: isActive(u),
        });
        setEditErrors({});
    };

    const handleEditUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget) return;
        setEditErrors({});

        const localErrors: Record<string, string> = {};
        if (!editForm.name.trim()) localErrors.name = "User name is required.";
        if (!editForm.email.trim()) localErrors.email = "User email is required.";
        if (editForm.password && editForm.password.length < 6) localErrors.password = "Password must be at least 6 characters.";

        if (Object.keys(localErrors).length > 0) {
            setEditErrors(localErrors);
            return;
        }

        setEditing(true);
        try {
            const payload: Record<string, unknown> = {
                name: editForm.name.trim(),
                email: editForm.email.trim(),
                role: editForm.role,
                is_active: editForm.is_active,
            };
            if (editForm.password) payload.password = editForm.password;
            await api.put(`/users/${editTarget.id}`, payload);
            toast.success("User updated successfully.");
            setEditTarget(null);
            await fetchUsers();
        } catch (err: unknown) {
            if (err instanceof ApiClientError && err.errors) {
                const errMap: Record<string, string> = {};
                Object.entries(err.errors).forEach(([k, v]) => {
                    errMap[k] = Array.isArray(v) ? v[0] : String(v);
                });
                setEditErrors(errMap);
            } else {
                setEditErrors({ general: err instanceof Error ? err.message : "Failed to update user." });
            }
        } finally {
            setEditing(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!deleteTarget) return;
        setDeletingUser(true);
        try {
            await api.delete(`/users/${deleteTarget.id}`);
            toast.success("User deleted successfully.");
            setDeleteTarget(null);
            await fetchUsers();
            await fetchRolesAndPermissions();
        } catch (err: unknown) {
            const msg = err instanceof ApiClientError ? err.message : "Unable to delete user.";
            toast.error(msg);
            setDeleteTarget(null);
        } finally {
            setDeletingUser(false);
        }
    };

    const handleCreateRole = async (e: React.FormEvent) => {
        e.preventDefault();
        setRoleNameErrors({});
        if (!roleName.trim()) {
            setRoleNameErrors({ name: "Role name is required." });
            return;
        }
        setRoleCreating(true);
        try {
            await api.post("/roles", { name: roleName.trim() });
            toast.success("Role created successfully.");
            setRoleCreateOpen(false);
            setRoleName("");
            await fetchRolesAndPermissions();
        } catch (err: unknown) {
            if (err instanceof ApiClientError && err.errors) {
                const errMap: Record<string, string> = {};
                Object.entries(err.errors).forEach(([k, v]) => {
                    errMap[k] = Array.isArray(v) ? v[0] : String(v);
                });
                setRoleNameErrors(errMap);
            } else {
                setRoleNameErrors({ general: err instanceof Error ? err.message : "Failed to create role." });
            }
        } finally {
            setRoleCreating(false);
        }
    };

    const openRoleEditModal = (r: RoleItem) => {
        setRoleEditTarget(r);
        setRoleEditName(r.name);
        setRoleEditErrors({});
    };

    const handleEditRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!roleEditTarget) return;
        setRoleEditErrors({});
        if (!roleEditName.trim()) {
            setRoleEditErrors({ name: "Role name is required." });
            return;
        }
        setRoleEditing(true);
        try {
            await api.put(`/roles/${roleEditTarget.id}`, { name: roleEditName.trim() });
            toast.success("Role renamed successfully.");
            setRoleEditTarget(null);
            await fetchRolesAndPermissions();
        } catch (err: unknown) {
            if (err instanceof ApiClientError && err.errors) {
                const errMap: Record<string, string> = {};
                Object.entries(err.errors).forEach(([k, v]) => {
                    errMap[k] = Array.isArray(v) ? v[0] : String(v);
                });
                setRoleEditErrors(errMap);
            } else {
                setRoleEditErrors({ general: err instanceof Error ? err.message : "Failed to rename role." });
            }
        } finally {
            setRoleEditing(false);
        }
    };

    const handleDeleteRole = async () => {
        if (!roleDeleteTarget) return;
        setRoleDeleting(true);
        try {
            await api.delete(`/roles/${roleDeleteTarget.id}`);
            toast.success("Role deleted successfully.");
            setRoleDeleteTarget(null);
            await fetchRolesAndPermissions();
        } catch (err: unknown) {
            const msg = err instanceof ApiClientError ? err.message : "Unable to delete role.";
            toast.error(msg);
            setRoleDeleteTarget(null);
        } finally {
            setRoleDeleting(false);
        }
    };

    const openPermsModal = (r: RoleItem) => {
        setPermsTarget(r);
        setSelectedPerms(new Set((r.permissions || []).map((p) => p.name)));
        setPermDirty(false);
        setPermError(null);
        setPermStatus(`Role "${r.name}" has ${(r.permissions || []).length} permissions selected.`);
    };

    const togglePermission = (name: string) => {
        setSelectedPerms((prev) => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
        setPermDirty(true);
        setPermError(null);
        setPermStatus("");
    };

    const savePermissions = async () => {
        if (!permsTarget) return;
        setSavingPerms(true);
        setPermError(null);
        try {
            const res = await api.put(`/roles/${permsTarget.id}/permissions`, {
                permissions: Array.from(selectedPerms),
            });
            const updated = (res.data || {}) as RoleItem;
            if (updated.permissions) {
                setSelectedPerms(new Set(updated.permissions.map((p) => p.name)));
                setPermStatus(`Role "${updated.name}" has ${updated.permissions.length} permissions selected.`);
            }
            toast.success("Role permissions updated successfully.");
            setPermDirty(false);
            await fetchRolesAndPermissions();
        } catch (err: unknown) {
            const msg =
                err instanceof ApiClientError
                    ? (err.errors?.permissions?.[0] as string) || err.message
                    : "Failed to update role permissions.";
            setPermError(msg);
            toast.error(msg);
        } finally {
            setSavingPerms(false);
        }
    };

    if (!isAdmin) {
        return <ForbiddenPage />;
    }

    const sortMarker = (col: string) =>
        sort === col ? (direction === "asc" ? " ↑" : " ↓") : "";

    const groupedPermissions = permissions.reduce<Record<string, PermissionItem[]>>((acc, p) => {
        const domain = p.name.split(".")[0] || "other";
        if (!acc[domain]) acc[domain] = [];
        acc[domain].push(p);
        return acc;
    }, {});

    const isSystemRole = (r: RoleItem) => r.name === "admin" || r.name === "super-admin";
    const roleDeletable = (r: RoleItem) => !isSystemRole(r) && !(r.users_count && r.users_count > 0);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 data-testid="page-title" className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        User Management
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage accounts, roles and permissions.
                    </p>
                </div>
            </div>

            {/* Section tabs */}
            <div className="flex gap-2 border-b border-gray-200" role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={view === "users"}
                    data-testid="section-tab-users"
                    onClick={() => setView("users")}
                    className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px min-h-[38px] ${
                        view === "users"
                            ? "border-indigo-600 text-indigo-700"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                >
                    Users
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={view === "roles"}
                    data-testid="section-tab-roles"
                    onClick={() => setView("roles")}
                    className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px min-h-[38px] ${
                        view === "roles"
                            ? "border-indigo-600 text-indigo-700"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                >
                    Role Management
                </button>
            </div>

            {view === "users" ? (
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label htmlFor="users-search" className="block text-xs font-semibold text-gray-500 mb-1">
                                Search Users
                            </label>
                            <input
                                id="users-search"
                                type="text"
                                data-testid="users-search"
                                placeholder="Search by name or email..."
                                value={searchInput}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                            />
                        </div>
                        <div>
                            <label htmlFor="users-filter-role" className="block text-xs font-semibold text-gray-500 mb-1">
                                Role
                            </label>
                            <select
                                id="users-filter-role"
                                data-testid="users-filter-role"
                                value={roleFilter}
                                onChange={(e) => {
                                    setRoleFilter(e.target.value);
                                    setPage(1);
                                    updateParams({ role: e.target.value, page: 1 });
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                            >
                                <option value="">All Roles</option>
                                {roles.map((r) => (
                                    <option key={r.id} value={r.name}>
                                        {r.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="users-filter-status" className="block text-xs font-semibold text-gray-500 mb-1">
                                Status
                            </label>
                            <select
                                id="users-filter-status"
                                data-testid="users-filter-status"
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setPage(1);
                                    updateParams({ is_active: e.target.value, page: 1 });
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                            >
                                <option value="">All Statuses</option>
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-end">
                        <button
                            type="button"
                            data-testid="users-new"
                            onClick={openCreateModal}
                            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 min-h-[38px]"
                        >
                            + New User
                        </button>
                    </div>

                    {error && (
                        <div
                            data-testid="users-error"
                            role="alert"
                            className="p-4 rounded-md bg-red-50 border border-red-200 text-red-700 flex items-center justify-between"
                        >
                            <div>
                                <span className="font-bold">Error:</span> {error}
                            </div>
                            <button
                                type="button"
                                data-testid="users-retry"
                                onClick={fetchUsers}
                                className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 min-h-[36px]"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {loading ? (
                        <div data-testid="users-skeleton" className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : users.length === 0 ? (
                        <div
                            data-testid="users-empty"
                            className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-500 font-medium"
                        >
                            No users found.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                            <table data-testid="users-table" className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("name")}
                                            data-testid="users-sort-name"
                                            className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            Name{sortMarker("name")}
                                        </th>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("email")}
                                            data-testid="users-sort-email"
                                            className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            Email{sortMarker("email")}
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Role
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th
                                            scope="col"
                                            onClick={() => handleSortToggle("created_at")}
                                            data-testid="users-sort-created_at"
                                            className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        >
                                            Created{sortMarker("created_at")}
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100 text-sm">
                                    {users.map((u) => (
                                        <tr key={u.id} data-testid="user-row" className="hover:bg-slate-50">
                                            <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">{u.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">{u.email}</td>
                                            <td className="px-6 py-4 whitespace-nowrap capitalize font-medium text-indigo-600">
                                                {roleOf(u) || "—"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                                        isActive(u)
                                                            ? "bg-emerald-100 text-emerald-800"
                                                            : "bg-rose-100 text-rose-800"
                                                    }`}
                                                >
                                                    {isActive(u) ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                                {u.created_at ? new Date(u.created_at).toLocaleDateString("en-US") : "—"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        data-testid="user-edit"
                                                        onClick={() => openEditModal(u)}
                                                        className="text-amber-600 hover:text-amber-800 min-h-[36px] inline-flex items-center px-2 py-1 font-medium"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        data-testid="user-delete"
                                                        onClick={() => setDeleteTarget(u)}
                                                        className="text-rose-600 hover:text-rose-800 min-h-[36px] inline-flex items-center px-2 py-1 font-medium"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div
                        data-testid="users-pagination"
                        className="bg-white px-4 py-3 rounded-xl border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4"
                    >
                        <div className="flex items-center gap-2">
                            <label htmlFor="users-per-page" className="text-xs text-gray-600">Per page:</label>
                            <select
                                id="users-per-page"
                                data-testid="users-per-page"
                                value={perPage}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setPerPage(val);
                                    setPage(1);
                                    updateParams({ per_page: val, page: 1 });
                                }}
                                className="border border-gray-300 rounded px-2 py-1 text-xs min-h-[36px]"
                            >
                                <option value="5">5</option>
                                <option value="10">10</option>
                                <option value="15">15</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                            </select>
                            <span data-testid="users-page-info" className="text-xs text-gray-600 ml-2">
                                Page {page} of {Math.max(totalPages, 1)} ({total} total)
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                data-testid="users-prev"
                                disabled={page <= 1}
                                onClick={() => {
                                    const prevPage = Math.max(1, page - 1);
                                    setPage(prevPage);
                                    updateParams({ page: prevPage });
                                }}
                                className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                data-testid="users-next"
                                disabled={page >= totalPages}
                                onClick={() => {
                                    const nextPage = Math.min(totalPages, page + 1);
                                    setPage(nextPage);
                                    updateParams({ page: nextPage });
                                }}
                                className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-end">
                        <button
                            type="button"
                            data-testid="role-new"
                            onClick={() => {
                                setRoleName("");
                                setRoleNameErrors({});
                                setRoleCreateOpen(true);
                            }}
                            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 min-h-[38px]"
                        >
                            + New Role
                        </button>
                    </div>

                    {rolesError && (
                        <div
                            data-testid="roles-error"
                            role="alert"
                            className="p-4 rounded-md bg-red-50 border border-red-200 text-red-700 flex items-center justify-between"
                        >
                            <div>
                                <span className="font-bold">Error:</span> {rolesError}
                            </div>
                            <button
                                type="button"
                                data-testid="roles-retry"
                                onClick={fetchRolesAndPermissions}
                                className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 min-h-[36px]"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {rolesLoading ? (
                        <div data-testid="roles-skeleton" className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : roles.length === 0 ? (
                        <div
                            data-testid="roles-empty"
                            className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-500 font-medium"
                        >
                            No roles found. Create one to get started.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                            <table data-testid="roles-table" className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Role
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Users
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Permissions
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Created
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100 text-sm">
                                    {roles.map((r) => (
                                        <tr key={r.id} data-testid="role-row" className="hover:bg-slate-50">
                                            <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">{r.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span
                                                    data-testid="role-users-count"
                                                    className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800"
                                                >
                                                    {r.users_count ?? 0}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-gray-600">
                                                <span data-testid="role-perms-count">{r.permissions?.length ?? 0}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                                {r.created_at ? new Date(r.created_at).toLocaleDateString("en-US") : "—"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        data-testid="role-edit"
                                                        disabled={isSystemRole(r)}
                                                        onClick={() => openRoleEditModal(r)}
                                                        title={isSystemRole(r) ? "System roles cannot be renamed" : undefined}
                                                        className="text-amber-600 hover:text-amber-800 min-h-[36px] inline-flex items-center px-2 py-1 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        data-testid="role-permissions"
                                                        onClick={() => openPermsModal(r)}
                                                        className="text-indigo-600 hover:text-indigo-800 min-h-[36px] inline-flex items-center px-2 py-1 font-medium"
                                                    >
                                                        Permissions
                                                    </button>
                                                    <button
                                                        type="button"
                                                        data-testid="role-delete"
                                                        disabled={!roleDeletable(r)}
                                                        onClick={() => setRoleDeleteTarget(r)}
                                                        title={
                                                            isSystemRole(r)
                                                                ? "System roles cannot be deleted"
                                                                : r.users_count && r.users_count > 0
                                                                  ? "Reassign or delete assigned users before deleting this role"
                                                                  : undefined
                                                        }
                                                        className="text-rose-600 hover:text-rose-800 min-h-[36px] inline-flex items-center px-2 py-1 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Create user modal */}
            <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create User">
                <form onSubmit={handleCreateUser} noValidate data-testid="user-create-form" className="space-y-4">
                    {createErrors.general && (
                        <div data-testid="field-error" className="p-3 bg-red-50 text-red-700 rounded-md text-sm font-semibold">
                            {createErrors.general}
                        </div>
                    )}
                    <div>
                        <label htmlFor="user-name" className="block text-sm font-semibold text-gray-700 mb-1">
                            Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="user-name"
                            type="text"
                            data-testid="user-name"
                            value={createForm.name}
                            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                            aria-invalid={!!createErrors.name}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                        {createErrors.name && (
                            <p data-testid="field-error" className="text-xs text-red-600 font-semibold mt-1">
                                {createErrors.name}
                            </p>
                        )}
                    </div>
                    <div>
                        <label htmlFor="user-email" className="block text-sm font-semibold text-gray-700 mb-1">
                            Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="user-email"
                            type="email"
                            data-testid="user-email"
                            value={createForm.email}
                            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                            aria-invalid={!!createErrors.email}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                        {createErrors.email && (
                            <p data-testid="field-error" className="text-xs text-red-600 font-semibold mt-1">
                                {createErrors.email}
                            </p>
                        )}
                    </div>
                    <div>
                        <label htmlFor="user-password" className="block text-sm font-semibold text-gray-700 mb-1">
                            Password <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="user-password"
                            type="password"
                            data-testid="user-password"
                            value={createForm.password}
                            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                            aria-invalid={!!createErrors.password}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                        {createErrors.password && (
                            <p data-testid="field-error" className="text-xs text-red-600 font-semibold mt-1">
                                {createErrors.password}
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="user-role" className="block text-sm font-semibold text-gray-700 mb-1">
                                Role <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="user-role"
                                data-testid="user-role"
                                value={createForm.role}
                                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                            >
                                {roles.map((r) => (
                                    <option key={r.id} value={r.name}>
                                        {r.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <span className="block text-sm font-semibold text-gray-700 mb-1">Status</span>
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 min-h-[38px] cursor-pointer">
                                <input
                                    type="checkbox"
                                    data-testid="user-active"
                                    checked={createForm.is_active}
                                    onChange={(e) => setCreateForm({ ...createForm, is_active: e.target.checked })}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                                />
                                Active
                            </label>
                        </div>
                    </div>
                    <button
                        type="submit"
                        data-testid="user-submit"
                        disabled={creating}
                        className="w-full px-5 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 min-h-[38px] disabled:opacity-50"
                    >
                        {creating ? "Creating..." : "Create User"}
                    </button>
                </form>
            </Modal>

            {/* Edit user modal */}
            <Modal isOpen={editTarget !== null} onClose={() => setEditTarget(null)} title={`Edit User — ${editTarget?.name ?? ""}`}>
                <form onSubmit={handleEditUser} noValidate data-testid="user-edit-form" className="space-y-4">
                    {editErrors.general && (
                        <div data-testid="field-error" className="p-3 bg-red-50 text-red-700 rounded-md text-sm font-semibold">
                            {editErrors.general}
                        </div>
                    )}
                    <div>
                        <label htmlFor="user-edit-name" className="block text-sm font-semibold text-gray-700 mb-1">
                            Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="user-edit-name"
                            type="text"
                            data-testid="user-edit-name"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            aria-invalid={!!editErrors.name}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                        {editErrors.name && (
                            <p data-testid="field-error" className="text-xs text-red-600 font-semibold mt-1">
                                {editErrors.name}
                            </p>
                        )}
                    </div>
                    <div>
                        <label htmlFor="user-edit-email" className="block text-sm font-semibold text-gray-700 mb-1">
                            Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="user-edit-email"
                            type="email"
                            data-testid="user-edit-email"
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            aria-invalid={!!editErrors.email}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                        {editErrors.email && (
                            <p data-testid="field-error" className="text-xs text-red-600 font-semibold mt-1">
                                {editErrors.email}
                            </p>
                        )}
                    </div>
                    <div>
                        <label htmlFor="user-edit-password" className="block text-sm font-semibold text-gray-700 mb-1">
                            New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                        </label>
                        <input
                            id="user-edit-password"
                            type="password"
                            data-testid="user-edit-password"
                            value={editForm.password}
                            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                            aria-invalid={!!editErrors.password}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                        {editErrors.password && (
                            <p data-testid="field-error" className="text-xs text-red-600 font-semibold mt-1">
                                {editErrors.password}
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="user-edit-role" className="block text-sm font-semibold text-gray-700 mb-1">
                                Role <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="user-edit-role"
                                data-testid="user-edit-role"
                                value={editForm.role}
                                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                            >
                                {roles.map((r) => (
                                    <option key={r.id} value={r.name}>
                                        {r.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <span className="block text-sm font-semibold text-gray-700 mb-1">Status</span>
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 min-h-[38px] cursor-pointer">
                                <input
                                    type="checkbox"
                                    data-testid="user-edit-active"
                                    checked={editForm.is_active}
                                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                                />
                                Active
                            </label>
                        </div>
                    </div>
                    <button
                        type="submit"
                        data-testid="user-edit-submit"
                        disabled={editing}
                        className="w-full px-5 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 min-h-[38px] disabled:opacity-50"
                    >
                        {editing ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </Modal>

            {/* Delete user confirm */}
            <Modal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Delete User">
                <p className="text-sm text-gray-600">
                    Are you sure you want to delete{" "}
                    <span className="font-semibold text-gray-900">{deleteTarget?.name}</span> (
                    <span className="font-mono">{deleteTarget?.email}</span>)? This will deactivate the
                    account immediately.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => setDeleteTarget(null)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50 min-h-[38px]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        data-testid="user-delete-confirm"
                        disabled={deletingUser}
                        onClick={handleDeleteUser}
                        className="px-4 py-2 bg-rose-600 text-white rounded-md text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 min-h-[38px]"
                    >
                        {deletingUser ? "Deleting..." : "Delete User"}
                    </button>
                </div>
            </Modal>

            {/* Create role modal */}
            <Modal isOpen={roleCreateOpen} onClose={() => setRoleCreateOpen(false)} title="Create Role">
                <form onSubmit={handleCreateRole} noValidate data-testid="role-create-form" className="space-y-4">
                    {roleNameErrors.general && (
                        <div data-testid="field-error" className="p-3 bg-red-50 text-red-700 rounded-md text-sm font-semibold">
                            {roleNameErrors.general}
                        </div>
                    )}
                    <div>
                        <label htmlFor="role-create-name" className="block text-sm font-semibold text-gray-700 mb-1">
                            Role Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="role-create-name"
                            type="text"
                            data-testid="role-create-name"
                            placeholder="e.g. support"
                            value={roleName}
                            onChange={(e) => setRoleName(e.target.value)}
                            aria-invalid={!!roleNameErrors.name}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                        {roleNameErrors.name && (
                            <p data-testid="field-error" className="text-xs text-red-600 font-semibold mt-1">
                                {roleNameErrors.name}
                            </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                            New roles have no permissions. Assign them via the Permissions action.
                        </p>
                    </div>
                    <button
                        type="submit"
                        data-testid="role-create-submit"
                        disabled={roleCreating}
                        className="w-full px-5 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 min-h-[38px] disabled:opacity-50"
                    >
                        {roleCreating ? "Creating..." : "Create Role"}
                    </button>
                </form>
            </Modal>

            {/* Edit role modal */}
            <Modal isOpen={roleEditTarget !== null} onClose={() => setRoleEditTarget(null)} title={`Edit Role — ${roleEditTarget?.name ?? ""}`}>
                <form onSubmit={handleEditRole} noValidate data-testid="role-edit-form" className="space-y-4">
                    {roleEditErrors.general && (
                        <div data-testid="field-error" className="p-3 bg-red-50 text-red-700 rounded-md text-sm font-semibold">
                            {roleEditErrors.general}
                        </div>
                    )}
                    <div>
                        <label htmlFor="role-edit-name" className="block text-sm font-semibold text-gray-700 mb-1">
                            Role Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="role-edit-name"
                            type="text"
                            data-testid="role-edit-name"
                            value={roleEditName}
                            onChange={(e) => setRoleEditName(e.target.value)}
                            aria-invalid={!!roleEditErrors.name}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[38px] text-gray-900"
                        />
                        {roleEditErrors.name && (
                            <p data-testid="field-error" className="text-xs text-red-600 font-semibold mt-1">
                                {roleEditErrors.name}
                            </p>
                        )}
                    </div>
                    <button
                        type="submit"
                        data-testid="role-edit-submit"
                        disabled={roleEditing}
                        className="w-full px-5 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 min-h-[38px] disabled:opacity-50"
                    >
                        {roleEditing ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </Modal>

            {/* Delete role confirm */}
            <Modal isOpen={roleDeleteTarget !== null} onClose={() => setRoleDeleteTarget(null)} title="Delete Role">
                <p className="text-sm text-gray-600">
                    Are you sure you want to delete role{" "}
                    <span className="font-semibold text-gray-900">{roleDeleteTarget?.name}</span>? Users
                    holding this role must be reassigned first.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => setRoleDeleteTarget(null)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-50 min-h-[38px]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        data-testid="role-delete-confirm"
                        disabled={roleDeleting}
                        onClick={handleDeleteRole}
                        className="px-4 py-2 bg-rose-600 text-white rounded-md text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 min-h-[38px]"
                    >
                        {roleDeleting ? "Deleting..." : "Delete Role"}
                    </button>
                </div>
            </Modal>

            {/* Permissions modal */}
            <Modal isOpen={permsTarget !== null} onClose={() => setPermsTarget(null)} title={`Permissions — ${permsTarget?.name ?? ""}`}>
                <div data-testid="role-permissions-modal" className="space-y-4">
                    <p className="text-xs text-gray-500">
                        Assign permission sets for this role. Changes apply immediately.
                    </p>

                    {permError && (
                        <div data-testid="role-permissions-error" className="p-3 bg-red-50 text-red-700 rounded-md text-sm font-semibold">
                            {permError}
                        </div>
                    )}

                    <div data-testid="role-permissions-list" className="space-y-4 max-h-96 overflow-y-auto pr-1">
                        {Object.entries(groupedPermissions).map(([domain, perms]) => (
                            <div key={domain}>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">{domain}</p>
                                <div className="space-y-1.5">
                                    {perms.map((p) => (
                                        <label
                                            key={p.id}
                                            className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                data-testid={`permission-checkbox-${p.name}`}
                                                checked={selectedPerms.has(p.name)}
                                                onChange={() => togglePermission(p.name)}
                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                                            />
                                            <span className="font-mono text-xs">{p.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {permissions.length === 0 && (
                            <p className="text-sm text-gray-500">No permissions available.</p>
                        )}
                    </div>

                    <button
                        type="button"
                        data-testid="role-permissions-save"
                        disabled={savingPerms || !permDirty}
                        onClick={savePermissions}
                        className="w-full px-5 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 min-h-[38px] disabled:opacity-50"
                    >
                        {savingPerms ? "Saving..." : "Save Permissions"}
                    </button>
                    <p data-testid="role-permissions-status" className="text-xs text-gray-400 mt-2">
                        {permStatus}
                    </p>
                </div>
            </Modal>
        </div>
    );
};