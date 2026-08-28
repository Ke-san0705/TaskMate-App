const guideDialogue = require('./characters/guideDialogue');
const taskSchedule = require('./tasks/taskSchedule');
const taskValidation = require('./tasks/taskValidation');
const taskNormalizer = require('./tasks/taskNormalizer');
const taskSorter = require('./tasks/taskSorter');

module.exports = {
  ...guideDialogue,
  ...taskSchedule,
  ...taskValidation,
  ...taskNormalizer,
  ...taskSorter
};
