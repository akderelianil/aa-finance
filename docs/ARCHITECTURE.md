# aa-finance Mimari (v0.2)

## Kararlar
- **Stack (güncel):** Supabase (PostgreSQL + Auth + RLS + Storage) + TypeScript Edge Functions (iş mantığı, direkt Postgres bağlantısıyla tek transaction) + React/Vite/shadcn PWA (Cloudflare'de yayın). Migration: Supabase CLI (`supabase/migrations`). Go/GORM/goose kararı iptal. UUID v7 uygulama/fonksiyon üretir. Giriş: e-posta+şifre (Google sonra). Depolama: Supabase Storage (R2 sonra, yedekler için).
- **API sözleşmesi:** Edge Function'lar (`supabase/functions/*`) ve veritabanı view/fonksiyonları (`account_balances`, `contact_balances`, `investment_holdings`, `report_totals`, `report_cash_flow`) sözleşmedir; eski `api/openapi.yaml` kaldırıldı.
- **Çift taraflı kayıt zorunlu:** her kayıt ≥2 satır, toplam borç = toplam alacak (ana para biriminde). DB'de deferred constraint trigger + uygulamada doğrulama.
- **Yazma = Edge Function, okuma = RLS ile doğrudan** (istemci tablolara yazamaz).
- **Kayıtlar düzenlenebilir**, tüm değişiklikler `audit_log`'a (DB trigger, actor = `app.member_id`). Silme = soft delete. Opsiyonel `groups.lock_date` ile dönem kilidi.
- **Yetki:** Grup içinde herkes her şeyi görür. Kaydı yalnızca kaydın sahibi üye (`journal_entries.member_id`) düzenler/siler.
- **Her kayıt tek üyeye aittir.** Kimin kartı/parasıyla harcandıysa onun gideri/geliridir. Ortak hesap yok. Aile raporu = üyelerin toplamı (eve giren/çıkan para); kategoriler grup seviyesinde.
- **UX ilkesi — minimum giriş, sıfır zorunluluk:** Sunucu türetilebilen her şeyi (kur, TRY karşılığı, ortalama maliyet, kur/yatırım kâr-zararı, hesap açma, taksit takvimi) otomatik hesaplar. İstekte bu alanlar **opsiyoneldir**; kullanıcı isterse kendisi verir ve sunucu onları kullanır. Kullanıcı muhasebe terimi görmez.
- Ek yükler (AI, otomatik doldurma, banka içe aktarma) kapsam dışı.

## Çoklu para birimi
- Kategoriler para biriminden bağımsız; bilanço hesaplarının tek para birimi var.
- Her satır: orijinal tutar + para birimi + ana para birimi karşılığı (`base_amount`) + kur.
- **Döviz alımı:** kullanıcı "100 USD aldım, 4.000 TRY ödedim" girer; kur = 40 otomatik.
- **Yurt dışı kart harcaması:** USD/EUR tutarı girilir; TRY tahmini son kurdan gelir (`is_estimated=true`), kullanıcı isterse bankanın TRY tutarıyla kesinleştirir.
- **Döviz hesabından harcama/satış:** hesabın ortalama maliyetiyle düşülür (hesaptaki toplam base / toplam tutar); piyasa değeri farkı otomatik `fx_gain_loss` kategorisine yazılır.
- **Dönem sonu değerleme:** gerçekleşmemiş kur farkı için tek tuşluk değerleme kaydı (`source_type='fx_revaluation'`).

## Yatırımlar
- Tür: kripto, emtia (altın/gümüş/petrol), hisse, fon, tahvil/bono. Yurt içi/dışı farkı yok; enstrümanın kendi para birimi var.
- Döviz enstrüman değildir; çok para birimli normal hesaptır.
- Üye başına enstrüman başına tek yatırım hesabı, ilk alımda otomatik açılır (`accounts.instrument_id`).
- Defter değeri = piyasa değeri (elle girilen fiyatla değerleme kaydı). Satışta defter değeri adetle orantılı düşülür, fark `investment_gain_loss`'a yazılır. Lot/vergi maliyeti takibi yok.
- Çapraz para: USD hisse TRY'yle veya USD hesabıyla alınabilir; fark otomatik hesaplanır.

## Kapsam
- **İlk sürüm:** defter, hesaplar/kategoriler, grup/üyeler, hızlı giriş, kişiler + borç/alacak, taksit, yatırım (elle fiyat), ekler, mizan/bilanço/gelir tablosu, nakit akışı.
- **Sonra:** fatura, abonelik, kredi (şimdilik `loan` alt türünde elle borç hesabı), bütçe, dönem kapanışı, otomatik kur/fiyat.

## Uygulamada zorlanan kurallar (DB zorlamaz)
- Kayıt sahibi dışında düzenleme/silme yok; `lock_date` öncesi değişiklik yok.
- Satırdaki bilanço hesabı kaydın üyesine ait olmalı; satır para birimi bilanço hesabının para birimine eşit olmalı.
- Ortalama maliyet geçmiş kayıt düzenlenince yeniden hesaplanır (hesabın satırları tarih sırasıyla).
