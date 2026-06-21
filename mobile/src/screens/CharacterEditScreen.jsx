const React = require('react');
const ImagePicker = require('expo-image-picker');
const {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} = require('react-native');
const { SafeAreaView } = require('react-native-safe-area-context');
const { useTaskMate } = require('../context/TaskMateContext');
const { messageFromError } = require('../utils/validation');

function CharacterEditScreen({ navigation, route }) {
  const {
    characters,
    createCustomCharacter,
    updateCustomCharacterDialogues,
    updateCustomCharacterImage,
    updateCustomCharacterProfile
  } = useTaskMate();
  const characterId = route.params?.characterId;
  const character = characters.find((candidate) => candidate.id === characterId) || null;
  const [name, setName] = React.useState(character?.name || '');
  const [description, setDescription] = React.useState(character?.description || '');
  const [dialogues, setDialogues] = React.useState({
    calm: character?.dialogues?.calm?.[0] || '',
    focusing: character?.dialogues?.focusing?.[0] || '',
    relieved: character?.dialogues?.relieved?.[0] || '',
    celebrating: character?.dialogues?.celebrating?.[0] || ''
  });
  const [editingCharacter, setEditingCharacter] = React.useState(character);
  const [error, setError] = React.useState('');

  async function ensureCharacter() {
    if (editingCharacter) {
      return editingCharacter;
    }
    const created = await createCustomCharacter({
      name,
      description,
      dialogues: Object.fromEntries(
        Object.entries(dialogues).map(([key, value]) => [key, value ? [value] : []])
      )
    });
    setEditingCharacter(created);
    return created;
  }

  async function saveDialogues() {
    setError('');
    try {
      const current = await ensureCharacter();
      await updateCustomCharacterProfile(current.id, { name, description });
      await updateCustomCharacterDialogues(
        current.id,
        Object.fromEntries(
          Object.entries(dialogues).map(([key, value]) => [key, value ? [value] : []])
        )
      );
      navigation.goBack();
    } catch (saveError) {
      setError(messageFromError(saveError));
    }
  }

  async function pickImage(stateName) {
    setError('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('写真へのアクセスが許可されませんでした。設定から許可できます。');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1
      });
      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }
      const current = await ensureCharacter();
      await updateCustomCharacterImage(current.id, stateName, result.assets[0].uri);
    } catch (pickError) {
      setError(messageFromError(pickError, '画像を保存できませんでした。'));
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>CUSTOM CHARACTER</Text>
        <Text style={styles.title}>{character ? 'キャラクター編集' : 'キャラクター作成'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>名前</Text>
        <TextInput
          accessibilityLabel="キャラクター名"
          value={name}
          onChangeText={setName}
          placeholder="名前"
          style={styles.input}
        />

        <Text style={styles.label}>説明</Text>
        <TextInput
          accessibilityLabel="キャラクター説明"
          value={description}
          onChangeText={setDescription}
          placeholder="どんなキャラクターか"
          style={[styles.input, styles.textarea]}
          multiline
        />

        <View style={styles.imageActions}>
          {[
            ['wait', '通常画像'],
            ['click', 'クリック画像'],
            ['alarm', '通知画像']
          ].map(([stateName, label]) => (
            <Pressable
              key={stateName}
              accessibilityRole="button"
              accessibilityLabel={`${label}を選択する`}
              style={styles.secondary}
              onPress={() => pickImage(stateName)}
            >
              <Text style={styles.secondaryText}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {Object.entries(dialogues).map(([key, value]) => (
          <View key={key}>
            <Text style={styles.label}>セリフ: {key}</Text>
            <TextInput
              accessibilityLabel={`${key}のセリフ`}
              value={value}
              onChangeText={(next) =>
                setDialogues((current) => ({ ...current, [key]: next }))
              }
              placeholder="短い応援の言葉"
              style={styles.input}
            />
          </View>
        ))}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="キャラクターを保存する"
            style={styles.primary}
            onPress={saveDialogues}
          >
            <Text style={styles.primaryText}>保存</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="キャラクター編集をキャンセルする"
            style={styles.secondary}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryText}>キャンセル</Text>
          </Pressable>
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
    gap: 10,
    paddingBottom: 80
  },
  eyebrow: {
    color: '#5E6F60',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1
  },
  title: {
    color: '#1F2A22',
    fontSize: 26,
    fontWeight: '900'
  },
  error: {
    padding: 10,
    borderRadius: 8,
    color: '#7A2424',
    backgroundColor: '#FFF0F0'
  },
  label: {
    marginTop: 8,
    color: '#334337',
    fontSize: 13,
    fontWeight: '800'
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#B9C8B7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    fontSize: 16
  },
  textarea: {
    minHeight: 88,
    textAlignVertical: 'top'
  },
  imageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16
  },
  primary: {
    flex: 1,
    padding: 13,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#315C3A'
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  secondary: {
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9AAE98',
    backgroundColor: '#FFFFFF',
    alignItems: 'center'
  },
  secondaryText: {
    color: '#315C3A',
    fontWeight: '900'
  }
});

module.exports = CharacterEditScreen;
