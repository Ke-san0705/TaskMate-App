import { useCallback, useEffect, useState } from 'react';

export default function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyResult = useCallback((result) => {
    setTasks(Array.isArray(result?.tasks) ? result.tasks : []);
    setError(result?.error || null);
    setLoading(false);
  }, []);

  const reloadTasks = useCallback(async () => {
    const result = await window.taskMate.reloadTasks();
    applyResult(result);
    return result;
  }, [applyResult]);

  useEffect(() => {
    let mounted = true;
    window.taskMate
      .getTasks()
      .then((result) => {
        if (mounted) {
          applyResult(result);
        }
      })
      .catch((loadError) => {
        if (mounted) {
          setError(loadError.message);
          setLoading(false);
        }
      });
    const unsubscribe = window.taskMate.onTasksUpdated((result) => {
      if (mounted) {
        applyResult(result);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [applyResult]);

  async function completeTask(taskId) {
    return window.taskMate.completeTask(taskId);
  }

  async function undoCompleteTask(taskId) {
    return window.taskMate.undoCompleteTask(taskId);
  }

  return {
    tasks,
    error,
    loading,
    completeTask,
    undoCompleteTask,
    reloadTasks
  };
}
