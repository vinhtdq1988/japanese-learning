import 'package:flutter/material.dart';

import '../../domain/admin_unit_draft.dart';
import '../../l10n/app_localizations.dart';
import 'admin_support.dart';

/// Hai ô văn bản dịch vi + en cạnh nhau, ghi thẳng vào [I18nDraft].
class I18nFields extends StatelessWidget {
  const I18nFields({
    super.key,
    required this.owner,
    required this.slot,
    required this.value,
    required this.labelVi,
    required this.labelEn,
    this.maxLines = 1,
  });

  /// Đối tượng sở hữu + tên ô, ghép thành khóa ổn định để ô không bị dựng lại khi danh sách đổi.
  final Object owner;
  final String slot;
  final I18nDraft value;
  final String labelVi;
  final String labelEn;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Expanded(
          child: DraftTextField(
            key: ValueKey<Object>((owner, '$slot-vi')),
            label: labelVi,
            value: value.vi,
            maxLines: maxLines,
            onChanged: (v) => value.vi = v,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: DraftTextField(
            key: ValueKey<Object>((owner, '$slot-en')),
            label: labelEn,
            value: value.en,
            maxLines: maxLines,
            onChanged: (v) => value.en = v,
          ),
        ),
      ],
    );
  }
}

/// Khối tiêu đề của một phần tử: tên, công tắc "hiển thị với người học" (phần tử đã có – KHÔNG xóa cứng,
/// chỉ chuyển `inactive`) hoặc nút bỏ (phần tử mới chưa lưu).
class _ElementHeader extends StatelessWidget {
  const _ElementHeader({
    required this.title,
    required this.isNew,
    required this.active,
    required this.onActiveChanged,
    required this.onRemove,
    required this.switchKey,
    required this.removeKey,
  });

  final String title;
  final bool isNew;
  final bool active;
  final ValueChanged<bool> onActiveChanged;
  final VoidCallback onRemove;
  final Key switchKey;
  final Key removeKey;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Row(
      children: <Widget>[
        Expanded(
          child: Text(title, style: Theme.of(context).textTheme.titleSmall),
        ),
        if (isNew)
          IconButton(
            key: removeKey,
            tooltip: l10n.adminRemoveNew,
            onPressed: onRemove,
            icon: const Icon(Icons.delete_outline),
          )
        else ...<Widget>[
          Text(l10n.adminElementActive),
          Switch(key: switchKey, value: active, onChanged: onActiveChanged),
        ],
      ],
    );
  }
}

/// Soạn một mục nội dung (từ vựng hoặc điểm ngữ pháp) cùng các câu ví dụ.
class ItemEditorCard extends StatelessWidget {
  const ItemEditorCard({
    super.key,
    required this.item,
    required this.index,
    required this.kind,
    required this.onStructureChanged,
    required this.onRemove,
  });

