<?php

declare(strict_types=1);

namespace OMS\Admin\Http\Controllers;

use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use OMS\Admin\Services\ReportService;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xls;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\Response;

/**
 * Reporting endpoints for the dashboard. There is intentionally no separate
 * Reports section: every report is served by the dashboard.
 */
class DashboardReportController extends Controller
{
    public function __construct(
        protected ReportService $reportService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizePermission('reports.view');

        $filters = $this->filtersFrom($request);
        $limit = $this->limitFrom($request);

        // Detailed breakdowns are server-driven: page, page size, and sort.
        $page = max(1, (int) $request->query('page', 1));
        $perPage = (int) $request->query('per_page', 10);
        $sort = trim((string) $request->query('sort', ''));
        $direction = strtolower((string) $request->query('direction', 'desc')) === 'asc' ? 'asc' : 'desc';

        return response()->json([
            'success' => true,
            'message' => 'Reports retrieved successfully',
            'data' => $this->reportService->build($filters, $limit, $page, $perPage, $sort, $direction),
        ]);
    }

    public function export(Request $request): Response
    {
        $this->authorizePermission('reports.view');

        $type = (string) $request->query('type', 'overview');
        $format = strtolower((string) $request->query('format', 'csv'));
        $filters = $this->filtersFrom($request);
        $limit = $this->limitFrom($request);

        [$viewName, $tableTitle, $filePrefix, $headers, $rows] = $this->tableFor($type, $filters, $limit);

        $fileNamePrefix = $filePrefix.'_'.now()->format('Ymd_His');

        if ($format === 'csv') {
            return response()->streamDownload(function () use ($headers, $rows) {
                $out = fopen('php://output', 'w');
                fwrite($out, "\xEF\xBB\xBF");
                fputcsv($out, array_column($headers, 'label'));
                foreach ($rows as $row) {
                    $line = [];
                    foreach ($headers as $header) {
                        $line[] = $row[$header['key']] ?? '';
                    }
                    fputcsv($out, $line);
                }
                fclose($out);
            }, "{$fileNamePrefix}.csv", [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Cache-Control' => 'no-store, no-cache',
            ]);
        }

        if ($format === 'xls' || $format === 'xlsx') {
            $spreadsheet = $this->spreadsheet($viewName, $headers, $rows, $format === 'xlsx');
            $writer = $format === 'xls' ? new Xls($spreadsheet) : new Xlsx($spreadsheet);
            $contentType = $format === 'xls'
                ? 'application/vnd.ms-excel'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

            return response()->streamDownload(function () use ($writer) {
                $writer->save('php://output');
            }, "{$fileNamePrefix}.{$format}", [
                'Content-Type' => $contentType,
                'Cache-Control' => 'no-store, no-cache',
            ]);
        }

        if ($format === 'pdf') {
            $pdf = Pdf::loadView('oms-admin::reports.pdf', [
                'title' => $viewName,
                'view_name' => $viewName,
                'table_title' => $tableTitle,
                'generated_at' => now()->format('Y-m-d H:i:s'),
                'filters' => $this->filtersDescription($request),
                'summary' => $this->reportService->summary($filters),
                'headers' => $headers,
                'rows' => $rows,
            ]);

            return $pdf->download("{$fileNamePrefix}.pdf");
        }

        abort(400, "Unsupported export format: {$format}");
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{0: string, 1: string, 2: string, 3: array<int, array<string, string>>, 4: array<int, array<string, mixed>>}
     */
    protected function tableFor(string $type, array $filters, int $limit): array
    {
        $productHeaders = [
            ['key' => 'name', 'label' => 'Product'],
            ['key' => 'sku', 'label' => 'SKU'],
            ['key' => 'orders_count', 'label' => 'Orders', 'align' => 'center'],
            ['key' => 'total_quantity', 'label' => 'Quantity Sold', 'align' => 'center'],
            ['key' => 'total_revenue', 'label' => 'Revenue', 'align' => 'right'],
        ];

        $clientHeaders = [
            ['key' => 'name', 'label' => 'Client'],
            ['key' => 'email', 'label' => 'Email'],
            ['key' => 'orders_count', 'label' => 'Orders', 'align' => 'center'],
            ['key' => 'total_spent', 'label' => 'Total Spent', 'align' => 'right'],
        ];

        switch ($type) {
            case 'top_products_quantity':
            case 'top_products_by_quantity':
                return [
                    'Top Products by Quantity Sold',
                    'Products ranked by total units sold',
                    'top-products-by-quantity',
                    $productHeaders,
                    $this->reportService->topProducts($filters, 'quantity', $limit)
                        ->map(fn ($row) => [
                            'name' => $row->product_name,
                            'sku' => $row->sku,
                            'orders_count' => (int) $row->orders_count,
                            'total_quantity' => (int) $row->total_quantity,
                            'total_revenue' => '$'.number_format((float) $row->total_revenue, 2),
                        ])->all(),
                ];

            case 'top_products_price':
            case 'top_products_by_price':
                return [
                    'Top Products by Revenue',
                    'Products ranked by total revenue',
                    'top-products-by-revenue',
                    $productHeaders,
                    $this->reportService->topProducts($filters, 'price', $limit)
                        ->map(fn ($row) => [
                            'name' => $row->product_name,
                            'sku' => $row->sku,
                            'orders_count' => (int) $row->orders_count,
                            'total_quantity' => (int) $row->total_quantity,
                            'total_revenue' => '$'.number_format((float) $row->total_revenue, 2),
                        ])->all(),
                ];

            case 'top_clients_orders':
            case 'top_clients_by_orders':
                return [
                    'Top Clients by Order Count',
                    'Clients ranked by number of orders',
                    'top-clients-by-orders',
                    $clientHeaders,
                    $this->reportService->topCustomers($filters, 'orders', $limit)
                        ->map(fn ($row) => [
                            'name' => $row->client_name,
                            'email' => $row->email,
                            'orders_count' => (int) $row->orders_count,
                            'total_spent' => '$'.number_format((float) $row->total_spent, 2),
                        ])->all(),
                ];

            case 'top_clients_price':
            case 'top_clients_by_price':
                return [
                    'Top Clients by Order Value',
                    'Clients ranked by total order value',
                    'top-clients-by-value',
                    $clientHeaders,
                    $this->reportService->topCustomers($filters, 'price', $limit)
                        ->map(fn ($row) => [
                            'name' => $row->client_name,
                            'email' => $row->email,
                            'orders_count' => (int) $row->orders_count,
                            'total_spent' => '$'.number_format((float) $row->total_spent, 2),
                        ])->all(),
                ];

            case 'per_client':
            case 'per_client_report':
                return [
                    'Per-Client Report',
                    'Orders, units and revenue grouped by client',
                    'per-client-report',
                    [
                        ['key' => 'name', 'label' => 'Client'],
                        ['key' => 'email', 'label' => 'Email'],
                        ['key' => 'orders_count', 'label' => 'Orders', 'align' => 'center'],
                        ['key' => 'total_quantity', 'label' => 'Units', 'align' => 'center'],
                        ['key' => 'avg_order_value', 'label' => 'Avg Order', 'align' => 'right'],
                        ['key' => 'total_spent', 'label' => 'Total Spent', 'align' => 'right'],
                        ['key' => 'latest_order_date', 'label' => 'Latest Order'],
                    ],
                    $this->reportService->perCustomer($filters)
                        ->map(fn ($row) => [
                            'name' => $row->client_name,
                            'email' => $row->email,
                            'orders_count' => (int) $row->orders_count,
                            'total_quantity' => (int) $row->total_quantity,
                            'avg_order_value' => '$'.number_format((float) $row->avg_order_value, 2),
                            'total_spent' => '$'.number_format((float) $row->total_spent, 2),
                            'latest_order_date' => $row->latest_order_date ?? '-',
                        ])->all(),
                ];

            case 'per_product':
            case 'per_product_report':
                return [
                    'Per-Product Report',
                    'Orders, units and revenue grouped by product',
                    'per-product-report',
                    $productHeaders,
                    $this->reportService->perProduct($filters)
                        ->map(fn ($row) => [
                            'name' => $row->product_name,
                            'sku' => $row->sku,
                            'orders_count' => (int) $row->orders_count,
                            'total_quantity' => (int) $row->total_quantity_sold,
                            'total_revenue' => '$'.number_format((float) $row->total_revenue, 2),
                        ])->all(),
                ];

            case 'overview':
            default:
                $summary = $this->reportService->summary($filters);

                return [
                    'Executive Operational Overview',
                    'Summary of key performance indicators',
                    'operational-overview',
                    [
                        ['key' => 'metric', 'label' => 'Metric'],
                        ['key' => 'value', 'label' => 'Value', 'align' => 'right'],
                    ],
                    [
                        ['metric' => 'Total Revenue', 'value' => '$'.number_format((float) $summary['total_revenue'], 2)],
                        ['metric' => 'Total Orders', 'value' => (string) $summary['total_orders']],
                        ['metric' => 'Total Items Sold', 'value' => (string) $summary['total_items_sold']],
                        ['metric' => 'Average Order Value', 'value' => '$'.number_format((float) $summary['average_order_value'], 2)],
                        ['metric' => 'Total Customers', 'value' => (string) $summary['total_customers']],
                        ['metric' => 'Total Products', 'value' => (string) $summary['total_products']],
                    ],
                ];
        }
    }

    /**
     * @param  array<int, array<string, string>>  $headers
     * @param  array<int, array<string, mixed>>  $rows
     */
    protected function spreadsheet(string $viewName, array $headers, array $rows, bool $styled): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle(substr($viewName, 0, 31));

        $column = 1;
        foreach ($headers as $header) {
            $sheet->setCellValueExplicit([$column, 1], $header['label'], DataType::TYPE_STRING);
            $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($column))->setAutoSize(true);
            $column++;
        }

