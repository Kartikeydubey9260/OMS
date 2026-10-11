<?php

declare(strict_types=1);

namespace OMS\Users\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use OMS\Users\Models\User;

class UserRepository
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = User::query()->with('roles');

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['role'])) {
            $query->role($filters['role']);
        }

        if (isset($filters['is_active']) && $filters['is_active'] !== '') {
            $query->where('is_active', filter_var($filters['is_active'], FILTER_VALIDATE_BOOLEAN));
        }

        $sort = $filters['sort'] ?? 'created_at';
        $direction = strtolower($filters['direction'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        if (in_array($sort, ['id', 'name', 'email', 'is_active', 'created_at'], true)) {
            $query->orderBy($sort, $direction);
        } else {
            $query->latest('created_at');
        }

        return $query->paginate($perPage);
    }

    /**
     * @return Collection<int, User>
     */
    public function getAssignable(): Collection
    {
        return User::query()
            ->where('is_active', true)
            ->whereHas('roles', function ($q) {
                $q->whereIn('name', ['admin', 'manager', 'staff']);
            })
            ->select(['id', 'name', 'email'])
            ->get();
    }

    public function find(int $id): ?User
    {
        return User::find($id);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): User
    {
        return User::create($data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(User $user, array $data): bool
    {
        return $user->update($data);
    }

    public function delete(User $user): bool
    {
        return (bool) $user->delete();
    }
}
