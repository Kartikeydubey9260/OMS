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

        foreach ($permissions as $permissionName) {
            Permission::findOrCreate($permissionName, 'web');
        }

        $adminRole = Role::findOrCreate('admin', 'web');
        $adminRole->syncPermissions(Permission::all());

        $managerRole = Role::findOrCreate('manager', 'web');
        $managerRole->syncPermissions([
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
        ]);

        $staffRole = Role::findOrCreate('staff', 'web');
        $staffRole->syncPermissions([
            'customers.view',
            'products.view',
            'orders.view_assigned',
            'orders.change_status',
            'orders.add_note',
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
