import { useEffect, useMemo, useState } from 'react';
import { getLocalDateKey } from '../utils/dateUtils';

function eventTime(event) {
  if (event.allDay) {
    return '終日';
  }
  return event.time || '時刻なし';
}

export default function GoogleCalendarToday({ onTaskCreated }) {
  const [status, setStatus] = useState(null);
  const [busyKey, setBusyKey] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    window.taskMate
      .getGoogleCalendarStatus()
      .then((next) => {
        if (mounted) {
          setStatus(next);
        }
      })
      .catch(() => null);
    const unsubscribe = window.taskMate.onGoogleCalendarUpdated((next) => {
      if (mounted) {
        setStatus(next);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const todayEvents = useMemo(() => {
    const today = getLocalDateKey();
    return (status?.events || []).filter((event) => event.date === today).slice(0, 5);
  }, [status?.events]);

  if (
    !status?.connected ||
    status.settings?.showTodayOnHome === false ||
    todayEvents.length === 0
  ) {
    return null;
  }

  async function createTask(event) {
    if (event.taskId) {
      return;
    }
    setBusyKey(event.key);
    setMessage('');
    try {
      const result = await window.taskMate.createTaskFromGoogleEvent(event.key);
      setStatus(result.status);
      setMessage('TaskMateタスクに追加しました。');
      onTaskCreated?.(result.task);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyKey('');
    }
  }

  return (
    <section className="google-calendar-today" aria-label="今日のGoogleカレンダー予定">
      <header>
        <div>
          <span>GOOGLE CALENDAR</span>
          <strong>今日の予定</strong>
        </div>
        <small>{todayEvents.length}</small>
      </header>
      <div className="google-calendar-today__list">
        {todayEvents.map((event) => (
          <article key={event.key}>
            <time>{eventTime(event)}</time>
            <div>
              <strong>{event.title}</strong>
              <small>{event.calendarSummary}</small>
            </div>
            <button
              type="button"
              disabled={Boolean(event.taskId) || busyKey === event.key}
              onClick={() => createTask(event)}
            >
              {event.taskId ? '作成済み' : busyKey === event.key ? '追加中...' : 'タスク化'}
            </button>
          </article>
        ))}
      </div>
      {message && <p>{message}</p>}
    </section>
  );
}
