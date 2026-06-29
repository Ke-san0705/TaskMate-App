const React = require('react');
const { Alert, Pressable, StyleSheet, Text, View } = require('react-native');
const { classifyTask } = require('@taskmate/core');
const { formatTaskTime } = require('../utils/localDate');
const { colors, radius, shadows } = require('../theme/taskMateTheme');

const STATE_LABELS = {
  future: 'これから',
  calm: '落ち着き',
  warning: '近づき中',
  urgent: 'まもなく',
  overdue: '期限超過'
};

function TaskCard({ task, focusTaskId, onComplete, onUndo, onDelete, onEdit, onFocus }) {
  const state = classifyTask(task, new Date()).state;
  const focused = focusTaskId === task.id;
  return (
    <View style={[styles.card, task.completed && styles.completed, focused && styles.focused]}>
      <View style={styles.header}>
        <View style={styles.titleColumn}>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.meta}>
            {task.date} / {formatTaskTime(task)} {task.genre ? `/ ${task.genre}` : ''}
          </Text>
        </View>
        <Text style={[styles.badge, styles[`badge_${state}`]]}>{STATE_LABELS[state]}</Text>
      </View>
      {task.description ? <Text style={styles.description}>{task.description}</Text> : null}
      <View style={styles.actions}>
        {task.completed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${task.title}の完了を取り消す`}
            style={styles.secondary}
            onPress={() => onUndo(task.id)}
          >
            <Text style={styles.secondaryText}>取り消す</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${task.title}を完了する`}
            style={styles.primary}
            onPress={() => onComplete(task.id)}
          >
            <Text style={styles.primaryText}>完了</Text>
          </Pressable>
        )}
        {!task.completed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${task.title}を今やるにする`}
            style={styles.secondary}
            onPress={() => onFocus(task.id)}
          >
            <Text style={styles.secondaryText}>{focused ? '選択中' : '今やる'}</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${task.title}を編集する`}
          style={styles.secondary}
          onPress={() => onEdit(task)}
        >
          <Text style={styles.secondaryText}>編集</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${task.title}を削除する`}
          style={styles.danger}
          onPress={() =>
            Alert.alert('タスクを削除しますか？', `「${task.title}」を削除します。`, [
              { text: 'キャンセル', style: 'cancel' },
              { text: '削除', style: 'destructive', onPress: () => onDelete(task.id) }
            ])
          }
        >
          <Text style={styles.dangerText}>削除</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 15,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 10,
    ...shadows.soft
  },
  completed: {
    opacity: 0.68
  },
  focused: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10
  },
  titleColumn: {
    flex: 1
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900'
  },
  meta: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    overflow: 'hidden',
    color: colors.text,
    fontSize: 12,
    fontWeight: '800'
  },
  badge_future: { backgroundColor: '#E6EEF2' },
  badge_calm: { backgroundColor: colors.primarySoft },
  badge_warning: { backgroundColor: colors.warningBg },
  badge_urgent: { backgroundColor: '#F2C6A6' },
  badge_overdue: {
    color: colors.dangerText,
    backgroundColor: colors.overdueBg
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  primary: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.primary
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  secondary: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: '800'
  },
  danger: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#D7A6A6',
    backgroundColor: colors.dangerSoft
  },
  dangerText: {
    color: colors.dangerText,
    fontWeight: '800'
  }
});

module.exports = TaskCard;
