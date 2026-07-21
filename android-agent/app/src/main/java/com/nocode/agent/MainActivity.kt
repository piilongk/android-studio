package com.nocode.agent

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.nocode.agent.mirror.ScreenMirrorService
import rikka.shizuku.Shizuku

class MainActivity : AppCompatActivity() {

    private val REQUEST_MEDIA_PROJECTION = 1000
    private lateinit var tvAccessibilityStatus: TextView
    private lateinit var tvMirrorStatus: TextView
    private lateinit var tvShizukuStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvAccessibilityStatus = findViewById(R.id.tvAccessibilityStatus)
        tvMirrorStatus = findViewById(R.id.tvMirrorStatus)
        tvShizukuStatus = findViewById(R.id.tvShizukuStatus)

        findViewById<Button>(R.id.btnEnableAccessibility).setOnClickListener {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            startActivity(intent)
        }

        findViewById<Button>(R.id.btnStartMirror).setOnClickListener {
            startMirroringRequest()
        }

        checkShizuku()
    }

    override fun onResume() {
        super.onResume()
        updateServiceStatus()
    }

    private fun updateServiceStatus() {
        val isAccessibilityEnabled = AutomationAccessibilityService.instance != null
        if (isAccessibilityEnabled) {
            tvAccessibilityStatus.text = "Accessibility Service: Enabled"
            tvAccessibilityStatus.setTextColor(0xFF00FF00.toInt())
        } else {
            tvAccessibilityStatus.text = "Accessibility Service: Disabled"
            tvAccessibilityStatus.setTextColor(0xFFFF0000.toInt())
        }
    }

    private fun startMirroringRequest() {
        val mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        startActivityForResult(mediaProjectionManager.createScreenCaptureIntent(), REQUEST_MEDIA_PROJECTION)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_MEDIA_PROJECTION) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                tvMirrorStatus.text = "Screen Stream: Active"
                tvMirrorStatus.setTextColor(0xFF00FF00.toInt())

                val serviceIntent = Intent(this, ScreenMirrorService::class.java).apply {
                    putExtra("resultCode", resultCode)
                    putExtra("resultData", data)
                }
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    startForegroundService(serviceIntent)
                } else {
                    startService(serviceIntent)
                }
            } else {
                tvMirrorStatus.text = "Screen Stream: Rejected"
                tvMirrorStatus.setTextColor(0xFFFF0000.toInt())
            }
        }
    }

    private fun checkShizuku() {
        try {
            val available = Shizuku.pingBinder()
            if (available) {
                tvShizukuStatus.text = "Shizuku: Connected"
                tvShizukuStatus.setTextColor(0xFF00FF00.toInt())
            } else {
                tvShizukuStatus.text = "Shizuku: Disconnected"
                tvShizukuStatus.setTextColor(0xFFFF0000.toInt())
            }
        } catch (e: Exception) {
            tvShizukuStatus.text = "Shizuku: Not Installed"
            tvShizukuStatus.setTextColor(0xFF888888.toInt())
        }
    }
}
