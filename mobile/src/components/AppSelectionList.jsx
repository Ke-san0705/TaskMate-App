const React = require('react');
const { Pressable, StyleSheet, Text, View } = require('react-native');
const JapaneseTextInput = require('./JapaneseTextInput');
const {
  filterBlockableApps,
  mergeApps,
  packageSet
} = require('../utils/appSelection');
const { colors, radius, spacing } = require('../theme/taskMateTheme');

function AppSelectionList({
  accessibilityLabel,
  apps = [],
  disabledPackages = new Set(),
  disabledReason = 'この設定では選べません',
  fallbackApps = [],
  filter,
  maxItems = 80,
  onChangeFilter,
  onChangeSelectedApps,
  placeholder = 'アプリ名で検索',
  selectedApps = [],
  selectionLabel = '選択中',
  unsafeBlockFilter = true
}) {
  const selectedPackages = React.useMemo(() => packageSet(selectedApps), [selectedApps]);
  const disabledPackageSet = React.useMemo(
    () => new Set([...disabledPackages].filter(Boolean)),
    [disabledPackages]
  );
  const choices = React.useMemo(() => {
    const normalizedFilter = String(filter || '').trim().toLowerCase();
    const merged = mergeApps(selectedApps, apps, fallbackApps);
    const filteredForSafety = unsafeBlockFilter ? filterBlockableApps(merged) : merged;
    return filteredForSafety
      .filter((app) =>
        normalizedFilter
          ? `${app.appName} ${app.packageName}`.toLowerCase().includes(normalizedFilter)
          : true
      )
      .slice(0, maxItems);
  }, [apps, fallbackApps, filter, maxItems, selectedApps, unsafeBlockFilter]);

  function toggleApp(app) {
    if (disabledPackageSet.has(app.packageName)) {
      return;
    }
    if (selectedPackages.has(app.packageName)) {
      onChangeSelectedApps(
        selectedApps.filter((item) => item.packageName !== app.packageName)
      );
      return;
    }
    onChangeSelectedApps(
      mergeApps(selectedApps, [app])
    );
  }

  return (
    <View style={styles.container}>
      <JapaneseTextInput
        accessibilityLabel={accessibilityLabel}
        value={filter}
        onChangeText={onChangeFilter}
        placeholder={placeholder}
        style={styles.input}
      />
      <Text style={styles.selectedCount}>
        {selectionLabel} {selectedApps.length}件
      </Text>
      <View style={styles.appList}>
        {choices.length > 0 ? (
          choices.map((app) => {
            const selected = selectedPackages.has(app.packageName);
            const disabled = disabledPackageSet.has(app.packageName);
            return (
              <Pressable
                key={app.packageName}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled }}
                accessibilityLabel={`${app.appName}を選択する`}
                disabled={disabled}
                style={[
                  styles.appChoice,
                  selected && styles.choiceSelected,
                  disabled && styles.choiceDisabled
                ]}
                onPress={() => toggleApp(app)}
              >
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected ? <Text style={styles.checkboxText}>✓</Text> : null}
                </View>
                <View style={styles.choiceText}>
                  <Text style={styles.choiceTitle}>{app.appName}</Text>
                  <Text style={styles.choiceMeta}>{app.packageName}</Text>
                  {disabled ? <Text style={styles.disabledReason}>{disabledReason}</Text> : null}
                </View>
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.empty}>候補がありません。</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.gap
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
  selectedCount: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800'
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
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  choiceDisabled: {
    opacity: 0.58
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
  disabledReason: {
    marginTop: 4,
    color: colors.dangerText,
    fontSize: 12,
    fontWeight: '800'
  },
  empty: {
    color: colors.textMuted,
    lineHeight: 20
  }
});

module.exports = AppSelectionList;
