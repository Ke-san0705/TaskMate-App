const React = require('react');
const { Pressable, ScrollView, StyleSheet, Text, View } = require('react-native');
const { SafeAreaView } = require('react-native-safe-area-context');
const AmbientStateLayer = require('../components/AmbientStateLayer');
const CharacterView = require('../components/CharacterView');
const DialogueBubble = require('../components/DialogueBubble');
const EmptyState = require('../components/EmptyState');
const ErrorBanner = require('../components/ErrorBanner');
const FocusTaskCard = require('../components/FocusTaskCard');
const UndoSnackbar = require('../components/UndoSnackbar');
const { useTaskMate } = require('../context/TaskMateContext');
const { ROUTES } = require('../constants/routes');

function HomeScreen({ navigation }) {
  const {
    behavior,
    clearFocusTask,
    completeTask,
    dialogue,
    error,
    expireUndoItem,
    lifeState,
    selectedCharacter,
    setError,
    settings,
    taskGroups,
    tasks,
    undoCompleteTask,
    undoItem
  } = useTaskMate();

  const focusTask = React.useMemo(() => {
    if (!lifeState?.focusTaskId) {
      return null;
    }
    return tasks.find((task) => task.id === lifeState.focusTaskId && !task.completed) || null;
  }, [lifeState?.focusTaskId, tasks]);
  const todayCount = taskGroups.today.length + taskGroups.overdue.length;

  return (
    <SafeAreaView style={styles.safe}>
      <AmbientStateLayer
        mood={behavior?.mood}
        level={behavior?.ambientLevel || 0}
        enabled={settings?.ambientEffects !== false}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} onClose={() => setError('')} />
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TASKMATE MOBILE</Text>
            <Text style={styles.title}>今日を一つずつ</Text>
          </View>
          <View style={styles.counter}>
            <Text style={styles.counterNumber}>{todayCount}</Text>
            <Text style={styles.counterLabel}>今日見る予定</Text>
          </View>
        </View>

        <DialogueBubble text={dialogue} />
        <CharacterView character={selectedCharacter} mood={behavior?.mood || 'calm'} />

        {focusTask ? (
          <FocusTaskCard
            task={focusTask}
            onComplete={completeTask}
            onClear={clearFocusTask}
            onDetails={(task) => navigation.navigate(ROUTES.TaskEdit, { taskId: task.id })}
          />
        ) : behavior?.targetTaskId ? (
          <View style={styles.suggestion}>
            <Text style={styles.suggestionTitle}>今やる候補</Text>
            <Text style={styles.suggestionBody}>
              まず一件だけ選ぶと、画面の情報量を減らせます。
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="タスク一覧で今やる予定を選ぶ"
              style={styles.secondaryButton}
              onPress={() => navigation.navigate(ROUTES.Tasks)}
            >
              <Text style={styles.secondaryText}>一覧から選ぶ</Text>
            </Pressable>
          </View>
        ) : (
          <EmptyState title="今は落ち着いています" body="予定が増えたらここに一件だけ表示します。" />
        )}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="タスクを追加する"
            style={styles.primaryButton}
            onPress={() => navigation.navigate(ROUTES.TaskEdit)}
          >
            <Text style={styles.primaryText}>タスク追加</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="タスク一覧を開く"
            style={styles.secondaryButton}
            onPress={() => navigation.navigate(ROUTES.Tasks)}
          >
            <Text style={styles.secondaryText}>一覧を見る</Text>
          </Pressable>
        </View>
      </ScrollView>
      <UndoSnackbar
        item={undoItem}
        onUndo={undoCompleteTask}
        onExpire={expireUndoItem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#EEF5EA'
  },
  container: {
    padding: 16,
    gap: 16,
    paddingBottom: 120
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14
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
  counter: {
    minWidth: 92,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D5DED3'
  },
  counterNumber: {
    color: '#315C3A',
    fontSize: 24,
    fontWeight: '900'
  },
  counterLabel: {
    color: '#5E6F60',
    fontSize: 11,
    fontWeight: '700'
  },
  suggestion: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DED3',
    gap: 8
  },
  suggestionTitle: {
    color: '#1F2A22',
    fontSize: 16,
    fontWeight: '900'
  },
  suggestionBody: {
    color: '#516052',
    lineHeight: 20
  },
  actions: {
    flexDirection: 'row',
    gap: 10
  },
  primaryButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#315C3A'
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  secondaryButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#9AAE98',
    backgroundColor: '#FFFFFF'
  },
  secondaryText: {
    color: '#315C3A',
    fontWeight: '900'
  }
});

module.exports = HomeScreen;
