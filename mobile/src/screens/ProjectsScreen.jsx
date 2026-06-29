const React = require('react');
const { Alert, Pressable, ScrollView, StyleSheet, Text, View } = require('react-native');
const { SafeAreaView } = require('react-native-safe-area-context');
const DateWheelInput = require('../components/DateWheelInput');
const EmptyState = require('../components/EmptyState');
const ErrorBanner = require('../components/ErrorBanner');
const JapaneseTextInput = require('../components/JapaneseTextInput');
const { useTaskMate } = require('../context/TaskMateContext');
const { ROUTES } = require('../constants/routes');
const {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS
} = require('../utils/projectCalculations');
const { colors, radius, shadows, spacing, typography } = require('../theme/taskMateTheme');

function todayKey() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function createInitialForm(categories) {
  return {
    name: '',
    categoryId: categories[0]?.id || 'category-other',
    startDate: todayKey(),
    deadline: todayKey(),
    priority: 'medium',
    estimatedTotalMinutes: '120',
    description: ''
  };
}

function createInitialCategoryForm() {
  return {
    name: '',
    description: ''
  };
}

function calmRiskMessage(risk) {
  if (risk?.level === 'danger') {
    return '少し小さく分けると進めやすいです。';
  }
  if (risk?.level === 'warning') {
    return '今日少し進めると安心です。';
  }
  return '今のペースなら大丈夫です。';
}

