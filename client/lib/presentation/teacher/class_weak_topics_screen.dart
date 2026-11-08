import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:japanese_api/japanese_api.dart';

import '../../data/api/api_error.dart';
import '../../data/api_providers.dart';
import '../../data/class_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../router_paths.dart';
import '../shared/page_frame.dart';
import '../shared/state_views.dart';
import 'class_dashboard_screen.dart' show formatRatio;

/// Chủ đề yếu của cả lớp (spec 004, US7, FR-032): chủ đề có độ chính xác gộp thấp kể từ lúc từng học viên vào
/// lớp, xếp mức yếu giảm dần, kèm số học viên bị gắn cờ và (khi mở) tên họ. Chỉ là số liệu tổng hợp — không có
/// từng câu trả lời (FR-035).
class ClassWeakTopicsScreen extends ConsumerStatefulWidget {
  const ClassWeakTopicsScreen({super.key, required this.classId});

  final String classId;

  @override
  ConsumerState<ClassWeakTopicsScreen> createState() =>
      _ClassWeakTopicsScreenState();
}

class _ClassWeakTopicsScreenState extends ConsumerState<ClassWeakTopicsScreen> {
  List<ClassWeakTopic>? _topics;
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _topics == null;
      _error = null;
    });
    try {
      final topics = await ref
          .read(classRepositoryProvider)
          .weakTopics(widget.classId);
      if (mounted) setState(() => _topics = topics);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PageFrame(
      title: l10n.classWeakTopicsTitle,
      actions: <Widget>[
        TextButton.icon(
          key: const Key('weak-topics-back'),
          onPressed: () => context.go('${AppRoutes.classes}/${widget.classId}'),
          icon: const Icon(Icons.arrow_back),
          label: Text(l10n.classWeakTopicsBack),
        ),
      ],
      child: _loading && _topics == null
          ? const LoadingView()
          : _error != null && _topics == null
          ? ErrorView(error: _error, onRetry: _load)
          : _content(l10n, _topics!),
    );
  }

  Widget _content(AppLocalizations l10n, List<ClassWeakTopic> topics) {
    final theme = Theme.of(context);
    return ListView(
      children: <Widget>[
        Text(l10n.classWeakTopicsIntro, style: theme.textTheme.bodySmall),
        const SizedBox(height: 12),
        if (topics.isEmpty)
          Text(l10n.classWeakTopicsEmpty, key: const Key('weak-topics-empty')),
        for (final topic in topics)
          Card(
            key: Key('weak-topic-${topic.topicId}'),
            child: ExpansionTile(
              title: Text(topic.name),
              subtitle: Text(
                '${l10n.classWeakTopicsAccuracy(formatRatio(topic.accuracy), topic.answers)}'
                ' · ${l10n.classWeakTopicsFlagged(topic.flaggedLearners.length)}',
              ),
              children: <Widget>[
                for (final learner in topic.flaggedLearners)
                  ListTile(
                    key: Key('weak-topic-${topic.topicId}-${learner.userId}'),
                    dense: true,
                    title: Text(learner.displayName),
                    onTap: () => context.go(
                      '${AppRoutes.classes}/${widget.classId}/learners/${learner.userId}',
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}
