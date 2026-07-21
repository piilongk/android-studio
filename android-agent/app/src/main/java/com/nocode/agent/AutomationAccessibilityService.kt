package com.nocode.agent

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.nocode.agent.network.AgentWebSocketClient
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

class AutomationAccessibilityService : AccessibilityService() {

    private var socketClient: AgentWebSocketClient? = null
    private val TAG = "AutomationService"

    companion object {
        var instance: AutomationAccessibilityService? = null
            private set
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.d(TAG, "Accessibility Service Connected")
        // Initialize WebSocket connection to Backend Orchestrator
        // Connecting to localhost dev server by default, can be updated via UI
        socketClient = AgentWebSocketClient("ws://10.0.2.2:3000/device")
        socketClient?.connect()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Broadcast screen updates or window state changes
        if (event?.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
            event?.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            sendScreenUpdate()
        }
    }

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility Service Interrupted")
        instance = null
    }

    override fun onDestroy() {
        super.onDestroy()
        socketClient?.disconnect()
        instance = null
    }

    // Handles incoming automation requests from WebSocket
    fun handleCommand(commandJson: String): String {
        try {
            val json = JSONObject(commandJson)
            val action = json.getString("action")
            val payload = json.optJSONObject("payload") ?: JSONObject()

            return when (action) {
                "click" -> executeClick(payload)
                "input" -> executeInput(payload)
                "swipe" -> executeSwipe(payload)
                "dumpTree" -> executeDumpTree()
                "pressKey" -> executePressKey(payload)
                else -> errorResponse("Unknown action: $action")
            }
        } catch (e: Exception) {
            return errorResponse(e.message ?: "Unknown execution error")
        }
    }

    private fun executeClick(payload: JSONObject): String {
        val type = payload.optString("type", "coordinates")
        if (type == "coordinates") {
            val x = payload.getInt("x")
            val y = payload.getInt("y")
            return if (clickAtCoordinates(x.toFloat(), y.toFloat())) {
                successResponse("Clicked coordinates: ($x, $y)")
            } else {
                errorResponse("Failed to dispatch click gesture")
            }
        } else {
            val value = payload.getString("value")
            val node = findNodeBySelector(type, value)
            return if (node != null) {
                if (node.isClickable) {
                    node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                    successResponse("Clicked node using $type: $value")
                } else {
                    // Fallback to coordinate click on node bounds
                    val rect = Rect()
                    node.getBoundsInScreen(rect)
                    if (clickAtCoordinates(rect.centerX().toFloat(), rect.centerY().toFloat())) {
                        successResponse("Clicked center of node using $type: $value")
                    } else {
                        errorResponse("Node not clickable and gesture failed")
                    }
                }
            } else {
                errorResponse("Node not found for $type: $value")
            }
        }
    }

    private fun executeInput(payload: JSONObject): String {
        val selectorType = payload.getString("selectorType")
        val selectorValue = payload.getString("selectorValue")
        val text = payload.getString("text")

        val node = findNodeBySelector(selectorType, selectorValue)
        return if (node != null) {
            val arguments = Bundle()
            arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
            val success = node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
            if (success) {
                successResponse("Text set successfully")
            } else {
                errorResponse("Failed to perform input action")
            }
        } else {
            errorResponse("Input field node not found")
        }
    }

    private fun executeSwipe(payload: JSONObject): String {
        val startX = payload.getInt("startX").toFloat()
        val startY = payload.getInt("startY").toFloat()
        val endX = payload.getInt("endX").toFloat()
        val endY = payload.getInt("endY").toFloat()
        val duration = payload.optLong("duration", 500)

        val path = Path().apply {
            moveTo(startX, startY)
            lineTo(endX, endY)
        }

        val gestureBuilder = GestureDescription.Builder()
        val stroke = GestureDescription.StrokeDescription(path, 0, duration)
        gestureBuilder.addStroke(stroke)

        var completed = false
        var success = false

        dispatchGesture(gestureBuilder.build(), object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                success = true
                completed = true
            }
            override fun onCancelled(gestureDescription: GestureDescription?) {
                success = false
                completed = true
            }
        }, null)

        // Wait synchronously for gesture completion (limited loop)
        val timeout = System.currentTimeMillis() + duration + 1000
        while (!completed && System.currentTimeMillis() < timeout) {
            Thread.sleep(20)
        }

        return if (success) {
            successResponse("Swipe completed")
        } else {
            errorResponse("Swipe cancelled or timed out")
        }
    }

    private fun executeDumpTree(): String {
        val root = rootInActiveWindow ?: return errorResponse("No active window root")
        val rootJson = nodeToJson(root)
        val response = JSONObject().apply {
            put("status", "success")
            put("tree", rootJson)
        }
        return response.toString()
    }

    private fun executePressKey(payload: JSONObject): String {
        val key = payload.getString("key") // HOME, BACK, RECENTS
        val success = when (key.uppercase()) {
            "BACK" -> performGlobalAction(GLOBAL_ACTION_BACK)
            "HOME" -> performGlobalAction(GLOBAL_ACTION_HOME)
            "RECENTS" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
            "NOTIFICATIONS" -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
            else -> false
        }
        return if (success) {
            successResponse("Key $key pressed")
        } else {
            errorResponse("Failed to press key $key")
        }
    }

    private fun clickAtCoordinates(x: Float, y: Float): Boolean {
        val path = Path().apply { moveTo(x, y) }
        val stroke = GestureDescription.StrokeDescription(path, 0, 50)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()

        var completed = false
        var success = false
        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                success = true
                completed = true
            }
            override fun onCancelled(gestureDescription: GestureDescription?) {
                success = false
                completed = true
            }
        }, null)

        val timeout = System.currentTimeMillis() + 1000
        while (!completed && System.currentTimeMillis() < timeout) {
            Thread.sleep(10)
        }
        return success
    }

    private fun findNodeBySelector(type: String, value: String): AccessibilityNodeInfo? {
        val root = rootInActiveWindow ?: return null
        return when (type) {
            "id" -> {
                val nodes = root.findAccessibilityNodeInfosByViewId(value)
                nodes.firstOrNull()
            }
            "text" -> {
                val nodes = root.findAccessibilityNodeInfosByText(value)
                nodes.firstOrNull { it.text?.toString() == value }
            }
            "description" -> {
                findNodeByPredicate(root) { it.contentDescription?.toString() == value }
            }
            "xpath" -> {
                // XPath lookup fallback using traversal
                findNodeByXPath(root, value)
            }
            else -> null
        }
    }

    private fun findNodeByPredicate(node: AccessibilityNodeInfo, predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo? {
        if (predicate(node)) return node
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val result = findNodeByPredicate(child, predicate)
            if (result != null) return result
        }
        return null
    }

    private fun findNodeByXPath(root: AccessibilityNodeInfo, xpath: String): AccessibilityNodeInfo? {
        // Simple mock xpath parser supporting basics like //android.widget.Button[@text="value"]
        if (xpath.startsWith("//")) {
            val tagAndAttr = xpath.substring(2)
            val className = tagAndAttr.substringBefore("[")
            val attributeName = tagAndAttr.substringAfter("[@").substringBefore("=")
            val attributeVal = tagAndAttr.substringAfter("='").substringBefore("'")

            return findNodeByPredicate(root) { node ->
                val classMatches = className == "*" || node.className?.toString() == className
                val attrMatches = when (attributeName) {
                    "text" -> node.text?.toString() == attributeVal
                    "resource-id" -> node.viewIdResourceName?.toString() == attributeVal
                    "content-desc" -> node.contentDescription?.toString() == attributeVal
                    else -> false
                }
                classMatches && attrMatches
            }
        }
        return null
    }

    private fun nodeToJson(node: AccessibilityNodeInfo): JSONObject {
        val json = JSONObject()
        val rect = Rect()
        node.getBoundsInScreen(rect)

        json.put("className", node.className?.toString() ?: "")
        json.put("text", node.text?.toString() ?: "")
        json.put("resourceId", node.viewIdResourceName ?: "")
        json.put("contentDescription", node.contentDescription?.toString() ?: "")
        json.put("clickable", node.isClickable)
        json.put("focusable", node.isFocusable)
        json.put("bounds", "[${rect.left},${rect.top}][${rect.right},${rect.bottom}]")

        val childrenArray = JSONArray()
        for (i in 0 until node.childCount) {
            val child = node.getChild(i)
            if (child != null) {
                childrenArray.put(nodeToJson(child))
            }
        }
        json.put("children", childrenArray)
        return json
    }

    private fun sendScreenUpdate() {
        val root = rootInActiveWindow ?: return
        val rootJson = nodeToJson(root)
        val update = JSONObject().apply {
            put("event", "screenUpdate")
            put("tree", rootJson)
        }
        socketClient?.send(update.toString())
    }

    private fun successResponse(message: String): String {
        return JSONObject().put("status", "success").put("message", message).toString()
    }

    private fun errorResponse(error: String): String {
        return JSONObject().put("status", "error").put("error", error).toString()
    }
}
