const guideDialogue = require('./characters/guideDialogue');
const taskSchedule = require('./tasks/taskSchedule');
const taskValidation = require('./tasks/taskValidation');
const taskNormalizer = require('./tasks/taskNormalizer');
const taskSorter = require('./tasks/taskSorter');
const dailyStreak = require('./streaks/dailyStreak');

module.exports = {
  ...guideDialogue,
  ...dailyStreak,
  ...taskSchedule,
  ...taskValidation,
  ...taskNormalizer,
  ...taskSorter
};
