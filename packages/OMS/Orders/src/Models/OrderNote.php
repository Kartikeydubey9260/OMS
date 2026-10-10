<?php

declare(strict_types=1);

namespace OMS\Orders\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OMS\Orders\Contracts\OrderNote as OrderNoteContract;
use OMS\Users\Models\User;

class OrderNote extends Model implements OrderNoteContract
{
    use HasFactory;

    protected $table = 'order_notes';

    protected $fillable = [
        'order_id',
        'user_id',
        'body',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
