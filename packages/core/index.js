const behaviorConstants = require('./behavior/behaviorConstants');
const taskPressureEngine = require('./behavior/taskPressureEngine');
const relationshipEngine = require('./behavior/relationshipEngine');
const actionSelector = require('./behavior/actionSelector');
const characterBehaviorEngine = require('./behavior/characterBehaviorEngine');
const dialogueEngine = require('./behavior/dialogueEngine');
const taskValidation = require('./tasks/taskValidation');
const taskNormalizer = require('./tasks/taskNormalizer');
const taskSorter = require('./tasks/taskSorter');

module.exports = {
  ...behaviorConstants,
  ...taskPressureEngine,
  ...relationshipEngine,
  ...actionSelector,
  ...characterBehaviorEngine,
  ...dialogueEngine,
  ...taskValidation,
  ...taskNormalizer,
  ...taskSorter
};
