const React = require('react');
const {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} = require('react-native');
const { SafeAreaView } = require('react-native-safe-area-context');
const { localDateKey } = require('@taskmate/core');
const ErrorBanner = require('../components/ErrorBanner');
const JapaneseTextInput = require('../components/JapaneseTextInput');
const { useTaskMate } = require('../context/TaskMateContext');
const { ROUTES } = require('../constants/routes');
const {
  ACCESSIBILITY_DISCLOSURE,
  hasAcceptedAccessibilityDisclosure
} = require('../constants/focusDisclosure');
const { FALLBACK_BLOCKED_APPS } = require('../services/focusNativeModule');
const { formatTaskTime } = require('../utils/localDate');
const { colors, radius, shadows, spacing, typography } = require('../theme/taskMateTheme');

function appKey(app) {
  return app.packageName;
}

function mergeApps(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const app of list || []) {
      if (app?.packageName) {
        map.set(app.packageName, {
          packageName: app.packageName,
          appName: app.appName || app.packageName
        });
      }
    }
  }
  return [...map.values()].sort((left, right) => left.appName.localeCompare(right.appName, 'ja'));
}

function FocusSetupScreen({ navigation, route }) {
  const {
    createTask,
    error,
    focusPermissions,
    focusState,
    installedApps,
    loadInstalledApps,
    openAccessibilitySettings,
    refreshFocusPermissions,
    setError,
    settings,
    startFocusSession,
    tasks,
    updateSettings
  } = useTaskMate();
  const initialTaskId = route.params?.taskId || focusState.currentTaskId || null;
  const incompleteTasks = React.useMemo(
    () => tasks.filter((task) => !task.completed),
    [tasks]
  );
  const [selectedTaskId, setSelectedTaskId] = React.useState(
    initialTaskId || incompleteTasks[0]?.id || ''
  );
  const [newTaskTitle, setNewTaskTitle] = React.useState('');
  const [appFilter, setAppFilter] = React.useState('');
  const initialApps = mergeApps(
    settings?.defaultBlockedApps,
    focusState.blockedApps.filter((app) => app.enabled),
    FALLBACK_BLOCKED_APPS
  );
  const [selectedApps, setSelectedApps] = React.useState(initialApps);
  const selectedPackages = React.useMemo(
    () => new Set(selectedApps.map((app) => app.packageName)),
    [selectedApps]
  );
  const disclosureAccepted = hasAcceptedAccessibilityDisclosure(settings);
  const [consentChecked, setConsentChecked] = React.useState(disclosureAccepted);

  React.useEffect(() => {
    if (disclosureAccepted) {
      loadInstalledApps().catch((loadError) => setError(String(loadError.message || loadError)));
    }
    refreshFocusPermissions().catch((permissionError) =>
      setError(String(permissionError.message || permissionError))
    );
  }, [disclosureAccepted, loadInstalledApps, refreshFocusPermissions, setError]);

  React.useEffect(() => {
    if (disclosureAccepted) {
      setConsentChecked(true);
    }
  }, [disclosureAccepted]);

  React.useEffect(() => {
    if (!selectedTaskId && incompleteTasks[0]?.id) {
      setSelectedTaskId(incompleteTasks[0].id);
    }
  }, [incompleteTasks, selectedTaskId]);

  const appChoices = React.useMemo(() => {
    const normalizedFilter = appFilter.trim().toLowerCase();
    return mergeApps(selectedApps, disclosureAccepted ? installedApps : [], FALLBACK_BLOCKED_APPS)
      .filter((app) =>
        normalizedFilter
          ? `${app.appName} ${app.packageName}`.toLowerCase().includes(normalizedFilter)
          : true
      )
      .slice(0, 80);
  }, [appFilter, disclosureAccepted, installedApps, selectedApps]);

  async function createQuickTask() {
    const title = newTaskTitle.trim();
    if (!title) {
      return;
    }
    const task = await createTask({
      title,
      description: '',
      date: localDateKey(new Date()),
      time: null,
      genre: '',
      priority: 'normal'
    });
    setSelectedTaskId(task.id);
    setNewTaskTitle('');
  }

  function toggleApp(app) {
    setSelectedApps((current) => {
      if (current.some((item) => item.packageName === app.packageName)) {
        return current.filter((item) => item.packageName !== app.packageName);
      }
      return [...current, app].sort((left, right) =>
        left.appName.localeCompare(right.appName, 'ja')
      );
    });
  }

  async function beginFocus() {
    if (!selectedTaskId) {
      Alert.alert('タスクを選んでください', '集中するタスクを1件選びます。');
      return;
    }
    if (
      settings?.focusRestrictionEnabled !== false &&
      selectedApps.length > 0 &&
      !disclosureAccepted
    ) {
      Alert.alert(
        '同意が必要です',
        'アプリ制限を使うには、ユーザー補助の利用説明を確認して同意してください。'
      );
      return;
    }
    await startFocusSession(selectedTaskId, selectedApps);
    navigation.navigate(ROUTES.Tabs, { screen: ROUTES.Home });
  }

  async function acceptAndOpenAccessibility() {
    if (!disclosureAccepted && !consentChecked) {
      Alert.alert('確認してください', ACCESSIBILITY_DISCLOSURE.consentLabel);
      return;
    }
    if (!disclosureAccepted) {
      await updateSettings({
        focusAccessibilityDisclosureAcceptedAt: new Date().toISOString()
      });
      await loadInstalledApps();
    }
    await openAccessibilitySettings();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} onClose={() => setError('')} />
        <Text style={styles.eyebrow}>FOCUS</Text>
        <Text style={styles.title}>集中を始める</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>取り組むタスク</Text>
          {incompleteTasks.length > 0 ? (
            <View style={styles.choiceList}>
              {incompleteTasks.slice(0, 20).map((task) => {
                const selected = selectedTaskId === task.id;
                return (
                  <Pressable
                    key={task.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${task.title}を集中タスクにする`}
                    style={[styles.taskChoice, selected && styles.choiceSelected]}
                    onPress={() => setSelectedTaskId(task.id)}
                  >
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <Text style={styles.radioText}>✓</Text> : null}
                    </View>
                    <View style={styles.choiceText}>
                      <Text style={styles.choiceTitle}>{task.title}</Text>
                      <Text style={styles.choiceMeta}>{task.date} / {formatTaskTime(task)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.bodyText}>未完了タスクがまだありません。</Text>
          )}

          <View style={styles.quickAdd}>
            <JapaneseTextInput
              accessibilityLabel="新しい集中タスク名"
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              placeholder="その場でタスクを作成"
              style={styles.input}
              maxLength={100}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="新しい集中タスクを追加する"
              style={styles.secondaryButton}
              onPress={createQuickTask}
            >
              <Text style={styles.secondaryText}>追加</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>制限するアプリ</Text>
          <JapaneseTextInput
            accessibilityLabel="制限するアプリを検索する"
            value={appFilter}
            onChangeText={setAppFilter}
            placeholder="Instagram、YouTubeなど"
            style={styles.input}
          />
          <View style={styles.appList}>
            {appChoices.map((app) => {
              const selected = selectedPackages.has(app.packageName);
              return (
                <Pressable
                  key={appKey(app)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${app.appName}を制限対象にする`}
                  style={[styles.appChoice, selected && styles.choiceSelected]}
                  onPress={() => toggleApp(app)}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected ? <Text style={styles.checkboxText}>✓</Text> : null}
                  </View>
                  <View style={styles.choiceText}>
                    <Text style={styles.choiceTitle}>{app.appName}</Text>
                    <Text style={styles.choiceMeta}>{app.packageName}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>アプリ制限</Text>
          <View style={styles.permissionRow}>
            <View style={styles.choiceText}>
              <Text style={styles.choiceTitle}>制限機能</Text>
              <Text style={styles.choiceMeta}>ONのときだけ、集中中に対象アプリへ介入します。</Text>
            </View>
            <Switch
              accessibilityLabel="アプリ制限を有効にする"
              value={settings?.focusRestrictionEnabled !== false}
              onValueChange={(value) => updateSettings({ focusRestrictionEnabled: value })}
            />
          </View>
          <View style={styles.permissionRow}>
            <View style={styles.choiceText}>
              <Text style={styles.choiceTitle}>{ACCESSIBILITY_DISCLOSURE.title}</Text>
              {ACCESSIBILITY_DISCLOSURE.paragraphs.map((paragraph) => (
                <Text key={paragraph} style={styles.disclosureText}>
                  {paragraph}
                </Text>
              ))}
            </View>
          </View>
          {disclosureAccepted ? (
            <Text style={styles.acceptedText}>同意済みです。必要なときだけ設定を開けます。</Text>
          ) : (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consentChecked }}
              accessibilityLabel={ACCESSIBILITY_DISCLOSURE.consentLabel}
              style={styles.consentRow}
              onPress={() => setConsentChecked((current) => !current)}
            >
              <View style={[styles.checkbox, consentChecked && styles.checkboxSelected]}>
                {consentChecked ? <Text style={styles.checkboxText}>✓</Text> : null}
              </View>
              <Text style={styles.consentText}>{ACCESSIBILITY_DISCLOSURE.consentLabel}</Text>
            </Pressable>
          )}
          <View style={styles.permissionRow}>
            <View style={styles.choiceText}>
              <Text style={styles.choiceTitle}>ユーザー補助サービス</Text>
              <Text style={styles.choiceMeta}>
                {focusPermissions.accessibility ? '有効です' : '対象アプリの検知に必要です'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                disclosureAccepted ? 'ユーザー補助設定を開く' : '同意してユーザー補助設定を開く'
              }
              style={styles.secondaryButton}
              onPress={acceptAndOpenAccessibility}
            >
              <Text style={styles.secondaryText}>設定</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="集中を開始する"
          style={styles.primaryButton}
          onPress={beginFocus}
        >
          <Text style={styles.primaryText}>集中開始</Text>
        </Pressable>
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
  eyebrow: {
    ...typography.eyebrow,
    letterSpacing: 0
  },
  title: {
    ...typography.screenTitle
  },
  card: {
    padding: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 12,
    ...shadows.soft
  },
  sectionTitle: {
    ...typography.sectionTitle
  },
  bodyText: {
    color: colors.textMuted,
    lineHeight: 20
  },
  choiceList: {
    gap: 8
  },
  taskChoice: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  radioText: {
    color: colors.white,
    fontWeight: '900'
  },
  choiceText: {
    flex: 1,
    minWidth: 0
  },
  choiceTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900'
  },
  choiceMeta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  quickAdd: {
    flexDirection: 'row',
    gap: 8
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: colors.card,
    fontSize: 15
  },
  appList: {
    gap: 8
  },
  appChoice: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  checkboxText: {
    color: colors.white,
    fontWeight: '900'
  },
  permissionRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  disclosureText: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20
  },
  consentRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cardSoft
  },
  consentText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19
  },
  acceptedText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19
  },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.primary
  },
  primaryText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900'
  },
  secondaryButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: '900'
  }
});

module.exports = FocusSetupScreen;
