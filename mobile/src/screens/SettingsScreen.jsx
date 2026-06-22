const React = require('react');
const { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } = require('react-native');
const { SafeAreaView } = require('react-native-safe-area-context');
const ErrorBanner = require('../components/ErrorBanner');
const { useTaskMate } = require('../context/TaskMateContext');

function Row({ title, body, children }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {body ? <Text style={styles.rowBody}>{body}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function SettingsScreen() {
  const {
    account,
    deleteAllLocalData,
    deleteAccount,
    error,
    importCloudCharacter,
    requestNotifications,
    resetLifeState,
    refreshCloudCharacters,
    selectedCharacter,
    setError,
    settings,
    signInAccount,
    signOutAccount,
    signUpAccount,
    uploadSelectedCharacterToCloud,
    updateSettings
  } = useTaskMate();
  const [message, setMessage] = React.useState('');
  const [accountEmail, setAccountEmail] = React.useState('');
  const [accountPassword, setAccountPassword] = React.useState('');

  if (!settings) {
    return null;
  }

  async function toggle(key, value) {
    setMessage('');
    await updateSettings({ [key]: value });
  }

  async function updateQuietHours(partial) {
    await updateSettings({
      quietHours: {
        ...(settings.quietHours || {}),
        ...partial
      }
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} onClose={() => setError('')} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Text style={styles.eyebrow}>SETTINGS</Text>
        <Text style={styles.title}>設定</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>アカウント</Text>
          {!account.configured ? (
            <Text style={styles.privacy}>
              mobile/.envにEXPO_PUBLIC_SUPABASE_URLとEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEYを
              設定してアプリを再起動すると、ログインとキャラクター同期が有効になります。
            </Text>
          ) : account.session ? (
            <>
              <Text style={styles.privacy}>
                ログイン中: {account.user?.email || account.user?.id}
              </Text>
              <View style={styles.buttonRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="クラウドキャラクター一覧を更新する"
                  style={styles.secondaryFull}
                  onPress={async () => {
                    await refreshCloudCharacters();
                    setMessage('クラウド一覧を更新しました。');
                  }}
                >
                  <Text style={styles.secondaryText}>一覧を更新</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="ログアウトする"
                  style={styles.warningFull}
                  onPress={async () => {
                    await signOutAccount();
                    setMessage('ログアウトしました。');
                  }}
                >
                  <Text style={styles.warningText}>ログアウト</Text>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="アカウントを削除する"
                style={styles.dangerFull}
                onPress={() =>
                  Alert.alert(
                    'アカウントを削除しますか？',
                    'クラウド上のアカウントとキャラクターデータを削除します。元に戻せません。',
                    [
                      { text: 'キャンセル', style: 'cancel' },
                      {
                        text: '削除',
                        style: 'destructive',
                        onPress: async () => {
                          await deleteAccount();
                          setMessage('アカウント削除を実行しました。');
                        }
                      }
                    ]
                  )
                }
              >
                <Text style={styles.dangerText}>アカウント削除</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="選択中のカスタムキャラクターをクラウドへ保存する"
                disabled={selectedCharacter?.builtIn}
                style={[
                  styles.primaryFull,
                  selectedCharacter?.builtIn && styles.disabledButton
                ]}
                onPress={async () => {
                  await uploadSelectedCharacterToCloud();
                  setMessage('選択中のカスタムキャラクターをクラウドへ保存しました。');
                }}
              >
                <Text style={styles.primaryText}>
                  {selectedCharacter?.builtIn
                    ? 'カスタムキャラを選択してください'
                    : '選択中のキャラをクラウド保存'}
                </Text>
              </Pressable>
              {account.cloudCharacters.map((character) => (
                <View key={character.local_character_id} style={styles.cloudItem}>
                  <View style={styles.cloudItemText}>
                    <Text style={styles.rowTitle}>{character.name}</Text>
                    <Text style={styles.cloudMeta}>
                      {character.source_device || 'unknown'} /{' '}
                      {character.updated_at
                        ? new Date(character.updated_at).toLocaleString()
                        : '未同期'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${character.name}を取り込む`}
                    style={styles.secondaryFull}
                    onPress={async () => {
                      await importCloudCharacter(character.local_character_id);
                      setMessage('クラウドのキャラクターを端末へ保存しました。');
                    }}
                  >
                    <Text style={styles.secondaryText}>取り込む</Text>
                  </Pressable>
                </View>
              ))}
              {account.cloudCharacters.length === 0 ? (
                <Text style={styles.privacy}>クラウドに保存されたキャラクターはまだありません。</Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.label}>メールアドレス</Text>
              <TextInput
                accessibilityLabel="アカウントのメールアドレス"
                value={accountEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setAccountEmail}
                style={styles.input}
              />
              <Text style={styles.label}>パスワード</Text>
              <TextInput
                accessibilityLabel="アカウントのパスワード"
                value={accountPassword}
                secureTextEntry
                onChangeText={setAccountPassword}
                style={styles.input}
              />
              <View style={styles.buttonRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="ログインする"
                  style={styles.primaryFull}
                  onPress={async () => {
                    await signInAccount(accountEmail, accountPassword);
                    setMessage('ログインしました。');
                  }}
                >
                  <Text style={styles.primaryText}>ログイン</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="新規登録する"
                  style={styles.secondaryFull}
                  onPress={async () => {
                    await signUpAccount(accountEmail, accountPassword);
                    setMessage('登録しました。メール確認が必要な場合は受信箱を確認してください。');
                  }}
                >
                  <Text style={styles.secondaryText}>新規登録</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Row
            title="通知"
            body="時刻ありタスクだけ、締切前と締切時刻にローカル通知を登録します。"
          >
            <Switch
              accessibilityLabel="通知を有効にする"
              value={settings.notificationsEnabled}
              onValueChange={(value) => toggle('notificationsEnabled', value)}
            />
          </Row>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="通知権限を確認する"
            style={styles.secondaryFull}
            onPress={async () => {
              const granted = await requestNotifications();
              setMessage(granted ? '通知が許可されました。' : '通知は許可されていません。');
            }}
          >
            <Text style={styles.secondaryText}>通知権限を確認</Text>
          </Pressable>
          <Text style={styles.label}>事前通知 分</Text>
          <TextInput
            accessibilityLabel="事前通知時間"
            value={String(settings.notificationMinutesBefore)}
            keyboardType="number-pad"
            onChangeText={(value) => {
              const minutes = Number(value);
              if (Number.isFinite(minutes)) {
                updateSettings({
                  notificationMinutesBefore: minutes,
                  notificationOffsets: [minutes, 0]
                });
              }
            }}
            style={styles.input}
          />
        </View>

        <View style={styles.card}>
          <Row title="生活状態表現" body="キャラクターのふるまいと吹き出しを状況へ連動します。">
            <Switch
              accessibilityLabel="生活状態表現を有効にする"
              value={settings.behaviorEnabled}
              onValueChange={(value) => toggle('behaviorEnabled', value)}
            />
          </Row>
          <Row title="周辺エフェクト" body="背景の雰囲気を控えめに表示します。">
            <Switch
              accessibilityLabel="周辺エフェクトを有効にする"
              value={settings.ambientEffects}
              onValueChange={(value) => toggle('ambientEffects', value)}
            />
          </Row>
          <Row title="完了リアクション" body="完了時に少しだけ表情を変えます。">
            <Switch
              accessibilityLabel="完了リアクションを有効にする"
              value={settings.completionReactions}
              onValueChange={(value) => toggle('completionReactions', value)}
            />
          </Row>
          <Row title="継続関係の記憶" body="利用日数と完了数から関係段階を育てます。">
            <Switch
              accessibilityLabel="継続関係の記憶を有効にする"
              value={settings.relationshipMemoryEnabled}
              onValueChange={(value) => toggle('relationshipMemoryEnabled', value)}
            />
          </Row>
          <Row title="モーション軽減" body="動きのある表現をできるだけ抑えます。">
            <Switch
              accessibilityLabel="モーション軽減を有効にする"
              value={settings.reduceMotion}
              onValueChange={(value) => toggle('reduceMotion', value)}
            />
          </Row>
          <Text style={styles.label}>ふるまいの強さ</Text>
          <View style={styles.segment}>
            {['low', 'normal', 'high'].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`ふるまいの強さ ${value}`}
                style={[
                  styles.segmentButton,
                  settings.behaviorIntensity === value && styles.segmentActive
                ]}
                onPress={() => updateSettings({ behaviorIntensity: value })}
              >
                <Text
                  style={[
                    styles.segmentText,
                    settings.behaviorIntensity === value && styles.segmentTextActive
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Row title="静かな時間帯" body="自発的なセリフを抑えます。通知は通知設定に従います。">
            <Switch
              accessibilityLabel="静かな時間帯を有効にする"
              value={settings.quietHours?.enabled !== false}
              onValueChange={(value) => updateQuietHours({ enabled: value })}
            />
          </Row>
          <View style={styles.timeRow}>
            <View style={styles.timeInput}>
              <Text style={styles.label}>開始</Text>
              <TextInput
                accessibilityLabel="静かな時間の開始"
                value={settings.quietHours?.start || '22:00'}
                onChangeText={(value) => updateQuietHours({ start: value })}
                style={styles.input}
              />
            </View>
            <View style={styles.timeInput}>
              <Text style={styles.label}>終了</Text>
              <TextInput
                accessibilityLabel="静かな時間の終了"
                value={settings.quietHours?.end || '07:00'}
                onChangeText={(value) => updateQuietHours({ end: value })}
                style={styles.input}
              />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="関係記憶をリセットする"
            style={styles.warningFull}
            onPress={() =>
              Alert.alert('関係記憶をリセットしますか？', 'タスクと設定は残ります。', [
                { text: 'キャンセル', style: 'cancel' },
                { text: 'リセット', style: 'destructive', onPress: resetLifeState }
              ])
            }
          >
            <Text style={styles.warningText}>関係記憶をリセット</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="すべてのローカルデータを削除する"
            style={styles.dangerFull}
            onPress={() =>
              Alert.alert(
                'すべて削除しますか？',
                'タスク、設定、関係記憶、カスタムキャラクターを端末内から削除します。',
                [
                  { text: 'キャンセル', style: 'cancel' },
                  { text: 'すべて削除', style: 'destructive', onPress: deleteAllLocalData }
                ]
              )
            }
          >
            <Text style={styles.dangerText}>すべてのローカルデータを削除</Text>
          </Pressable>
          <Text style={styles.privacy}>
            TaskMate Mobileは、タスク・設定・キャラクターを端末内に保存します。広告、課金、
            テレメトリー、外部API送信はこのMVPでは使用していません。
          </Text>
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
    gap: 14,
    paddingBottom: 120
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
  message: {
    padding: 10,
    borderRadius: 8,
    color: '#315C3A',
    backgroundColor: '#E7F2DF',
    fontWeight: '800'
  },
  sectionTitle: {
    color: '#1F2A22',
    fontSize: 18,
    fontWeight: '900'
  },
  card: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D5DED3',
    backgroundColor: '#FFFFFF',
    gap: 12
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  rowText: {
    flex: 1
  },
  rowTitle: {
    color: '#1F2A22',
    fontSize: 16,
    fontWeight: '900'
  },
  rowBody: {
    marginTop: 3,
    color: '#5A675E',
    lineHeight: 19
  },
  label: {
    color: '#334337',
    fontSize: 13,
    fontWeight: '800'
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#B9C8B7',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 15
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10
  },
  timeInput: {
    flex: 1,
    gap: 6
  },
  segment: {
    flexDirection: 'row',
    gap: 8
  },
  segmentButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A8B8A4',
    alignItems: 'center'
  },
  segmentActive: {
    backgroundColor: '#315C3A',
    borderColor: '#315C3A'
  },
  segmentText: {
    color: '#315C3A',
    fontWeight: '800'
  },
  segmentTextActive: {
    color: '#FFFFFF'
  },
  secondaryFull: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A8B8A4'
  },
  secondaryText: {
    color: '#315C3A',
    fontWeight: '900'
  },
  primaryFull: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#315C3A'
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  disabledButton: {
    opacity: 0.5
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10
  },
  cloudItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D5DED3',
    backgroundColor: '#F8FBF5'
  },
  cloudItemText: {
    flex: 1
  },
  cloudMeta: {
    marginTop: 2,
    color: '#5A675E',
    fontSize: 12
  },
  warningFull: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F5E5B8'
  },
  warningText: {
    color: '#5E4514',
    fontWeight: '900'
  },
  dangerFull: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#8E2F2F'
  },
  dangerText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  privacy: {
    color: '#516052',
    fontSize: 13,
    lineHeight: 19
  }
});

module.exports = SettingsScreen;
