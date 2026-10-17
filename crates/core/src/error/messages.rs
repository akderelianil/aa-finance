//! Texts for the stable codes, in the two first languages. Plain words, no accounting terms, and never
//! the text of a database or internal error: what crosses the API is only what is written here.

use super::{Lang, RuleCode};

impl RuleCode {
    /// The text a person sees for this code.
    pub fn message(self, lang: Lang) -> &'static str {
        let (tr, en) = match self {
            RuleCode::ProjectionClosed => (
                "Kayıtlar yalnızca uygulamanın kendi işlemleriyle değişebilir.",
                "Records can only change through the app's own operations.",
            ),
            RuleCode::RevisionImmutable => (
                "Kaydedilmiş bir kayıt değiştirilemez; bunun yerine yeni bir sürüm yazılır.",
                "A saved record cannot be changed; a new version is written instead.",
            ),
            RuleCode::RevisionParentMismatch => (
                "Yeni sürüm, kendi kaydının önceki sürümüne bağlı olmalı.",
                "A new version must follow an earlier version of the same record.",
            ),
            RuleCode::EntryTooFewLines => (
                "Bir işlemde en az iki satır olmalı.",
                "An entry needs at least two lines.",
            ),
            RuleCode::EntryUnbalanced => (
                "Satırların toplamı sıfır olmalı: çıkan para ile giren para eşit olmalı.",
                "The lines must add up to zero: what goes out must equal what comes in.",
            ),
            RuleCode::AccountArchived => (
                "Arşivlenmiş bir hesaba yeni kayıt yazılamaz.",
                "A new line cannot use an archived account.",
            ),
            RuleCode::CommodityScaleLocked => (
                "Bu para biriminin hane sayısı, kullanıldığı için artık değiştirilemez.",
                "The decimal places of this currency cannot change once it is in use.",
            ),
            RuleCode::AmountOutOfRange => (
                "Tutar desteklenen sınırı aşıyor.",
                "The amount is larger than the supported limit.",
            ),
            RuleCode::DateInvalid => (
                "Tarih geçerli değil; YYYY-AA-GG biçiminde gerçek bir gün yazın.",
                "The date is not valid; write a real day as YYYY-MM-DD.",
            ),
            RuleCode::CommodityScaleInvalid => (
                "Hane sayısı 0 ile 18 arasında olmalı.",
                "The number of decimal places must be between 0 and 18.",
            ),
            RuleCode::CommodityCodeTaken => (
                "Bu kodlu bir para birimi zaten var.",
                "A currency with this code already exists.",
            ),
            RuleCode::AccountParentCycle => (
                "Bir hesap kendi alt hesabının altına taşınamaz.",
                "An account cannot be moved under one of its own sub-accounts.",
            ),
            RuleCode::LineCommodityMismatch => (
                "Satırın para birimi, hesabın para birimiyle aynı olmalı.",
                "A line must use the currency of its account.",
            ),
            RuleCode::AccountCommodityLocked => (
                "Hareket görmüş bir hesabın para birimi değiştirilemez.",
                "The currency of an account that has lines cannot change.",
            ),
            RuleCode::RevisionKindMismatch => (
                "Bir kayıt başka türde bir kayda dönüştürülemez.",
                "A record cannot become a record of another kind.",
            ),
            RuleCode::AmountInvalid => (
                "Tutar okunamadı; rakam ve ondalık ayracı kullanın.",
                "The amount could not be read; use digits and a decimal separator.",
            ),
            RuleCode::AmountTooPrecise => (
                "Tutarda, bu para biriminin desteklediğinden fazla ondalık hane var.",
                "The amount has more decimal places than this currency supports.",
            ),
            RuleCode::RateInvalid => (
                "Kur okunamadı veya sıfırdan büyük değil.",
                "The rate could not be read or is not above zero.",
            ),
            RuleCode::RateMissing => (
                "Yabancı para satırı için bir kur gerekli.",
                "A line in a foreign currency needs a rate.",
            ),
            RuleCode::LineBaseSign => (
                "Satırın ana para karşılığı, tutarla aynı yönde olmalı.",
                "The value in the main currency must go the same way as the amount.",
            ),
            RuleCode::RateBaseConflict => (
                "Aynı satırda hem kur hem ana para karşılığı verildi ve birbirini tutmuyor.",
                "Both a rate and a main-currency value were given and they do not agree.",
            ),
            RuleCode::LineEmpty => ("Satırın tutarı sıfır olamaz.", "A line cannot be zero."),
            RuleCode::NothingToUndo => (
                "Geri alınacak önceki bir sürüm yok.",
                "There is no earlier version to go back to.",
            ),
            RuleCode::EntryMustStartAsDraft => (
                "Bir fiş önce taslak olarak başlamalı, sonra kaydedilebilir.",
                "An entry must start as a draft before it can be posted.",
            ),
            RuleCode::BaseCurrencyLocked => (
                "Ana para birimi, ilk fiş girildikten sonra değiştirilemez.",
                "The base currency cannot be changed once an entry exists.",
            ),
            RuleCode::SettingsIdFixed => (
                "Defter ayarları kendi sabit kimliğiyle yazılmalı.",
                "The book settings must be written under their fixed document id.",
            ),
            RuleCode::BookAlreadyOpen => ("Bu defter zaten açılmış.", "This book is already open."),
            RuleCode::AccountLocked => (
                "Bu hesabı sistem açtı; adı değiştirilemez, arşivlenemez ve geri alınamaz.",
                "The system opened this account; it cannot be renamed, archived or undone.",
            ),
            RuleCode::SystemKeyTaken => (
                "Bu sistem anahtarı başka bir hesapta zaten kullanılıyor.",
                "This system key is already used by another account.",
            ),
        };
        match lang {
            Lang::Tr => tr,
            Lang::En => en,
        }
    }
}
