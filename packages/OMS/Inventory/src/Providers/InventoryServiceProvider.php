<?php

declare(strict_types=1);

namespace OMS\Inventory\Providers;

use Illuminate\Support\ServiceProvider;
use OMS\Inventory\Contracts\InventoryService;

class InventoryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            InventoryService::class,
            \OMS\Inventory\Services\InventoryService::class
        );
    }

    public function boot(): void
    {
        $migrationPath = __DIR__.'/../Database/Migrations';
        if (is_dir($migrationPath)) {
            $this->loadMigrationsFrom($migrationPath);
        }
    }
}
