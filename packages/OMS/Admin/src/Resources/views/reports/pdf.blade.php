<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $title ?? 'OMS Report' }}</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 20px;
            font-size: 11px;
            line-height: 1.4;
        }
        .header {
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 12px;
            margin-bottom: 16px;
        }
        .header-title {
            font-size: 20px;
            font-weight: bold;
            color: #312e81;
            margin: 0;
        }
        .header-sub {
            font-size: 11px;
            color: #64748b;
            margin-top: 3px;
        }
        .meta-bar {
            background-color: #eef2ff;
            padding: 8px 12px;
            border-radius: 4px;
            margin-bottom: 16px;
            font-size: 10px;
        }
        .meta-item {
            display: inline-block;
            margin-right: 18px;
        }
        .meta-label {
            font-weight: bold;
            color: #4338ca;
        }
        .kpi-container {
            margin-bottom: 16px;
            width: 100%;
        }
        .kpi-box {
            display: inline-block;
            width: 23%;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 8px;
            margin-right: 1%;
            vertical-align: top;
            box-sizing: border-box;
        }
        .kpi-title {
            font-size: 9px;
            text-transform: uppercase;
            font-weight: bold;
            color: #64748b;
        }
        .kpi-value {
            font-size: 14px;
            font-weight: bold;
            color: #312e81;
            margin-top: 4px;
        }
        .section-title {
            font-size: 13px;
            font-weight: bold;
            color: #0f172a;
            margin-top: 14px;
            margin-bottom: 8px;
            border-left: 3px solid #4f46e5;
            padding-left: 8px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
        }
        th {
            background-color: #4f46e5;
            color: #ffffff;
            font-weight: bold;
            font-size: 10px;
            text-transform: uppercase;
            padding: 6px 8px;
            text-align: left;
        }
        td {
            padding: 6px 8px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 10px;
        }
        tr:nth-child(even) td {
            background-color: #f8fafc;
        }
        .text-right {
            text-align: right;
        }
        .text-center {
            text-align: center;
        }
        .footer {
            margin-top: 24px;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
            font-size: 9px;
            color: #94a3b8;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="header-title">OMS Analytics &amp; Reports</h1>
        <div class="header-sub">Order Management Intelligence Report | Generated on {{ $generated_at }}</div>
    </div>

    <div class="meta-bar">
        <span class="meta-item"><span class="meta-label">Report View:</span> {{ $view_name }}</span>
        <span class="meta-item"><span class="meta-label">Year:</span> {{ $filters['year'] ?? 'All' }}</span>
        <span class="meta-item"><span class="meta-label">Month:</span> {{ $filters['month'] ?? 'All' }}</span>
        <span class="meta-item"><span class="meta-label">Date Range:</span> {{ $filters['date_range'] ?? 'Full History' }}</span>
        <span class="meta-item"><span class="meta-label">Status:</span> {{ $filters['status'] ?? 'All' }}</span>
    </div>

    @if(isset($summary))
    <div class="kpi-container">
        <div class="kpi-box">
            <div class="kpi-title">Total Revenue</div>
            <div class="kpi-value">${{ number_format($summary['total_revenue'] ?? 0, 2) }}</div>
        </div>
        <div class="kpi-box">
            <div class="kpi-title">Total Orders</div>
            <div class="kpi-value">{{ number_format($summary['total_orders'] ?? 0) }}</div>
        </div>
        <div class="kpi-box">
            <div class="kpi-title">Items Sold (Qty)</div>
            <div class="kpi-value">{{ number_format($summary['total_items_sold'] ?? 0) }}</div>
        </div>
        <div class="kpi-box">
            <div class="kpi-title">Avg Order Value</div>
            <div class="kpi-value">${{ number_format($summary['average_order_value'] ?? 0, 2) }}</div>
        </div>
    </div>
    @endif

    <div class="section-title">{{ $table_title }}</div>

    <table>
        <thead>
            <tr>
                @foreach($headers as $h)
                    <th class="{{ isset($h['align']) && $h['align'] === 'right' ? 'text-right' : (isset($h['align']) && $h['align'] === 'center' ? 'text-center' : '') }}">
                        {{ $h['label'] }}
                    </th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @forelse($rows as $row)
                <tr>
                    @foreach($headers as $h)
                        <td class="{{ isset($h['align']) && $h['align'] === 'right' ? 'text-right' : (isset($h['align']) && $h['align'] === 'center' ? 'text-center' : '') }}">
                            {{ $row[$h['key']] ?? '-' }}
                        </td>
                    @endforeach
                </tr>
            @empty
                <tr>
                    <td colspan="{{ count($headers) }}" class="text-center" style="padding: 16px; color: #64748b;">
                        No records found matching the specified report filters.
                    </td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">
        Confidential Document &bull; Generated by OMS Order Management System &bull; Page 1 of 1
    </div>
</body>
</html>
