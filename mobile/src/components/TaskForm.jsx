const React = require('react');
const {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} = require('react-native');
const { localDateKey } = require('@taskmate/core');
const { messageFromError } = require('../utils/validation');

function createInitialForm(task) {
  return {
    title: task?.title || '',
    description: task?.description || '',
    date: task?.date || localDateKey(new Date()),
    time: task?.time || '',
    genre: task?.genre || '',
    priority: task?.priority || 'normal'
  };
}

function TaskForm({ task, onSubmit, onCancel }) {
  const [form, setForm] = React.useState(() => createInitialForm(task));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        ...form,
        time: form.time.trim() ? form.time.trim() : null
      });
    } catch (submitError) {
      setError(messageFromError(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{task ? 'タスクを編集' : 'タスクを追加'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>タスク名</Text>
        <TextInput
          accessibilityLabel="タスク名"
          value={form.title}
          onChangeText={(value) => update('title', value)}
          placeholder="例: レポートをまとめる"
          style={styles.input}
          maxLength={100}
        />

        <Text style={styles.label}>日付 YYYY-MM-DD</Text>
        <TextInput
          accessibilityLabel="日付"
          value={form.date}
          onChangeText={(value) => update('date', value)}
          placeholder="2026-06-18"
          style={styles.input}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.label}>時刻 HH:mm（空なら今日中）</Text>
        <TextInput
          accessibilityLabel="時刻"
          value={form.time}
          onChangeText={(value) => update('time', value)}
          placeholder="18:00"
          style={styles.input}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.label}>ジャンル</Text>
        <TextInput
          accessibilityLabel="ジャンル"
          value={form.genre}
          onChangeText={(value) => update('genre', value)}
          placeholder="学習、仕事、生活など"
          style={styles.input}
          maxLength={40}
        />

        <Text style={styles.label}>優先度</Text>
        <View style={styles.segment}>
          {[
            ['high', '高'],
            ['normal', '通常'],
            ['low', '低']
          ].map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`優先度 ${label}`}
              onPress={() => update('priority', value)}
              style={[styles.segmentButton, form.priority === value && styles.segmentActive]}
            >
              <Text
                style={[
                  styles.segmentText,
                  form.priority === value && styles.segmentTextActive
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>説明</Text>
        <TextInput
          accessibilityLabel="説明"
          value={form.description}
          onChangeText={(value) => update('description', value)}
          placeholder="必要ならメモを追加"
          style={[styles.input, styles.textarea]}
          multiline
          maxLength={1000}
        />

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="タスクを保存する"
            disabled={saving}
            onPress={submit}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>{saving ? '保存中...' : '保存'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="編集をキャンセルする"
            onPress={onCancel}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>キャンセル</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  container: {
    padding: 16,
    gap: 8
  },
  heading: {
    color: '#1F2A22',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8
  },
  error: {
    padding: 10,
    borderRadius: 8,
    color: '#7A2424',
    backgroundColor: '#FFF0F0'
  },
  label: {
    color: '#334337',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#B9C8B7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1F2A22',
    backgroundColor: '#FFFFFF',
    fontSize: 16
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top'
  },
  segment: {
    flexDirection: 'row',
    gap: 8
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A8B8A4',
    backgroundColor: '#FFFFFF',
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
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16
  },
  primary: {
    flex: 1,
    alignItems: 'center',
    padding: 13,
    borderRadius: 8,
    backgroundColor: '#315C3A'
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  secondary: {
    flex: 1,
    alignItems: 'center',
    padding: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9AAE98',
    backgroundColor: '#FFFFFF'
  },
  secondaryText: {
    color: '#315C3A',
    fontWeight: '900'
  }
});

module.exports = TaskForm;
