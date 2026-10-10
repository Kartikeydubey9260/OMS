<?php

declare(strict_types=1);

namespace OMS\Orders\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OMS\Orders\Contracts\OrderStatusHistory as OrderStatusHistoryContract;
use OMS\Users\Models\User;

class OrderStatusHistory extends Model implements OrderStatusHistoryContract
{
    use HasFactory;

    public const UPDATED_AT = null;

    protected $table = 'order_status_histories';

    protected $fillable = [
        'order_id',
        'from_status',
        'to_status',
        'changed_by',
        'remarks',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
