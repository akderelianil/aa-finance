// Chart of accounts template, applied once at setup.
// Core accounts are locked and have a system_key; the UI shows their names from i18n by key.
// Recommended accounts are ordinary accounts the user may change; they get the setup language name.

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'

export type CoreAccount = { key: string; parent?: string; type: AccountType; name: string; placeholder?: boolean }
export type TemplateAccount = { key: string; parent: string; tr: string; en: string; placeholder?: boolean }

export const coreAccounts: CoreAccount[] = [
  { key: 'asset', type: 'asset', name: 'Assets', placeholder: true },
  { key: 'cash', parent: 'asset', type: 'asset', name: 'Cash', placeholder: true },
  { key: 'bank', parent: 'asset', type: 'asset', name: 'Bank', placeholder: true },
  { key: 'investments', parent: 'asset', type: 'asset', name: 'Investments', placeholder: true },
  { key: 'fixed_assets', parent: 'asset', type: 'asset', name: 'Fixed Assets', placeholder: true },
  { key: 'receivables', parent: 'asset', type: 'asset', name: 'Receivables from People' },
  { key: 'liability', type: 'liability', name: 'Liabilities', placeholder: true },
  { key: 'credit_cards', parent: 'liability', type: 'liability', name: 'Credit Cards', placeholder: true },
  { key: 'loans', parent: 'liability', type: 'liability', name: 'Loans', placeholder: true },
  { key: 'payables', parent: 'liability', type: 'liability', name: 'Payables to People' },
  { key: 'equity', type: 'equity', name: 'Equity', placeholder: true },
  { key: 'opening_balance', parent: 'equity', type: 'equity', name: 'Opening Balances' },
  { key: 'income', type: 'income', name: 'Income', placeholder: true },
  { key: 'fx_gain_loss', parent: 'income', type: 'income', name: 'FX Gains and Losses' },
  { key: 'expense', type: 'expense', name: 'Expenses', placeholder: true },
  { key: 'bank_fee', parent: 'expense', type: 'expense', name: 'Bank Fees' },
]

/** Unlocked starter account, added in both setup options. */
export const starterAccounts: TemplateAccount[] = [{ key: 'wallet', parent: 'cash', tr: 'Cüzdan', en: 'Wallet' }]

