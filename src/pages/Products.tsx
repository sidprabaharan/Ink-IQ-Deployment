
import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Search } from 'lucide-react';
import { ProductRow } from '@/components/products/ProductRow';
import { ProductFilters } from '@/components/products/ProductFilters';
import { searchCatalog } from '@/lib/promostandards/search';
import { getSuppliers } from '@/lib/promostandards/registry';
import { CartManagerProvider } from '@/context/CartManagerContext';
import { CartIcon } from '@/components/cart/CartIcon';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { searchSSCatalog, mapSSProductToUnified } from '@/lib/ss-catalog';
import { SSProductsShowcase } from '@/components/products/SSProductsShowcase';

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
  const [useLocalCatalog, setUseLocalCatalog] = useState(true);
  
  const itemsPerPage = 100; // Show more products per page
  
  // Load from local S&S catalog database
  const loadLocalCatalog = async (page: number = 1, category: string | null = null) => {
    console.log(`🗄️ Loading from local S&S catalog - page ${page}, category: ${category || 'all'}`);
    
    setLoading(true);
    setError(null);
    
    try {
      const offset = (page - 1) * itemsPerPage;
      
      const result = await searchSSCatalog({
        query: searchTerm.trim() || undefined,
        category: category === 'All' ? undefined : category,
        limit: itemsPerPage,
        offset,
      });
      
      // Map local catalog products to the format expected by ProductRow
      const mappedProducts = result.products.map(mapSSProductToUnified);
      
      console.log('✅ Got products from local catalog:', result);
      setSupplierResults(mappedProducts);
      setTotalProducts(result.totalCount);
      setTotalPages(result.totalPages);
      setHasNextPage(result.hasNextPage);
      setHasPrevPage(result.hasPrevPage);
      setCatalogPage(result.page);
      setResultsAsOf(new Date().toISOString());
      
      // Auto-sync ALL products in the background
      console.log(`🔄 Auto-syncing all ${result.products.length} products with S&S APIs...`);
      
      // Sync all products to ensure we have the latest data
      supabase.functions.invoke('ss-promostandards-soap', {
        body: { 
          op: 'syncAll'
        }
      }).then(response => {
        if (response.data?.success) {
          console.log('✅ Auto-sync completed:', response.data.message);
          // Reload after sync completes to show updated data
          setTimeout(() => {
            loadLocalCatalog(page, category);
          }, 5000);
        }
      }).catch(err => {
        console.log('⚠️ Auto-sync failed:', err);
      });
      
      // Also sync any products missing critical data immediately
      const needsSync = result.products.filter((p: any) => !p.min_price || !p.primary_image_url);
      if (needsSync.length > 0) {
        console.log(`📸 Found ${needsSync.length} products missing data, syncing immediately...`);
        const productIds = needsSync.map((p: any) => p.style_id);
        supabase.functions.invoke('ss-promostandards-soap', {
          body: { 
            op: 'syncMultiple',
            productIds: productIds
          }
        });
      }
      
    } catch (e: any) {
      console.error('❌ Error loading local catalog:', e);
      setError(e?.message || 'Failed to load local catalog');
      setSupplierResults(null);
      setResultsAsOf(null);
      
      // Fallback to API-based loading if local catalog fails
      if (useLocalCatalog) {
        console.log('🔄 Falling back to API-based catalog loading');
        setUseLocalCatalog(false);
        await loadFullCatalog(page, category);
      }
    } finally {
      setLoading(false);
    }
  };
  
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


  // Load catalog on page load
  useEffect(() => {
    if (useLocalCatalog) {
      loadLocalCatalog(1);
    } else {
      loadFullCatalog(1);
    }
  }, [useLocalCatalog]);

  // Handle pagination changes
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCatalogPage(newPage);
      const categoryParam = categoryFilter === 'All' ? null : categoryFilter;
      
      if (useLocalCatalog) {
        loadLocalCatalog(newPage, categoryParam);
      } else {
        loadFullCatalog(newPage, categoryParam);
      }
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
              </div>
            </div>

            {/* S&S Products Showcase - Enhanced Products with Images & Pricing */}
            {useLocalCatalog && (
              <div className="mb-6">
                <SSProductsShowcase limit={6} />
              </div>
            )}
            
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
