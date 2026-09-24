package com.shortcutrevised

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.*

class OverlayPermissionModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OverlayPermissionModule"

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        try {
            val result = Settings.canDrawOverlays(reactContext)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check overlay permission", e)
        }
    }

    @ReactMethod
    fun requestOverlayPermission() {
        val context = reactContext
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + context.packageName)
            )
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }
}
