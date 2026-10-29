# Panduan Pemula

Panduan ini menjelaskan instalasi dan cara memakai `mulqi-FolderToLLM` di DeepSeek Harness (DSH).

## 1. Pasang plugin

Pastikan perintah `dsh` sudah tersedia dan DSH berjalan pada mesin Anda. Jalankan:

```bash
dsh plugin --profile web add "github:mulqizamzam/mulqi-FolderToLLM#main"
dsh --profile web
```

Ubah `web` menjadi nama profile DSH Anda bila berbeda. Jika plugin tidak terdeteksi, restart profile dan periksa:

```bash
dsh plugin --profile web why mulqi-folder-to-llm
```

## 2. Minta snapshot

Di sesi DSH, gunakan permintaan seperti:

> Buat snapshot untuk proyek saya. Sertakan source JavaScript, TypeScript, dan README. Lewati node_modules, .git, build, dist, file biner, dan file sensitif yang dikenali. Batasi output menjadi 100 ribu karakter.

Jika DSH meminta `root`, berikan path yang benar-benar dapat diakses oleh host. Jangan menebak path yang tidak diketahui.

## 3. Tinjau hasil

Hasil tool mencakup `snapshot`, `includedFiles`, `skippedFiles`, jumlah file, ukuran output, dan peringatan. Baca daftar file dan output terlebih dahulu. Filter otomatis bersifat best-effort; jangan menganggap semua kredensial atau data privat pasti terhapus.

## 4. Contoh opsi

- `includeExtensions`: ekstensi yang ingin diprioritaskan, seperti `.ts`, `.js`, `.md`.
- `excludeFolders`: folder ekstra untuk diabaikan.
- `maxFileBytes`: batas ukuran setiap file.
- `maxFiles`: batas file yang dikumpulkan.
- `maxOutputChars`: batas panjang snapshot.
- `respectGitignore`: gunakan dukungan pola `.gitignore` yang tersedia.

## 5. Troubleshooting

**Plugin tidak muncul:** restart profile DSH dan jalankan `dsh plugin --profile web why mulqi-folder-to-llm`.

**Tidak bisa membaca root:** pastikan path ada dan diizinkan oleh lingkungan host. Plugin tidak menambah hak akses filesystem.

**Output terlalu panjang:** turunkan `maxOutputChars`, `maxFiles`, atau batasi `includeExtensions` dan `includeFolders`.

**File penting tidak masuk:** periksa `skippedFiles`; file mungkin terkena batas ukuran, allowlist ekstensi, atau aturan pengecualian.

**Keamanan data:** snapshot bisa memuat source code atau informasi internal. Review sebelum membagikannya ke model/layanan eksternal.
