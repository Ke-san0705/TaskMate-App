import { useCallback, useEffect, useState } from 'react';

const FALLBACK_BEHAVIOR = {
  version: '1.1.0',
  mood: 'calm',
  action: 'idle',
  dialogueCategory: 'calm',
  dialogueVariables: {},
  targetTaskId: null,
  focusTaskId: null,
  focusTask: null,
  pressure: {
    score: 0,
    level: 'calm',
    dominantReason: 'loading',
    dominantTaskId: null,
    counts: { future: 0, calm: 0, warning: 0, urgent: 0, overdue: 0 },
    taskStates: {}
  },
  ambientLevel: 0,
  movement: null,
  reason: 'loading',
  relationshipStage: 'new'
};

export default function useCharacterBehavior() {
  const [behavior, setBehavior] = useState(FALLBACK_BEHAVIOR);

  useEffect(() => {
    let mounted = true;
    window.taskMate
      .getBehaviorState()
      .then((state) => {
        if (mounted && state) {
          setBehavior(state);
        }
      })
      .catch(() => {
        if (mounted) {
          setBehavior(FALLBACK_BEHAVIOR);
        }
      });

    const unsubscribe = window.taskMate.onBehaviorUpdated((next) => {
      if (mounted && next) {
        setBehavior(next);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const recordInteraction = useCallback((type, details = {}) => {
    return window.taskMate.recordInteraction(type, details).catch(() => null);
  }, []);

  const setFocusTask = useCallback(async (taskId) => {
    const next = await window.taskMate.setFocusTask(taskId);
    if (next) {
      setBehavior(next);
    }
    return next;
  }, []);

  const clearFocusTask = useCallback(async () => {
    const next = await window.taskMate.clearFocusTask();
    if (next) {
      setBehavior(next);
    }
    return next;
  }, []);

  const resetLifeState = useCallback(async () => {
    const next = await window.taskMate.resetLifeState();
    if (next) {
      setBehavior(next);
    }
    return next;
  }, []);

  return {
    behavior,
    recordInteraction,
    setFocusTask,
    clearFocusTask,
    resetLifeState
  };
}
