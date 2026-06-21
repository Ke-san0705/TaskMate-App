const React = require('react');
const { Alert, Pressable, ScrollView, StyleSheet, Text, View } = require('react-native');
const { SafeAreaView } = require('react-native-safe-area-context');
const CharacterView = require('../components/CharacterView');
const ErrorBanner = require('../components/ErrorBanner');
const { useTaskMate } = require('../context/TaskMateContext');
const { ROUTES } = require('../constants/routes');

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
          <Text style={styles.previewText}>現在: {selectedCharacter?.name}</Text>
        </View>

        <View style={styles.list}>
          {characters.map((character) => {
            const selected = selectedCharacter?.id === character.id;
            return (
              <View key={character.id} style={[styles.card, selected && styles.selectedCard]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{character.name}</Text>
                    <Text style={styles.cardDescription}>
                      {character.description || '説明はありません。'}
                    </Text>
                  </View>
                  <Text style={styles.kind}>{character.builtIn ? '同梱' : 'カスタム'}</Text>
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
    backgroundColor: '#F6FAF3'
  },
  container: {
    padding: 16,
    gap: 16,
    paddingBottom: 120
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  eyebrow: {
    color: '#5E6F60',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1
  },
  title: {
    color: '#1F2A22',
    fontSize: 28,
    fontWeight: '900'
  },
  addButton: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#315C3A'
  },
  addText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  preview: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D5DED3',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    gap: 8
  },
  previewText: {
    color: '#315C3A',
    fontWeight: '900'
  },
  list: {
    gap: 10
  },
  card: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D5DED3',
    backgroundColor: '#FFFFFF',
    gap: 12
  },
  selectedCard: {
    borderColor: '#315C3A',
    backgroundColor: '#F3F8EF'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10
  },
  cardText: {
    flex: 1
  },
  cardTitle: {
    color: '#1F2A22',
    fontSize: 17,
    fontWeight: '900'
  },
  cardDescription: {
    marginTop: 4,
    color: '#516052',
    lineHeight: 19
  },
  kind: {
    color: '#516052',
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A8B8A4',
    backgroundColor: '#FFFFFF'
  },
  secondaryText: {
    color: '#315C3A',
    fontWeight: '800'
  },
  selectedButton: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#315C3A'
  },
  selectedText: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  danger: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B24A4A',
    backgroundColor: '#FFF7F7'
  },
  dangerText: {
    color: '#8E2F2F',
    fontWeight: '800'
  }
});

module.exports = CharactersScreen;
