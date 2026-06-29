const React = require('react');
const { Image, Pressable, StyleSheet, Text, View } = require('react-native');
const { colors } = require('../theme/taskMateTheme');

const MOOD_LABELS = {
  calm: '落ち着き',
  attentive: '少し注目',
  restless: 'そわそわ',
  anxious: '一つに絞ろう',
  overloaded: '情報を減らそう',
  focusing: '今やる',
  relieved: '完了',
  celebrating: '全部完了',
  reconnecting: 'おかえり',
  notifying: '通知',
  clicked: '反応'
};

function CharacterView({ character, mood = 'calm', onPress }) {
  const images = character?.images || {};
  const source = images[mood] || images.wait || images.calm;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${character?.name || 'キャラクター'}に話しかける`}
      onPress={onPress}
      style={styles.container}
    >
      <View style={styles.imageFrame}>
        {source ? (
          <Image source={source} style={styles.image} resizeMode="contain" />
        ) : (
          <Text style={styles.noImage}>画像なし</Text>
        )}
      </View>
      <Text style={styles.name}>{character?.name || 'TaskMate'}</Text>
      <Text style={styles.mood}>{MOOD_LABELS[mood] || mood}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6
  },
  imageFrame: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center'
  },
  image: {
    width: '100%',
    height: '100%'
  },
  noImage: {
    color: colors.textMuted
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800'
  },
  mood: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700'
  }
});

module.exports = CharacterView;
