package com.nocode.agent.ocr

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.json.JSONArray
import org.json.JSONObject

object OcrHelper {

    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    interface OcrCallback {
        fun onSuccess(result: JSONObject)
        fun onFailure(e: Exception)
    }

    fun detectText(bitmap: Bitmap, callback: OcrCallback) {
        val image = InputImage.fromBitmap(bitmap, 0)
        recognizer.process(image)
            .addOnSuccessListener { visionText ->
                val resultJson = JSONObject()
                val blocksArray = JSONArray()

                for (block in visionText.textBlocks) {
                    val blockJson = JSONObject()
                    blockJson.put("text", block.text)
                    blockJson.put("confidence", block.lines.firstOrNull()?.confidence ?: 1.0f)

                    val boundingBox = block.boundingBox
                    if (boundingBox != null) {
                        blockJson.put("left", boundingBox.left)
                        blockJson.put("top", boundingBox.top)
                        blockJson.put("right", boundingBox.right)
                        blockJson.put("bottom", boundingBox.bottom)
                    }

                    val linesArray = JSONArray()
                    for (line in block.lines) {
                        val lineJson = JSONObject()
                        lineJson.put("text", line.text)
                        
                        val lineBox = line.boundingBox
                        if (lineBox != null) {
                            lineJson.put("left", lineBox.left)
                            lineJson.put("top", lineBox.top)
                            lineJson.put("right", lineBox.right)
                            lineJson.put("bottom", lineBox.bottom)
                        }
                        linesArray.put(lineJson)
                    }
                    blockJson.put("lines", linesArray)
                    blocksArray.put(blockJson)
                }

                resultJson.put("status", "success")
                resultJson.put("text", visionText.text)
                resultJson.put("blocks", blocksArray)
                callback.onSuccess(resultJson)
            }
            .addOnFailureListener { e ->
                callback.onFailure(e)
            }
    }
}
