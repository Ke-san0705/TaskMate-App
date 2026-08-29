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
  private lateinit var timerText: TextView
  private var startedAtMillis = 0L

  private val tick = object : Runnable {
    override fun run() {
      if (::timerText.isInitialized) {
        timerText.text = formatElapsed(startedAtMillis)
      }
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
    val blockedPackageName = sourceIntent?.getStringExtra(EXTRA_PACKAGE_NAME).orEmpty()
    val prefs = getSharedPreferences(TaskMateFocusModule.FOCUS_PREFS, Context.MODE_PRIVATE)
    val taskTitle = prefs.getString(TaskMateFocusModule.KEY_TASK_TITLE, "")
      .orEmpty()
      .ifBlank { getString(R.string.taskmate_block_default_task) }
    startedAtMillis = prefs.getLong(TaskMateFocusModule.KEY_STARTED_AT_MILLIS, 0L)

    val appDetails = resolveAppDetails(blockedPackageName)
    setContentView(createContent(appDetails.name, appDetails.icon, taskTitle))
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

  private fun createContent(appName: String, appIcon: Drawable?, taskTitle: String): View {
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
      text = getString(R.string.taskmate_block_restricted)
      setTextColor(Color.parseColor("#5F7165"))
      textSize = 16f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }
    card.addView(blockedLabel, verticalParams(top = 10))

    val command = TextView(this).apply {
      text = getString(R.string.taskmate_block_command)
      setTextColor(Color.parseColor("#1D2B22"))
      textSize = 26f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      setLineSpacing(dp(2).toFloat(), 1.0f)
    }
    card.addView(command, verticalParams(top = 24))

    card.addView(divider(), verticalParams(top = 24, height = 1))

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
    card.addView(timerText, verticalParams(top = 7))

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
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("taskmate://focus-active")).apply {
      setPackage(packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    startActivity(intent)
    finish()
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

  private data class AppDetails(
    val name: String,
    val icon: Drawable?
  )

  companion object {
    const val EXTRA_PACKAGE_NAME = "com.taskmate.mobile.extra.BLOCKED_PACKAGE_NAME"
  }
}
