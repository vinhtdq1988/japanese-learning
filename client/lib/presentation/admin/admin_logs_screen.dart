import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/admin_repository.dart';
import '../../data/api/api_error.dart';
import '../../domain/admin_models.dart';
import '../../l10n/app_localizations.dart';
import '../shared/state_views.dart';
import 'admin_support.dart';

/// Nhật ký hành động quản trị (T108, FR-032): ai làm gì, lên đối tượng nào, khi nào và thay đổi trước/sau
/// (server đã loại thông tin nhạy cảm). Mới nhất trước; phân trang bằng "Tải thêm".
class AdminLogsScreen extends ConsumerStatefulWidget {
  const AdminLogsScreen({super.key});

  @override
  ConsumerState<AdminLogsScreen> createState() => _AdminLogsScreenState();
}

class _AdminLogsScreenState extends ConsumerState<AdminLogsScreen> {
  final List<AdminLogEntry> _entries = <AdminLogEntry>[];
  String? _nextCursor;
  bool _loading = true;
  bool _loadingMore = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool more = false}) async {
    setState(() {
      if (more) {
        _loadingMore = true;
      } else {
        _loading = true;
        _error = null;
      }
    });
    try {
      final page = await ref
          .read(adminRepositoryProvider)
          .actionLogs(cursor: more ? _nextCursor : null);
      if (!mounted) return;
      setState(() {
        if (!more) _entries.clear();
        _entries.addAll(page.items);
        _nextCursor = page.nextCursor;
      });
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AdminFrame(
      section: AdminSection.logs,
      child: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorView(error: _error, onRetry: _load)
          : _entries.isEmpty
          ? EmptyView(icon: Icons.history, title: l10n.adminLogsEmpty)
          : ListView(
              children: <Widget>[
                for (final entry in _entries) _LogTile(entry: entry),
                if (_nextCursor != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Center(
                      child: OutlinedButton(
                        key: const Key('log-load-more'),
                        onPressed: _loadingMore
                            ? null
                            : () => _load(more: true),
                        child: Text(l10n.adminLoadMore),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}

class _LogTile extends StatelessWidget {
  const _LogTile({required this.entry});

  final AdminLogEntry entry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final actor = entry.actorId ?? l10n.adminLogsSystem;
    final diff = entry.diff;
    return Card(
      key: Key('log-${entry.id}'),
      child: ExpansionTile(
        title: Text(entry.action),
        subtitle: Text(
          '${formatDateTime(entry.occurredAt)} · ${l10n.adminLogsBy(actor)} · '
          '${entry.targetType}${entry.targetId == null ? '' : ' ${entry.targetId}'}',
        ),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        expandedCrossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if (diff == null || diff.isEmpty)
            Text(l10n.adminLogsDiffNone)
          else
            SelectableText(
              const JsonEncoder.withIndent('  ').convert(diff),
              style: const TextStyle(fontFamily: 'monospace'),
            ),
        ],
      ),
    );
  }
}
