import { useEffect, useMemo, useRef, useState } from 'react';
import useProjectState from '../hooks/useProjectState';
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TASK_STATUS_LABELS,
  analyzeProjectRisk,
  deadlineStatus,
  getRecommendedProjectTasks,
  summarizeProjects
} from '../utils/projectCalculations';
import { getLocalDateKey } from '../utils/dateUtils';

const EMPTY_CATEGORY_FORM = {
  name: '',
  description: ''
};

const EMPTY_PROJECT_FORM = {
  name: '',
  categoryId: '',
  description: '',
  startDate: getLocalDateKey(),
  deadline: '',
  priority: 'medium',
  estimatedTotalMinutes: 0
};

const EMPTY_MILESTONE_FORM = {
  title: '',
  description: '',
  deadline: '',
  status: 'not_started',
  order: 0
};

const EMPTY_TASK_FORM = {
  title: '',
  description: '',
  projectId: '',
  milestoneId: '',
  startDate: '',
  deadline: '',
  time: '',
  scheduledDate: '',
  estimatedMinutes: 45,
  importance: 3,
  difficulty: 3,
  progress: 0,
  status: 'not_started',
  dependencyTaskIds: []
};

const EMPTY_QUICK_PLAN_FORM = {
  templateId: 'exam',
  title: '',
  categoryId: '',
  startDate: getLocalDateKey(),
  deadline: '',
  workload: 'normal',
  notes: '',
  linkDependencies: true
};

const QUICK_WORKLOADS = {
  light: { label: '軽め', multiplier: 0.65 },
  normal: { label: '普通', multiplier: 1 },
  heavy: { label: '重め', multiplier: 1.45 }
};

const COMPACT_COLLAPSE_IGNORE_SELECTOR =
  'button, a, input, select, textarea, label, summary, [data-compact-collapse-ignore="true"]';

const QUICK_PLAN_TEMPLATES = [
  {
    id: 'exam',
    name: '試験対策',
    categoryHints: ['勉強'],
    defaultTitle: '試験対策',
    description: '範囲確認から演習、前日確認までを自動で分けます。',
    defaultMinutes: 480,
    priority: 'high',
    stages: [
      {
        title: '範囲確認',
        tasks: [
          { title: '試験範囲を確認する', minutesWeight: 1, importance: 5, difficulty: 2 },
          { title: '教材と提出物を集める', minutesWeight: 1, importance: 4, difficulty: 2 }
        ]
      },
      {
        title: '基礎理解',
        tasks: [
          { title: '重要公式と用語を整理する', minutesWeight: 2, importance: 4, difficulty: 3 },
          { title: '苦手な章を読み直す', minutesWeight: 2, importance: 4, difficulty: 4 }
        ]
      },
      {
        title: '問題演習',
        tasks: [
          { title: '例題を解く', minutesWeight: 2, importance: 5, difficulty: 3 },
          { title: '過去問を1回分解く', minutesWeight: 3, importance: 5, difficulty: 4 }
        ]
      },
      {
        title: '仕上げ',
        tasks: [
          { title: '間違えた問題を解き直す', minutesWeight: 2, importance: 5, difficulty: 4 },
          { title: '前日確認リストを作る', minutesWeight: 1, importance: 4, difficulty: 2 }
        ]
      }
    ]
  },
  {
    id: 'report',
    name: 'レポート提出',
    categoryHints: ['勉強', '研究'],
    defaultTitle: 'レポート提出',
    description: 'テーマ決め、資料集め、執筆、提出前確認までを作ります。',
    defaultMinutes: 420,
    priority: 'high',
    stages: [
      {
        title: 'テーマ整理',
        tasks: [
          { title: '課題条件と評価基準を確認する', minutesWeight: 1, importance: 5, difficulty: 2 },
          { title: 'レポートの問いを決める', minutesWeight: 2, importance: 5, difficulty: 3 }
        ]
      },
      {
        title: '資料集め',
        tasks: [
          { title: '参考資料を3件以上集める', minutesWeight: 2, importance: 4, difficulty: 3 },
          { title: '使う引用メモをまとめる', minutesWeight: 2, importance: 4, difficulty: 3 }
        ]
      },
      {
        title: '執筆',
        tasks: [
          { title: '構成メモを作る', minutesWeight: 1, importance: 5, difficulty: 3 },
          { title: '本文の初稿を書く', minutesWeight: 4, importance: 5, difficulty: 4 }
        ]
      },
      {
        title: '提出前確認',
        tasks: [
          { title: '誤字と引用形式を確認する', minutesWeight: 1, importance: 4, difficulty: 2 },
          { title: '提出ファイルを整える', minutesWeight: 1, importance: 5, difficulty: 2 }
        ]
      }
    ]
  },
  {
    id: 'research',
    name: '研究・発表',
    categoryHints: ['研究'],
    defaultTitle: '研究発表準備',
    description: '研究テーマや発表準備を、調査から発表練習までに分解します。',
    defaultMinutes: 900,
    priority: 'high',
    stages: [
      {
        title: '問いを決める',
        tasks: [
          { title: '研究目的を1文で書く', minutesWeight: 1, importance: 5, difficulty: 3 },
          { title: '調べる範囲を決める', minutesWeight: 1, importance: 4, difficulty: 3 }
        ]
      },
      {
        title: '調査・実験',
        tasks: [
          { title: '先行情報を集める', minutesWeight: 3, importance: 4, difficulty: 3 },
          { title: '必要なデータを整理する', minutesWeight: 3, importance: 5, difficulty: 4 }
        ]
      },
      {
        title: '分析',
        tasks: [
          { title: '結果を表や図にする', minutesWeight: 3, importance: 5, difficulty: 4 },
          { title: '考察メモを書く', minutesWeight: 2, importance: 5, difficulty: 4 }
        ]
      },
      {
        title: '発表準備',
        tasks: [
          { title: '発表スライドを作る', minutesWeight: 3, importance: 5, difficulty: 4 },
          { title: '発表練習をする', minutesWeight: 2, importance: 4, difficulty: 3 }
        ]
      }
    ]
  },
  {
    id: 'event',
    name: 'イベント準備',
    categoryHints: ['イベント', '部活動', 'その他'],
    defaultTitle: 'イベント準備',
    description: '企画、役割分担、準備、当日確認をまとめて作ります。',
    defaultMinutes: 720,
    priority: 'high',
    stages: [
      {
        title: '企画整理',
        tasks: [
          { title: '目的と参加対象を決める', minutesWeight: 1, importance: 5, difficulty: 3 },
          { title: '必要な準備物を書き出す', minutesWeight: 1, importance: 4, difficulty: 2 }
        ]
      },
      {
        title: '役割分担',
        tasks: [
          { title: '担当者を決める', minutesWeight: 1, importance: 5, difficulty: 3 },
          { title: '連絡先と締切を共有する', minutesWeight: 1, importance: 4, difficulty: 2 }
        ]
      },
      {
        title: '準備',
        tasks: [
          { title: '備品を手配する', minutesWeight: 2, importance: 4, difficulty: 3 },
          { title: '当日の流れを作る', minutesWeight: 2, importance: 5, difficulty: 3 }
        ]
      },
      {
        title: '当日確認',
        tasks: [
          { title: '前日チェックリストを確認する', minutesWeight: 1, importance: 5, difficulty: 2 },
          { title: '関係者へ最終連絡を送る', minutesWeight: 1, importance: 5, difficulty: 2 }
        ]
      }
    ]
  },
  {
    id: 'club',
    name: '部活動・大会準備',
    categoryHints: ['部活動'],
    defaultTitle: '大会準備',
    description: '目標設定、練習、確認、直前準備を作ります。',
    defaultMinutes: 600,
    priority: 'medium',
    stages: [
      {
        title: '目標設定',
        tasks: [
          { title: '大会までの目標を決める', minutesWeight: 1, importance: 4, difficulty: 2 },
          { title: '必要な練習内容を洗い出す', minutesWeight: 1, importance: 4, difficulty: 3 }
        ]
      },
      {
        title: '練習計画',
        tasks: [
          { title: '週ごとの練習メニューを作る', minutesWeight: 2, importance: 4, difficulty: 3 },
          { title: '弱点練習を入れる', minutesWeight: 2, importance: 4, difficulty: 4 }
        ]
      },
      {
        title: '確認',
        tasks: [
          { title: '必要な道具を確認する', minutesWeight: 1, importance: 4, difficulty: 2 },
          { title: '移動や集合時間を確認する', minutesWeight: 1, importance: 5, difficulty: 2 }
        ]
      }
    ]
  },
  {
    id: 'development',
    name: '個人開発',
    categoryHints: ['個人開発'],
    defaultTitle: '個人開発プロジェクト',
    description: 'アイデア、設計、実装、確認、公開準備に分けます。',
    defaultMinutes: 840,
    priority: 'medium',
    stages: [
      {
        title: 'アイデア整理',
        tasks: [
          { title: '作りたいものを1文で書く', minutesWeight: 1, importance: 4, difficulty: 2 },
          { title: '必要な機能を3つに絞る', minutesWeight: 1, importance: 4, difficulty: 3 }
        ]
      },
      {
        title: '設計',
        tasks: [
          { title: '画面の流れを描く', minutesWeight: 2, importance: 4, difficulty: 3 },
          { title: 'データ構造を決める', minutesWeight: 2, importance: 4, difficulty: 4 }
        ]
      },
      {
        title: '実装',
        tasks: [
          { title: '最小機能を実装する', minutesWeight: 4, importance: 5, difficulty: 4 },
          { title: '使いにくい箇所を直す', minutesWeight: 2, importance: 4, difficulty: 3 }
        ]
      },
      {
        title: '確認',
        tasks: [
          { title: '動作確認をする', minutesWeight: 1, importance: 5, difficulty: 3 },
          { title: '公開前チェックをする', minutesWeight: 1, importance: 4, difficulty: 2 }
        ]
      }
    ]
  },
  {
    id: 'custom',
    name: '自由作成',
    categoryHints: ['その他'],
    defaultTitle: '長期プロジェクト',
    description: 'どの用途にも使える、最小限の段階とTodoを作ります。',
    defaultMinutes: 360,
    priority: 'medium',
    stages: [
      {
        title: '整理',
        tasks: [
          { title: '目的と期限を確認する', minutesWeight: 1, importance: 4, difficulty: 2 },
          { title: '必要な作業を書き出す', minutesWeight: 1, importance: 4, difficulty: 2 }
        ]
      },
      {
        title: '実行',
        tasks: [
          { title: '最初の作業に着手する', minutesWeight: 2, importance: 4, difficulty: 3 },
          { title: '途中経過を確認する', minutesWeight: 1, importance: 3, difficulty: 2 }
        ]
      },
      {
        title: '仕上げ',
        tasks: [
          { title: '残り作業を片付ける', minutesWeight: 2, importance: 4, difficulty: 3 },
          { title: '完了条件を確認する', minutesWeight: 1, importance: 4, difficulty: 2 }
        ]
      }
    ]
  }
];

