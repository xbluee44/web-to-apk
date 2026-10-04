#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// ============ CONFIG DARI ENV ============
const cfg = JSON.parse(process.env.BUILD_CONFIG || '{}');
const OUT = path.join(__dirname, '..', 'android-project');

const {
  appName = 'My App',
  packageName = 'com.webtoapk.app',
  webUrl = 'https://example.com',
  version = '1.0.0',
  versionCode = 1,
  splash = 'default',
  splashUrl = '',
  splashColor = '#0f172a',
  permissions = ['INTERNET']
} = cfg;

console.log('🚀 Generating Android project for:', appName);

// ============ UTIL ============
const mk = (p) => fs.mkdirSync(p, { recursive: true });
const write = (p, c) => { mk(path.dirname(p)); fs.writeFileSync(p, c.trim() + '\n'); };

// Bersihkan output lama
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });

// ============ PATH HELPERS ============
const pkgPath = packageName.split('.').join('/');
const javaDir = path.join(OUT, 'app/src/main/java', pkgPath);
const resDir  = path.join(OUT, 'app/src/main/res');

// ============ PERMISSIONS MAP ============
const permMap = {
  INTERNET:     '<uses-permission android:name="android.permission.INTERNET"/>',
  CAMERA:       '<uses-permission android:name="android.permission.CAMERA"/>',
  LOCATION:     '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>',
  STORAGE:      '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>\n    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>',
  NOTIFICATION: '<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>',
  VIBRATE:      '<uses-permission android:name="android.permission.VIBRATE"/>'
};
const permXml = permissions.map(p => permMap[p]).filter(Boolean).join('\n    ');

// ============ 1. build.gradle (root) ============
write(path.join(OUT, 'build.gradle'), `
plugins {
    id 'com.android.application' version '8.2.2' apply false
}
`);

// ============ 2. settings.gradle ============
write(path.join(OUT, 'settings.gradle'), `
pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "${appName.replace(/[^a-zA-Z0-9]/g, '')}"
include ':app'
`);

// ============ 3. gradle.properties ============
write(path.join(OUT, 'gradle.properties'), `
android.useAndroidX=true
android.enableJetifier=true
org.gradle.jvmargs=-Xmx2048m
`);

// ============ 4. app/build.gradle ============
write(path.join(OUT, 'app/build.gradle'), `
plugins { id 'com.android.application' }

android {
    namespace '${packageName}'
    compileSdk 34

    defaultConfig {
        applicationId "${packageName}"
        minSdk 21
        targetSdk 34
        versionCode ${versionCode}
        versionName "${version}"
    }

    signingConfigs {
        release {
            storeFile file("../keystore.jks")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            signingConfig signingConfigs.release
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.webkit:webkit:1.10.0'
    implementation 'com.google.android.material:material:1.11.0'
}
`);

// ============ 5. AndroidManifest.xml ============
write(path.join(OUT, 'app/src/main/AndroidManifest.xml'), `
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    ${permXml}

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.WebToApk"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".SplashActivity"
            android:exported="true"
            android:theme="@style/Theme.Splash">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>

        <activity
            android:name=".MainActivity"
            android:exported="false"
            android:configChanges="orientation|screenSize|keyboardHidden"/>
    </application>
</manifest>
`);

// ============ 6. MainActivity.java ============
write(path.join(javaDir, 'MainActivity.java'), `
package ${packageName};

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.*;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String url = r.getUrl().toString();
                if (url.startsWith("http")) { v.loadUrl(url); return true; }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });

        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(getString(R.string.web_url));
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        webView.saveState(out);
    }
}
`);

// ============ 7. SplashActivity.java ============
const splashDelay = splash === 'loading' ? 2500 : 1500;
write(path.join(javaDir, 'SplashActivity.java'), `
package ${packageName};

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.appcompat.app.AppCompatActivity;

public class SplashActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            startActivity(new Intent(this, MainActivity.class));
            finish();
        }, ${splashDelay});
    }
}
`);

// ============ 8. strings.xml ============
write(path.join(resDir, 'values/strings.xml'), `
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${appName}</string>
    <string name="web_url">${webUrl}</string>
    <string name="splash_url">${splashUrl}</string>
</resources>
`);

// ============ 9. colors.xml ============
write(path.join(resDir, 'values/colors.xml'), `
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="splash_bg">${splashColor}</color>
    <color name="primary">#38bdf8</color>
</resources>
`);

// ============ 10. themes.xml ============
write(path.join(resDir, 'values/themes.xml'), `
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.WebToApk" parent="Theme.MaterialComponents.DayNight.NoActionBar"/>
    <style name="Theme.Splash" parent="Theme.MaterialComponents.DayNight.NoActionBar">
        <item name="android:windowBackground">@color/splash_bg</item>
    </style>
</resources>
`);

// ============ 11. activity_main.xml ============
write(path.join(resDir, 'layout/activity_main.xml'), `
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <WebView
        android:id="@+id/webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent"/>
</FrameLayout>
`);

// ============ 12. activity_splash.xml ============
write(path.join(resDir, 'layout/activity_splash.xml'), `
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/splash_bg">

    <ImageView
        android:id="@+id/splashImage"
        android:layout_width="180dp"
        android:layout_height="180dp"
        android:layout_gravity="center"
        android:src="@mipmap/ic_launcher"/>

    <ProgressBar
        android:id="@+id/splashProgress"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_gravity="center_horizontal|bottom"
        android:layout_marginBottom="100dp"/>
</FrameLayout>
`);

// ============ 13. Copy icon default ============
['mipmap-hdpi', 'mipmap-mdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'].forEach(d => {
  mk(path.join(resDir, d));
});

const iconSrc = path.join(__dirname, 'assets/icon.png');
if (fs.existsSync(iconSrc)) {
  ['mipmap-hdpi', 'mipmap-mdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'].forEach(d => {
    fs.copyFileSync(iconSrc, path.join(resDir, d, 'ic_launcher.png'));
  });
  console.log('✅ Icon copied');
}

// ============ 14. Gradle wrapper ============
write(path.join(OUT, 'gradlew'), `
#!/bin/sh
exec gradle "$@"
`);
fs.chmodSync(path.join(OUT, 'gradlew'), 0o755);

// ============ 15. local.properties ============
write(path.join(OUT, 'local.properties'), `
sdk.dir=${process.env.ANDROID_HOME || '/usr/local/lib/android/sdk'}
`);

console.log('✅ Semua file Android berhasil di-generate!');
console.log('📁 Output:', OUT);
console.log('📦 Package:', packageName);
console.log('🎨 Splash:', splash, splashColor);
console.log('🔐 Permissions:', permissions.join(', '));
