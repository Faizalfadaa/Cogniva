# Prompt dan skrip suara per karakter

Bahan untuk membuat tiga klip referensi yang dipakai XTTS untuk kloning:
`yuzuki.wav`, `reina.wav`, `akira.wav`.

Tiap karakter di bawah punya tiga bagian:

1. **Prompt voice design** — deskripsi untuk tool teks-ke-suara berbasis prompt
   (ElevenLabs Voice Design dan sejenisnya).
2. **Skrip referensi** — kalimat yang dibacakan, inilah yang direkam jadi WAV.
3. **Catatan penyampaian** — untuk pengisi suara manusia.

Prompt dan skripnya ditulis dalam Bahasa Inggris dengan sengaja: murid AI memang
menjawab dalam Bahasa Inggris (`llm/prompts/learner.prompt.ts`), XTTS v2 tidak
mendukung Bahasa Indonesia sama sekali, dan tool voice design hampir selalu
paling akurat dengan deskripsi berbahasa Inggris.

---

## Kenapa skripnya berbentuk begitu

Ini bagian yang paling menentukan hasil, dan paling sering dilewati.

**XTTS mengkloning intonasi, bukan cuma warna suara.** Klip referensi berisi
narasi datar akan membuat *semua* keluaran terdengar datar — termasuk saat
karakter seharusnya bertanya atau bingung. Padahal seluruh peran murid AI adalah
bertanya, bingung, dan tiba-tiba paham.

Karena itu setiap skrip di bawah sengaja memuat empat hal:

| Yang dimuat | Kenapa |
|---|---|
| Sebuah pertanyaan | Intonasi naik. Ini yang paling sering dipakai murid AI. |
| Momen bingung / ragu | Jeda dan keraguan yang jadi ciri khas persona. |
| Momen "oh, paham" | Perubahan nada yang membuat balasan terasa hidup. |
| Kalimat pernyataan biasa | Nada dasar netral sebagai jangkar. |

### Artikulasi ikut terkloning

Ini konsekuensi langsung dari poin di atas, dan baru terasa setelah dipakai:
**klip yang cepat atau menggumam menghasilkan suara yang cepat atau menggumam.**
Reina (energik, cepat) dan Akira (datar, pelan) paling rawan; Yuzuki yang bicara
hati-hati justru paling jernih.

Jadi saat merekam, jaga satu hal: **konsonan tetap utuh.** Karakternya boleh
bersemangat atau malas-malasan, tapi huruf akhir tiap kata jangan ditelan. Ini
tidak mengurangi karakter sama sekali — aktor suara profesional melakukan persis
ini, terdengar santai sambil tetap mengucapkan setiap konsonan.

Kalau terlanjur direkam dan hasilnya kurang jelas, masih bisa ditambal dari sisi
decoder lewat `voices.json` — lihat bagian "Fixing unclear pronunciation" di
[`../README.md`](../README.md). Tapi memperbaiki rekamannya jauh lebih ampuh
daripada menekan parameter.

**Jangan pakai baris intro sebagai klip referensi.** Baris seperti `"E-Etto..."`
atau `"KYAA—!"` bagus untuk perkenalan, tapi terlalu pendek dan terlalu ekstrem
untuk dikloning — hasilnya suara yang selalu terdengar berteriak atau gugup.

Isi skripnya sengaja bertema pelajaran (fotosintesis), supaya intonasi yang
terkloning persis intonasi yang akan dipakai di aplikasi: seorang murid yang
sedang bereaksi terhadap penjelasan.

---

## Kalau prompt-nya ditolak filter

Tool voice design memblokir kombinasi **penyebutan usia + kata sifat yang
terdengar sensual**, walaupun maksudnya jelas bukan ke situ. Versi awal prompt
Reina kena persis karena itu: "teenage girl, 16 or 17" digabung dengan "husky"
dan "teasing". Ketiganya wajar sendiri-sendiri, tapi berbarengan terbaca lain
oleh filter otomatis.

Aturan praktisnya: **deskripsikan suaranya, bukan orangnya.** Prompt di bawah
sudah ditulis dengan pola ini.

