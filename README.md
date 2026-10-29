# mulqi-FolderToLLM

**DeepSeek Harness (DSH) plugin untuk membuat snapshot konteks proyek yang terfilter, terbatas ukurannya, dan mudah ditinjau.**

Port DeepSeek-native dari [EdgeTypE/FolderToLLM](https://github.com/EdgeTypE/FolderToLLM). Plugin ini mengganti utilitas PowerShell interaktif dengan dua tool DSH untuk menyusun daftar file dan menggabungkan konten teks proyek menjadi satu snapshot yang siap diberikan ke LLM.

## Fitur

- Membuat pohon direktori dan menggabungkan konten file teks.
- Filter berdasarkan direktori/folder, ekstensi, dan ukuran file.
- Menghormati pola `.gitignore` secara best-effort.
- Mengecualikan folder build/dependency dan format biner yang umum.
- Batas jumlah file, ukuran file, karakter output, dan batas pemindaian.
- Menghasilkan daftar file yang disertakan/dikecualikan agar output bisa ditinjau.
- Tidak mengubah atau menghapus file sumber.
- Skill DSH dengan petunjuk penggunaan untuk pemula.

## Persyaratan

- DeepSeek Harness (DSH) **0.2.1-rc.2** atau versi kompatibel.
- Node.js **22.18.0+** untuk pengembangan/pemeriksaan lokal.

## Instalasi di DSH

Buka terminal pada mesin yang menjalankan DSH. Ganti profil `web` jika Anda menggunakan profil lain.

```bash
dsh plugin --profile web add "github:mulqizamzam/mulqi-FolderToLLM#main"
dsh --profile web
```

Setelah dipasang, mulai ulang sesi/profile DSH bila plugin belum muncul.

Periksa instalasi:

```bash
dsh plugin --profile web why mulqi-folder-to-llm
dsh --profile web --dump-config
```

## Cara memakai

Minta DSH dengan bahasa biasa, misalnya:

> Buat snapshot konteks proyek ini. Abaikan node_modules, .git, hasil build, file rahasia, dan file biner. Utamakan berkas source dan dokumentasi. Batasi output agar mudah direview.

Tool yang tersedia:

- **`folder_to_llm_pack`** — membuat snapshot berdasarkan root dan filter yang diminta.
- **`folder_to_llm_defaults`** — menampilkan opsi dan default yang aman.

Parameter seperti root path dan batas output bergantung pada skema tool DSH. Jika tool meminta path, gunakan direktori proyek yang memang tersedia untuk lingkungan DSH Anda. Plugin tidak memberi DSH izin filesystem baru; akses yang tersedia tetap dikendalikan host.

Lihat [panduan pemula](docs/BEGINNERS.md) untuk contoh dan troubleshooting.

## Batasan dan privasi

- Pengecualian sensitif adalah heuristik, bukan jaminan pendeteksian seluruh secret. Review daftar file dan output sebelum membagikannya.
- Snapshot bisa berisi kode atau data internal. Jangan mengirim output ke layanan/model yang tidak diizinkan organisasi Anda.
- Perilaku `.gitignore` ditangani secara best-effort, bukan implementasi lengkap semua semantik Git.
- Pengujian paket tidak menggantikan smoke test pada runtime DSH produksi.

## Pengembangan dan validasi

```bash
npm test
npm run validate
npm run build
```

## Kredit

Workflow asal: [EdgeTypE/FolderToLLM](https://github.com/EdgeTypE/FolderToLLM). Reconciled port DSH maintained by Mulqizamzam.

## Lisensi

MIT. Lihat [LICENSE](LICENSE) dan [NOTICE.md](NOTICE.md).
