const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidColors,
  withAndroidManifest,
  withDangerousMod,
  withStringsXml
} = require('@expo/config-plugins');

const PACKAGE_PATH = path.join('com', 'taskmate', 'mobile');
const NATIVE_SOURCE_ROOT = path.join(__dirname, 'android-native', 'java');

const COLORS = {
  taskmate_widget_background: '#F3F8F1',
  taskmate_widget_border: '#D5E1D3',
  taskmate_widget_primary: '#243427',
  taskmate_widget_muted: '#62705F',
  taskmate_widget_accent: '#2F6138'
};

const LAUNCHER_MIPMAP_NAMES = [
  'ic_launcher',
  'ic_launcher_background',
  'ic_launcher_foreground',
  'ic_launcher_monochrome',
  'ic_launcher_round'
];

const REMOVED_PERMISSIONS = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.RECORD_AUDIO',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.CAMERA',
  'android.permission.PACKAGE_USAGE_STATS'
];

const STRINGS = {
  taskmate_widget_character: 'TaskMate character',
  taskmate_widget_count_default: '今日 0',
  taskmate_widget_subtitle_default: 'タップして開く',
  taskmate_widget_description: 'TaskMateの今日の予定をホーム画面に表示します',
  taskmate_accessibility_label: 'TaskMate アプリ制限',
  taskmate_accessibility_description:
    '集中中にユーザーが選んだアプリの起動だけを検知し、TaskMateへ戻る案内を表示します。画面内容、入力内容、メッセージ内容は取得しません。',
  taskmate_focus_channel_name: 'TaskMate 集中',
  taskmate_focus_notification_title: '集中に戻りましょう',
  taskmate_focus_notification_body: '今は「%1$s」に取り組む時間です。'
};

const PROGUARD_RULES = `
# TaskMate v2 native focus and widget bridge
-keep class com.taskmate.mobile.TaskMateFocusModule { *; }
-keep class com.taskmate.mobile.TaskMateFocusPackage { *; }
-keep class com.taskmate.mobile.TaskMateAccessibilityService { *; }
-keep class com.taskmate.mobile.TaskMateWidgetProvider { *; }
-keep class com.taskmate.mobile.TaskMateBootReceiver { *; }
`;

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

function upsertPermission(androidManifest, name, attrs = {}) {
  const root = androidManifest.manifest;
  root['uses-permission'] = root['uses-permission'] || [];
  const next = {
    $: {
      'android:name': name,
      ...attrs
    }
  };
  const index = root['uses-permission'].findIndex(
    (item) => item?.$?.['android:name'] === name
  );
  if (index >= 0) {
    root['uses-permission'][index] = next;
  } else {
    root['uses-permission'].push(next);
  }
}

function removePermission(androidManifest, name) {
  const root = androidManifest.manifest;
  root['uses-permission'] = (root['uses-permission'] || []).filter(
    (item) => item?.$?.['android:name'] !== name
  );
}

function upsertRemovedPermission(androidManifest, name) {
  removePermission(androidManifest, name);
  upsertPermission(androidManifest, name, { 'tools:node': 'remove' });
}

function ensureLauncherQuery(androidManifest) {
  const root = androidManifest.manifest;
  root.queries = root.queries || [{}];
  const queries = root.queries[0];
  queries.intent = queries.intent || [];
  const exists = queries.intent.some((intent) =>
    intent.action?.some((item) => item?.$?.['android:name'] === 'android.intent.action.MAIN') &&
    intent.category?.some((item) => item?.$?.['android:name'] === 'android.intent.category.LAUNCHER')
  );
  if (!exists) {
    queries.intent.push({
      action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
      category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }]
    });
  }
}

function upsertByName(items, next) {
  const index = items.findIndex((item) => item?.$?.['android:name'] === next.$['android:name']);
  if (index >= 0) {
    items[index] = next;
  } else {
    items.push(next);
  }
}

