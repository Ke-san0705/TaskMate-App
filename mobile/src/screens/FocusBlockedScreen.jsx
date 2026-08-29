const React = require('react');
const {
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View
} = require('react-native');
const { SafeAreaView } = require('react-native-safe-area-context');
const { useTaskMate } = require('../context/TaskMateContext');
const { ROUTES } = require('../constants/routes');
const { colors, radius, spacing, typography } = require('../theme/taskMateTheme');

function findBlockedAppName(activeSession, packageName) {
  const matched = activeSession?.blockedApps?.find((app) => app.packageName === packageName);
  return matched?.appName || matched?.packageName || '制限対象アプリ';
}

function formatDuration(startedAt) {
  const started = startedAt ? new Date(startedAt).getTime() : NaN;
  if (!Number.isFinite(started)) {
    return '00:00:00';
  }
  const totalSeconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function FocusBlockedScreen({ navigation, route }) {
  const { focusState } = useTaskMate();
  const activeSession = focusState.activeSession;
  const packageName = route.params?.packageName || '';
  const appName = findBlockedAppName(activeSession, packageName);
  const [elapsed, setElapsed] = React.useState(() => formatDuration(activeSession?.startedAt));

  const returnToTaskMate = React.useCallback(() => {
    navigation.navigate(ROUTES.Tabs, { screen: ROUTES.Home });
  }, [navigation]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(formatDuration(activeSession?.startedAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeSession?.startedAt]);

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      returnToTaskMate();
      return true;
    });
    return () => subscription.remove();
  }, [returnToTaskMate]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>TASKMATE</Text>
        <View style={styles.card}>
          {activeSession ? (
            <>
              <Text style={styles.appName}>{appName}</Text>
              <Text style={styles.blockedLabel}>このアプリは現在制限されています。</Text>
              <Text style={styles.command}>
                持ち場に戻れ。{'\n'}お前の居場所はここではない。
              </Text>
              <View style={styles.divider} />
              <Text style={styles.label}>現在の任務</Text>
              <Text style={styles.taskTitle}>{activeSession.taskTitle}</Text>
              <Text style={styles.label}>集中時間</Text>
              <Text style={styles.timer}>{elapsed}</Text>
            </>
          ) : (
            <>
              <Text style={styles.message}>集中は終了しています。</Text>
              <Text style={styles.body}>ホームで今日のタスクを確認できます。</Text>
            </>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="TaskMateに戻る"
          style={styles.primaryButton}
          onPress={returnToTaskMate}
        >
          <Text style={styles.primaryText}>TaskMateに戻る</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#111A14'
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.screen,
    gap: spacing.section
  },
  eyebrow: {
    ...typography.eyebrow,
    color: '#DCEBDD',
    letterSpacing: 0,
    textAlign: 'center'
  },
  card: {
    padding: 22,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(246, 250, 244, 0.2)',
    backgroundColor: '#F6FAF4',
    gap: 14
  },
  appName: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 38,
    textAlign: 'center'
  },
  blockedLabel: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center'
  },
  command: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 35,
    textAlign: 'center'
  },
  divider: {
    height: 1,
    backgroundColor: colors.border
  },
  label: {
    ...typography.eyebrow,
    color: colors.textMuted,
    letterSpacing: 0
  },
  taskTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 28
  },
  timer: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36
  },
  message: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 30
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23
  },
  primaryButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.primary
  },
  primaryText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900'
  }
});

module.exports = FocusBlockedScreen;
