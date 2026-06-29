const { localDateKey } = require('@taskmate/core');

const DAY_MS = 24 * 60 * 60 * 1000;

const PROJECT_STATUS_LABELS = Object.freeze({
  not_started: '未着手',
  in_progress: '進行中',
  completed: '完了',
  paused: '一時停止'
});

const PROJECT_PRIORITY_LABELS = Object.freeze({
  low: '低',
  medium: '中',
  high: '高',
  urgent: '緊急'
});

const PROJECT_TASK_STATUS_LABELS = Object.freeze({
  not_started: '未着手',
  in_progress: '進行中',
  completed: '完了'
});

const PROJECT_PRIORITY_SCORE = Object.freeze({
  urgent: 40,
  high: 30,
  medium: 20,
  low: 10
});

function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

function daysUntil(dateKey, today = localDateKey(new Date())) {
  const date = parseDateKey(dateKey);
  const base = parseDateKey(today);
  if (!date || !base) {
    return null;
  }
  return Math.ceil((date.getTime() - base.getTime()) / DAY_MS);
}

function deadlineStatus(dateKey, today = localDateKey(new Date()), warningDays = 7) {
  const remainingDays = daysUntil(dateKey, today);
  if (remainingDays === null) {
    return { state: 'unknown', label: '期限未設定', remainingDays: null };
  }
  if (remainingDays < 0) {
    return { state: 'overdue', label: '期限超過', remainingDays };
  }
  if (remainingDays <= warningDays) {
    return {
      state: remainingDays <= 3 ? 'urgent' : 'warning',
      label: remainingDays <= 3 ? '期限間近' : '注意',
      remainingDays
    };
  }
  if (remainingDays <= 14) {
    return { state: 'watch', label: '注意', remainingDays };
  }
  return { state: 'normal', label: '通常', remainingDays };
}

function calculateProjectProgress(project, projectTasks = []) {
  if (project.status === 'completed') {
    return 100;
  }
  const tasks = projectTasks.filter((task) => task.projectId === project.id);
  if (tasks.length === 0) {
    return project.progress || 0;
  }
  const totalMinutes = tasks.reduce(
    (total, task) => total + Math.max(0, task.estimatedMinutes || 0),
    0
  );
  if (totalMinutes > 0) {
    const doneMinutes = tasks.reduce((total, task) => {
      const progress = task.status === 'completed' ? 100 : task.progress || 0;
      return total + Math.max(0, task.estimatedMinutes || 0) * (progress / 100);
    }, 0);
    return Math.round((doneMinutes / totalMinutes) * 100);
  }
  return Math.round(
    (tasks.filter((task) => task.status === 'completed').length / tasks.length) * 100
  );
}

function analyzeProjectRisk(project, projectTasks = [], settings = {}, today = localDateKey(new Date())) {
  const tasks = projectTasks.filter(
    (task) => task.projectId === project.id && task.status !== 'completed'
  );
  const deadline = deadlineStatus(project.deadline, today, settings.deadlineWarningDays || 7);
  const availableDays =
    deadline.remainingDays === null ? null : Math.max(1, deadline.remainingDays + 1);
  const availableMinutesPerDay = Math.max(1, settings.dailyAvailableMinutes || 120);
  const remainingMinutes = tasks.reduce(
    (total, task) =>
      total + Math.max(0, task.estimatedMinutes || 0) * (1 - (task.progress || 0) / 100),
    0
  );
  const availableMinutes =
    availableDays === null ? null : availableDays * availableMinutesPerDay;
  const requiredPerDay =
    availableDays === null ? 0 : Math.ceil(remainingMinutes / availableDays);

  let level = 'safe';
  let label = '安全';
  let message = '現在のペースなら期限に間に合う見込みです。';

  if (deadline.state === 'overdue') {
    level = 'delayed';
    label = '遅延';
    message = '期限を過ぎています。まず今日できる一手を選びましょう。';
  } else if (availableMinutes !== null && remainingMinutes > availableMinutes) {
    level = 'delayed';
    label = '遅延';
    const shortage = Math.ceil(remainingMinutes - availableMinutes);
    message = `現在の設定では、期限までに約${shortage}分不足する可能性があります。`;
  } else if (availableMinutes !== null && remainingMinutes >= availableMinutes * 0.9) {
    level = 'danger';
    label = '危険';
    message = `期限までに1日あたり約${requiredPerDay}分の作業が必要です。`;
  } else if (availableMinutes !== null && remainingMinutes >= availableMinutes * 0.7) {
    level = 'warning';
    label = '注意';
    message = `このプロジェクトには1日あたり約${requiredPerDay}分の作業が必要です。`;
  }

  return {
    level,
    label,
    message,
    remainingMinutes,
    availableMinutes,
    requiredPerDay
  };
}

