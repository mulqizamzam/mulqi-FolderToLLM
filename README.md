# mulqi-FolderToLLM

**Plugin DeepSeek Harness (DSH) untuk membuat snapshot konteks proyek yang terfilter, berbatas ukuran, dan siap ditinjau sebelum dipakai dalam workflow LLM.**

- **Versi:** `0.2.1-rc.2`
- **Target:** DSH `0.2.1-rc.2` atau lebih baru yang kompatibel
- **Runtime:** Node.js, tanpa dependency runtime eksternal
- **Inspirasi:** [EdgeTypE/FolderToLLM](https://github.com/EdgeTypE/FolderToLLM) — port ini adalah implementasi baru untuk kontrak plugin DSH dan tidak menyertakan kode PowerShell upstream.

## Apa fungsi plugin ini?

FolderToLLM membantu Anda memberi DeepSeek konteks yang relevan dari sebuah proyek tanpa langsung menyalin seluruh repository. Plugin memindai direktori lokal, membuat pohon folder, lalu menyertakan isi file teks yang lolos filter.

Fitur utama:

- Membuat directory tree dan menggabungkan isi file teks terpilih.
- Menggunakan aturan `.gitignore` dengan dukungan best-effort.
- Filter berdasarkan folder, path, ekstensi, ukuran file dan budget total karakter.
- Mengabaikan direktori build/dependency umum, symlink, banyak tipe file biner, dan nama file sensitif yang dikenal.
- Mengembalikan daftar file, statistik, jumlah file yang dilewati, serta peringatan agar hasil dapat ditinjau.
- Menyertakan Skill DSH untuk membantu memilih scope, menggunakan tool, dan memeriksa risiko data sebelum membagikan output.

> **Penting soal privasi:** pengecualian otomatis bukan jaminan bahwa rahasia tidak akan ikut terbaca. Token atau password bisa tertulis di file sumber biasa. Selalu tinjau snapshot sebelum menempelkan, mengunggah, atau mengirimkannya ke layanan eksternal.

## Mulai cepat untuk pemula

### 1. Pastikan prasyarat

- DSH `0.2.1-rc.2` atau build yang kompatibel.
- Node.js versi yang didukung instalasi DSH Anda. Gunakan versi yang direkomendasikan oleh environment DSH.
- Nama profile DSH Anda. Contoh di bawah memakai `web`.
- Proses DSH perlu memiliki izin filesystem dari OS untuk membaca direktori proyek yang dipilih. Plugin ini **tidak** menambahkan izin OS baru.

### 2. Pasang dari GitHub

Jalankan di terminal yang memiliki CLI `dsh`:

```bash
dsh plugin --profile web add "github:mulqizamzam/mulqi-FolderToLLM#main"
```

Ganti `web` dengan nama profile yang Anda pakai. Untuk instalasi yang lebih reproducible, pin ke commit SHA atau release tag yang sudah Anda tinjau alih-alih selalu memakai `main`.

Apabila `pnpm` meminta persetujuan untuk menjalankan build saat install, jangan menyetujui secara membabi buta. Tinjau source lebih dulu, lalu tambahkan **key persis seperti yang dicetak pnpm** ke `pnpm-workspace.yaml` milik profile dengan nilai `true`. Key untuk paket Git dapat memuat URL dan commit SHA yang di-resolve.

### 3. Jalankan atau restart profile

```bash
dsh --profile web
```

Jika profile sudah berjalan, restart agar bundle dan metadata Skill yang baru dimuat.

### 4. Coba di sesi DSH

Minta DSH:

> Buat snapshot konteks dari folder `./src`, hanya masukkan file `.ts`, `.js`, dan `.md`, kecualikan fixture serta generated output, batasi total ke 80.000 karakter, lalu laporkan file yang dilewati dan peringatan sebelum memakai snapshot.

Plugin mendaftarkan dua tool:

| Tool | Fungsi |
|---|---|
| `folder_to_llm_pack` | Memindai direktori lokal dan mengembalikan tree, isi file terfilter, statistik, serta warnings. |
| `folder_to_llm_defaults` | Menjelaskan default, opsi, batasan, dan pola pemakaian tanpa memindai file. |

Jika tool tidak muncul, cek apakah package terpasang pada profile yang benar, lalu restart DSH. Jangan menganggap pemindaian telah berjalan jika tool tidak tersedia atau menghasilkan error.

## Contoh pemakaian

### Review kode terarah

Contoh argumen untuk `folder_to_llm_pack`:

```json
{
  "rootPath": ".",
  "includeFolders": ["src", "tests"],
  "includeExtensions": [".ts", ".js", ".md"],
  "excludeFolders": ["fixtures", "generated"],
  "maxFileSizeBytes": 1048576,
  "maxTotalChars": 80000,
  "useGitignore": true
}
```

### Menyiapkan konteks dokumentasi

> Buat snapshot dari folder `docs` dan `src`. Sertakan Markdown, TypeScript, JavaScript, dan file package/manifests. Batasi output maksimal 120.000 karakter dan jelaskan file yang dilewati.

### Memahami opsi sebelum scan

Panggil `folder_to_llm_defaults` untuk melihat default aman, keterbatasan parsing `.gitignore`, dan saran penggunaan tanpa membaca file proyek.

## Batasan keamanan dan privasi

- Pemrosesan bersifat read-only: plugin tidak menulis, menghapus, atau menjalankan berkas proyek.
- Path yang dapat diakses tetap ditentukan oleh host DSH dan izin OS.
- Symlink dilewati; path include/exclude yang mencoba keluar dari root ditolak.
- Parsing `.gitignore` best-effort, bukan implementasi lengkap seluruh aturan Git.
- Pendeteksian file sensitif dan biner bersifat heuristik. File rahasia yang diberi nama biasa atau memuat credential di dalam source dapat tetap terikut.
- Snapshot bisa mengandung source proprietary, data internal, URL privat, atau rahasia. Tinjau snapshot dan peringatan sebelum membagikannya ke layanan/model eksternal.

## Pengembangan dan validasi

Pada checkout repository:

```bash
npm run build
npm test
npm run validate
npm pack --dry-run
```

Gunakan Node.js sesuai rentang yang dinyatakan di `package.json`. Tes lokal tidak menggantikan smoke test di DSH sungguhan; validasi lengkap harus memastikan dua tool terdaftar dan hasil scan fixture sesuai harapan.

## Kredit dan lisensi

Workflow sumber: [EdgeTypE/FolderToLLM](https://github.com/EdgeTypE/FolderToLLM). Port ini adalah implementasi terpisah untuk DSH.

Lisensi: MIT. Lihat [LICENSE](LICENSE) dan [NOTICE.md](NOTICE.md).
