const React = require('react');
const { StyleSheet, View } = require('react-native');
const { colors } = require('../theme/taskMateTheme');

function Line({ style, color }) {
  return <View style={[styles.line, { backgroundColor: color }, style]} />;
}

function HomeIcon({ color }) {
  return (
    <View style={styles.box}>
      <View style={[styles.homeRoof, { borderBottomColor: color }]} />
      <View style={[styles.homeBody, { backgroundColor: color }]}>
        <View style={styles.homeDoor} />
      </View>
    </View>
  );
}

function TaskIcon({ color }) {
  return (
    <View style={styles.box}>
      <View style={[styles.sheet, { borderColor: color }]}>
        <Line color={color} style={styles.taskLineTop} />
        <Line color={color} style={styles.taskLineBottom} />
        <View style={[styles.checkStem, { backgroundColor: color }]} />
        <View style={[styles.checkArm, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ProjectIcon({ color }) {
  return (
    <View style={styles.box}>
      <View style={[styles.projectBase, { backgroundColor: color, opacity: 0.18 }]} />
      <View style={[styles.projectMountainLeft, { borderBottomColor: color }]} />
      <View style={[styles.projectMountainRight, { borderBottomColor: color }]} />
      <View style={[styles.progressRail, { borderColor: color }]}>
        <View style={[styles.progressFill, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function CharacterIcon({ color }) {
  return (
    <View style={styles.box}>
      <View style={[styles.earLeft, { borderBottomColor: color }]} />
      <View style={[styles.earRight, { borderBottomColor: color }]} />
      <View style={[styles.face, { borderColor: color }]}>
        <View style={[styles.eyeLeft, { backgroundColor: color }]} />
        <View style={[styles.eyeRight, { backgroundColor: color }]} />
        <View style={[styles.smile, { borderColor: color }]} />
      </View>
    </View>
  );
}

function SettingsIcon({ color }) {
  return (
    <View style={styles.box}>
      {[0, 45, 90, 135].map((rotation) => (
        <Line
          key={rotation}
          color={color}
          style={[styles.gearTooth, { transform: [{ rotate: `${rotation}deg` }] }]}
        />
      ))}
      <View style={[styles.gearOuter, { borderColor: color }]}>
        <View style={[styles.gearInner, { borderColor: color }]} />
      </View>
    </View>
  );
}

// Custom, dependency-free tab icons. They use the same stroke weight and rounded forms
// so the five tabs feel like one TaskMate icon family.
function TaskMateNavIcon({ name, focused, color }) {
  const tint = color || (focused ? colors.primary : colors.textMuted);
  if (name === 'home') return <HomeIcon color={tint} />;
  if (name === 'tasks') return <TaskIcon color={tint} />;
  if (name === 'projects') return <ProjectIcon color={tint} />;
  if (name === 'characters') return <CharacterIcon color={tint} />;
  return <SettingsIcon color={tint} />;
}

const styles = StyleSheet.create({
  box: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  line: {
    position: 'absolute',
    height: 3,
    borderRadius: 3
  },
  homeRoof: {
    position: 'absolute',
    top: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent'
  },
  homeBody: {
    position: 'absolute',
    bottom: 4,
    width: 20,
    height: 14,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    overflow: 'hidden'
  },
  homeDoor: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    width: 6,
    height: 9,
    backgroundColor: colors.card,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2
  },
  sheet: {
    width: 20,
    height: 22,
    borderWidth: 3,
    borderRadius: 5
  },
  taskLineTop: {
    width: 9,
    top: 6,
    right: 3
  },
  taskLineBottom: {
    width: 9,
    top: 13,
    right: 3
  },
  checkStem: {
    position: 'absolute',
    width: 3,
    height: 8,
    left: 4,
    top: 9,
    borderRadius: 3,
    transform: [{ rotate: '-42deg' }]
  },
  checkArm: {
    position: 'absolute',
    width: 3,
    height: 12,
    left: 9,
    top: 5,
    borderRadius: 3,
    transform: [{ rotate: '43deg' }]
  },
  projectBase: {
    position: 'absolute',
    bottom: 4,
    width: 23,
    height: 6,
    borderRadius: 6
  },
  projectMountainLeft: {
    position: 'absolute',
    bottom: 8,
    left: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent'
  },
  projectMountainRight: {
    position: 'absolute',
    bottom: 8,
    right: 3,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    opacity: 0.75
  },
  progressRail: {
    position: 'absolute',
    bottom: 3,
    width: 23,
    height: 6,
    borderWidth: 2,
    borderRadius: 8,
    overflow: 'hidden'
  },
  progressFill: {
    width: 13,
    height: '100%'
  },
  earLeft: {
    position: 'absolute',
    top: 4,
    left: 6,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '-22deg' }]
  },
  earRight: {
    position: 'absolute',
    top: 4,
    right: 6,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '22deg' }]
  },
  face: {
    width: 21,
    height: 19,
    marginTop: 5,
    borderWidth: 3,
    borderRadius: 10
  },
  eyeLeft: {
    position: 'absolute',
    top: 6,
    left: 5,
    width: 3,
    height: 4,
    borderRadius: 3
  },
  eyeRight: {
    position: 'absolute',
    top: 6,
    right: 5,
    width: 3,
    height: 4,
    borderRadius: 3
  },
  smile: {
    position: 'absolute',
    left: 6,
    bottom: 4,
    width: 7,
    height: 4,
    borderBottomWidth: 2,
    borderRadius: 6
  },
  gearTooth: {
    width: 23,
    top: 12
  },
  gearOuter: {
    width: 19,
    height: 19,
    borderWidth: 3,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card
  },
  gearInner: {
    width: 7,
    height: 7,
    borderWidth: 2,
    borderRadius: 5
  }
});

module.exports = TaskMateNavIcon;
