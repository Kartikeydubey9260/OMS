<?php

declare(strict_types=1);

namespace OMS\Core\Services;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;
use OMS\Core\Models\AuditLog;

class AuditLogger
{
    /**
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     */
    public function log(
        string $action,
        string $auditableType,
        int $auditableId,
        string $label,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?int $userId = null,
    ): AuditLog {
        $filter = function (?array $values): ?array {
            if ($values === null) {
                return null;
            }
            $sensitive = ['password', 'remember_token', 'token', 'access_token', 'current_password'];

            return collect($values)->except($sensitive)->all();
        };

        return AuditLog::create([
            'user_id' => $userId ?? Auth::id(),
            'action' => $action,
            'auditable_type' => $auditableType,
            'auditable_id' => $auditableId,
            'label' => $label,
            'old_values' => $filter($oldValues),
            'new_values' => $filter($newValues),
            'ip_address' => Request::ip(),
            'created_at' => now(),
        ]);
    }

    /**
     * Static helper forwarding to container instance (supports Mockery mocking).
     *
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     */
    public static function record(
        string $action,
        string $auditableType,
        int $auditableId,
        string $label,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?int $userId = null,
    ): AuditLog {
        /** @var AuditLogger $logger */
        $logger = app(self::class);

        return $logger->log($action, $auditableType, $auditableId, $label, $oldValues, $newValues, $userId);
    }
}