| Hindari | Pakai |
|---|---|
| "teenage girl, around 16" | "youthful", "young voice" |
| "husky", "breathy", "sultry" | "slight rasp", "light and airy" |
| "teasing", "seductive" | "wry", "playful", "cheeky" |
| "intimate", "whispering close" | "recorded close to the microphone", "quiet" |

Kesan mudanya tetap didapat lewat "youthful" dan deskripsi nada — itu istilah
casting suara yang lumrah dan tidak menyebut usia siapa pun. Skrip referensinya
sendiri tidak akan pernah kena; isinya percakapan soal fotosintesis.

---

## Yuzuki Akatsuki

**Karakter.** Rambut perak, mata abu-keunguan, berdiri menutup diri sambil
memeluk buku dengan dua tangan. Pemalu, hati-hati, penuh perhatian. Dialognya
banyak titik-titik dan menggantung: *"E-Etto..."*, *"Lets learn something new
today, sensei..."*

### Prompt voice design

```
A soft-spoken, youthful voice with a light, airy quality and a fairly high
pitch. Gentle and careful delivery: speaks quietly, often trailing off at the
end of a sentence, pausing briefly as if choosing words while speaking. Sincere
and warm, but reserved — never performative or loud. Neutral North American
English with clear, careful diction. Slow to medium pace, calm and steady,
recorded close to the microphone.
```

### Skrip referensi

> Um... okay. So if I understood that part right... the water gets split first,
> and that's where the oxygen comes from?
>
> ...Sorry, could you say that again? I think I wrote it down wrong.
>
> ...Oh. Oh, I see. So it isn't the carbon dioxide at all. That's... actually
> kind of surprising.
>
> Um, sensei? Can I ask one more thing before we move on?

### Catatan penyampaian

Volume rendah tapi tetap jelas — bisikan yang tidak terdengar akan mengkloning
jadi suara serak. Tahan jeda di setiap titik-titik, jangan diburu-buru. Akhiri
kalimat dengan sedikit menggantung, bukan turun tegas. Momen *"Oh, I see"*
dinaikkan sedikit, tapi tetap lembut — dia terkejut, bukan bersemangat.

---

## Reina Kisaragi

**Karakter.** Rambut ungu tua diikat ekor kuda tinggi, mata violet, tangan di
pinggang, senyum menantang. Meledak-ledak, jahil, posesif. Dialognya penuh tanda
seru: *"KYAA—!"*, *"Finally!! I found you!"*, *"...Promise?"*

### Prompt voice design

```
A bright, youthful, high-energy voice with a wide dynamic range, flipping
between a fast excited rush and a slower, wry delivery. Confident and animated,
with a slight rasp when the volume rises. Cheeky and competitive, but warm
rather than sharp. Neutral North American English, fast pace, lots of pitch
movement and emphasis. Recorded clean and close — energetic, never shouted.
```

### Skrip referensi

> Wait, wait — hold on! You're telling me the oxygen comes from the *water*? Not
> the carbon dioxide?
>
> Ehh, no way. I had that completely backwards this whole time!
>
> Okay, okay, say it one more time. I'm listening properly now, I promise.
>
> ...Ohh. *Oh.* Okay, that actually makes sense. Heh — fine, you win this round,
> sensei. But I'm asking you a harder one next, so get ready.

### Catatan penyampaian

Bagian tersulit adalah menjaga energi tanpa berteriak — teriakan akan clipping
dan mengkloning jadi suara pecah. Jaga jarak mikrofon tetap dan tekan energinya
lewat kecepatan serta pergerakan nada, bukan volume. *"Ehh, no way"* diseret
malas; *"Okay, okay"* diburu cepat. Tawa kecil di *"Heh"* biarkan natural, jangan
diperankan.

---

## Akira Kagetsu

**Karakter.** Rambut cokelat berantakan, mata cokelat, sedang membetulkan dasi,
senyum tipis.

**Perhatikan ketidaksesuaian ini** — dan manfaatkan. Gambarnya ramah dan mudah
didekati, tapi dialognya dingin dan ketus: *"...You're late."*, *"Remember my
name."* Suaranya adalah jembatan antara keduanya: **datar, tapi tidak dingin.**
Kalau dibacakan benar-benar dingin, dia jadi menyebalkan; kalau dibacakan ramah,
baris-barisnya jadi tidak masuk akal. Yang dicari adalah kering dan santai,
dengan kehangatan yang mengintip di bawahnya.

