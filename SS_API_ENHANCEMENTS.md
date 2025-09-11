# S&S API Enhancement Plan

## Priority 1: Product Attributes & Specifications 🏷️

### Database Schema Updates
```sql
-- Add to ss_products table
ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS 
  weight DECIMAL(10,2),
  width DECIMAL(10,2),
  height DECIMAL(10,2),
  depth DECIMAL(10,2),
  units_per_carton INTEGER,
  carton_weight DECIMAL(10,2),
  carton_width DECIMAL(10,2),
  carton_height DECIMAL(10,2),
  carton_depth DECIMAL(10,2),
  is_closeout BOOLEAN DEFAULT false,
  is_caution BOOLEAN DEFAULT false,
  is_on_demand BOOLEAN DEFAULT false,
  is_hazmat BOOLEAN DEFAULT false,
  is_rush_service BOOLEAN DEFAULT false,
  gtin VARCHAR(20),
  country_of_origin VARCHAR(100),
  safety_warnings TEXT;
```

### Edge Function Updates
Update `parseProductDataResponse` to extract:
```typescript
productDimensions: {
  weight: product.Dimension?.weight,
  width: product.Dimension?.width,
  height: product.Dimension?.height,
  depth: product.Dimension?.depth,
},
packaging: {
  unitsPerCarton: product.ProductPackagingArray?.[0]?.Default,
  cartonWeight: product.ProductPackagingArray?.[0]?.Weight,
  cartonDimensions: {
    width: product.ProductPackagingArray?.[0]?.Width,
    height: product.ProductPackagingArray?.[0]?.Height,
    depth: product.ProductPackagingArray?.[0]?.Depth,
  }
},
flags: {
  isCloseout: product.isCloseout === 'true',
  isCaution: product.isCaution === 'true',
  isOnDemand: product.isOnDemand === 'true',
  isHazmat: product.isHazmat === 'true',
  rushService: product.rushService === 'true',
}
```

## Priority 2: FOB-Specific Pricing 💰

### Database Schema Updates
```sql
-- Create pricing table for warehouse-specific pricing
CREATE TABLE ss_pricing_by_fob (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id INTEGER REFERENCES ss_products(id),
  variant_id INTEGER REFERENCES ss_product_variants(id),
  fob_id VARCHAR(10) REFERENCES ss_warehouse_locations(id),
  quantity_min INTEGER NOT NULL,
  quantity_max INTEGER,
  price DECIMAL(10,2) NOT NULL,
  price_uom VARCHAR(10) DEFAULT 'EA',
  currency VARCHAR(3) DEFAULT 'USD',
  effective_date DATE,
  expiry_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Implementation
```typescript
// In Edge Function - loop through all FOBs
const fobIds = ['IL', 'TX', 'NJ', 'GA', 'NV', 'KS', 'DS'];
for (const fobId of fobIds) {
  const pricingData = await getPricingByFOB(productId, fobId);
  await saveFOBPricing(productId, fobId, pricingData);
}
```

## Priority 3: Complete Media Content 🖼️

### Database Schema Updates
```sql
-- Enhance media storage
CREATE TABLE ss_product_media (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id INTEGER REFERENCES ss_products(id),
  variant_id INTEGER REFERENCES ss_product_variants(id),
  url TEXT NOT NULL,
  media_type VARCHAR(50), -- 'Image', 'Video', 'Document'
  class_type VARCHAR(50), -- 'Front', 'Back', 'Side', 'Lifestyle'
  color_hex VARCHAR(7),
  color_name VARCHAR(100),
  size VARCHAR(10), -- 'fs', 'fm', 'fl'
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### UI Enhancement
```typescript
// Product detail page - image gallery
const ProductImageGallery = ({ product }) => {
  const [selectedView, setSelectedView] = useState('front');
  const [selectedColor, setSelectedColor] = useState(product.colors[0]);
  
  return (
    <div className="image-gallery">
      <div className="main-image">
        <img src={getImageUrl(product, selectedColor, selectedView, 'fl')} />
      </div>
      <div className="thumbnails">
        {['front', 'back', 'side', 'lifestyle'].map(view => (
          <img 
            key={view}
            src={getImageUrl(product, selectedColor, view, 'fs')}
            onClick={() => setSelectedView(view)}
          />
        ))}
      </div>
    </div>
  );
};
```

## Priority 4: Shipping & Delivery Estimates 🚚

### Implementation
```typescript
// Calculate estimated delivery
const getDeliveryEstimate = (warehouseId: string, shippingMethod: string) => {
  const cutoffTimes = {
    'IL': '16:00 CT',
    'TX': '16:00 CT',
    'NJ': '17:00 ET',
    // ... etc
  };
  
  const transitDays = {
    'ground': { 'IL': 3, 'TX': 4, 'NJ': 2 },
    'express': { 'IL': 1, 'TX': 2, 'NJ': 1 },
  };
  
  // Calculate based on current time and cutoff
  return calculateDeliveryDate(warehouseId, shippingMethod, cutoffTimes, transitDays);
};
```

## Priority 5: Product Customization/Decoration 🎨

### Database Schema
```sql
CREATE TABLE ss_decoration_methods (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id INTEGER REFERENCES ss_products(id),
  method_name VARCHAR(100), -- 'Screen Print', 'Embroidery', etc.
  location_name VARCHAR(100), -- 'Left Chest', 'Full Back', etc.
  setup_charge DECIMAL(10,2),
  min_quantity INTEGER,
  max_colors INTEGER,
  price_per_location DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Implementation Checklist

1. **Phase 1** (1 week)
   - [ ] Add product attributes to database
   - [ ] Update Edge Function to parse all Product Data fields
   - [ ] Display specifications in UI

2. **Phase 2** (1 week)
   - [ ] Implement FOB-specific pricing
   - [ ] Add quantity break pricing display
   - [ ] Show price variations by warehouse

3. **Phase 3** (3-4 days)
   - [ ] Fetch all product images
   - [ ] Build image gallery component
   - [ ] Add color-specific image switching

4. **Phase 4** (3-4 days)
   - [ ] Add delivery estimation
   - [ ] Show shipping cutoff times
   - [ ] Display per-warehouse lead times

5. **Phase 5** (Optional - 1 week)
   - [ ] Parse decoration configuration
   - [ ] Build customization UI
   - [ ] Calculate decoration pricing
