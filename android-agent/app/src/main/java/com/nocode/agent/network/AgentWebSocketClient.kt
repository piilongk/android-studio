package com.nocode.agent.network

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.nocode.agent.AutomationAccessibilityService
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

class AgentWebSocketClient(private val url: String) {

    private var socket: Socket? = null
    private val TAG = "AgentSocketIOClient"
    private val mainHandler = Handler(Looper.getMainLooper())

    fun connect() {
        try {
            val opts = IO.Options().apply {
                transports = arrayOf("websocket")
            }
            // Translate ws:// to http:// for Socket.IO library
            val httpUrl = url.replace("ws://", "http://").replace("wss://", "https://")
            socket = IO.socket(httpUrl, opts)

            socket?.on(Socket.EVENT_CONNECT) {
                Log.d(TAG, "Socket.IO connected successfully")
                registerDevice()
            }

            socket?.on("message") { args ->
                if (args.isNotEmpty()) {
                    val text = args[0] as String
                    Log.d(TAG, "Message received: $text")
                    handleIncomingMessage(text)
                }
            }

            socket?.on(Socket.EVENT_DISCONNECT) {
                Log.d(TAG, "Socket.IO disconnected")
            }

            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                if (args.isNotEmpty()) {
                    val err = args[0]
                    Log.e(TAG, "Socket.IO connection error: $err")
                }
            }

            socket?.connect()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize Socket.IO: ${e.message}")
        }
    }

    private fun registerDevice() {
        val registerJson = JSONObject().apply {
            put("deviceId", android.os.Build.MODEL + "_" + android.os.Build.ID)
            put("deviceType", "android")
            put("osVersion", android.os.Build.VERSION.RELEASE)
        }
        socket?.emit("register", registerJson)
        Log.d(TAG, "Registration payload emitted: $registerJson")
    }

    private fun handleIncomingMessage(text: String) {
        try {
            val json = JSONObject(text)
            val action = json.optString("action")
            val id = json.optString("messageId")

            if (action.isNotEmpty()) {
                val service = AutomationAccessibilityService.instance
                if (service != null) {
                    val response = service.handleCommand(text)
                    val reply = JSONObject(response).apply {
                        put("messageId", id)
                    }
                    socket?.emit("commandResult", reply)
                } else {
                    val reply = JSONObject().apply {
                        put("messageId", id)
                        put("status", "error")
                        put("error", "Accessibility Service not enabled")
                    }
                    socket?.emit("commandResult", reply)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing message: ${e.message}")
        }
    }

    fun send(text: String) {
        try {
            val json = JSONObject(text)
            val event = json.optString("event")
            if (event.isNotEmpty()) {
                socket?.emit(event, json)
            } else {
                socket?.emit("message", text)
            }
        } catch (e: Exception) {
            socket?.emit("message", text)
    }

    fun sendVideoFrame(base64Frame: String) {
        try {
            val json = JSONObject().apply {
                put("deviceId", android.os.Build.MODEL + "_" + android.os.Build.ID)
                put("frame", base64Frame)
            }
            socket?.emit("videoFrame", json)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send video frame: ${e.message}")
        }
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
    }
}
