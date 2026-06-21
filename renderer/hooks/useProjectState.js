import { useCallback, useEffect, useState } from 'react';

const EMPTY_STATE = {
  categories: [],
  projects: [],
  milestones: [],
  projectTasks: [],
  error: null
};

export default function useProjectState() {
  const [state, setState] = useState(EMPTY_STATE);
  const [loading, setLoading] = useState(true);

  const applyState = useCallback((result) => {
    setState({
      categories: Array.isArray(result?.categories) ? result.categories : [],
      projects: Array.isArray(result?.projects) ? result.projects : [],
      milestones: Array.isArray(result?.milestones) ? result.milestones : [],
      projectTasks: Array.isArray(result?.projectTasks) ? result.projectTasks : [],
      error: result?.error || null
    });
    setLoading(false);
  }, []);

  const reload = useCallback(async () => {
    const result = await window.taskMate.getProjectState();
    applyState(result);
    return result;
  }, [applyState]);

  useEffect(() => {
    let mounted = true;
    window.taskMate
      .getProjectState()
      .then((result) => {
        if (mounted) {
          applyState(result);
        }
      })
      .catch((error) => {
        if (mounted) {
          setState({ ...EMPTY_STATE, error: error.message });
          setLoading(false);
        }
      });
    const unsubscribe = window.taskMate.onProjectsUpdated((result) => {
      if (mounted) {
        applyState(result);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [applyState]);

  return {
    ...state,
    loading,
    reload,
    createCategory: window.taskMate.createProjectCategory,
    updateCategory: window.taskMate.updateProjectCategory,
    deleteCategory: window.taskMate.deleteProjectCategory,
    createProject: window.taskMate.createProject,
    updateProject: window.taskMate.updateProject,
    deleteProject: window.taskMate.deleteProject,
    createMilestone: window.taskMate.createProjectMilestone,
    updateMilestone: window.taskMate.updateProjectMilestone,
    deleteMilestone: window.taskMate.deleteProjectMilestone,
    createProjectTask: window.taskMate.createProjectTask,
    updateProjectTask: window.taskMate.updateProjectTask,
    deleteProjectTask: window.taskMate.deleteProjectTask,
    completeProjectTask: window.taskMate.completeProjectTask,
    addProjectTaskToToday: window.taskMate.addProjectTaskToToday
  };
}
