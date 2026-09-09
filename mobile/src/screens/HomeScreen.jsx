const React = require('react');
const { Alert, Pressable, ScrollView, StyleSheet, Text, View } = require('react-native');
const { SafeAreaView } = require('react-native-safe-area-context');
const CharacterView = require('../components/CharacterView');
const DialogueBubble = require('../components/DialogueBubble');
const EmptyState = require('../components/EmptyState');
const ErrorBanner = require('../components/ErrorBanner');
const FocusTaskCard = require('../components/FocusTaskCard');
const UndoSnackbar = require('../components/UndoSnackbar');
const { useTaskMate } = require('../context/TaskMateContext');
const { ROUTES } = require('../constants/routes');
const { formatTaskTime } = require('../utils/localDate');
const { colors, radius, shadows, spacing, typography } = require('../theme/taskMateTheme');

function formatDuration(startedAt, now) {
  const started = startedAt ? new Date(startedAt).getTime() : NaN;
  if (!Number.isFinite(started)) {
    return '00:00:00';
  }
  const totalSeconds = Math.max(0, Math.floor((now.getTime() - started) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function TaskRow({ task, onComplete, onOpen }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}を開く`}
      onPress={() => onOpen(task)}
      style={styles.taskRow}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${task.title}を完了する`}
        onPress={() => onComplete(task.id)}
        style={[styles.checkbox, task.completed && styles.checkboxDone]}
      >
        <Text style={styles.checkboxText}>{task.completed ? '✓' : ''}</Text>
      </Pressable>
      <View style={styles.taskText}>
        <Text style={[styles.taskTitle, task.completed && styles.taskTitleDone]}>
          {task.title}
        </Text>
        <Text style={styles.taskMeta}>
          {task.date} / {formatTaskTime(task)} {task.genre ? `/ ${task.genre}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

function HomeScreen({ navigation }) {
  const {
    clearFocusTask,
    clock,
    completeTask,
    dialogue,
    error,
    expireUndoItem,
    finishFocusSession,
    focusPermissions,
    focusState,
    focusTask,
    openAccessibilitySettings,
    progress,
    selectedCharacter,
    setError,
    setFocusTask,
    settings,
    taskGroups,
    tasks,
    undoCompleteTask,
    undoItem
  } = useTaskMate();

  const activeSession = focusState.activeSession;
  const restrictionNeedsAccessibility =
    activeSession?.blockedApps?.length > 0 && settings?.focusRestrictionEnabled !== false;
  const restrictionUnavailable =
    Boolean(restrictionNeedsAccessibility) && !focusPermissions.accessibility;
  const todayItems = React.useMemo(
    () => [...taskGroups.overdue, ...taskGroups.today].slice(0, 6),
    [taskGroups.overdue, taskGroups.today]
  );
  const suggestedTask =
    todayItems.find((task) => !task.completed) || tasks.find((task) => !task.completed);

  function openFocusSetup(task = null) {
    navigation.navigate(ROUTES.FocusSetup, task ? { taskId: task.id } : undefined);
  }

  function confirmCompleteFocus() {
    Alert.alert('このタスクは完了しましたか？', activeSession.taskTitle, [
      { text: 'まだ', style: 'cancel' },
      { text: '完了', onPress: () => finishFocusSession(true) }
    ]);
  }

  if (activeSession) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.focusContainer}>
          <ErrorBanner message={error} onClose={() => setError('')} />
          <View style={styles.focusHeader}>
            <Text style={styles.eyebrow}>TASKMATE</Text>
            <Text style={styles.focusStatus}>集中中</Text>
          </View>
          <View style={styles.focusHero}>
            <View style={styles.focusCharacter}>
              <CharacterView character={selectedCharacter} mood="focus" size={150} />
            </View>
            <Text style={styles.focusTitle}>{activeSession.taskTitle}</Text>
            <Text style={styles.timer}>{formatDuration(activeSession.startedAt, clock)}</Text>
            <View style={styles.blockedList}>
              {activeSession.blockedApps.length > 0 ? (
                activeSession.blockedApps.map((app) => (
                  <Text key={app.packageName} style={styles.blockedBadge}>
                    {app.appName}
                  </Text>
                ))
              ) : (
                <Text style={styles.blockedEmpty}>制限アプリなし</Text>
              )}
            </View>
            {restrictionUnavailable ? (
              <View style={styles.focusWarning}>
                <Text style={styles.focusWarningTitle}>アプリ制限は一時停止中</Text>
                <Text style={styles.focusWarningText}>
                  ユーザー補助サービスが無効です。タスクとタイマーは続いていますが、対象アプリへの介入は有効化後に再開します。
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="ユーザー補助設定を開く"
                  style={styles.warningButton}
                  onPress={openAccessibilitySettings}
                >
                  <Text style={styles.warningButtonText}>ユーザー補助設定を開く</Text>
                </Pressable>
              </View>
            ) : null}
            <Text style={styles.blockedText}>
              {restrictionUnavailable
                ? 'ユーザー補助サービスを有効にすると制限できます'
                : 'を制限しています'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="集中タスクを完了する"
              style={styles.completeButton}
              onPress={confirmCompleteFocus}
            >
              <Text style={styles.completeButtonText}>タスクを完了</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="集中を中断する"
              style={styles.cancelFocusButton}
              onPress={() => finishFocusSession(false)}
            >
              <Text style={styles.cancelFocusText}>集中を中断</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} onClose={() => setError('')} />
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TASKMATE</Text>
            <Text style={styles.title}>今日</Text>
          </View>
          <View style={styles.counter}>
            <Text style={styles.counterNumber}>{progress.completed} / {progress.total}</Text>
            <Text style={styles.counterLabel}>完了</Text>
          </View>
        </View>

        <View style={styles.guideRow}>
          <View style={styles.dialogueWrap}>
            <DialogueBubble text={dialogue} />
          </View>
          <CharacterView character={selectedCharacter} mood={focusTask ? 'focus' : 'wait'} size={86} />
        </View>

        {focusTask ? (
          <FocusTaskCard
            task={focusTask}
            onComplete={completeTask}
            onClear={clearFocusTask}
            onDetails={(task) => navigation.navigate(ROUTES.TaskEdit, { taskId: task.id })}
            onStart={openFocusSetup}
          />
        ) : suggestedTask ? (
          <View style={styles.nowCard}>
            <Text style={styles.eyebrow}>今やる</Text>
            <Text style={styles.nowTitle}>{suggestedTask.title}</Text>
            <Text style={styles.nowMeta}>
              {suggestedTask.date} / {formatTaskTime(suggestedTask)}
            </Text>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${suggestedTask.title}を今やるにする`}
                style={styles.primaryButton}
                onPress={() => setFocusTask(suggestedTask.id)}
              >
                <Text style={styles.primaryText}>今やるにする</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${suggestedTask.title}の集中を始める`}
                style={styles.secondaryButton}
                onPress={() => openFocusSetup(suggestedTask)}
              >
                <Text style={styles.secondaryText}>集中を始める</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <EmptyState title="今日やることを追加してみよう" body="1件だけ入れるとすぐ集中を始められます。" />
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>今日のタスク</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="タスク一覧を開く"
            onPress={() => navigation.navigate(ROUTES.Tasks)}
          >
            <Text style={styles.linkText}>一覧</Text>
          </Pressable>
        </View>

        {todayItems.length > 0 ? (
          <View style={styles.todayList}>
            {todayItems.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onComplete={completeTask}
                onOpen={(selected) => navigation.navigate(ROUTES.TaskEdit, { taskId: selected.id })}
              />
            ))}
          </View>
        ) : (
          <EmptyState title="今日のタスクはありません" body="必要なものだけ追加しましょう。" />
        )}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="タスクを追加する"
            style={styles.primaryButton}
            onPress={() => navigation.navigate(ROUTES.TaskEdit)}
          >
            <Text style={styles.primaryText}>＋ タスク追加</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="集中モードを開く"
            style={styles.secondaryButton}
            onPress={() => openFocusSetup(focusTask)}
          >
            <Text style={styles.secondaryText}>集中モード</Text>
          </Pressable>
        </View>
      </ScrollView>
      <UndoSnackbar item={undoItem} onUndo={undoCompleteTask} onExpire={expireUndoItem} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  container: {
    padding: spacing.screen,
    gap: spacing.section,
    paddingBottom: spacing.bottomTabPadding
  },
  focusContainer: {
    flexGrow: 1,
    padding: spacing.screen,
    gap: spacing.section,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14
  },
  focusHeader: {
    gap: 4
  },
  eyebrow: {
    ...typography.eyebrow,
    letterSpacing: 0
  },
  title: {
    ...typography.screenTitle
  },
  counter: {
    minWidth: 108,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft
  },
  counterNumber: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900'
  },
  counterLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700'
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  dialogueWrap: {
    flex: 1
  },
  nowCard: {
    padding: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    gap: 8,
    ...shadows.card
  },
  nowTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900'
  },
  nowMeta: {
    color: colors.textMuted,
    fontSize: 13
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  sectionTitle: {
    ...typography.sectionTitle
  },
  linkText: {
    color: colors.primary,
    fontWeight: '900'
  },
  todayList: {
    gap: 8
  },
  taskRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  checkboxText: {
    color: colors.white,
    fontWeight: '900'
  },
  taskText: {
    flex: 1,
    minWidth: 0
  },
  taskTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900'
  },
  taskTitleDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through'
  },
  taskMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12
  },
  actions: {
    flexDirection: 'row',
    gap: 10
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    padding: 13,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    padding: 13,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: '900'
  },
  focusStatus: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900'
  },
  focusHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 18
  },
  focusCharacter: {
    transform: [{ scale: 0.84 }]
  },
  focusTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center'
  },
  timer: {
    color: colors.primary,
    fontSize: 42,
    fontWeight: '900',
    fontVariant: ['tabular-nums']
  },
  blockedList: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8
  },
  blockedBadge: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: radius.sm,
    overflow: 'hidden',
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    fontWeight: '900'
  },
  blockedEmpty: {
    color: colors.textMuted,
    fontWeight: '800'
  },
  blockedText: {
    color: colors.textMuted,
    fontWeight: '800'
  },
  focusWarning: {
    alignSelf: 'stretch',
    padding: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#E2C66E',
    backgroundColor: colors.warningBg,
    gap: 8
  },
  focusWarningTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900'
  },
  focusWarningText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19
  },
  warningButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong
  },
  warningButtonText: {
    color: colors.primary,
    fontWeight: '900'
  },
  completeButton: {
    alignSelf: 'stretch',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.primary
  },
  completeButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900'
  },
  cancelFocusButton: {
    padding: 12
  },
  cancelFocusText: {
    color: colors.textMuted,
    fontWeight: '900'
  }
});

module.exports = HomeScreen;
