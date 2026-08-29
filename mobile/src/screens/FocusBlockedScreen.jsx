const React = require('react');
const {
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

function FocusBlockedScreen({ navigation, route }) {
  const { focusState } = useTaskMate();
  const activeSession = focusState.activeSession;
  const packageName = route.params?.packageName || '';
  const appName = findBlockedAppName(activeSession, packageName);

  function returnToTaskMate() {
    navigation.navigate(ROUTES.Tabs, { screen: ROUTES.Home });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>FOCUS</Text>
        <Text style={styles.title}>集中中</Text>
        <View style={styles.card}>
          {activeSession ? (
            <>
              <Text style={styles.message}>
                「{activeSession.taskTitle}」がまだ終わっていません。
              </Text>
              <Text style={styles.body}>
                今は{appName}ではなくTaskMateに戻りましょう。
              </Text>
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
    backgroundColor: colors.backgroundSoft
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.screen,
    gap: spacing.section
  },
  eyebrow: {
    ...typography.eyebrow,
    letterSpacing: 0
  },
  title: {
    ...typography.heroTitle,
    color: colors.text
  },
  card: {
    padding: 18,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 12
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
