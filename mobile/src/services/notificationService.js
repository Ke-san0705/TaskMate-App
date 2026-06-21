const { Platform } = require('react-native');
const Notifications = require('expo-notifications');
const { NOTIFICATION_CHANNEL_ID } = require('../constants/defaults');
const {
  listNotificationSchedules,
  replaceNotificationSchedules
} = require('../repositories/notificationScheduleRepository');
const { reconcileScheduledNotifications } = require('./notificationReconciler');
const { log, warn } = require('../utils/logger');

let handlerConfigured = false;

async function configureNotifications() {
  if (!handlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false
      })
    });
    handlerConfigured = true;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'TaskMate deadlines',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 160, 120, 160],
      lightColor: '#7A8F7A'
    });
  }
}

async function getNotificationPermissionStatus() {
  const permission = await Notifications.getPermissionsAsync();
  return permission.status;
}

async function requestNotificationPermission() {
  await configureNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function cancelAllKnownNotifications() {
  const schedules = await listNotificationSchedules();
  for (const schedule of schedules) {
    try {
      await Notifications.cancelScheduledNotificationAsync(schedule.notificationId);
    } catch (error) {
      warn('Notifications', 'cancel scheduled notification failed', error);
    }
  }
  await replaceNotificationSchedules([]);
}

function createAdapter() {
  return {
    cancel: (notificationId) =>
      Notifications.cancelScheduledNotificationAsync(notificationId),
    schedule: async (schedule) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'TaskMate',
          body:
            schedule.minutes > 0
              ? `「${schedule.title}」まで、あと${schedule.minutes}分です。`
              : `「${schedule.title}」の時間になりました。`,
          data: {
            taskId: schedule.taskId,
            signature: schedule.signature,
            source: 'taskmate'
          },
          sound: false
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(schedule.scheduledAt),
          channelId: NOTIFICATION_CHANNEL_ID
        }
      })
  };
}

async function reconcileNotifications(tasks, settings, now = new Date()) {
  await configureNotifications();
  if (settings.notificationsEnabled === false) {
    await cancelAllKnownNotifications();
    log('Notifications', 'disabled and cleared');
    return { schedules: [], scheduled: [], canceled: [], errors: [] };
  }

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    // 権限拒否時もタスク管理は止めません。通知予定DBだけ整理し、設定画面から再要求できます。
    await replaceNotificationSchedules([]);
    return { schedules: [], scheduled: [], canceled: [], errors: ['permission-denied'] };
  }

  const existingSchedules = await listNotificationSchedules();
  const result = await reconcileScheduledNotifications({
    tasks,
    settings,
    existingSchedules,
    adapter: createAdapter(),
    now
  });
  await replaceNotificationSchedules(result.schedules);
  log('Notifications', 'reconciled', {
    scheduled: result.scheduled.length,
    canceled: result.canceled.length,
    errors: result.errors.length
  });
  return result;
}

function addNotificationResponseListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

module.exports = {
  addNotificationResponseListener,
  cancelAllKnownNotifications,
  configureNotifications,
  getNotificationPermissionStatus,
  reconcileNotifications,
  requestNotificationPermission
};