function addNativeEntries(androidManifest) {
  for (const permission of REMOVED_PERMISSIONS) {
    upsertRemovedPermission(androidManifest, permission);
  }
  upsertPermission(androidManifest, 'android.permission.RECEIVE_BOOT_COMPLETED');
  ensureLauncherQuery(androidManifest);

  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  application.receiver = application.receiver || [];
  upsertByName(application.receiver, {
    $: {
      'android:name': '.TaskMateWidgetProvider',
      'android:exported': 'true'
    },
    'intent-filter': [
      {
        action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }]
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
  });
  upsertByName(application.receiver, {
    $: {
      'android:name': '.TaskMateBootReceiver',
      'android:exported': 'false'
    },
    'intent-filter': [
      {
        action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }]
      }
    ]
  });

  application.service = application.service || [];
  upsertByName(application.service, {
    $: {
      'android:name': '.TaskMateAccessibilityService',
      'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
      'android:exported': 'true',
      'android:label': '@string/taskmate_accessibility_label'
    },
    'intent-filter': [
      {
        action: [
          { $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } }
        ]
      }
    ],
    'meta-data': [
      {
        $: {
          'android:name': 'android.accessibilityservice',
          'android:resource': '@xml/taskmate_accessibility_service'
        }
      }
    ]
  });
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

function addNativePackageHook(mainApplicationPath) {
  if (!fs.existsSync(mainApplicationPath)) {
    return;
  }
  const source = fs.readFileSync(mainApplicationPath, 'utf8');
  if (source.includes('add(TaskMateFocusPackage())')) {
    return;
  }
  const target = '          // add(MyReactNativePackage())\n';
  if (!source.includes(target)) {
    return;
  }
  fs.writeFileSync(
    mainApplicationPath,
    source.replace(target, '          add(TaskMateFocusPackage())\n')
  );
}

function widgetBackgroundXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="@color/taskmate_widget_background" />
  <stroke android:width="1dp" android:color="@color/taskmate_widget_border" />
  <corners android:radius="24dp" />
  <padding android:bottom="12dp" android:left="12dp" android:right="12dp" android:top="12dp" />
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
  android:gravity="center_vertical"
  android:orientation="horizontal"
  android:padding="10dp">

  <ImageView
    android:id="@+id/taskmate_widget_character"
    android:layout_width="58dp"
    android:layout_height="58dp"
    android:adjustViewBounds="true"
    android:contentDescription="@string/taskmate_widget_character"
    android:scaleType="fitCenter"
    android:src="@drawable/taskmate_chara1_wait" />

  <LinearLayout
    android:layout_width="0dp"
    android:layout_height="wrap_content"
    android:layout_marginStart="10dp"
    android:layout_weight="1"
    android:orientation="vertical">

    <TextView
      android:id="@+id/taskmate_widget_status"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:ellipsize="end"
      android:maxLines="1"
      android:text="@string/taskmate_widget_subtitle_default"
      android:textColor="@color/taskmate_widget_accent"
      android:textSize="12sp"
      android:textStyle="bold" />

    <TextView
      android:id="@+id/taskmate_widget_title"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:layout_marginTop="2dp"
      android:ellipsize="end"
      android:maxLines="2"
      android:text="@string/taskmate_widget_subtitle_default"
      android:textColor="@color/taskmate_widget_primary"
      android:textSize="15sp"
      android:textStyle="bold" />

    <TextView
      android:id="@+id/taskmate_widget_progress"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:layout_marginTop="2dp"
      android:ellipsize="end"
      android:maxLines="1"
      android:text="@string/taskmate_widget_count_default"
      android:textColor="@color/taskmate_widget_muted"
      android:textSize="12sp" />

    <TextView
      android:id="@+id/taskmate_widget_blocked"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:layout_marginTop="1dp"
      android:ellipsize="end"
      android:maxLines="1"
      android:text=""
      android:textColor="@color/taskmate_widget_muted"
      android:textSize="11sp" />
  </LinearLayout>
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
  android:minResizeWidth="180dp"
  android:minWidth="180dp"
  android:previewImage="@drawable/taskmate_chara1_wait"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="1800000"
  android:widgetCategory="home_screen" />
`;
}

function accessibilityServiceXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
  android:accessibilityEventTypes="typeWindowStateChanged"
  android:accessibilityFeedbackType="feedbackGeneric"
  android:canPerformGestures="false"
  android:canRetrieveWindowContent="false"
  android:description="@string/taskmate_accessibility_description"
  android:isAccessibilityTool="false"
  android:notificationTimeout="300" />
`;
}

function writeNativeSource(javaRoot, fileName, source) {
  writeFileIfChanged(path.join(javaRoot, fileName), source);
}

