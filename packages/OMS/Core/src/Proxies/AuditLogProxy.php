<?php

declare(strict_types=1);

namespace OMS\Core\Proxies;

use OMS\Core\Models\AuditLog;

class AuditLogProxy extends ModelProxy
{
    public static function modelClass(): string
    {
        return AuditLog::class;
    }
}
