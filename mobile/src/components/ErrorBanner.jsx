const React = require('react');
const { Pressable, StyleSheet, Text, View } = require('react-native');

function ErrorBanner({ message, onClose }) {
  if (!message) {
    return null;
  }
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>{message}</Text>
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="エラーメッセージを閉じる"
          onPress={onClose}
          style={styles.close}
        >
          <Text style={styles.closeText}>閉じる</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B24A4A',
    backgroundColor: '#FFF1F1',
    gap: 8
  },
  text: {
    color: '#5C1F1F',
    fontSize: 14,
    lineHeight: 20
  },
  close: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#5C1F1F'
  },
  closeText: {
    color: '#FFFFFF',
    fontWeight: '700'
  }
});

module.exports = ErrorBanner;
