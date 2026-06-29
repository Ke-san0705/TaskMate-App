const React = require('react');
const {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} = require('react-native');
const { SafeAreaView } = require('react-native-safe-area-context');
const DateWheelInput = require('../components/DateWheelInput');
const EmptyState = require('../components/EmptyState');
const ErrorBanner = require('../components/ErrorBanner');
const JapaneseTextInput = require('../components/JapaneseTextInput');
const TimeWheelInput = require('../components/TimeWheelInput');
const { useTaskMate } = require('../context/TaskMateContext');
const {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TASK_STATUS_LABELS
} = require('../utils/projectCalculations');
const { colors, radius, shadows, spacing, typography } = require('../theme/taskMateTheme');

function todayKey() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function createInitialMilestoneForm() {
  return {
    title: '',
    deadline: todayKey(),
    status: 'not_started',
    order: '0',
    description: ''
  };
}

function createInitialTaskForm(milestoneId = '') {
  return {
    title: '',
    milestoneId,
    startDate: '',
    deadline: todayKey(),
    time: '',
    scheduledDate: '',
    estimatedMinutes: '30',
    importance: '3',
    difficulty: '3',
    progress: '0',
    status: 'not_started',
    dependencyTaskIds: [],
    description: ''
  };
}

function createProjectForm(project = {}) {
  return {
    name: project.name || '',
    categoryId: project.categoryId || '',
    startDate: project.startDate || todayKey(),
    deadline: project.deadline || todayKey(),
    priority: project.priority || 'medium',
    estimatedTotalMinutes: String(project.estimatedTotalMinutes ?? 120),
    progress: String(project.progress ?? 0),
    status: project.status || 'not_started',
    description: project.description || ''
  };
}