function deadlineUrgencyScore(task, today) {
  const remainingDays = daysUntil(task.deadline, today);
  if (remainingDays === null) return 5;
  if (remainingDays < 0) return 100;
  if (remainingDays === 0) return 80;
  if (remainingDays <= 3) return 60;
  if (remainingDays <= 7) return 40;
  if (remainingDays <= 14) return 20;
  return 5;
}

function dependencyBlockers(task, projectTasks) {
  return (task.dependencyTaskIds || [])
    .map((dependencyId) => projectTasks.find((candidate) => candidate.id === dependencyId))
    .filter((dependency) => dependency && dependency.status !== 'completed');
}

function scoreProjectTask(task, context) {
  const {
    project,
    projectTasks,
    today = localDateKey(new Date()),
    projectRisk = null
  } = context;
  const blockers = dependencyBlockers(task, projectTasks);
  const deadlineScore = deadlineUrgencyScore(task, today);
  const importanceScore = (task.importance || 3) * 10;
  const projectPriorityScore = PROJECT_PRIORITY_SCORE[project?.priority] || 20;
  const riskScore =
    projectRisk?.level === 'delayed' ? 35 : projectRisk?.level === 'danger' ? 25 : 0;
  const blockedPenalty = blockers.length > 0 ? 120 : 0;

  return {
    score: deadlineScore + importanceScore + projectPriorityScore + riskScore - blockedPenalty,
    blockers,
    reason:
      blockers.length > 0
        ? `先に「${blockers[0].title}」を進める必要があります。`
        : deadlineScore >= 40
          ? '期限が近いため、早めに着手すると安心です。'
          : '作業時間と期限のバランスがよく、今日進めやすいTodoです。'
  };
}

function getRecommendedProjectTasks({
  projects = [],
  projectTasks = [],
  settings = {},
  today = localDateKey(new Date())
}) {
  const activeProjects = projects.filter(
    (project) => project.status !== 'completed' && project.status !== 'paused'
  );
  const risks = new Map(
    activeProjects.map((project) => [
      project.id,
      analyzeProjectRisk(project, projectTasks, settings, today)
    ])
  );

  return projectTasks
    .filter((task) => task.status !== 'completed')
    .filter((task) => !task.startDate || task.startDate <= today)
    .map((task) => {
      const project = activeProjects.find((candidate) => candidate.id === task.projectId);
      if (!project) return null;
      const scored = scoreProjectTask(task, {
        project,
        projectTasks,
        today,
        projectRisk: risks.get(project.id)
      });
      return {
        ...task,
        project,
        score: scored.score,
        blockers: scored.blockers,
        recommendationReason: scored.reason
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.deadline.localeCompare(right.deadline))
    .slice(0, settings.dailyRecommendationLimit || 5);
}

function summarizeProjects({
  categories = [],
  projects = [],
  milestones = [],
  projectTasks = [],
  settings = {},
  today = localDateKey(new Date())
}) {
  const recommendations = getRecommendedProjectTasks({
    projects,
    projectTasks,
    settings,
    today
  });

  return projects.map((project) => {
    const tasks = projectTasks.filter((task) => task.projectId === project.id);
    const incompleteTasks = tasks.filter((task) => task.status !== 'completed');
    const category = categories.find((candidate) => candidate.id === project.categoryId) || null;
    return {
      project: {
        ...project,
        progress: calculateProjectProgress(project, projectTasks)
      },
      category,
      milestones: milestones.filter((milestone) => milestone.projectId === project.id),
      tasks,
      incompleteTasks,
      deadline: deadlineStatus(project.deadline, today, settings.deadlineWarningDays || 7),
      risk: analyzeProjectRisk(project, projectTasks, settings, today),
      nextTask: recommendations.find((task) => task.projectId === project.id) || null
    };
  });
}

module.exports = {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TASK_STATUS_LABELS,
  analyzeProjectRisk,
  calculateProjectProgress,
  deadlineStatus,
  getRecommendedProjectTasks,
  summarizeProjects
};
