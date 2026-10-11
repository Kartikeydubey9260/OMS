<?php

declare(strict_types=1);

namespace OMS\Products\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use OMS\Core\Services\AuditLogger;
use OMS\Inventory\Contracts\InventoryService as InventoryServiceContract;
use OMS\Products\Models\Product;
use OMS\Products\Repositories\ProductRepository;

class ProductController extends Controller
{
    public function __construct(
        protected ProductRepository $productRepository,
        protected InventoryServiceContract $inventoryService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizePermission('products.view');

        $perPage = min((int) $request->input('per_page', 10), (int) config('oms.max_per_page', 100));
        $products = $this->productRepository->paginate($request->all(), $perPage);

        return response()->json([
            'success' => true,
            'message' => 'Products retrieved successfully',
            'data' => $products->items(),
            'meta' => [
                'current_page' => $products->currentPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
                'last_page' => $products->lastPage(),
            ],
        ]);
    }

    public function lookup(Request $request): JsonResponse
    {
        $this->authorizePermission('products.view');

        $q = (string) $request->input('q', '');
        $products = Product::query()
            ->where('status', 'active')
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($sub) use ($q) {
                    $sub->where('name', 'like', "%{$q}%")
                        ->orWhere('sku', 'like', "%{$q}%");
                });
            })
            ->select(['id', 'name', 'sku', 'price', 'stock_quantity', 'status'])
            ->limit(20)
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Products retrieved successfully',
            'data' => $products,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePermission('products.manage');

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'sku' => 'required|string|max:64|unique:products,sku',
            'price' => 'required|numeric|min:0',
            'stock_quantity' => 'required|integer|min:0',
            'status' => 'sometimes|in:active,inactive',
            'low_stock_threshold' => 'sometimes|integer|min:0',
            'description' => 'nullable|string',
        ]);

        $product = $this->productRepository->create($validated);

        AuditLogger::record(
            action: 'product.created',
            auditableType: 'product',
            auditableId: $product->id,
            label: "Created product {$product->name} (SKU: {$product->sku})",
            newValues: $validated
        );

        return response()->json([
            'success' => true,
            'message' => 'Product created successfully',
            'data' => $product,
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $this->authorizePermission('products.view');

        $product = $this->productRepository->find($id);
        if (! $product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Product retrieved successfully',
            'data' => $product,
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $this->authorizePermission('products.manage');

        $product = $this->productRepository->find($id);
        if (! $product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:150',
            'sku' => "sometimes|string|max:64|unique:products,sku,{$id}",
            'price' => 'sometimes|numeric|min:0',
            'stock_quantity' => 'sometimes|integer|min:0',
            'status' => 'sometimes|in:active,inactive',
            'low_stock_threshold' => 'sometimes|integer|min:0',
            'description' => 'nullable|string',
        ]);

        $oldValues = [];
        $newValues = [];
        foreach ($validated as $key => $value) {
            if ((string) $product->{$key} !== (string) $value) {
                $oldValues[$key] = $product->{$key};
                $newValues[$key] = $value;
            }
        }

        $this->productRepository->update($product, $validated);

        if (! empty($newValues)) {
            AuditLogger::record(
                action: 'product.updated',
                auditableType: 'product',
                auditableId: $product->id,
                label: "Updated product {$product->name}",
                oldValues: $oldValues,
                newValues: $newValues
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Product updated successfully',
            'data' => $product->fresh(),
        ]);
    }

    public function adjustStock(Request $request, int $id): JsonResponse
    {
        $this->authorizePermission('products.manage');

        $product = $this->productRepository->find($id);
        if (! $product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        $validated = $request->validate([
            'delta' => 'required|integer',
            'reason' => 'required|string|max:255',
        ]);

        $updatedProduct = $this->inventoryService->adjustStock($product, (int) $validated['delta'], $validated['reason']);

        return response()->json([
            'success' => true,
            'message' => 'Stock adjusted successfully',
            'data' => $updatedProduct,
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

        $product = $this->productRepository->find($id);
        if (! $product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        // Order items restrict deletion (products.*.restrictOnDelete); keep history intact.
        if ($product->orderItems()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Product has order history and cannot be deleted.',
                'code' => 'CONFLICT',
                'errors' => [],
            ], 422);
        }

        $this->productRepository->delete($product);

        AuditLogger::record(
            action: 'product.deleted',
            auditableType: 'product',
            auditableId: $product->id,
            label: "Deleted product {$product->name} (SKU: {$product->sku})"
        );

        return response()->json([
            'success' => true,
            'message' => 'Product deleted successfully',
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