function ProjectsScreen({ navigation }) {
  const {
    createProject,
    createProjectCategory,
    deleteProjectCategory,
    error,
    projectState,
    setError,
    updateProjectCategory
  } = useTaskMate();
  const [formOpen, setFormOpen] = React.useState(false);
  const [categoryOpen, setCategoryOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState(() => createInitialForm(projectState.categories));
  const [categoryForm, setCategoryForm] = React.useState(createInitialCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = React.useState(null);

  React.useEffect(() => {
    setForm((current) => ({
      ...current,
      categoryId: current.categoryId || projectState.categories[0]?.id || 'category-other'
    }));
  }, [projectState.categories]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitProject() {
    setSaving(true);
    try {
      const project = await createProject({
        ...form,
        estimatedTotalMinutes: Number(form.estimatedTotalMinutes || 0)
      });
      setForm(createInitialForm(projectState.categories));
      setFormOpen(false);
      navigation.navigate(ROUTES.ProjectDetail, { projectId: project.id });
    } finally {
      setSaving(false);
    }
  }

  async function submitCategory() {
    setSaving(true);
    try {
      if (editingCategoryId) {
        await updateProjectCategory(editingCategoryId, categoryForm);
      } else {
        const category = await createProjectCategory(categoryForm);
        update('categoryId', category.id);
      }
      setCategoryForm(createInitialCategoryForm());
      setEditingCategoryId(null);
    } finally {
      setSaving(false);
    }
  }

  function startEditCategory(category) {
    setCategoryOpen(true);
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name || '',
      description: category.description || ''
    });
  }

  function confirmDeleteCategory(category) {
    Alert.alert(
      'ジャンルを削除しますか？',
      `「${category.name}」を削除します。所属プロジェクトは別ジャンルへ移動します。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => deleteProjectCategory(category.id)
        }
      ]
    );
  }

  const activeSummaries = projectState.summaries.filter(
    (summary) => summary.project.status !== 'completed'
  );
  const completedSummaries = projectState.summaries.filter(
    (summary) => summary.project.status === 'completed'
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} onClose={() => setError('')} />
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>LONG PROJECTS</Text>
            <Text style={styles.title}>長期</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="プロジェクトを追加する"
            style={styles.addButton}
            onPress={() => setFormOpen((value) => !value)}
          >
            <Text style={styles.addText}>{formOpen ? '閉じる' : '追加'}</Text>
          </Pressable>
        </View>

        <View style={styles.categoryPanel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.sectionTitle}>ジャンル</Text>
              <Text style={styles.meta}>PC版と同じ分類をここで管理できます。</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              style={styles.secondaryButton}
              onPress={() => setCategoryOpen((value) => !value)}
            >
              <Text style={styles.secondaryText}>{categoryOpen ? '閉じる' : '管理'}</Text>
            </Pressable>
          </View>
          {categoryOpen ? (
            <View style={styles.form}>
              <JapaneseTextInput
                accessibilityLabel="ジャンル名"
                value={categoryForm.name}
                onChangeText={(value) =>
                  setCategoryForm((current) => ({ ...current, name: value }))
                }
                placeholder="例: 個人開発"
                style={styles.input}
                maxLength={80}
              />
              <JapaneseTextInput
                accessibilityLabel="ジャンル説明"
                value={categoryForm.description}
                onChangeText={(value) =>
                  setCategoryForm((current) => ({ ...current, description: value }))
                }
                placeholder="説明"
                style={[styles.input, styles.textareaSmall]}
                multiline
                maxLength={1000}
              />
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                style={styles.primaryButton}
                onPress={submitCategory}
              >
                <Text style={styles.primaryText}>
                  {editingCategoryId ? 'ジャンルを保存' : 'ジャンルを追加'}
                </Text>
              </Pressable>
              {editingCategoryId ? (
                <Pressable
                  accessibilityRole="button"
                  style={styles.secondaryButton}
                  onPress={() => {
                    setEditingCategoryId(null);
                    setCategoryForm(createInitialCategoryForm());
                  }}
                >
                  <Text style={styles.secondaryText}>編集をキャンセル</Text>
                </Pressable>
              ) : null}
              <View style={styles.categoryList}>
                {projectState.categories.map((category) => (
                  <View key={category.id} style={styles.categoryRow}>
                    <View style={styles.categoryText}>
                      <Text style={styles.categoryName}>{category.name}</Text>
                      <Text style={styles.meta}>{category.description || '説明なし'}</Text>
                    </View>
                    <Pressable style={styles.textButton} onPress={() => startEditCategory(category)}>
                      <Text style={styles.secondaryText}>編集</Text>
                    </Pressable>
                    <Pressable style={styles.textButton} onPress={() => confirmDeleteCategory(category)}>
                      <Text style={styles.dangerText}>削除</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {formOpen ? (
          <View style={styles.form}>
            <Text style={styles.formTitle}>プロジェクトを追加</Text>
            <JapaneseTextInput
              accessibilityLabel="プロジェクト名"
              value={form.name}
              onChangeText={(value) => update('name', value)}
              placeholder="例: レポート提出まで"
              style={styles.input}
              maxLength={120}
            />
            <ScrollView
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.segmentScrollContent}
            >
              {projectState.categories.map((category) => (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  onPress={() => update('categoryId', category.id)}
                  style={[
                    styles.segmentButton,
                    styles.categorySegmentButton,
                    form.categoryId === category.id && styles.segmentActive
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      form.categoryId === category.id && styles.segmentTextActive
                    ]}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <DateWheelInput
              accessibilityLabel="最終期限"
              value={form.startDate}
              onChange={(value) => update('startDate', value)}
              style={styles.input}
            />
            <DateWheelInput
              accessibilityLabel="開始日"
              value={form.deadline}
              onChange={(value) => update('deadline', value)}
              style={styles.input}
            />
            <JapaneseTextInput
              accessibilityLabel="予想総作業時間"
              value={form.estimatedTotalMinutes}
              onChangeText={(value) => update('estimatedTotalMinutes', value)}
              placeholder="120"
              style={styles.input}
              keyboardType="number-pad"
            />
            <View style={styles.segment}>
              {['low', 'medium', 'high', 'urgent'].map((priority) => (
                <Pressable
                  key={priority}
                  accessibilityRole="button"
                  onPress={() => update('priority', priority)}
                  style={[
                    styles.segmentButton,
                    form.priority === priority && styles.segmentActive
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      form.priority === priority && styles.segmentTextActive
                    ]}
                  >
                    {PROJECT_PRIORITY_LABELS[priority]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <JapaneseTextInput
              accessibilityLabel="プロジェクト説明"
              value={form.description}
              onChangeText={(value) => update('description', value)}
              placeholder="目的やメモ"
              style={[styles.input, styles.textarea]}
              multiline
              maxLength={3000}
            />
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              style={styles.primaryButton}
              onPress={submitProject}
            >
              <Text style={styles.primaryText}>{saving ? '保存中...' : '保存'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>進行中 {activeSummaries.length}</Text>
          {activeSummaries.length === 0 ? (
            <EmptyState title="長期プロジェクトは空です" body="大きめの予定を追加して、小さなTodoへ分けられます。" />
          ) : (
            activeSummaries.map((summary) => (
              <Pressable
                key={summary.project.id}
                accessibilityRole="button"
                accessibilityLabel={`${summary.project.name}を開く`}
                style={styles.card}
                onPress={() =>
                  navigation.navigate(ROUTES.ProjectDetail, { projectId: summary.project.id })
                }
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{summary.project.name}</Text>
                  <Text style={styles.badge}>{summary.project.progress}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.max(0, Math.min(100, summary.project.progress))}%` }
                    ]}
                  />
                </View>
                <Text style={styles.meta}>
                  {summary.category?.name || '未分類'} / {PROJECT_STATUS_LABELS[summary.project.status]} / 期限 {summary.project.deadline}
                </Text>
                <Text style={styles.risk}>{calmRiskMessage(summary.risk)}</Text>
                {summary.nextTask ? (
                  <Text style={styles.next}>次：{summary.nextTask.title}</Text>
                ) : (
                  <Text style={styles.next}>Todoを追加すると今日の候補を出せます。</Text>
                )}
              </Pressable>
            ))
          )}
        </View>

        {completedSummaries.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>完了済み {completedSummaries.length}</Text>
            {completedSummaries.map((summary) => (
              <Pressable
                key={summary.project.id}
                style={styles.card}
                onPress={() =>
                  navigation.navigate(ROUTES.ProjectDetail, { projectId: summary.project.id })
                }
              >
                <Text style={styles.cardTitle}>{summary.project.name}</Text>
                <Text style={styles.meta}>完了 / {summary.project.progress}%</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundSoft
  },
  container: {
    padding: spacing.screen,
    gap: spacing.section,
    paddingBottom: spacing.bottomTabPadding
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  eyebrow: {
    ...typography.eyebrow
  },
  title: {
    ...typography.screenTitle
  },
  addButton: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.primary
  },
  addText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  categoryPanel: {
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadows.soft
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  form: {
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadows.soft
  },
  formTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900'
  },
  input: {
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 15
  },
  textarea: {
    minHeight: 82,
    textAlignVertical: 'top'
  },
  textareaSmall: {
    minHeight: 66,
    textAlignVertical: 'top'
  },
  segment: {
    flexDirection: 'row',
    gap: 8
  },
  segmentScrollContent: {
    gap: 8,
    paddingHorizontal: 2
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center'
  },
  categorySegmentButton: {
    flex: 0,
    minWidth: 120,
    maxWidth: 190,
    paddingHorizontal: 12
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  segmentText: {
    color: colors.primary,
    fontWeight: '800'
  },
  segmentTextActive: {
    color: '#FFFFFF'
  },
  primaryButton: {
    padding: 13,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.primary
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: '900'
  },
  textButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radius.sm
  },
  dangerText: {
    color: colors.dangerText,
    fontWeight: '900'
  },
  section: {
    gap: 10
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  card: {
    gap: 8,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadows.card
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10
  },
  cardTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  badge: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900'
  },
  progressTrack: {
    height: 7,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: colors.primary
  },
  meta: {
    color: colors.textMuted,
    lineHeight: 20
  },
  categoryList: {
    gap: 8,
    marginTop: 4
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft
  },
  categoryText: {
    flex: 1
  },
  categoryName: {
    color: colors.text,
    fontWeight: '900'
  },
  risk: {
    color: colors.text,
    lineHeight: 20
  },
  next: {
    color: colors.primary,
    fontWeight: '800'
  }
});

module.exports = ProjectsScreen;
