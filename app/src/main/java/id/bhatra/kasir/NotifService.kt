package id.bhatra.kasir

import android.app.Notification
import android.content.ComponentName
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class NotifService : NotificationListenerService() {
    private val recent = ArrayDeque<String>()

    override fun onListenerConnected() {
        super.onListenerConnected()
        Sender.ping(this, force = true)
    }

    // Kalau sistem memutus layanan (hemat baterai, update), minta disambungkan lagi.
    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        if (Build.VERSION.SDK_INT >= 24) requestRebind(ComponentName(this, NotifService::class.java))
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        Sender.ping(this) // lapor "masih hidup" ke dashboard, maks. tiap 10 menit
        val pkg = sbn.packageName ?: return
        if (!pkg.contains("dana", ignoreCase = true)) return
        val ex = sbn.notification?.extras ?: return
        val text = listOf(Notification.EXTRA_TITLE, Notification.EXTRA_TEXT, Notification.EXTRA_BIG_TEXT)
            .mapNotNull { ex.getCharSequence(it)?.toString() }
            .distinct()
            .joinToString(" ")
        if (!Regex("(Rp|IDR)", RegexOption.IGNORE_CASE).containsMatchIn(text)) return
        // Notifikasi yang sama sering dikirim ulang oleh sistem; abaikan duplikat.
        val key = sbn.key + "|" + text
        synchronized(recent) {
            if (recent.contains(key)) return
            recent.addLast(key)
            if (recent.size > 30) recent.removeFirst()
        }
        Sender.send(this, text)
    }
}
