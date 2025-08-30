import { PlaceholderAdapter, SupplierAdapter, SSAdapter } from './adapters'

// Registry for multi-supplier support. Replace placeholders as we implement real adapters.
const adapters: SupplierAdapter[] = [
  new SSAdapter(),
  new PlaceholderAdapter('sanmar', 'SanMar'),
  new PlaceholderAdapter('stormtech', 'Stormtech'),
]

export function getSuppliers(): SupplierAdapter[] {
  return adapters
}

export function getSupplierById(id: string): SupplierAdapter | undefined {
  return adapters.find(a => a.id === id)
}


