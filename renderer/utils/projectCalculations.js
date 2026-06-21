import { getLocalDateKey } from './dateUtils';

const DAY_MS = 24 * 60 * 60 * 1000;

export const PROJECT_STATUS_LABELS = {
  not_started: '未着手',
  in_progress: '進行中',
  completed: '完了',
  paused: '一時停止'
};

export const PROJECT_PRIORITY_LABELS = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '緊急'
};

export const PROJECT_TASK_STATUS_LABELS = {
  not_started: '未着手',
  in_progress: '進行中',
  completed: '完了'
};

const PROJECT_PRIORITY_SCORE = {
  urgent: 40,
  high: 30,
  medium: 20,
  low: 10
};

function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function daysUntil(dateKey, today = getLocalDateKey()) {
  const date = parseDateKey(dateKey);
  const base = parseDateKey(today);
  if (!date || !base) {
    return null;
  }
  return Math.ceil((date.getTime() - base.getTime()) / DAY_MS);
}

export function deadlineStatus(dateKey, today = getLocalDateKey(), warningDays = 7) {
  const remainingDays = daysUntil(dateKey, today);
  if (remainingDays === null) {
    return {
      state: 'unknown',
      label: '期限未設定',
      remainingDays: null
    };
  }
  if (remainingDays < 0) {
    return {
      state: 'overdue',
      label: '期限超過',
      remainingDays
    };
  }
  if (remainingDays <= warningDays) {
    return {
      state: remainingDays <= 3 ? 'urgent' : 'warning',
      label: remainingDays <= 3 ? '期限間近' : '注意',
      remainingDays
    };
  }
  if (remainingDays <= 14) {
    return {
      state: 'watch',
      label: '注意',
      remainingDays
    };
  }
  return {
    state: 'normal',
    label: '通常',
    remainingDays
  };
}

