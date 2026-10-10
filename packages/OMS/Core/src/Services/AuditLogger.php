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
    public static function log(
        string $action,
        string $auditableType,
        int $auditableId,
        string $label,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?int $userId = null,
    ): AuditLog {
        return AuditLog::create([
            'user_id' => $userId ?? Auth::id(),
            'action' => $action,
            'auditable_type' => $auditableType,
            'auditable_id' => $auditableId,
            'label' => $label,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => Request::ip(),
            'created_at' => now(),
        ]);
    }
}
