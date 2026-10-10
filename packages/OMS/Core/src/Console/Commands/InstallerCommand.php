<?php

declare(strict_types=1);

namespace OMS\Core\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

class InstallerCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'oms:install';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Install and configure the OMS application interactively.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Welcome to the OMS Installer!');

        // 1. Ask for environment variables
        $appName = $this->ask('APP_NAME', 'OMS');
        $appUrl = $this->ask('APP_URL', 'http://localhost:8000');

        $dbConnection = $this->choice(
            'DB_CONNECTION',
            ['mysql', 'sqlite', 'pgsql', 'sqlsrv'],
            0 // default to mysql
        );

        $dbHost = '127.0.0.1';
        $dbPort = '3306';
        $dbDatabase = 'oms_db';
        $dbUsername = 'root';
        $dbPassword = '';

        if ($dbConnection !== 'sqlite') {
            $dbHost = $this->ask('DB_HOST', '127.0.0.1');
            $dbPort = $this->ask('DB_PORT', '3306');
            $dbDatabase = $this->ask('DB_DATABASE', 'oms_db');
            $dbUsername = $this->ask('DB_USERNAME', 'root');
            $dbPassword = $this->secret('DB_PASSWORD (typing will be hidden)');
        }

        // 2. Create .env if it doesn't exist
        $envPath = base_path('.env');
        if (! File::exists($envPath)) {
            $this->info('Creating .env file from .env.example...');
            File::copy(base_path('.env.example'), $envPath);
        }

        // 3. Update .env variables
        $this->info('Updating environment variables...');
        $envData = [
            'APP_NAME' => $appName,
            'APP_URL' => $appUrl,
            'DB_CONNECTION' => $dbConnection,
            'DB_HOST' => $dbHost,
            'DB_PORT' => $dbPort,
            'DB_DATABASE' => $dbDatabase,
            'DB_USERNAME' => $dbUsername,
            'DB_PASSWORD' => (string) $dbPassword,
        ];
        $this->updateEnv($envData);

        // Clear config to ensure new env vars are loaded
        Artisan::call('config:clear');

        // 4. Generate App Key
        $this->info('Generating application key...');
        Artisan::call('key:generate', ['--force' => true]);

        // 5. Handle SQLite Database creation
        if ($dbConnection === 'sqlite') {
            $sqlitePath = database_path('database.sqlite');
            if (! File::exists($sqlitePath)) {
                $this->info('Creating SQLite database file...');
                File::put($sqlitePath, '');
            }
        }

        // 6. Run Migrations & Seeders
        $this->info('Running database migrations and seeders...');
        try {
            Artisan::call('migrate:fresh', [
                '--seed' => true,
                '--force' => true,
            ]);
            $this->info(Artisan::output());
        } catch (\Exception $e) {
            $this->error('Database migration failed: '.$e->getMessage());
            $this->error('Please check your database credentials and try running "php artisan migrate:fresh --seed" manually.');

            return self::FAILURE;
        }

        $this->info('OMS Installation completed successfully! You can now start the application using "php artisan serve".');

        return self::SUCCESS;
    }

    /**
     * Update the .env file with given key-value pairs.
     */
    protected function updateEnv(array $data): void
    {
        $path = base_path('.env');
        if (! File::exists($path)) {
            return;
        }

        $envContent = File::get($path);

        foreach ($data as $key => $value) {
            $escapedValue = preg_match('/\s/', (string) $value) ? '"'.$value.'"' : $value;

            if (preg_match('/^'.$key.'=/m', $envContent)) {
                $envContent = preg_replace('/^'.$key.'=.*$/m', $key.'='.$escapedValue, $envContent);
            } else {
                $envContent .= "\n".$key.'='.$escapedValue;
            }
        }

        File::put($path, $envContent);
    }
}
