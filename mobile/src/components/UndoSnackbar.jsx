const React = require('react');
const { Pressable, StyleSheet, Text, View } = require('react-native');

function UndoSnackbar({ item, onUndo, onExpire }) {
  React.useEffect(() => {
    if (!item) {
      return undefined;
    }
    const timer = setTimeout(() => onExpire?.(), 5000);
    return () => clearTimeout(timer);
  }, [item, onExpire]);

  if (!item) {
    return null;
  }

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.text}>「{item.task.title}」を完了しました。</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="完了を取り消す"
        onPress={() => onUndo(item.task.id)}
        style={styles.button}
      >
        <Text style={styles.buttonText}>取り消す</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 92,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1F2A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    elevation: 4
  },
  text: {
    flex: 1,
    color: '#FFFFFF',
    fontWeight: '800'
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#E7F2DF'
  },
  buttonText: {
    color: '#1F2A22',
    fontWeight: '900'
  }
});

module.exports = UndoSnackbar;
