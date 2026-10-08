---
owner: interaction-designer
status: active
---

# AKS-016 — "Kime ödeme yaptım?" (kişi / kurum / marka)

- **Kaynak:** Anlatım 4-8; uygulama 2026-10-07 (Rehber)
- **Kim:** Her kullanıcı
- **Tetikleyici:** Harcama kaydı ([AKS-001](AKS-001-kartla-alisveris.md)), bölüşme, borç, havale... ödeme/alacak olan her olay
- **Sıklık:** Her gider kaydında
- **Hedef:** Para kime gitti sorusuna **marka** diliyle cevap (X). Sistem arka planda **ticari unvanı** (firmayı) bilir; ekstre/fiş eşleşmesi unvan üzerinden yapılabilir.

## Nesne ilişkisi
```mermaid
flowchart LR
  F[Kurumsal firma\nticari unvan, vergi no?] --> M1[Marka A]
  F --> M2[Marka B]
  K[Bireysel kişi\nisim, soyisim, avatar, iletişim] --> H1[Banka hesabı\nbanka adı + IBAN]
  F --> H2[Banka hesabı\nbanka adı + IBAN]
  O[Ödeme kaydı] -->|kime| M1
  O -->|ya da kime| K
```

## Akış (kayıt anı)
```mermaid
flowchart TD
  A([Gider/Gelir: Kime?]) --> B{Yazarken listede var mı?}
  B -- evet --> C[Seçildi; markaysa kategori gelir]
  B -- hayır, yeni ad --> E[Giderde/gelirde marka, borçta/paylaştırda kişi açılır]
  B -- boş --> H
  E --> H([Kaydedildi: kayıt markaya/kişiye bağlı])
  C --> H
  H -. sonra, istenirse .-> R[Rehber: firma bağı, IBAN, iletişim, varsayılan kategori]
```

## Kararlar
- Üç katman (kişi / firma / marka) ve Rehber sayfası v1'de [karar] [uygulandı]. Kayıt anında firma sorulmaz [karar].
- Kategori markadan gelir; kayıtta değiştirilebilir; yalnız o kayıt değişir [karar] [uygulandı].
- Eski "kişiler" Rehber'e katıldı [uygulandı].
- ⏸ ATM başka banka komisyonu.

## Raporlama (hedef; uygulanmadı)
- Varsayılan görünüm: **marka** ("Migros'a ne kadar ödedim").
- İsteğe bağlı üst görünüm: **firma** (aynı unvana giden toplam).
- Ekstre/fiş teyidi: unvan ile firma eşleşir, marka oradan bulunur.

## Sürtünme
- Her harcamada "kime" sorusu zahmetli; kayıt sırasında **yazarken öner**, son/sık kullanılanlar üstte; boş geçilebilir.
- Marka/firma/kişi ayrıntısı (IBAN, iletişim) kayıt anında istenmemeli; sonradan Rehber sayfasında tamamlanır.

## Uygulamadaki karşılığı (şimdi) [uygulandı]
- **Rehber sayfası:** arama; süzgeç Hepsi · Kişi · Marka · Firma; kişide borç/alacak bakiyesi. Kayıt formu: ad (firmada "ticari unvan"), tür; markada varsayılan kategori; "Ayrıntılar" altında marka ↔ firma bağı (çoka çok), telefon, e-posta, vergi no (firma), IBAN listesi (kopyala düğmesi). Kişi ve firmada IBAN var, markada yok. Arşivle.
- **Kayıt anında:** "Kime ödedin?" / "Kimden aldın?" yazarken öneri listesi. Firma hiç sorulmaz. Yeni isim giderde/gelirde marka, borçta/paylaştırda kişi olarak açılır.
- **Kategori:** marka yazılınca varsayılan kategori gelir; kullanıcı değiştirirse yalnız o kayıt değişir. Markanın varsayılanı yoksa ilk kullanılan kategori varsayılan olur. Şablonda yaygın markalar varsayılan kategorileriyle hazır gelir.
- **Firma belirsizliği:** kayıt markaya bağlanır; firma kayıtta tutulmaz. Marka birden çok firmaya bağlıysa kaydın firması belirsiz kalır. Anlatım 6'daki "kayıtta firma seçilebilir" kararından sapma; onay bekliyor ([acik-sorular](../acik-sorular.md), Rehber).
- **Rapor:** marka/firma bazlı rapor **yok**.

## Uygulamaya bakarak boşluklar
| Durum | Bugün | Öneri |
|---|---|---|
| Yazım hatası ("Migroz") | Yeni marka açılır | Rehber'de "Birleştir" (harita B10) |
| Bakiyesi olan kişi arşivlendi | Kontrol yok | Önce uyar |
| Marka sonradan kişi olmalıydı (tür yanlış) | Rehber'den tür değişir | — |
| Aynı ad iki farklı kişi (iki "Ahmet") | Ad eşleşmesi ilk kaydı bulur | Rehber'de ad ayırt edici olmalı; öneri yok, sık değil |

## Açık sorular
Bkz. [acik-sorular](../acik-sorular.md) (Rehber bölümü).
