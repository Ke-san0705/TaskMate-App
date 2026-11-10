const React = require('react');
const { Pressable, StyleSheet, Text, View } = require('react-native');
const { colors, radius } = require('../theme/taskMateTheme');

function SegmentedSwitcher({ options, value, onChange }) {
  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.selectedOption]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft
  },
  option: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8
  },
  selectedOption: {
    backgroundColor: colors.primary
  },
  label: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center'
  },
  selectedLabel: {
    color: colors.white
  }
});

module.exports = SegmentedSwitcher;
