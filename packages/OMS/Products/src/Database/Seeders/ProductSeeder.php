<?php

declare(strict_types=1);

namespace OMS\Products\Database\Seeders;

use Illuminate\Database\Seeder;
use OMS\Products\Models\Product;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        if (Product::count() < 50) {
            $needed = 50 - Product::count();
            Product::factory()->count($needed)->create();
        }
    }
}
