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
          if (
            TaskMateRestrictionPolicy.isNeverBlockedPackage(reactContext, packageName) ||
            !seen.add(packageName)
          ) {
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
  fun isUsageAccessEnabled(promise: Promise) {
    promise.resolve(TaskMateRestrictionPolicy.hasUsageAccess(reactContext))
  }

  @ReactMethod
  fun openUsageAccessSettings(promise: Promise) {
    openSettings(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS), promise)
  }

  @ReactMethod
  fun setFocusMonitorState(
    active: Boolean,
    taskTitle: String,
    startedAtMillis: Double,
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
      val editor = prefs.edit()
        .putBoolean(KEY_ACTIVE, active)
        .putString(KEY_TASK_TITLE, taskTitle)
        .putStringSet(KEY_BLOCKED_PACKAGES, packages)
        .putStringSet(KEY_BLOCKED_NAMES, names)
        .putLong(KEY_UPDATED_AT, System.currentTimeMillis())
      if (active && startedAtMillis > 0) {
        editor.putLong(KEY_STARTED_AT_MILLIS, startedAtMillis.toLong())
      } else if (!active) {
        editor.remove(KEY_STARTED_AT_MILLIS)
      }
      editor.apply()
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

  @ReactMethod
  fun setWidgetPresentation(
    characterId: String,
    characterImageUri: String,
    motivationMessage: String,
    motivationDate: String,
    promise: Promise
  ) {
    try {
      reactContext.getSharedPreferences(FOCUS_PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_WIDGET_CHARACTER_ID, characterId)
        .putString(KEY_WIDGET_CHARACTER_IMAGE_URI, characterImageUri)
        .putString(KEY_WIDGET_MOTIVATION_MESSAGE, motivationMessage)
        .putString(KEY_WIDGET_MOTIVATION_DATE, motivationDate)
        .putLong(KEY_WIDGET_PRESENTATION_UPDATED_AT, System.currentTimeMillis())
        .apply()
      TaskMateWidgetProvider.updateAll(reactContext)
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject("taskmate_widget_presentation_failed", error)
    }
  }

  @ReactMethod
  fun setUnlockMonitorState(
    enabled: Boolean,
    requiredMinutes: Double,
    requirementPackages: ReadableArray,
    requirementAppNames: ReadableArray,
    blockedPackages: ReadableArray,
    blockedAppNames: ReadableArray,
    promise: Promise
  ) {
    try {
      val requirements = linkedSetOf<String>()
      val requirementNames = linkedSetOf<String>()
      for (index in 0 until requirementPackages.size()) {
        requirementPackages.getString(index)?.takeIf { it.isNotBlank() }?.let {
          requirements.add(it)
        }
      }
      for (index in 0 until requirementAppNames.size()) {
        requirementAppNames.getString(index)?.takeIf { it.isNotBlank() }?.let {
          requirementNames.add(it)
        }
      }

      val blocked = linkedSetOf<String>()
      val names = linkedSetOf<String>()
      for (index in 0 until blockedPackages.size()) {
        blockedPackages.getString(index)?.takeIf { it.isNotBlank() }?.let { packageName ->
          if (
            !TaskMateRestrictionPolicy.isNeverBlockedPackage(reactContext, packageName) &&
            !requirements.contains(packageName)
          ) {
            blocked.add(packageName)
          }
        }
      }
      for (index in 0 until blockedAppNames.size()) {
        blockedAppNames.getString(index)?.takeIf { it.isNotBlank() }?.let { names.add(it) }
      }

      reactContext.getSharedPreferences(FOCUS_PREFS, Context.MODE_PRIVATE)
        .edit()
        .putBoolean(KEY_UNLOCK_ENABLED, enabled)
        .putInt(KEY_UNLOCK_REQUIRED_MINUTES, requiredMinutes.toInt().coerceIn(1, 12 * 60))
        .putStringSet(KEY_UNLOCK_REQUIREMENT_PACKAGES, requirements)
        .putStringSet(KEY_UNLOCK_REQUIREMENT_NAMES, requirementNames)
        .putStringSet(KEY_UNLOCK_BLOCKED_PACKAGES, blocked)
        .putStringSet(KEY_UNLOCK_BLOCKED_NAMES, names)
        .putLong(KEY_UNLOCK_UPDATED_AT, System.currentTimeMillis())
        .apply()
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject("taskmate_unlock_state_failed", error)
    }
  }

  @ReactMethod
  fun getUnlockModeStatus(promise: Promise) {
    try {
      val status = TaskMateRestrictionPolicy.readUnlockStatus(reactContext)
      val result = Arguments.createMap()
      result.putBoolean("enabled", status.enabled)
      result.putString("state", status.state)
      result.putBoolean("usageAccessGranted", status.usageAccessGranted)
      result.putDouble("totalUsageMillis", status.totalUsageMillis.toDouble())
      result.putDouble("requiredMillis", status.requiredMillis.toDouble())
      result.putDouble("remainingMillis", status.remainingMillis.toDouble())
      result.putDouble("progressRatio", status.progressRatio)
      result.putString("dateKey", status.dateKey)
      promise.resolve(result)
    } catch (error: Throwable) {
      promise.reject("taskmate_unlock_status_failed", error)
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
    const val KEY_STARTED_AT_MILLIS = "started_at_millis"
    const val KEY_UPDATED_AT = "updated_at"
    const val KEY_UNLOCK_ENABLED = "unlock_enabled"
    const val KEY_UNLOCK_REQUIRED_MINUTES = "unlock_required_minutes"
    const val KEY_UNLOCK_REQUIREMENT_PACKAGES = "unlock_requirement_packages"
    const val KEY_UNLOCK_REQUIREMENT_NAMES = "unlock_requirement_names"
    const val KEY_UNLOCK_BLOCKED_PACKAGES = "unlock_blocked_packages"
    const val KEY_UNLOCK_BLOCKED_NAMES = "unlock_blocked_names"
    const val KEY_UNLOCK_UPDATED_AT = "unlock_updated_at"
    const val KEY_WIDGET_CHARACTER_ID = "widget_character_id"
    const val KEY_WIDGET_CHARACTER_IMAGE_URI = "widget_character_image_uri"
    const val KEY_WIDGET_MOTIVATION_MESSAGE = "widget_motivation_message"
    const val KEY_WIDGET_MOTIVATION_DATE = "widget_motivation_date"
    const val KEY_WIDGET_PRESENTATION_UPDATED_AT = "widget_presentation_updated_at"
  }
}
