<?php

declare(strict_types=1);

namespace OMS\Users\Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use OMS\Users\Models\User;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            [
                'name' => 'Admin User',
                'email' => 'admin@oms.test',
                'role' => 'admin',
            ],
            [
                'name' => 'Manager User',
                'email' => 'manager@oms.test',
                'role' => 'manager',
            ],
            [
                'name' => 'Second Manager',
                'email' => 'manager2@oms.test',
                'role' => 'manager',
            ],
            [
                'name' => 'Staff User',
                'email' => 'staff@oms.test',
                'role' => 'staff',
            ],
            [
                'name' => 'Second Staff',
                'email' => 'staff2@oms.test',
                'role' => 'staff',
            ],
        ];

        foreach ($users as $data) {
            $user = User::firstOrCreate(
                ['email' => $data['email']],
                [
                    'name' => $data['name'],
                    'password' => Hash::make('password'),
                    'is_active' => true,
                    'email_verified_at' => now(),
                ]
            );

            $user->syncRoles([$data['role']]);
        }
    }
}
