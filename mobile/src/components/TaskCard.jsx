const React = require('react');
const { Alert, Pressable, StyleSheet, Text, View } = require('react-native');
const { classifyTask } = require('@taskmate/core');
const { formatTaskTime } = require('../utils/localDate');

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
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D5DED3',
    backgroundColor: '#FFFFFF',
    gap: 10
  },
  completed: {
    opacity: 0.68
  },
  focused: {
    borderColor: '#315C3A',
    backgroundColor: '#F3F8EF'
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
    color: '#1F2A22',
    fontSize: 16,
    fontWeight: '900'
  },
  meta: {
    marginTop: 4,
    color: '#5A675E',
    fontSize: 12
  },
  description: {
    color: '#3D4A40',
    fontSize: 14,
    lineHeight: 20
  },
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: 'hidden',
    color: '#1F2A22',
    fontSize: 12,
    fontWeight: '800'
  },
  badge_future: { backgroundColor: '#E6EEF2' },
  badge_calm: { backgroundColor: '#DDEED9' },
  badge_warning: { backgroundColor: '#F5E5B8' },
  badge_urgent: { backgroundColor: '#F2C6A6' },
  badge_overdue: { backgroundColor: '#F2B8B8' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  primary: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#315C3A'
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  secondary: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A8B8A4',
    backgroundColor: '#FFFFFF'
  },
  secondaryText: {
    color: '#315C3A',
    fontWeight: '800'
  },
  danger: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B24A4A',
    backgroundColor: '#FFF7F7'
  },
  dangerText: {
    color: '#8E2F2F',
    fontWeight: '800'
  }
});

module.exports = TaskCard;