### Prompt voice design

```
A low, relaxed, slightly dry youthful male voice with an unhurried delivery.
Understated and calm — says less than it could and never pushes for attention.
Deadpan, but with a quiet warmth underneath: dry rather than cold, never robotic
or hostile. Neutral North American English, medium-slow pace, minimal pitch
movement, steady throughout. Recorded close and quiet, with an easy
conversational confidence.
```

### Skrip referensi

> Hm. So the oxygen comes from the water. Not the carbon dioxide.
>
> ...That's not what I assumed.
>
> Let me get this straight. The light reactions split the water first, and
> everything after that runs on what they produce. Is that right?
>
> ...Fine. I'll admit that's cleaner than the way I had it in my head.
>
> Go on. I'm listening.

### Catatan penyampaian

Pelan dan mantap, tanpa dorongan energi. Bacakan hampir seperti sedang berpikir
sendiri, bukan sedang bicara ke orang lain. Kuncinya di *"...Fine"* — itu
pengakuan kalah yang setengah hati, dan di situlah kehangatannya bocor sedikit.
Jangan menaikkan nada terlalu tinggi di akhir pertanyaan; dia bertanya dengan
datar, bukan penasaran meledak.

---

## Cara memakainya

### Jalur A — direkam manusia (hasil terbaik)

Baca skripnya di ruangan sunyi, mikrofon dekat, satu kali ambil. Ini pilihan
paling bagus karena tidak ada artefak yang bertumpuk.

### Jalur B — dibuat dengan tool voice design

Masukkan prompt voice design ke tool pilihanmu, lalu suruh membaca skrip
referensinya. Simpan hasilnya sebagai WAV kualitas tertinggi yang tersedia.

Dua catatan praktis untuk jalur ini:

- **Artefak akan bertumpuk.** Suara hasil AI yang dikloning lagi oleh XTTS akan
  mewarisi setiap cacat kecil di sumbernya. Pakai kualitas ekspor tertinggi, dan
  jangan pernah pakai file MP3 bitrate rendah sebagai sumber.
- **Cek ketentuan layanan tool-nya.** Beberapa layanan melarang keluarannya
  dipakai untuk melatih atau mengkloning ke sistem lain, dan itu persis yang
  dilakukan langkah ini.

### Jalur C — suara aslimu sendiri

Paling cepat dan paling bebas masalah izin. Kamu tetap bisa membedakan ketiga
karakter lewat cara membaca: pelan dan ragu untuk Yuzuki, cepat dan meledak untuk
Reina, pelan dan datar untuk Akira. XTTS menangkap perbedaan penyampaian ini
dengan cukup baik walaupun sumbernya orang yang sama.

### Setelah dapat audionya

Konversi dan potong sesuai panduan di [`README.md`](README.md) folder ini:

```bash
ffmpeg -i yuzuki_raw.wav -ac 1 -ar 22050 yuzuki.wav
```

Lalu uji:

```bash
curl -X POST http://localhost:8020/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Wait, so the oxygen comes from the water, not the carbon dioxide?","voice":"yuzuki"}' \
  --output test.wav
```

Header `X-TTS-Cloned: 1` menandakan klipmu benar-benar terpakai.

---

## Daftar periksa sebelum dipakai

- [ ] Panjang 6–30 detik, idealnya sekitar 20 detik
- [ ] Mono, 22050 Hz atau lebih tinggi, WAV
- [ ] Hening di awal dan akhir sudah dipotong
- [ ] Tidak ada musik, tidak ada suara orang lain, tidak ada gema ruangan
- [ ] Tidak ada clipping (puncak gelombang tidak rata terpotong)
- [ ] Berisi minimal satu pertanyaan dan satu kalimat pernyataan
- [ ] Terdengar seperti karakternya saat kamu dengarkan dengan mata tertutup

Poin terakhir itu yang paling menentukan. Kalau klipnya sendiri sudah tidak
terdengar seperti karakter yang kamu bayangkan, hasil kloningnya tidak akan
memperbaikinya.
