const React = require('react');
const { StyleSheet, Text, View } = require('react-native');

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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CAD8C7',
    backgroundColor: '#F7FBF4'
  },
  title: {
    color: '#24352A',
    fontSize: 16,
    fontWeight: '800'
  },
  body: {
    marginTop: 6,
    color: '#53645A',
    fontSize: 14,
    lineHeight: 20
  }
});

module.exports = EmptyState;