export function calculateProjectProgress(project, projectTasks) {
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

export function analyzeProjectRisk(project, projectTasks, settings = {}, today = getLocalDateKey()) {
  const tasks = projectTasks.filter(
    (task) => task.projectId === project.id && task.status !== 'completed'
  );
  const deadline = deadlineStatus(
    project.deadline,
    today,
    settings.deadlineWarningDays || 7
  );
  const availableDays =
    deadline.remainingDays === null ? null : Math.max(1, deadline.remainingDays + 1);
  const availableMinutesPerDay = Math.max(
    1,
    settings.dailyAvailableMinutes || settings.weekdayAvailableMinutes || 120
  );
  const remainingMinutes = tasks.reduce(
    (total, task) =>
      total + Math.max(0, task.estimatedMinutes || 0) * (1 - (task.progress || 0) / 100),
    0
  );
  const availableMinutes =
    availableDays === null ? null : availableDays * availableMinutesPerDay;
  const requiredPerDay =
    availableDays === null ? 0 : Math.ceil(remainingMinutes / availableDays);
  const blockedCount = tasks.filter((task) => {
    const dependencies = task.dependencyTaskIds || [];
    return dependencies.some((dependencyId) => {
      const dependency = projectTasks.find((candidate) => candidate.id === dependencyId);
      return dependency && dependency.status !== 'completed';
    });
  }).length;

  let level = 'safe';
  let label = '安全';
  let message = '現在のペースで期限に間に合う見込みです。';
  if (deadline.state === 'overdue') {
    level = 'delayed';
    label = '遅延';
    message = '期限を過ぎています。完了日を見直してください。';
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

  if (blockedCount > 0 && level === 'safe') {
    level = 'warning';
    label = '注意';
    message = `前提タスクが未完了の作業が${blockedCount}件あります。`;
  }

  return {
    level,
    label,
    message,
    remainingMinutes,
    availableMinutes,
    requiredPerDay,
    blockedCount
  };
}

function deadlineUrgencyScore(task, today) {
  const remainingDays = daysUntil(task.deadline, today);
  if (remainingDays === null) {
    return 5;
  }
  if (remainingDays < 0) {
    return 100;
  }
  if (remainingDays === 0) {
    return 80;
  }
  if (remainingDays <= 3) {
    return 60;
  }
  if (remainingDays <= 7) {
    return 40;
  }
  if (remainingDays <= 14) {
    return 20;
  }
  return 5;
}

function dependentCount(task, projectTasks) {
  return projectTasks.filter((candidate) =>
    (candidate.dependencyTaskIds || []).includes(task.id)
  ).length;
}

function dependenciesIncomplete(task, projectTasks) {
  return (task.dependencyTaskIds || [])
    .map((dependencyId) => projectTasks.find((candidate) => candidate.id === dependencyId))
    .filter((dependency) => dependency && dependency.status !== 'completed');
}

export function scoreProjectTask(task, context) {
  const {
    project,
    projectTasks,
    today = getLocalDateKey(),
    availableMinutes = 120,
    projectRisk = null
  } = context;
  const blockers = dependenciesIncomplete(task, projectTasks);
  const deadlineScore = deadlineUrgencyScore(task, today);
  const importanceScore = (task.importance || 3) * 10;
  const projectPriorityScore = PROJECT_PRIORITY_SCORE[project?.priority] || 20;
  const delayRiskScore =
    projectRisk?.level === 'delayed'
      ? 35
      : projectRisk?.level === 'danger'
        ? 25
        : projectRisk?.level === 'warning'
          ? 12
          : 0;
  const dependencyScore = Math.min(30, dependentCount(task, projectTasks) * 10);
  const progressAdjustment =
    task.status === 'not_started' && deadlineScore >= 40 ? 15 : task.progress > 0 ? 5 : 0;
  const estimatedTimePenalty =
    task.estimatedMinutes > availableMinutes
      ? Math.min(30, Math.ceil((task.estimatedMinutes - availableMinutes) / 15))
      : 0;
  const blockedPenalty = blockers.length > 0 ? 120 : 0;
  const score =
    deadlineScore +
    importanceScore +
    projectPriorityScore +
    delayRiskScore +
    dependencyScore +
    progressAdjustment -
    estimatedTimePenalty -
    blockedPenalty;
  return {
    score,
    blockers,
    reason: recommendationReason({
      task,
      blockers,
      deadlineScore,
      dependencyScore,
      projectRisk
    }),
    splitSuggestion: splitSuggestion(task)
  };
}

function recommendationReason({ task, blockers, deadlineScore, dependencyScore, projectRisk }) {
  if (blockers.length > 0) {
    return `前提タスク「${blockers[0].title}」が未完了です。先に依存関係を解消してください。`;
  }
  if (dependencyScore > 0) {
    return '後続タスクの前提になっているため、先に進める価値が高いです。';
  }
  if (projectRisk?.level === 'delayed' || projectRisk?.level === 'danger') {
    return '期限までの残り作業量に対して進捗が遅れています。';
  }
  if (deadlineScore >= 80) {
    return '期限が今日または超過しているため、優先して確認してください。';
  }
  if (deadlineScore >= 40) {
    return '期限が近く、早めに着手すると余裕を作れます。';
  }
  if ((task.importance || 3) >= 4) {
    return '重要度が高いため、早めに着手するのがおすすめです。';
  }
  return '作業時間と期限のバランスがよく、今日進めやすいタスクです。';
}

function splitSuggestion(task) {
  if (task.estimatedMinutes >= 120) {
    const session = 60;
    const count = Math.ceil(task.estimatedMinutes / session);
    return `このタスクは${task.estimatedMinutes}分必要です。${session}分ずつの${count}つの作業に分けることをおすすめします。`;
  }
  if (task.estimatedMinutes > 60) {
    return `このタスクは${task.estimatedMinutes}分必要です。60分以内の小さな作業へ分けると選びやすくなります。`;
  }
  return '';
}

export function getRecommendedProjectTasks({
  projects = [],
  projectTasks = [],
  settings = {},
  today = getLocalDateKey()
}) {
  const activeProjects = projects.filter((project) => project.status !== 'completed');
  const availableMinutes =
    settings.dailyAvailableMinutes || settings.weekdayAvailableMinutes || 120;
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
      if (!project || project.status === 'paused') {
        return null;
      }
      const scored = scoreProjectTask(task, {
        project,
        projectTasks,
        today,
        availableMinutes,
        projectRisk: risks.get(project.id)
      });
      return {
        ...task,
        project,
        score: scored.score,
        blockers: scored.blockers,
        recommendationReason: scored.reason,
        splitSuggestion: scored.splitSuggestion
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.deadline.localeCompare(right.deadline))
    .slice(0, settings.dailyRecommendationLimit || 5);
}

export function summarizeProjects({
  categories = [],
  projects = [],
  milestones = [],
  projectTasks = [],
  settings = {},
  today = getLocalDateKey()
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
    const overdueTasks = incompleteTasks.filter((task) => daysUntil(task.deadline, today) < 0);
    const category = categories.find((candidate) => candidate.id === project.categoryId);
    const deadline = deadlineStatus(
      project.deadline,
      today,
      settings.deadlineWarningDays || 7
    );
    const risk = analyzeProjectRisk(project, projectTasks, settings, today);
    const nextTask = recommendations.find((task) => task.projectId === project.id) || null;
    return {
      project: {
        ...project,
        progress: calculateProjectProgress(project, projectTasks)
      },
      category,
      milestones: milestones.filter((milestone) => milestone.projectId === project.id),
      tasks,
      incompleteTasks,
      overdueTasks,
      deadline,
      risk,
      nextTask
    };
  });
}