export const recommendedAccounts: TemplateAccount[] = [
  { key: 'salary', parent: 'income', tr: 'Maaş', en: 'Salary' },
  { key: 'bonus', parent: 'income', tr: 'Prim ve İkramiye', en: 'Bonus' },
  { key: 'side_income', parent: 'income', tr: 'Ek Gelir', en: 'Side Income' },
  { key: 'interest_income', parent: 'income', tr: 'Faiz Gelirleri', en: 'Interest Income' },
  { key: 'dividend', parent: 'income', tr: 'Temettü Gelirleri', en: 'Dividends' },
  { key: 'rental_income', parent: 'income', tr: 'Kira Geliri', en: 'Rental Income' },
  { key: 'allowance', parent: 'income', tr: 'Harçlık', en: 'Allowance' },
  { key: 'gift_received', parent: 'income', tr: 'Hediye', en: 'Gifts Received' },
  { key: 'other_income', parent: 'income', tr: 'Diğer Gelirler', en: 'Other Income' },

  { key: 'groceries', parent: 'expense', tr: 'Market', en: 'Groceries' },
  { key: 'food', parent: 'expense', tr: 'Yeme-İçme', en: 'Food and Drink', placeholder: true },
  { key: 'restaurant', parent: 'food', tr: 'Restoran', en: 'Restaurants' },
  { key: 'cafe', parent: 'food', tr: 'Kafe & Kahve', en: 'Cafes and Coffee' },
  { key: 'delivery', parent: 'food', tr: 'Paket Servis', en: 'Food Delivery' },
  { key: 'transport', parent: 'expense', tr: 'Ulaşım', en: 'Transport', placeholder: true },
  { key: 'public_transport', parent: 'transport', tr: 'Toplu Taşıma', en: 'Public Transport' },
  { key: 'taxi', parent: 'transport', tr: 'Taksi', en: 'Taxi' },
  { key: 'intercity', parent: 'transport', tr: 'Şehirlerarası Yolculuk', en: 'Intercity Travel' },
  { key: 'vehicle', parent: 'expense', tr: 'Araç', en: 'Vehicle', placeholder: true },
  { key: 'fuel', parent: 'vehicle', tr: 'Yakıt', en: 'Fuel' },
  { key: 'vehicle_service', parent: 'vehicle', tr: 'Araç Bakım & Servis', en: 'Vehicle Service' },
  { key: 'vehicle_insurance', parent: 'vehicle', tr: 'Trafik Sigortası & Kasko', en: 'Vehicle Insurance' },
  { key: 'parking_toll', parent: 'vehicle', tr: 'Otopark & Geçiş', en: 'Parking and Tolls' },
  { key: 'housing', parent: 'expense', tr: 'Konut', en: 'Housing', placeholder: true },
  { key: 'rent', parent: 'housing', tr: 'Kira', en: 'Rent' },
  { key: 'dues', parent: 'housing', tr: 'Aidat', en: 'Building Dues' },
  { key: 'repair', parent: 'housing', tr: 'Tadilat & Onarım', en: 'Repairs' },
  { key: 'home_goods', parent: 'housing', tr: 'Ev Eşyası', en: 'Home Goods' },
  { key: 'bills', parent: 'expense', tr: 'Fatura', en: 'Bills', placeholder: true },
  { key: 'electricity', parent: 'bills', tr: 'Elektrik', en: 'Electricity' },
  { key: 'water', parent: 'bills', tr: 'Su', en: 'Water' },
  { key: 'gas', parent: 'bills', tr: 'Doğalgaz', en: 'Natural Gas' },
  { key: 'internet', parent: 'bills', tr: 'İnternet', en: 'Internet' },
  { key: 'phone', parent: 'bills', tr: 'Telefon', en: 'Phone' },
  { key: 'subscription', parent: 'bills', tr: 'Dijital Abonelik', en: 'Digital Subscriptions' },
  { key: 'health', parent: 'expense', tr: 'Sağlık', en: 'Health', placeholder: true },
  { key: 'doctor', parent: 'health', tr: 'Doktor & Hastane', en: 'Doctor and Hospital' },
  { key: 'medicine', parent: 'health', tr: 'İlaç', en: 'Medicine' },
  { key: 'personal_care', parent: 'expense', tr: 'Kişisel Bakım', en: 'Personal Care', placeholder: true },
  { key: 'hairdresser', parent: 'personal_care', tr: 'Kuaför & Berber', en: 'Hairdresser' },
  { key: 'cosmetics', parent: 'personal_care', tr: 'Kozmetik', en: 'Cosmetics' },
  { key: 'shopping', parent: 'expense', tr: 'Alışveriş', en: 'Shopping', placeholder: true },
  { key: 'clothing', parent: 'shopping', tr: 'Giyim', en: 'Clothing' },
  { key: 'electronics', parent: 'shopping', tr: 'Elektronik', en: 'Electronics' },
  { key: 'stationery', parent: 'shopping', tr: 'Kırtasiye & Kitap', en: 'Books and Stationery' },
  { key: 'education', parent: 'expense', tr: 'Eğitim', en: 'Education' },
  { key: 'leisure', parent: 'expense', tr: 'Eğlence & Hobi', en: 'Leisure', placeholder: true },
  { key: 'events', parent: 'leisure', tr: 'Etkinlik', en: 'Events' },
  { key: 'sports', parent: 'leisure', tr: 'Spor', en: 'Sports' },
  { key: 'holiday', parent: 'leisure', tr: 'Tatil', en: 'Holidays' },
  { key: 'family', parent: 'expense', tr: 'Aile & Çocuk', en: 'Family and Children' },
  { key: 'taxes', parent: 'expense', tr: 'Vergi & Resmi Ödeme', en: 'Taxes and Fees' },
  { key: 'gifts_given', parent: 'expense', tr: 'Hediye & Bağış', en: 'Gifts and Donations' },
  { key: 'finance', parent: 'expense', tr: 'Finansman Giderleri', en: 'Finance Costs', placeholder: true },
  { key: 'card_interest', parent: 'finance', tr: 'Kart Faizi', en: 'Card Interest' },
  { key: 'loan_interest', parent: 'finance', tr: 'Kredi Faizi', en: 'Loan Interest' },
  { key: 'loan_fee', parent: 'finance', tr: 'Kredi Masrafı', en: 'Loan Fees' },
  { key: 'cash_advance_fee', parent: 'finance', tr: 'Nakit Avans Masrafı', en: 'Cash Advance Fees' },
  { key: 'deposit_break_fee', parent: 'finance', tr: 'Vadeli Bozma Kesintisi', en: 'Deposit Break Fees' },
  { key: 'other_expense', parent: 'expense', tr: 'Diğer Giderler', en: 'Other Expenses' },
]
