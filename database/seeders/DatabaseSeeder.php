<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use OMS\Customers\Database\Seeders\CustomerSeeder;
use OMS\Orders\Database\Seeders\OrderSeeder;
use OMS\Products\Database\Seeders\ProductSeeder;
use OMS\Users\Database\Seeders\RolePermissionSeeder;
use OMS\Users\Database\Seeders\UserSeeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolePermissionSeeder::class,
            UserSeeder::class,
            CustomerSeeder::class,
            ProductSeeder::class,
            OrderSeeder::class,
        ]);
    }
}
