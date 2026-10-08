---
owner: interaction-designer
status: active
---

# AKS-010 — Günlük faizli hesap

- **Kaynak:** Anlatım 1 (senaryo 9), Anlatım 5, karar Anlatım 6
- **Kim:** Hesap sahibi (ben)
- **Tetikleyici:** Banka günlük faiz yatırdı (bildirim/hesap dökümü)
- **Sıklık:** Günlük (faiz her gün yatar)
- **Hedef:** Faiz gelirimi ve vergiyi (stopaj vb.) görmek; hesabın gerçek bakiyesiyle uyum

## Kararlar (Anlatım 6)
- Günlük faiz işlemi **elle girilir**.
- **Gerçekleşen esas alınır**: bankadan gerçekten yatan faiz kaydedilir. **Tahmini işlem girilmez.**
- İleride belki **tahmini hesaplama gösterilebilir** (işlem olarak değil, yalnız bilgi).
- Vergi (stopaj) görünür olmalı (Anlatım 5).

## Akış
```mermaid
flowchart TD
  A([Banka bugünün faizini yatırdı]) --> B[Hızlı işlem → Gelir]
  B --> C[Yatan faizi gir, gelir hesabı, hesap çipi: günlük faizli hesap]
  C --> D{Stopaj ayrı gösterilsin mi?}
  D -- evet --> E[Brüt + stopaj]
  D -- hayır --> F[Net yatan tutar]
  E --> G([Kaydedildi: faiz geliri yeşil, hesap bakiyesi artar])
  F --> G
  G -. ileride, yalnız bilgi .-> H[Tahmini faiz gösterimi]
```

## İstisnalar / sapmalar
- Birkaç gün girilmezse birikim olur; toplu giriş istenebilir (soru açık).
- Bakiye ve oran değişince faiz değişir; tahmin ancak gösterim olarak anlamlı, işlem olarak değil.

## Sürtünme & duygu
- **Her gün elle giriş** (Anlatım 7 çerçevesi): kullanıcılar zaten her gün işlem girmek zorunda, aksi halde muhasebenin anlamı yok; ileride entegrasyon gelecek. Bu yüzden "üşengeç kullanıcı için yük" eleştirisi geri çekildi. Toplu giriş zorunlu değil, atlanan gün için yine de kullanışlı olabilir (öncelik düşük). Akışın kısa olması (tutar + hesap; gerisi türetilir) hâlâ iyi.
- Tahmin işleme girmediği için bakiye bankayla uyumlu kalır (güven).

## Uygulamadaki karşılığı (şimdi)
- Özel akış yok; Hızlı işlem → Gelir: tutar (net yatan), gelir hesabı, hesap çipinde günlük faizli hesap. Yeterli kısa.
- Hesap türünde "günlük faizli" ayrımı yok; stopaj ayrı girilmez. Akıştaki "Brüt + stopaj" dalı **uygulanmadı**.
- Hesap çipi boşsa Nakit sayılır; kullanıcı her gün hesabı seçmek zorunda (İlke 2 "son hesap" uygulanmadı).

## Notlar / açık sorular
Bkz. [acik-sorular](../acik-sorular.md) (Faizli hesaplar). Vadeli tür: [AKS-018](AKS-018-vadeli-hesap.md).
