package id.bhatra.kasir

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Membaca notifikasi uang masuk dari DANA.
 * Selain notifikasi baru, layanan ini juga memeriksa ulang notifikasi DANA yang masih ada di panel
 * setiap kali tersambung lagi, jadi pembayaran yang masuk saat aplikasi sempat dimatikan sistem tetap terbaca.
 * Kalau sedang tidak ada sinyal, pembayaran disimpan dulu dan dikirim begitu internet kembali.
 */
class NotifService : NotificationListenerService() {
    private var netCb: ConnectivityManager.NetworkCallback? = null

    override fun onListenerConnected() {
        super.onListenerConnected()
        Sender.ping(this, force = true)
        scanActive()
        Sender.flush(this)
        try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val cb = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) { Sender.flush(this@NotifService) }
            }
            cm.registerDefaultNetworkCallback(cb)
            netCb = cb
        } catch (e: Exception) { }
    }

    // Kalau sistem memutus layanan (hemat baterai, update), minta disambungkan lagi.
    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        unregisterNet()
        if (Build.VERSION.SDK_INT >= 24) requestRebind(ComponentName(this, NotifService::class.java))
    }

    override fun onDestroy() {
        unregisterNet()
        super.onDestroy()
    }

    private fun unregisterNet() {
        val cb = netCb ?: return
        netCb = null
        try { (getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager).unregisterNetworkCallback(cb) } catch (e: Exception) { }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        // Tiap ada notifikasi apa pun (maks. tiap 10 menit): lapor aktif, cek ulang panel, kirim antrean.
        if (Sender.ping(this)) { scanActive(); Sender.flush(this) }
        handle(sbn)
    }

    private fun scanActive() {
        try { activeNotifications?.forEach { handle(it) } } catch (e: Exception) { }
    }

    private fun handle(sbn: StatusBarNotification) {
        val pkg = sbn.packageName ?: return
        if (!pkg.contains("dana", ignoreCase = true)) return
        // Notifikasi lama (lebih dari 6 jam) diabaikan supaya tidak salah mencocokkan pesanan baru.
        if (System.currentTimeMillis() - sbn.postTime > 6 * 3600_000L) return
        val ex = sbn.notification?.extras ?: return
        val text = listOf(Notification.EXTRA_TITLE, Notification.EXTRA_TEXT, Notification.EXTRA_BIG_TEXT)
            .mapNotNull { ex.getCharSequence(it)?.toString() }
            .distinct()
            .joinToString(" ")
        if (!Regex("(Rp|IDR)", RegexOption.IGNORE_CASE).containsMatchIn(text)) return
        // Satu notifikasi hanya dikirim sekali, walau terbaca lagi saat cek ulang panel.
        if (!Sender.markSeen(this, sbn.key + "|" + sbn.postTime + "|" + text.hashCode())) return
        Sender.enqueue(this, text)
    }
}
