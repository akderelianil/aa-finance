---
owner: interaction-designer
status: active
---

# AKS-005 — Borç (aldım / verdim / tahsil ettim / borcumu ödedim)

- **Kaynak:** Anlatım 1 (senaryo 5-6), karar Anlatım 8 (Borç tek düğme); terimler 2026-10-08; uygulama Hızlı işlem v2-v3. **AKS-006 bu akışla birleşti.**
- **Kim:** Ben + Rehber'deki kişi (kredi için banka: [AKS-009](AKS-009-kredi.md))
- **Tetikleyici:** Birine para verdim, birinden para aldım, verdiğimi geri aldım ya da aldığımı geri verdim
- **Sıklık:** Düşük-orta
- **Hedef:** Kim kime ne kadar borçlu, açıkta ne kaldı

## Kararlar [uygulandı]
- Hızlı işlem → **Borç**; üstte dört seçenek: **Borç aldım · Borç verdim · Tahsil ettim · Borcumu ödedim**. Varsayılan "Borç aldım".
- Borç aldım'ın altında "Bankadan kredi" anahtarı → kredi formu ([AKS-009](AKS-009-kredi.md)).
- Tahsil ettim ve Borcumu ödedim'de kişi yazılınca bakiye görünür ("Sana X borçlu" / "Ona X borçlusun" / "Aranızda borç yok").
- Hesap çipi: boşsa Nakit; banka ya da kredi kartı seçilebilir.
- Daha fazla → **Vade tarihi** (Borç aldım / Borç verdim'de) ve Etiket. Vade girilirse Yaklaşanlar'da tarihli satır olur.
- Borç gelir ya da gider değildir; yalnız para ve kişi bakiyesi değişir.

## Akış
```mermaid
flowchart TD
  A([Borç]) --> B{Borç aldım / Borç verdim / Tahsil ettim / Borcumu ödedim}
  B -- Borç aldım --> L{Bankadan kredi?}
  L -- evet --> K([AKS-009])
  L -- hayır --> C[Tutar, kim, hesap]
  B -- Borç verdim --> C
  B -- Tahsil ettim / Borcumu ödedim --> P[Kim → bakiye görünür]
  P --> Q[Tutar: tam veya kısmi]
  C --> V[Daha fazla: vade tarihi]
  V --> G([İşlem: hesap ve kişi bakiyesi değişir])
  Q --> R([İşlem: kişi bakiyesi azalır])
  G -. vade varsa .-> Y[Yaklaşanlar: tarihli]
  G -. vade yoksa .-> Y2[Yaklaşanlar: tarihsiz]
```

## İstisnalar
| Durum | Kalıp | Bugün |
|---|---|---|
| Kısmi ödeme | Kısmi | Kalan bakiye listede kalır |
| Tam ödeme | Kapanış | Bakiye 0 → Yaklaşanlar'dan kalkar |
| Yanlış kişi / tür / tutar | Geri Al / Sil | Borç işlemi düzeltilemez; sil + yeniden gir |
| Vade geldi, ödenmedi | — | "Gecikti" (kırmızı); "1 hafta ertele" +7 gün |
| Borç silindi (geri istenmeyecek) | Kapanış | "Kapat" yalnız hatırlatmayı kaldırır; bakiye kalır (harita B4) |
| Karşı yönde borç | — | Tek net bakiye görünür |
| Eski borç (başlangıçta) | — | Para girişi/çıkışı olmadan giriş yok ([AKS-019](AKS-019-baslangic.md)) |
| Döviz borcu, faizli borç, borç devri | — | ⏸ Ertelendi |
| Bölüşmeden doğan "bana borçlu" | — | Aynı kişi bakiyesine yazılır ([AKS-004](AKS-004-hesap-bolusme.md)) |

## Sürtünme
- "Son kullanılan seçim öne çıksın" kararı uygulanmadı; hep "Borç aldım" açılır. Yanlış seçim Geri Al ile düzelir.

## Uygulamadaki karşılığı (şimdi)
Yukarıdaki akış. Kişi bakiyesi Rehber'de ve Yaklaşanlar'da görünür; Yaklaşanlar'daki "Tahsil ettim" / "Borcumu ödedim" düğmesi kişi ve tutarı doldurur.

## Açık sorular
[acik-sorular](../acik-sorular.md) (Önce cevaplanmalı: borç silme; Bölüşme / borç).
