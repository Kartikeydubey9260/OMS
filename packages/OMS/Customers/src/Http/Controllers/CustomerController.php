<?php

declare(strict_types=1);

namespace OMS\Customers\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use OMS\Core\Services\AuditLogger;
use OMS\Customers\Models\Customer;
use OMS\Customers\Repositories\CustomerRepository;

class CustomerController extends Controller
{
    public function __construct(
        protected CustomerRepository $customerRepository,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizePermission('customers.view');

        $perPage = min((int) $request->input('per_page', 15), (int) config('oms.max_per_page', 100));
        $customers = $this->customerRepository->paginate($request->all(), $perPage);

        return response()->json([
            'success' => true,
            'message' => 'Customers retrieved successfully',
            'data' => $customers->items(),
            'meta' => [
                'current_page' => $customers->currentPage(),
                'per_page' => $customers->perPage(),
                'total' => $customers->total(),
                'last_page' => $customers->lastPage(),
            ],
        ]);
    }

    public function lookup(Request $request): JsonResponse
    {
        $this->authorizePermission('customers.view');

        $q = (string) $request->input('q', '');
        $customers = Customer::query()
            ->where('is_active', true)
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($sub) use ($q) {
                    $sub->where('name', 'like', "%{$q}%")
                        ->orWhere('email', 'like', "%{$q}%");
                });
            })
            ->select(['id', 'name', 'email'])
            ->limit(20)
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Customers retrieved successfully',
            'data' => $customers,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePermission('customers.manage');

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'email' => 'required|email|max:190|unique:customers,email',
            'phone' => 'nullable|string|max:30',
            'company' => 'nullable|string|max:150',
            'address_line1' => 'nullable|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'postal_code' => 'nullable|string|max:30',
            'country' => 'nullable|string|max:100',
            'is_active' => 'boolean',
        ]);

        $customer = $this->customerRepository->create($validated);

        AuditLogger::record(
            action: 'customer.created',
            auditableType: 'customer',
            auditableId: $customer->id,
            label: "Created customer {$customer->name} ({$customer->email})",
            newValues: $validated
        );

        return response()->json([
            'success' => true,
            'message' => 'Customer created successfully',
            'data' => $customer,
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $this->authorizePermission('customers.view');

        $customer = $this->customerRepository->findWithStats($id);
        if (! $customer) {
            return response()->json([
                'success' => false,
                'message' => 'Customer not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Customer retrieved successfully',
            'data' => $customer,
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $this->authorizePermission('customers.manage');

        $customer = $this->customerRepository->find($id);
        if (! $customer) {
            return response()->json([
                'success' => false,
                'message' => 'Customer not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:150',
            'email' => "sometimes|email|max:190|unique:customers,email,{$id}",
            'phone' => 'nullable|string|max:30',
            'company' => 'nullable|string|max:150',
            'address_line1' => 'nullable|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'postal_code' => 'nullable|string|max:30',
            'country' => 'nullable|string|max:100',
            'is_active' => 'sometimes|boolean',
        ]);

        $oldValues = [];
        $newValues = [];
        foreach ($validated as $key => $value) {
            if ((string) $customer->{$key} !== (string) $value) {
                $oldValues[$key] = $customer->{$key};
                $newValues[$key] = $value;
            }
        }

        $this->customerRepository->update($customer, $validated);

        if (! empty($newValues)) {
            AuditLogger::record(
                action: 'customer.updated',
                auditableType: 'customer',
                auditableId: $customer->id,
                label: "Updated customer {$customer->name}",
                oldValues: $oldValues,
                newValues: $newValues
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Customer updated successfully',
            'data' => $customer->fresh(),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $user = Auth::user();
        if (! $user || ! $user->hasRole('admin')) {
            return response()->json([
                'success' => false,
                'message' => 'This action is unauthorized.',
                'code' => 'FORBIDDEN',
                'errors' => [],
            ], 403);
        }

        $customer = $this->customerRepository->find($id);
        if (! $customer) {
            return response()->json([
                'success' => false,
                'message' => 'Customer not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        if ($customer->orders()->exists()) {
            $customer->update(['is_active' => false]);
            $customer->delete(); // Soft delete
        } else {
            $customer->delete();
        }

        AuditLogger::record(
            action: 'customer.deleted',
            auditableType: 'customer',
            auditableId: $customer->id,
            label: "Deleted customer {$customer->name}"
        );

        return response()->json([
            'success' => true,
            'message' => 'Customer deleted successfully',
            'data' => null,
        ]);
    }

    protected function authorizePermission(string $permission): void
    {
        $user = Auth::user();
        if (! $user || ! $user->can($permission)) {
            abort(response()->json([
                'success' => false,
                'message' => 'This action is unauthorized.',
                'code' => 'FORBIDDEN',
                'errors' => [],
            ], 403));
        }
    }
}
