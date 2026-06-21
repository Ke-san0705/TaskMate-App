function shouldLog() {
  return typeof __DEV__ === 'undefined' ? true : __DEV__;
}

function log(scope, message, details) {
  if (!shouldLog()) {
    return;
  }
  if (details === undefined) {
    console.log(`[TaskMate:${scope}] ${message}`);
  } else {
    console.log(`[TaskMate:${scope}] ${message}`, details);
  }
}

function warn(scope, message, error) {
  if (!shouldLog()) {
    return;
  }
  console.warn(`[TaskMate:${scope}] ${message}`, error);
}

module.exports = {
  log,
  warn
};
