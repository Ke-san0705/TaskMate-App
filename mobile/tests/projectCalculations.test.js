const assert = require('assert/strict');
const test = require('node:test');
const {
  calculateProjectProgress,
  getRecommendedProjectTasks
} = require('../src/utils/projectCalculations');

test('プロジェクト進捗は作業時間の重みで計算する', () => {
  const project = { id: 'project-1', progress: 0 };
  const tasks = [
    {
      id: 'task-1',
      projectId: 'project-1',
      estimatedMinutes: 30,
      progress: 100,
      status: 'completed'
    },
    {
      id: 'task-2',
      projectId: 'project-1',
      estimatedMinutes: 90,
      progress: 0,
      status: 'not_started'
    }
  ];

  assert.equal(calculateProjectProgress(project, tasks), 25);
});

test('完了済みプロジェクトはTodoがなくても進捗100%として扱う', () => {
  const project = { id: 'project-1', progress: 0, status: 'completed' };

  assert.equal(calculateProjectProgress(project, []), 100);
});

test('今日候補は期限と重要度の高いTodoを優先する', () => {
  const projects = [
    {
      id: 'project-1',
      name: '発表準備',
      deadline: '2026-07-01',
      priority: 'high',
      status: 'in_progress'
    }
  ];
  const projectTasks = [
    {
      id: 'late',
      projectId: 'project-1',
      title: '期限が近い作業',
      deadline: '2026-06-24',
      estimatedMinutes: 30,
      importance: 5,
      status: 'not_started',
      dependencyTaskIds: []
    },
    {
      id: 'later',
      projectId: 'project-1',
      title: 'あとでよい作業',
      deadline: '2026-07-01',
      estimatedMinutes: 30,
      importance: 3,
      status: 'not_started',
      dependencyTaskIds: []
    }
  ];

  const recommended = getRecommendedProjectTasks({
    projects,
    projectTasks,
    today: '2026-06-23'
  });

  assert.equal(recommended[0].id, 'late');
});
