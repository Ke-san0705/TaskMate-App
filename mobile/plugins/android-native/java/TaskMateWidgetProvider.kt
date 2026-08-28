package com.taskmate.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.widget.RemoteViews
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
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

  companion object {
    private const val DATABASE_NAME = "taskmate-mobile.db"

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
      val state = readWidgetState(context)
      val views = RemoteViews(context.packageName, R.layout.taskmate_widget)
      views.setTextViewText(R.id.taskmate_widget_status, state.status)
      views.setTextViewText(R.id.taskmate_widget_title, state.title)
      views.setTextViewText(
        R.id.taskmate_widget_progress,
        "今日 ${state.completedCount} / ${state.todayCount} 完了"
      )
      views.setTextViewText(R.id.taskmate_widget_blocked, state.blockedText)
      views.setOnClickPendingIntent(R.id.taskmate_widget_root, openAppIntent(context))
      appWidgetManager.updateAppWidget(appWidgetId, views)
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

    private fun readWidgetState(context: Context): WidgetState {
      val dbFile = findDatabaseFile(context) ?: return WidgetState(
        status = "TaskMate",
        title = "タップして開く",
        todayCount = 0,
        completedCount = 0,
        blockedText = ""
      )

      return try {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.JAPAN).format(Date())
        val db = SQLiteDatabase.openDatabase(
          dbFile.absolutePath,
          null,
          SQLiteDatabase.OPEN_READONLY
        )
        try {
          val counts = queryTodayCounts(db, today)
          val active = queryActiveSession(db)
          if (active != null) {
            return WidgetState(
              status = "集中中",
              title = active.taskTitle,
              todayCount = counts.total,
              completedCount = counts.completed,
              blockedText = active.blockedText
            )
          }
          val currentTaskTitle = queryCurrentTaskTitle(db)
          val nextTitle = currentTaskTitle ?: queryNextTitle(db, today)
          WidgetState(
            status = if (currentTaskTitle != null) "今やる" else "今日",
            title = nextTitle ?: "今日やることを追加",
            todayCount = counts.total,
            completedCount = counts.completed,
            blockedText = if (counts.remaining > 0) "残り ${counts.remaining} 件" else "今日の分は完了"
          )
        } finally {
          db.close()
        }
      } catch (_: Throwable) {
        WidgetState(
          status = "TaskMate",
          title = "タップして確認",
          todayCount = 0,
          completedCount = 0,
          blockedText = ""
        )
      }
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
        return TodayCounts(total = cursor.getInt(0), completed = cursor.getInt(1))
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

    private fun countBlockedApps(rawJson: String?): Int {
      return try {
        JSONArray(rawJson ?: "[]").length()
      } catch (_: Throwable) {
        0
      }
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

private data class WidgetState(
  val status: String,
  val title: String,
  val todayCount: Int,
  val completedCount: Int,
  val blockedText: String
)
