<?php

declare(strict_types=1);

namespace OMS\Orders\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use OMS\Customers\Models\Customer;
use OMS\Orders\Contracts\Order as OrderContract;
use OMS\Orders\Database\Factories\OrderFactory;
use OMS\Orders\Enums\OrderPriority;
use OMS\Orders\Enums\OrderStatus;
use OMS\Users\Models\User;

/**
 * @property int $id
 * @property string $order_number
 * @property int $customer_id
 * @property int $created_by
 * @property int|null $assigned_to
 * @property OrderStatus $status
 * @property OrderPriority $priority
 * @property string $order_date
 * @property string|float $subtotal
 * @property string|null $discount_type
 * @property string|float $discount_value
 * @property string|float $discount_amount
 * @property string|float $tax_rate
 * @property string|float $tax_amount
 * @property string|float $total
 * @property string|null $notes
 * @property bool $stock_reserved
 * @property Carbon|null $confirmed_at
 * @property Carbon|null $completed_at
 * @property Carbon|null $cancelled_at
 * @property string|null $cancellation_reason
 * @property int $version
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Customer $customer
 * @property-read User $creator
 * @property-read User|null $assignee
 * @property-read Collection<int, OrderItem> $items
 * @property-read Collection<int, OrderStatusHistory> $statusHistories
 * @property-read Collection<int, OrderNote> $notesList
 * @property-read Collection<int, OrderActivity> $activities
 */
class Order extends Model implements OrderContract
{
    use HasFactory, SoftDeletes;

    protected $table = 'orders';

    protected $fillable = [
        'order_number',
        'customer_id',
        'created_by',
        'assigned_to',
        'status',
        'priority',
        'order_date',
        'subtotal',
        'discount_type',
        'discount_value',
        'discount_amount',
        'tax_rate',
        'tax_amount',
        'total',
        'notes',
        'stock_reserved',
        'confirmed_at',
        'completed_at',
        'cancelled_at',
        'cancellation_reason',
        'version',
    ];

    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'priority' => OrderPriority::class,
            'order_date' => 'date:Y-m-d',
            'subtotal' => 'decimal:2',
            'discount_value' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total' => 'decimal:2',
            'stock_reserved' => 'boolean',
            'confirmed_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'version' => 'integer',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class)->orderBy('created_at', 'asc');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(OrderNote::class)->latest('created_at');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(OrderActivity::class)->latest('created_at');
    }

    protected static function newFactory(): OrderFactory
    {
        return OrderFactory::new();
    }
}
