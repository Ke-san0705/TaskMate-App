const React = require('react');
const {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} = require('react-native');
const { localDateKey } = require('@taskmate/core');
const { colors, radius, shadows } = require('../theme/taskMateTheme');

const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));

function daysInMonth(year, month) {
  return new Date(Number(year), Number(month), 0).getDate();
}

function isValidDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function yearOptions(selectedYear) {
  const currentYear = new Date().getFullYear();
  const start = Math.min(currentYear - 2, Number(selectedYear) || currentYear);
  const end = Math.max(currentYear + 8, Number(selectedYear) || currentYear);
  return Array.from({ length: end - start + 1 }, (_, index) => String(start + index));
}

function parseDate(value) {
  const fallback = localDateKey(new Date());
  const safeValue = isValidDateKey(value) ? value : fallback;
  const [year, month, day] = safeValue.split('-');
  return { year, month, day };
}

function makeDateKey(draft) {
  const maxDay = daysInMonth(draft.year, draft.month);
  const day = String(Math.min(Number(draft.day), maxDay)).padStart(2, '0');
  return `${draft.year}-${draft.month}-${day}`;
}

function dayOptions(year, month) {
  return Array.from({ length: daysInMonth(year, month) }, (_, index) =>
    String(index + 1).padStart(2, '0')
  );
}

function WheelColumn({ label, options, value, onChange }) {
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    const selectedIndex = Math.max(0, options.indexOf(value));
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, selectedIndex * 48 - 96),
        animated: false
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [options, value]);

  return (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{label}</Text>
      <ScrollView
        ref={scrollRef}
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

// Date picker kept in React Native so it works the same way in Expo and the native APK.
// The value remains YYYY-MM-DD, which preserves the existing repositories and validation.
function DateWheelInput({ accessibilityLabel = '日付', value, onChange, style }) {
  const [open, setOpen] = React.useState(false);
  const parsed = React.useMemo(() => parseDate(value), [value]);
  const [draft, setDraft] = React.useState(parsed);

  const years = React.useMemo(() => yearOptions(draft.year), [draft.year]);
  const days = React.useMemo(() => dayOptions(draft.year, draft.month), [draft.year, draft.month]);
  const preview = makeDateKey(draft);

  function openPicker() {
    setDraft(parseDate(value));
    setOpen(true);
  }

  function updateDraft(partial) {
    setDraft((current) => {
      const next = { ...current, ...partial };
      const maxDay = daysInMonth(next.year, next.month);
      if (Number(next.day) > maxDay) {
        next.day = String(maxDay).padStart(2, '0');
      }
      return next;
    });
  }

  function setToday() {
    const today = parseDate(localDateKey(new Date()));
    setDraft(today);
  }

  function confirm() {
    onChange?.(preview);
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
          {value || '日付を選ぶ'}
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
            <Text style={styles.title}>日付を選ぶ</Text>
            <Text style={styles.caption}>年・月・日を選んで、期限を整えます。</Text>
            <View style={styles.wheels}>
              <WheelColumn
                label="年"
                options={years}
                value={draft.year}
                onChange={(year) => updateDraft({ year })}
              />
              <WheelColumn
                label="月"
                options={MONTHS}
                value={draft.month}
                onChange={(month) => updateDraft({ month })}
              />
              <WheelColumn
                label="日"
                options={days}
                value={draft.day}
                onChange={(day) => updateDraft({ day })}
              />
            </View>
            <Text style={styles.preview}>{preview}</Text>
            <View style={styles.actions}>
              <Pressable style={styles.todayButton} onPress={setToday}>
                <Text style={styles.todayText}>今日にする</Text>
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
    color: colors.text,
    fontSize: 16
  },
  placeholder: {
    color: colors.textMuted
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(31, 47, 37, 0.32)'
  },
  sheet: {
    gap: 12,
    padding: 18,
    paddingBottom: 28,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.card,
    ...shadows.soft
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900'
  },
  caption: {
    color: colors.textMuted,
    fontSize: 13
  },
  wheels: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  column: {
    flex: 1
  },
  columnLabel: {
    marginBottom: 6,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center'
  },
  wheel: {
    maxHeight: 250
  },
  wheelContent: {
    gap: 6,
    paddingVertical: 4
  },
  wheelItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSoft
  },
  wheelItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  wheelText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800'
  },
  wheelTextSelected: {
    color: '#FFFFFF'
  },
  preview: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center'
  },
  actions: {
    flexDirection: 'row',
    gap: 8
  },
  todayButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft
  },
  todayText: {
    color: colors.primary,
    fontWeight: '900'
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  cancelText: {
    color: colors.primary,
    fontWeight: '900'
  },
  okButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.primary
  },
  okText: {
    color: '#FFFFFF',
    fontWeight: '900'
  }
});

module.exports = DateWheelInput;