function ProjectDetailScreen({ navigation, route }) {
  const {
    addProjectTaskToToday,
    completeProjectTask,
    createProjectMilestone,
    createProjectTask,
    deleteProject,
    deleteProjectMilestone,
    deleteProjectTask,
    error,
    projectState,
    setError,
    updateProject,
    updateProjectMilestone,
    updateProjectTask
  } = useTaskMate();
  const projectId = route.params?.projectId;
  const summary = projectState.summaries.find((item) => item.project.id === projectId);
  const [projectForm, setProjectForm] = React.useState(() => createProjectForm());
  const [milestoneForm, setMilestoneForm] = React.useState(createInitialMilestoneForm);
  const [taskForm, setTaskForm] = React.useState(() => createInitialTaskForm());
  const [saving, setSaving] = React.useState('');
  const [addMenuOpen, setAddMenuOpen] = React.useState(false);
  const [activeForm, setActiveForm] = React.useState(null);
  const [editingMilestoneId, setEditingMilestoneId] = React.useState(null);
  const [editingTaskId, setEditingTaskId] = React.useState(null);

  React.useEffect(() => {
    if (summary?.milestones?.[0]?.id && !taskForm.milestoneId) {
      setTaskForm((current) => ({ ...current, milestoneId: summary.milestones[0].id }));
    }
  }, [summary?.milestones?.length]);

  React.useEffect(() => {
    if (summary?.project) {
      setProjectForm(createProjectForm(summary.project));
    }
  }, [summary?.project?.id]);

  if (!summary) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <EmptyState title="プロジェクトが見つかりません" body="一覧からもう一度選び直してください。" />
          <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryText}>戻る</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { project, milestones, tasks, risk } = summary;
  const unassignedTasks = tasks.filter((task) => !task.milestoneId);

  function updateProjectForm(field, value) {
    setProjectForm((current) => ({ ...current, [field]: value }));
  }

  function updateMilestoneForm(field, value) {
    setMilestoneForm((current) => ({ ...current, [field]: value }));
  }

  function updateTaskForm(field, value) {
    setTaskForm((current) => ({ ...current, [field]: value }));
  }

  function openForm(type, milestoneId = null) {
    setAddMenuOpen(false);
    if (type === 'project') {
      setProjectForm(createProjectForm(project));
    }
    if (type === 'milestone') {
      setEditingMilestoneId(null);
      setMilestoneForm({
        ...createInitialMilestoneForm(),
        deadline: project.deadline || todayKey(),
        order: String(milestones.length)
      });
    }
    if (type === 'task') {
      setEditingTaskId(null);
      setTaskForm(createInitialTaskForm(milestoneId || milestones[0]?.id || ''));
    }
    setActiveForm(type);
  }

  function closeForm() {
    setActiveForm(null);
    setEditingMilestoneId(null);
    setEditingTaskId(null);
  }

  function toggleDependency(taskId) {
    setTaskForm((current) => {
      const selected = new Set(current.dependencyTaskIds || []);
      if (selected.has(taskId)) {
        selected.delete(taskId);
      } else {
        selected.add(taskId);
      }
      return { ...current, dependencyTaskIds: Array.from(selected) };
    });
  }

  async function submitProjectEdit() {
    setSaving('project');
    try {
      await updateProject(project.id, {
        ...projectForm,
        categoryId: projectForm.categoryId || project.categoryId,
        estimatedTotalMinutes: Number(projectForm.estimatedTotalMinutes || 0),
        progress: Number(projectForm.progress || 0)
      });
      closeForm();
    } finally {
      setSaving('');
    }
  }

  async function submitMilestone() {
    setSaving('milestone');
    try {
      const input = {
        ...milestoneForm,
        projectId: project.id,
        order: Number(milestoneForm.order || milestones.length)
      };
      if (editingMilestoneId) {
        await updateProjectMilestone(editingMilestoneId, input);
      } else {
        await createProjectMilestone(input);
      }
      setMilestoneForm(createInitialMilestoneForm());
      closeForm();
    } finally {
      setSaving('');
    }
  }

  async function submitTask() {
    setSaving('task');
    try {
      const input = {
        ...taskForm,
        projectId: project.id,
        milestoneId: taskForm.milestoneId || null,
        startDate: taskForm.startDate || null,
        scheduledDate: taskForm.scheduledDate || null,
        time: taskForm.time.trim() ? taskForm.time.trim() : null,
        estimatedMinutes: Number(taskForm.estimatedMinutes || 30),
        importance: Number(taskForm.importance || 3),
        difficulty: Number(taskForm.difficulty || 3),
        progress: Number(taskForm.progress || 0),
        dependencyTaskIds: taskForm.dependencyTaskIds || []
      };
      if (editingTaskId) {
        await updateProjectTask(editingTaskId, input);
      } else {
        await createProjectTask(input);
      }
      setTaskForm((current) => createInitialTaskForm(current.milestoneId));
      closeForm();
    } finally {
      setSaving('');
    }
  }

  async function toggleProjectStatus(nextStatus) {
    await updateProject(project.id, { status: nextStatus });
  }

  function confirmDeleteProject() {
    Alert.alert(
      'プロジェクトを削除しますか？',
      'PC版と同じように、今日のタスクへ送ったTodoを一緒に削除するか、通常タスクとして残すか選べます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'Todoも削除',
          style: 'destructive',
          onPress: async () => {
            await deleteProject(project.id, 'deleteAll');
            navigation.goBack();
          }
        },
        {
          text: 'Todoは残す',
          onPress: async () => {
            await deleteProject(project.id, 'keepTasks');
            navigation.goBack();
          }
        }
      ]
    );
  }

  function startEditMilestone(milestone) {
    setEditingMilestoneId(milestone.id);
    setMilestoneForm({
      title: milestone.title || '',
      deadline: milestone.deadline || todayKey(),
      status: milestone.status || 'not_started',
      order: String(milestone.order || 0),
      description: milestone.description || ''
    });
    setActiveForm('milestone');
  }

  function startEditTask(task) {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title || '',
      milestoneId: task.milestoneId || '',
      startDate: task.startDate || '',
      deadline: task.deadline || todayKey(),
      time: task.time || '',
      scheduledDate: task.scheduledDate || '',
      estimatedMinutes: String(task.estimatedMinutes || 30),
      importance: String(task.importance || 3),
      difficulty: String(task.difficulty || 3),
      progress: String(task.progress || 0),
      status: task.status || 'not_started',
      dependencyTaskIds: task.dependencyTaskIds || [],
      description: task.description || ''
    });
    setActiveForm('task');
  }

  function confirmDeleteMilestone(milestone) {
    const childCount = tasks.filter((task) => task.milestoneId === milestone.id).length;
    Alert.alert(
      '段階を削除しますか？',
      childCount > 0
        ? `「${milestone.title}」を削除します。中のTodo ${childCount}件は未分類へ移動します。`
        : `「${milestone.title}」を削除します。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => deleteProjectMilestone(milestone.id)
        }
      ]
    );
  }

  function confirmDeleteTask(task) {
    Alert.alert(
      'Todoを削除しますか？',
      task.normalTaskId
        ? `「${task.title}」を削除します。今日のタスクへ送った予定も一緒に削除されます。`
        : `「${task.title}」を削除します。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => deleteProjectTask(task.id)
        }
      ]
    );
  }

  function renderProjectTask(task) {
    const dependencies = (task.dependencyTaskIds || [])
      .map((dependencyId) => tasks.find((candidate) => candidate.id === dependencyId))
      .filter(Boolean);
    return (
      <View key={task.id} style={styles.todoFile}>
        <View style={styles.todoHeader}>
          <View style={styles.todoTitleWrap}>
            <Text style={styles.fileLabel}>Todo</Text>
            <Text style={styles.todoTitle}>{task.title}</Text>
          </View>
          <Text style={styles.badge}>{PROJECT_TASK_STATUS_LABELS[task.status]}</Text>
        </View>
        <Text style={styles.meta}>
          期限 {task.deadline}{task.time ? ` / ${task.time}` : ''} / {task.estimatedMinutes}分
        </Text>
        <Text style={styles.meta}>
          重要度 {task.importance} / 難易度 {task.difficulty} / 進捗 {task.progress}%
        </Text>
        {task.startDate || task.scheduledDate ? (
          <Text style={styles.meta}>
            {task.startDate ? `開始 ${task.startDate}` : ''}
            {task.startDate && task.scheduledDate ? ' / ' : ''}
            {task.scheduledDate ? `予定 ${task.scheduledDate}` : ''}
          </Text>
        ) : null}
        {dependencies.length > 0 ? (
          <Text style={styles.meta}>
            前提Todo: {dependencies.map((dependency) => dependency.title).join(' / ')}
          </Text>
        ) : null}
        {task.description ? <Text style={styles.body}>{task.description}</Text> : null}
        <View style={styles.todoActions}>
          <Pressable style={styles.secondarySmallButton} onPress={() => startEditTask(task)}>
            <Text style={styles.secondaryText}>編集</Text>
          </Pressable>
          <Pressable style={styles.secondarySmallButton} onPress={() => addProjectTaskToToday(task.id)}>
            <Text style={styles.secondaryText}>{task.normalTaskId ? '今日を更新' : '今日へ送る'}</Text>
          </Pressable>
          <Pressable
            style={styles.primarySmallButton}
            onPress={() => completeProjectTask(task.id, task.status !== 'completed')}
          >
            <Text style={styles.primaryText}>{task.status === 'completed' ? '戻す' : '完了'}</Text>
          </Pressable>
          <Pressable style={styles.dangerSmallButton} onPress={() => confirmDeleteTask(task)}>
            <Text style={styles.dangerText}>削除</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderMilestoneFolder(milestone) {
    const childTasks = tasks.filter((task) => task.milestoneId === milestone.id);
    return (
      <View key={milestone.id} style={styles.folderCard}>
        <View style={styles.folderTab} />
        <View style={styles.folderHeader}>
          <View style={styles.folderTitleWrap}>
            <Text style={styles.folderLabel}>段階</Text>
            <Text style={styles.folderTitle}>{milestone.title}</Text>
          </View>
          <Pressable style={styles.textButton} onPress={() => startEditMilestone(milestone)}>
            <Text style={styles.secondaryText}>編集</Text>
          </Pressable>
          <Pressable style={styles.deleteTextButton} onPress={() => confirmDeleteMilestone(milestone)}>
            <Text style={styles.deleteText}>削除</Text>
          </Pressable>
        </View>
        <Text style={styles.meta}>
          {milestone.deadline} / {PROJECT_TASK_STATUS_LABELS[milestone.status]} / Todo {childTasks.length}
        </Text>
        <View style={styles.fileList}>
          {childTasks.length > 0 ? (
            childTasks.map(renderProjectTask)
          ) : (
            <View style={styles.emptyFolder}>
              <Text style={styles.emptyFolderTitle}>この段階のTodoは空です</Text>
              <Text style={styles.emptyFolderBody}>右下の + からTodoを追加できます。</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  function renderUnassignedFolder() {
    if (unassignedTasks.length === 0) return null;
    return (
      <View style={styles.folderCard}>
        <View style={styles.folderTabMuted} />
        <View style={styles.folderHeader}>
          <View style={styles.folderTitleWrap}>
            <Text style={styles.folderLabel}>未分類</Text>
            <Text style={styles.folderTitle}>段階未設定のTodo</Text>
          </View>
        </View>
        <Text style={styles.meta}>Todo {unassignedTasks.length}</Text>
        <View style={styles.fileList}>{unassignedTasks.map(renderProjectTask)}</View>
      </View>
    );
  }

  function renderNextTaskCard() {
    if (!summary.nextTask) return null;
    const milestone = milestones.find((item) => item.id === summary.nextTask.milestoneId);
    return (
      <View style={styles.nextCard}>
        <View style={styles.nextHeader}>
          <View style={styles.nextTitleWrap}>
            <Text style={styles.nextEyebrow}>今日の一手</Text>
            <Text style={styles.nextTitle}>{summary.nextTask.title}</Text>
          </View>
          <Pressable style={styles.nextButton} onPress={() => addProjectTaskToToday(summary.nextTask.id)}>
            <Text style={styles.primaryText}>今日へ送る</Text>
          </Pressable>
        </View>
        <Text style={styles.meta}>{milestone ? `段階: ${milestone.title}` : '未分類'}</Text>
        <Text style={styles.body}>{summary.nextTask.recommendationReason}</Text>
      </View>
    );
  }

  function renderProjectForm() {
    return (
      <View style={styles.form}>
        <Text style={styles.formTitle}>プロジェクトを編集</Text>
        <JapaneseTextInput
          value={projectForm.name}
          onChangeText={(value) => updateProjectForm('name', value)}
          placeholder="プロジェクト名"
          style={styles.input}
          maxLength={120}
        />
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentScrollContent}
          style={styles.segmentScroll}
        >
          {projectState.categories.map((category) => (
            <Pressable
              key={category.id}
              style={[
                styles.segmentButton,
                styles.milestoneSegmentButton,
                projectForm.categoryId === category.id && styles.segmentActive
              ]}
              onPress={() => updateProjectForm('categoryId', category.id)}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.segmentText,
                  projectForm.categoryId === category.id && styles.segmentTextActive
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.fieldLabel}>開始日</Text>
        <DateWheelInput
          value={projectForm.startDate}
          onChange={(value) => updateProjectForm('startDate', value)}
          style={styles.input}
        />
        <Text style={styles.fieldLabel}>期限</Text>
        <DateWheelInput
          value={projectForm.deadline}
          onChange={(value) => updateProjectForm('deadline', value)}
          style={styles.input}
        />
        <View style={styles.segment}>
          {['low', 'medium', 'high', 'urgent'].map((priority) => (
            <Pressable
              key={priority}
              style={[styles.segmentButton, projectForm.priority === priority && styles.segmentActive]}
              onPress={() => updateProjectForm('priority', priority)}
            >
              <Text
                style={[
                  styles.segmentText,
                  projectForm.priority === priority && styles.segmentTextActive
                ]}
              >
                {PROJECT_PRIORITY_LABELS[priority]}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.segment}>
          {['not_started', 'in_progress', 'paused', 'completed'].map((status) => (
            <Pressable
              key={status}
              style={[styles.segmentButton, projectForm.status === status && styles.segmentActive]}
              onPress={() => updateProjectForm('status', status)}
            >
              <Text
                style={[
                  styles.segmentText,
                  projectForm.status === status && styles.segmentTextActive
                ]}
              >
                {PROJECT_STATUS_LABELS[status]}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.formGridTwo}>
          <JapaneseTextInput
            value={projectForm.estimatedTotalMinutes}
            onChangeText={(value) => updateProjectForm('estimatedTotalMinutes', value)}
            placeholder="総作業分"
            keyboardType="number-pad"
            style={styles.input}
          />
          <JapaneseTextInput
            value={projectForm.progress}
            onChangeText={(value) => updateProjectForm('progress', value)}
            placeholder="進捗 0-100"
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>
        <JapaneseTextInput
          value={projectForm.description}
          onChangeText={(value) => updateProjectForm('description', value)}
          placeholder="説明"
          style={[styles.input, styles.textarea]}
          multiline
          maxLength={3000}
        />
        <Pressable disabled={saving === 'project'} style={styles.primaryButton} onPress={submitProjectEdit}>
          <Text style={styles.primaryText}>{saving === 'project' ? '保存中...' : 'プロジェクトを保存'}</Text>
        </Pressable>
      </View>
    );
  }

  function renderTaskForm() {
    return (
      <View style={styles.form}>
        <Text style={styles.formTitle}>Todoを追加</Text>
        <JapaneseTextInput
          value={taskForm.title}
          onChangeText={(value) => updateTaskForm('title', value)}
          placeholder="例: 参考資料を3つ集める"
          style={styles.input}
        />
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentScrollContent}
          style={styles.segmentScroll}
        >
          <Pressable
            style={[
              styles.segmentButton,
              styles.milestoneSegmentButton,
              !taskForm.milestoneId && styles.segmentActive
            ]}
            onPress={() => updateTaskForm('milestoneId', '')}
          >
            <Text style={[styles.segmentText, !taskForm.milestoneId && styles.segmentTextActive]}>
              未分類
            </Text>
          </Pressable>
          {milestones.map((milestone) => (
            <Pressable
              key={milestone.id}
              style={[
                styles.segmentButton,
                styles.milestoneSegmentButton,
                taskForm.milestoneId === milestone.id && styles.segmentActive
              ]}
              onPress={() => updateTaskForm('milestoneId', milestone.id)}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.segmentText,
                  taskForm.milestoneId === milestone.id && styles.segmentTextActive
                ]}
              >
                {milestone.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.fieldLabel}>開始可能日</Text>
        <DateWheelInput
          value={taskForm.startDate}
          onChange={(value) => updateTaskForm('startDate', value)}
          style={styles.input}
        />
        <Text style={styles.fieldLabel}>期限</Text>
        <DateWheelInput
          value={taskForm.deadline}
          onChange={(value) => updateTaskForm('deadline', value)}
          style={styles.input}
        />
        <TimeWheelInput
          accessibilityLabel="Todoの時刻"
          emptyLabel="時刻なし"
          value={taskForm.time}
          onChange={(value) => updateTaskForm('time', value)}
          style={styles.input}
        />
        <JapaneseTextInput
          value={taskForm.estimatedMinutes}
          onChangeText={(value) => updateTaskForm('estimatedMinutes', value)}
          placeholder="30"
          keyboardType="number-pad"
          style={styles.input}
        />
        <Text style={styles.fieldLabel}>予定実施日</Text>
        <DateWheelInput
          value={taskForm.scheduledDate}
          onChange={(value) => updateTaskForm('scheduledDate', value)}
          style={styles.input}
        />
        <View style={styles.formGridTwo}>
          <JapaneseTextInput
            value={taskForm.importance}
            onChangeText={(value) => updateTaskForm('importance', value)}
            placeholder="重要度 1-5"
            keyboardType="number-pad"
            style={styles.input}
          />
          <JapaneseTextInput
            value={taskForm.difficulty}
            onChangeText={(value) => updateTaskForm('difficulty', value)}
            placeholder="難易度 1-5"
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>
        <JapaneseTextInput
          value={taskForm.progress}
          onChangeText={(value) => updateTaskForm('progress', value)}
          placeholder="進捗 0-100"
          keyboardType="number-pad"
          style={styles.input}
        />
        <View style={styles.segment}>
          {['not_started', 'in_progress', 'completed'].map((status) => (
            <Pressable
              key={status}
              style={[styles.segmentButton, taskForm.status === status && styles.segmentActive]}
              onPress={() => updateTaskForm('status', status)}
            >
              <Text
                style={[
                  styles.segmentText,
                  taskForm.status === status && styles.segmentTextActive
                ]}
              >
                {PROJECT_TASK_STATUS_LABELS[status]}
              </Text>
            </Pressable>
          ))}
        </View>
        {tasks.filter((candidate) => candidate.id !== editingTaskId).length > 0 ? (
          <View style={styles.dependencyBox}>
            <Text style={styles.fieldLabel}>前提Todo</Text>
            <View style={styles.dependencyList}>
              {tasks
                .filter((candidate) => candidate.id !== editingTaskId)
                .map((candidate) => {
                  const selected = (taskForm.dependencyTaskIds || []).includes(candidate.id);
                  return (
                    <Pressable
                      key={candidate.id}
                      style={[styles.dependencyChip, selected && styles.dependencyChipActive]}
                      onPress={() => toggleDependency(candidate.id)}
                    >
                      <Text
                        style={[
                          styles.dependencyChipText,
                          selected && styles.dependencyChipTextActive
                        ]}
                      >
                        {candidate.title}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
          </View>
        ) : null}
        <JapaneseTextInput
          value={taskForm.description}
          onChangeText={(value) => updateTaskForm('description', value)}
          placeholder="必要ならメモ"
          style={[styles.input, styles.textarea]}
          multiline
        />
        <Pressable disabled={saving === 'task'} style={styles.primaryButton} onPress={submitTask}>
          <Text style={styles.primaryText}>{saving === 'task' ? '追加中...' : 'Todoを追加'}</Text>
        </Pressable>
      </View>
    );
  }

  function renderMilestoneForm() {
    return (
      <View style={styles.form}>
        <Text style={styles.formTitle}>段階を追加</Text>
        <JapaneseTextInput
          value={milestoneForm.title}
          onChangeText={(value) => updateMilestoneForm('title', value)}
          placeholder="例: 資料集め"
          style={styles.input}
        />
        <DateWheelInput
          value={milestoneForm.deadline}
          onChange={(value) => updateMilestoneForm('deadline', value)}
          style={styles.input}
        />
        <View style={styles.segment}>
          {['not_started', 'in_progress', 'completed'].map((status) => (
            <Pressable
              key={status}
              style={[styles.segmentButton, milestoneForm.status === status && styles.segmentActive]}
              onPress={() => updateMilestoneForm('status', status)}
            >
              <Text
                style={[
                  styles.segmentText,
                  milestoneForm.status === status && styles.segmentTextActive
                ]}
              >
                {PROJECT_TASK_STATUS_LABELS[status]}
              </Text>
            </Pressable>
          ))}
        </View>
        <JapaneseTextInput
          value={milestoneForm.order}
          onChangeText={(value) => updateMilestoneForm('order', value)}
          placeholder="並び順"
          keyboardType="number-pad"
          style={styles.input}
        />
        <JapaneseTextInput
          value={milestoneForm.description}
          onChangeText={(value) => updateMilestoneForm('description', value)}
          placeholder="メモ"
          style={[styles.input, styles.textareaSmall]}
          multiline
        />
        <Pressable
          disabled={saving === 'milestone'}
          style={styles.primaryButton}
          onPress={submitMilestone}
        >
          <Text style={styles.primaryText}>
            {saving === 'milestone' ? '追加中...' : '段階を追加'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} onClose={() => setError('')} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>PROJECT</Text>
            <Text style={styles.title}>{project.name}</Text>
          </View>
          <Text style={styles.progress}>{project.progress}%</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(0, Math.min(100, project.progress))}%` }
              ]}
            />
          </View>
          <Text style={styles.meta}>
            {summary.category?.name || '未分類'} / {PROJECT_STATUS_LABELS[project.status]} / {PROJECT_PRIORITY_LABELS[project.priority]}
          </Text>
          <Text style={styles.meta}>期限 {project.deadline}</Text>
          {project.description ? <Text style={styles.body}>{project.description}</Text> : null}
          <Text style={styles.risk}>{risk.label}: {risk.message}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={() => openForm('project')}>
              <Text style={styles.secondaryText}>編集</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() =>
                toggleProjectStatus(project.status === 'paused' ? 'in_progress' : 'paused')
              }
            >
              <Text style={styles.secondaryText}>
                {project.status === 'paused' ? '再開' : '一時停止'}
              </Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => toggleProjectStatus('completed')}>
              <Text style={styles.primaryText}>完了</Text>
            </Pressable>
            <Pressable style={styles.dangerSmallButton} onPress={confirmDeleteProject}>
              <Text style={styles.dangerText}>削除</Text>
            </Pressable>
          </View>
        </View>

        {renderNextTaskCard()}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>段階とTodo</Text>
              <Text style={styles.sectionHint}>段階をフォルダ、Todoを中のファイルとして整理します。</Text>
            </View>
            <Text style={styles.sectionCount}>段階 {milestones.length} / Todo {tasks.length}</Text>
          </View>
          {milestones.length === 0 && tasks.length === 0 ? (
            <EmptyState title="まだ中身は空です" body="右下の + から段階かTodoを追加できます。" />
          ) : (
            <>
              {milestones.map(renderMilestoneFolder)}
              {renderUnassignedFolder()}
            </>
          )}
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="段階またはTodoを追加する"
        style={styles.fab}
        onPress={() => setAddMenuOpen(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <Modal animationType="fade" transparent visible={addMenuOpen}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAddMenuOpen(false)}>
          <Pressable style={styles.addSheet} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.formTitle}>追加するものを選ぶ</Text>
            <Pressable style={styles.addChoice} onPress={() => openForm('milestone')}>
              <Text style={styles.addChoiceTitle}>段階を追加</Text>
              <Text style={styles.addChoiceBody}>プロジェクトを大きな区切りに分けます。</Text>
            </Pressable>
            <Pressable style={styles.addChoice} onPress={() => openForm('task')}>
              <Text style={styles.addChoiceTitle}>Todoを追加</Text>
              <Text style={styles.addChoiceBody}>段階の中に、今日進められる作業を入れます。</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="slide" transparent visible={Boolean(activeForm)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable style={styles.modalBackdropPressable} onPress={closeForm}>
            <Pressable style={styles.formSheet} onPress={(event) => event.stopPropagation()}>
              <ScrollView keyboardShouldPersistTaps="handled">
                {activeForm === 'project'
                  ? renderProjectForm()
                  : activeForm === 'milestone'
                    ? renderMilestoneForm()
                    : renderTaskForm()}
                <Pressable style={styles.cancelWideButton} onPress={closeForm}>
                  <Text style={styles.secondaryText}>閉じる</Text>
                </Pressable>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundSoft
  },
  container: {
    padding: spacing.screen,
    gap: spacing.section,
    paddingBottom: spacing.bottomTabPadding + 28
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  headerText: {
    flex: 1
  },
  eyebrow: {
    ...typography.eyebrow
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900'
  },
  progress: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '900'
  },
  card: {
    gap: 8,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadows.card
  },
  nextCard: {
    gap: 8,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    ...shadows.soft
  },
  nextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  nextTitleWrap: {
    flex: 1
  },
  nextEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  nextTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900'
  },
  nextButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.primary
  },
  section: {
    gap: 12
  },
  sectionHeader: {
    gap: 4
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900'
  },
  sectionHint: {
    color: colors.textMuted,
    lineHeight: 20
  },
  sectionCount: {
    color: colors.primary,
    fontWeight: '900'
  },
  meta: {
    color: colors.textMuted,
    lineHeight: 20
  },
  risk: {
    color: colors.text,
    lineHeight: 20
  },
  body: {
    color: colors.textMuted,
    lineHeight: 20
  },
  progressTrack: {
    height: 7,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: colors.primary
  },
  folderCard: {
    gap: 8,
    padding: 14,
    paddingTop: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
    ...shadows.soft
  },
  folderTab: {
    position: 'absolute',
    top: 0,
    left: 14,
    width: 80,
    height: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: colors.primary
  },
  folderTabMuted: {
    position: 'absolute',
    top: 0,
    left: 14,
    width: 80,
    height: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: colors.borderStrong
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10
  },
  folderTitleWrap: {
    flex: 1,
    gap: 5
  },
  folderLabel: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    fontSize: 12,
    fontWeight: '900'
  },
  folderTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  fileList: {
    gap: 8,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.primarySoft
  },
  todoFile: {
    gap: 7,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft
  },
  todoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10
  },
  todoTitleWrap: {
    flex: 1,
    gap: 4
  },
  fileLabel: {
    alignSelf: 'flex-start',
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  todoTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900'
  },
  badge: {
    color: colors.primary,
    fontWeight: '900'
  },
  emptyFolder: {
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.backgroundSoft
  },
  emptyFolderTitle: {
    color: colors.text,
    fontWeight: '900'
  },
  emptyFolderBody: {
    color: colors.textMuted,
    lineHeight: 20
  },
  form: {
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadows.soft
  },
  formTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900'
  },
  input: {
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 15
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900'
  },
  formGridTwo: {
    flexDirection: 'row',
    gap: 8
  },
  textarea: {
    minHeight: 82,
    textAlignVertical: 'top'
  },
  textareaSmall: {
    minHeight: 70,
    textAlignVertical: 'top'
  },
  segmentScroll: {
    marginHorizontal: -2
  },
  segmentScrollContent: {
    gap: 8,
    paddingHorizontal: 2
  },
  segment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  segmentButton: {
    flex: 1,
    minWidth: 92,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center'
  },
  milestoneSegmentButton: {
    minWidth: 130,
    maxWidth: 190
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  segmentText: {
    color: colors.primary,
    fontWeight: '800'
  },
  segmentTextActive: {
    color: '#FFFFFF'
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  todoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  primaryButton: {
    flex: 1,
    padding: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    backgroundColor: colors.primary
  },
  primarySmallButton: {
    minWidth: 84,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    backgroundColor: colors.primary
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  secondaryButton: {
    flex: 1,
    padding: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  secondarySmallButton: {
    minWidth: 112,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: '900'
  },
  textButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  dependencyBox: {
    gap: 8,
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft
  },
  dependencyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  dependencyChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  },
  dependencyChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  dependencyChipText: {
    color: colors.primary,
    fontWeight: '800'
  },
  dependencyChipTextActive: {
    color: '#FFFFFF'
  },
  dangerSmallButton: {
    minWidth: 74,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E3B4B4',
    backgroundColor: colors.dangerSoft
  },
  dangerText: {
    color: colors.dangerText,
    fontWeight: '900'
  },
  deleteTextButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#E3B4B4',
    backgroundColor: colors.dangerSoft
  },
  deleteText: {
    color: colors.dangerText,
    fontWeight: '900'
  },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 28,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    ...shadows.card
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 38
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(31, 47, 37, 0.32)'
  },
  modalBackdropPressable: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  addSheet: {
    gap: 10,
    padding: 18,
    paddingBottom: 28,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.card
  },
  addChoice: {
    gap: 4,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft
  },
  addChoiceTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900'
  },
  addChoiceBody: {
    color: colors.textMuted,
    lineHeight: 20
  },
  formSheet: {
    maxHeight: '86%',
    padding: 14,
    paddingBottom: 24,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.backgroundSoft
  },
  cancelWideButton: {
    marginTop: 10,
    alignItems: 'center',
    padding: 13,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card
  }
});

module.exports = ProjectDetailScreen;
