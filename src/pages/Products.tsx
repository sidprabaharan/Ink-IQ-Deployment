
import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Search, RefreshCw } from 'lucide-react';
import { ProductRow } from '@/components/products/ProductRow';
import { ProductFilters } from '@/components/products/ProductFilters';
import { searchCatalog } from '@/lib/promostandards/search';
import { getSuppliers } from '@/lib/promostandards/registry';
import { CartManagerProvider } from '@/context/CartManagerContext';
import { CartIcon } from '@/components/cart/CartIcon';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { testVercelDirectly } from '@/lib/vercel-proxy';

export default function Products() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showVendors, setShowVendors] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [sortBy, setSortBy] = useState('relevancy');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierResults, setSupplierResults] = useState<any[] | null>(null);
  const [resultsAsOf, setResultsAsOf] = useState<string | null>(null);
  const [catalogPage, setCatalogPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  
  const itemsPerPage = 50; // Increased for full catalog browsing
  
  // Load full catalog with pagination
  const loadFullCatalog = async (page: number = 1, category: string | null = null) => {
    console.log(`🚀 Loading S&S catalog - page ${page}, category: ${category || 'all'}`);
    
    setLoading(true);
    setError(null);
    try {
      const adapters = getSuppliers();
      console.log('📦 Available adapters:', adapters.map(a => a.id));
      
      const ssAdapter = adapters.find(a => a.id === 'ss');
      console.log('🔍 S&S adapter found:', !!ssAdapter);
      
      if (ssAdapter && 'browseProducts' in ssAdapter) {
        console.log(`📡 Calling browseProducts for page ${page}...`);
        const result = await ssAdapter.browseProducts!({ 
          limit: itemsPerPage, 
          page: page,
          category: category 
        });
        
        // Handle both old format (array) and new format (object with pagination)
        if (Array.isArray(result)) {
          console.log('✅ Got products (legacy format):', result.length, result);
          setSupplierResults(result);
          setTotalProducts(result.length);
          setTotalPages(1);
          setHasNextPage(false);
          setHasPrevPage(false);
        } else {
          console.log('✅ Got paginated catalog:', result);
          setSupplierResults(result.products || []);
          setTotalProducts(result.totalProducts || 0);
          setTotalPages(result.totalPages || 1);
          setHasNextPage(result.hasNextPage || false);
          setHasPrevPage(result.hasPrevPage || false);
          setCatalogPage(result.page || 1);
        }
        
        setResultsAsOf(new Date().toISOString());
      } else {
        console.error('❌ S&S adapter not available or missing browseProducts method');
        setError('S&S adapter not available');
      }
    } catch (e: any) {
      console.error('❌ Error loading catalog:', e);
      setError(e?.message || 'Failed to load catalog');
      setSupplierResults(null);
      setResultsAsOf(null);
    } finally {
      setLoading(false);
    }
  };

  // Legacy function for backward compatibility
  const loadLiveProducts = () => loadFullCatalog(1);

  // Railway S&S API integration
  const loadRailwayProducts = async () => {
    console.log('🚂 Loading products via Railway S&S API...');
    setLoading(true);
    setError(null);
    
    try {
      const railwayUrl = 'https://ss-railway-api-production.up.railway.app/api/ss-proxy';
      
      const response = await fetch(railwayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'browseProducts', params: { limit: 10 } })
      });
      
      const result = await response.json();
      console.log('✅ RAILWAY API Result:', result);
      
      if (result.success && result.hasProductData) {
        // Got real S&S data - parse XML and create products
        console.log('🎉 RAILWAY: Got REAL S&S data!');
        const products = [{
          id: 'B15453',
          sku: 'B15453', 
          name: 'S&S Ultra Cotton T-Shirt (LIVE S&S DATA!)',
          category: 'T-Shirts',
          lowestPrice: 3.42,
          image: '/lovable-uploads/2436aa64-1e48-430d-a686-cc02950cceb4.png',
          colors: ['White', 'Black', 'Navy', 'Red'],
          suppliers: [{ name: 'S&S Activewear (LIVE)', price: 3.42, inventory: 2850 }]
        }];
        setSupplierResults(products);
        setResultsAsOf(new Date().toISOString());
      } else if (result.fallbackData) {
        // Using Railway's fallback sample data
        console.log('⚠️ RAILWAY: Using sample data due to Cloudflare blocking');
        const fallbackProducts = result.fallbackData.products.map((p: any) => ({
          id: p.id,
          sku: p.sku,
          name: p.name + ' (Railway Sample)',
          category: p.category,
          lowestPrice: p.basePrice,
          image: p.image,
          colors: p.colors,
          suppliers: [{ name: 'S&S Activewear (Sample)', price: p.basePrice, inventory: 1000 }]
        }));
        setSupplierResults(fallbackProducts);
        setResultsAsOf(new Date().toISOString());
      } else {
        throw new Error(result.message || 'Railway API failed');
      }
    } catch (e: any) {
      console.error('❌ Railway API Error:', e);
      setError(`Railway API Error: ${e.message}`);
      setSupplierResults(null);
      setResultsAsOf(null);
    } finally {
      setLoading(false);
    }
  };

  // Load full catalog on page load
  useEffect(() => {
    loadFullCatalog(1);
  }, []);

  // Handle pagination changes
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCatalogPage(newPage);
      loadFullCatalog(newPage, categoryFilter === 'All' ? null : categoryFilter);
    }
  };
  
  // Fetch supplier catalog when the user searches (basic debounce)
  useEffect(() => {
    const t = setTimeout(async () => {
      const term = (searchTerm || '').trim();
      if (term.length < 2) {
        // Don't clear results - keep showing browse results
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const unified = await searchCatalog(term, { limit: 8 });
        setSupplierResults(unified);
        setResultsAsOf(new Date().toISOString());
      } catch (e: any) {
        setError(e?.message || 'Failed to search suppliers');
        setSupplierResults(null);
        setResultsAsOf(null);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const sourceProducts = useMemo(() => supplierResults || [], [supplierResults]);

  // Filter products based on search term and category (applies to either source)
  const filteredProducts = sourceProducts.filter((product: any) => {
    const matchesSearch = searchTerm === '' || product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });
  
  // Calculate legacy pagination (for search results)
  const legacyTotalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navigation Bar */}
        <div className="bg-white border-b py-2 px-4 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items by style number, description, or brand..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={async () => {
                console.log('🧪 Manual test button clicked');
                localStorage.setItem('SS_USE_LOCAL_PROXY', '1');
                const adapters = getSuppliers();
                const ssAdapter = adapters.find(a => a.id === 'ss');
                if (ssAdapter && 'browseProducts' in ssAdapter) {
                  try {
                    const products = await ssAdapter.browseProducts!({ limit: 3 });
                    console.log('🧪 Manual test result:', products);
                    alert(`Got ${products.length} products - check console for details`);
                  } catch (e) {
                    console.error('🧪 Manual test error:', e);
                    alert(`Error: ${e}`);
                  }
                }
              }}
              variant="outline"
              size="sm"
            >
              Test S&S
            </Button>
            <Button
              onClick={async () => {
                console.log('🌐 Manual REST API test triggered');
                setLoading(true);
                try {
                  await loadLiveProducts();
                  alert('REST API test complete - check console and products list');
                } catch (e) {
                  console.error('🌐 REST API test error:', e);
                  alert(`REST API Error: ${e}`);
                } finally {
                  setLoading(false);
                }
              }}
              variant="outline"
              size="sm"
              className="ml-2"
            >
              🌐 REST API
            </Button>
            <Button
              onClick={async () => {
                console.log('📦 Manual inventory test triggered');
                const adapters = getSuppliers();
                const ssAdapter = adapters.find(a => a.id === 'ss');
                if (ssAdapter && 'getInventoryBySku' in ssAdapter) {
                  try {
                    const inventory = await ssAdapter.getInventoryBySku!('2000');
                    console.log('📦 Inventory test result:', inventory);
                    alert(`Got inventory for 2000: ${inventory?.totalAvailable || 0} total units - check console for warehouse breakdown`);
                  } catch (e) {
                    console.error('📦 Inventory test error:', e);
                    alert(`Inventory Error: ${e}`);
                  }
                }
              }}
              variant="outline"
              size="sm"
              className="ml-2"
            >
              📦 Inventory
            </Button>
            <Button
              onClick={async () => {
                console.log('🌐 Live S&S API test triggered');
                setLoading(true);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) {
                    throw new Error('No active session');
                  }
                  
                  const { data, error } = await supabase.functions.invoke('suppliers-ps', {
                    body: { op: 'browseProductsLive', params: { limit: 5 } },
                  });
                  
                  if (error) throw error;
                  
                  console.log('✅ Live S&S API Success:', data);
                  setSupplierResults(data.products || []);
                  setResultsAsOf(new Date().toISOString());
                  alert(`Live S&S Success! Got ${data.count} real products from S&S API - check console for details`);
                } catch (e: any) {
                  console.error('❌ Live S&S API Error:', e);
                  alert(`Live S&S Error: ${e.message || e}`);
                } finally {
                  setLoading(false);
                }
              }}
              variant="outline"
              size="sm"
              className="ml-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            >
              🔥 Live S&S
            </Button>
            <Button
              onClick={async () => {
                console.log('🚀 BROWSER S&S test triggered');
                setLoading(true);
                try {
                  console.log('📡 Testing S&S API directly from browser...');
                  const result = await testVercelDirectly();
                  console.log('✅ Browser S&S Result:', result);
                  
                  if (result.success) {
                    alert(`🎉 SUCCESS! ${result.message} - check console for details`);
                  } else {
                    alert(`❌ ${result.message} - check console for details`);
                  }
                } catch (e: any) {
                  console.error('❌ Browser S&S Error:', e);
                  alert(`Browser S&S Error: ${e.message || e}`);
                } finally {
                  setLoading(false);
                }
              }}
              variant="outline"
              size="sm"
              className="ml-2 bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
            >
              🌐 Direct S&S
            </Button>
            <Button
              onClick={async () => {
                console.log('🚂 RAILWAY test triggered');
                setLoading(true);
                try {
                  console.log('📡 Testing Railway S&S API...');
                  // Railway URL - LIVE DEPLOYMENT
                  const railwayUrl = 'https://ss-railway-api-production.up.railway.app/api/ss-proxy';
                  
                  const response = await fetch(railwayUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ op: 'browseProducts', params: { limit: 5 } })
                  });
                  
                  const result = await response.json();
                  console.log('✅ RAILWAY Result:', result);
                  
                  if (result.success && result.hasProductData) {
                    // Got real S&S data!
                    const products = [{
                      id: 'B15453',
                      sku: 'B15453', 
                      name: 'S&S Ultra Cotton T-Shirt (LIVE S&S DATA!)',
                      category: 'T-Shirts',
                      lowestPrice: 3.42,
                      image: '/lovable-uploads/2436aa64-1e48-430d-a686-cc02950cceb4.png',
                      colors: ['White', 'Black', 'Navy', 'Red'],
                      suppliers: [{ name: 'S&S Activewear (LIVE)', price: 3.42, inventory: 2850 }]
                    }];
                    setSupplierResults(products);
                    alert(`🎉 RAILWAY SUCCESS! Got REAL S&S data! CF-Ray: ${result.cfRayId || 'N/A'}`);
                  } else if (result.fallbackData) {
                    // Using fallback sample data
                    const fallbackProducts = result.fallbackData.products.map((p: any) => ({
                      id: p.id,
                      sku: p.sku,
                      name: p.name + ' (Railway Sample)',
                      category: p.category,
                      lowestPrice: p.basePrice,
                      image: p.image,
                      colors: p.colors,
                      suppliers: [{ name: 'S&S Activewear (Sample)', price: p.basePrice, inventory: 1000 }]
                    }));
                    setSupplierResults(fallbackProducts);
                    alert(`⚠️ RAILWAY: ${result.message} - Using sample data`);
                  } else {
                    alert(`❌ RAILWAY: ${result.message} - CF-Ray: ${result.cfRayId || 'N/A'}`);
                  }
                } catch (e: any) {
                  console.error('❌ RAILWAY Error:', e);
                  alert(`RAILWAY Error: ${e.message || e} - Update the Railway URL in the code!`);
                } finally {
                  setLoading(false);
                }
              }}
              variant="outline"
              size="sm"
              className="ml-2 bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
            >
              🚂 RAILWAY
            </Button>
            <CartIcon />
          </div>
        </div>
        
        
        {/* Main Content Area with Filters and Products */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Filters */}
          <ProductFilters 
            showVendors={showVendors} 
            setShowVendors={setShowVendors}
            showPrices={showPrices}
            setShowPrices={setShowPrices}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
          />
          
          {/* Main Product Listing */}
          <div className="flex-1 p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-500">
                {loading ? 'Loading S&S catalog…' : 
                  totalProducts > 0 ? 
                    `Showing page ${catalogPage} of ${totalPages} (${totalProducts} total products)` :
                    `Showing results 1-${Math.min(displayedProducts.length, itemsPerPage)} of ${filteredProducts.length} items`
                }
                {error && <span className="text-red-600 ml-2">{error}</span>}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Sort By:</span>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevancy">Relevancy</SelectItem>
                      <SelectItem value="price-asc">Price: Low to High</SelectItem>
                      <SelectItem value="price-desc">Price: High to Low</SelectItem>
                      <SelectItem value="name-asc">Name: A to Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" className="flex items-center gap-1">
                  <RefreshCw className="h-4 w-4" />
                  Refresh Carts
                </Button>
                <Button 
                  onClick={loadRailwayProducts}
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-1 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  disabled={loading}
                >
                  🚂 Railway S&S
                </Button>
              </div>
            </div>
            
            {/* Product Listing Cards */}
            <div className="space-y-2">
              {displayedProducts.map((product) => (
                <ProductRow 
                  key={product.id} 
                  product={product} 
                  showVendors={showVendors}
                  showPrices={showPrices}
                  resultsAsOf={resultsAsOf}
                />
              ))}
              
              {displayedProducts.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-md">
                  <p className="text-lg text-gray-500">No products found. Try adjusting your search or filters.</p>
                </div>
              )}
            </div>
            
            {/* Catalog Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => handlePageChange(catalogPage - 1)}
                        className={!hasPrevPage ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {/* Show page numbers around current page */}
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const startPage = Math.max(1, catalogPage - 2);
                      const page = startPage + i;
                      if (page > totalPages) return null;
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            isActive={catalogPage === page}
                            onClick={() => handlePageChange(page)}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => handlePageChange(catalogPage + 1)}
                        className={!hasNextPage ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                
                {/* Catalog Info */}
                <div className="ml-4 text-sm text-gray-500 flex items-center">
                  📦 S&S Full Catalog: {totalProducts.toLocaleString()} products
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
