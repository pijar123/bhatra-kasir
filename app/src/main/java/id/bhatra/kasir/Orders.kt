package id.bhatra.kasir

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Pesanan baru: cek ke server tiap 20 detik lalu tampilkan notifikasi berbunyi dari aplikasi ini.
 * Tidak bergantung pengaturan notifikasi Chrome. Sekalian menjadi tanda "HP kasir aktif" di dashboard.
 */
object Orders {
    private const val RPC = "https://wtmzvxmghlwukjwfvpmp.supabase.co/rest/v1/rpc/kasir_orders"
    private const val CHANNEL = "pesanan_baru"
    private val busy = AtomicBoolean(false)

    private fun isoNow(): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US)
        .apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())

    fun poll(ctx: Context) {
        val app = ctx.applicationContext
        val secret = Sender.secret(app)
        if (secret.isEmpty() || !busy.compareAndSet(false, true)) return
        Thread {
            try {
                val p = Sender.prefs(app)
                var after = p.getString("ordersAfter", null) ?: isoNow().also { p.edit().putString("ordersAfter", it).apply() }
                val resp = Sender.rpc(RPC, JSONObject().put("p_secret", secret).put("p_after", after)) ?: return@Thread
                val arr = JSONArray(resp)
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    show(app, o.optString("code"), o.optString("title"), o.optString("body"))
                    after = o.optString("created_at", after)
                }
                p.edit().putString("ordersAfter", after).apply()
            } catch (e: Exception) {
            } finally { busy.set(false) }
        }.start()
    }

    private fun channel(ctx: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) != null) return
        val ch = NotificationChannel(CHANNEL, "Pesanan baru", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Bunyi tiap ada pesanan masuk di bhatra.id"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
            setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        nm.createNotificationChannel(ch)
    }

    fun show(ctx: Context, code: String, title: String, body: String) {
        channel(ctx)
        val open = PendingIntent.getActivity(ctx, code.hashCode(),
            Intent(Intent.ACTION_VIEW, Uri.parse("https://bhatra.id/owner/")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        @Suppress("DEPRECATION")
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CHANNEL)
        else Notification.Builder(ctx).setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL)
        b.setSmallIcon(R.drawable.ic_notif)
            .setColor(0xFFC8372D.toInt())
            .setContentTitle(title)
            .setContentText(body.substringBefore('\n'))
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setContentIntent(open)
            .setAutoCancel(true)
            .setShowWhen(true)
        try { ctx.getSystemService(NotificationManager::class.java).notify(code.hashCode(), b.build()) } catch (e: SecurityException) { }
    }
}
