package com.nocode.agent.mirror

import android.app.*
import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import com.nocode.agent.AutomationAccessibilityService
import org.json.JSONObject
import java.io.OutputStream
import java.net.Socket
import java.nio.ByteBuffer
import kotlin.concurrent.thread

class ScreenMirrorService : Service() {

    private val TAG = "ScreenMirrorService"
    private val CHANNEL_ID = "ScreenMirrorChannel"
    private val NOTIFICATION_ID = 2

    private var mediaProjection: MediaProjection? = null
    private var mediaCodec: MediaCodec? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var isStreaming = false
    private var streamThread: Thread? = null
    private var socket: Socket? = null
    private var outputStream: OutputStream? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val resultCode = intent?.getIntExtra("resultCode", Activity.RESULT_CANCELED) ?: Activity.RESULT_CANCELED
        val resultData = intent?.getParcelableExtra<Intent>("resultData")

        if (resultCode == Activity.RESULT_OK && resultData != null) {
            startForegroundServiceNotification()
            startScreenCapture(resultCode, resultData)
        } else {
            stopSelf()
        }

        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Screen Mirroring Service Channel",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    private fun startForegroundServiceNotification() {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Screen Mirroring Active")
            .setContentText("Streaming screen to Automation Control Center...")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .build()
        startForeground(NOTIFICATION_ID, notification)
    }

    private fun startScreenCapture(resultCode: Int, resultData: Intent) {
        val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjection = projectionManager.getMediaProjection(resultCode, resultData)

        val windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        windowManager.defaultDisplay.getRealMetrics(metrics)
        val width = 720 // Lower resolution to scale network bandwidth
        val height = 1280
        val dpi = metrics.densityDpi

        // Configure H.264 Encoder
        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height)
        format.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
        format.setInteger(MediaFormat.KEY_BIT_RATE, 1000000) // 1 Mbps
        format.setInteger(MediaFormat.KEY_FRAME_RATE, 30)
        format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)

        mediaCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        mediaCodec?.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        val inputSurface = mediaCodec?.createInputSurface()

        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "ScreenMirror",
            width, height, dpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            inputSurface, null, null
        )

        mediaCodec?.start()
        isStreaming = true

        streamThread = thread(start = true) {
            try {
                // Connect back to Server Streaming Gateway (Port 3001)
                socket = Socket("127.0.0.1", 3001)
                outputStream = socket?.getOutputStream()

                // Send initial device meta-data
                val header = JSONObject().apply {
                    put("deviceId", Build.MODEL + "_" + Build.ID)
                    put("width", width)
                    put("height", height)
                }
                outputStream?.write((header.toString() + "\n").toByteArray())
                outputStream?.flush()

                val bufferInfo = MediaCodec.BufferInfo()
                while (isStreaming) {
                    val outputBufferIndex = mediaCodec?.dequeueOutputBuffer(bufferInfo, 10000) ?: -1
                    if (outputBufferIndex >= 0) {
                        val outputBuffer = mediaCodec?.getOutputBuffer(outputBufferIndex)
                        if (outputBuffer != null) {
                            outputBuffer.position(bufferInfo.offset)
                            outputBuffer.limit(bufferInfo.offset + bufferInfo.size)

                            val bytes = ByteArray(bufferInfo.size)
                            outputBuffer.get(bytes)

                            // Send raw Annex-B NAL packet to socket
                            outputStream?.write(bytes)
                            outputStream?.flush()
                        }
                        mediaCodec?.releaseOutputBuffer(outputBufferIndex, false)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Streaming connection error: ${e.message}")
            } finally {
                stopScreenCapture()
            }
        }
    }

    private fun stopScreenCapture() {
        isStreaming = false
        try {
            outputStream?.close()
            socket?.close()
        } catch (e: Exception) {}

        virtualDisplay?.release()
        virtualDisplay = null

        mediaCodec?.stop()
        mediaCodec?.release()
        mediaCodec = null

        mediaProjection?.stop()
        mediaProjection = null

        Log.d(TAG, "Screen capturing stopped.")
    }

    override fun onDestroy() {
        super.onDestroy()
        stopScreenCapture()
    }
}
