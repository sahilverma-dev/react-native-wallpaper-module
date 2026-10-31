package expo.modules.wallpaper

import android.content.Context
import android.net.Uri
import java.io.BufferedInputStream
import java.io.Closeable
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URI
import java.net.UnknownHostException

/**
 * A wallpaper stream plus the cleanup required after `WallpaperManager` is
 * done with it. Local files are closed; HTTP connections are disconnected.
 */
internal class WallpaperImageSource(
  val stream: InputStream,
  private val onClose: () -> Unit
) : Closeable {
  override fun close() {
    try {
      stream.close()
    } catch (_: IOException) {
      // The stream is already unusable; nothing useful to do here.
    }
    onClose()
  }
}

/**
 * Turns a JavaScript URI into an InputStream without ever buffering the whole
 * image in memory or crossing the bridge as base64.
 */
internal object WallpaperImageSourceResolver {
  private const val CONNECT_TIMEOUT_MS = 20_000
  private const val READ_TIMEOUT_MS = 30_000
  private const val BUFFER_SIZE = 16 * 1024
  private const val HEADER_SIZE = 12
  private const val USER_AGENT = "wallpaper-module/0.1.0"

  fun open(context: Context, uriString: String): WallpaperImageSource {
    val trimmed = uriString.trim()
    if (trimmed.isEmpty()) {
      throw WallpaperException(WallpaperErrorCode.INVALID_URI, "The image URI must not be empty.")
    }

    val uri = Uri.parse(trimmed)
    val scheme = uri.scheme?.lowercase()

    val source = when (scheme) {
      null, "" -> openFile(trimmed)
      "file" -> openFile(uri.path ?: throw invalidUri(trimmed))
      "content" -> openContent(context, uri)
      "http", "https" -> openRemote(trimmed)
      else -> throw WallpaperException(
        WallpaperErrorCode.INVALID_URI,
        "Unsupported URI scheme \"$scheme:\". Use \"file://\", \"content://\", \"http://\" or \"https://\"."
      )
    }

    val buffered = BufferedInputStream(source.stream, BUFFER_SIZE)
    try {
      validateFormat(buffered)
    } catch (error: Throwable) {
      source.close()
      throw error
    }

    return WallpaperImageSource(buffered) { source.close() }
  }

  private fun invalidUri(value: String) = WallpaperException(
    WallpaperErrorCode.INVALID_URI,
    "Invalid image URI \"$value\"."
  )

  private fun openFile(path: String): WallpaperImageSource {
    val file = File(path)
    if (!file.exists() || !file.isFile) {
      throw WallpaperException(
        WallpaperErrorCode.IMAGE_NOT_FOUND,
        "The image file does not exist: $path"
      )
    }
    if (!file.canRead()) {
      throw WallpaperException(
        WallpaperErrorCode.IMAGE_NOT_FOUND,
        "The image file cannot be read: $path"
      )
    }

    val stream = try {
      FileInputStream(file)
    } catch (error: IOException) {
      throw WallpaperException(
        WallpaperErrorCode.IMAGE_NOT_FOUND,
        "The image file could not be opened: $path",
        error
      )
    }

    return WallpaperImageSource(stream) {}
  }

  private fun openContent(context: Context, uri: Uri): WallpaperImageSource {
    val stream = try {
      context.contentResolver.openInputStream(uri)
    } catch (error: SecurityException) {
      throw WallpaperException(
        WallpaperErrorCode.IMAGE_NOT_FOUND,
        "No permission to read the image at $uri.",
        error
      )
    } catch (error: IOException) {
      throw WallpaperException(
        WallpaperErrorCode.IMAGE_NOT_FOUND,
        "The image at $uri could not be opened.",
        error
      )
    } ?: throw WallpaperException(
      WallpaperErrorCode.IMAGE_NOT_FOUND,
      "The image at $uri could not be opened."
    )

    return WallpaperImageSource(stream) {}
  }

