---
owner: interaction-designer
status: active
---

# AKS-004 — Hesabı ben ödedim, sonra bölüşürüz

- **Kaynak:** Anlatım 1, kararlar Anlatım 6-7; uygulama 2026-10-07
- **Kim:** Ben + 1..n kişi
- **Tetikleyici:** Birlikte yemek/etkinlik; tüm hesabı ben ödedim
- **Sıklık:** Orta
- **Hedef:** Kendi payımı gider yazmak; diğerlerinin payını "bana borçlu" takip etmek; ödeşince kapatmak

## Kararlar [uygulandı]
- Bölüşme, Gider'in "Daha fazla → Paylaştır" seçeneğidir.
- Kullanıcı kişileri yazar; sistem **eşit** böler, ben dahilim.
- "Payları ayrı gir" ile kişi başı **tutar** ya da **yüzde** girilir; türler karışabilir. Payı boş kalanlar ve ben, kalanı eşit böleriz.
- Bölünmeyen kuruş bende kalır. Benim payım 0 olabilir (tamamını başkası için ödedim). Paylar toplamı aşarsa kayıt reddedilir.
- Yeni isim Rehber'de **kişi** olarak açılır.
- Paylaştır ile taksit birlikte kullanılabilir; kalemler ve döviz ile kullanılamaz.

## Akış
```mermaid
flowchart TD
  A([Gider: tutar, kime, kategori, hesap]) --> P{Daha fazla → Paylaştır?}
  P -- hayır --> Z([Normal gider])
  P -- evet --> D[Kişileri yaz: 1..n]
  D --> E{Payları ayrı gir?}
  E -- hayır --> F[Eşit böl, ben dahil]
  E -- evet --> G[Kişi başı tutar / yüzde / boş]
  F --> H([Kayıt: benim payım gider, diğerleri bana borçlu])
  G --> H
  H --> R[Yaklaşanlar: "Sana X borçlu", tarihsiz]
  R --> J{Ödedi mi?}
  J -- tam / kısmi --> K([Borç → Ödeşme; bakiye düşer])
  J -- hayır --> R
```

## İstisnalar
| Durum | Kalıp | Bugün |
|---|---|---|
| Kısmi ödeme | Kısmi | Ödeşme tutarı kadar düşer; kalan listede |
| Yanlış kişi / pay | Geri Al / Sil | Paylaşımlı kayıt düzeltilemez; sil + yeniden gir |
| Arkadaş hiç ödemeyecek | Kapanış | "Vazgeç" bakiyeyi kapatmaz (harita B4) |
| **Başkası ödedi, benim payım var** | — | **Yolu yok** (harita B7) |
| Restoran hesabı iade/indirim | İade | Akış yok (harita B1) |
| Taksitli + paylaştır | — | Tutarın tamamı kart borcu; arkadaş payı alacak; ödeşme takvime bağlı değil |
| Döviz harcamada paylaştır | — | Bugün kapalı |

## Sürtünme
- Ödeşme genelde havale/nakit; "geldi" demek ayrı bir iş. Yaklaşanlar'daki "Ödeşme" düğmesi kişi ve tutarı doldurur.

## Uygulamadaki karşılığı (şimdi)
Gider → Daha fazla → Paylaştır: kişi satırları, "Kişi ekle", "Payları ayrı gir", altta "Senin payın: X · Kalanı sana borçlu olur". Bakiye Rehber'de kişi satırında ve Yaklaşanlar'da görünür.

## Açık sorular
[acik-sorular](../acik-sorular.md) (Önce cevaplanmalı: başkası ödedi; Bölüşme / borç).
