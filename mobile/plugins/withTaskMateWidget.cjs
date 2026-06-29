const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidColors,
  withAndroidManifest,
  withDangerousMod,
  withStringsXml
} = require('@expo/config-plugins');

const WIDGET_PROVIDER = 'TaskMateWidgetProvider';
const PACKAGE_PATH = path.join('com', 'taskmate', 'mobile');
const DATABASE_NAME = 'taskmate-mobile.db';

const COLORS = {
  // Android AppWidget uses XML resources instead of React Native styles.
  // Keep these colors aligned with src/theme/taskMateTheme.js.
  taskmate_widget_background: '#F3F8F1',
  taskmate_widget_border: '#D5E1D3',
  taskmate_widget_primary: '#243427',
  taskmate_widget_muted: '#62705F',
  taskmate_widget_accent: '#2F6138'
};

const STRINGS = {
  taskmate_widget_character: 'TaskMate character',
  taskmate_widget_count_default: '今日 0',
  taskmate_widget_subtitle_default: 'タップして開く',
  taskmate_widget_description: 'TaskMateの今日の予定をホーム画面に表示します'
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFileIfChanged(filePath, contents) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === contents) {
    return;
  }
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents);
}

function copyFileIfChanged(fromPath, toPath) {
  ensureDir(path.dirname(toPath));
  if (fs.existsSync(toPath)) {
    const source = fs.readFileSync(fromPath);
    const target = fs.readFileSync(toPath);
    if (source.equals(target)) {
      return;
    }
  }
  fs.copyFileSync(fromPath, toPath);
}

function addWidgetReceiver(androidManifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  application.receiver = application.receiver || [];
  const receiverName = `.${WIDGET_PROVIDER}`;
  const receiver = {
    $: {
      'android:name': receiverName,
      'android:exported': 'true'
    },
    'intent-filter': [
      {
        action: [
          {
            $: {
              'android:name': 'android.appwidget.action.APPWIDGET_UPDATE'
            }
          }
        ]
      }
    ],
    'meta-data': [
      {
        $: {
          'android:name': 'android.appwidget.provider',
          'android:resource': '@xml/taskmate_widget_info'
        }
      }
    ]
  };

  const index = application.receiver.findIndex(
    (item) => item?.$?.['android:name'] === receiverName
  );
  if (index >= 0) {
    application.receiver[index] = receiver;
  } else {
    application.receiver.push(receiver);
  }
  return androidManifest;
}

function addWidgetPauseHook(mainActivityPath) {
  if (!fs.existsSync(mainActivityPath)) {
    return;
  }
  const source = fs.readFileSync(mainActivityPath, 'utf8');
  if (source.includes('TaskMateWidgetProvider.updateAll(this)')) {
    return;
  }
  const target = '    super.onCreate(null)\n  }\n';
  const replacement = `${target}\n  override fun onPause() {\n    super.onPause()\n    TaskMateWidgetProvider.updateAll(this)\n  }\n`;
  if (!source.includes(target)) {
    throw new Error('Could not find MainActivity.onCreate block for TaskMate widget hook.');
  }
  fs.writeFileSync(mainActivityPath, source.replace(target, replacement));
}

function widgetBackgroundXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="@color/taskmate_widget_background" />
  <stroke
    android:width="1dp"
    android:color="@color/taskmate_widget_border" />
  <corners android:radius="24dp" />
  <padding
    android:bottom="12dp"
    android:left="12dp"
    android:right="12dp"
    android:top="12dp" />
</shape>
`;
}

function widgetLayoutXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/taskmate_widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:background="@drawable/taskmate_widget_background"
  android:elevation="2dp"
  android:gravity="center"
  android:orientation="vertical"
  android:padding="10dp">

  <ImageView
    android:id="@+id/taskmate_widget_character"
    android:layout_width="74dp"
    android:layout_height="74dp"
    android:adjustViewBounds="true"
    android:contentDescription="@string/taskmate_widget_character"
    android:scaleType="fitCenter"
    android:src="@drawable/taskmate_chara1_wait" />

  <TextView
    android:id="@+id/taskmate_widget_count"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="5dp"
    android:gravity="center"
    android:text="@string/taskmate_widget_count_default"
    android:textColor="@color/taskmate_widget_accent"
    android:textSize="24sp"
    android:textStyle="bold" />

  <TextView
    android:id="@+id/taskmate_widget_subtitle"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="1dp"
    android:ellipsize="end"
    android:gravity="center"
    android:maxLines="1"
    android:text="@string/taskmate_widget_subtitle_default"
    android:textColor="@color/taskmate_widget_muted"
    android:textSize="12sp" />
</LinearLayout>
`;
}

function widgetInfoXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/taskmate_widget_description"
  android:initialLayout="@layout/taskmate_widget"
  android:minHeight="110dp"
  android:minResizeHeight="90dp"
  android:minResizeWidth="110dp"
  android:minWidth="110dp"
  android:previewImage="@drawable/taskmate_chara1_wait"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="1800000"
  android:widgetCategory="home_screen" />
`;
}

function providerKt() {
  return `package com.taskmate.mobile

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
    private const val DATABASE_NAME = "${DATABASE_NAME}"

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
      views.setTextViewText(R.id.taskmate_widget_count, "今日 \${state.todayCount}")
      views.setTextViewText(R.id.taskmate_widget_subtitle, state.subtitle)
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
        todayCount = 0,
        subtitle = "TaskMateを開いて開始"
      )

      return try {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.JAPAN).format(Date())
        val db = SQLiteDatabase.openDatabase(
          dbFile.absolutePath,
          null,
          SQLiteDatabase.OPEN_READONLY
        )
        try {
          val todayCount = queryTodayCount(db, today)
          val nextTitle = queryNextTitle(db, today)
          WidgetState(
            todayCount = todayCount,
            subtitle = nextTitle ?: if (todayCount == 0) {
              "今日のタスクはありません"
            } else {
              "今日も一つずつ進めましょう"
            }
          )
        } finally {
          db.close()
        }
      } catch (_: Throwable) {
        WidgetState(todayCount = 0, subtitle = "TaskMateを開いて確認")
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

    private fun queryTodayCount(db: SQLiteDatabase, today: String): Int {
      db.rawQuery(
        "SELECT COUNT(*) FROM tasks WHERE completed = 0 AND date <= ?",
        arrayOf(today)
      ).use { cursor ->
        return if (cursor.moveToFirst()) cursor.getInt(0) else 0
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
  }
}

private data class WidgetState(
  val todayCount: Int,
  val subtitle: String
)
`;
}

function withTaskMateWidget(config) {
  config = withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = addWidgetReceiver(modConfig.modResults);
    return modConfig;
  });

  config = withAndroidColors(config, (modConfig) => {
    for (const [name, value] of Object.entries(COLORS)) {
      AndroidConfig.Colors.setColorItem(
        AndroidConfig.Resources.buildResourceItem({ name, value }),
        modConfig.modResults
      );
    }
    return modConfig;
  });

  config = withStringsXml(config, (modConfig) => {
    AndroidConfig.Strings.setStringItem(
      Object.entries(STRINGS).map(([name, value]) =>
        AndroidConfig.Resources.buildResourceItem({ name, value })
      ),
      modConfig.modResults
    );
    return modConfig;
  });

  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const androidRoot = path.join(modConfig.modRequest.platformProjectRoot);
      const mainRoot = path.join(androidRoot, 'app', 'src', 'main');
      const resRoot = path.join(mainRoot, 'res');
      const javaRoot = path.join(mainRoot, 'java', ...PACKAGE_PATH.split(path.sep));
      const charaSource = path.join(
        modConfig.modRequest.projectRoot,
        'assets',
        'characters',
        'Chara1',
        'wait.png'
      );

      writeFileIfChanged(
        path.join(resRoot, 'drawable', 'taskmate_widget_background.xml'),
        widgetBackgroundXml()
      );
      writeFileIfChanged(path.join(resRoot, 'layout', 'taskmate_widget.xml'), widgetLayoutXml());
      writeFileIfChanged(path.join(resRoot, 'xml', 'taskmate_widget_info.xml'), widgetInfoXml());
      copyFileIfChanged(
        charaSource,
        path.join(resRoot, 'drawable-nodpi', 'taskmate_chara1_wait.png')
      );
      writeFileIfChanged(path.join(javaRoot, `${WIDGET_PROVIDER}.kt`), providerKt());
      addWidgetPauseHook(path.join(javaRoot, 'MainActivity.kt'));
      return modConfig;
    }
  ]);
}

module.exports = withTaskMateWidget;
