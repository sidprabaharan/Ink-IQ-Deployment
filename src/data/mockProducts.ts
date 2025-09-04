
// Enhanced S&S Activewear Product Data (Production Ready)
export const mockProducts = [
  {
    id: 1,
    sku: 'B15453', // Real S&S SKU from their email
    name: 'Gildan Ultra Cotton T-Shirt - 2000',
    category: 'T-Shirts',
    suppliers: [
      { name: 'S&S Activewear', price: 3.42, inventory: 2850 },
      { name: 'SanMar', price: 3.58, inventory: 1250 },
      { name: 'Alphabroder', price: 3.65, inventory: 850 },
      { name: 'TSC Apparel', price: 3.78, inventory: 750 }
    ],
    lowestPrice: 3.42,
    colors: ['#FFFFFF', '#000000', '#1560BD', '#D22B2B', '#1F6357', '#FFC72C', '#8B4513'],
    image: '/lovable-uploads/2436aa64-1e48-430d-a686-cc02950cceb4.png',
    description: '6 oz. (US) 10 oz. (CA), 100% preshrunk cotton. Double-needle stitched neckline and sleeves.',
    brand: 'Gildan',
    supplierId: 'SS'
  },
  {
    id: 2,
    sku: '18500',
    name: 'Gildan Adult Heavy Blend 8 oz., 50/50 Hooded Sweatshirt',
    category: 'Hoodies',
    suppliers: [
      { name: 'SanMar', price: 9.18, inventory: 600 },
      { name: 'Alphabroder', price: 9.40, inventory: 750 },
      { name: 'S&S Activewear', price: 9.59, inventory: 820 },
      { name: 'TSC Apparel', price: 9.84, inventory: 450 }
    ],
    lowestPrice: 9.18,
    colors: ['#D22B2B', '#1F6357', '#000000', '#808080', '#FFFFFF', '#1560BD'],
    image: '/lovable-uploads/c4a2e62e-d9d7-49f3-bace-163bc9df5931.png'
  },
  {
    id: 3,
    sku: '3001',
    name: 'Bella+Canvas Unisex Jersey T-Shirt',
    category: 'T-Shirts',
    suppliers: [
      { name: 'SanMar', price: 3.99, inventory: 950 },
      { name: 'Alphabroder', price: 4.15, inventory: 1120 },
      { name: 'S&S Activewear', price: 4.15, inventory: 1300 },
      { name: 'TSC Apparel', price: 4.31, inventory: 780 }
    ],
    lowestPrice: 3.99,
    colors: ['#4682B4', '#000000', '#FFFFFF', '#808080', '#D22B2B'],
    image: '/lovable-uploads/41bb539e-91d5-483d-b97e-96f1a6212afb.png'
  },
  {
    id: 4,
    sku: '3600',
    name: 'Next Level Cotton T-Shirt',
    category: 'T-Shirts',
    suppliers: [
      { name: 'SanMar', price: 4.50, inventory: 800 },
      { name: 'Alphabroder', price: 4.75, inventory: 1200 },
      { name: 'S&S Activewear', price: 4.35, inventory: 950 },
      { name: 'TSC Apparel', price: 4.60, inventory: 700 }
    ],
    lowestPrice: 4.35,
    colors: ['#FFFFFF', '#000000', '#D22B2B', '#1F6357', '#808080'],
    image: '/lovable-uploads/0f2f963a-be07-440e-a674-9411a7a65c92.png'
  },
  {
    id: 5,
    sku: '2000',
    name: 'Gildan Ultra Cotton T-Shirt',
    category: 'T-Shirts',
    suppliers: [
      { name: 'SanMar', price: 3.10, inventory: 1800 },
      { name: 'Alphabroder', price: 3.25, inventory: 1250 },
      { name: 'S&S Activewear', price: 3.20, inventory: 1400 },
      { name: 'TSC Apparel', price: 3.30, inventory: 900 }
    ],
    lowestPrice: 3.10,
    colors: ['#FFFFFF', '#000000', '#D22B2B', '#1F6357', '#1560BD', '#FFC72C'],
    image: '/lovable-uploads/c67f3c35-f254-4d8a-8de3-9e877d37d2d6.png'
  },
  {
    id: 6,
    sku: 'F497',
    name: 'Fruit of the Loom Adult 5 oz HD Cotton™ T-Shirt',
    category: 'T-Shirts',
    suppliers: [
      { name: 'SanMar', price: 2.89, inventory: 1500 },
      { name: 'Alphabroder', price: 2.95, inventory: 1100 },
      { name: 'S&S Activewear', price: 2.85, inventory: 1250 },
      { name: 'TSC Apparel', price: 3.00, inventory: 950 }
    ],
    lowestPrice: 2.85,
    colors: ['#FFFFFF', '#000000', '#D22B2B', '#1F6357'],
    image: '/lovable-uploads/481e360f-8b8c-48ae-ae53-d635899c4dd5.png'
  },
  {
    id: 7,
    sku: 'PC61',
    name: 'Port & Company Essential T-Shirt',
    category: 'T-Shirts',
    suppliers: [
      { name: 'SanMar', price: 3.85, inventory: 950 },
      { name: 'Alphabroder', price: 3.95, inventory: 850 },
      { name: 'S&S Activewear', price: 3.80, inventory: 1000 },
      { name: 'TSC Apparel', price: 4.00, inventory: 750 }
    ],
    lowestPrice: 3.80,
    colors: ['#FFFFFF', '#000000', '#D22B2B', '#1560BD', '#FFC72C'],
    image: '/lovable-uploads/481e360f-8b8c-48ae-ae53-d635899c4dd5.png'
  },
  {
    id: 8,
    sku: 'ST850',
    name: 'Sport-Tek PosiCharge Competitor Tee',
    category: 'T-Shirts',
    suppliers: [
      { name: 'SanMar', price: 6.49, inventory: 750 },
      { name: 'Alphabroder', price: 6.75, inventory: 670 },
      { name: 'S&S Activewear', price: 6.40, inventory: 800 },
      { name: 'TSC Apparel', price: 6.60, inventory: 550 }
    ],
    lowestPrice: 6.40,
    colors: ['#FFFFFF', '#000000', '#D22B2B', '#1560BD'],
    image: '/lovable-uploads/481e360f-8b8c-48ae-ae53-d635899c4dd5.png'
  }
];
