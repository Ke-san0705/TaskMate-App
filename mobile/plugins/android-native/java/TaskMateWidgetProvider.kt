package com.taskmate.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import com.kesan0705.taskmate.MainActivity
import com.kesan0705.taskmate.R
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import org.json.JSONArray

class TaskMateWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    for (appWidgetId in appWidgetIds) {
      updateWidget(context, appWidgetManager, appWidgetId)
    }
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: Bundle?
  ) {
    updateWidget(context, appWidgetManager, appWidgetId)
  }

  companion object {
    private const val DATABASE_NAME = "taskmate-mobile.db"
    private const val WIDE_MIN_WIDTH_DP = 220
    private const val DAY_MS = 24L * 60L * 60L * 1000L

    private val pendingMessages = listOf(
      "今日も1つだけやろう。",
      "まずは1個終わらせよう。",
      "昨日までの記録を今日につなげよう。"
    )
    private val restartMessages = listOf(
      "まずは今日の1つから。",
      "今日からまた始めよう。",
      "小さく再開しよう。"
    )
    private val achievedMessages = listOf(
      "今日も達成！",
      "ちゃんと今日も積み上がった。",
      "明日につながる1日になった。"
    )
    private val longStreakMessages = listOf(
      "一週間突破！",
      "ここまで続いてる。この調子だ。",
      "この積み重ねは強い。"
    )

    fun updateAll(context: Context) {
      val appWidgetManager = AppWidgetManager.getInstance(context)
      val componentName = ComponentName(context, TaskMateWidgetProvider::class.java)
      val widgetIds = appWidgetManager.getAppWidgetIds(componentName)
      for (widgetId in widgetIds) {
        updateWidget(context, appWidgetManager, widgetId)
      }
    }

    private fun updateWidget(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetId: Int
    ) {
      val today = localDateKey()
      val presentation = readPresentation(context, today)
      val state = readWidgetState(context, today, presentation)
      val wide = isWideWidget(appWidgetManager, appWidgetId)
      val layoutId = if (wide) R.layout.taskmate_widget_wide else R.layout.taskmate_widget_compact
      val views = RemoteViews(context.packageName, layoutId)

      bindCharacter(context, views, presentation)
      if (wide) {
        bindWide(views, state)
      } else {
        bindCompact(views, state)
      }

      views.setOnClickPendingIntent(R.id.taskmate_widget_root, openAppIntent(context))
      appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun bindWide(views: RemoteViews, state: WidgetState) {
      views.setTextViewText(R.id.taskmate_widget_status, state.streakLabel)
      views.setTextViewText(R.id.taskmate_widget_title, state.motivationMessage)
      views.setTextViewText(R.id.taskmate_widget_progress, state.primaryTaskText)
      views.setTextViewText(R.id.taskmate_widget_blocked, state.detailText)
      views.setViewVisibility(R.id.taskmate_widget_progress, View.VISIBLE)
      views.setViewVisibility(R.id.taskmate_widget_blocked, View.VISIBLE)
    }

    private fun bindCompact(views: RemoteViews, state: WidgetState) {
      views.setTextViewText(R.id.taskmate_widget_status, state.compactStreakLabel)
      views.setTextViewText(R.id.taskmate_widget_title, state.compactMessage)
      views.setTextViewText(R.id.taskmate_widget_progress, state.compactProgress)
      views.setTextViewText(R.id.taskmate_widget_blocked, "")
      views.setViewVisibility(R.id.taskmate_widget_progress, View.VISIBLE)
      views.setViewVisibility(R.id.taskmate_widget_blocked, View.GONE)
    }

    private fun isWideWidget(appWidgetManager: AppWidgetManager, appWidgetId: Int): Boolean {
      val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
      val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
      return minWidth >= WIDE_MIN_WIDTH_DP
    }

    private fun openAppIntent(context: Context): PendingIntent {
      val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: Intent(context, MainActivity::class.java)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      return PendingIntent.getActivity(
        context,
        0,
        intent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )
    }

    private fun readPresentation(context: Context, today: String): WidgetPresentation {
      val prefs = context.getSharedPreferences(TaskMateFocusModule.FOCUS_PREFS, Context.MODE_PRIVATE)
      val savedDate = prefs.getString(TaskMateFocusModule.KEY_WIDGET_MOTIVATION_DATE, "") ?: ""
      val savedMessage =
        prefs.getString(TaskMateFocusModule.KEY_WIDGET_MOTIVATION_MESSAGE, "")?.takeIf {
          savedDate == today && it.isNotBlank()
        }
      return WidgetPresentation(
        characterId = prefs.getString(TaskMateFocusModule.KEY_WIDGET_CHARACTER_ID, "") ?: "",
        characterImageUri =
          prefs.getString(TaskMateFocusModule.KEY_WIDGET_CHARACTER_IMAGE_URI, "") ?: "",
        motivationMessage = savedMessage
      )
    }

    private fun readWidgetState(
      context: Context,
      today: String,
      presentation: WidgetPresentation
    ): WidgetState {
      val dbFile = findDatabaseFile(context) ?: return buildWidgetState(
        today = today,
        counts = TodayCounts(total = 0, completed = 0),
        activeSession = null,
        currentTaskTitle = null,
        nextTaskTitle = null,
        streak = calculateStreak(emptySet(), today),
        presentation = presentation
      )

      return try {
        val db = SQLiteDatabase.openDatabase(
          dbFile.absolutePath,
          null,
          SQLiteDatabase.OPEN_READONLY
        )
        try {
          val counts = queryTodayCounts(db, today)
          val active = queryActiveSession(db)
          val currentTaskTitle = queryCurrentTaskTitle(db)
          val nextTaskTitle = queryNextTitle(db, today)
          val streak = queryStreak(db, today)
          buildWidgetState(
            today = today,
            counts = counts,
            activeSession = active,
            currentTaskTitle = currentTaskTitle,
            nextTaskTitle = nextTaskTitle,
            streak = streak,
            presentation = presentation
          )
        } finally {
          db.close()
        }
      } catch (_: Throwable) {
        buildWidgetState(
          today = today,
          counts = TodayCounts(total = 0, completed = 0),
          activeSession = null,
          currentTaskTitle = null,
          nextTaskTitle = null,
          streak = calculateStreak(emptySet(), today),
          presentation = presentation
        )
      }
    }

    private fun buildWidgetState(
      today: String,
      counts: TodayCounts,
      activeSession: ActiveSession?,
      currentTaskTitle: String?,
      nextTaskTitle: String?,
      streak: StreakState,
      presentation: WidgetPresentation
    ): WidgetState {
      val taskText = when {
        activeSession != null -> "集中中: ${activeSession.taskTitle}"
        currentTaskTitle != null -> "今やる: $currentTaskTitle"
        nextTaskTitle != null -> "今日: $nextTaskTitle"
        else -> "今日やることを追加"
      }
      val detail = if (activeSession != null) {
        "今日 ${counts.completed} / ${counts.total} 完了 / ${activeSession.blockedText}"
      } else if (counts.remaining > 0) {
        "今日 ${counts.completed} / ${counts.total} 完了 / 残り ${counts.remaining} 件"
      } else {
        "今日 ${counts.completed} / ${counts.total} 完了 / 今日の分は完了"
      }
      val derivedMessage = chooseMotivationMessage(streak)
      val message = presentation.motivationMessage ?: derivedMessage
      val streakLabel = if (streak.currentStreak > 0) {
        "🔥 ${streak.currentStreak}日連続${if (streak.achievedToday) "！" else ""}"
      } else {
        "🔥 今日から"
      }
      val compactProgress = when {
        streak.achievedToday -> "今日達成"
        streak.currentStreak > 0 -> "あと1つ"
        else -> "まず1つ"
      }

      return WidgetState(
        streakLabel = streakLabel,
        compactStreakLabel = if (streak.currentStreak > 0) {
          "🔥 ${streak.currentStreak}日"
        } else {
          "🔥 0日"
        },
        motivationMessage = message,
        compactMessage = shortCompactMessage(message, streak),
        compactProgress = compactProgress,
        primaryTaskText = taskText,
        detailText = detail,
        today = today
      )
    }

    private fun shortCompactMessage(message: String, streak: StreakState): String {
      if (streak.isBestToday && streak.achievedToday) {
        return "自己ベスト！"
      }
      if (streak.achievedToday) {
        return "今日も達成！"
      }
      return when {
        message.length <= 12 -> message
        streak.currentStreak > 0 -> "今日も続けよう"
        else -> "今日から始めよう"
      }
    }

    private fun bindCharacter(
      context: Context,
      views: RemoteViews,
      presentation: WidgetPresentation
    ) {
      val bitmap = loadWidgetBitmap(context, presentation.characterImageUri)
      if (bitmap != null) {
        views.setImageViewBitmap(R.id.taskmate_widget_character, bitmap)
        return
      }
      val resourceId = if (presentation.characterId.equals("Chara2", ignoreCase = true)) {
        R.drawable.taskmate_chara2_wait
      } else {
        R.drawable.taskmate_chara1_wait
      }
      views.setImageViewResource(R.id.taskmate_widget_character, resourceId)
    }

    private fun loadWidgetBitmap(context: Context, uriText: String): Bitmap? {
      if (uriText.isBlank()) {
        return null
      }
      return try {
        val uri = Uri.parse(uriText)
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { stream ->
          BitmapFactory.decodeStream(stream, null, bounds)
        }
        val sampleSize = calculateSampleSize(bounds, 160, 160)
        val options = BitmapFactory.Options().apply { inSampleSize = sampleSize }
        context.contentResolver.openInputStream(uri)?.use { stream ->
          BitmapFactory.decodeStream(stream, null, options)
        }
      } catch (_: Throwable) {
        null
      }
    }

    private fun calculateSampleSize(
      options: BitmapFactory.Options,
      targetWidth: Int,
      targetHeight: Int
    ): Int {
      var sampleSize = 1
      var width = options.outWidth
      var height = options.outHeight
      while (width / sampleSize > targetWidth * 2 || height / sampleSize > targetHeight * 2) {
        sampleSize *= 2
      }
      return sampleSize
    }

    private fun findDatabaseFile(context: Context): File? {
      val candidates = listOf(
        File(context.filesDir, "SQLite/$DATABASE_NAME"),
        context.getDatabasePath(DATABASE_NAME),
        File(context.filesDir.parentFile, "databases/$DATABASE_NAME"),
        File(context.noBackupFilesDir, "SQLite/$DATABASE_NAME")
      )
      return candidates.firstOrNull { it.exists() && it.isFile }
    }

    private fun queryTodayCounts(db: SQLiteDatabase, today: String): TodayCounts {
      db.rawQuery(
        "SELECT COUNT(*), SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) FROM tasks WHERE date <= ?",
        arrayOf(today)
      ).use { cursor ->
        if (!cursor.moveToFirst()) {
          return TodayCounts(total = 0, completed = 0)
        }
        return TodayCounts(
          total = cursor.getInt(0),
          completed = if (cursor.isNull(1)) 0 else cursor.getInt(1)
        )
      }
    }

    private fun queryActiveSession(db: SQLiteDatabase): ActiveSession? {
      db.rawQuery(
        """
          SELECT task_title, blocked_apps_json
            FROM focus_sessions
           WHERE status = 'active'
           ORDER BY started_at DESC
           LIMIT 1
        """.trimIndent(),
        emptyArray<String>()
      ).use { cursor ->
        if (!cursor.moveToFirst()) {
          return null
        }
        val title = cursor.getString(0).takeIf { it.isNotBlank() } ?: "今やるタスク"
        val blockedCount = countBlockedApps(cursor.getString(1))
        return ActiveSession(
          taskTitle = title,
          blockedText = if (blockedCount > 0) "制限中 $blockedCount 件" else "制限アプリなし"
        )
      }
    }

    private fun queryCurrentTaskTitle(db: SQLiteDatabase): String? {
      db.rawQuery(
        """
          SELECT tasks.title
            FROM focus_state
            JOIN tasks ON tasks.id = focus_state.value
           WHERE focus_state.key = 'currentTaskId'
             AND tasks.completed = 0
           LIMIT 1
        """.trimIndent(),
        emptyArray<String>()
      ).use { cursor ->
        if (!cursor.moveToFirst()) {
          return null
        }
        return cursor.getString(0).takeIf { it.isNotBlank() }
      }
    }

    private fun queryNextTitle(db: SQLiteDatabase, today: String): String? {
      db.rawQuery(
        """
          SELECT title
            FROM tasks
           WHERE completed = 0 AND date <= ?
           ORDER BY date ASC, COALESCE(time, '99:99') ASC, title ASC
           LIMIT 1
        """.trimIndent(),
        arrayOf(today)
      ).use { cursor ->
        if (!cursor.moveToFirst()) {
          return null
        }
        return cursor.getString(0).takeIf { it.isNotBlank() }
      }
    }

    private fun queryStreak(db: SQLiteDatabase, today: String): StreakState {
      val dates = if (tableExists(db, "daily_activity")) {
        queryDailyActivityDates(db)
      } else {
        queryCompletionDatesFromTasks(db)
      }
      return calculateStreak(dates, today)
    }

    private fun tableExists(db: SQLiteDatabase, tableName: String): Boolean {
      db.rawQuery(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
        arrayOf(tableName)
      ).use { cursor ->
        return cursor.moveToFirst()
      }
    }

    private fun queryDailyActivityDates(db: SQLiteDatabase): Set<String> {
      val dates = linkedSetOf<String>()
      db.rawQuery(
        """
          SELECT date
            FROM daily_activity
           WHERE achieved = 1
           ORDER BY date ASC
        """.trimIndent(),
        emptyArray<String>()
      ).use { cursor ->
        while (cursor.moveToNext()) {
          cursor.getString(0)?.takeIf { isDateKey(it) }?.let { dates.add(it) }
        }
      }
      return dates
    }

    private fun queryCompletionDatesFromTasks(db: SQLiteDatabase): Set<String> {
      val dates = linkedSetOf<String>()
      db.rawQuery(
        """
          SELECT COALESCE(completed_at, updated_at)
            FROM tasks
           WHERE completed = 1
             AND COALESCE(completed_at, updated_at) IS NOT NULL
        """.trimIndent(),
        emptyArray<String>()
      ).use { cursor ->
        while (cursor.moveToNext()) {
          completedAtToDateKey(cursor.getString(0))?.let { dates.add(it) }
        }
      }
      return dates
    }

    private fun calculateStreak(activeDates: Set<String>, today: String): StreakState {
      val todayNumber = dateKeyToDayNumber(today) ?: 0L
      val yesterday = dayNumberToDateKey(todayNumber - 1L)
      val achievedToday = activeDates.contains(today)
      val achievedYesterday = activeDates.contains(yesterday)
      val currentStreak = when {
        achievedToday -> countBackwards(activeDates, today)
        achievedYesterday -> countBackwards(activeDates, yesterday)
        else -> 0
      }
      val longestStreak = longestRun(activeDates)
      val previousLongest = longestRun(activeDates.filter { it != today }.toSet())
      return StreakState(
        currentStreak = currentStreak,
        longestStreak = longestStreak,
        totalActiveDays = activeDates.size,
        achievedToday = achievedToday,
        isBestToday = achievedToday && currentStreak > previousLongest
      )
    }

    private fun countBackwards(activeDates: Set<String>, endDate: String): Int {
      var day = dateKeyToDayNumber(endDate) ?: return 0
      var count = 0
      while (activeDates.contains(dayNumberToDateKey(day))) {
        count += 1
        day -= 1L
      }
      return count
    }

    private fun longestRun(activeDates: Set<String>): Int {
      val days = activeDates.mapNotNull { dateKeyToDayNumber(it) }.sorted()
      var best = 0
      var current = 0
      var previous: Long? = null
      for (day in days) {
        current = if (previous != null && day == previous!! + 1L) current + 1 else 1
        best = maxOf(best, current)
        previous = day
      }
      return best
    }

    private fun chooseMotivationMessage(streak: StreakState): String {
      return when {
        streak.achievedToday && streak.isBestToday && streak.currentStreak >= 2 ->
          "自己ベスト更新だ。"
        streak.achievedToday && streak.currentStreak >= 30 ->
          "30日達成！"
        streak.achievedToday && streak.currentStreak >= 7 ->
          pickMessage(longStreakMessages, streak)
        streak.achievedToday ->
          pickMessage(achievedMessages, streak)
        streak.currentStreak > 0 ->
          pickMessage(pendingMessages, streak)
        else ->
          pickMessage(restartMessages, streak)
      }
    }

    private fun pickMessage(messages: List<String>, streak: StreakState): String {
      val seed =
        "${streak.currentStreak}:${streak.longestStreak}:${streak.totalActiveDays}:${streak.achievedToday}"
      return messages[Math.floorMod(seed.hashCode(), messages.size)]
    }

    private fun countBlockedApps(rawJson: String?): Int {
      return try {
        JSONArray(rawJson ?: "[]").length()
      } catch (_: Throwable) {
        0
      }
    }

    private fun completedAtToDateKey(raw: String?): String? {
      if (raw.isNullOrBlank()) {
        return null
      }
      val patterns = listOf(
        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
        "yyyy-MM-dd'T'HH:mm:ss'Z'"
      )
      for (pattern in patterns) {
        try {
          val parser = SimpleDateFormat(pattern, Locale.US)
          parser.timeZone = TimeZone.getTimeZone("UTC")
          parser.isLenient = false
          val date = parser.parse(raw) ?: continue
          return localDateKey(date)
        } catch (_: Throwable) {
          // Try the next supported timestamp shape.
        }
      }
      return raw.take(10).takeIf { isDateKey(it) }
    }

    private fun localDateKey(date: Date = Date()): String {
      return SimpleDateFormat("yyyy-MM-dd", Locale.JAPAN).format(date)
    }

    private fun isDateKey(value: String): Boolean {
      if (!Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(value)) {
        return false
      }
      return dateKeyToDayNumber(value) != null
    }

    private fun dateKeyToDayNumber(dateKey: String): Long? {
      val parts = dateKey.split("-")
      if (parts.size != 3) {
        return null
      }
      val year = parts[0].toIntOrNull() ?: return null
      val month = parts[1].toIntOrNull() ?: return null
      val day = parts[2].toIntOrNull() ?: return null
      val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
      calendar.clear()
      calendar.set(year, month - 1, day)
      if (
        calendar.get(Calendar.YEAR) != year ||
        calendar.get(Calendar.MONTH) != month - 1 ||
        calendar.get(Calendar.DAY_OF_MONTH) != day
      ) {
        return null
      }
      return calendar.timeInMillis / DAY_MS
    }

    private fun dayNumberToDateKey(dayNumber: Long): String {
      val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
      calendar.timeInMillis = dayNumber * DAY_MS
      val year = calendar.get(Calendar.YEAR)
      val month = (calendar.get(Calendar.MONTH) + 1).toString().padStart(2, '0')
      val day = calendar.get(Calendar.DAY_OF_MONTH).toString().padStart(2, '0')
      return "$year-$month-$day"
    }
  }
}

private data class TodayCounts(
  val total: Int,
  val completed: Int
) {
  val remaining: Int
    get() = total - completed
}

private data class ActiveSession(
  val taskTitle: String,
  val blockedText: String
)

private data class StreakState(
  val currentStreak: Int,
  val longestStreak: Int,
  val totalActiveDays: Int,
  val achievedToday: Boolean,
  val isBestToday: Boolean
)

private data class WidgetPresentation(
  val characterId: String,
  val characterImageUri: String,
  val motivationMessage: String?
)

private data class WidgetState(
  val streakLabel: String,
  val compactStreakLabel: String,
  val motivationMessage: String,
  val compactMessage: String,
  val compactProgress: String,
  val primaryTaskText: String,
  val detailText: String,
  val today: String
)