  final ItemDraft item;
  final int index;
  final String kind;
  final VoidCallback onStructureChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isGrammar = kind == 'grammar';
    return Card(
      key: Key('item-$index'),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            _ElementHeader(
              title: l10n.adminItemTitle(index + 1),
              isNew: item.id == null,
              active: item.active,
              onActiveChanged: (v) {
                item.active = v;
                onStructureChanged();
              },
              onRemove: onRemove,
              switchKey: Key('item-active-$index'),
              removeKey: Key('item-remove-$index'),
            ),
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: DraftTextField(
                    key: ValueKey<Object>((item, 'japanese')),
                    label: l10n.adminItemJapanese,
                    value: item.japanese,
                    onChanged: (v) {
                      // Nhãn trong danh sách chọn mục của bài tập phụ thuộc chữ Nhật.
                      item.japanese = v;
                      onStructureChanged();
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DraftTextField(
                    key: ValueKey<Object>((item, 'reading')),
                    label: l10n.adminItemReading,
                    value: item.reading,
                    onChanged: (v) => item.reading = v,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            I18nFields(
              owner: item,
              slot: 'meaning',
              value: item.meaning,
              labelVi: l10n.adminItemMeaningVi,
              labelEn: l10n.adminItemMeaningEn,
            ),
            if (isGrammar) ...<Widget>[
              const SizedBox(height: 8),
              I18nFields(
                owner: item,
                slot: 'explanation',
                value: item.explanation,
                labelVi: l10n.adminItemExplanationVi,
                labelEn: l10n.adminItemExplanationEn,
                maxLines: 4,
              ),
            ],
            const SizedBox(height: 12),
            Text(
              l10n.adminExamplesHeading,
              style: Theme.of(context).textTheme.labelLarge,
            ),
            for (var e = 0; e < item.examples.length; e++)
              _ExampleEditor(
                key: ObjectKey(item.examples[e]),
                example: item.examples[e],
                onRemove: () {
                  item.examples.removeAt(e);
                  onStructureChanged();
                },
              ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                key: Key('example-add-$index'),
                onPressed: () {
                  item.examples.add(ExampleDraft());
                  onStructureChanged();
                },
                icon: const Icon(Icons.add),
                label: Text(l10n.adminExampleAdd),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExampleEditor extends StatelessWidget {
  const _ExampleEditor({
    super.key,
    required this.example,
    required this.onRemove,
  });

  final ExampleDraft example;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 8, left: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(
            child: Column(
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: DraftTextField(
                        key: ValueKey<Object>((example, 'ja')),
                        label: l10n.adminExampleJa,
                        value: example.ja,
                        onChanged: (v) => example.ja = v,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DraftTextField(
                        key: ValueKey<Object>((example, 'reading')),
                        label: l10n.adminExampleReading,
                        value: example.reading,
                        onChanged: (v) => example.reading = v,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                I18nFields(
                  owner: example,
                  slot: 'translation',
                  value: example.translation,
                  labelVi: l10n.adminExampleTranslationVi,
                  labelEn: l10n.adminExampleTranslationEn,
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: l10n.adminRemoveNew,
            onPressed: onRemove,
            icon: const Icon(Icons.close),
          ),
        ],
      ),
    );
  }
}

/// Soạn một bài tập: loại, mục được kiểm tra, câu hỏi, đáp án theo loại và phản hồi đúng/sai.
class ExerciseEditorCard extends StatelessWidget {
  const ExerciseEditorCard({
    super.key,
    required this.exercise,
    required this.index,
    required this.items,
    required this.onStructureChanged,
    required this.onRemove,
  });

  final ExerciseDraft exercise;
  final int index;
  final List<ItemDraft> items;
  final VoidCallback onStructureChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final ex = exercise;
    return Card(
      key: Key('exercise-$index'),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            _ElementHeader(
              title: l10n.adminExerciseTitle(index + 1),
              isNew: ex.id == null,
              active: ex.active,
              onActiveChanged: (v) {
                ex.active = v;
                onStructureChanged();
              },
              onRemove: onRemove,
              switchKey: Key('exercise-active-$index'),
              removeKey: Key('exercise-remove-$index'),
            ),
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: DropdownButtonFormField<String>(
                    key: ValueKey<Object>((ex, 'type', ex.type)),
                    initialValue: ex.type,
                    isDense: true,
                    decoration: InputDecoration(
                      labelText: l10n.adminExerciseType,
                      isDense: true,
                    ),
                    items: <DropdownMenuItem<String>>[
                      for (final t in kExerciseTypes)
                        DropdownMenuItem<String>(
                          value: t,
                          child: Text(exerciseTypeLabel(l10n, t)),
                        ),
                    ],
                    onChanged: (v) {
                      if (v == null) return;
                      ex.changeType(v);
                      ex.revision += 1;
                      onStructureChanged();
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<ItemDraft?>(
                    key: ValueKey<Object>((ex, 'item', items.length, ex.item)),
                    initialValue: items.contains(ex.item) ? ex.item : null,
                    isDense: true,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: l10n.adminExerciseItem,
                      isDense: true,
                    ),
                    items: <DropdownMenuItem<ItemDraft?>>[
                      DropdownMenuItem<ItemDraft?>(
                        value: null,
                        child: Text(l10n.adminExerciseNoItem),
                      ),
                      for (var i = 0; i < items.length; i++)
                        DropdownMenuItem<ItemDraft?>(
                          value: items[i],
                          child: Text(
                            '${i + 1}. ${items[i].japanese}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged: (v) => ex.item = v,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            I18nFields(
              owner: ex,
              slot: 'prompt',
              value: ex.prompt,
              labelVi: l10n.adminExercisePromptVi,
              labelEn: l10n.adminExercisePromptEn,
              maxLines: 2,
            ),
            const SizedBox(height: 12),
            KeyedSubtree(
              key: ValueKey<Object>((ex, 'payload', ex.revision)),
              child: _PayloadEditor(
                exercise: ex,
                onStructureChanged: () {
                  ex.revision += 1;
                  onStructureChanged();
                },
              ),
            ),
            const SizedBox(height: 12),
            I18nFields(
              owner: ex,
              slot: 'feedbackCorrect',
              value: ex.feedbackCorrect,
              labelVi: l10n.adminFeedbackCorrectVi,
              labelEn: l10n.adminFeedbackCorrectEn,
            ),
            const SizedBox(height: 8),
            I18nFields(
              owner: ex,
              slot: 'feedbackIncorrect',
              value: ex.feedbackIncorrect,
              labelVi: l10n.adminFeedbackIncorrectVi,
              labelEn: l10n.adminFeedbackIncorrectEn,
            ),
          ],
        ),
      ),
    );
  }
}

/// Đáp án của bài tập theo loại; rơi về JSON thô khi payload hiện có không biểu diễn được bằng form.
class _PayloadEditor extends StatelessWidget {
  const _PayloadEditor({
    required this.exercise,
    required this.onStructureChanged,
  });

  final ExerciseDraft exercise;
  final VoidCallback onStructureChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final ex = exercise;

    if (ex.rawPayload != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.adminPayloadRawNote,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 8),
          DraftTextField(
            key: ValueKey<Object>((ex, 'raw')),
            label: l10n.adminPayloadRawLabel,
            value: ex.rawPayload!,
            maxLines: 8,
            onChanged: (v) => ex.rawPayload = v,
          ),
        ],
      );
    }

    switch (ex.type) {
      case 'matching':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            for (var i = 0; i < ex.pairs.length; i++)
              Padding(
                key: ObjectKey(ex.pairs[i]),
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: DraftTextField(
                        key: ValueKey<Object>((ex.pairs[i], 'left')),
                        label: l10n.adminPairLeft,
                        value: ex.pairs[i].left,
                        onChanged: (v) => ex.pairs[i].left = v,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DraftTextField(
                        key: ValueKey<Object>((ex.pairs[i], 'right')),
                        label: l10n.adminPairRight,
                        value: ex.pairs[i].right,
                        onChanged: (v) => ex.pairs[i].right = v,
                      ),
                    ),
                    IconButton(
                      onPressed: ex.pairs.length <= 2
                          ? null
                          : () {
                              ex.pairs.removeAt(i);
                              onStructureChanged();
                            },
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
            TextButton.icon(
              onPressed: () {
                ex.pairs.add(PairDraft());
                onStructureChanged();
              },
              icon: const Icon(Icons.add),
              label: Text(l10n.adminPairAdd),
            ),
          ],
        );
      case 'fill_blank':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            for (var i = 0; i < ex.acceptedAnswers.length; i++)
              Padding(
                key: ValueKey<Object>((ex, 'answer-row', i)),
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: DraftTextField(
                        key: ValueKey<Object>((ex, 'answer', i)),
                        label: l10n.adminAnswerLabel,
                        value: ex.acceptedAnswers[i],
                        onChanged: (v) => ex.acceptedAnswers[i] = v,
                      ),
                    ),
                    IconButton(
                      onPressed: ex.acceptedAnswers.length <= 1
                          ? null
                          : () {
                              ex.acceptedAnswers.removeAt(i);
                              onStructureChanged();
                            },
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
            TextButton.icon(
              onPressed: () {
                ex.acceptedAnswers.add('');
                onStructureChanged();
              },
              icon: const Icon(Icons.add),
              label: Text(l10n.adminAnswerAdd),
            ),
          ],
        );
      default:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            for (var i = 0; i < ex.choices.length; i++)
              Padding(
                key: ValueKey<Object>((ex, 'choice-row', i)),
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: <Widget>[
                    IconButton(
                      key: Key('choice-correct-${ex.hashCode}-$i'),
                      tooltip: l10n.adminChoiceCorrect,
                      onPressed: () {
                        ex.correctIndex = i;
                        onStructureChanged();
                      },
                      icon: Icon(
                        ex.correctIndex == i
                            ? Icons.check_circle
                            : Icons.radio_button_unchecked,
                        color: ex.correctIndex == i
                            ? Theme.of(context).colorScheme.primary
                            : null,
                      ),
                    ),
                    Expanded(
                      child: DraftTextField(
                        key: ValueKey<Object>((ex, 'choice', i)),
                        label: l10n.adminChoiceLabel(i + 1),
                        value: ex.choices[i],
                        onChanged: (v) => ex.choices[i] = v,
                      ),
                    ),
                    IconButton(
                      onPressed: ex.choices.length <= 2
                          ? null
                          : () {
                              ex.choices.removeAt(i);
                              if (ex.correctIndex >= ex.choices.length) {
                                ex.correctIndex = ex.choices.length - 1;
                              } else if (ex.correctIndex > i) {
                                ex.correctIndex -= 1;
                              }
                              onStructureChanged();
                            },
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
            TextButton.icon(
              onPressed: ex.choices.length >= 6
                  ? null
                  : () {
                      ex.choices.add('');
                      onStructureChanged();
                    },
              icon: const Icon(Icons.add),
              label: Text(l10n.adminChoiceAdd),
            ),
          ],
        );
    }
  }
}
