// TaskMate Mobile UI tokens.
// Keep the palette small so the app stays calm, readable, and recognizably TaskMate.
const colors = Object.freeze({
  background: '#F3F8F1',
  backgroundSoft: '#F6FAF3',
  card: '#FFFFFF',
  cardSoft: '#F8FBF6',
  primary: '#2F633D',
  primaryDark: '#1F4B2E',
  primarySoft: '#EAF3E6',
  text: '#1F2F25',
  textMuted: '#657468',
  border: '#D5E1D3',
  borderStrong: '#B9C8B7',
  danger: '#A33A3A',
  dangerText: '#8F3333',
  dangerSoft: '#FFF6F6',
  overdueBg: '#F7CACA',
  warningBg: '#F7E8BA',
  focusGlow: '#DDEBD7',
  white: '#FFFFFF',
  disabled: '#A9BFAE'
});

// Shared spacing and radii keep every screen gently rounded without making it playful in a noisy way.
const radius = Object.freeze({
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999
});

const spacing = Object.freeze({
  screen: 18,
  card: 16,
  section: 16,
  gap: 12,
  bottomTabPadding: 122
});

// Very light card shadow: enough separation on phones, but still close to the current flat design.
const shadows = Object.freeze({
  card: {
    shadowColor: '#183321',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  soft: {
    shadowColor: '#183321',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  }
});

const typography = Object.freeze({
  eyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4
  },
  screenTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900'
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900'
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  }
});

module.exports = {
  colors,
  radius,
  shadows,
  spacing,
  typography
};
