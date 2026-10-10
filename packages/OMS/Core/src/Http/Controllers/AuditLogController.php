<?php

declare(strict_types=1);

namespace OMS\Core\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use OMS\Core\Models\AuditLog;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (! $user || ! $user->can('audit.view')) {
            abort(response()->json([
                'success' => false,
                'message' => 'This action is unauthorized.',
                'code' => 'FORBIDDEN',
                'errors' => [],
            ], 403));
        }

        $query = AuditLog::query()->with('user:id,name,email');

        if ($request->has('action')) {
            $query->where('action', $request->input('action'));
        }

        if ($request->has('auditable_type')) {
            $query->where('auditable_type', $request->input('auditable_type'));
        }

        if ($request->has('auditable_id')) {
            $query->where('auditable_id', (int) $request->input('auditable_id'));
        }

        if ($request->has('user_id')) {
            $query->where('user_id', (int) $request->input('user_id'));
        }

        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        $query->orderByDesc('id');

        $perPage = min((int) $request->input('per_page', 50), 100);
        $logs = $query->paginate($perPage);

        $items = collect($logs->items())->map(function (AuditLog $log) {
            return [
                'id' => $log->id,
                'action' => $log->action,
                'auditable_type' => $log->auditable_type,
                'auditable_id' => $log->auditable_id,
                'label' => $log->label,
                'old_values' => $log->old_values,
                'new_values' => $log->new_values,
                'user' => $log->user ? [
                    'id' => $log->user->id,
                    'name' => $log->user->name,
                    'email' => $log->user->email,
                ] : null,
                'created_at' => $log->created_at?->toIso8601String(),
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Audit logs retrieved successfully',
            'data' => $items,
            'meta' => [
                'current_page' => $logs->currentPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
                'last_page' => $logs->lastPage(),
            ],
        ]);
    }
}
