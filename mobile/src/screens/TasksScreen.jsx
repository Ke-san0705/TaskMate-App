const React = require('react');
const { Pressable, ScrollView, StyleSheet, Text, View } = require('react-native');
const { SafeAreaView } = require('react-native-safe-area-context');
const EmptyState = require('../components/EmptyState');
const ErrorBanner = require('../components/ErrorBanner');
const JapaneseTextInput = require('../components/JapaneseTextInput');
const TaskCard = require('../components/TaskCard');
const { useTaskMate } = require('../context/TaskMateContext');
const { ROUTES } = require('../constants/routes');
const { colors, radius, spacing, typography } = require('../theme/taskMateTheme');

function Section({ title, tasks, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title} <Text style={styles.count}>{tasks.length}</Text>
      </Text>
      {tasks.length === 0 ? (
        <EmptyState title="ここは空です" body="必要になったら自動で分類されます。" />
      ) : (
        children
      )}
    </View>
  );
}

function TasksScreen({ navigation }) {
  const {
    completeTask,
    deleteTask,
    error,
    lifeState,
    setError,
    setFocusTask,
    taskGroups,
    undoCompleteTask
  } = useTaskMate();
  const [filter, setFilter] = React.useState('');
  const normalizedFilter = filter.trim().toLowerCase();

  function visible(items) {
    if (!normalizedFilter) {
      return items;
    }
    return items.filter((task) =>
      `${task.title} ${task.description} ${task.genre}`.toLowerCase().includes(normalizedFilter)
    );
  }

  const sections = [
    ['期限超過', visible(taskGroups.overdue)],
    ['今日', visible(taskGroups.today)],
    ['これから', visible(taskGroups.future)],
    ['完了済み', visible(taskGroups.completed)]
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} onClose={() => setError('')} />
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TASKS</Text>
            <Text style={styles.title}>タスク</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="タスクを追加する"
            style={styles.addButton}
            onPress={() => navigation.navigate(ROUTES.TaskEdit)}
          >
            <Text style={styles.addText}>追加</Text>
          </Pressable>
        </View>

        <JapaneseTextInput
          accessibilityLabel="タスクを絞り込む"
          value={filter}
          onChangeText={setFilter}
          placeholder="タスク名、説明、ジャンルで絞り込み"
          style={styles.search}
        />

        {sections.map(([title, items]) => (
          <Section key={title} title={title} tasks={items}>
            <View style={styles.list}>
              {items.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  focusTaskId={lifeState?.focusTaskId}
                  onComplete={completeTask}
                  onUndo={undoCompleteTask}
                  onDelete={deleteTask}
                  onFocus={setFocusTask}
                  onEdit={(selected) =>
                    navigation.navigate(ROUTES.TaskEdit, { taskId: selected.id })
                  }
                />
              ))}
            </View>
          </Section>
        ))}
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
  search: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 15
  },
  section: {
    gap: 10
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  count: {
    color: colors.textMuted,
    fontSize: 14
  },
  list: {
    gap: 10
  }
});

module.exports = TasksScreen;
