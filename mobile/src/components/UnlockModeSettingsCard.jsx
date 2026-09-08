const React = require('react');
const { Alert, Pressable, StyleSheet, Switch, Text, View } = require('react-native');
const AppSelectionList = require('./AppSelectionList');
const JapaneseTextInput = require('./JapaneseTextInput');
const { useTaskMate } = require('../context/TaskMateContext');
const { hasAcceptedAccessibilityDisclosure } = require('../constants/focusDisclosure');
const { FALLBACK_BLOCKED_APPS } = require('../services/focusNativeModule');
const { packageSet } = require('../utils/appSelection');
const {
  MAX_REQUIRED_MINUTES,
  MIN_REQUIRED_MINUTES,
  minutesFromMillis,
  validateUnlockModeSettings
} = require('../utils/unlockMode');
const { colors, radius, spacing, typography } = require('../theme/taskMateTheme');

const USAGE_ACCESS_DISCLOSURE = {
  title: '使用状況へのアクセス',
  consentLabel: 'アンロック条件の判定のため、選んだ条件アプリの今日の使用時間だけを端末内で確認することに同意します。',
  paragraphs: [
    'アンロックモードは、あなたが選んだ条件アプリの今日の使用時間を端末内で合計し、必要時間に達したかを判定します。',
    'TaskMateはキー入力、SNSの内容、Web閲覧内容、メッセージ内容を取得しません。使用時間の判定結果は外部サーバーへ送信しません。'
  ]
};

function StatusBadge({ state }) {
  const labels = {
    unlocked: '今日の条件達成',
    locked: 'ロック中',
    permission_required: '権限不足',
    disabled: 'OFF',
    unavailable: '未対応'
  };
  const positive = state === 'unlocked';
  const inactive = state === 'disabled';
  return (
    <Text
      style={[
        styles.statusBadge,
        positive && styles.statusGood,
        !positive && !inactive && styles.statusWarn,
        inactive && styles.statusNeutral
      ]}
    >
      {labels[state] || labels.disabled}
    </Text>
  );
}

function PermissionBadge({ enabled }) {
  return (
    <Text style={[styles.permissionBadge, enabled ? styles.permissionOn : styles.permissionOff]}>
      {enabled ? '有効' : '未設定'}
    </Text>
  );
}

function ProgressBar({ ratio }) {
  const percent = Math.max(0, Math.min(100, Math.round((Number(ratio) || 0) * 100)));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`アンロック進捗 ${percent}%`}
      style={styles.progressTrack}
    >
      <View style={[styles.progressFill, { width: `${percent}%` }]} />
    </View>
  );
}

