const React = require('react');
const { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } = require('react-native');
const { SafeAreaView } = require('react-native-safe-area-context');
const CharacterView = require('../components/CharacterView');
const ErrorBanner = require('../components/ErrorBanner');
const { useTaskMate } = require('../context/TaskMateContext');
const { ROUTES } = require('../constants/routes');
const { colors, radius, shadows, spacing, typography } = require('../theme/taskMateTheme');

function characterTags(character) {
  if (character?.id === 'Chara2') {
    return ['やさしい', '応援上手', '課題向き'];
  }
  return ['落ち着き', 'やさしい', '勉強向き'];
}

function CharactersScreen({ navigation }) {
  const {
    characters,
    deleteCustomCharacter,
    error,
    selectCharacter,
    selectedCharacter,
    setError
  } = useTaskMate();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} onClose={() => setError('')} />
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>CHARACTER</Text>
            <Text style={styles.title}>キャラクター</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="カスタムキャラクターを作成する"
            style={styles.addButton}
            onPress={() => navigation.navigate(ROUTES.CharacterEdit)}
          >
            <Text style={styles.addText}>作成</Text>
          </Pressable>
        </View>

        <View style={styles.preview}>
          <CharacterView character={selectedCharacter} mood="calm" />
          <Text style={styles.previewText}>今の相棒：{selectedCharacter?.name}</Text>
          <View style={styles.tags}>
            {characterTags(selectedCharacter).map((tag) => (
              <Text key={tag} style={styles.tag}>{tag}</Text>
            ))}
          </View>
        </View>

        <View style={styles.list}>
          {characters.map((character) => {
            const selected = selectedCharacter?.id === character.id;
            return (
              <View key={character.id} style={[styles.card, selected && styles.selectedCard]}>
                <View style={styles.cardHeader}>
                  <View style={styles.thumbnail}>
                    {character.images?.wait ? (
                      <Image source={character.images.wait} style={styles.thumbnailImage} resizeMode="contain" />
                    ) : null}
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{character.name}</Text>
                    <Text style={styles.cardDescription}>
                      {character.description || '説明はありません。'}
                    </Text>
                    <View style={styles.smallTags}>
                      {characterTags(character).slice(0, 2).map((tag) => (
                        <Text key={tag} style={styles.smallTag}>{tag}</Text>
                      ))}
                    </View>
                  </View>
                  <Text style={styles.kind}>{character.builtIn ? '標準キャラ' : 'カスタム'}</Text>
                </View>
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${character.name}を選択する`}
                    style={selected ? styles.selectedButton : styles.secondary}
                    onPress={() => selectCharacter(character.id)}
                  >
                    <Text style={selected ? styles.selectedText : styles.secondaryText}>
                      {selected ? '選択中' : '選択'}
                    </Text>
                  </Pressable>
                  {!character.builtIn ? (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${character.name}を編集する`}
                        style={styles.secondary}
                        onPress={() =>
                          navigation.navigate(ROUTES.CharacterEdit, { characterId: character.id })
                        }
                      >
                        <Text style={styles.secondaryText}>編集</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${character.name}を削除する`}
                        style={styles.danger}
                        onPress={() =>
                          Alert.alert('キャラクターを削除しますか？', character.name, [
                            { text: 'キャンセル', style: 'cancel' },
                            {
                              text: '削除',
                              style: 'destructive',
                              onPress: () => deleteCustomCharacter(character.id)
                            }
                          ])
                        }
                      >
                        <Text style={styles.dangerText}>削除</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundSoft
  },
  container: {
    padding: spacing.screen,
    gap: spacing.section,
    paddingBottom: spacing.bottomTabPadding
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  eyebrow: {
    ...typography.eyebrow
  },
  title: {
    ...typography.screenTitle
  },
  addButton: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.primary
  },
  addText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  preview: {
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    gap: 8,
    ...shadows.card
  },
  previewText: {
    color: colors.primary,
    fontWeight: '900'
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7
  },
  tag: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    fontSize: 12,
    fontWeight: '800'
  },
  list: {
    gap: 10
  },
  card: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 12,
    ...shadows.soft
  },
  selectedCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  thumbnail: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.card
  },
  thumbnailImage: {
    width: 50,
    height: 50
  },
  cardText: {
    flex: 1
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900'
  },
  cardDescription: {
    marginTop: 4,
    color: colors.textMuted,
    lineHeight: 19
  },
  smallTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8
  },
  smallTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
    color: colors.primary,
    backgroundColor: colors.card,
    fontSize: 11,
    fontWeight: '800'
  },
  kind: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800'
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  secondary: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: '800'
  },
  selectedButton: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.primary
  },
  selectedText: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  danger: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#D7A6A6',
    backgroundColor: colors.dangerSoft
  },
  dangerText: {
    color: colors.dangerText,
    fontWeight: '800'
  }
});

module.exports = CharactersScreen;
