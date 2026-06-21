const React = require('react');
const { Pressable, ScrollView, StyleSheet, Text, TextInput, View } = require('react-native');
const { SafeAreaView } = require('react-native-safe-area-context');
const EmptyState = require('../components/EmptyState');
const ErrorBanner = require('../components/ErrorBanner');
const TaskCard = require('../components/TaskCard');
const { useTaskMate } = require('../context/TaskMateContext');
const { ROUTES } = require('../constants/routes');

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

        <TextInput
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
    backgroundColor: '#F6FAF3'
  },
  container: {
    padding: 16,
    gap: 16,
    paddingBottom: 120
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  eyebrow: {
    color: '#5E6F60',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1
  },
  title: {
    color: '#1F2A22',
    fontSize: 28,
    fontWeight: '900'
  },
  addButton: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#315C3A'
  },
  addText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  search: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B9C8B7',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 15
  },
  section: {
    gap: 10
  },
  sectionTitle: {
    color: '#1F2A22',
    fontSize: 18,
    fontWeight: '900'
  },
  count: {
    color: '#5E6F60',
    fontSize: 14
  },
  list: {
    gap: 10
  }
});

module.exports = TasksScreen;
