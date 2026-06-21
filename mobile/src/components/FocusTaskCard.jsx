const React = require('react');
const { Pressable, StyleSheet, Text, View } = require('react-native');
const { formatTaskTime } = require('../utils/localDate');

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
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7A8F7A',
    backgroundColor: '#F3F8EF',
    gap: 7
  },
  eyebrow: {
    color: '#516052',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1
  },
  title: {
    color: '#1F2A22',
    fontSize: 18,
    fontWeight: '900'
  },
  meta: {
    color: '#516052',
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
    borderRadius: 8,
    backgroundColor: '#315C3A'
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  secondary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9AAE98',
    backgroundColor: '#FFFFFF'
  },
  secondaryText: {
    color: '#315C3A',
    fontWeight: '800'
  }
});

module.exports = FocusTaskCard;
