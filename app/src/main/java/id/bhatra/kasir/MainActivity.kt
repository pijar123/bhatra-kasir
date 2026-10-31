package id.bhatra.kasir

import android.app.Activity
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {
    private val red = Color.parseColor("#C8372D")
    private val ink = Color.parseColor("#3A1E12")
    private val cream = Color.parseColor("#FFF7EC")
    private val ok = Color.parseColor("#2F7D4F")

    private lateinit var status: TextView
    private lateinit var logView: LinearLayout
    private lateinit var secretInput: EditText

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = ink
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(24), dp(20), dp(32)) }
        root.addView(text("BHATRA Kasir", 28, true, ink))
        root.addView(text("Menandai pesanan QRIS Lunas otomatis saat ada notifikasi uang masuk dari DANA.", 15, false, Color.DKGRAY).also { it.setPadding(0, dp(4), 0, dp(16)) })

        status = text("", 16, true, ink).also { it.setPadding(dp(16), dp(14), dp(16), dp(14)) }
        root.addView(status)

        root.addView(section("1. Kode rahasia"))
        root.addView(text("Buka bhatra.id/admin.html → Atur → Salin pengaturan, lalu tempel di sini.", 14, false, Color.DKGRAY))
        secretInput = EditText(this).apply { hint = "Tempel kode rahasia"; setSingleLine(true); textSize = 16f }
        root.addView(secretInput)
        root.addView(button("Tempel dari clipboard & simpan", red) { saveSecret(pasteClipboard()) })
        root.addView(button("Simpan", ink) { saveSecret(secretInput.text.toString()) })

        root.addView(section("2. Izin"))
        root.addView(button("Izinkan baca notifikasi", red) { startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) })
        root.addView(button("Jangan dimatikan penghemat baterai", ink) { askBattery() })

        root.addView(section("3. Tes koneksi"))
        root.addView(button("Kirim tes", ink) {
            Sender.send(this, "TES koneksi Rp1") { r -> runOnUiThread { Toast.makeText(this, "Hasil: $r", Toast.LENGTH_LONG).show(); refresh() } }
        })

        root.addView(section("Riwayat"))
        logView = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(logView)

        setContentView(ScrollView(this).apply { setBackgroundColor(cream); addView(root) })
    }

    override fun onResume() { super.onResume(); refresh() }

    private fun refresh() {
        val listening = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")?.contains(packageName) == true
        val hasSecret = Sender.secret(this).isNotEmpty()
        secretInput.setText(if (hasSecret) "••••••••••••" else "")
        val ready = listening && hasSecret
        status.text = when {
            ready -> "AKTIF · siap menandai Lunas otomatis"
            !hasSecret -> "Belum aktif · isi kode rahasia (langkah 1)"
            else -> "Belum aktif · izinkan baca notifikasi (langkah 2)"
        }
        status.setTextColor(Color.WHITE)
        status.background = round(if (ready) ok else red, 14)
        logView.removeAllViews()
        val log = Sender.readLog(this)
        if (log.isEmpty()) logView.addView(text("Belum ada.", 14, false, Color.DKGRAY))
        log.forEach { (t, r, x) ->
            val good = r.startsWith("lunas")
            logView.addView(text("$t · ${if (good) "✓ " else ""}$r", 15, true, if (good) ok else red).also { it.setPadding(0, dp(10), 0, 0) })
            logView.addView(text(x, 13, false, Color.DKGRAY))
        }
    }

    private fun saveSecret(input: String) {
        val s = Sender.extractSecret(input)
        if (s == null) { Toast.makeText(this, "Kode rahasia tidak ditemukan. Salin ulang dari dashboard.", Toast.LENGTH_LONG).show(); return }
        Sender.prefs(this).edit().putString("secret", s).apply()
        Toast.makeText(this, "Tersimpan", Toast.LENGTH_SHORT).show()
        refresh()
    }

    private fun pasteClipboard(): String =
        (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).primaryClip?.getItemAt(0)?.coerceToText(this)?.toString() ?: ""

    private fun askBattery() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        if (pm.isIgnoringBatteryOptimizations(packageName)) { Toast.makeText(this, "Sudah aman", Toast.LENGTH_SHORT).show(); return }
        try { startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName"))) }
        catch (e: Exception) { startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }
    }

    private fun text(s: String, size: Int, bold: Boolean, color: Int) = TextView(this).apply {
        text = s; textSize = size.toFloat(); setTextColor(color); if (bold) typeface = Typeface.DEFAULT_BOLD
    }

    private fun section(s: String) = text(s, 18, true, ink).also { it.setPadding(0, dp(24), 0, dp(6)) }

    private fun round(color: Int, r: Int) = GradientDrawable().apply { setColor(color); cornerRadius = dp(r).toFloat() }

    private fun button(label: String, color: Int, onClick: (View) -> Unit) = Button(this).apply {
        text = label; isAllCaps = false; textSize = 16f; setTextColor(Color.WHITE); typeface = Typeface.DEFAULT_BOLD
        background = round(color, 28); gravity = Gravity.CENTER; minHeight = dp(52)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(10) }
        setOnClickListener(onClick)
    }
}
