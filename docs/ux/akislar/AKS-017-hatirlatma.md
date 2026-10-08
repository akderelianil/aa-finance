---
owner: interaction-designer
status: active
---

# AKS-017 — Yaklaşanlar / hatırlatma

- **Kaynak:** Anlatım 6-7; uygulama 2026-10-07 (Bekleyen ve Yaklaşanlar)
- **Kim:** Ben; karşı taraf kişi, kart, banka ya da vadeli hesap
- **Tetikleyici:** Tarihli ya da açık bir şey bekliyor: kart son ödeme, kredi taksidi, vade günü, kişi borcu (iki yön)
- **Sıklık:** Uygulama her açıldığında görülür
- **Hedef:** Unutmamak; gerçek işlem girilince satır kendiliğinden kalksın

## Kararlar [uygulandı]
- Yalnız uygulama içi liste, **Ana sayfada** "Yaklaşanlar" kartı. Telefon bildirimi yok. Kişiye mesaj yok.
- Her satır bir **Bekleyen**dir: **gösterim**, işlem değil.
- Sıra: tarihe göre; geçmiş tarih kırmızı "Gecikti" (vadeli hesapta "Bekliyor"); tarihsiz satırlar en altta.
- Liste yalnız giren üyenin kendi kartlarını, kredilerini, vadelilerini ve kişi bakiyelerini gösterir.

| Satır | Ne zaman görünür | Tutar | Düğme | Kendiliğinden kalkar |
|---|---|---|---|---|
| Kart son ödeme | Kartta kesim ve son ödeme günü girildiyse, kalan > 0 | Kesimdeki borç − kesimden sonra ödenen | Ödedim → Transfer, kart ve tutar dolu | Kart ödemesi kalanı sıfırlayınca |
| Kredi taksidi n/N | Kalan borç > 0 | Taksit tutarı | Ödedim → Transfer → kredi hesabı | Bütün taksitler ödenince |
| Vade günü | Vadeli hesap açıkken | Anapara + beklenen getiri | Vade sonu ([AKS-018](AKS-018-vadeli-hesap.md)) | Vade sonu işlemi girilince |
| Kişi borcu (tarihli) | Vade tarihi girildiyse | Kişiyle net bakiye | Tahsil ettim / Borcumu ödedim · 1 hafta ertele · Kapat | Bakiye 0 olunca |
| Kişi borcu (tarihsiz) | Bakiye ≠ 0 | Kişiyle net bakiye | Tahsil ettim / Borcumu ödedim | Bakiye 0 olunca |

## Akış
```mermaid
flowchart TD
  A([Ana sayfa: Yaklaşanlar]) --> B{Satır}
  B -- Ödedim / Tahsil ettim / Borcumu ödedim / Vade sonu --> C[Önceden doldurulmuş Hızlı işlem]
  C --> D([Gerçek işlem → satır kalkar ya da azalır])
  B -- 1 hafta ertele --> E[Tarih +7 gün]
  B -- Kapat --> F[Hatırlatma kalkar; bakiye tarihsiz satır olarak kalır]
```

## İstisnalar
| Durum | Kalıp | Bugün |
|---|---|---|
| Kısmi ödeme | Kısmi | Kalan tutarla listede kalır |
| Kart taksitli alışveriş içeriyor | — | Tutar taksitlerin tamamını içerir (harita B2) |
| Kartta kesim/son ödeme günü yok | — | Kart listede hiç görünmez |
| Borç silme (geri istemeyeceğim) | Kapanış | Kapat bakiyeyi sıfırlamaz (harita B4) |
| Vade günü hafta sonu, para gelmedi | — | "Bekliyor"; işlem girilene kadar kalır |
| Taksit takvimi | — | Listede yok; Ayarlar → Taksitler (harita B6) |
| Ödenmiş ama girilmemiş | — | İşlem girilene kadar kalır (işlem = gerçekleşen) |

## Sürtünme
- Liste yalnız uygulama açılınca görünür; bilinçli sınır.
- Arkadaşa para sormak zahmetli; liste sessizce hatırlatır.

## Açık sorular
[acik-sorular](../acik-sorular.md) (Yaklaşanlar).
