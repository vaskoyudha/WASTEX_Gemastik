import {
  ScanResult,
  ProductRecommendation,
  ProductTutorial,
  PricingEstimate,
  SellingKit,
  MaterialType,
} from "../services/types";

export const MOCK_SCAN_RESULTS: Record<MaterialType, ScanResult> = {
  plastik_pet: {
    materialType: "plastik_pet",
    materialLabel: "Botol Plastik PET",
    condition: "Baik",
    confidence: 0.96,
    riskLevel: "aman",
    difficulty: "mudah",
    potentialValue: "sedang",
    safetyNotes: [
      "Pastikan botol dicuci bersih dengan air mengalir sebelum diolah.",
      "Gunakan gunting tajam jika memerlukan pemotongan plastik.",
    ],
    potentialUses: ["Pot Tanaman Gantung", "Vas Dekoratif", "Wadah Hidroponik"],
  },
  plastik_hdpe: {
    materialType: "plastik_hdpe",
    materialLabel: "Botol Plastik HDPE",
    condition: "Bersih",
    confidence: 0.88,
    riskLevel: "aman",
    difficulty: "mudah",
    potentialValue: "sedang",
    safetyNotes: [
      "Bilas sisa cairan kimia/deterjen sampai benar-benar bersih.",
      "Gunakan sarung tangan karet saat membersihkan sisa wadah.",
    ],
    potentialUses: ["Sudu Tanaman", "Tempat Pensil Karakter", "Gantungan Serbaguna"],
  },
  kardus: {
    materialType: "kardus",
    materialLabel: "Kardus Bekas Kemasan",
    condition: "Baik",
    confidence: 0.95,
    riskLevel: "aman",
    difficulty: "mudah",
    potentialValue: "rendah",
    safetyNotes: [
      "Jauhkan dari area basah atau lembap agar struktur tetap kokoh.",
      "Gunakan cutter tajam dengan alas potong untuk hasil presisi.",
    ],
    potentialUses: ["Organizer Meja Rak Buku", "Kotak Penyimpanan Estetik", "Lampu Hias Dinding"],
  },
  kaleng: {
    materialType: "kaleng",
    materialLabel: "Kaleng Minuman / Susu",
    condition: "Baik",
    confidence: 0.85,
    riskLevel: "hati_hati",
    difficulty: "sedang",
    potentialValue: "sedang",
    safetyNotes: [
      "Peringatan Tepi Tajam: Gunakan kikir atau amplas untuk menghaluskan permukaan potong kaleng.",
      "Disarankan menggunakan sarung tangan pelindung saat proses pelubangan/pemotongan.",
    ],
    potentialUses: ["Tempat Pensil Kaleng", "Lampu Hias Kaleng Perforasi", "Pot Tanaman Mini"],
  },
  kaca: {
    materialType: "kaca",
    materialLabel: "Botol Kaca Bekas",
    condition: "Baik",
    confidence: 0.90,
    riskLevel: "berisiko",
    difficulty: "sulit",
    potentialValue: "tinggi",
    safetyNotes: [
      "Material Pecah Belah: Sangat disarankan bagi pemula untuk TIDAK memotong kaca tanpa alat pemotong khusus.",
      "Gunakan kacamata pelindung dan sarung tangan tebal selama pengerjaan.",
      "Utamakan metode tanpa potong (dekorasi luar, tali rami, lampu dalam botol).",
    ],
    potentialUses: ["Vas Bunga Tali Rami", "Lampu Hias Botol LED", "Terrarium Mini Estetik"],
  },
  sachet: {
    materialType: "sachet",
    materialLabel: "Kemasan Sachet Multilayer",
    condition: "Baik",
    confidence: 0.78,
    riskLevel: "aman",
    difficulty: "sulit",
    potentialValue: "sedang",
    safetyNotes: [
      "Cuci bersih dan keringkan sisa minyak/kopi di dalam sachet.",
      "Setrika dengan suhu sedang (alas kertas) jika ingin meratakan lembaran sachet.",
    ],
    potentialUses: ["Tas Belanja Anyaman Sachet", "Dompet Unik Resleting", "Taplak Meja Mosaic"],
  },
};

