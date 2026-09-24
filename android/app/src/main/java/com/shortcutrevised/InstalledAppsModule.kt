package com.shortcutrevised

import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import com.facebook.react.bridge.*
import android.content.Intent


class InstalledAppsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val context = reactContext

    override fun getName(): String {
        return "InstalledApps"
    }

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = context.packageManager
            val packages = pm.getInstalledPackages(0)

            val appsArray = Arguments.createArray()

            for (pkg in packages) {
                val ai = pkg.applicationInfo
                if (ai != null) {
                    val launchIntent = pm.getLaunchIntentForPackage(ai.packageName)
                    if (launchIntent != null) {
                        val appMap = Arguments.createMap()
                        appMap.putString("appName", ai.loadLabel(pm).toString())
                        appMap.putString("packageName", ai.packageName)
                        appsArray.pushMap(appMap)
                    }
                }
            }

            promise.resolve(appsArray)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun launchApp(packageName: String, promise: Promise) {
        try {
            val intent = context.packageManager.getLaunchIntentForPackage(packageName)
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.reject("NOT_FOUND", "App not found")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

}
