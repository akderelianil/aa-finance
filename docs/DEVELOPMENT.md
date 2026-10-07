# Geliştirme Notları

Hızlı başlangıç ve tekrar eden hataları önleyen pratik bilgiler. Mimari kararlar: `ARCHITECTURE.md`.

## Komutlar
| İş | Komut |
|---|---|
| Frontend dev | `cd web && npm run dev` |
| Derleme (tip kontrolü + build) | `cd web && npm run build` |
| Lint (oxlint) | `cd web && npm run lint` |
| Supabase CLI | `npx supabase ...` (pnpm engelli) |

Değişiklik sonrası asgari doğrulama: `npm run lint && npm run build` (şu an lint: 1 uyarı, build: temiz).

## Makine tuzakları (Windows)
- **pnpm yok:** Application Control engelliyor; npm kullan.
- **PowerShell 5.1 UTF-8'i bozar** (BOM, mojibake). Dosyaları Write/Edit araçlarıyla yaz; `Set-Content`/`Get-Content` ile Türkçe içerik dokunma.
- **`setx` ile verilen `SUPABASE_ACCESS_TOKEN` Claude oturumunda görünmez.** Oku: `[Environment]::GetEnvironmentVariable('SUPABASE_ACCESS_TOKEN','User')`. Token'ı dosyaya/repoya yazma.
- **Supabase MCP "Unauthorized" dönebilir** (`.mcp.json` token'ı görmüyor). Çözüm: token'ı User ortam değişkenine koyup Claude Code'u yeniden başlat; olmazsa CLI kullan. MCP zaten salt okunur; şema değişikliği her zaman migration + CLI.
- Dev DB şifresi bilerek değiştirilmedi (geliştirme aşaması); hiçbir dosyaya yazılmaz.

## Gizli bilgiler (.env)
- Kök `.env` (gitignore'da) token ve gizli anahtarları tutar; şablon `.env.example` commit edilir, değer içermez. Frontend değişkenleri ayrı: `web/.env.local` (yalnız `VITE_*`, gizli değil).
- Claude/CLI için `.env` otomatik yüklenmez; komuttan önce oku, **değeri asla ekrana basma/loglama**:
  - bash: `set -a; . ./.env; set +a; npx supabase ...`
  - PowerShell: `Get-Content .env | ? { $_ -match '^\s*[^#]\S*=' } | % { $k,$v = $_ -split '=',2; Set-Item "env:$($k.Trim())" $v.Trim() }`
- `SUPABASE_DB_URL` direct bağlantısı (`db.<ref>.supabase.co`) yalnız IPv6; bu makinede çalışmaz. CLI'ye gerek yok: `.env` yükleyip `npx supabase migration list --linked` / `db push --linked` yalnız `SUPABASE_ACCESS_TOKEN` ile çalışır (2026-10-07 doğrulandı). Doğrudan SQL gerekirse shared pooler URL'si kullan.
- Değer okumak yerine yalnız varlık kontrolü: `[ -n "$SUPABASE_ACCESS_TOKEN" ] && echo set`.
- `.mcp.json` `${SUPABASE_ACCESS_TOKEN}` ile süreç ortamından okur, `.env`'den değil; MCP için token User ortam değişkeninde de olmalı ve Claude Code yeniden başlatılmalı.
- `.env` içeriğini Read/cat ile görüntüleme; anahtar adı görmek için `sed -E 's/=.*/=<hidden>/' .env`.

## Çalışma kuralları (tekrarlanan hataları önlemek için)
1. Uygulanmış migration düzenlenmez; yeni dosya ekle (`supabase/migrations/YYYYMMDDHHMMSS_ad.sql`).
2. Şema değiştikten sonra Supabase advisor'larını (security + performance) çalıştır; eksik RLS'yi yakalar.
3. Para her yerde `bigint`/string; kur/adet `numeric` → string. Float yok.
4. Yeni Edge Function: `_shared/` (db, http, accounts, uuid) yardımcılarını kullan; yazma = tek transaction + ilgili hesap satırlarında `FOR UPDATE`.
5. Kütüphane sözdizimi emin değilse context7 ile güncel dokümana bak (react-router 8, tailwind 4, vite 8, i18next 26 gibi yeni sürümler eğitim verisinden farklı olabilir).
6. UI değişikliğini playwright MCP ile gerçekten aç ve ekran görüntüsü al; ekran görüntüleri `.playwright-mcp/` altında (gitignore'da).

## Durum (2026-10-07)
Tüm aşamalar dev projede çalışıyor ve uçtan uca denendi: hızlı gider/gelir, düzenle/sil, hesaplar/kategoriler, transfer, borç/alacak, çoklu para birimi (ortalama maliyet, kur farkı), taksit, yatırım, raporlar, ekler, dönem kilidi.

Edge Function'lar: onboarding-create-group, onboarding-join-group, invite-create, group-update, transaction-create/update/delete, account-create/update, transfer-create, debt-create, fx-exchange, installment-create/pay, investment-trade/revalue, attachment-create/delete.

Uçtan uca test: `.env` (service_role dolu) + `@supabase/supabase-js` ile onaylı test kullanıcısı oluşturup fonksiyonları çağıran node betikleri (geçici, repoda yok). Dev projede test kullanıcıları var: `e2e-test@aa-finance.test`, `e2e-join@aa-finance.test`.

## Yayın öncesi yapılacaklar (kullanıcı)
- Cloudflare Pages: build `cd web && npm run build`, çıktı `web/dist`, değişkenler `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. `public/_redirects` SPA yönlendirmesini içerir.
- Edge Function CORS: yayın adresini ekle: `npx supabase secrets set ALLOWED_ORIGINS=https://<adres>,http://localhost:5173` (tanımsızsa yalnız yerel geliştirme izinli).
- Özel SMTP (yerleşik e-posta saatte 2), Auth ayarlarında sızdırılmış şifre koruması (dashboard; advisor uyarısı), Site URL/redirect URL.
- Test kullanıcılarını ve test verisini temizle (ya da yeni proje).

## Bilinen borçlar / sınırlar
- Düzenleme yalnız basit (2 satırlı, ana para birimli) gider/gelir kayıtlarında; transfer, borç, döviz, yatırım, taksit kayıtları silinebilir ama düzenlenemez.
- Gerçekleşmemiş kur farkı değerlemesi yok (satır `amount > 0` kısıtı yüzünden yalnız tutar değişimi yazılabilir); kur farkı harcama/satışta gerçekleşir.
- Çapraz döviz (USD→EUR) ve döviz hesapları arası transfer yok; yatırımda ödeme hesabı enstrümanla aynı ya da ana para birimi olmalı.
- Kayıt listesi son 30 kayıt (sayfalama/filtre yok); raporlar istemcide hesaplanır (kuruş tutarları JS number, güvenli aralıkta).
- Ek yükleme yarım kalırsa (satır var, dosya yok) yetim satır kalır.
- Taksit: yalnız ana para birimi + kredi kartı; ödenmiş taksit geri alınmaz (ödeme kaydı silinerek açılır).
- Fiyat/kur otomatik çekilmiyor (elle).
- Lint uyarısı: `src/components/ui/button.tsx:57` (shadcn, zararsız).
