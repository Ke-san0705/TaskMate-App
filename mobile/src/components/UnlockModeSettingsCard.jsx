const React = require('react');
const { Alert, Pressable, StyleSheet, Switch, Text, View } = require('react-native');
const AccordionSection = require('./AccordionSection');
const AppSelectionList = require('./AppSelectionList');
const JapaneseTextInput = require('./JapaneseTextInput');
const SegmentedSwitcher = require('./SegmentedSwitcher');
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
  const [appSelection, setAppSelection] = React.useState('requirement');
  const [appsExpanded, setAppsExpanded] = React.useState(false);
  const [conditionsExpanded, setConditionsExpanded] = React.useState(false);
  const [permissionsExpanded, setPermissionsExpanded] = React.useState(false);
  const minutesCommitRef = React.useRef(null);
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

  React.useEffect(() => {
    loadInstalledApps().catch((loadError) => setError(String(loadError.message || loadError)));
  }, [loadInstalledApps, setError]);

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
      const saved = await saveUnlockMode({ usageAccessDisclosureAcceptedAt: new Date().toISOString() });
      if (!saved) return;
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
      setAppSelection(mode.requirementApps?.length ? 'blocked' : 'requirement');
      setAppsExpanded(true);
      Alert.alert('設定を確認してください', validation.errors[0]);
      return;
    }
    if (!mode.usageAccessDisclosureAcceptedAt) {
      setPermissionsExpanded(true);
      Alert.alert('使用状況へのアクセスの説明を確認してください', USAGE_ACCESS_DISCLOSURE.consentLabel);
      return;
    }
    if (!accessibilityDisclosureAccepted) {
      Alert.alert(
        'アプリ制限の説明を確認してください',
        '設定の「集中」にある「アプリ制限の権限・説明」を確認して同意してください。'
      );
      return;
    }
    if (!focusPermissions.usageAccess) {
      setPermissionsExpanded(true);
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
      setPermissionsExpanded(true);
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
      return false;
    }
    if (minutesCommitRef.current) return minutesCommitRef.current;
    if (Math.round(minutes) === mode.requiredMinutes) return true;
    minutesCommitRef.current = saveUnlockMode({ requiredMinutes: Math.round(minutes) })
      .then((saved) => Boolean(saved))
      .finally(() => { minutesCommitRef.current = null; });
    return minutesCommitRef.current;
  }

  const requirementDisabledPackages = packageSet(mode.blockedApps || []);
  const blockedDisabledPackages = packageSet(mode.requirementApps || []);
  const totalMinutes = minutesFromMillis(unlockStatus?.totalUsageMillis || 0);
  const requiredMinutes = Number(mode.requiredMinutes) || 30;
  const remainingMinutes = Math.ceil(
    Math.max(0, unlockStatus?.remainingMillis ?? requiredMinutes * 60000) / 60000
  );
  const requirementApps = mode.requirementApps || [];
  const blockedApps = mode.blockedApps || [];
  const selectingRequirements = appSelection === 'requirement';
  const usageReady = focusPermissions.usageAccess && Boolean(mode.usageAccessDisclosureAcceptedAt);
  const restrictionReady = focusPermissions.accessibility && accessibilityDisclosureAccepted;
  const permissionSummary = usageReady && restrictionReady
    ? '必要な権限は有効です'
    : '使用状況アクセス・アプリ制限サービスを確認';
  const progressMessage = !mode.enabled
    ? 'OFF：アプリは制限されていません。'
    : !usageReady || !restrictionReady
      ? '必要な権限を確認してください。'
      : unlockStatus?.state === 'unlocked'
        ? '今日の条件達成！制限アプリは解放されています。'
        : `あと${remainingMinutes}分で制限アプリを解放できます。`;

  function openAppSelection(value) {
    setAppSelection(value);
    setAppsExpanded(true);
  }

  function appSummary(apps) {
    if (apps.length === 0) return '未選択';
    const names = apps.slice(0, 2).map((app) => app.appName || 'アプリ').join('、');
    return apps.length > 2 ? `${names} ほか${apps.length - 2}件` : names;
  }

  return (
    <View style={styles.card}>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.sectionTitle}>アンロックモード</Text>
          <Text style={styles.body}>条件アプリを使って、制限アプリを解放。</Text>
        </View>
        <View style={styles.toggle}>
          <Text style={styles.toggleLabel}>{mode.enabled ? 'ON' : 'OFF'}</Text>
          <Switch
            accessibilityLabel="アンロックモードを有効にする"
            value={mode.enabled === true}
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            onValueChange={enableUnlockMode}
          />
        </View>
      </View>

      <View style={styles.progressBox}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>今日の進捗</Text>
          <StatusBadge state={
            mode.enabled && (!usageReady || !restrictionReady)
              ? 'permission_required'
              : unlockStatus?.state || 'disabled'
          } />
        </View>
        <Text style={styles.progressNumber}>
          {totalMinutes} / {requiredMinutes}分
        </Text>
        <ProgressBar ratio={unlockStatus?.progressRatio || 0} />
        <Text style={styles.body}>{progressMessage}</Text>
      </View>

      <View style={styles.appSummaryRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`条件アプリを選択、${requirementApps.length}件選択中`}
          onPress={() => openAppSelection('requirement')}
          style={styles.appSummaryItem}
        >
          <Text style={styles.label}>条件アプリ {requirementApps.length}件</Text>
          <Text style={styles.appSummaryText} numberOfLines={2}>{appSummary(requirementApps)}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`制限アプリを選択、${blockedApps.length}件選択中`}
          onPress={() => openAppSelection('blocked')}
          style={styles.appSummaryItem}
        >
          <Text style={styles.label}>制限アプリ {blockedApps.length}件</Text>
          <Text style={styles.appSummaryText} numberOfLines={2}>{appSummary(blockedApps)}</Text>
        </Pressable>
      </View>

      <AccordionSection
        title="条件設定"
        summary={`必要時間 ${requiredMinutes}分 / 日`}
        expanded={conditionsExpanded}
        onExpandedChange={async (expanded) => {
          if (expanded || await commitRequiredMinutes()) setConditionsExpanded(expanded);
        }}
      >
        <View style={styles.field}>
          <Text style={styles.label}>1日の必要時間</Text>
          <View style={styles.minutesRow}>
            <JapaneseTextInput
              accessibilityLabel="アンロックに必要な分数"
              keyboardType="number-pad"
              value={requiredMinutesText}
              onChangeText={(value) => {
                if (/^\d{0,4}$/.test(value)) setRequiredMinutesText(value);
              }}
              onBlur={() => commitRequiredMinutes()}
              onSubmitEditing={() => commitRequiredMinutes()}
              style={[styles.input, styles.minutesInput]}
            />
            <Text style={styles.label}>分</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="必要時間を保存する"
              style={styles.secondaryButton}
              onPress={() => commitRequiredMinutes()}
            >
              <Text style={styles.secondaryText}>保存</Text>
            </Pressable>
          </View>
        </View>
      </AccordionSection>

      <AccordionSection
        title="アプリを選択"
        summary={`条件 ${requirementApps.length}件 / 制限 ${blockedApps.length}件`}
        expanded={appsExpanded}
        onExpandedChange={setAppsExpanded}
      >
        <SegmentedSwitcher
          options={[
            { value: 'requirement', label: '条件アプリ' },
            { value: 'blocked', label: '制限アプリ' }
          ]}
          value={appSelection}
          onChange={setAppSelection}
        />
        <AppSelectionList
          accessibilityLabel={selectingRequirements ? '条件アプリを検索する' : '制限アプリを検索する'}
          apps={installedApps}
          maxListHeight={320}
          disabledPackages={selectingRequirements ? requirementDisabledPackages : blockedDisabledPackages}
          disabledReason={selectingRequirements ? '制限アプリに設定済みです' : '条件アプリに設定済みです'}
          fallbackApps={FALLBACK_BLOCKED_APPS}
          filter={selectingRequirements ? requirementFilter : blockedFilter}
          onChangeFilter={selectingRequirements ? setRequirementFilter : setBlockedFilter}
          onChangeSelectedApps={selectingRequirements ? updateRequirementApps : updateBlockedApps}
          placeholder={selectingRequirements ? '学習アプリなど' : '制限するアプリ名で検索'}
          selectedApps={selectingRequirements ? requirementApps : blockedApps}
          selectionLabel={selectingRequirements ? '条件アプリ' : '制限アプリ'}
          unsafeBlockFilter={!selectingRequirements}
        />
      </AccordionSection>

      <AccordionSection
        title="権限 / 状態"
        summary={permissionSummary}
        expanded={permissionsExpanded}
        onExpandedChange={setPermissionsExpanded}
      >
        <View style={styles.permissionItem}>
          <Text style={styles.permissionLabel}>使用状況アクセス</Text>
          <PermissionBadge enabled={usageReady} />
        </View>
        <View style={styles.disclosureBox}>
          {USAGE_ACCESS_DISCLOSURE.paragraphs.map((paragraph) => (
            <Text key={paragraph} style={styles.disclosureText}>{paragraph}</Text>
          ))}
          {mode.usageAccessDisclosureAcceptedAt ? (
            <Text style={styles.acceptedText}>利用説明に同意済み</Text>
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="使用状況アクセス設定を開く"
            style={styles.secondaryButton}
            onPress={openUsageSettingsWithConsent}
          >
            <Text style={styles.secondaryText}>使用状況設定を開く</Text>
          </Pressable>
        </View>
        <View style={styles.permissionItem}>
          <Text style={styles.permissionLabel}>アプリ制限サービス</Text>
          <PermissionBadge enabled={restrictionReady} />
        </View>
        <Text style={styles.disclosureText}>
          選んだ制限アプリを開いたことを検知します。画面や入力内容は読み取りません。
          {!accessibilityDisclosureAccepted ? '上の「集中」の権限・説明で同意してください。' : ''}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="アプリ制限サービスの設定を開く"
          disabled={!accessibilityDisclosureAccepted}
          style={[styles.secondaryButton, !accessibilityDisclosureAccepted && styles.disabledButton]}
          onPress={openAccessibilitySettings}
        >
          <Text style={styles.secondaryText}>アプリ制限の設定を開く</Text>
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
      </AccordionSection>

      <AccordionSection title="説明 / 注意事項">
        <Text style={styles.disclosureText}>
          条件アプリの今日の利用時間を合計し、必要時間に達すると制限アプリを解放します。
          条件は毎日リセットされます。
        </Text>
        <Text style={styles.disclosureText}>
          同じアプリを条件と制限の両方には選べません。集中モード中は、集中モードの制限が優先されます。
        </Text>
      </AccordionSection>
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
    gap: 8
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.gap
  },
  headerText: {
    flex: 1,
    minWidth: 0
  },
  toggle: {
    alignItems: 'center'
  },
  toggleLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800'
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
    paddingVertical: 12,
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
    flexShrink: 1,
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
  appSummaryRow: {
    flexDirection: 'row',
    gap: spacing.gap,
    paddingBottom: 6
  },
  appSummaryItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    gap: 4
  },
  appSummaryText: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 19
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.gap
  },
  permissionLabel: {
    flex: 1,
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
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: '900',
    textAlign: 'center'
  },
  disabledButton: {
    opacity: 0.5
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
  },
  minutesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gap
  },
  minutesInput: {
    flex: 1
  }
});

module.exports = UnlockModeSettingsCard;
