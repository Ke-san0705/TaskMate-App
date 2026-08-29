package com.taskmate.mobile

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

class TaskMateFocusModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "TaskMateFocus"

  @ReactMethod
  fun listInstalledApps(promise: Promise) {
    try {
      val launchIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val packageManager = reactContext.packageManager
      val resolveInfos = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        packageManager.queryIntentActivities(
          launchIntent,
          PackageManager.ResolveInfoFlags.of(0)
        )
      } else {
        @Suppress("DEPRECATION")
        packageManager.queryIntentActivities(launchIntent, 0)
      }
      val seen = linkedSetOf<String>()
      val apps = resolveInfos
        .mapNotNull { info ->
          val packageName = info.activityInfo?.packageName ?: return@mapNotNull null
          if (packageName == reactContext.packageName || !seen.add(packageName)) {
            return@mapNotNull null
          }
          val appName = info.loadLabel(packageManager)?.toString()?.trim().orEmpty()
          packageName to (appName.ifBlank { packageName })
        }
        .sortedBy { it.second.lowercase() }

      val result = Arguments.createArray()
      for ((packageName, appName) in apps) {
        val item = Arguments.createMap()
        item.putString("packageName", packageName)
        item.putString("appName", appName)
        result.pushMap(item)
      }
      promise.resolve(result)
    } catch (error: Throwable) {
      promise.reject("taskmate_apps_failed", error)
    }
  }

  @ReactMethod
  fun isAccessibilityServiceEnabled(promise: Promise) {
    promise.resolve(isAccessibilityEnabled())
  }

  @ReactMethod
  fun openAccessibilitySettings(promise: Promise) {
    openSettings(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS), promise)
  }

  @ReactMethod
  fun setFocusMonitorState(
    active: Boolean,
    taskTitle: String,
    blockedPackages: ReadableArray,
    blockedAppNames: ReadableArray,
    promise: Promise
  ) {
    try {
      val packages = linkedSetOf<String>()
      for (index in 0 until blockedPackages.size()) {
        blockedPackages.getString(index)?.takeIf { it.isNotBlank() }?.let { packages.add(it) }
      }
      val names = linkedSetOf<String>()
      for (index in 0 until blockedAppNames.size()) {
        blockedAppNames.getString(index)?.takeIf { it.isNotBlank() }?.let { names.add(it) }
      }
      val prefs = reactContext.getSharedPreferences(FOCUS_PREFS, Context.MODE_PRIVATE)
      prefs.edit()
        .putBoolean(KEY_ACTIVE, active)
        .putString(KEY_TASK_TITLE, taskTitle)
        .putStringSet(KEY_BLOCKED_PACKAGES, packages)
        .putStringSet(KEY_BLOCKED_NAMES, names)
        .putLong(KEY_UPDATED_AT, System.currentTimeMillis())
        .apply()
      TaskMateWidgetProvider.updateAll(reactContext)
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject("taskmate_focus_state_failed", error)
    }
  }

  @ReactMethod
  fun updateWidget(promise: Promise) {
    try {
      TaskMateWidgetProvider.updateAll(reactContext)
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject("taskmate_widget_update_failed", error)
    }
  }

  private fun openSettings(intent: Intent, promise: Promise) {
    try {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject("taskmate_settings_failed", error)
    }
  }

  private fun isAccessibilityEnabled(): Boolean {
    val expected = "${reactContext.packageName}/${TaskMateAccessibilityService::class.java.name}"
    val enabled = Settings.Secure.getString(
      reactContext.contentResolver,
      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
    ) ?: return false
    val splitter = TextUtils.SimpleStringSplitter(':')
    splitter.setString(enabled)
    for (service in splitter) {
      if (service.equals(expected, ignoreCase = true)) {
        return true
      }
    }
    return false
  }

  companion object {
    const val FOCUS_PREFS = "taskmate_focus"
    const val KEY_ACTIVE = "active"
    const val KEY_TASK_TITLE = "task_title"
    const val KEY_BLOCKED_PACKAGES = "blocked_packages"
    const val KEY_BLOCKED_NAMES = "blocked_names"
    const val KEY_UPDATED_AT = "updated_at"
  }
}
