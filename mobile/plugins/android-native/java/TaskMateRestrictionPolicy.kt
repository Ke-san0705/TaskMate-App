package com.taskmate.mobile

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

object TaskMateRestrictionPolicy {
  const val REASON_FOCUS = "focus"
  const val REASON_UNLOCK = "unlock"

  private val neverBlockedPackageNames = setOf(
    "android",
    "com.android.settings",
    "com.android.systemui",
    "com.android.phone",
    "com.android.dialer",
    "com.google.android.dialer",
    "com.google.android.apps.safetycenter",
    "com.google.android.permissioncontroller"
  )

  private val neverBlockedPackageParts = listOf(
    ".launcher",
    ".emergency",
    ".incallui",
    ".telecom"
  )

  fun isNeverBlockedPackage(context: Context, packageName: String): Boolean {
    val normalized = packageName.trim().lowercase()
    if (normalized.isBlank()) {
      return true
    }
    if (normalized == context.packageName.lowercase()) {
      return true
    }
    if (neverBlockedPackageNames.contains(normalized)) {
      return true
    }
    if (neverBlockedPackageParts.any { normalized.contains(it) }) {
      return true
    }
    return defaultHomePackages(context).contains(normalized)
  }

  fun evaluate(context: Context, packageName: String): BlockDecision? {
    if (isNeverBlockedPackage(context, packageName)) {
      return null
    }
    val prefs = context.getSharedPreferences(TaskMateFocusModule.FOCUS_PREFS, Context.MODE_PRIVATE)
    val focusBlocked = prefs.getStringSet(TaskMateFocusModule.KEY_BLOCKED_PACKAGES, emptySet())
      ?: emptySet()
    if (
      prefs.getBoolean(TaskMateFocusModule.KEY_ACTIVE, false) &&
      focusBlocked.contains(packageName)
    ) {
      return BlockDecision(REASON_FOCUS)
    }

    val unlockBlocked = prefs.getStringSet(TaskMateFocusModule.KEY_UNLOCK_BLOCKED_PACKAGES, emptySet())
      ?: emptySet()
    if (
      prefs.getBoolean(TaskMateFocusModule.KEY_UNLOCK_ENABLED, false) &&
      unlockBlocked.contains(packageName) &&
      !readUnlockStatus(context, prefs).unlocked
    ) {
      return BlockDecision(REASON_UNLOCK)
    }
    return null
  }

  fun readUnlockStatus(context: Context): UnlockStatus {
    val prefs = context.getSharedPreferences(TaskMateFocusModule.FOCUS_PREFS, Context.MODE_PRIVATE)
    return readUnlockStatus(context, prefs)
  }

  fun readUnlockStatus(context: Context, prefs: SharedPreferences): UnlockStatus {
    val requiredMinutes = prefs.getInt(TaskMateFocusModule.KEY_UNLOCK_REQUIRED_MINUTES, 30)
      .coerceIn(1, 12 * 60)
    val requiredMillis = requiredMinutes * 60L * 1000L
    val enabled = prefs.getBoolean(TaskMateFocusModule.KEY_UNLOCK_ENABLED, false)
    val usageAccessGranted = hasUsageAccess(context)
    val requirementPackages =
      prefs.getStringSet(TaskMateFocusModule.KEY_UNLOCK_REQUIREMENT_PACKAGES, emptySet())
        ?: emptySet()
    val totalUsageMillis = if (enabled && usageAccessGranted) {
      todayUsageMillis(context, requirementPackages)
    } else {
      0L
    }
    val unlocked = enabled && usageAccessGranted && totalUsageMillis >= requiredMillis
    val state = when {
      !enabled -> "disabled"
      !usageAccessGranted -> "permission_required"
      unlocked -> "unlocked"
      else -> "locked"
    }
    return UnlockStatus(
      enabled = enabled,
      state = state,
      usageAccessGranted = usageAccessGranted,
      totalUsageMillis = totalUsageMillis,
      requiredMillis = requiredMillis,
      remainingMillis = (requiredMillis - totalUsageMillis).coerceAtLeast(0L),
      progressRatio = if (requiredMillis > 0L) {
        (totalUsageMillis.toDouble() / requiredMillis.toDouble()).coerceIn(0.0, 1.0)
      } else {
        1.0
      },
      dateKey = localDateKey()
    )
  }

  fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        android.os.Process.myUid(),
        context.packageName
      )
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        android.os.Process.myUid(),
        context.packageName
      )
    }
    if (mode == AppOpsManager.MODE_ALLOWED) {
      return true
    }
    if (mode == AppOpsManager.MODE_DEFAULT) {
      return context.checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) ==
        PackageManager.PERMISSION_GRANTED
    }
    return false
  }

  fun todayUsageMillis(context: Context, packageNames: Set<String>): Long {
    if (packageNames.isEmpty() || !hasUsageAccess(context)) {
      return 0L
    }
    val usageStatsManager =
      context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val end = System.currentTimeMillis()
    val start = startOfTodayMillis()
    return try {
      val stats = usageStatsManager.queryAndAggregateUsageStats(start, end)
      packageNames.sumOf { packageName ->
        stats[packageName]?.totalTimeInForeground ?: 0L
      }
    } catch (_: Throwable) {
      0L
    }
  }

  fun defaultHomePackages(context: Context): Set<String> {
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
    val resolveInfos = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.packageManager.queryIntentActivities(
        intent,
        PackageManager.ResolveInfoFlags.of(0)
      )
    } else {
      @Suppress("DEPRECATION")
      context.packageManager.queryIntentActivities(intent, 0)
    }
    return resolveInfos
      .mapNotNull { it.activityInfo?.packageName?.lowercase() }
      .toSet()
  }

  private fun startOfTodayMillis(): Long {
    return Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }.timeInMillis
  }

  private fun localDateKey(): String {
    return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().time)
  }
}

data class BlockDecision(
  val reason: String
)

data class UnlockStatus(
  val enabled: Boolean,
  val state: String,
  val usageAccessGranted: Boolean,
  val totalUsageMillis: Long,
  val requiredMillis: Long,
  val remainingMillis: Long,
  val progressRatio: Double,
  val dateKey: String,
) {
  val unlocked: Boolean
    get() = state == "unlocked"
}
