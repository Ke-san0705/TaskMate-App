const React = require('react');
const TaskForm = require('../components/TaskForm');
const { useTaskMate } = require('../context/TaskMateContext');

function TaskEditScreen({ navigation, route }) {
  const { createTask, tasks, updateTask } = useTaskMate();
  const taskId = route.params?.taskId;
  const task = tasks.find((candidate) => candidate.id === taskId) || null;

  return (
    <TaskForm
      task={task}
      onSubmit={async (input) => {
        if (task) {
          await updateTask(task.id, input);
        } else {
          await createTask(input);
        }
        navigation.goBack();
      }}
      onCancel={() => navigation.goBack()}
    />
  );
}

module.exports = TaskEditScreen;
