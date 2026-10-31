package id.bhatra.kasir

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class NotifService : NotificationListenerService() {
    private val recent = ArrayDeque<String>()

    override fun onNotificationPosted(sbn: StatusBarNotification) {
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
