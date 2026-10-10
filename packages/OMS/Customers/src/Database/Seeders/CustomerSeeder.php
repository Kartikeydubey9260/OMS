<?php

declare(strict_types=1);

namespace OMS\Customers\Database\Seeders;

use Illuminate\Database\Seeder;
use OMS\Customers\Models\Customer;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        if (Customer::count() < 100) {
            $needed = 100 - Customer::count();
            Customer::factory()->count($needed)->create();
        }
    }
}
