const React = require('react');
const { StyleSheet, Text, View } = require('react-native');
const { colors, radius } = require('../theme/taskMateTheme');

function EmptyState({ title, body }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800'
  },
  body: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  }
});

module.exports = EmptyState;