  private fun openRemote(url: String): WallpaperImageSource {
    val parsedUrl = try {
      URI(url).toURL()
    } catch (error: Exception) {
      throw WallpaperException(
        WallpaperErrorCode.INVALID_URI,
        "\"$url\" is not a valid image URL.",
        error
      )
    }

    val connection = try {
      parsedUrl.openConnection() as HttpURLConnection
    } catch (error: IOException) {
      throw WallpaperException(
        WallpaperErrorCode.DOWNLOAD_FAILED,
        "Could not connect to $url.",
        error
      )
    }

    connection.instanceFollowRedirects = true
    connection.connectTimeout = CONNECT_TIMEOUT_MS
    connection.readTimeout = READ_TIMEOUT_MS
    connection.setRequestProperty("Accept", "image/*")
    connection.setRequestProperty("User-Agent", USER_AGENT)

    try {
      val status = connection.responseCode
      when {
        status == HttpURLConnection.HTTP_NOT_FOUND || status == HttpURLConnection.HTTP_GONE ->
          throw WallpaperException(
            WallpaperErrorCode.IMAGE_NOT_FOUND,
            "The image could not be found (HTTP $status): $url"
          )

        status !in 200..299 ->
          throw WallpaperException(
            WallpaperErrorCode.DOWNLOAD_FAILED,
            "The image download failed with HTTP $status: $url"
          )
      }

      if (connection.contentLengthLong == 0L) {
        throw WallpaperException(
          WallpaperErrorCode.DOWNLOAD_FAILED,
          "The server returned an empty image: $url"
        )
      }

      val stream = connection.inputStream
      return WallpaperImageSource(stream) { connection.disconnect() }
    } catch (error: WallpaperException) {
      connection.disconnect()
      throw error
    } catch (error: UnknownHostException) {
      connection.disconnect()
      throw WallpaperException(
        WallpaperErrorCode.DOWNLOAD_FAILED,
        "Could not resolve the image host. Check the device connection.",
        error
      )
    } catch (error: SocketTimeoutException) {
      connection.disconnect()
      throw WallpaperException(
        WallpaperErrorCode.DOWNLOAD_FAILED,
        "The image download timed out: $url",
        error
      )
    } catch (error: IOException) {
      connection.disconnect()
      val hint = if (error.message?.contains("Cleartext", ignoreCase = true) == true) {
        " HTTP URLs are blocked by default on Android 9+; use HTTPS or allow cleartext traffic."
      } else {
        ""
      }
      throw WallpaperException(
        WallpaperErrorCode.DOWNLOAD_FAILED,
        "The image could not be downloaded: ${error.message ?: url}.$hint",
        error
      )
    }
  }

  /**
   * Reads the magic bytes and rejects files that `WallpaperManager` cannot
   * decode. The stream is reset afterwards so it can be passed on untouched.
   */
  private fun validateFormat(stream: BufferedInputStream) {
    stream.mark(HEADER_SIZE)
    val header = ByteArray(HEADER_SIZE)
    var read = 0
    try {
      while (read < HEADER_SIZE) {
        val count = stream.read(header, read, HEADER_SIZE - read)
        if (count < 0) {
          break
        }
        read += count
      }
    } finally {
      stream.reset()
    }

    val isJpeg = read >= 3 &&
      header[0] == 0xFF.toByte() &&
      header[1] == 0xD8.toByte() &&
      header[2] == 0xFF.toByte()

    val isPng = read >= 8 &&
      header[0] == 0x89.toByte() &&
      header[1] == 0x50.toByte() &&
      header[2] == 0x4E.toByte() &&
      header[3] == 0x47.toByte() &&
      header[4] == 0x0D.toByte() &&
      header[5] == 0x0A.toByte() &&
      header[6] == 0x1A.toByte() &&
      header[7] == 0x0A.toByte()

    val isWebp = read >= HEADER_SIZE &&
      header[0] == 'R'.code.toByte() &&
      header[1] == 'I'.code.toByte() &&
      header[2] == 'F'.code.toByte() &&
      header[3] == 'F'.code.toByte() &&
      header[8] == 'W'.code.toByte() &&
      header[9] == 'E'.code.toByte() &&
      header[10] == 'B'.code.toByte() &&
      header[11] == 'P'.code.toByte()

    when {
      isJpeg || isPng || isWebp -> return
      read == 0 -> throw WallpaperException(
        WallpaperErrorCode.UNSUPPORTED_FORMAT,
        "The image is empty."
      )

      else -> throw WallpaperException(
        WallpaperErrorCode.UNSUPPORTED_FORMAT,
        "Unsupported image format. Use a JPEG, PNG or WebP image."
      )
    }
  }
}
