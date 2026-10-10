<?php

declare(strict_types=1);

namespace OMS\Core\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use OMS\Core\Models\AuditLog;

class AuditLogRepository
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = AuditLog::query()->with('user')->latest('id');

        if (! empty($filters['action'])) {
            $query->where('action', $filters['action']);
        }

        if (! empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        if (! empty($filters['auditable_type'])) {
            $query->where('auditable_type', $filters['auditable_type']);
        }

        if (! empty($filters['auditable_id'])) {
            $query->where('auditable_id', $filters['auditable_id']);
        }

        return $query->paginate($perPage);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): AuditLog
    {
        return AuditLog::create($data);
    }
}
