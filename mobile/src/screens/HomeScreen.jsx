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
const { colors, radius, shadows, spacing, typography } = require('../theme/taskMateTheme');

function HomeScreen({ navigation }) {
  const {
    behavior,
    addProjectTaskToToday,
    clearFocusTask,
    completeTask,
    createTaskFromGoogleEvent,
    dialogue,
    error,
    googleCalendar,
    expireUndoItem,
    lifeState,
    selectedCharacter,
    setError,
    settings,
    projectState,
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
  const nextProjectTask = React.useMemo(
    () => projectState.summaries.find((summary) => summary.nextTask)?.nextTask || null,
    [projectState.summaries]
  );
  const googleEvents = React.useMemo(() => {
    if (googleCalendar?.settings?.showTodayOnHome === false) {
      return [];
    }
    return Array.isArray(googleCalendar?.events) ? googleCalendar.events.slice(0, 3) : [];
  }, [googleCalendar]);

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
        <View style={styles.characterStage}>
          <View style={styles.characterHaloLarge} />
          <View style={styles.characterHaloSmall} />
          <CharacterView character={selectedCharacter} mood={behavior?.mood || 'calm'} />
        </View>

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

        {nextProjectTask ? (
          <View style={styles.projectWidget}>
            <Text style={styles.projectWidgetEyebrow}>長期プロジェクト</Text>
            <Text style={styles.projectWidgetTitle}>{nextProjectTask.title}</Text>
            <Text style={styles.projectWidgetBody}>
              {nextProjectTask.project?.name || 'プロジェクト'}から、今日の一手にできます。
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="長期プロジェクトのTodoを今日へ送る"
              style={styles.secondaryButton}
              onPress={() => addProjectTaskToToday(nextProjectTask.id)}
            >
              <Text style={styles.secondaryText}>今日へ送る</Text>
            </Pressable>
          </View>
        ) : null}

        {googleEvents.length > 0 ? (
          <View style={styles.googleCalendarWidget}>
            <Text style={styles.projectWidgetEyebrow}>GOOGLE CALENDAR</Text>
            <Text style={styles.projectWidgetTitle}>今日のGoogle予定</Text>
            {googleEvents.map((event) => (
              <View key={event.key} style={styles.googleCalendarEvent}>
                <View style={styles.googleCalendarEventText}>
                  <Text style={styles.googleCalendarTime}>{event.startText || '終日'}</Text>
                  <Text style={styles.googleCalendarTitle}>{event.title}</Text>
                  <Text style={styles.googleCalendarMeta}>{event.calendarSummary}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${event.title}からTaskMateタスクを作成する`}
                  disabled={Boolean(event.taskId)}
                  style={[
                    styles.googleCalendarButton,
                    event.taskId && styles.googleCalendarButtonDisabled
                  ]}
                  onPress={() => createTaskFromGoogleEvent(event.key)}
                >
                  <Text style={styles.googleCalendarButtonText}>
                    {event.taskId ? '済' : '追加'}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

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
    backgroundColor: colors.background
  },
  container: {
    padding: spacing.screen,
    gap: spacing.section,
    paddingBottom: spacing.bottomTabPadding
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14
  },
  eyebrow: {
    ...typography.eyebrow
  },
  title: {
    ...typography.screenTitle
  },
  counter: {
    minWidth: 92,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft
  },
  counterNumber: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '900'
  },
  counterLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700'
  },
  characterStage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2
  },
  characterHaloLarge: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.primarySoft,
    opacity: 0.75
  },
  characterHaloSmall: {
    position: 'absolute',
    width: 62,
    height: 62,
    left: '23%',
    top: 16,
    borderRadius: 31,
    backgroundColor: colors.focusGlow,
    opacity: 0.58
  },
  suggestion: {
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 10,
    ...shadows.card
  },
  suggestionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  suggestionBody: {
    color: colors.textMuted,
    lineHeight: 20
  },
  projectWidget: {
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    ...shadows.soft
  },
  projectWidgetEyebrow: {
    ...typography.eyebrow
  },
  projectWidgetTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900'
  },
  projectWidgetBody: {
    color: colors.textMuted,
    lineHeight: 20
  },
  googleCalendarWidget: {
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 9,
    opacity: 0.92,
    ...shadows.soft
  },
  googleCalendarEvent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.cardSoft
  },
  googleCalendarEventText: {
    flex: 1,
    minWidth: 0
  },
  googleCalendarTime: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900'
  },
  googleCalendarTitle: {
    marginTop: 2,
    color: colors.text,
    fontSize: 15,
    fontWeight: '900'
  },
  googleCalendarMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700'
  },
  googleCalendarButton: {
    minWidth: 54,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  googleCalendarButtonDisabled: {
    opacity: 0.55
  },
  googleCalendarButtonText: {
    color: colors.primary,
    fontWeight: '900'
  },
  actions: {
    flexDirection: 'row',
    gap: 10
  },
  primaryButton: {
    flex: 1,
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.primary
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  secondaryButton: {
    flex: 1,
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: '900'
  }
});

module.exports = HomeScreen;
