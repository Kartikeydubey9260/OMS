<?php

declare(strict_types=1);

namespace OMS\Core\Providers;

use Illuminate\Support\ServiceProvider;
use OMS\Core\Console\Commands\InstallerCommand;

class CoreServiceProvider extends ServiceProvider
{
    /**
     * Register the service provider.
     *
     * @return void
     */
    public function register(): void
    {
        $this->registerCommands();
    }

    /**
     * Register the commands for this package.
     */
    protected function registerCommands(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([
                InstallerCommand::class,
            ]);
        }
    }

    public function boot(): void
    {
        $migrationPath = __DIR__.'/../Database/Migrations';
        if (is_dir($migrationPath)) {
            $this->loadMigrationsFrom($migrationPath);
        }
    }
}
