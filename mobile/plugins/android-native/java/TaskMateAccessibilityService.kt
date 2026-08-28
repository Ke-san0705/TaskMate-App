package com.taskmate.mobile

import android.accessibilityservice.AccessibilityService
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.view.accessibility.AccessibilityEvent

class TaskMateAccessibilityService : AccessibilityService() {
  private var lastInterventionAt = 0L

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
      return
    }
    val packageName = event.packageName?.toString() ?: return
    if (packageName == this.packageName) {
      return
    }
    val prefs = getSharedPreferences(TaskMateFocusModule.FOCUS_PREFS, Context.MODE_PRIVATE)
    if (!prefs.getBoolean(TaskMateFocusModule.KEY_ACTIVE, false)) {
      return
    }
    val blocked = prefs.getStringSet(TaskMateFocusModule.KEY_BLOCKED_PACKAGES, emptySet())
      ?: emptySet()
    if (!blocked.contains(packageName)) {
      return
    }
    val now = System.currentTimeMillis()
    if (now - lastInterventionAt < 1500) {
      return
    }
    lastInterventionAt = now
    performGlobalAction(GLOBAL_ACTION_BACK)
    openTaskMate(packageName)
    showFocusNotification()
  }

  override fun onInterrupt() = Unit

  private fun openTaskMate(packageName: String) {
    try {
      val intent = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("taskmate://focus-blocked?package=${Uri.encode(packageName)}")
      )
      intent.setPackage(this.packageName)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      startActivity(intent)
    } catch (_: Throwable) {
      performGlobalAction(GLOBAL_ACTION_HOME)
    }
  }

  private fun showFocusNotification() {
    val title = getSharedPreferences(TaskMateFocusModule.FOCUS_PREFS, Context.MODE_PRIVATE)
      .getString(TaskMateFocusModule.KEY_TASK_TITLE, "")
      .orEmpty()
      .ifBlank { "今やるタスク" }
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          getString(R.string.taskmate_focus_channel_name),
          NotificationManager.IMPORTANCE_DEFAULT
        )
      )
    }
    val launchIntent = Intent(
      Intent.ACTION_VIEW,
      Uri.parse("taskmate://focus-blocked")
    ).apply {
      setPackage(packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    val pendingIntent = PendingIntent.getActivity(
      this,
      42,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    @Suppress("DEPRECATION")
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      Notification.Builder(this)
    }
    val notification = builder
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(getString(R.string.taskmate_focus_notification_title))
      .setContentText(getString(R.string.taskmate_focus_notification_body, title))
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .build()
    manager.notify(FOCUS_NOTIFICATION_ID, notification)
  }

  companion object {
    private const val CHANNEL_ID = "taskmate-focus"
    private const val FOCUS_NOTIFICATION_ID = 2104
  }
}
