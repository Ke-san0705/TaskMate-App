const React = require('react');
const { Alert, Pressable, StyleSheet, Text, View } = require('react-native');
const { localDateKey } = require('@taskmate/core');
const DateWheelInput = require('./DateWheelInput');
const EmptyState = require('./EmptyState');
const JapaneseTextInput = require('./JapaneseTextInput');
const TimeWheelInput = require('./TimeWheelInput');
const { useTaskMate } = require('../context/TaskMateContext');
const { ROUTES } = require('../constants/routes');
const { colors, radius, shadows, spacing, typography } = require('../theme/taskMateTheme');
const { messageFromError } = require('../utils/validation');

const PROJECT_STATUS_LABELS = {
  not_started: '未着手',
  in_progress: '進行中',
  completed: '完了',
  paused: '保留'
};

const TASK_STATUS_LABELS = {
  not_started: '未着手',
  in_progress: '進行中',
  completed: '完了'
};

const PRIORITY_LABELS = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '最優先'
};

function dateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function emptyProjectForm(categories) {
  return {
    name: '',
    description: '',
    categoryId: categories[0]?.id || '',
    deadline: dateAfter(30),
    priority: 'medium',
    status: 'not_started'
  };
}

function projectToForm(project, categories) {
  return {
    name: project?.name || '',
    description: project?.description || '',
    categoryId: project?.categoryId || categories[0]?.id || '',
    deadline: project?.deadline || dateAfter(30),
    priority: project?.priority || 'medium',
    status: project?.status || 'not_started'
  };
}

function emptyMilestoneForm(project) {
  return {
    title: '',
    description: '',
    deadline: project?.deadline || dateAfter(14),
    status: 'not_started',
    order: '0'
  };
}

function milestoneToForm(milestone, project) {
  return {
    title: milestone?.title || '',
    description: milestone?.description || '',
    deadline: milestone?.deadline || project?.deadline || dateAfter(14),
    status: milestone?.status || 'not_started',
    order: String(milestone?.order || 0)
  };
}

function emptyTodoForm(project) {
  return {
    title: '',
    description: '',
    milestoneId: '',
    deadline: project?.deadline || localDateKey(new Date()),
    time: '',
    estimatedMinutes: '30',
    importance: '3',
    difficulty: '3',
    progress: '0',
    status: 'not_started'
  };
}

function todoToForm(todo, project) {
  return {
    title: todo?.title || '',
    description: todo?.description || '',
    milestoneId: todo?.milestoneId || '',
    deadline: todo?.deadline || project?.deadline || localDateKey(new Date()),
    time: todo?.time || '',
    estimatedMinutes: String(todo?.estimatedMinutes || 30),
    importance: String(todo?.importance || 3),
    difficulty: String(todo?.difficulty || 3),
    progress: String(todo?.progress || 0),
    status: todo?.status || 'not_started'
  };
}

function ProgressBar({ value }) {
  const progress = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`進捗 ${progress}%`}
      style={styles.progressTrack}
    >
      <View style={[styles.progressFill, { width: `${progress}%` }]} />
    </View>
  );
}

function SmallButton({ label, onPress, variant = 'secondary', disabled = false, accessibilityLabel }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.smallButton, styles[`smallButton_${variant}`], disabled && styles.disabled]}
    >
      <Text style={[styles.smallButtonText, styles[`smallButtonText_${variant}`]]}>{label}</Text>
    </Pressable>
  );
}