function UnlockModeSettingsCard() {
  const {
    focusPermissions,
    installedApps,
    loadInstalledApps,
    openAccessibilitySettings,
    openUsageAccessSettings,
    refreshFocusPermissions,
    refreshUnlockStatus,
    setError,
    settings,
    unlockStatus,
    updateUnlockModeSettings
  } = useTaskMate();
  const mode = settings?.unlockMode || {};
  const accessibilityDisclosureAccepted = hasAcceptedAccessibilityDisclosure(settings);
  const [message, setMessage] = React.useState('');
  const [requiredMinutesText, setRequiredMinutesText] = React.useState(
    String(mode.requiredMinutes || 30)
  );
  const [requirementFilter, setRequirementFilter] = React.useState('');
  const [blockedFilter, setBlockedFilter] = React.useState('');
  const [usageConsentChecked, setUsageConsentChecked] = React.useState(
    Boolean(mode.usageAccessDisclosureAcceptedAt)
  );

  React.useEffect(() => {
    setRequiredMinutesText(String(mode.requiredMinutes || 30));
  }, [mode.requiredMinutes]);

  React.useEffect(() => {
    if (mode.usageAccessDisclosureAcceptedAt) {
      setUsageConsentChecked(true);
    }
  }, [mode.usageAccessDisclosureAcceptedAt]);

  async function saveUnlockMode(partial) {
    setMessage('');
    try {
      const result = await updateUnlockModeSettings(partial);
      await refreshUnlockStatus(result.unlockMode);
      return result;
    } catch (actionError) {
      setError(String(actionError.message || actionError));
      return null;
    }
  }

  async function openUsageSettingsWithConsent() {
    if (!mode.usageAccessDisclosureAcceptedAt && !usageConsentChecked) {
      Alert.alert('確認してください', USAGE_ACCESS_DISCLOSURE.consentLabel);
      return;
    }
    if (!mode.usageAccessDisclosureAcceptedAt) {
      await saveUnlockMode({ usageAccessDisclosureAcceptedAt: new Date().toISOString() });
      setMessage('使用状況へのアクセスの利用に同意しました。');
    }
    await openUsageAccessSettings();
  }

  async function enableUnlockMode(value) {
    if (!value) {
      await saveUnlockMode({ enabled: false });
      return;
    }
    const validation = validateUnlockModeSettings({ ...mode, enabled: true });
    if (!validation.valid) {
      Alert.alert('設定を確認してください', validation.errors[0]);
      return;
    }
    if (!mode.usageAccessDisclosureAcceptedAt) {
      Alert.alert('使用状況へのアクセスの説明を確認してください', USAGE_ACCESS_DISCLOSURE.consentLabel);
      return;
    }
    if (!accessibilityDisclosureAccepted) {
      Alert.alert(
        'アプリ制限の説明を確認してください',
        '制限対象アプリを検知する前に、集中カード内のユーザー補助の説明を確認して同意してください。'
      );
      return;
    }
    if (!focusPermissions.usageAccess) {
      Alert.alert(
        '使用状況へのアクセスが必要です',
        '条件アプリの使用時間を確認するため、Android設定でTaskMateの使用状況へのアクセスを有効にしてください。',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: '設定を開く', onPress: openUsageSettingsWithConsent }
        ]
      );
      return;
    }
    if (!focusPermissions.accessibility) {
      Alert.alert(
        'アプリ制限サービスが必要です',
        '制限対象アプリを開いたことを検知するため、TaskMateのユーザー補助サービスを有効にしてください。',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: '設定を開く', onPress: openAccessibilitySettings }
        ]
      );
      return;
    }
    await saveUnlockMode({ enabled: true });
  }

  async function updateRequirementApps(apps) {
    await saveUnlockMode({ requirementApps: apps });
  }

  async function updateBlockedApps(apps) {
    await saveUnlockMode({ blockedApps: apps });
  }

  async function commitRequiredMinutes(value = requiredMinutesText) {
    const minutes = Number(value);
    if (
      !Number.isFinite(minutes) ||
      minutes < MIN_REQUIRED_MINUTES ||
      minutes > MAX_REQUIRED_MINUTES
    ) {
      Alert.alert(
        '必要時間を確認してください',
        `必要時間は${MIN_REQUIRED_MINUTES}〜${MAX_REQUIRED_MINUTES}分で指定してください。`
      );
      setRequiredMinutesText(String(mode.requiredMinutes || 30));
      return;
    }
    await saveUnlockMode({ requiredMinutes: Math.round(minutes) });
  }

  const requirementDisabledPackages = packageSet(mode.blockedApps || []);
  const blockedDisabledPackages = packageSet(mode.requirementApps || []);
  const totalMinutes = minutesFromMillis(unlockStatus?.totalUsageMillis || 0);
  const requiredMinutes = Math.max(1, minutesFromMillis(unlockStatus?.requiredMillis || 0));
  const remainingMinutes = Math.ceil(Math.max(0, unlockStatus?.remainingMillis || 0) / 60000);

  return (
    <View style={styles.card}>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.sectionTitle}>アンロックモード</Text>
          <Text style={styles.body}>
            やるべきアプリを使った時間に応じて、好きなアプリを解放します。
          </Text>
        </View>
        <Switch
          accessibilityLabel="アンロックモードを有効にする"
          value={mode.enabled === true}
          onValueChange={enableUnlockMode}
        />
      </View>

      <View style={styles.progressBox}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>今日の進捗</Text>
          <StatusBadge state={unlockStatus?.state || 'disabled'} />
        </View>
        <Text style={styles.progressNumber}>
          {totalMinutes} / {requiredMinutes}分
        </Text>
        <ProgressBar ratio={unlockStatus?.progressRatio || 0} />
        <Text style={styles.body}>
          {unlockStatus?.state === 'unlocked'
            ? '今日の条件達成！制限アプリは解放されています。'
            : `あと${remainingMinutes}分で制限アプリを解放できます。`}
        </Text>
      </View>

      <View style={styles.permissionGrid}>
        <View style={styles.permissionItem}>
          <Text style={styles.permissionLabel}>使用状況アクセス</Text>
          <PermissionBadge enabled={focusPermissions.usageAccess} />
        </View>
        <View style={styles.permissionItem}>
          <Text style={styles.permissionLabel}>アプリ制限サービス</Text>
          <PermissionBadge enabled={focusPermissions.accessibility} />
        </View>
      </View>

      <View style={styles.disclosureBox}>
        <Text style={styles.disclosureTitle}>{USAGE_ACCESS_DISCLOSURE.title}</Text>
        {USAGE_ACCESS_DISCLOSURE.paragraphs.map((paragraph) => (
          <Text key={paragraph} style={styles.disclosureText}>
            {paragraph}
          </Text>
        ))}
        {mode.usageAccessDisclosureAcceptedAt ? (
          <Text style={styles.acceptedText}>同意済みです。</Text>
        ) : (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: usageConsentChecked }}
            accessibilityLabel={USAGE_ACCESS_DISCLOSURE.consentLabel}
            style={styles.consentRow}
            onPress={() => setUsageConsentChecked((current) => !current)}
          >
            <View style={[styles.checkbox, usageConsentChecked && styles.checkboxSelected]}>
              {usageConsentChecked ? <Text style={styles.checkboxText}>✓</Text> : null}
            </View>
            <Text style={styles.consentText}>{USAGE_ACCESS_DISCLOSURE.consentLabel}</Text>
          </Pressable>
        )}
        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="使用状況アクセス設定を開く"
            style={styles.secondaryButton}
            onPress={openUsageSettingsWithConsent}
          >
            <Text style={styles.secondaryText}>使用状況設定</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="権限状態を更新する"
            style={styles.secondaryButton}
            onPress={async () => {
              await refreshFocusPermissions();
              await refreshUnlockStatus(mode);
              await loadInstalledApps();
            }}
          >
            <Text style={styles.secondaryText}>状態を更新</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>必要時間 分</Text>
        <JapaneseTextInput
          accessibilityLabel="アンロックに必要な分数"
          keyboardType="number-pad"
          value={requiredMinutesText}
          onChangeText={(value) => {
            if (/^\d{0,4}$/.test(value)) {
              setRequiredMinutesText(value);
            }
          }}
          onBlur={() => commitRequiredMinutes()}
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>条件アプリ</Text>
        <AppSelectionList
          accessibilityLabel="条件アプリを検索する"
          apps={installedApps}
          disabledPackages={requirementDisabledPackages}
          disabledReason="制限アプリに設定済みです"
          fallbackApps={FALLBACK_BLOCKED_APPS}
          filter={requirementFilter}
          onChangeFilter={setRequirementFilter}
          onChangeSelectedApps={updateRequirementApps}
          placeholder="Duolingo、学習アプリなど"
          selectedApps={mode.requirementApps || []}
          selectionLabel="条件アプリ"
          unsafeBlockFilter={false}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>制限するアプリ</Text>
        <AppSelectionList
          accessibilityLabel="アンロックまで制限するアプリを検索する"
          apps={installedApps}
          disabledPackages={blockedDisabledPackages}
          disabledReason="条件アプリに設定済みです"
          fallbackApps={FALLBACK_BLOCKED_APPS}
          filter={blockedFilter}
          onChangeFilter={setBlockedFilter}
          onChangeSelectedApps={updateBlockedApps}
          placeholder="Instagram、YouTubeなど"
          selectedApps={mode.blockedApps || []}
          selectionLabel="制限アプリ"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 14
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.gap
  },
  headerText: {
    flex: 1
  },
  sectionTitle: {
    ...typography.sectionTitle
  },
  body: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  message: {
    padding: 10,
    borderRadius: radius.sm,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    fontWeight: '800'
  },
  progressBox: {
    padding: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft,
    gap: 8
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.gap
  },
  progressTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900'
  },
  progressNumber: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900'
  },
  progressTrack: {
    height: 10,
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary
  },
  statusBadge: {
    overflow: 'hidden',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: radius.sm,
    fontSize: 12,
    fontWeight: '900'
  },
  statusGood: {
    color: colors.primary,
    backgroundColor: colors.primarySoft
  },
  statusWarn: {
    color: colors.dangerText,
    backgroundColor: colors.dangerSoft
  },
  statusNeutral: {
    color: colors.textMuted,
    backgroundColor: colors.border
  },
  permissionGrid: {
    flexDirection: 'row',
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
    fontSize: 13,
    fontWeight: '900'
  },
  permissionBadge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: radius.sm,
    fontSize: 12,
    fontWeight: '900'
  },
  permissionOn: {
    color: colors.primary,
    backgroundColor: colors.primarySoft
  },
  permissionOff: {
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
  buttonRow: {
    flexDirection: 'row',
    gap: 10
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: '900'
  },
  field: {
    gap: 8
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900'
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: colors.card,
    fontSize: 15
  }
});

module.exports = UnlockModeSettingsCard;
