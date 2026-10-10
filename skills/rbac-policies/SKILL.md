---
name: rbac-policies
description: Use when implementing authentication (Sanctum), roles/permissions (Spatie), policies, staff data scoping, or the frontend permission hooks/routes in the OMS.
---

# RBAC and authentication skill

## Sanctum token auth
- `AuthController@login`: validate → `Auth::attempt` or manual `Hash::check`; reject `is_active=false` with generic "Invalid credentials" (don't reveal state); `createToken($device, ['*'], now()->addHours(8))`; update `last_login_at`; return `{token,user}` with `role` and flattened `permissions`.
- `logout`: `$request->user()->currentAccessToken()->delete()`.
- `me`: user + role + permissions. Login route `throttle:5,1`. Never return the hashed password.

## Spatie setup
`composer require spatie/laravel-permission`; publish migration; `HasRoles` on `User`. Seeder `RolePermissionSeeder`:

```
permissions: users.manage roles.manage customers.view customers.manage products.view products.manage
  orders.view_all orders.view_assigned orders.create orders.update orders.delete orders.assign
  orders.change_status orders.add_note dashboard.view reports.view audit.view
Admin   => all
Manager => customers.view customers.manage products.view orders.view_all orders.create orders.update
           orders.assign orders.change_status orders.add_note dashboard.view reports.view
Staff   => customers.view products.view orders.view_assigned orders.change_status orders.add_note
```
Call `app(PermissionRegistrar::class)->forgetCachedPermissions()` in seeders/tests.

## Policies
Register by convention (`OrderPolicy` for `Order`). Use `before()` sparingly (don't blanket-allow Admin if the spec has exceptions).

```php
class OrderPolicy {
  public function viewAny(User $u): bool { return $u->can('orders.view_all') || $u->can('orders.view_assigned'); }
  public function view(User $u, Order $o): bool {
      return $u->can('orders.view_all') || ($u->can('orders.view_assigned') && $o->assigned_to === $u->id);
  }
  public function create(User $u): bool { return $u->can('orders.create'); }
  public function update(User $u, Order $o): bool { return $u->can('orders.update'); }
  public function delete(User $u, Order $o): bool { return $u->can('orders.delete'); }
  public function assign(User $u, Order $o): bool { return $u->can('orders.assign'); }
  public function addNote(User $u, Order $o): bool { return $u->can('orders.add_note') && $this->view($u,$o); }
  public function changeStatus(User $u, Order $o, ?OrderStatus $to = null): bool {
      if (!$u->can('orders.change_status') || !$this->view($u,$o)) return false;
      if ($u->hasRole('staff') && $to) return in_array([$o->status->value,$to->value], config('oms.staff_transitions'), true);
      return true;
  }
}
```
`config('oms.staff_transitions')` = `[['confirmed','processing'],['processing','ready'],['ready','completed']]`.

Same pattern for `CustomerPolicy`, `ProductPolicy`, `UserPolicy` (cannot delete self), `AuditLogPolicy` (`audit.view`).

## Staff scoping in queries
Never filter in the controller after loading. In `OrderQuery::for(User $u)`: `if (!$u->can('orders.view_all')) $q->where('assigned_to', $u->id);`. Detail endpoint uses policy `view` → 403 (or 404 to avoid leaking existence; pick one and document).

## Role/permission management API
`PUT /roles/{role}/permissions` validates each permission exists; forbid removing `users.manage`/`roles.manage` from Admin (prevent lockout); audit `role.permissions_updated` with old/new arrays; clear permission cache.

## Frontend
- `authStore` (Zustand + `persist`): `token, user, setAuth, logout`. Axios request interceptor adds `Authorization`; response interceptor on 401 → `logout()` + redirect.
- `usePermission(name)` / `<Can permission="orders.assign">` read `user.permissions`.
- `ProtectedRoute` (needs token; on first load call `/me` to hydrate), `PermissionRoute permission="dashboard.view"` → redirect to 403 page.
- Order action buttons come from API `permissions{}` and `allowed_transitions` — never infer from role name alone.
- Remember: hiding UI is not security; backend tests must prove 403s.

## Tests
401 without token · 403 matrix (Staff → POST /orders, DELETE /orders, /users, /products POST; Manager → /users, /audit-logs, product create) · Staff cannot view unassigned order · Staff allowed vs disallowed transition · inactive user cannot log in · token revoked after logout.