function Segment({ options, value, onChange, labelPrefix }) {
  return (
    <View style={styles.segment}>
      {options.map(([optionValue, label]) => {
        const selected = value === optionValue;
        return (
          <Pressable
            key={optionValue}
            accessibilityRole="button"
            accessibilityLabel={`${labelPrefix} ${label}`}
            onPress={() => onChange(optionValue)}
            style={[styles.segmentButton, selected && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CategorySelector({ categories, value, onChange }) {
  if (categories.length === 0) {
    return null;
  }
  return (
    <View style={styles.chipList}>
      {categories.map((category) => {
        const selected = value === category.id;
        return (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={`分類 ${category.name}`}
            onPress={() => onChange(category.id)}
            style={[styles.chip, selected && styles.chipActive]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextActive]}>
              {category.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FormLabel({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

function LongTermTasksPanel({ navigation, taskFilter = '' }) {
  const {
    addProjectTaskToToday,
    completeProjectTask,
    createProject,
    createProjectMilestone,
    createProjectTask,
    deleteProject,
    deleteProjectMilestone,
    deleteProjectTask,
    projectState,
    refreshProjectState,
    setError,
    updateProject,
    updateProjectMilestone,
    updateProjectTask
  } = useTaskMate();

  const {
    categories = [],
    projects = [],
    milestones = [],
    projectTasks = [],
    error
  } = projectState || {};
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [selectedProjectId, setSelectedProjectId] = React.useState('');
  const [projectEditorOpen, setProjectEditorOpen] = React.useState(false);
  const [editingProjectId, setEditingProjectId] = React.useState('');
  const [projectForm, setProjectForm] = React.useState(() => emptyProjectForm(categories));
  const [milestoneEditorOpen, setMilestoneEditorOpen] = React.useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = React.useState('');
  const [milestoneForm, setMilestoneForm] = React.useState(() => emptyMilestoneForm(null));
  const [todoEditorOpen, setTodoEditorOpen] = React.useState(false);
  const [editingTodoId, setEditingTodoId] = React.useState('');
  const [todoForm, setTodoForm] = React.useState(() => emptyTodoForm(null));

  const categoryById = React.useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const milestoneById = React.useMemo(
    () => new Map(milestones.map((milestone) => [milestone.id, milestone])),
    [milestones]
  );
  const normalizedFilter = taskFilter.trim().toLowerCase();
  const filteredProjects = React.useMemo(() => {
    if (!normalizedFilter) {
      return projects;
    }
    return projects.filter((project) =>
      `${project.name} ${project.description} ${categoryById.get(project.categoryId)?.name || ''}`
        .toLowerCase()
        .includes(normalizedFilter)
    );
  }, [categoryById, normalizedFilter, projects]);
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) || filteredProjects[0] || null;
  const selectedMilestones = milestones.filter(
    (milestone) => milestone.projectId === selectedProject?.id
  );
  const selectedTodos = projectTasks.filter(
    (task) => task.projectId === selectedProject?.id
  );
  const activeProjectCount = projects.filter((project) => project.status !== 'completed').length;
  const incompleteTodoCount = projectTasks.filter((task) => task.status !== 'completed').length;
  const averageProgress = projects.length === 0
    ? 0
    : Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length);

  React.useEffect(() => {
    refreshProjectState();
  }, [refreshProjectState]);

  React.useEffect(() => {
    if (!selectedProject && filteredProjects[0]) {
      setSelectedProjectId(filteredProjects[0].id);
    } else if (selectedProject && selectedProject.id !== selectedProjectId) {
      setSelectedProjectId(selectedProject.id);
    }
  }, [filteredProjects, selectedProject, selectedProjectId]);

  React.useEffect(() => {
    if (categories[0]?.id && !projectForm.categoryId && !editingProjectId) {
      setProjectForm((current) => ({ ...current, categoryId: categories[0].id }));
    }
  }, [categories, editingProjectId, projectForm.categoryId]);

  function updateProjectForm(field, value) {
    setProjectForm((current) => ({ ...current, [field]: value }));
  }

  function updateMilestoneForm(field, value) {
    setMilestoneForm((current) => ({ ...current, [field]: value }));
  }

  function updateTodoForm(field, value) {
    setTodoForm((current) => ({ ...current, [field]: value }));
  }

  async function runAction(action, successMessage) {
    setSaving(true);
    setMessage('');
    try {
      const result = await action();
      setMessage(successMessage);
      return result;
    } catch (actionError) {
      setError(messageFromError(actionError));
      return null;
    } finally {
      setSaving(false);
    }
  }

  function startProjectCreate() {
    setEditingProjectId('');
    setProjectForm(emptyProjectForm(categories));
    setProjectEditorOpen(true);
  }

  function startProjectEdit(project) {
    setEditingProjectId(project.id);
    setProjectForm(projectToForm(project, categories));
    setProjectEditorOpen(true);
  }

  async function submitProject() {
    const input = {
      ...projectForm,
      startDate: null,
      estimatedTotalMinutes: 0
    };
    const result = await runAction(
      () => editingProjectId
        ? updateProject(editingProjectId, input)
        : createProject(input),
      editingProjectId ? '長期タスクを更新しました。' : '長期タスクを追加しました。'
    );
    if (result) {
      setSelectedProjectId(result.id);
      setProjectEditorOpen(false);
      setEditingProjectId('');
      setProjectForm(emptyProjectForm(categories));
    }
  }

  function confirmDeleteProject(project) {
    Alert.alert(
      '長期タスクを削除しますか？',
      `「${project.name}」を削除します。今日のタスクに追加済みのTodoは通常タスクとして残します。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            const result = await runAction(
              () => deleteProject(project.id),
              '長期タスクを削除しました。'
            );
            if (result) {
              setSelectedProjectId('');
            }
          }
        }
      ]
    );
  }

  function startMilestoneCreate() {
    if (!selectedProject) {
      return;
    }
    setEditingMilestoneId('');
    setMilestoneForm(emptyMilestoneForm(selectedProject));
    setMilestoneEditorOpen(true);
  }

  function startMilestoneEdit(milestone) {
    setEditingMilestoneId(milestone.id);
    setMilestoneForm(milestoneToForm(milestone, selectedProject));
    setMilestoneEditorOpen(true);
  }

  async function submitMilestone() {
    if (!selectedProject) {
      return;
    }
    const input = {
      ...milestoneForm,
      projectId: selectedProject.id,
      order: Number(milestoneForm.order)
    };
    const result = await runAction(
      () => editingMilestoneId
        ? updateProjectMilestone(editingMilestoneId, input)
        : createProjectMilestone(input),
      editingMilestoneId ? '段階を更新しました。' : '段階を追加しました。'
    );
    if (result) {
      setMilestoneEditorOpen(false);
      setEditingMilestoneId('');
      setMilestoneForm(emptyMilestoneForm(selectedProject));
    }
  }

  function confirmDeleteMilestone(milestone) {
    Alert.alert('段階を削除しますか？', `「${milestone.title}」を削除します。Todoは長期タスク直下に残します。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () =>
          runAction(
            () => deleteProjectMilestone(milestone.id),
            '段階を削除しました。'
          )
      }
    ]);
  }

  function startTodoCreate() {
    if (!selectedProject) {
      return;
    }
    setEditingTodoId('');
    setTodoForm(emptyTodoForm(selectedProject));
    setTodoEditorOpen(true);
  }

  function startTodoEdit(todo) {
    setEditingTodoId(todo.id);
    setTodoForm(todoToForm(todo, selectedProject));
    setTodoEditorOpen(true);
  }

  async function submitTodo() {
    if (!selectedProject) {
      return;
    }
    const input = {
      ...todoForm,
      projectId: selectedProject.id,
      time: todoForm.time.trim() ? todoForm.time.trim() : null,
      milestoneId: todoForm.milestoneId || null,
      estimatedMinutes: Number(todoForm.estimatedMinutes),
      importance: Number(todoForm.importance),
      difficulty: Number(todoForm.difficulty),
      progress: Number(todoForm.progress)
    };
    const result = await runAction(
      () => editingTodoId
        ? updateProjectTask(editingTodoId, input)
        : createProjectTask(input),
      editingTodoId ? '長期Todoを更新しました。' : '長期Todoを追加しました。'
    );
    if (result) {
      setTodoEditorOpen(false);
      setEditingTodoId('');
      setTodoForm(emptyTodoForm(selectedProject));
    }
  }

  function confirmDeleteTodo(todo) {
    Alert.alert('長期Todoを削除しますか？', `「${todo.title}」を削除します。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () =>
          runAction(
            () => deleteProjectTask(todo.id),
            '長期Todoを削除しました。'
          )
      }
    ]);
  }

  async function addTodoToToday(todo, openFocus = false) {
    const result = await runAction(
      () => addProjectTaskToToday(todo.id),
      openFocus ? '今日のタスクに追加して集中準備へ進みます。' : '今日のタスクに追加しました。'
    );
    if (result?.task && openFocus) {
      navigation.navigate(ROUTES.FocusSetup, { taskId: result.task.id });
    }
  }

  if (error) {
    return (
      <View style={styles.panel}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{activeProjectCount}</Text>
          <Text style={styles.summaryLabel}>進行中</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{averageProgress}%</Text>
          <Text style={styles.summaryLabel}>平均進捗</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{incompleteTodoCount}</Text>
          <Text style={styles.summaryLabel}>残Todo</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.eyebrow}>LONG TASKS</Text>
            <Text style={styles.cardTitle}>長期タスク</Text>
          </View>
          <SmallButton label="追加" variant="primary" onPress={startProjectCreate} />
        </View>

        {projectEditorOpen ? (
          <View style={styles.form}>
            <FormLabel>長期タスク名</FormLabel>
            <JapaneseTextInput
              accessibilityLabel="長期タスク名"
              value={projectForm.name}
              onChangeText={(value) => updateProjectForm('name', value)}
              placeholder="例: 卒業研究を仕上げる"
              style={styles.input}
              maxLength={120}
            />
            <FormLabel>分類</FormLabel>
            <CategorySelector
              categories={categories}
              value={projectForm.categoryId}
              onChange={(value) => updateProjectForm('categoryId', value)}
            />
            <FormLabel>期限</FormLabel>
            <DateWheelInput
              accessibilityLabel="長期タスクの期限"
              value={projectForm.deadline}
              onChange={(value) => updateProjectForm('deadline', value)}
              style={styles.input}
            />
            <FormLabel>優先度</FormLabel>
            <Segment
              labelPrefix="優先度"
              value={projectForm.priority}
              onChange={(value) => updateProjectForm('priority', value)}
              options={[
                ['low', '低'],
                ['medium', '中'],
                ['high', '高'],
                ['urgent', '最優先']
              ]}
            />
            <FormLabel>状態</FormLabel>
            <Segment
              labelPrefix="状態"
              value={projectForm.status}
              onChange={(value) => updateProjectForm('status', value)}
              options={[
                ['not_started', '未着手'],
                ['in_progress', '進行中'],
                ['completed', '完了'],
                ['paused', '保留']
              ]}
            />
            <FormLabel>説明</FormLabel>
            <JapaneseTextInput
              accessibilityLabel="長期タスクの説明"
              value={projectForm.description}
              onChangeText={(value) => updateProjectForm('description', value)}
              placeholder="ゴールや提出物を短くメモ"
              style={[styles.input, styles.textarea]}
              multiline
              maxLength={1000}
            />
            <View style={styles.actionRow}>
              <SmallButton
                label={saving ? '保存中...' : '保存'}
                variant="primary"
                disabled={saving}
                onPress={submitProject}
              />
              <SmallButton
                label="閉じる"
                onPress={() => {
                  setProjectEditorOpen(false);
                  setEditingProjectId('');
                }}
              />
            </View>
          </View>
        ) : null}

        {filteredProjects.length === 0 ? (
          <EmptyState title="長期タスクはまだありません" body="大きい作業を登録して、Todoへ分解できます。" />
        ) : (
          <View style={styles.projectList}>
            {filteredProjects.map((project) => {
              const selected = selectedProject?.id === project.id;
              const category = categoryById.get(project.categoryId);
              return (
                <View key={project.id} style={[styles.projectCard, selected && styles.selectedCard]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${project.name}を開く`}
                    onPress={() => setSelectedProjectId(project.id)}
                    style={styles.projectMain}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.flex}>
                        <Text style={styles.projectTitle}>{project.name}</Text>
                        <Text style={styles.meta}>
                          {category?.name || '未分類'} / {project.deadline || '期限未定'} / {PRIORITY_LABELS[project.priority]}
                        </Text>
                      </View>
                      <Text style={styles.progressText}>{project.progress}%</Text>
                    </View>
                    <ProgressBar value={project.progress} />
                    <Text style={styles.statusLine}>{PROJECT_STATUS_LABELS[project.status]}</Text>
                  </Pressable>
                  <View style={styles.actionRow}>
                    <SmallButton label="編集" onPress={() => startProjectEdit(project)} />
                    <SmallButton
                      label="削除"
                      variant="danger"
                      onPress={() => confirmDeleteProject(project)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {selectedProject ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>SELECTED</Text>
              <Text style={styles.cardTitle}>{selectedProject.name}</Text>
            </View>
            <Text style={styles.progressText}>{selectedProject.progress}%</Text>
          </View>
          {selectedProject.description ? (
            <Text style={styles.body}>{selectedProject.description}</Text>
          ) : null}
          <ProgressBar value={selectedProject.progress} />

          <View style={styles.blockHeader}>
            <View>
              <Text style={styles.blockTitle}>段階</Text>
              <Text style={styles.meta}>{selectedMilestones.length}件</Text>
            </View>
            <SmallButton label="追加" onPress={startMilestoneCreate} />
          </View>

          {milestoneEditorOpen ? (
            <View style={styles.form}>
              <FormLabel>段階名</FormLabel>
              <JapaneseTextInput
                accessibilityLabel="段階名"
                value={milestoneForm.title}
                onChangeText={(value) => updateMilestoneForm('title', value)}
                placeholder="例: 調査を終える"
                style={styles.input}
                maxLength={120}
              />
              <FormLabel>期限</FormLabel>
              <DateWheelInput
                accessibilityLabel="段階の期限"
                value={milestoneForm.deadline}
                onChange={(value) => updateMilestoneForm('deadline', value)}
                style={styles.input}
              />
              <FormLabel>状態</FormLabel>
              <Segment
                labelPrefix="段階の状態"
                value={milestoneForm.status}
                onChange={(value) => updateMilestoneForm('status', value)}
                options={[
                  ['not_started', '未着手'],
                  ['in_progress', '進行中'],
                  ['completed', '完了']
                ]}
              />
              <FormLabel>説明</FormLabel>
              <JapaneseTextInput
                accessibilityLabel="段階の説明"
                value={milestoneForm.description}
                onChangeText={(value) => updateMilestoneForm('description', value)}
                placeholder="必要ならメモ"
                style={[styles.input, styles.textareaSmall]}
                multiline
                maxLength={1000}
              />
              <View style={styles.actionRow}>
                <SmallButton
                  label={saving ? '保存中...' : '保存'}
                  variant="primary"
                  disabled={saving}
                  onPress={submitMilestone}
                />
                <SmallButton
                  label="閉じる"
                  onPress={() => {
                    setMilestoneEditorOpen(false);
                    setEditingMilestoneId('');
                  }}
                />
              </View>
            </View>
          ) : null}

          {selectedMilestones.length === 0 ? (
            <EmptyState title="段階は未登録です" body="必要なら中間地点を追加できます。" />
          ) : (
            <View style={styles.compactList}>
              {selectedMilestones.map((milestone) => (
                <View key={milestone.id} style={styles.compactItem}>
                  <View style={styles.flex}>
                    <Text style={styles.compactTitle}>{milestone.title}</Text>
                    <Text style={styles.meta}>
                      {milestone.deadline || '期限未定'} / {TASK_STATUS_LABELS[milestone.status]}
                    </Text>
                  </View>
                  <View style={styles.inlineActions}>
                    <SmallButton label="編集" onPress={() => startMilestoneEdit(milestone)} />
                    <SmallButton
                      label="削除"
                      variant="danger"
                      onPress={() => confirmDeleteMilestone(milestone)}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.blockHeader}>
            <View>
              <Text style={styles.blockTitle}>Todo</Text>
              <Text style={styles.meta}>{selectedTodos.length}件</Text>
            </View>
            <SmallButton label="追加" onPress={startTodoCreate} />
          </View>

          {todoEditorOpen ? (
            <View style={styles.form}>
              <FormLabel>Todo名</FormLabel>
              <JapaneseTextInput
                accessibilityLabel="長期Todo名"
                value={todoForm.title}
                onChangeText={(value) => updateTodoForm('title', value)}
                placeholder="例: 参考文献を3本読む"
                style={styles.input}
                maxLength={120}
              />
              {selectedMilestones.length > 0 ? (
                <>
                  <FormLabel>段階</FormLabel>
                  <View style={styles.chipList}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="段階なし"
                      onPress={() => updateTodoForm('milestoneId', '')}
                      style={[styles.chip, !todoForm.milestoneId && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, !todoForm.milestoneId && styles.chipTextActive]}>
                        直下
                      </Text>
                    </Pressable>
                    {selectedMilestones.map((milestone) => {
                      const selected = todoForm.milestoneId === milestone.id;
                      return (
                        <Pressable
                          key={milestone.id}
                          accessibilityRole="button"
                          accessibilityLabel={`段階 ${milestone.title}`}
                          onPress={() => updateTodoForm('milestoneId', milestone.id)}
                          style={[styles.chip, selected && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                            {milestone.title}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
              <FormLabel>期限</FormLabel>
              <DateWheelInput
                accessibilityLabel="長期Todoの期限"
                value={todoForm.deadline}
                onChange={(value) => updateTodoForm('deadline', value)}
                style={styles.input}
              />
              <FormLabel>時刻（任意）</FormLabel>
              <TimeWheelInput
                accessibilityLabel="長期Todoの時刻"
                value={todoForm.time}
                onChange={(value) => updateTodoForm('time', value)}
                style={styles.input}
              />
              <View style={styles.twoColumn}>
                <View style={styles.flex}>
                  <FormLabel>見積分</FormLabel>
                  <JapaneseTextInput
                    accessibilityLabel="見積分"
                    value={todoForm.estimatedMinutes}
                    onChangeText={(value) => updateTodoForm('estimatedMinutes', value)}
                    keyboardType="number-pad"
                    style={styles.input}
                    maxLength={4}
                  />
                </View>
                <View style={styles.flex}>
                  <FormLabel>進捗%</FormLabel>
                  <JapaneseTextInput
                    accessibilityLabel="進捗"
                    value={todoForm.progress}
                    onChangeText={(value) => updateTodoForm('progress', value)}
                    keyboardType="number-pad"
                    style={styles.input}
                    maxLength={3}
                  />
                </View>
              </View>
              <FormLabel>状態</FormLabel>
              <Segment
                labelPrefix="Todoの状態"
                value={todoForm.status}
                onChange={(value) => updateTodoForm('status', value)}
                options={[
                  ['not_started', '未着手'],
                  ['in_progress', '進行中'],
                  ['completed', '完了']
                ]}
              />
              <FormLabel>説明</FormLabel>
              <JapaneseTextInput
                accessibilityLabel="長期Todoの説明"
                value={todoForm.description}
                onChangeText={(value) => updateTodoForm('description', value)}
                placeholder="必要ならメモ"
                style={[styles.input, styles.textareaSmall]}
                multiline
                maxLength={1000}
              />
              <View style={styles.actionRow}>
                <SmallButton
                  label={saving ? '保存中...' : '保存'}
                  variant="primary"
                  disabled={saving}
                  onPress={submitTodo}
                />
                <SmallButton
                  label="閉じる"
                  onPress={() => {
                    setTodoEditorOpen(false);
                    setEditingTodoId('');
                  }}
                />
              </View>
            </View>
          ) : null}

          {selectedTodos.length === 0 ? (
            <EmptyState title="Todoは未登録です" body="長期タスクを、今日進められる粒度まで分けましょう。" />
          ) : (
            <View style={styles.todoList}>
              {selectedTodos.map((todo) => {
                const milestone = milestoneById.get(todo.milestoneId);
                const completed = todo.status === 'completed';
                return (
                  <View key={todo.id} style={[styles.todoCard, completed && styles.completedCard]}>
                    <View style={styles.cardHeader}>
                      <View style={styles.flex}>
                        <Text style={styles.todoTitle}>{todo.title}</Text>
                        <Text style={styles.meta}>
                          {todo.deadline || '期限未定'} {todo.time ? `/ ${todo.time}` : ''} / {todo.estimatedMinutes}分
                        </Text>
                      </View>
                      <Text style={[styles.statusBadge, completed && styles.statusBadgeDone]}>
                        {TASK_STATUS_LABELS[todo.status]}
                      </Text>
                    </View>
                    {milestone ? <Text style={styles.meta}>段階: {milestone.title}</Text> : null}
                    {todo.description ? <Text style={styles.body}>{todo.description}</Text> : null}
                    <ProgressBar value={todo.progress} />
                    {todo.normalTaskId ? (
                      <Text style={styles.linkedText}>今日のタスクに追加済み</Text>
                    ) : null}
                    <View style={styles.actionRow}>
                      {!completed ? (
                        <>
                          <SmallButton
                            label="今日へ"
                            variant="primary"
                            onPress={() => addTodoToToday(todo, false)}
                          />
                          <SmallButton
                            label="集中"
                            onPress={() => addTodoToToday(todo, true)}
                          />
                        </>
                      ) : null}
                      <SmallButton
                        label={completed ? '戻す' : '完了'}
                        onPress={() => runAction(
                          () => completeProjectTask(todo.id, !completed),
                          completed ? '長期Todoを未完了に戻しました。' : '長期Todoを完了しました。'
                        )}
                      />
                      <SmallButton label="編集" onPress={() => startTodoEdit(todo)} />
                      <SmallButton
                        label="削除"
                        variant="danger"
                        onPress={() => confirmDeleteTodo(todo)}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.section
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10
  },
  summaryItem: {
    flex: 1,
    padding: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadows.soft
  },
  summaryValue: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900'
  },
  summaryLabel: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800'
  },
  card: {
    padding: spacing.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 13,
    ...shadows.soft
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12
  },
  eyebrow: {
    ...typography.eyebrow
  },
  cardTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900'
  },
  blockHeader: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  blockTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  projectList: {
    gap: 10
  },
  projectCard: {
    padding: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft,
    gap: 10
  },
  selectedCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  projectMain: {
    gap: 8
  },
  projectTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900'
  },
  todoTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900'
  },
  compactTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900'
  },
  meta: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  statusLine: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900'
  },
  progressText: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: '900'
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: '#DDE8D8',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary
  },
  form: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSoft,
    gap: 8
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4
  },
  input: {
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15
  },
  textarea: {
    minHeight: 92,
    textAlignVertical: 'top'
  },
  textareaSmall: {
    minHeight: 70,
    textAlignVertical: 'top'
  },
  segment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  segmentButton: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  segmentActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  segmentText: {
    color: colors.primary,
    fontWeight: '900'
  },
  segmentTextActive: {
    color: colors.white
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800'
  },
  chipTextActive: {
    color: colors.primaryDark
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8
  },
  smallButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  smallButton_primary: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  smallButton_secondary: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  smallButton_danger: {
    borderColor: '#D7A6A6',
    backgroundColor: colors.dangerSoft
  },
  smallButtonText: {
    fontWeight: '900',
    fontSize: 13
  },
  smallButtonText_primary: {
    color: colors.white
  },
  smallButtonText_secondary: {
    color: colors.primary
  },
  smallButtonText_danger: {
    color: colors.dangerText
  },
  compactList: {
    gap: 9
  },
  compactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 11,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft
  },
  todoList: {
    gap: 10
  },
  todoCard: {
    padding: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft,
    gap: 9
  },
  completedCard: {
    opacity: 0.72
  },
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    overflow: 'hidden',
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    fontSize: 12,
    fontWeight: '900'
  },
  statusBadgeDone: {
    color: colors.white,
    backgroundColor: colors.primary
  },
  linkedText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '900'
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 10
  },
  flex: {
    flex: 1
  },
  disabled: {
    opacity: 0.6
  },
  message: {
    padding: 10,
    borderRadius: radius.sm,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    fontWeight: '800'
  },
  error: {
    padding: 10,
    borderRadius: radius.sm,
    color: colors.dangerText,
    backgroundColor: colors.dangerSoft,
    fontWeight: '800'
  }
});

module.exports = LongTermTasksPanel;
