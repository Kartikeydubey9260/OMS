<?php

declare(strict_types=1);

namespace OMS\Users\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\HasApiTokens;
use OMS\Core\Models\AuditLog;
use OMS\Orders\Models\Order;
use OMS\Users\Contracts\User as UserContract;
use OMS\Users\Database\Factories\UserFactory;
use Spatie\Permission\Traits\HasRoles;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property string $password
 * @property bool $is_active
 * @property Carbon|null $last_login_at
 * @property Carbon|null $email_verified_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Collection<int, Order> $ordersCreated
 * @property-read Collection<int, Order> $ordersAssigned
 * @property-read Collection<int, AuditLog> $auditLogs
 */
class User extends Authenticatable implements UserContract
{
    use HasApiTokens, HasFactory, HasRoles, Notifiable, SoftDeletes;

    protected $table = 'users';

    protected $fillable = [
        'name',
        'email',
        'password',
        'is_active',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
            'password' => 'hashed',
        ];
    }

    public function ordersCreated(): HasMany
    {
        return $this->hasMany(Order::class, 'created_by');
    }

    public function ordersAssigned(): HasMany
    {
        return $this->hasMany(Order::class, 'assigned_to');
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
    }

    protected static function newFactory(): UserFactory
    {
        return UserFactory::new();
    }
}
