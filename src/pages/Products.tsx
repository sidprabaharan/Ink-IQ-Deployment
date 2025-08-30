
import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Search, RefreshCw } from 'lucide-react';
import { ProductRow } from '@/components/products/ProductRow';
import { ProductFilters } from '@/components/products/ProductFilters';
import { mockProducts } from '@/data/mockProducts';
import { searchCatalog } from '@/lib/promostandards/search';
import { CartManagerProvider } from '@/context/CartManagerContext';
import { CartIcon } from '@/components/cart/CartIcon';
import { Separator } from '@/components/ui/separator';

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
  
  const itemsPerPage = 5;
  
  // Fetch supplier catalog when the user searches (basic debounce)
  useEffect(() => {
    const t = setTimeout(async () => {
      const term = (searchTerm || '').trim();
      if (term.length < 2) {
        setSupplierResults(null);
        setError(null);
        setLoading(false);
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

  const sourceProducts = useMemo(() => {
    if (supplierResults && supplierResults.length > 0) {
      return supplierResults;
    }
    return mockProducts;
  }, [supplierResults]);

  // Filter products based on search term and category (applies to either source)
  const filteredProducts = sourceProducts.filter((product: any) => {
    const matchesSearch = searchTerm === '' || product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });
  
  // Calculate pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
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
                {loading ? 'Searching suppliers…' : `Showing results 1-${Math.min(displayedProducts.length, itemsPerPage)} of ${filteredProducts.length} items`}
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
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          isActive={currentPage === page}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
