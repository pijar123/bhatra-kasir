package id.bhatra.kasir

import android.app.Activity
import android.app.AlertDialog
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
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

    // Langkah otomatis: tiap izin hanya ditawarkan sekali per kunjungan, supaya tidak memaksa.
    private var askedListener = 0
    private var askedBattery = false
    private var dialogOpen = false

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = ink
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(24), dp(20), dp(32)) }
        root.addView(text("BHATRA Kasir", 28, true, ink))
        root.addView(text("Menandai pesanan QRIS Lunas otomatis saat ada notifikasi uang masuk dari DANA.", 15, false, Color.DKGRAY).also { it.setPadding(0, dp(4), 0, dp(16)) })

        status = text("", 16, true, ink).also { it.setPadding(dp(16), dp(14), dp(16), dp(14)) }
        root.addView(status)
        root.addView(button("Lanjutkan pengaturan", red) { askedListener = 0; askedBattery = false; nextStep() })

        root.addView(section("Kode rahasia"))
        root.addView(text("Otomatis terisi lewat tombol \"Hubungkan HP ini\" di bhatra.id/admin.html → Atur. Bisa juga ditempel manual.", 14, false, Color.DKGRAY))
        secretInput = EditText(this).apply { hint = "Tempel kode rahasia"; setSingleLine(true); textSize = 16f }
        root.addView(secretInput)
        root.addView(button("Tempel dari clipboard & simpan", ink) { saveSecret(pasteClipboard(), true) })

        root.addView(section("Tes koneksi"))
        root.addView(button("Kirim tes", ink) { sendTest() })

        root.addView(section("Riwayat"))
        logView = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(logView)

        setContentView(ScrollView(this).apply { setBackgroundColor(cream); addView(root) })
        handleLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleLink(intent)
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // Clipboard baru bisa dibaca saat jendela fokus (Android 10+).
        if (hasFocus && !dialogOpen) {
            if (!hasSecret()) Sender.extractSecret(pasteClipboard())?.let { saveSecret(it, false) }
            nextStep()
        }
    }

    /** Link dari dashboard: bhatrakasir://setup?s=KODE */
    private fun handleLink(i: Intent?) {
        val data = i?.data ?: return
        if (data.scheme == "bhatrakasir") data.getQueryParameter("s")?.let { saveSecret(it, false) }
    }

    private fun hasSecret() = Sender.secret(this).isNotEmpty()
    private fun listening() = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")?.contains(packageName) == true
    private fun batteryOk() = (getSystemService(Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(packageName)

    /** Wizard: tampilkan pop-up untuk langkah berikutnya yang belum selesai. */
    private fun nextStep() {
        if (dialogOpen || isFinishing) return
        when {
            !hasSecret() -> Unit // tunggu link dari dashboard atau tempel manual
            !listening() && askedListener == 0 -> {
                askedListener = 1
                popup("Izinkan baca notifikasi",
                    "Supaya pembayaran QRIS DANA otomatis tercatat Lunas, aktifkan BHATRA Kasir di halaman berikutnya.",
                    "Buka pengaturan") { startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
            }
            !listening() && askedListener == 1 && Build.VERSION.SDK_INT >= 33 -> {
                askedListener = 2
                popup("Tombolnya tidak bisa diaktifkan?",
                    "Android membatasi aplikasi yang diinstal di luar Play Store.\n\n1. Tekan \"Buka info aplikasi\"\n2. Ketuk ⋮ di pojok kanan atas\n3. Pilih \"Izinkan setelan terbatas\"\n4. Kembali ke sini, lalu izinkan baca notifikasi.",
                    "Buka info aplikasi") { startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))); askedListener = 0 }
            }
            listening() && !batteryOk() && !askedBattery -> {
                askedBattery = true
                try { startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName"))) }
                catch (e: Exception) { startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }
            }
            listening() && !Sender.prefs(this).getBoolean("tested", false) -> {
                Sender.prefs(this).edit().putBoolean("tested", true).apply()
                sendTest()
            }
        }
        refresh()
    }

    private fun sendTest() {
        Sender.send(this, "TES koneksi Rp1") { r ->
            runOnUiThread {
                val good = !r.startsWith("gagal") && r != "secret salah"
                Toast.makeText(this, if (good) "Terhubung ke bhatra.id ✓" else "Belum terhubung: $r", Toast.LENGTH_LONG).show()
                refresh()
            }
        }
    }

    private fun popup(title: String, msg: String, action: String, onYes: () -> Unit) {
        dialogOpen = true
        AlertDialog.Builder(this)
            .setTitle(title).setMessage(msg)
            .setPositiveButton(action) { _, _ -> onYes() }
            .setNegativeButton("Nanti", null)
            .setOnDismissListener { dialogOpen = false }
            .show()
    }

    private fun refresh() {
        val l = listening(); val s = hasSecret()
        secretInput.setText(if (s) "••••••••••••" else "")
        val ready = l && s
        status.text = when {
            ready -> "AKTIF · siap menandai Lunas otomatis"
            !s -> "Belum aktif · buka bhatra.id/admin.html → Atur → \"Hubungkan HP ini\""
            else -> "Belum aktif · izinkan baca notifikasi"
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

    private fun saveSecret(input: String, loud: Boolean) {
        val s = Sender.extractSecret(input)
        if (s == null) { if (loud) Toast.makeText(this, "Kode rahasia tidak ditemukan. Salin ulang dari dashboard.", Toast.LENGTH_LONG).show(); return }
        if (s == Sender.secret(this)) return
        Sender.prefs(this).edit().putString("secret", s).putBoolean("tested", false).apply()
        Toast.makeText(this, "Kode rahasia tersimpan ✓", Toast.LENGTH_SHORT).show()
        refresh()
    }

    private fun pasteClipboard(): String = try {
        (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).primaryClip?.getItemAt(0)?.coerceToText(this)?.toString() ?: ""
    } catch (e: Exception) { "" }

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