export const MOCK_RECOMMENDATIONS: Record<MaterialType, ProductRecommendation[]> = {
  plastik_pet: [
    {
      id: "prod_pet_1",
      name: "Pot Tanaman Gantung",
      thumbnailUri: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&auto=format&fit=crop&q=60",
      difficulty: "mudah",
      estimatedCost: 12000,
      estimatedTimeMinutes: 45,
      shortDescription: "Pot gantung vertikal minimalis untuk tanaman hias indoor dari botol PET bekas.",
    },
    {
      id: "prod_pet_2",
      name: "Vas Bunga Dekoratif Tali Rami",
      thumbnailUri: "https://images.unsplash.com/photo-1581783342605-292605fa659a?w=500&auto=format&fit=crop&q=60",
      difficulty: "mudah",
      estimatedCost: 5000,
      estimatedTimeMinutes: 25,
      shortDescription: "Transformasi botol plastik biasa menjadi vas bunga cantik bernuansa rustic.",
    },
  ],
  plastik_hdpe: [
    {
      id: "prod_hdpe_1",
      name: "Sudu / Sendok Takar Tanaman",
      thumbnailUri: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=500&auto=format&fit=crop&q=60",
      difficulty: "sedang",
      estimatedCost: 1000,
      estimatedTimeMinutes: 20,
      shortDescription: "Sendok serbaguna untuk pupuk dan media tanam dari jerigen bekas.",
    },
  ],
  kardus: [
    {
      id: "prod_kardus_1",
      name: "Organizer Meja Multifungsi",
      thumbnailUri: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&auto=format&fit=crop&q=60",
      difficulty: "sedang",
      estimatedCost: 4000,
      estimatedTimeMinutes: 45,
      shortDescription: "Rak sekat meja kerja rapi untuk alat tulis, handphone, dan dokumen.",
    },
  ],
  kaleng: [
    {
      id: "prod_kaleng_1",
      name: "Lampu Hias Perforasi Kaleng",
      thumbnailUri: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=500&auto=format&fit=crop&q=60",
      difficulty: "sedang",
      estimatedCost: 6000,
      estimatedTimeMinutes: 40,
      shortDescription: "Lampu tidur artistik dengan pola lubang cahaya indah dari kaleng bekas.",
    },
  ],
  kaca: [
    {
      id: "prod_kaca_1",
      name: "Lampu Hias Botol LED Rustic",
      thumbnailUri: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&auto=format&fit=crop&q=60",
      difficulty: "mudah",
      estimatedCost: 15000,
      estimatedTimeMinutes: 15,
      shortDescription: "Lampu meja hangat tanpa potong kaca, cukup masukkan string LED ke dalam botol.",
    },
  ],
  sachet: [
    {
      id: "prod_sachet_1",
      name: "Dompet Lipat Anyaman Sachet",
      thumbnailUri: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=60",
      difficulty: "sulit",
      estimatedCost: 3000,
      estimatedTimeMinutes: 90,
      shortDescription: "Dompet fungsional tahan air dari teknik lipat anyaman limbah sachet.",
    },
  ],
};