function ensureRawManifestPermissionRemovals(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return;
  }
  let source = fs.readFileSync(manifestPath, 'utf8');
  for (const permission of REMOVED_PERMISSIONS) {
    const pattern = new RegExp(
      `\\n?\\s*<uses-permission\\b(?=[^>]*android:name="${permission.replace(/\./g, '\\.')}")[^>]*/>`,
      'g'
    );
    source = source.replace(pattern, '');
  }
  const removalLines = REMOVED_PERMISSIONS.map(
    (permission) => `  <uses-permission android:name="${permission}" tools:node="remove"/>`
  ).join('\n');
  source = source.replace(/(<manifest\b[^>]*>)/, `$1\n${removalLines}`);
  writeFileIfChanged(manifestPath, source);
}

function upsertGradleProperty(filePath, key, value) {
  const line = `${key}=${value}`;
  const source = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const lines = source.split(/\r?\n/);
  const index = lines.findIndex((item) => item.startsWith(`${key}=`));
  if (index >= 0) {
    lines[index] = line;
  } else {
    if (lines.length > 0 && lines[lines.length - 1] !== '') {
      lines.push('');
    }
    lines.push(line);
  }
  writeFileIfChanged(filePath, lines.join('\n'));
}

function appendProguardRules(filePath) {
  const source = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (source.includes('com.taskmate.mobile.TaskMateFocusModule')) {
    return;
  }
  writeFileIfChanged(filePath, `${source.trimEnd()}\n${PROGUARD_RULES}`);
}

