const React = require('react');
const { Pressable, StyleSheet, Text, View } = require('react-native');
const { formatTaskTime } = require('../utils/localDate');
const { colors, radius, shadows, typography } = require('../theme/taskMateTheme');

function FocusTaskCard({ task, onComplete, onClear, onDetails }) {
  if (!task) {
    return null;
  }
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>今やる</Text>
      <Text style={styles.title}>{task.title}</Text>
      <Text style={styles.meta}>
        {task.date} / {formatTaskTime(task)} {task.genre ? `/ ${task.genre}` : ''}
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${task.title}を完了する`}
          onPress={() => onComplete(task.id)}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>完了</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="今やるタスクを解除する"
          onPress={onClear}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>やめる</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${task.title}の詳細を開く`}
          onPress={() => onDetails(task)}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>詳細</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    gap: 8,
    ...shadows.card
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.primary
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  primary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.primary
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  secondary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: '800'
  }
});

module.exports = FocusTaskCard;
