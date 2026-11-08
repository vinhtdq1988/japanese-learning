import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';

/// Một cột của [SortableTable]: nhãn, hàm so sánh để sắp xếp (bỏ trống ⇒ cột không sắp xếp được) và cách
/// dựng ô.
class SortableColumn<T> {
  const SortableColumn({
    required this.id,
    required this.label,
    required this.cell,
    this.compare,
    this.numeric = false,
  });

  /// Dùng làm khóa kiểm thử (`Key('col-<id>')`).
  final String id;
  final String label;
  final Widget Function(BuildContext context, T row) cell;

  /// So sánh hai dòng theo cột này; `null` ⇒ không sắp xếp được.
  final int Function(T a, T b)? compare;
  final bool numeric;
}

/// Một bộ lọc nhanh (chip) của [SortableTable]: giữ lại các dòng thỏa [test].
class TableFilter<T> {
  const TableFilter({
    required this.id,
    required this.label,
    required this.test,
  });

  final String id;
  final String label;
  final bool Function(T row) test;
}

/// Bảng có sắp xếp và lọc dùng chung (spec 004, T076): bảng điều khiển lớp (US4) và các danh sách quản trị.
/// Bấm tiêu đề cột để sắp xếp tăng/giảm, chip để lọc; trạng thái sắp xếp/lọc nằm trong widget nên không đổi
/// dữ liệu gốc. Tối ưu cho desktop (spec, Giả định).
class SortableTable<T> extends StatefulWidget {
  const SortableTable({
    super.key,
    required this.columns,
    required this.rows,
    this.filters = const [],
    this.initialSortId,
    this.initialAscending = true,
    this.onRowTap,
    this.rowKey,
  });

  final List<SortableColumn<T>> columns;
  final List<T> rows;
  final List<TableFilter<T>> filters;
  final String? initialSortId;
  final bool initialAscending;
  final void Function(T row)? onRowTap;

  /// Khóa ổn định cho mỗi dòng (kiểm thử và giữ trạng thái).
  final LocalKey Function(T row)? rowKey;

  @override
  State<SortableTable<T>> createState() => _SortableTableState<T>();
}

class _SortableTableState<T> extends State<SortableTable<T>> {
  String? _sortId;
  late bool _ascending;
  String? _filterId;

  @override
  void initState() {
    super.initState();
    _sortId = widget.initialSortId;
    _ascending = widget.initialAscending;
  }

  List<T> get _visible {
    var rows = List<T>.of(widget.rows);
    final filterId = _filterId;
    if (filterId != null) {
      final filter = widget.filters.firstWhere((f) => f.id == filterId);
      rows = rows.where(filter.test).toList();
    }
    final sort = widget.columns.where((c) => c.id == _sortId).firstOrNull;
    final compare = sort?.compare;
    if (compare != null) {
      rows.sort((a, b) => _ascending ? compare(a, b) : compare(b, a));
    }
    return rows;
  }

  void _onSort(SortableColumn<T> column) {
    if (column.compare == null) return;
    setState(() {
      if (_sortId == column.id) {
        _ascending = !_ascending;
      } else {
        _sortId = column.id;
        _ascending = true;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final rows = _visible;
    final sortIndex = widget.columns.indexWhere((c) => c.id == _sortId);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        if (widget.filters.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: <Widget>[
                ChoiceChip(
                  key: const Key('filter-all'),
                  label: Text(l10n.tableFilterAll),
                  selected: _filterId == null,
                  onSelected: (_) => setState(() => _filterId = null),
                ),
                for (final f in widget.filters)
                  ChoiceChip(
                    key: Key('filter-${f.id}'),
                    label: Text(f.label),
                    selected: _filterId == f.id,
                    onSelected: (_) => setState(() => _filterId = f.id),
                  ),
              ],
            ),
          ),
        if (rows.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Text(l10n.tableEmpty, key: const Key('table-empty')),
          )
        else
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              sortColumnIndex: sortIndex < 0 ? null : sortIndex,
              sortAscending: _ascending,
              showCheckboxColumn: false,
              columns: <DataColumn>[
                for (final c in widget.columns)
                  DataColumn(
                    label: Text(c.label, key: Key('col-${c.id}')),
                    numeric: c.numeric,
                    tooltip: c.compare == null
                        ? null
                        : (_sortId == c.id && _ascending
                              ? l10n.tableSortDescending(c.label)
                              : l10n.tableSortAscending(c.label)),
                    onSort: c.compare == null ? null : (_, __) => _onSort(c),
                  ),
              ],
              rows: <DataRow>[
                for (final row in rows)
                  DataRow(
                    key: widget.rowKey?.call(row),
                    onSelectChanged: widget.onRowTap == null
                        ? null
                        : (_) => widget.onRowTap!(row),
                    cells: <DataCell>[
                      for (final c in widget.columns)
                        DataCell(c.cell(context, row)),
                    ],
                  ),
              ],
            ),
          ),
      ],
    );
  }
}