export const MOCK_TUTORIALS: Record<string, ProductTutorial> = {
  prod_pet_1: {
    productId: "prod_pet_1",
    toolsAndMaterials: [
      "1 Botol plastik bekas ukuran 1.5 Liter",
      "Gunting tajam / Cutter",
      "Cat sempil / Akrilik (warna pilihan)",
      "Tali gantung / Tali rami",
      "Tanaman hias & media tanam",
    ],
    beforeImageUri: "https://images.unsplash.com/photo-1595855759920-86582396756a?w=500&auto=format&fit=crop&q=60",
    afterImageUri: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&auto=format&fit=crop&q=60",
    mockupImageUri: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&auto=format&fit=crop&q=60",
    steps: [
      {
        order: 1,
        title: "Pembersihan & Pelepasan Label",
        description: "Cuci bersih botol plastik dengan sabun dan air mengalir. Lepaskan seluruh stiker label merk agar permukaan bersih.",
        imageUri: "https://images.unsplash.com/photo-1584824486509-112e4181ff6b?w=500&auto=format&fit=crop&q=60",
      },
      {
        order: 2,
        title: "Pembuatan Pola Potongan",
        description: "Gunakan spidol untuk membuat garis potong melingkar di 3/4 bagian bawah botol, atau buat bentuk telinga hewan yang lucu.",
        imageUri: "https://images.unsplash.com/photo-1581783342605-292605fa659a?w=500&auto=format&fit=crop&q=60",
        safetyWarning: "Hati-hati saat menggunakan cutter/gunting tajam untuk melubangi awal botol.",
      },
      {
        order: 3,
        title: "Pemotongan Sesuai Pola",
        description: "Potong botol perlahan mengikuti garis pola yang telah dibuat. Rapikan bagian tepi yang tajam dengan amplas halus.",
        imageUri: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&auto=format&fit=crop&q=60",
      },
      {
        order: 4,
        title: "Pembuatan Lubang Drainase",
        description: "Buat 2-3 lubang kecil di bagian bawah botol menggunakan paku panas agar air siraman tanaman tidak menggenang.",
        imageUri: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=500&auto=format&fit=crop&q=60",
        safetyWarning: "Gunakan penjepit saat memanaskan paku agar tidak terkena luka bakar.",
      },
      {
        order: 5,
        title: "Pengecatan & Dekorasi",
        description: "Warnai bagian luar pot dengan cat akrilik atau cat semprot sesuai selera. Biarkan hingga kering sempurna (± 2 jam).",
        imageUri: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=500&auto=format&fit=crop&q=60",
      },
      {
        order: 6,
        title: "Pemasangan Tali & Penanaman",
        description: "Ikatkan tali gantung pada sisi kiri dan kanan botol. Masukkan media tanam dan tanaman hias kesayangan Anda.",
        imageUri: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&auto=format&fit=crop&q=60",
      },
    ],
  },
};

export const MOCK_PRICING: Record<string, PricingEstimate> = {
  prod_pet_1: {
    productId: "prod_pet_1",
    materialCost: 5000,
    additionalCost: 7000,
    suggestedSellPrice: 35000,
    estimatedProfit: 23000,
    priceRangeLow: 25000,
    priceRangeHigh: 50000,
    notes: "Pot tanaman gantung daur ulang memiliki nilai jual tinggi di pasaran urban farming karena konsep eco-friendly dan estetik.",
  },
};

export const MOCK_SELLING: Record<string, SellingKit> = {
  prod_pet_1: {
    productId: "prod_pet_1",
    productName: "EcoHanging Pot - Pot Tanaman Gantung Daur Ulang Estetik",
    description: "Hadirkan nuansa hijau di rumah minimalis Anda dengan EcoHanging Pot. Terbuat dari 100% botol plastik daur ulang pilihan yang disulap menjadi dekorasi dinding/taman gantung yang cantik dan tahan lama.",
    captions: [
      "Kurangi sampah plastik dengan gaya! 🌱 Ubah botol bekas jadi sudut hijau di rumahmu dengan EcoHanging Pot handmade ini. Yuk dukung ekonomi sirkular! ♻️✨ #Upcycling #EcoFriendly #TanamanHias",
      "Siapa sangka botol bekas air mineral bisa jadi seestetik ini? Cocok banget buat dekorasi balkon atau ruang tamu minimalis kamu. Dapatkan sekarang juga! 🪴💚",
    ],
    photoTips: [
      "Ambil foto dengan latar belakang dinding putih atau tanaman hidup agar kesan natural semakin kuat.",
      "Gunakan pencahayaan alami (cahaya matahari pagi) saat memotret produk.",
      "Tampilkan foto sebelum dan sesudah (before-after) untuk menarik minat pembeli sadar lingkungan.",
    ],
    packagingIdeas: [
      "Gunakan kertas kraft cokelat daur ulang sebagai pembungkus utama.",
      "Tambahkan label stiker terima kasih berlogo '100% Recycled Material'.",
      "Gunakan tali rami untuk mengikat kemasan luar.",
    ],
  },
};
