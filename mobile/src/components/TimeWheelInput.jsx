const React = require('react');
const {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} = require('react-native');

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, index) =>
  String(index * 5).padStart(2, '0')
);

function parseTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) {
    return { hour: '18', minute: '00' };
  }
  const hour = HOURS.includes(match[1]) ? match[1] : '18';
  const minuteNumber = Math.round(Number(match[2]) / 5) * 5;
  const minute = String(minuteNumber === 60 ? 55 : minuteNumber).padStart(2, '0');
  return { hour, minute: MINUTES.includes(minute) ? minute : '00' };
}

function WheelColumn({ label, options, value, onChange }) {
  return (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{label}</Text>
      <ScrollView
        style={styles.wheel}
        contentContainerStyle={styles.wheelContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option)}
              style={[styles.wheelItem, selected && styles.wheelItemSelected]}
            >
              <Text style={[styles.wheelText, selected && styles.wheelTextSelected]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function TimeWheelInput({
  accessibilityLabel = '時刻',
  emptyLabel = '今日中（時刻なし）',
  value,
  onChange,
  style
}) {
  const [open, setOpen] = React.useState(false);
  const parsed = React.useMemo(() => parseTime(value), [value]);
  const [draft, setDraft] = React.useState(parsed);

  function openPicker() {
    setDraft(parseTime(value));
    setOpen(true);
  }

  function confirm() {
    onChange?.(`${draft.hour}:${draft.minute}`);
    setOpen(false);
  }

  function clear() {
    onChange?.('');
    setOpen(false);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={openPicker}
        style={[styles.input, style]}
      >
        <Text style={[styles.inputText, !value && styles.placeholder]}>
          {value || emptyLabel}
        </Text>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={open}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.title}>時刻を選択</Text>
            <Text style={styles.caption}>時と分をスクロールして選んでください。</Text>
            <View style={styles.wheels}>
              <WheelColumn
                label="時"
                options={HOURS}
                value={draft.hour}
                onChange={(hour) => setDraft((current) => ({ ...current, hour }))}
              />
              <Text style={styles.separator}>:</Text>
              <WheelColumn
                label="分"
                options={MINUTES}
                value={draft.minute}
                onChange={(minute) => setDraft((current) => ({ ...current, minute }))}
              />
            </View>
            <Text style={styles.preview}>{draft.hour}:{draft.minute}</Text>
            <View style={styles.actions}>
              <Pressable style={styles.clearButton} onPress={clear}>
                <Text style={styles.clearText}>時刻なし</Text>
              </Pressable>
              <Pressable style={styles.cancelButton} onPress={() => setOpen(false)}>
                <Text style={styles.cancelText}>キャンセル</Text>
              </Pressable>
              <Pressable style={styles.okButton} onPress={confirm}>
                <Text style={styles.okText}>決定</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    justifyContent: 'center'
  },
  inputText: {
    color: '#1F2A22',
    fontSize: 16
  },
  placeholder: {
    color: '#8A9488'
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(31, 42, 34, 0.32)'
  },
  sheet: {
    gap: 12,
    padding: 18,
    paddingBottom: 28,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: '#FFFFFF'
  },
  title: {
    color: '#1F2A22',
    fontSize: 20,
    fontWeight: '900'
  },
  caption: {
    color: '#667264',
    fontSize: 13
  },
  wheels: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  column: {
    flex: 1
  },
  columnLabel: {
    marginBottom: 6,
    color: '#334337',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center'
  },
  wheelContent: {
    gap: 6,
    paddingVertical: 4
  },
  wheel: {
    maxHeight: 260
  },
  wheelItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D5DED3',
    backgroundColor: '#F8FBF6'
  },
  wheelItemSelected: {
    borderColor: '#315C3A',
    backgroundColor: '#315C3A'
  },
  wheelText: {
    color: '#334337',
    fontSize: 18,
    fontWeight: '800'
  },
  wheelTextSelected: {
    color: '#FFFFFF'
  },
  separator: {
    paddingTop: 20,
    color: '#315C3A',
    fontSize: 28,
    fontWeight: '900'
  },
  preview: {
    color: '#315C3A',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center'
  },
  actions: {
    flexDirection: 'row',
    gap: 8
  },
  clearButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#EEF4EC'
  },
  clearText: {
    color: '#315C3A',
    fontWeight: '900'
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9AAE98',
    backgroundColor: '#FFFFFF'
  },
  cancelText: {
    color: '#315C3A',
    fontWeight: '900'
  },
  okButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#315C3A'
  },
  okText: {
    color: '#FFFFFF',
    fontWeight: '900'
  }
});

module.exports = TimeWheelInput;