function patchBuildGradle(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  let source = fs.readFileSync(filePath, 'utf8');
  const uploadSigningVars = `def taskMateUploadSigningProperties = new Properties()
def taskMateUploadSigningPropertiesFile = rootProject.file('taskmate-upload-key.properties')
if (taskMateUploadSigningPropertiesFile.exists()) {
    taskMateUploadSigningPropertiesFile.withInputStream { taskMateUploadSigningProperties.load(it) }
}
def taskMateUploadStoreFile = findProperty('TASKMATE_UPLOAD_STORE_FILE') ?: System.getenv('TASKMATE_UPLOAD_STORE_FILE') ?: taskMateUploadSigningProperties['storeFile']
def taskMateUploadStorePassword = findProperty('TASKMATE_UPLOAD_STORE_PASSWORD') ?: System.getenv('TASKMATE_UPLOAD_STORE_PASSWORD') ?: taskMateUploadSigningProperties['storePassword']
def taskMateUploadKeyAlias = findProperty('TASKMATE_UPLOAD_KEY_ALIAS') ?: System.getenv('TASKMATE_UPLOAD_KEY_ALIAS') ?: taskMateUploadSigningProperties['keyAlias']
def taskMateUploadKeyPassword = findProperty('TASKMATE_UPLOAD_KEY_PASSWORD') ?: System.getenv('TASKMATE_UPLOAD_KEY_PASSWORD') ?: taskMateUploadSigningProperties['keyPassword']
def hasTaskMateUploadSigning = taskMateUploadStoreFile && taskMateUploadStorePassword && taskMateUploadKeyAlias && taskMateUploadKeyPassword
`;

  const legacyUploadStart = source.indexOf('def taskMateUploadStoreFile');
  const currentUploadStart = source.indexOf('def taskMateUploadSigningProperties');
  const uploadStart =
    currentUploadStart >= 0
      ? currentUploadStart
      : legacyUploadStart >= 0
        ? legacyUploadStart
        : -1;
  if (uploadStart >= 0) {
    const uploadEndLine =
      'def hasTaskMateUploadSigning = taskMateUploadStoreFile && taskMateUploadStorePassword && taskMateUploadKeyAlias && taskMateUploadKeyPassword';
    const uploadEnd = source.indexOf(uploadEndLine, uploadStart);
    if (uploadEnd < 0) {
      throw new Error('Could not find TaskMate upload signing block end in Android build.gradle.');
    }
    let afterUploadEnd = uploadEnd + uploadEndLine.length;
    if (source.slice(afterUploadEnd, afterUploadEnd + 2) === '\r\n') {
      afterUploadEnd += 2;
    } else if (source[afterUploadEnd] === '\n') {
      afterUploadEnd += 1;
    }
    source = `${source.slice(0, uploadStart)}${uploadSigningVars}${source.slice(afterUploadEnd)}`;
  } else {
    const marker =
      "def enableMinifyInReleaseBuilds = (findProperty('android.enableMinifyInReleaseBuilds') ?: false).toBoolean()\n";
    if (!source.includes(marker)) {
      throw new Error('Could not find enableMinifyInReleaseBuilds block in Android build.gradle.');
    }
    source = source.replace(marker, `${marker}${uploadSigningVars}`);
  }

  if (!source.includes('storeFile file(taskMateUploadStoreFile)')) {
    const debugSigningBlock = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
`;
    const releaseSigningBlock = `${debugSigningBlock}        release {
            if (hasTaskMateUploadSigning) {
                storeFile file(taskMateUploadStoreFile)
                storePassword taskMateUploadStorePassword
                keyAlias taskMateUploadKeyAlias
                keyPassword taskMateUploadKeyPassword
            }
        }
`;
    if (!source.includes(debugSigningBlock)) {
      throw new Error('Could not find debug signingConfig block in Android build.gradle.');
    }
    source = source.replace(debugSigningBlock, releaseSigningBlock);
  }

  source = source.replace(
    /(buildTypes\s*\{[\s\S]*?debug\s*\{\s*)signingConfig hasTaskMateUploadSigning \? signingConfigs\.release : signingConfigs\.debug/,
    '$1signingConfig signingConfigs.debug'
  );
  source = source.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig (?:signingConfigs\.debug|hasTaskMateUploadSigning \? signingConfigs\.release : signingConfigs\.debug)/,
    '$1signingConfig hasTaskMateUploadSigning ? signingConfigs.release : signingConfigs.debug'
  );

  writeFileIfChanged(filePath, source);
}

function removeDuplicateLauncherWebp(resRoot) {
  if (!fs.existsSync(resRoot)) {
    return;
  }
  for (const entry of fs.readdirSync(resRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('mipmap-')) {
      continue;
    }
    const mipmapDir = path.join(resRoot, entry.name);
    for (const name of LAUNCHER_MIPMAP_NAMES) {
      const pngPath = path.join(mipmapDir, `${name}.png`);
      const webpPath = path.join(mipmapDir, `${name}.webp`);
      if (fs.existsSync(pngPath) && fs.existsSync(webpPath)) {
        fs.unlinkSync(webpPath);
      }
    }
  }
}

function withTaskMateWidget(config) {
  config = withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = addNativeEntries(modConfig.modResults);
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

      ensureRawManifestPermissionRemovals(path.join(mainRoot, 'AndroidManifest.xml'));
      upsertGradleProperty(
        path.join(androidRoot, 'gradle.properties'),
        'android.enableMinifyInReleaseBuilds',
        'true'
      );
      upsertGradleProperty(
        path.join(androidRoot, 'gradle.properties'),
        'android.enableShrinkResourcesInReleaseBuilds',
        'true'
      );
      patchBuildGradle(path.join(androidRoot, 'app', 'build.gradle'));
      appendProguardRules(path.join(androidRoot, 'app', 'proguard-rules.pro'));
      removeDuplicateLauncherWebp(resRoot);
      writeFileIfChanged(
        path.join(resRoot, 'drawable', 'taskmate_widget_background.xml'),
        widgetBackgroundXml()
      );
      writeFileIfChanged(path.join(resRoot, 'layout', 'taskmate_widget.xml'), widgetLayoutXml());
      writeFileIfChanged(path.join(resRoot, 'xml', 'taskmate_widget_info.xml'), widgetInfoXml());
      writeFileIfChanged(
        path.join(resRoot, 'xml', 'taskmate_accessibility_service.xml'),
        accessibilityServiceXml()
      );
      copyFileIfChanged(
        charaSource,
        path.join(resRoot, 'drawable-nodpi', 'taskmate_chara1_wait.png')
      );
      addWidgetPauseHook(path.join(javaRoot, 'MainActivity.kt'));
      addNativePackageHook(path.join(javaRoot, 'MainApplication.kt'));
      for (const fileName of [
        'TaskMateAccessibilityService.kt',
        'TaskMateBootReceiver.kt',
        'TaskMateFocusModule.kt',
        'TaskMateFocusPackage.kt',
        'TaskMateWidgetProvider.kt'
      ]) {
        const sourcePath = path.join(NATIVE_SOURCE_ROOT, fileName);
        if (!fs.existsSync(sourcePath)) {
          throw new Error(`Missing TaskMate native source template: ${sourcePath}`);
        }
        writeNativeSource(javaRoot, fileName, fs.readFileSync(sourcePath, 'utf8'));
      }
      return modConfig;
    }
  ]);
}

module.exports = withTaskMateWidget;
