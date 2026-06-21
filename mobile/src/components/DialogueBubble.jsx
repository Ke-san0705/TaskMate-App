const React = require('react');
const { StyleSheet, Text, View } = require('react-native');

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
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#202820',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3
  },
  text: {
    color: '#1F2A22',
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
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#202820',
    backgroundColor: '#FFFFFF'
  }
});

module.exports = DialogueBubble;
