package id.bhatra.kasir

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object Sender {
    private const val ENDPOINT = "https://wtmzvxmghlwukjwfvpmp.supabase.co/rest/v1/rpc/dana_paid"
    private const val API_KEY = "sb_publishable_HnF1K96NVO6zV6SiKpy7qw_8lu9rRfL"

    fun prefs(ctx: Context) = ctx.getSharedPreferences("bhatra", Context.MODE_PRIVATE)

    fun secret(ctx: Context): String = prefs(ctx).getString("secret", "") ?: ""

    /** Ambil kode rahasia (24 huruf/angka hex) dari teks apa pun yang ditempel. */
    fun extractSecret(input: String): String? =
        Regex("[0-9a-f]{24}").find(input.lowercase(Locale.ROOT))?.value

    fun send(ctx: Context, text: String, onDone: ((String) -> Unit)? = null) {
        val app = ctx.applicationContext
        Thread {
            var result = "gagal"
            for (attempt in 1..3) {
                result = post(secret(app), text)
                if (!result.startsWith("gagal")) break
                Thread.sleep(5000L * attempt)
            }
            log(app, text, result)
            onDone?.invoke(result)
        }.start()
    }

    private fun post(secret: String, text: String): String = try {
        val c = URL(ENDPOINT).openConnection() as HttpURLConnection
        c.requestMethod = "POST"
        c.doOutput = true
        c.connectTimeout = 15000
        c.readTimeout = 15000
        c.setRequestProperty("apikey", API_KEY)
        c.setRequestProperty("Content-Type", "application/json")
        val body = JSONObject().put("p_secret", secret).put("p_text", text).toString()
        c.outputStream.use { it.write(body.toByteArray()) }
        val code = c.responseCode
        val resp = (if (code < 400) c.inputStream else c.errorStream).bufferedReader().use { it.readText() }
        if (code < 400) resp.trim('"') else "gagal: server $code"
    } catch (e: Exception) {
        "gagal: ${e.javaClass.simpleName}"
    }

    @Synchronized
    private fun log(ctx: Context, text: String, result: String) {
        val p = prefs(ctx)
        val arr = JSONArray(p.getString("log", "[]"))
        val time = SimpleDateFormat("dd/MM HH:mm", Locale("id")).format(Date())
        val out = JSONArray().put(JSONObject().put("t", time).put("r", result).put("x", text.take(120)))
        for (i in 0 until minOf(arr.length(), 19)) out.put(arr.get(i))
        p.edit().putString("log", out.toString()).apply()
    }

    fun readLog(ctx: Context): List<Triple<String, String, String>> {
        val arr = JSONArray(prefs(ctx).getString("log", "[]"))
        return (0 until arr.length()).map { arr.getJSONObject(it).let { o -> Triple(o.getString("t"), o.getString("r"), o.getString("x")) } }
    }
}
