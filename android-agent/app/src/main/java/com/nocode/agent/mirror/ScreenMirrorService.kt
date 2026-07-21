package com.nocode.agent.mirror

import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.Base64
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import com.nocode.agent.AutomationAccessibilityService
import java.io.ByteArrayOutputStream
import kotlin.concurrent.thread

class ScreenMirrorService : Service() {

    private val TAG = "ScreenMirrorService"
    private val CHANNEL_ID = "ScreenMirrorChannel"
    private val NOTIFICATION_ID = 2

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var isStreaming = false
    private var captureThread: Thread? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "START_MIRROR") {
            val resultCode = intent.getIntExtra("resultCode", Activity.RESULT_CANCELED)
            val resultData = intent.getParcelableExtra<Intent>("resultData")
            if (resultCode == Activity.RESULT_OK && resultData != null) {
                startForegroundServiceWithNotification()
                startScreenCapture(resultCode, resultData)
            }
        } else if (intent?.action == "STOP_MIRROR") {
            stopScreenCapture()
            stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Screen Mirroring Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun startForegroundServiceWithNotification() {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Screen Mirroring Active")
            .setContentText("Your screen is being streamed to the No-Code Studio")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .build()
        startForeground(NOTIFICATION_ID, notification)
    }

    @SuppressLint("WrongConstant")
    private fun startScreenCapture(resultCode: Int, resultData: Intent) {
        val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjection = projectionManager.getMediaProjection(resultCode, resultData)

        val windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        windowManager.defaultDisplay.getRealMetrics(metrics)
        val width = 720
        val height = 1280
        val dpi = metrics.densityDpi

        // Setup ImageReader for JPEG capture
        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)

        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "ScreenMirror",
            width, height, dpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader?.surface, null, null
        )

        isStreaming = true
        var lastCaptureTime = 0L

        imageReader?.setOnImageAvailableListener({ reader ->
            if (!isStreaming) return@setOnImageAvailableListener
            
            // Limit FPS to around 10-15 frames per second for Web WebSocket
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastCaptureTime < 100) {
                val img = reader.acquireLatestImage()
                img?.close()
                return@setOnImageAvailableListener
            }
            lastCaptureTime = currentTime

            var image: Image? = null
            try {
                image = reader.acquireLatestImage()
                if (image != null) {
                    val planes = image.planes
                    val buffer = planes[0].buffer
                    val pixelStride = planes[0].pixelStride
                    val rowStride = planes[0].rowStride
                    val rowPadding = rowStride - pixelStride * width

                    val bitmapWidth = width + rowPadding / pixelStride
                    val bitmap = Bitmap.createBitmap(bitmapWidth, height, Bitmap.Config.ARGB_8888)
                    bitmap.copyPixelsFromBuffer(buffer)

                    // Crop out the padding
                    val croppedBitmap = Bitmap.createBitmap(bitmap, 0, 0, width, height)

                    // Compress to JPEG
                    val out = ByteArrayOutputStream()
                    croppedBitmap.compress(Bitmap.CompressFormat.JPEG, 40, out)
                    val base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)

                    // Send via Socket.IO
                    val service = AutomationAccessibilityService.instance
                    service?.socketClient?.sendVideoFrame(base64)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error processing frame: ${e.message}")
            } finally {
                image?.close()
            }
        }, null)
    }

    private fun stopScreenCapture() {
        Log.d(TAG, "Screen capturing stopped.")
        isStreaming = false
        virtualDisplay?.release()
        imageReader?.close()
        mediaProjection?.stop()
    }
}