        $lastColumn = Coordinate::stringFromColumnIndex(count($headers));
        $sheet->getStyle("A1:{$lastColumn}1")->getFont()->setBold(true);
        if ($styled) {
            $sheet->getStyle("A1:{$lastColumn}1")->getFont()->getColor()->setRGB('FFFFFF');
            $sheet->getStyle("A1:{$lastColumn}1")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('1B362A');
        }

        $rowIndex = 2;
        foreach ($rows as $row) {
            $column = 1;
            foreach ($headers as $header) {
                $sheet->setCellValueExplicit([$column, $rowIndex], (string) ($row[$header['key']] ?? ''), DataType::TYPE_STRING);
                $column++;
            }
            $rowIndex++;
        }

        return $spreadsheet;
    }

    /**
     * @return array<string, mixed>
     */
    protected function filtersFrom(Request $request): array
    {
        return [
            'status' => $request->query('status'),
            'year' => $request->query('year'),
            'month' => $request->query('month'),
            'start_date' => $request->query('start_date'),
            'end_date' => $request->query('end_date'),
            'customer_id' => $request->query('customer_id'),
            'product_id' => $request->query('product_id'),
        ];
    }

    protected function limitFrom(Request $request): int
    {
        return max(1, min((int) $request->query('top', 10), 50));
    }

    /**
     * @return array<string, string>
     */
    protected function filtersDescription(Request $request): array
    {
        $month = $request->query('month');
        $monthName = ($month && $month !== 'all')
            ? (ReportService::MONTHS[(int) $month - 1]['name'] ?? 'All Months')
            : 'All Months';

        return [
            'year' => ($request->filled('year') && $request->query('year') !== 'all') ? (string) $request->query('year') : 'All Years',
            'month' => $monthName,
            'date_range' => ($request->filled('start_date') || $request->filled('end_date'))
                ? (($request->query('start_date') ?? 'Start').' to '.($request->query('end_date') ?? 'Present'))
                : 'All Time History',
            'status' => ($request->filled('status') && $request->query('status') !== 'all') ? ucfirst((string) $request->query('status')) : 'All Statuses',
        ];
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
