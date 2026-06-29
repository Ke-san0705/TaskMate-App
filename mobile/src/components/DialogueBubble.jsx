const React = require('react');
const { StyleSheet, Text, View } = require('react-native');
const { colors, radius, shadows } = require('../theme/taskMateTheme');

function DialogueBubble({ text }) {
  return (
    <View style={styles.bubble} accessibilityRole="text">
      <Text style={styles.text}>{text}</Text>
      <View style={styles.tail} />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'relative',
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadows.soft
  },
  text: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700'
  },
  tail: {
    position: 'absolute',
    left: 36,
    bottom: -10,
    width: 18,
    height: 18,
    transform: [{ rotate: '45deg' }],
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  }
});

module.exports = DialogueBubble;
