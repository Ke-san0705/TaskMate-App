const React = require('react');
const { Image, Pressable, StyleSheet, Text, View } = require('react-native');
const { colors } = require('../theme/taskMateTheme');

const MOOD_LABELS = {
  wait: '案内中',
  focus: '集中',
  complete: '完了',
  alarm: '通知',
  click: '反応',
  calm: '案内中',
  focusing: '集中',
  relieved: '完了',
  celebrating: '完了',
  notifying: '通知',
  clicked: '反応'
};

function CharacterView({ character, mood = 'calm', onPress, showStatus = true, size = 180 }) {
  const images = character?.images || {};
  const imageKey =
    mood === 'focus' || mood === 'focusing'
      ? 'wait'
      : mood === 'complete' || mood === 'relieved' || mood === 'celebrating'
        ? 'click'
        : mood === 'alarm' || mood === 'notifying'
          ? 'alarm'
          : mood;
  const source = images[imageKey] || images.wait || images.calm;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${character?.name || 'キャラクター'}に話しかける`}
      onPress={onPress}
      style={[styles.container, { width: size }]}
    >
      <View style={[styles.imageFrame, { width: size, height: size }]}>
        {source ? (
          <Image source={source} style={styles.image} resizeMode="contain" />
        ) : (
          <Text style={styles.noImage}>画像なし</Text>
        )}
      </View>
      <Text style={styles.name}>{character?.name || 'TaskMate'}</Text>
      {showStatus ? <Text style={styles.mood}>{MOOD_LABELS[mood] || mood}</Text> : null}
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
    fontWeight: '800',
    textAlign: 'center'
  },
  mood: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700'
  }
});

module.exports = CharacterView;
