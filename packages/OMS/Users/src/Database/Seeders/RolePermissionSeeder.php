<?php

declare(strict_types=1);

namespace OMS\Users\Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = [
            'users.manage',
            'roles.manage',
            'customers.view',
            'customers.manage',
            'products.view',
            'products.manage',
            'orders.view_all',
            'orders.view_assigned',
            'orders.create',
            'orders.update',
            'orders.delete',
            'orders.assign',
            'orders.change_status',
            'orders.add_note',
            'dashboard.view',
            'reports.view',
            'audit.view',
        ];

        foreach (['web', 'sanctum'] as $guard) {
            foreach ($permissions as $permissionName) {
                Permission::findOrCreate($permissionName, $guard);
            }

            $adminRole = Role::findOrCreate('admin', $guard);
            $adminRole->syncPermissions(Permission::where('guard_name', $guard)->get());

            $managerRole = Role::findOrCreate('manager', $guard);
            $managerRole->syncPermissions(Permission::where('guard_name', $guard)->whereIn('name', [
                'customers.view',
                'customers.manage',
                'products.view',
                'orders.view_all',
                'orders.create',
                'orders.update',
                'orders.assign',
                'orders.change_status',
                'orders.add_note',
                'dashboard.view',
                'reports.view',
            ])->get());

            $staffRole = Role::findOrCreate('staff', $guard);
            $staffRole->syncPermissions(Permission::where('guard_name', $guard)->whereIn('name', [
                'customers.view',
                'products.view',
                'orders.view_assigned',
                'orders.change_status',
                'orders.add_note',
            ])->get());
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        app(PermissionRegistrar::class)->getPermissions();
    }
}
