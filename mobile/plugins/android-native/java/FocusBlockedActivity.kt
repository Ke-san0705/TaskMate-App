package com.taskmate.mobile

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.Window
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.max

class FocusBlockedActivity : Activity() {
  private val handler = Handler(Looper.getMainLooper())
  private var timerText: TextView? = null
  private var startedAtMillis = 0L
  private var blockedReason = TaskMateRestrictionPolicy.REASON_FOCUS

  private val tick = object : Runnable {
    override fun run() {
      timerText?.text = formatElapsed(startedAtMillis)
      handler.postDelayed(this, 1000)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    requestWindowFeature(Window.FEATURE_NO_TITLE)
    super.onCreate(savedInstanceState)
    window.statusBarColor = Color.TRANSPARENT
    window.navigationBarColor = Color.parseColor("#101812")

    renderFromIntent(intent)
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    if (intent != null) {
      setIntent(intent)
    }
    renderFromIntent(intent ?: this.intent)
  }

  private fun renderFromIntent(sourceIntent: Intent?) {
    timerText = null
    val blockedPackageName = sourceIntent?.getStringExtra(EXTRA_PACKAGE_NAME).orEmpty()
    blockedReason = sourceIntent?.getStringExtra(EXTRA_REASON)
      ?.takeIf { it == TaskMateRestrictionPolicy.REASON_UNLOCK }
      ?: TaskMateRestrictionPolicy.REASON_FOCUS
    val prefs = getSharedPreferences(TaskMateFocusModule.FOCUS_PREFS, Context.MODE_PRIVATE)
    val taskTitle = prefs.getString(TaskMateFocusModule.KEY_TASK_TITLE, "")
      .orEmpty()
      .ifBlank { getString(R.string.taskmate_block_default_task) }
    startedAtMillis = prefs.getLong(TaskMateFocusModule.KEY_STARTED_AT_MILLIS, 0L)

    val appDetails = resolveAppDetails(blockedPackageName)
    val unlockStatus = TaskMateRestrictionPolicy.readUnlockStatus(this, prefs)
    val requirementNames = prefs
      .getStringSet(TaskMateFocusModule.KEY_UNLOCK_REQUIREMENT_NAMES, emptySet())
      ?.filter { it.isNotBlank() }
      ?: emptyList()
    setContentView(
      createContent(
        appDetails.name,
        appDetails.icon,
        taskTitle,
        blockedReason,
        unlockStatus,
        requirementNames
      )
    )
  }

  override fun onResume() {
    super.onResume()
    handler.removeCallbacks(tick)
    tick.run()
  }

  override fun onPause() {
    handler.removeCallbacks(tick)
    super.onPause()
  }

  override fun onDestroy() {
    handler.removeCallbacks(tick)
    super.onDestroy()
  }

  @Deprecated("Deprecated in Android SDK")
  override fun onBackPressed() {
    returnToTaskMate()
  }

  private fun createContent(
    appName: String,
    appIcon: Drawable?,
    taskTitle: String,
    reason: String,
    unlockStatus: UnlockStatus,
    requirementNames: List<String>
  ): View {
    val root = FrameLayout(this).apply {
      setBackgroundColor(Color.parseColor("#111A14"))
      setPadding(dp(22), dp(24), dp(22), dp(24))
    }

    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(22), dp(24), dp(22), dp(24))
      background = rounded(Color.parseColor("#F6FAF4"), dp(24), Color.parseColor("#D9E6D7"), dp(1))
    }
    root.addView(
      card,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
        Gravity.CENTER
      )
    )

    val brand = TextView(this).apply {
      text = getString(R.string.taskmate_block_brand)
      setTextColor(Color.parseColor("#5F7165"))
      textSize = 13f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      includeFontPadding = false
    }
    card.addView(brand, verticalParams())

    val iconWrap = FrameLayout(this).apply {
      background = rounded(Color.WHITE, dp(22), Color.parseColor("#D9E6D7"), dp(1))
      setPadding(dp(14), dp(14), dp(14), dp(14))
    }
    val icon = ImageView(this).apply {
      setImageDrawable(appIcon ?: getDrawableCompat(R.mipmap.ic_launcher))
      contentDescription = appName
    }
    iconWrap.addView(
      icon,
      FrameLayout.LayoutParams(dp(58), dp(58), Gravity.CENTER)
    )
    card.addView(iconWrap, verticalParams(top = 18, width = 92, height = 92))

    val appNameText = TextView(this).apply {
      text = appName
      setTextColor(Color.parseColor("#1D2B22"))
      textSize = 32f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      includeFontPadding = false
    }
    card.addView(appNameText, verticalParams(top = 18))

    val blockedLabel = TextView(this).apply {
      text = if (reason == TaskMateRestrictionPolicy.REASON_UNLOCK) {
        getString(R.string.taskmate_unlock_block_title)
      } else {
        getString(R.string.taskmate_block_restricted)
      }
      setTextColor(Color.parseColor("#5F7165"))
      textSize = 16f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }
    card.addView(blockedLabel, verticalParams(top = 10))

    val command = TextView(this).apply {
      text = if (reason == TaskMateRestrictionPolicy.REASON_UNLOCK) {
        getString(
          R.string.taskmate_unlock_block_command,
          remainingMinutes(unlockStatus.remainingMillis),
          appName
        )
      } else {
        getString(R.string.taskmate_block_command)
      }
      setTextColor(Color.parseColor("#1D2B22"))
      textSize = 26f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      setLineSpacing(dp(2).toFloat(), 1.0f)
    }
    card.addView(command, verticalParams(top = 24))

    card.addView(divider(), verticalParams(top = 24, height = 1))

    if (reason == TaskMateRestrictionPolicy.REASON_UNLOCK) {
      val progressLabel = label(getString(R.string.taskmate_unlock_progress_label))
      card.addView(progressLabel, verticalParams(top = 20))

      val progressText = TextView(this).apply {
        text = getString(
          R.string.taskmate_unlock_progress_value,
          minutes(unlockStatus.totalUsageMillis),
          minutes(unlockStatus.requiredMillis)
        )
        setTextColor(Color.parseColor("#2F6D3D"))
        textSize = 34f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        includeFontPadding = false
      }
      card.addView(progressText, verticalParams(top = 7))

      val conditionLabel = label(getString(R.string.taskmate_unlock_requirement_label))
      card.addView(conditionLabel, verticalParams(top = 18))

      val conditionText = TextView(this).apply {
        text = requirementNames.joinToString(" / ").ifBlank {
          getString(R.string.taskmate_unlock_requirement_unknown)
        }
        setTextColor(Color.parseColor("#1D2B22"))
        textSize = 17f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        maxLines = 3
      }
      card.addView(conditionText, verticalParams(top = 7))

      val conditionButton = TextView(this).apply {
        text = getString(R.string.taskmate_unlock_open_requirement_button)
        setTextColor(Color.parseColor("#2F6D3D"))
        textSize = 16f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        isClickable = true
        isFocusable = true
        contentDescription = getString(R.string.taskmate_unlock_open_requirement_button)
        minHeight = dp(52)
        background = rounded(Color.WHITE, dp(16), Color.parseColor("#B9C8B7"), dp(1))
        setOnClickListener { openFirstRequirementApp() }
      }
      card.addView(conditionButton, verticalParams(top = 22))
    } else {
      val missionLabel = label(getString(R.string.taskmate_block_mission_label))
      card.addView(missionLabel, verticalParams(top = 20))

      val taskText = TextView(this).apply {
        text = taskTitle
        setTextColor(Color.parseColor("#1D2B22"))
        textSize = 20f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        maxLines = 3
      }
      card.addView(taskText, verticalParams(top = 7))

      val timeLabel = label(getString(R.string.taskmate_block_timer_label))
      card.addView(timeLabel, verticalParams(top = 18))

      timerText = TextView(this).apply {
        text = formatElapsed(startedAtMillis)
        setTextColor(Color.parseColor("#2F6D3D"))
        textSize = 34f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        includeFontPadding = false
      }
      timerText?.let { card.addView(it, verticalParams(top = 7)) }
    }

    val button = TextView(this).apply {
      text = getString(R.string.taskmate_block_return_button)
      setTextColor(Color.WHITE)
      textSize = 17f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      isClickable = true
      isFocusable = true
      contentDescription = getString(R.string.taskmate_block_return_button)
      minHeight = dp(58)
      background = rounded(Color.parseColor("#2F6D3D"), dp(16), Color.TRANSPARENT, 0)
      setOnClickListener { returnToTaskMate() }
    }
    card.addView(button, verticalParams(top = 26))

    return root
  }

  private fun returnToTaskMate() {
    val uri = if (blockedReason == TaskMateRestrictionPolicy.REASON_UNLOCK) {
      "taskmate://unlock-mode"
    } else {
      "taskmate://focus-active"
    }
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
      setPackage(packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    startActivity(intent)
    finish()
  }

  private fun openFirstRequirementApp() {
    val requirementPackages = getSharedPreferences(TaskMateFocusModule.FOCUS_PREFS, Context.MODE_PRIVATE)
      .getStringSet(TaskMateFocusModule.KEY_UNLOCK_REQUIREMENT_PACKAGES, emptySet())
      ?: emptySet()
    for (requirementPackage in requirementPackages) {
      val launchIntent = packageManager.getLaunchIntentForPackage(requirementPackage) ?: continue
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      startActivity(launchIntent)
      finish()
      return
    }
    returnToTaskMate()
  }

  private fun resolveAppDetails(packageName: String): AppDetails {
    if (packageName.isBlank()) {
      return AppDetails(getString(R.string.taskmate_block_unknown_app), null)
    }
    return try {
      val appInfo = getApplicationInfoCompat(packageName)
      val label = packageManager.getApplicationLabel(appInfo).toString().trim()
      AppDetails(label.ifBlank { getString(R.string.taskmate_block_unknown_app) }, appInfo.loadIcon(packageManager))
    } catch (_: Throwable) {
      AppDetails(getString(R.string.taskmate_block_unknown_app), null)
    }
  }

  private fun getApplicationInfoCompat(packageName: String): ApplicationInfo {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      packageManager.getApplicationInfo(packageName, PackageManager.ApplicationInfoFlags.of(0))
    } else {
      @Suppress("DEPRECATION")
      packageManager.getApplicationInfo(packageName, 0)
    }
  }

  private fun getDrawableCompat(resourceId: Int): Drawable? {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      getDrawable(resourceId)
    } else {
      @Suppress("DEPRECATION")
      resources.getDrawable(resourceId)
    }
  }

  private fun label(value: String): TextView {
    return TextView(this).apply {
      text = value
      setTextColor(Color.parseColor("#5F7165"))
      textSize = 13f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      includeFontPadding = false
    }
  }

  private fun divider(): View {
    return View(this).apply {
      setBackgroundColor(Color.parseColor("#D9E6D7"))
    }
  }

  private fun verticalParams(
    top: Int = 0,
    width: Int = LinearLayout.LayoutParams.MATCH_PARENT,
    height: Int = LinearLayout.LayoutParams.WRAP_CONTENT
  ): LinearLayout.LayoutParams {
    return LinearLayout.LayoutParams(
      if (width > 0) dp(width) else width,
      if (height > 0) dp(height) else height
    ).apply {
      topMargin = dp(top)
    }
  }

  private fun rounded(
    color: Int,
    radius: Int,
    strokeColor: Int,
    strokeWidth: Int
  ): GradientDrawable {
    return GradientDrawable().apply {
      setColor(color)
      cornerRadius = radius.toFloat()
      if (strokeWidth > 0) {
        setStroke(strokeWidth, strokeColor)
      }
    }
  }

  private fun dp(value: Int): Int {
    return (value * resources.displayMetrics.density).toInt()
  }

  private fun formatElapsed(startedAtMillis: Long): String {
    if (startedAtMillis <= 0) {
      return "00:00:00"
    }
    val totalSeconds = max(0L, (System.currentTimeMillis() - startedAtMillis) / 1000L)
    val hours = totalSeconds / 3600L
    val minutes = (totalSeconds % 3600L) / 60L
    val seconds = totalSeconds % 60L
    return "%02d:%02d:%02d".format(hours, minutes, seconds)
  }

  private fun minutes(value: Long): Int {
    return (value / 60000L).coerceAtLeast(0L).toInt()
  }

  private fun remainingMinutes(value: Long): Int {
    if (value <= 0L) {
      return 0
    }
    return ((value + 59999L) / 60000L).toInt()
  }

  private data class AppDetails(
    val name: String,
    val icon: Drawable?
  )

  companion object {
    const val EXTRA_PACKAGE_NAME = "com.taskmate.mobile.extra.BLOCKED_PACKAGE_NAME"
    const val EXTRA_REASON = "com.taskmate.mobile.extra.BLOCKED_REASON"
  }
}
