package com.nocode.agent.network

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.nocode.agent.AutomationAccessibilityService
import okhttp3.*
import okio.ByteString
import org.json.JSONObject

class AgentWebSocketClient(private val url: String) {

    private val client = OkHttpClient()
    private var webSocket: WebSocket? = null
    private val TAG = "AgentWebSocketClient"
    private val mainHandler = Handler(Looper.getMainLooper())
    private var isConnected = false
    private var shouldReconnect = true

    fun connect() {
        shouldReconnect = true
        val request = Request.Builder().url(url).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                isConnected = true
                Log.d(TAG, "WebSocket connected successfully")
                registerDevice()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d(TAG, "Message received: $text")
                handleIncomingMessage(text)
            }

            override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                // Handle binary payloads (if any)
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                isConnected = false
                Log.d(TAG, "WebSocket closing: $code / $reason")
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                isConnected = false
                Log.d(TAG, "WebSocket closed")
                if (shouldReconnect) {
                    scheduleReconnect()
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                isConnected = false
                Log.e(TAG, "WebSocket failure: ${t.message}")
                if (shouldReconnect) {
                    scheduleReconnect()
                }
            }
        })
    }

    private fun registerDevice() {
        // Send device registration payload
        val registerJson = JSONObject().apply {
            put("event", "register")
            put("deviceId", android.os.Build.MODEL + "_" + android.os.Build.ID)
            put("deviceType", "android")
            put("osVersion", android.os.Build.VERSION.RELEASE)
        }
        send(registerJson.toString())
    }

    private fun handleIncomingMessage(text: String) {
        try {
            val json = JSONObject(text)
            val action = json.optString("action")
            val id = json.optString("messageId")

            if (action.isNotEmpty()) {
                val service = AutomationAccessibilityService.instance
                if (service != null) {
                    // Execute command on main/UI thread context if needed
                    val response = service.handleCommand(text)
                    val reply = JSONObject(response).apply {
                        put("event", "commandResult")
                        put("messageId", id)
                    }
                    send(reply.toString())
                } else {
                    val reply = JSONObject().apply {
                        put("event", "commandResult")
                        put("messageId", id)
                        put("status", "error")
                        put("error", "Accessibility Service not enabled")
                    }
                    send(reply.toString())
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing websocket message: ${e.message}")
        }
    }

    fun send(text: String) {
        if (isConnected) {
            webSocket?.send(text)
        } else {
            Log.w(TAG, "Cannot send message, WebSocket not connected")
        }
    }

    fun disconnect() {
        shouldReconnect = false
        webSocket?.close(1000, "App closed")
        client.dispatcher.executorService.shutdown()
    }

    private fun scheduleReconnect() {
        mainHandler.postDelayed({
            Log.d(TAG, "Attempting to reconnect WebSocket...")
            connect()
        }, 5000)
    }
}
