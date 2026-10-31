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

    private const val PING = "https://wtmzvxmghlwukjwfvpmp.supabase.co/rest/v1/rpc/kasir_ping"

    /** Kabari dashboard bahwa HP kasir masih aktif. */
    fun ping(ctx: Context, force: Boolean = false): Boolean {
        val app = ctx.applicationContext
        val p = prefs(app)
        val now = System.currentTimeMillis()
        if (secret(app).isEmpty() || (!force && now - p.getLong("lastPing", 0) < 10 * 60_000L)) return false
        p.edit().putLong("lastPing", now).apply()
        Thread {
            try {
                val c = URL(PING).openConnection() as HttpURLConnection
                c.requestMethod = "POST"; c.doOutput = true; c.connectTimeout = 15000; c.readTimeout = 15000
                c.setRequestProperty("apikey", API_KEY); c.setRequestProperty("Content-Type", "application/json")
                c.outputStream.use { it.write(JSONObject().put("p_secret", secret(app)).toString().toByteArray()) }
                c.responseCode
            } catch (e: Exception) { p.edit().putLong("lastPing", 0).apply() }
        }.start()
        return true
    }

    /** Tandai notifikasi sudah diproses. false kalau sudah pernah (jangan kirim dua kali). */
    @Synchronized
    fun markSeen(ctx: Context, key: String): Boolean {
        val p = prefs(ctx.applicationContext)
        val arr = JSONArray(p.getString("seen", "[]"))
        for (i in 0 until arr.length()) if (arr.getString(i) == key) return false
        val out = JSONArray().put(key)
        for (i in 0 until minOf(arr.length(), 199)) out.put(arr.get(i))
        p.edit().putString("seen", out.toString()).apply()
        return true
    }

    /** Simpan pembayaran ke antrean lalu coba kirim. Antrean bertahan walau HP tanpa sinyal atau dimatikan. */
    @Synchronized
    fun enqueue(ctx: Context, text: String) {
        val p = prefs(ctx.applicationContext)
        val arr = JSONArray(p.getString("queue", "[]"))
        arr.put(text)
        while (arr.length() > 50) arr.remove(0)
        p.edit().putString("queue", arr.toString()).apply()
        flush(ctx)
    }

    fun queueSize(ctx: Context): Int = JSONArray(prefs(ctx.applicationContext).getString("queue", "[]")).length()

    @Synchronized
    private fun takeFirst(app: Context): String? {
        val arr = JSONArray(prefs(app).getString("queue", "[]"))
        return if (arr.length() == 0) null else arr.getString(0)
    }

    @Synchronized
    private fun dropFirst(app: Context) {
        val p = prefs(app)
        val arr = JSONArray(p.getString("queue", "[]"))
        if (arr.length() > 0) arr.remove(0)
        p.edit().putString("queue", arr.toString()).apply()
    }

    private val flushing = java.util.concurrent.atomic.AtomicBoolean(false)

    /** Kirim semua antrean. Berhenti kalau internet belum ada; dicoba lagi saat sinyal kembali. */
    fun flush(ctx: Context) {
        val app = ctx.applicationContext
        if (secret(app).isEmpty() || !flushing.compareAndSet(false, true)) return
        Thread {
            try {
                while (true) {
                    val text = takeFirst(app) ?: break
                    var result = "gagal"
                    for (attempt in 1..3) {
                        result = post(secret(app), text)
                        if (!result.startsWith("gagal")) break
                        Thread.sleep(4000L * attempt)
                    }
                    if (result.startsWith("gagal")) { log(app, text, "menunggu sinyal"); break }
                    dropFirst(app)
                    log(app, text, result)
                }
            } finally { flushing.set(false) }
        }.start()
    }

    /** Panggil fungsi server; hasil teks JSON, atau null kalau gagal. */
    fun rpc(url: String, body: JSONObject): String? = try {
        val c = URL(url).openConnection() as HttpURLConnection
        c.requestMethod = "POST"; c.doOutput = true; c.connectTimeout = 15000; c.readTimeout = 15000
        c.setRequestProperty("apikey", API_KEY); c.setRequestProperty("Content-Type", "application/json")
        c.outputStream.use { it.write(body.toString().toByteArray()) }
        val code = c.responseCode
        if (code < 400) c.inputStream.bufferedReader().use { it.readText() } else null
    } catch (e: Exception) { null }

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
