const React = require('react');
const { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } = require('react-native');
const AccordionSection = require('./AccordionSection');
const { colors, radius, shadows } = require('../theme/taskMateTheme');

function Button({ children, onPress, disabled, danger = false }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[styles.button, danger && styles.dangerButton, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, danger && styles.dangerText]}>{children}</Text>
  </Pressable>;
}
function TaskInboxSettingsCard({ inbox }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  return <View style={styles.card}>
    <Text style={styles.title}>外部タスク連携</Text>
    <Text style={styles.body}>Museが見つけたタスクを受け取り、TaskMateを開いたときに自動で追加します。</Text>
    {!inbox.configured ? <Text style={styles.body}>このビルドでは接続先が未設定です。通常のタスク管理はそのまま利用できます。</Text> : <>
      <Text style={styles.body}>連携にはアカウントが必要です。連携したタスクはSupabaseの受信箱を経由します。端末内の既存タスクは送信しません。</Text>
      {inbox.session ? <>
        <Text style={styles.account}>{inbox.session.user.email}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>起動・復帰時に自動取得</Text>
          <Switch accessibilityLabel="外部タスクを自動取得する" value={inbox.enabled} disabled={inbox.busy} onValueChange={inbox.toggle} />
        </View>
        <Button onPress={inbox.sync} disabled={inbox.busy}>{inbox.busy ? '処理中…' : '今すぐ取得'}</Button>
        <Text style={styles.body}>最終取得: {inbox.lastSyncedAt ? new Date(inbox.lastSyncedAt).toLocaleString('ja-JP') : '未取得'}</Text>
        <AccordionSection title="Museとの接続" summary="追加専用キーを設定する">
          <Text style={styles.body}>スマホ1台・日本時間での受信に対応しています。キーはタスク追加だけに使えます。</Text>
          <Text selectable style={styles.endpoint}>{inbox.endpoint}</Text>
          <Button onPress={inbox.createKey} disabled={inbox.busy}>連携キーを発行</Button>
          {inbox.freshToken ? <View style={styles.secret}>
            <Text style={styles.label}>このキーは再表示できません</Text>
            <Text selectable style={styles.endpoint}>{inbox.freshToken}</Text>
            <Text style={styles.body}>Museの資格情報保存機能に設定してください。会話本文やURLには貼り付けないでください。</Text>
            <Button onPress={inbox.hideToken}>キー表示を閉じる</Button>
          </View> : null}
          <Button onPress={inbox.loadKeys} disabled={inbox.busy}>有効なキーを確認</Button>
          {inbox.keys.map((key) => <View key={key.id} style={styles.row}>
            <Text style={styles.body}>末尾 {key.token_suffix}</Text>
            <Button disabled={inbox.busy} onPress={() => Alert.alert('連携キーを失効しますか？', 'このキーからの新しい追加を停止します。受信済みのタスクは残ります。', [
              { text: 'キャンセル', style: 'cancel' }, { text: '失効する', style: 'destructive', onPress: () => inbox.revokeKey(key.id) }
            ])}>失効</Button>
          </View>)}
        </AccordionSection>
        <Text style={styles.body}>ログアウト後も保存済みタスクは端末に残ります。アカウントを切り替えても端末のタスク一覧は共通です。Museからの送信を止めるにはキーを失効してください。</Text>
        <Button onPress={inbox.logout} disabled={inbox.busy}>ログアウト</Button>
        <Button danger disabled={inbox.busy} onPress={() => Alert.alert('サーバーの連携データを削除しますか？', '受信箱と連携キーを削除します。端末のタスクは残ります。再接続後は同じタスクの再送を判別できません。', [
          { text: 'キャンセル', style: 'cancel' }, { text: '削除する', style: 'destructive', onPress: inbox.clearRemote }
        ])}>サーバーの連携データを削除</Button>
      </> : <>
        <Text style={styles.body}>作成済みの連携用アカウントでログインしてください。</Text>
        <TextInput accessibilityLabel="連携用メールアドレス" placeholder="メールアドレス" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" style={styles.input} />
        <TextInput accessibilityLabel="連携用パスワード" placeholder="パスワード" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" textContentType="password" style={styles.input} />
        <Button disabled={inbox.busy || !email.trim() || !password} onPress={async () => { await inbox.login(email, password); setPassword(''); }}>ログインして連携する</Button>
      </>}
      {inbox.message ? <Text accessibilityLiveRegion="polite" style={styles.body}>{inbox.message}</Text> : null}
      {inbox.error ? <Text accessibilityRole="alert" style={styles.dangerText}>{inbox.error}</Text> : null}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 16, gap: 14, backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, ...shadows.soft },
  title: { fontSize: 18, fontWeight: '900', color: colors.text },
  body: { fontSize: 14, lineHeight: 21, color: colors.textMuted, flexShrink: 1 },
  label: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  account: { fontSize: 15, fontWeight: '700', color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 12, color: colors.text, fontSize: 16 },
  button: { minHeight: 44, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.sm },
  buttonText: { color: colors.primaryDark, fontSize: 14, fontWeight: '800' },
  dangerButton: { backgroundColor: colors.dangerSoft }, dangerText: { color: colors.dangerText, fontSize: 14, lineHeight: 21 },
  disabled: { opacity: 0.5 }, secret: { padding: 12, gap: 12, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.sm },
  endpoint: { color: colors.text, fontSize: 12, lineHeight: 18 }
});
module.exports = TaskInboxSettingsCard;
