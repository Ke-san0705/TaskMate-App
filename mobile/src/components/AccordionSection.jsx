const React = require('react');
const { Pressable, StyleSheet, Text, View } = require('react-native');
const { colors, spacing } = require('../theme/taskMateTheme');

function AccordionSection({
  title,
  summary,
  children,
  defaultExpanded = false,
  expanded,
  onExpandedChange
}) {
  const [localExpanded, setLocalExpanded] = React.useState(defaultExpanded);
  const isExpanded = expanded === undefined ? localExpanded : expanded;

  function toggle() {
    const next = !isExpanded;
    if (expanded === undefined) setLocalExpanded(next);
    onExpandedChange?.(next);
  }

  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={summary || undefined}
        accessibilityState={{ expanded: isExpanded }}
        onPress={toggle}
        style={styles.header}
      >
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
        <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.indicator}>
          {isExpanded ? '−' : '＋'}
        </Text>
      </Pressable>
      {isExpanded ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  header: {
    minHeight: 56,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gap
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800'
  },
  summary: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  indicator: {
    width: 24,
    color: colors.primary,
    fontSize: 22,
    textAlign: 'center'
  },
  content: {
    paddingBottom: 12,
    gap: spacing.gap
  }
});

module.exports = AccordionSection;
