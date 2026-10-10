<?php

declare(strict_types=1);

namespace OMS\Core\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use OMS\Core\Models\AuditLog;
use OMS\Users\Models\User;

/**
 * @extends Factory<AuditLog>
 */
class AuditLogFactory extends Factory
{
    protected $model = AuditLog::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'action' => 'order.created',
            'auditable_type' => 'order',
            'auditable_id' => 1,
            'label' => 'Created order ORD-10001',
            'old_values' => null,
            'new_values' => ['status' => 'pending'],
            'ip_address' => '127.0.0.1',
            'created_at' => now(),
        ];
    }
}
