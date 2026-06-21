const React = require('react');
const { StyleSheet, View } = require('react-native');

const COLORS = {
  calm: ['#DDEED9', '#C9E2D0'],
  attentive: ['#E5E9C4', '#C9DCA7'],
  restless: ['#F2D8A7', '#E8B870'],
  anxious: ['#F2B8A6', '#D78979'],
  overloaded: ['#D7CBDD', '#B9A6C8']
};

function AmbientStateLayer({ mood = 'calm', level = 0, enabled = true }) {
  if (!enabled || level <= 0) {
    return null;
  }
  const colors = COLORS[mood] || COLORS.calm;
  const count = Math.min(5, Math.max(1, level + 1));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: colors[index % colors.length],
              opacity: 0.18 + index * 0.04,
              width: 72 - index * 6,
              height: 72 - index * 6,
              left: `${8 + index * 18}%`,
              top: `${10 + (index % 3) * 18}%`
            }
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    borderRadius: 999
  }
});

module.exports = AmbientStateLayer;
