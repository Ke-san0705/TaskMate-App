const React = require('react');
const { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } = require('react-native');
const { SafeAreaView } = require('react-native-safe-area-context');
const AccordionSection = require('../components/AccordionSection');
const ErrorBanner = require('../components/ErrorBanner');
const TimeWheelInput = require('../components/TimeWheelInput');
const UnlockModeSettingsCard = require('../components/UnlockModeSettingsCard');
const TaskInboxSettingsCard = require('../components/TaskInboxSettingsCard');
const { useTaskMate } = require('../context/TaskMateContext');
const { ROUTES } = require('../constants/routes');
const {
  ACCESSIBILITY_DISCLOSURE,
  hasAcceptedAccessibilityDisclosure
} = require('../constants/focusDisclosure');
const { colors, radius, shadows, spacing, typography } = require('../theme/taskMateTheme');

function Row({ title, body, children }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {body ? <Text style={styles.rowBody}>{body}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function StatusBadge({ enabled, enabledText, disabledText }) {
  return (
    <Text style={[styles.statusBadge, enabled ? styles.statusOn : styles.statusOff]}>
      {enabled ? enabledText : disabledText}
    </Text>
  );
}

function SettingsScreen({ navigation }) {
  const {
    deleteAllLocalData,
    error,
    focusPermissions,
    focusState,
    openAccessibilitySettings,
    requestNotifications,
    selectedCharacter,
    setError,
    settings,
    taskInbox,
    updateSettings
  } = useTaskMate();
  const [message, setMessage] = React.useState('');
  const disclosureAccepted = hasAcceptedAccessibilityDisclosure(settings);
  const [consentChecked, setConsentChecked] = React.useState(disclosureAccepted);

  React.useEffect(() => {
    if (disclosureAccepted) {
      setConsentChecked(true);
    }
  }, [disclosureAccepted]);

  if (!settings) {
    return null;
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
      setMessage('ユーザー補助の利用に同意しました。');
    }
    await openAccessibilitySettings();
  }

  async function toggle(key, value) {
    setMessage('');
    await updateSettings({ [key]: value });
  }

  async function updateQuietHours(partial) {
    await updateSettings({
      quietHours: {
        ...(settings.quietHours || {}),
        ...partial
      }
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} onClose={() => setError('')} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Text style={styles.eyebrow}>SETTINGS</Text>
        <Text style={styles.title}>設定</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>通知</Text>
          <Row
            title="通知"
            body="時刻ありタスクだけ、締切前と締切時刻にローカル通知を登録します。"
          >
            <Switch
              accessibilityLabel="通知を有効にする"
              value={settings.notificationsEnabled}
              onValueChange={(value) => toggle('notificationsEnabled', value)}
            />
          </Row>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="通知権限を確認する"
            style={styles.secondaryFull}
            onPress={async () => {
              const granted = await requestNotifications();
              setMessage(granted ? '通知が許可されました。' : '通知は許可されていません。');
            }}
          >
            <Text style={styles.secondaryText}>通知権限を確認</Text>
          </Pressable>
          <Text style={styles.label}>事前通知 分</Text>
          <TextInput
            accessibilityLabel="事前通知時間"
            value={String(settings.notificationMinutesBefore)}
            keyboardType="number-pad"
            onChangeText={(value) => {
              const minutes = Number(value);
              if (Number.isFinite(minutes)) {
                updateSettings({
                  notificationMinutesBefore: minutes,
                  notificationOffsets: [minutes, 0]
                });
              }
            }}
            style={styles.input}
          />
          <Row title="静かな時間帯" body="通知以外の案内を控えめにします。">
            <Switch
              accessibilityLabel="静かな時間帯を有効にする"
              value={settings.quietHours?.enabled !== false}
              onValueChange={(value) => updateQuietHours({ enabled: value })}
            />
          </Row>
          <View style={styles.timeRow}>
            <View style={styles.timeInput}>
              <Text style={styles.label}>開始</Text>
              <TimeWheelInput
                accessibilityLabel="静かな時間の開始"
                value={settings.quietHours?.start || '22:00'}
                onChange={(value) => updateQuietHours({ start: value || '22:00' })}
                style={styles.input}
              />
            </View>
            <View style={styles.timeInput}>
              <Text style={styles.label}>終了</Text>
              <TimeWheelInput
                accessibilityLabel="静かな時間の終了"
                value={settings.quietHours?.end || '07:00'}
                onChange={(value) => updateQuietHours({ end: value || '07:00' })}
                style={styles.input}
              />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>集中</Text>
          <Row title="アプリ制限" body="集中中に選んだアプリを開いたらTaskMateへ戻します。">
            <Switch
              accessibilityLabel="アプリ制限を有効にする"
              value={settings.focusRestrictionEnabled !== false}
              onValueChange={(value) => toggle('focusRestrictionEnabled', value)}
            />
          </Row>
          <View style={styles.permissionGrid}>
            <View style={styles.permissionItem}>
              <Text style={styles.permissionLabel}>ユーザー補助</Text>
              <StatusBadge
                enabled={focusPermissions.accessibility}
                enabledText="有効"
                disabledText="未設定"
              />
            </View>
          </View>
          <AccordionSection
            title="アプリ制限の権限・説明"
            summary={disclosureAccepted ? '利用説明に同意済み' : '有効化する前に確認してください'}
            defaultExpanded={!disclosureAccepted}
          >
            <Text style={styles.disclosureTitle}>{ACCESSIBILITY_DISCLOSURE.title}</Text>
            {ACCESSIBILITY_DISCLOSURE.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={styles.disclosureText}>
                {paragraph}
              </Text>
            ))}
            {disclosureAccepted ? (
              <Text style={styles.acceptedText}>同意済みです。</Text>
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                disclosureAccepted ? 'ユーザー補助設定を開く' : '同意してユーザー補助設定を開く'
              }
              style={styles.secondaryFull}
              onPress={acceptAndOpenAccessibility}
            >
              <Text style={styles.secondaryText}>ユーザー補助設定を開く</Text>
            </Pressable>
          </AccordionSection>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="制限するアプリを選ぶ"
            style={styles.primaryFull}
            onPress={() => navigation.navigate(ROUTES.FocusSetup)}
          >
            <Text style={styles.primaryText}>
              制限アプリを選ぶ {focusState.blockedApps.filter((app) => app.enabled).length}件
            </Text>
          </Pressable>
        </View>

        <UnlockModeSettingsCard />

        <TaskInboxSettingsCard inbox={taskInbox} />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>表示</Text>
          <Row title="モーション軽減" body="完了や画面切り替えの動きを控えめにします。">
            <Switch
              accessibilityLabel="モーション軽減を有効にする"
              value={settings.reduceMotion}
              onValueChange={(value) => toggle('reduceMotion', value)}
            />
          </Row>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>キャラクター</Text>
          <Text style={styles.privacy}>
            選択中: {selectedCharacter?.name || 'TaskMate'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="キャラクター画面を開く"
            style={styles.secondaryFull}
            onPress={() => navigation.navigate(ROUTES.Tabs, { screen: ROUTES.Characters })}
          >
            <Text style={styles.secondaryText}>キャラクターを選ぶ</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>データ</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="すべてのローカルデータを削除する"
            style={styles.dangerFull}
            onPress={() =>
              Alert.alert(
                'すべて削除しますか？',
                'タスク、設定、集中履歴、カスタムキャラクターと連携のログイン状態を端末から削除します。サーバーの受信箱と連携キーは残ります。',
                [
                  { text: 'キャンセル', style: 'cancel' },
                  { text: 'すべて削除', style: 'destructive', onPress: () => deleteAllLocalData().catch((reason) => Alert.alert('削除できませんでした', reason.message || 'もう一度お試しください。')) }
                ]
              )
            }
          >
            <Text style={styles.dangerText}>すべてのローカルデータを削除</Text>
          </Pressable>
          <Text style={styles.privacy}>
            タスク、集中状態、制限アプリは端末内に保存します。外部タスク連携を利用すると、
            連携元から届くタスクをSupabase経由で取得します。
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>アプリ情報</Text>
          <Text style={styles.privacy}>TaskMate Mobile 2.0.0</Text>
          <Text style={styles.privacy}>広告なし、アプリ内課金なし。外部連携の利用時のみアカウントが必要です。</Text>
        </View>
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
  message: {
    padding: 10,
    borderRadius: radius.sm,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    fontWeight: '800'
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  card: {
    padding: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 14,
    ...shadows.soft
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  rowText: {
    flex: 1
  },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900'
  },
  rowBody: {
    marginTop: 3,
    color: colors.textMuted,
    lineHeight: 19
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800'
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: colors.card,
    fontSize: 15
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10
  },
  timeInput: {
    flex: 1,
    gap: 6
  },
  permissionGrid: {
    gap: 10
  },
  permissionItem: {
    flex: 1,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft,
    gap: 8
  },
  permissionLabel: {
    color: colors.text,
    fontWeight: '900'
  },
  statusBadge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: radius.sm,
    fontSize: 12,
    fontWeight: '900'
  },
  statusOn: {
    color: colors.primary,
    backgroundColor: colors.primarySoft
  },
  statusOff: {
    color: colors.dangerText,
    backgroundColor: colors.dangerSoft
  },
  disclosureBox: {
    gap: 10
  },
  disclosureTitle: {
    color: colors.text,
    fontWeight: '900'
  },
  disclosureText: {
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
  checkbox: {
    width: 26,
    height: 26,
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
    fontWeight: '800'
  },
  primaryFull: {
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.primary
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  secondaryFull: {
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: '900'
  },
  dangerFull: {
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.danger
  },
  dangerText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  privacy: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 1
  }
});

module.exports = SettingsScreen;
