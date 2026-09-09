const React = require('react');
const { TextInput } = require('react-native');

const JapaneseTextInput = React.forwardRef(function JapaneseTextInput(props, ref) {
  const {
    placeholderTextColor = '#8A9488',
    selectionColor = '#315C3A',
    ...rest
  } = props;

  return (
    <TextInput
      ref={ref}
      autoCapitalize="none"
      autoComplete="off"
      autoCorrect={false}
      disableFullscreenUI
      importantForAutofill="no"
      keyboardType="default"
      placeholderTextColor={placeholderTextColor}
      selectionColor={selectionColor}
      spellCheck={false}
      textContentType="none"
      {...rest}
    />
  );
});

module.exports = JapaneseTextInput;
