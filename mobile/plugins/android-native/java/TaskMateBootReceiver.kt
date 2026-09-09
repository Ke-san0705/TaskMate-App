package com.taskmate.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class TaskMateBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
      TaskMateWidgetProvider.updateAll(context)
    }
  }
}
