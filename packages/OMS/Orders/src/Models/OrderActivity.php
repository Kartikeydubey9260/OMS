<?php

declare(strict_types=1);

namespace OMS\Orders\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OMS\Orders\Contracts\OrderActivity as OrderActivityContract;
use OMS\Users\Models\User;

class OrderActivity extends Model implements OrderActivityContract
{
    use HasFactory;

    public const UPDATED_AT = null;

    protected $table = 'order_activities';

    protected $fillable = [
        'order_id',
        'user_id',
        'type',
        'description',
        'meta',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