function projectSettings(settings) {
  return {
    dailyAvailableMinutes: 120,
    weekdayAvailableMinutes: 120,
    weekendAvailableMinutes: 240,
    defaultSessionMinutes: 45,
    dailyRecommendationLimit: 5,
    deadlineWarningDays: 7,
    ...(settings?.projectSettings || {})
  };
}

function remainingDaysLabel(deadline) {
  if (deadline.remainingDays === null) {
    return '期限未設定';
  }
  if (deadline.remainingDays < 0) {
    return `${Math.abs(deadline.remainingDays)}日超過`;
  }
  if (deadline.remainingDays === 0) {
    return '今日が期限';
  }
  return `残り${deadline.remainingDays}日`;
}

function formatMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '0分';
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}時間${rest ? `${rest}分` : ''}` : `${rest}分`;
}

function taskBlocked(task, projectTasks) {
  return (task.dependencyTaskIds || [])
    .map((dependencyId) => projectTasks.find((candidate) => candidate.id === dependencyId))
    .filter((dependency) => dependency && dependency.status !== 'completed');
}

function taskDependents(task, projectTasks) {
  return projectTasks.filter((candidate) =>
    (candidate.dependencyTaskIds || []).includes(task.id)
  );
}

function sortMilestones(milestones) {
  return [...milestones].sort((left, right) => {
    if ((left.order || 0) !== (right.order || 0)) {
      return (left.order || 0) - (right.order || 0);
    }
    return (left.deadline || '9999-12-31').localeCompare(right.deadline || '9999-12-31');
  });
}

function sortTasksByDeadline(tasks) {
  return [...tasks].sort((left, right) => {
    const deadlineCompare = (left.deadline || '9999-12-31').localeCompare(
      right.deadline || '9999-12-31'
    );
    if (deadlineCompare !== 0) {
      return deadlineCompare;
    }
    return left.title.localeCompare(right.title, 'ja');
  });
}

function milestoneProgress(tasks) {
  if (tasks.length === 0) {
    return 0;
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

function parseLocalDate(dateKey) {
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

function dateKeyFromLocal(date) {
  return getLocalDateKey(date);
}

function daysBetween(startDate, endDate) {
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
}

function dateAtRatio(startDate, endDate, ratio) {
  const days = daysBetween(startDate, endDate);
  const offset = Math.max(0, Math.min(days, Math.round(days * ratio)));
  const next = new Date(startDate);
  next.setDate(startDate.getDate() + offset);
  return next;
}

function roundToFive(minutes) {
  return Math.max(15, Math.round(minutes / 5) * 5);
}

function quickTemplateById(templateId) {
  return (
    QUICK_PLAN_TEMPLATES.find((template) => template.id === templateId) ||
    QUICK_PLAN_TEMPLATES[0]
  );
}

function quickWorkloadById(workloadId) {
  return QUICK_WORKLOADS[workloadId] || QUICK_WORKLOADS.normal;
}

function findTemplateCategoryId(template, categories) {
  const hints = template.categoryHints || [];
  const matched = categories.find((category) => hints.includes(category.name));
  return matched?.id || categories[0]?.id || '';
}

function quickPlanTotalMinutes(template, workloadId) {
  return roundToFive(template.defaultMinutes * quickWorkloadById(workloadId).multiplier);
}

function quickPlanTaskCount(template) {
  return template.stages.reduce((total, stage) => total + stage.tasks.length, 0);
}

function quickPlanTaskWeight(template) {
  return template.stages.reduce(
    (total, stage) =>
      total + stage.tasks.reduce((stageTotal, task) => stageTotal + (task.minutesWeight || 1), 0),
    0
  );
}

function buildQuickPlanDraft(form) {
  const template = quickTemplateById(form.templateId);
  const workload = quickWorkloadById(form.workload);
  const startDate = parseLocalDate(form.startDate) || parseLocalDate(getLocalDateKey());
  const deadline = parseLocalDate(form.deadline);
  if (!deadline) {
    throw new Error('かんたん作成には最終期限が必要です。');
  }
  if (deadline < startDate) {
    throw new Error('最終期限は開始日以降にしてください。');
  }

  const totalMinutes = quickPlanTotalMinutes(template, form.workload);
  const totalWeight = quickPlanTaskWeight(template) || 1;
  let previousTaskToken = null;
  const stages = template.stages.map((stage, stageIndex) => {
    const stageStart =
      stageIndex === 0
        ? startDate
        : dateAtRatio(startDate, deadline, stageIndex / template.stages.length);
    const stageDeadline = dateAtRatio(
      startDate,
      deadline,
      (stageIndex + 1) / template.stages.length
    );
    const tasks = stage.tasks.map((taskTemplate, taskIndex) => {
      const taskDeadline = dateAtRatio(
        stageStart,
        stageDeadline,
        (taskIndex + 1) / Math.max(1, stage.tasks.length)
      );
      const token = `${stageIndex}-${taskIndex}`;
      const task = {
        token,
        dependencyToken: form.linkDependencies ? previousTaskToken : null,
        title: taskTemplate.title,
        description: taskTemplate.description || '',
        startDate: dateKeyFromLocal(stageStart),
        deadline: dateKeyFromLocal(taskDeadline),
        scheduledDate: taskIndex === 0 && stageIndex === 0 ? dateKeyFromLocal(startDate) : null,
        estimatedMinutes: roundToFive(
          (totalMinutes * (taskTemplate.minutesWeight || 1)) / totalWeight
        ),
        importance: taskTemplate.importance || 3,
        difficulty: taskTemplate.difficulty || 3,
        progress: 0,
        status: 'not_started'
      };
      previousTaskToken = token;
      return task;
    });
    return {
      title: stage.title,
      description: stage.description || '',
      deadline: dateKeyFromLocal(stageDeadline),
      status: stageIndex === 0 ? 'in_progress' : 'not_started',
      order: stageIndex + 1,
      tasks
    };
  });

  return {
    template,
    workload,
    title: form.title.trim() || template.defaultTitle,
    description: [
      template.description,
      form.notes.trim() ? `メモ: ${form.notes.trim()}` : ''
    ]
      .filter(Boolean)
      .join('\n'),
    startDate: dateKeyFromLocal(startDate),
    deadline: dateKeyFromLocal(deadline),
    priority: template.priority,
    estimatedTotalMinutes: totalMinutes,
    stages
  };
}

export default function ProjectManagementMode({
  settings,
  onDialogue,
  onCompactCollapsedChange,
  compact = false,
  title = '長期タスク管理',
  eyebrow = 'LONG TERM TASKS'
}) {
  const projectState = useProjectState();
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [taskFilter, setTaskFilter] = useState('active');
  const [sortMode, setSortMode] = useState('deadline');
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT_FORM);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [milestoneForm, setMilestoneForm] = useState(EMPTY_MILESTONE_FORM);
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editorPanel, setEditorPanel] = useState('project');
  const [quickPlanForm, setQuickPlanForm] = useState(EMPTY_QUICK_PLAN_FORM);
  const [compactCollapsed, setCompactCollapsed] = useState(false);
  const [compactFrameHeight, setCompactFrameHeight] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const compactPanelRef = useRef(null);
  const compactPointerStartRef = useRef(null);
  const editorPanelRef = useRef(null);
  const today = getLocalDateKey();
  const pSettings = useMemo(() => projectSettings(settings), [settings]);
  const selectedQuickTemplate = quickTemplateById(quickPlanForm.templateId);
  const quickPlanPreview = useMemo(() => {
    const template = quickTemplateById(quickPlanForm.templateId);
    return {
      template,
      workload: quickWorkloadById(quickPlanForm.workload),
      totalMinutes: quickPlanTotalMinutes(template, quickPlanForm.workload),
      stageCount: template.stages.length,
      taskCount: quickPlanTaskCount(template),
      stageTitles: template.stages.map((stage) => stage.title)
    };
  }, [quickPlanForm.templateId, quickPlanForm.workload]);

  const summaries = useMemo(
    () =>
      summarizeProjects({
        categories: projectState.categories,
        projects: projectState.projects,
        milestones: projectState.milestones,
        projectTasks: projectState.projectTasks,
        settings: pSettings,
        today
      }),
    [
      projectState.categories,
      projectState.milestones,
      projectState.projectTasks,
      projectState.projects,
      pSettings,
      today
    ]
  );

  const recommendations = useMemo(
    () =>
      getRecommendedProjectTasks({
        projects: projectState.projects,
        projectTasks: projectState.projectTasks,
        settings: pSettings,
        today
      }),
    [projectState.projectTasks, projectState.projects, pSettings, today]
  );

  useEffect(() => {
    if (!compact) {
      return;
    }
    onCompactCollapsedChange?.(compactCollapsed);
  }, [compact, compactCollapsed, onCompactCollapsedChange]);

  useEffect(() => {
    if (!compact || compactCollapsed) {
      return undefined;
    }
    const panel = compactPanelRef.current;
    if (!panel) {
      return undefined;
    }

    let frame = null;
    const updateFrameHeight = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = Math.ceil(panel.getBoundingClientRect().height);
        if (!Number.isFinite(height) || height <= 0) {
          return;
        }
        setCompactFrameHeight((current) =>
          current && Math.abs(current - height) <= 1 ? current : height
        );
      });
    };

    updateFrameHeight();
    if (typeof ResizeObserver === 'undefined') {
      return () => cancelAnimationFrame(frame);
    }

    const observer = new ResizeObserver(updateFrameHeight);
    observer.observe(panel);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [compact, compactCollapsed, projectState.loading]);

  const filteredSummaries = useMemo(() => {
    const filtered = summaries.filter((summary) => {
      if (selectedCategoryId !== 'all' && summary.project.categoryId !== selectedCategoryId) {
        return false;
      }
      if (statusFilter === 'active') {
        return summary.project.status !== 'completed';
      }
      if (statusFilter !== 'all' && summary.project.status !== statusFilter) {
        return false;
      }
      return true;
    });
    return filtered.sort((left, right) => {
      if (sortMode === 'priority') {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (
          (priorityOrder[left.project.priority] ?? 9) -
          (priorityOrder[right.project.priority] ?? 9)
        );
      }
      if (sortMode === 'progress') {
        return left.project.progress - right.project.progress;
      }
      return (left.project.deadline || '9999-12-31').localeCompare(
        right.project.deadline || '9999-12-31'
      );
    });
  }, [selectedCategoryId, statusFilter, sortMode, summaries]);

  const projectGroups = useMemo(() => {
    const groups = [];
    const summariesByCategory = new Map();
    for (const summary of filteredSummaries) {
      const key = summary.project.categoryId || 'uncategorized';
      if (!summariesByCategory.has(key)) {
        summariesByCategory.set(key, []);
      }
      summariesByCategory.get(key).push(summary);
    }
    for (const category of projectState.categories) {
      const categorySummaries = summariesByCategory.get(category.id) || [];
      if (categorySummaries.length > 0 || selectedCategoryId === category.id) {
        groups.push({
          id: category.id,
          name: category.name,
          description: category.description,
          summaries: categorySummaries
        });
      }
    }
    const uncategorized = summariesByCategory.get('uncategorized') || [];
    if (uncategorized.length > 0) {
      groups.push({
        id: 'uncategorized',
        name: '未分類',
        description: 'ジャンルが設定されていないタスク',
        summaries: uncategorized
      });
    }
    return groups;
  }, [filteredSummaries, projectState.categories, selectedCategoryId]);

  const selectedSummary =
    filteredSummaries.find((summary) => summary.project.id === selectedProjectId) ||
    filteredSummaries[0] ||
    null;
  const selectedProjectKey = selectedSummary?.project.id || '';

  useEffect(() => {
    if (filteredSummaries.length === 0) {
      if (selectedProjectId) {
        setSelectedProjectId(null);
      }
      return;
    }
    const selectedProjectIsVisible = filteredSummaries.some(
      (summary) => summary.project.id === selectedProjectId
    );
    if (!selectedProjectIsVisible) {
      setSelectedProjectId(filteredSummaries[0].project.id);
    }
  }, [filteredSummaries, selectedProjectId]);

  useEffect(() => {
    if (quickPlanForm.categoryId || projectState.categories.length === 0) {
      return;
    }
    const defaultCategoryId = findTemplateCategoryId(
      selectedQuickTemplate,
      projectState.categories
    );
    if (defaultCategoryId) {
      setQuickPlanForm((current) => ({ ...current, categoryId: defaultCategoryId }));
    }
  }, [
    projectState.categories,
    quickPlanForm.categoryId,
    selectedQuickTemplate
  ]);

  useEffect(() => {
    if (!selectedProjectKey || editingTaskId) {
      return;
    }
    setTaskForm((current) => {
      if (current.projectId === selectedProjectKey) {
        return current;
      }
      return { ...current, projectId: selectedProjectKey, milestoneId: '' };
    });
  }, [editingTaskId, selectedProjectKey]);

  useEffect(() => {
    if (projectState.error) {
      setError(projectState.error);
    }
  }, [projectState.error]);

  function clearMessages() {
    setError('');
    setMessage('');
  }

  function selectNextVisibleProject(excludedProjectId) {
    const nextSummary = filteredSummaries.find(
      (summary) => summary.project.id !== excludedProjectId
    );
    setSelectedProjectId(nextSummary?.project.id || null);
  }

  function clearProjectEditing(projectId) {
    if (editingProjectId === projectId) {
      setEditingProjectId(null);
      setProjectForm({
        ...EMPTY_PROJECT_FORM,
        categoryId: selectedCategoryId !== 'all' ? selectedCategoryId : ''
      });
    }
    if (taskForm.projectId === projectId) {
      setTaskForm((current) => ({ ...current, projectId: '', milestoneId: '' }));
    }
  }

  function scrollEditorIntoView() {
    requestAnimationFrame(() => {
      editorPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  }

  function setProjectField(field, value) {
    setProjectForm((current) => ({ ...current, [field]: value }));
  }

  function setMilestoneField(field, value) {
    setMilestoneForm((current) => ({ ...current, [field]: value }));
  }

  function setTaskField(field, value) {
    setTaskForm((current) => ({ ...current, [field]: value }));
  }

  function setQuickPlanField(field, value) {
    setQuickPlanForm((current) => ({ ...current, [field]: value }));
  }

  function selectQuickTemplate(templateId) {
    const template = quickTemplateById(templateId);
    const categoryId = findTemplateCategoryId(template, projectState.categories);
    setQuickPlanForm((current) => ({
      ...current,
      templateId,
      categoryId: categoryId || current.categoryId
    }));
  }

  async function runAction(action, successMessage, dialogueCategory = null) {
    clearMessages();
    try {
      const result = await action();
      setMessage(successMessage);
      if (dialogueCategory) {
        onDialogue?.(dialogueCategory, result || {});
      }
      return result;
    } catch (actionError) {
      console.error('[ProjectUiActionError]', actionError);
      setError(actionError.message || '操作に失敗しました。');
      return null;
    }
  }

  async function ensureQuickCategory(template) {
    if (quickPlanForm.categoryId) {
      return quickPlanForm.categoryId;
    }
    const matchedCategoryId = findTemplateCategoryId(template, projectState.categories);
    if (matchedCategoryId) {
      return matchedCategoryId;
    }
    const fallbackName = template.categoryHints?.[0] || 'その他';
    const createdCategory = await projectState.createCategory({
      name: fallbackName,
      description: 'かんたん作成で自動追加されたジャンル'
    });
    return createdCategory.id;
  }

  async function submitQuickPlan(event) {
    event.preventDefault();
    clearMessages();
    let draft;
    try {
      draft = buildQuickPlanDraft(quickPlanForm);
    } catch (quickPlanError) {
      setError(quickPlanError.message || 'かんたん作成の入力を確認してください。');
      return;
    }
    const result = await runAction(
      async () => {
        const categoryId = await ensureQuickCategory(draft.template);
        const project = await projectState.createProject({
          name: draft.title,
          categoryId,
          description: draft.description,
          startDate: draft.startDate,
          deadline: draft.deadline,
          priority: draft.priority,
          estimatedTotalMinutes: draft.estimatedTotalMinutes
        });

        const createdTaskIdsByToken = new Map();
        for (const stage of draft.stages) {
          const milestone = await projectState.createMilestone({
            projectId: project.id,
            title: stage.title,
            description: stage.description,
            deadline: stage.deadline,
            status: stage.status,
            order: stage.order
          });
          for (const task of stage.tasks) {
            const dependencyTaskIds =
              task.dependencyToken && createdTaskIdsByToken.has(task.dependencyToken)
                ? [createdTaskIdsByToken.get(task.dependencyToken)]
                : [];
            const createdTask = await projectState.createProjectTask({
              projectId: project.id,
              milestoneId: milestone.id,
              title: task.title,
              description: task.description,
              startDate: task.startDate,
              deadline: task.deadline,
              scheduledDate: task.scheduledDate,
              estimatedMinutes: task.estimatedMinutes,
              importance: task.importance,
              difficulty: task.difficulty,
              progress: task.progress,
              status: task.status,
              dependencyTaskIds
            });
            createdTaskIdsByToken.set(task.token, createdTask.id);
          }
        }
        return project;
      },
      `「${draft.title}」を仮作成しました。段階とTodoは下の編集ドックで直せます。`,
      'project_created'
    );

    if (result) {
      setSelectedProjectId(result.id);
      setEditorPanel('task');
      setQuickPlanForm((current) => ({
        ...current,
        title: '',
        deadline: '',
        notes: ''
      }));
    }
  }

  async function submitCategory(event) {
    event.preventDefault();
    const input = { ...categoryForm };
    const result = await runAction(
      () =>
        editingCategoryId
          ? projectState.updateCategory(editingCategoryId, input)
          : projectState.createCategory(input),
      editingCategoryId ? 'ジャンルを更新しました。' : 'ジャンルを作成しました。'
    );
    if (result) {
      setCategoryForm(EMPTY_CATEGORY_FORM);
      setEditingCategoryId(null);
    }
  }

  async function deleteCategory(category) {
    if (!window.confirm(`ジャンル「${category.name}」を削除しますか？所属タスクは未分類になります。`)) {
      return;
    }
    await runAction(() => projectState.deleteCategory(category.id), 'ジャンルを削除しました。');
  }

  async function submitProject(event) {
    event.preventDefault();
    const input = {
      ...projectForm,
      estimatedTotalMinutes: Number(projectForm.estimatedTotalMinutes)
    };
    const result = await runAction(
      () =>
        editingProjectId
          ? projectState.updateProject(editingProjectId, input)
          : projectState.createProject(input),
      editingProjectId ? 'タスクを更新しました。' : 'タスクを作成しました。',
      editingProjectId ? 'project_updated' : 'project_created'
    );
    if (result) {
      setSelectedProjectId(result.id);
      setProjectForm({ ...EMPTY_PROJECT_FORM, categoryId: selectedCategoryId !== 'all' ? selectedCategoryId : '' });
      setEditingProjectId(null);
    }
  }

  function startEditProject(project) {
    setEditorPanel('project');
    setEditingProjectId(project.id);
    setProjectForm({
      name: project.name,
      categoryId: project.categoryId || '',
      description: project.description || '',
      startDate: project.startDate || getLocalDateKey(),
      deadline: project.deadline || '',
      priority: project.priority || 'medium',
      estimatedTotalMinutes: project.estimatedTotalMinutes || 0
    });
    scrollEditorIntoView();
  }

  async function updateProjectStatus(project, status) {
    const successMessage =
      status === 'completed'
        ? 'タスクを完了しました。'
        : status === 'paused'
          ? 'タスクを一時停止しました。'
          : 'タスクの状態を更新しました。';
    const dialogueCategory = status === 'completed' ? 'project_completed' : 'project_updated';
    const result = await runAction(
      () => projectState.updateProject(project.id, { status }),
      successMessage,
      dialogueCategory
    );
    if (!result) {
      return;
    }
    if (status === 'completed') {
      setStatusFilter((current) => (current === 'completed' ? current : 'active'));
      selectNextVisibleProject(project.id);
      clearProjectEditing(project.id);
    }
  }

  async function deleteProject(project) {
    const answer = window.prompt(
      `タスク「${project.name}」を削除します。\n中のTodoも削除: deleteAll\nTodoを未分類として残す: keepTasks\nキャンセル: cancel`,
      'cancel'
    );
    if (!answer || answer === 'cancel') {
      return;
    }
    if (!['deleteAll', 'keepTasks'].includes(answer)) {
      setError('削除方法は deleteAll / keepTasks / cancel のいずれかを入力してください。');
      return;
    }
    const result = await runAction(
      () => projectState.deleteProject(project.id, answer),
      'タスクを削除しました。',
      'project_deleted'
    );
    if (result) {
      selectNextVisibleProject(project.id);
      clearProjectEditing(project.id);
    }
  }

  async function submitMilestone(event) {
    event.preventDefault();
    if (!selectedSummary) {
      setError('先にタスクを選択してください。');
      return;
    }
    const input = {
      ...milestoneForm,
      projectId: selectedSummary.project.id,
      order: Number(milestoneForm.order)
    };
    const result = await runAction(
      () =>
        editingMilestoneId
          ? projectState.updateMilestone(editingMilestoneId, input)
          : projectState.createMilestone(input),
      editingMilestoneId ? '段階を更新しました。' : '段階を作成しました。',
      input.status === 'completed' ? 'milestone_completed' : null
    );
    if (result) {
      setMilestoneForm(EMPTY_MILESTONE_FORM);
      setEditingMilestoneId(null);
    }
  }

  async function deleteMilestone(milestone) {
    if (!window.confirm(`段階「${milestone.title}」を削除しますか？Todoはタスク直下に残ります。`)) {
      return;
    }
    await runAction(
      () => projectState.deleteMilestone(milestone.id),
      '段階を削除しました。'
    );
  }

  async function submitTask(event) {
    event.preventDefault();
    const input = {
      ...taskForm,
      projectId: taskForm.projectId || selectedSummary?.project.id || '',
      milestoneId: taskForm.milestoneId || null,
      startDate: taskForm.startDate || null,
      scheduledDate: taskForm.scheduledDate || null,
      time: taskForm.time || null,
      estimatedMinutes: Number(taskForm.estimatedMinutes),
      importance: Number(taskForm.importance),
      difficulty: Number(taskForm.difficulty),
      progress: Number(taskForm.progress),
      dependencyTaskIds: taskForm.dependencyTaskIds || []
    };
    const result = await runAction(
      () =>
        editingTaskId
          ? projectState.updateProjectTask(editingTaskId, input)
          : projectState.createProjectTask(input),
      editingTaskId ? 'Todoを更新しました。' : 'Todoを作成しました。',
      editingTaskId ? 'project_task_updated' : 'project_task_created'
    );
    if (result) {
      setTaskForm({
        ...EMPTY_TASK_FORM,
        projectId: input.projectId,
        estimatedMinutes: pSettings.defaultSessionMinutes || 45
      });
      setEditingTaskId(null);
    }
  }

  function startEditTask(task) {
    setEditorPanel('task');
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      projectId: task.projectId || selectedSummary?.project.id || '',
      milestoneId: task.milestoneId || '',
      startDate: task.startDate || '',
      deadline: task.deadline || '',
      time: task.time || '',
      scheduledDate: task.scheduledDate || '',
      estimatedMinutes: task.estimatedMinutes || pSettings.defaultSessionMinutes || 45,
      importance: task.importance || 3,
      difficulty: task.difficulty || 3,
      progress: task.progress || 0,
      status: task.status || 'not_started',
      dependencyTaskIds: task.dependencyTaskIds || []
    });
    scrollEditorIntoView();
  }

  async function deleteTask(task) {
    if (!window.confirm(`Todo「${task.title}」を削除しますか？`)) {
      return;
    }
    await runAction(() => projectState.deleteProjectTask(task.id), 'Todoを削除しました。');
  }

  async function completeTask(task, completed = true) {
    const result = await runAction(
      () => projectState.completeProjectTask(task.id, completed),
      completed ? 'Todoを完了しました。' : 'Todoを未完了に戻しました。',
      completed ? 'project_task_completed' : 'project_task_updated'
    );
    if (result && completed && editingTaskId === task.id) {
      setEditingTaskId(null);
      setTaskForm({
        ...EMPTY_TASK_FORM,
        projectId: task.projectId || selectedSummary?.project.id || '',
        estimatedMinutes: pSettings.defaultSessionMinutes || 45
      });
    }
  }

  function startSplitTask(task) {
    setEditorPanel('task');
    setEditingTaskId(null);
    setTaskForm({
      ...EMPTY_TASK_FORM,
      title: `${task.title} - 分割Todo`,
      description: task.description,
      projectId: task.projectId || selectedSummary?.project.id || '',
      milestoneId: task.milestoneId || '',
      startDate: today,
      deadline: task.deadline || '',
      time: task.time || '',
      scheduledDate: today,
      estimatedMinutes: Math.min(60, task.estimatedMinutes || 60),
      importance: task.importance || 3,
      difficulty: task.difficulty || 3,
      dependencyTaskIds: task.dependencyTaskIds || []
    });
    scrollEditorIntoView();
  }

  const selectedTasks = selectedSummary?.tasks || [];
  const filteredTasks = selectedTasks.filter((task) => {
    if (taskFilter === 'active') {
      return task.status !== 'completed';
    }
    if (taskFilter === 'all') {
      return true;
    }
    if (taskFilter === 'overdue') {
      return deadlineStatus(task.deadline, today).state === 'overdue';
    }
    return task.status === taskFilter;
  });

  const taskOptions = selectedTasks.filter((task) => task.id !== editingTaskId);
  const selectedRisk = selectedSummary
    ? analyzeProjectRisk(selectedSummary.project, projectState.projectTasks, pSettings, today)
    : null;
  const selectedTaskProgress = selectedSummary ? milestoneProgress(selectedTasks) : 0;
  const todoItems = useMemo(() => {
    if (!selectedSummary) {
      return [];
    }
    const milestonesById = new Map(
      selectedSummary.milestones.map((milestone) => [milestone.id, milestone])
    );
    return sortTasksByDeadline(filteredTasks).map((task) => ({
      task,
      milestone: milestonesById.get(task.milestoneId) || null
    }));
  }, [filteredTasks, selectedSummary]);

  if (projectState.loading) {
    return (
      <section className="project-mode project-mode--loading" data-interactive="true">
        タスク階層を読み込んでいます...
      </section>
    );
  }

  const activeSummaries = summaries.filter((summary) => summary.project.status !== 'completed');
  const incompleteTodoCount = projectState.projectTasks.filter(
    (task) => task.status !== 'completed'
  ).length;
  const overdueTodoCount = projectState.projectTasks.filter(
    (task) => task.status !== 'completed' && deadlineStatus(task.deadline, today).state === 'overdue'
  ).length;
  const averageProgress =
    summaries.length === 0
      ? 0
      : Math.round(
          summaries.reduce((total, summary) => total + (summary.project.progress || 0), 0) /
            summaries.length
        );
  const compactSummaries = [...activeSummaries]
    .sort((left, right) => {
      const riskOrder = { delayed: 0, danger: 1, warning: 2, safe: 3 };
      const riskCompare =
        (riskOrder[left.risk?.level] ?? 9) - (riskOrder[right.risk?.level] ?? 9);
      if (riskCompare !== 0) {
        return riskCompare;
      }
      return (left.project.deadline || '9999-12-31').localeCompare(
        right.project.deadline || '9999-12-31'
      );
    })
    .slice(0, 4);
  const alertSummaries = activeSummaries
    .filter((summary) => ['overdue', 'urgent', 'warning', 'watch'].includes(summary.deadline.state))
    .slice(0, 3);
  const blockedTodoCount = projectState.projectTasks.filter(
    (task) => task.status !== 'completed' && taskBlocked(task, projectState.projectTasks).length > 0
  ).length;
  const selectedBlockedCount = selectedTasks.filter(
    (task) => task.status !== 'completed' && taskBlocked(task, projectState.projectTasks).length > 0
  ).length;
  const riskCounts = summaries.reduce(
    (counts, summary) => ({
      ...counts,
      [summary.risk.level]: (counts[summary.risk.level] || 0) + 1
    }),
    { safe: 0, warning: 0, danger: 0, delayed: 0 }
  );
  const selectedMilestoneTracks = selectedSummary
    ? [
        ...sortMilestones(selectedSummary.milestones).map((milestone) => ({
          id: milestone.id,
          title: milestone.title,
          description: milestone.description,
          deadline: milestone.deadline,
          status: milestone.status || 'not_started',
          tasks: sortTasksByDeadline(
            selectedTasks.filter((task) => task.milestoneId === milestone.id)
          )
        })),
        {
          id: 'direct-tasks',
          title: 'タスク直下',
          description: '段階に属さないTodo',
          deadline: selectedSummary.project.deadline,
          status: 'in_progress',
          tasks: sortTasksByDeadline(selectedTasks.filter((task) => !task.milestoneId))
        }
      ].filter((track) => track.tasks.length > 0 || track.id !== 'direct-tasks' || selectedSummary.milestones.length === 0)
    : [];
  const dependencyItems = todoItems.map(({ task, milestone }) => ({
    task,
    milestone,
    deadline: deadlineStatus(task.deadline, today, pSettings.deadlineWarningDays),
    blockers: taskBlocked(task, projectState.projectTasks),
    dependents: taskDependents(task, projectState.projectTasks)
  }));
  const selectedHealthLevel =
    selectedRisk?.level === 'delayed'
      ? 'delayed'
      : selectedRisk?.level === 'danger'
        ? 'danger'
        : selectedRisk?.level === 'warning' || selectedBlockedCount > 0
          ? 'warning'
          : 'safe';

  function handleCompactCollapsedKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    setCompactCollapsed(false);
  }

  function rememberCompactFrameHeight() {
    const height = Math.ceil(compactPanelRef.current?.getBoundingClientRect().height || 0);
    if (Number.isFinite(height) && height > 0) {
      setCompactFrameHeight(height);
    }
  }

  function collapseCompactPanel() {
    rememberCompactFrameHeight();
    setCompactCollapsed(true);
  }

  function handleCompactPointerDown(event) {
    if (event.button !== 0) {
      compactPointerStartRef.current = null;
      return;
    }
    compactPointerStartRef.current = {
      x: event.clientX,
      y: event.clientY
    };
  }

  function handleCompactPanelClick(event) {
    if (event.target.closest(COMPACT_COLLAPSE_IGNORE_SELECTOR)) {
      return;
    }
    const start = compactPointerStartRef.current;
    compactPointerStartRef.current = null;
    if (
      start &&
      (Math.abs(event.clientX - start.x) > 6 || Math.abs(event.clientY - start.y) > 6)
    ) {
      return;
    }
    collapseCompactPanel();
  }

  if (compact) {
    const compactShellStyle = compactFrameHeight
      ? { '--compact-reserved-height': `${compactFrameHeight}px` }
      : undefined;

    if (compactCollapsed) {
      return (
        <div
          className="project-compact-shell project-compact-shell--collapsed"
          style={compactShellStyle}
        >
          <section
            className="project-mode project-mode--compact project-mode--compact-collapsed"
            data-interactive="true"
            role="button"
            tabIndex={0}
            aria-expanded="false"
            aria-label="長期プロジェクト進捗を開く"
            onClick={() => setCompactCollapsed(false)}
            onKeyDown={handleCompactCollapsedKeyDown}
          >
            <div className="project-compact-collapsed__title">
              <span>PROJECT PROGRESS</span>
              <strong>長期プロジェクト進捗</strong>
              <small>クリックで開く</small>
            </div>
            <div className="project-compact-collapsed__stats" aria-hidden="true">
              <b>{averageProgress}%</b>
              <span>進行中 {activeSummaries.length}件</span>
              <span>Todo {incompleteTodoCount}件</span>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="project-compact-shell" style={compactShellStyle}>
      <section
        ref={compactPanelRef}
        className="project-mode project-mode--compact"
        data-interactive="true"
        aria-expanded="true"
        aria-label="長期プロジェクト進捗サマリー"
        onPointerDown={handleCompactPointerDown}
        onClick={handleCompactPanelClick}
      >
        <header className="project-mode__header project-mode__header--compact">
          <button
            type="button"
            className="project-compact-title-button"
            onClick={collapseCompactPanel}
            aria-label="長期プロジェクト進捗を折り畳む"
          >
            <span>PROJECT PROGRESS</span>
            <h2>長期プロジェクト進捗</h2>
            <small>クリックで折り畳む</small>
          </button>
          <div className="project-mode__header-actions">
            <button type="button" onClick={collapseCompactPanel}>
              折り畳む
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                window.taskMate.openSettings();
              }}
            >
              レビューを開く
            </button>
          </div>
        </header>

        {projectState.error && (
          <div className="project-message project-message--error">{projectState.error}</div>
        )}

        <div className="project-progress-hero">
          <div
            className="project-progress-ring"
            style={{ '--progress': `${averageProgress * 3.6}deg` }}
            aria-label={`全体進捗 ${averageProgress}%`}
          >
            <strong>{averageProgress}%</strong>
            <span>全体</span>
          </div>
          <div className="project-progress-stats">
            <span>進行中 {activeSummaries.length}件</span>
            <span>未完了Todo {incompleteTodoCount}件</span>
            <span className={overdueTodoCount > 0 ? 'is-danger' : ''}>
              期限超過 {overdueTodoCount}件
            </span>
          </div>
        </div>

        <section className="project-compact-section">
          <div className="project-compact-section__heading">
            <h3>進捗ボード</h3>
            <small>詳細編集は設定画面の「長期プロジェクトレビュー」で行います。</small>
          </div>
          <div className="project-progress-list">
            {compactSummaries.map((summary) => (
              <article key={summary.project.id} className={`project-progress-card project-progress-card--${summary.risk.level}`}>
                <div className="project-progress-card__top">
                  <div>
                    <span>{summary.category?.name || '未分類'}</span>
                    <strong>{summary.project.name}</strong>
                  </div>
                  <b>{summary.project.progress}%</b>
                </div>
                <div className="project-progress-bar" aria-hidden="true">
                  <span style={{ width: `${summary.project.progress}%` }} />
                </div>
                <div className="project-progress-card__meta">
                  <span>{remainingDaysLabel(summary.deadline)}</span>
                  <span>未完了 {summary.incompleteTasks.length}</span>
                  <span>{summary.risk.label}</span>
                </div>
              </article>
            ))}
            {compactSummaries.length === 0 && (
              <p className="project-hierarchy__empty">長期プロジェクトはまだありません。</p>
            )}
          </div>
        </section>

        <section className="project-compact-section">
          <div className="project-compact-section__heading">
            <h3>今日見るTodo</h3>
          </div>
          <div className="project-compact-todos">
            {recommendations.slice(0, 3).map((task, index) => (
              <article key={task.id}>
                <span>{index + 1}</span>
                <div>
                  <strong>{task.title}</strong>
                  <small>{task.project.name} / {formatMinutes(task.estimatedMinutes)}</small>
                </div>
              </article>
            ))}
            {recommendations.length === 0 && (
              <p className="project-hierarchy__empty">今すぐおすすめするTodoはありません。</p>
            )}
          </div>
        </section>

        {alertSummaries.length > 0 && (
          <section className="project-compact-section">
            <div className="project-compact-section__heading">
              <h3>注意</h3>
            </div>
            <div className="project-compact-alerts">
              {alertSummaries.map((summary) => (
                <article key={summary.project.id}>
                  <strong>{summary.project.name}</strong>
                  <span>{summary.deadline.label} / {remainingDaysLabel(summary.deadline)}</span>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
      </div>
    );
  }

  return (
    <section
      className="project-mode project-mode--review"
      data-interactive="true"
      aria-label="長期タスク管理モード"
    >
      <header className="project-mode__header project-mode__header--review">
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
          <p>ジャンル、タスク、段階、Todoのつながりを上から順に確認できます。</p>
        </div>
        <div className="project-mode__filters">
          <label>
            ジャンル
            <select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)}>
              <option value="all">すべて</option>
              {projectState.categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label>
            状態
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="active">完了以外</option>
              <option value="all">すべて</option>
              <option value="not_started">未着手</option>
              <option value="in_progress">進行中</option>
              <option value="paused">一時停止</option>
              <option value="completed">完了</option>
            </select>
          </label>
          <label>
            並び替え
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
              <option value="deadline">期限順</option>
              <option value="priority">優先度順</option>
              <option value="progress">進捗順</option>
            </select>
          </label>
        </div>
      </header>

      {(message || error) && (
        <div className={`project-message${error ? ' project-message--error' : ''}`}>
          {error || message}
        </div>
      )}

      <section className="project-panel project-quick-start" aria-label="かんたん作成">
        <div className="project-panel__heading">
          <div>
            <h3>かんたん作成</h3>
            <small>目的と期限だけ入れると、段階とTodoを仮作成します。</small>
          </div>
          <button type="button" onClick={() => {
            setEditorPanel('project');
            scrollEditorIntoView();
          }}>
            手入力で作る
          </button>
        </div>

        <div className="project-template-grid" role="list" aria-label="テンプレート">
          {QUICK_PLAN_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className={quickPlanForm.templateId === template.id ? 'is-selected' : ''}
              onClick={() => selectQuickTemplate(template.id)}
            >
              <strong>{template.name}</strong>
              <span>{template.description}</span>
            </button>
          ))}
        </div>

        <form className="project-quick-form" onSubmit={submitQuickPlan}>
          <label>
            タスク名
            <input
              value={quickPlanForm.title}
              onChange={(event) => setQuickPlanField('title', event.target.value)}
              placeholder={selectedQuickTemplate.defaultTitle}
            />
          </label>
          <label>
            ジャンル
            <select
              value={quickPlanForm.categoryId}
              onChange={(event) => setQuickPlanField('categoryId', event.target.value)}
            >
              <option value="">自動で選ぶ</option>
              {projectState.categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label>
            開始日
            <input
              type="date"
              value={quickPlanForm.startDate}
              onChange={(event) => setQuickPlanField('startDate', event.target.value)}
              onInput={(event) => setQuickPlanField('startDate', event.currentTarget.value)}
            />
          </label>
          <label>
            最終期限
            <input
              type="date"
              value={quickPlanForm.deadline}
              onChange={(event) => setQuickPlanField('deadline', event.target.value)}
              onInput={(event) => setQuickPlanField('deadline', event.currentTarget.value)}
              required
            />
          </label>
          <label>
            大変さ
            <select
              value={quickPlanForm.workload}
              onChange={(event) => setQuickPlanField('workload', event.target.value)}
            >
              {Object.entries(QUICK_WORKLOADS).map(([id, workload]) => (
                <option key={id} value={id}>{workload.label}</option>
              ))}
            </select>
          </label>
          <label className="project-quick-form__wide">
            メモ
            <textarea
              rows="2"
              value={quickPlanForm.notes}
              onChange={(event) => setQuickPlanField('notes', event.target.value)}
              placeholder="範囲、条件、気になることなど。空でも作れます。"
            />
          </label>
          <label className="project-quick-toggle">
            <input
              type="checkbox"
              checked={quickPlanForm.linkDependencies}
              onChange={(event) => setQuickPlanField('linkDependencies', event.target.checked)}
            />
            <span>Todoを前提関係でつなぐ</span>
          </label>

          <div className="project-quick-preview" aria-label="作成プレビュー">
            <strong>{quickPlanPreview.template.name}</strong>
            <span>{quickPlanPreview.stageCount}段階 / {quickPlanPreview.taskCount}Todo / 約{formatMinutes(quickPlanPreview.totalMinutes)}</span>
            <div>
              {quickPlanPreview.stageTitles.map((stageTitle) => (
                <em key={stageTitle}>{stageTitle}</em>
              ))}
            </div>
          </div>

          <div className="project-form-grid__actions project-quick-form__actions">
            <button type="submit">この内容で仮作成</button>
          </div>
        </form>
      </section>

      <section className="project-review-overview" aria-label="全体状況">
        <article className="project-kpi project-kpi--blue">
          <span>進行中プロジェクト</span>
          <strong>{activeSummaries.length}</strong>
          <small>完了以外の長期タスク</small>
        </article>
        <article className="project-kpi project-kpi--green">
          <span>全体進捗</span>
          <strong>{averageProgress}%</strong>
          <small>登録済みプロジェクト平均</small>
        </article>
        <article className={`project-kpi ${overdueTodoCount > 0 ? 'project-kpi--red' : 'project-kpi--green'}`}>
          <span>期限超過Todo</span>
          <strong>{overdueTodoCount}</strong>
          <small>先に確認したい作業</small>
        </article>
        <article className={`project-kpi ${blockedTodoCount > 0 ? 'project-kpi--amber' : 'project-kpi--green'}`}>
          <span>前提待ちTodo</span>
          <strong>{blockedTodoCount}</strong>
          <small>依存関係で止まっている作業</small>
        </article>
        <article className="project-kpi project-kpi--slate">
          <span>リスク内訳</span>
          <strong>{riskCounts.delayed + riskCounts.danger}</strong>
          <small>遅延 {riskCounts.delayed} / 危険 {riskCounts.danger} / 注意 {riskCounts.warning}</small>
        </article>
      </section>

      <div className="project-layout project-layout--review">
        <aside className="project-sidebar project-sidebar--map">
          <section className="project-panel project-map-panel">
            <div className="project-panel__heading">
              <div>
                <h3>プロジェクトマップ</h3>
                <small>ジャンルごとに進捗とリスクを確認</small>
              </div>
              <button type="button" onClick={() => setSelectedCategoryId('all')}>全体</button>
            </div>

            <div className="project-list project-tree project-map-list">
              {projectGroups.map((group) => (
                <section key={group.id} className="project-tree__category">
                  <header>
                    <span>ジャンル</span>
                    <strong>{group.name}</strong>
                  </header>
                  <div className="project-tree__projects">
                    {group.summaries.map((summary) => (
                      <button
                        key={summary.project.id}
                        type="button"
                        className={`project-map-card project-map-card--${summary.risk.level}${
                          selectedSummary?.project.id === summary.project.id ? ' is-selected' : ''
                        }`}
                        onClick={() => setSelectedProjectId(summary.project.id)}
                      >
                        <span className="project-map-card__risk">{summary.risk.label}</span>
                        <strong>{summary.project.name}</strong>
                        <span>{remainingDaysLabel(summary.deadline)} / Todo {summary.incompleteTasks.length}</span>
                        <meter min="0" max="100" value={summary.project.progress}>
                          {summary.project.progress}%
                        </meter>
                      </button>
                    ))}
                    {group.summaries.length === 0 && <p>このジャンルのタスクはありません。</p>}
                  </div>
                </section>
              ))}
              {filteredSummaries.length === 0 && <p>表示するタスクはありません。</p>}
            </div>
          </section>

          <details className="project-panel project-management-drawer">
            <summary>ジャンルを登録/編集</summary>
            <form className="project-mini-form" onSubmit={submitCategory}>
              <input
                type="text"
                value={categoryForm.name}
                onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="ジャンル名"
                required
              />
              <input
                type="text"
                value={categoryForm.description}
                onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="説明"
              />
              <button type="submit">{editingCategoryId ? 'ジャンルを保存' : 'ジャンルを追加'}</button>
            </form>
            <div className="project-category-list">
              {projectState.categories.map((category) => (
                <article key={category.id} className={selectedCategoryId === category.id ? 'is-selected' : ''}>
                  <button type="button" onClick={() => setSelectedCategoryId(category.id)}>
                    <strong>{category.name}</strong>
                    <small>{category.description || '説明なし'}</small>
                  </button>
                  <div>
                    <button type="button" onClick={() => {
                      setEditingCategoryId(category.id);
                      setCategoryForm({ name: category.name, description: category.description || '' });
                    }}>編集</button>
                    <button type="button" onClick={() => deleteCategory(category)}>削除</button>
                  </div>
                </article>
              ))}
            </div>
          </details>
        </aside>

        <main className="project-main project-main--review">
          {selectedSummary ? (
            <>
              <section className={`project-panel project-detail project-detail--review project-detail--${selectedHealthLevel}`}>
                <div className="project-detail__title">
                  <div>
                    <span>{selectedSummary.category?.name || '未分類'}</span>
                    <h3>{selectedSummary.project.name}</h3>
                    <p>{selectedSummary.project.description || '説明はありません。'}</p>
                  </div>
                  <div className="project-actions">
                    <button type="button" onClick={() => startEditProject(selectedSummary.project)}>編集</button>
                    <button
                      type="button"
                      onClick={() => updateProjectStatus(selectedSummary.project, 'paused')}
                    >
                      一時停止
                    </button>
                    <button
                      type="button"
                      onClick={() => updateProjectStatus(selectedSummary.project, 'completed')}
                    >
                      完了
                    </button>
                    <button type="button" className="danger" onClick={() => deleteProject(selectedSummary.project)}>削除</button>
                  </div>
                </div>

                <div className="project-detail-dashboard">
                  <div
                    className="project-progress-ring project-progress-ring--large"
                    style={{ '--progress': `${selectedSummary.project.progress * 3.6}deg` }}
                  >
                    <strong>{selectedSummary.project.progress}%</strong>
                    <span>進捗</span>
                  </div>
                  <div className="project-metrics project-metrics--dashboard">
                    <span>状態: {PROJECT_STATUS_LABELS[selectedSummary.project.status]}</span>
                    <span>優先度: {PROJECT_PRIORITY_LABELS[selectedSummary.project.priority]}</span>
                    <span>{remainingDaysLabel(selectedSummary.deadline)}</span>
                    <span>未完了Todo: {selectedSummary.incompleteTasks.length}件</span>
                    <span>期限超過Todo: {selectedSummary.overdueTasks.length}件</span>
                    <span>前提待ちTodo: {selectedBlockedCount}件</span>
                  </div>
                </div>

                {selectedRisk && (
                  <div className={`project-risk project-risk--${selectedRisk.level}`}>
                    <strong>{selectedRisk.label}</strong>
                    <span>{selectedRisk.message}</span>
                    <small>残り作業: {formatMinutes(selectedRisk.remainingMinutes)} / 1日あたり目安: {formatMinutes(selectedRisk.requiredPerDay)}</small>
                  </div>
                )}
              </section>

              <section className="project-panel project-flow-panel">
                <div className="project-panel__heading">
                  <div>
                    <h3>構造フロー</h3>
                    <small>ジャンル → タスク → 段階 → Todo の流れ</small>
                  </div>
                </div>

                <div className="project-flow">
                  <article>
                    <span>ジャンル</span>
                    <strong>{selectedSummary.category?.name || '未分類'}</strong>
                  </article>
                  <b aria-hidden="true">→</b>
                  <article>
                    <span>タスク</span>
                    <strong>{selectedSummary.project.name}</strong>
                  </article>
                  <b aria-hidden="true">→</b>
                  <article>
                    <span>段階</span>
                    <strong>{selectedSummary.milestones.length}件</strong>
                  </article>
                  <b aria-hidden="true">→</b>
                  <article>
                    <span>Todo</span>
                    <strong>{selectedTasks.length}件</strong>
                  </article>
                </div>

                <div className="project-stage-lanes">
                  {selectedMilestoneTracks.map((track, index) => (
                    <article key={track.id} className={`project-stage-lane project-stage-lane--${track.status}`}>
                      <header>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <div>
                          <strong>{track.title}</strong>
                          <small>{track.deadline || '期限未設定'} / {PROJECT_TASK_STATUS_LABELS[track.status] || '進行中'}</small>
                        </div>
                      </header>
                      {track.description && <p>{track.description}</p>}
                      <div className="project-stage-lane__todos">
                        {track.tasks.slice(0, 5).map((task) => (
                          <span key={task.id} className={`project-stage-chip project-stage-chip--${task.status}`}>
                            {task.title}
                          </span>
                        ))}
                        {track.tasks.length > 5 && <em>+{track.tasks.length - 5}件</em>}
                        {track.tasks.length === 0 && <em>Todoなし</em>}
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="project-panel project-dependency-panel">
                <div className="project-panel__heading">
                  <div>
                    <h3>Todo依存関係</h3>
                    <small>前提Todoが残っている作業を色で確認</small>
                  </div>
                  <label className="project-inline-filter">表示
                    <select value={taskFilter} onChange={(event) => setTaskFilter(event.target.value)}>
                      <option value="active">未完了</option>
                      <option value="all">すべて</option>
                      <option value="not_started">未着手</option>
                      <option value="in_progress">進行中</option>
                      <option value="completed">完了</option>
                      <option value="overdue">期限超過</option>
                    </select>
                  </label>
                </div>

                <div className="project-hierarchy__todo-summary">
                  <span>表示Todo: {dependencyItems.length}件</span>
                  <span>全Todo: {selectedTasks.length}件</span>
                  <span>進捗 {selectedTaskProgress}%</span>
                  <span>前提待ち {selectedBlockedCount}件</span>
                </div>

                <div className="project-dependency-board">
                  {dependencyItems.map(({ task, milestone, deadline, blockers, dependents }) => (
                    <article
                      key={task.id}
                      className={`project-dependency-card project-dependency-card--${deadline.state}${
                        blockers.length > 0 ? ' is-blocked' : ''
                      }`}
                    >
                      <header>
                        <div>
                          <span className={`project-status-dot project-status-dot--${task.status}`} />
                          <strong>{task.title}</strong>
                        </div>
                        <b>{task.progress}%</b>
                      </header>
                      <div className="project-dependency-path">
                        <div className={blockers.length > 0 ? 'is-blocking' : ''}>
                          <span>前提</span>
                          {blockers.length > 0 ? (
                            blockers.slice(0, 2).map((blocker) => <strong key={blocker.id}>{blocker.title}</strong>)
                          ) : (
                            <em>なし</em>
                          )}
                        </div>
                        <i aria-hidden="true">→</i>
                        <div className="is-current">
                          <span>現在</span>
                          <strong>{PROJECT_TASK_STATUS_LABELS[task.status]}</strong>
                        </div>
                        <i aria-hidden="true">→</i>
                        <div>
                          <span>後続</span>
                          {dependents.length > 0 ? (
                            dependents.slice(0, 2).map((dependent) => <strong key={dependent.id}>{dependent.title}</strong>)
                          ) : (
                            <em>なし</em>
                          )}
                        </div>
                      </div>
                      <div className="project-task-card__meta">
                        <span>{remainingDaysLabel(deadline)}</span>
                        {task.time && <span>{task.time}</span>}
                        <span>{formatMinutes(task.estimatedMinutes)}</span>
                        <span>重要度 {task.importance}</span>
                        <span>難易度 {task.difficulty}</span>
                        {milestone && <span>段階: {milestone.title}</span>}
                      </div>
                      {task.description && <p>{task.description}</p>}
                      {task.estimatedMinutes > 60 && (
                        <p className="project-split-note">
                          このTodoは{task.estimatedMinutes}分必要です。小さく分けると今日の作業に載せやすくなります。
                        </p>
                      )}
                      <div className="project-task-card__actions">
                        <button type="button" onClick={() => startEditTask(task)}>編集</button>
                        <button type="button" onClick={() => completeTask(task, task.status !== 'completed')}>
                          {task.status === 'completed' ? '未完了へ戻す' : '完了'}
                        </button>
                        {task.estimatedMinutes > 60 && (
                          <button type="button" onClick={() => startSplitTask(task)}>細かいTodoに分ける</button>
                        )}
                        <button type="button" className="danger" onClick={() => deleteTask(task)}>削除</button>
                      </div>
                    </article>
                  ))}
                  {dependencyItems.length === 0 && (
                    <p className="project-hierarchy__empty">このタスクに表示できるTodoはありません。</p>
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="project-panel project-empty-review">
              <h3>表示するタスクはありません。</h3>
              <p>下の登録ドックから長期タスクを追加できます。</p>
            </section>
          )}

          <section className="project-panel project-editor" ref={editorPanelRef}>
            <div className="project-panel__heading">
              <div>
                <h3>登録/編集ドック</h3>
                <small>詳細な入力はここにまとめています。</small>
              </div>
            </div>
            <div className="project-editor-tabs" role="tablist" aria-label="登録/編集対象">
              <button type="button" className={editorPanel === 'project' ? 'is-active' : ''} onClick={() => setEditorPanel('project')}>
                タスク
              </button>
              <button type="button" className={editorPanel === 'milestone' ? 'is-active' : ''} onClick={() => setEditorPanel('milestone')} disabled={!selectedSummary}>
                段階
              </button>
              <button type="button" className={editorPanel === 'task' ? 'is-active' : ''} onClick={() => setEditorPanel('task')} disabled={!selectedSummary}>
                Todo
              </button>
            </div>

            {editorPanel === 'project' && (
              <form className="project-form-grid" onSubmit={submitProject}>
                <label>タスク名<input value={projectForm.name} onChange={(event) => setProjectField('name', event.target.value)} required /></label>
                <label>ジャンル<select value={projectForm.categoryId} onChange={(event) => setProjectField('categoryId', event.target.value)} required>
                  <option value="">選択してください</option>
                  {projectState.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select></label>
                <label>開始日<input type="date" value={projectForm.startDate} onChange={(event) => setProjectField('startDate', event.target.value)} /></label>
                <label>最終期限<input type="date" value={projectForm.deadline} onChange={(event) => setProjectField('deadline', event.target.value)} required /></label>
                <label>優先度<select value={projectForm.priority} onChange={(event) => setProjectField('priority', event.target.value)}>
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="urgent">緊急</option>
                </select></label>
                <label>予想総作業時間<input type="number" min="0" value={projectForm.estimatedTotalMinutes} onChange={(event) => setProjectField('estimatedTotalMinutes', event.target.value)} /></label>
                <label className="project-form-grid__wide">説明<textarea rows="2" value={projectForm.description} onChange={(event) => setProjectField('description', event.target.value)} /></label>
                <div className="project-form-grid__actions">
                  <button type="submit">{editingProjectId ? 'タスクを保存' : 'タスクを追加'}</button>
                  {editingProjectId && (
                    <button type="button" onClick={() => {
                      setEditingProjectId(null);
                      setProjectForm(EMPTY_PROJECT_FORM);
                    }}>編集をキャンセル</button>
                  )}
                </div>
              </form>
            )}

            {editorPanel === 'milestone' && selectedSummary && (
              <>
                <form className="project-form-grid project-form-grid--compact" onSubmit={submitMilestone}>
                  <label>段階名<input value={milestoneForm.title} onChange={(event) => setMilestoneField('title', event.target.value)} required /></label>
                  <label>期限<input type="date" value={milestoneForm.deadline} onChange={(event) => setMilestoneField('deadline', event.target.value)} required /></label>
                  <label>状態<select value={milestoneForm.status} onChange={(event) => setMilestoneField('status', event.target.value)}>
                    <option value="not_started">未着手</option>
                    <option value="in_progress">進行中</option>
                    <option value="completed">完了</option>
                  </select></label>
                  <label>順序<input type="number" value={milestoneForm.order} onChange={(event) => setMilestoneField('order', event.target.value)} /></label>
                  <label className="project-form-grid__wide">説明<input value={milestoneForm.description} onChange={(event) => setMilestoneField('description', event.target.value)} /></label>
                  <div className="project-form-grid__actions"><button type="submit">{editingMilestoneId ? '保存' : '追加'}</button></div>
                </form>
                <div className="milestone-list">
                  {sortMilestones(selectedSummary.milestones).map((milestone) => (
                    <article key={milestone.id}>
                      <div><strong>{milestone.title}</strong><span>{milestone.deadline} / {PROJECT_TASK_STATUS_LABELS[milestone.status]}</span></div>
                      <div>
                        <button type="button" onClick={() => {
                          setEditorPanel('milestone');
                          setEditingMilestoneId(milestone.id);
                          setMilestoneForm({
                            title: milestone.title,
                            description: milestone.description || '',
                            deadline: milestone.deadline || '',
                            status: milestone.status || 'not_started',
                            order: milestone.order || 0
                          });
                        }}>編集</button>
                        <button type="button" onClick={() => deleteMilestone(milestone)}>削除</button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}

            {editorPanel === 'task' && selectedSummary && (
              <form className="project-form-grid" onSubmit={submitTask}>
                <label>Todo名<input value={taskForm.title} onChange={(event) => setTaskField('title', event.target.value)} required /></label>
                <label>所属タスク<select
                  value={taskForm.projectId || selectedSummary.project.id}
                  onChange={(event) => {
                    const nextProjectId = event.target.value;
                    setSelectedProjectId(nextProjectId);
                    setTaskForm((current) => ({
                      ...current,
                      projectId: nextProjectId,
                      milestoneId: ''
                    }));
                  }}
                  required
                >
                  {projectState.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select></label>
                <label>段階（任意）<select value={taskForm.milestoneId} onChange={(event) => setTaskField('milestoneId', event.target.value)}>
                  <option value="">なし</option>
                  {selectedSummary.milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}
                </select></label>
                <label>開始可能日<input type="date" value={taskForm.startDate} onChange={(event) => setTaskField('startDate', event.target.value)} /></label>
                <label>期限<input type="date" value={taskForm.deadline} onChange={(event) => setTaskField('deadline', event.target.value)} required /></label>
                <label>時刻<input type="time" value={taskForm.time} onChange={(event) => setTaskField('time', event.target.value)} /></label>
                <label>予定実施日<input type="date" value={taskForm.scheduledDate} onChange={(event) => setTaskField('scheduledDate', event.target.value)} /></label>
                <label>予想分<input type="number" min="1" value={taskForm.estimatedMinutes} onChange={(event) => setTaskField('estimatedMinutes', event.target.value)} /></label>
                <label>重要度<input type="number" min="1" max="5" value={taskForm.importance} onChange={(event) => setTaskField('importance', event.target.value)} /></label>
                <label>難易度<input type="number" min="1" max="5" value={taskForm.difficulty} onChange={(event) => setTaskField('difficulty', event.target.value)} /></label>
                <label>進捗<input type="number" min="0" max="100" value={taskForm.progress} onChange={(event) => setTaskField('progress', event.target.value)} /></label>
                <label>状態<select value={taskForm.status} onChange={(event) => setTaskField('status', event.target.value)}>
                  <option value="not_started">未着手</option>
                  <option value="in_progress">進行中</option>
                  <option value="completed">完了</option>
                </select></label>
                <label className="project-form-grid__wide">前提Todo<select multiple value={taskForm.dependencyTaskIds} onChange={(event) => setTaskField('dependencyTaskIds', [...event.target.selectedOptions].map((option) => option.value))}>
                  {taskOptions.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                </select><small>Ctrlキーで複数選択できます。</small></label>
                <label className="project-form-grid__wide">説明<textarea rows="2" value={taskForm.description} onChange={(event) => setTaskField('description', event.target.value)} /></label>
                <div className="project-form-grid__actions">
                  <button type="submit">{editingTaskId ? 'Todoを保存' : 'Todoを追加'}</button>
                  {editingTaskId && <button type="button" onClick={() => { setEditingTaskId(null); setTaskForm(EMPTY_TASK_FORM); }}>キャンセル</button>}
                </div>
              </form>
            )}
          </section>
        </main>

        <aside className="project-rightbar project-rightbar--review">
          <section className="project-panel">
            <h3>今日のおすすめTodo</h3>
            <div className="recommendation-list">
              {recommendations.map((task, index) => (
                <article key={task.id}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{task.title}</strong>
                    <small>タスク: {task.project.name} / 所要時間 {formatMinutes(task.estimatedMinutes)}</small>
                    <p>{task.recommendationReason}</p>
                    {task.splitSuggestion && <em>{task.splitSuggestion}</em>}
                  </div>
                </article>
              ))}
              {recommendations.length === 0 && <p>今すぐおすすめするTodoはありません。</p>}
            </div>
          </section>

          <section className="project-panel">
            <h3>期限警告</h3>
            <div className="project-alert-list">
              {summaries
                .filter((summary) => ['overdue', 'urgent', 'warning', 'watch'].includes(summary.deadline.state))
                .map((summary) => (
                  <article key={summary.project.id} className={`project-alert project-alert--${summary.deadline.state}`}>
                    <strong>{summary.project.name}</strong>
                    <span>{summary.deadline.label} / {remainingDaysLabel(summary.deadline)}</span>
                    <small>{summary.risk.message}</small>
                  </article>
                ))}
              {summaries.every((summary) => !['overdue', 'urgent', 'warning', 'watch'].includes(summary.deadline.state)) && (
                <p>期限警告はありません。</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
