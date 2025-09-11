import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Truck, Clock, MapPin, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ShippingEstimate {
  warehouse_id: string;
  shipping_method: string;
  cutoff_time: string;
  cutoff_timezone: string;
  transit_days_min: number;
  transit_days_max: number;
}

interface WarehouseInventory {
  warehouse_id: string;
  warehouse_name: string;
  city: string;
  state: string;
  quantity_available: number;
}

interface ShippingCalculatorProps {
  productId: string;
  quantity: number;
  warehouseInventory?: WarehouseInventory[];
}

export function ShippingCalculator({ productId, quantity, warehouseInventory }: ShippingCalculatorProps) {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ground');
  const [shippingEstimates, setShippingEstimates] = useState<ShippingEstimate[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    loadShippingEstimates();
  }, []);

  useEffect(() => {
    // Auto-select warehouse with most inventory
    if (warehouseInventory && warehouseInventory.length > 0 && !selectedWarehouse) {
      const bestWarehouse = warehouseInventory.reduce((prev, current) => 
        (current.quantity_available > prev.quantity_available) ? current : prev
      );
      setSelectedWarehouse(bestWarehouse.warehouse_id);
    }
  }, [warehouseInventory]);

  const loadShippingEstimates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ss_shipping_estimates')
        .select('*')
        .order('warehouse_id');
      
      if (error) throw error;
      setShippingEstimates(data || []);
    } catch (error) {
      console.error('Error loading shipping estimates:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDeliveryDate = (estimate: ShippingEstimate) => {
    const now = new Date();
    const cutoffParts = estimate.cutoff_time.split(':');
    const cutoffHour = parseInt(cutoffParts[0]);
    const cutoffMinute = parseInt(cutoffParts[1]);
    
    // Convert cutoff time to local timezone
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffHour, cutoffMinute, 0, 0);
    
    // Adjust for timezone
    const timezoneOffsets: Record<string, number> = {
      'ET': -5, // Eastern Time
      'CT': -6, // Central Time
      'PT': -8, // Pacific Time
    };
    
    const offset = timezoneOffsets[estimate.cutoff_timezone] || -6;
    const localOffset = now.getTimezoneOffset() / 60;
    const hourDiff = localOffset + offset;
    cutoffDate.setHours(cutoffDate.getHours() + hourDiff);
    
    // If past cutoff, add a day
    let shipDate = new Date();
    if (now > cutoffDate) {
      shipDate.setDate(shipDate.getDate() + 1);
    }
    
    // Skip weekends for ship date
    while (shipDate.getDay() === 0 || shipDate.getDay() === 6) {
      shipDate.setDate(shipDate.getDate() + 1);
    }
    
    // Calculate delivery dates
    const minDelivery = new Date(shipDate);
    const maxDelivery = new Date(shipDate);
    
    // Add transit days (skip weekends)
    let daysAdded = 0;
    while (daysAdded < estimate.transit_days_min) {
      minDelivery.setDate(minDelivery.getDate() + 1);
      if (minDelivery.getDay() !== 0 && minDelivery.getDay() !== 6) {
        daysAdded++;
      }
    }
    
    daysAdded = 0;
    while (daysAdded < estimate.transit_days_max) {
      maxDelivery.setDate(maxDelivery.getDate() + 1);
      if (maxDelivery.getDay() !== 0 && maxDelivery.getDay() !== 6) {
        daysAdded++;
      }
    }
    
    return {
      shipDate,
      minDelivery,
      maxDelivery,
      isPastCutoff: now > cutoffDate
    };
  };

  const currentEstimate = shippingEstimates.find(
    e => e.warehouse_id === selectedWarehouse && e.shipping_method === selectedMethod
  );

  const deliveryInfo = currentEstimate ? calculateDeliveryDate(currentEstimate) : null;
  const selectedWarehouseInfo = warehouseInventory?.find(w => w.warehouse_id === selectedWarehouse);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Truck className="w-5 h-5" />
          Shipping Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warehouse Selection */}
        <div>
          <label className="text-sm font-medium mb-2 block">Ship From Warehouse</label>
          <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
            <SelectTrigger>
              <SelectValue placeholder="Select warehouse" />
            </SelectTrigger>
            <SelectContent>
              {warehouseInventory?.map(warehouse => (
                <SelectItem 
                  key={warehouse.warehouse_id} 
                  value={warehouse.warehouse_id}
                  disabled={warehouse.quantity_available < quantity}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{warehouse.city}, {warehouse.state}</span>
                    <Badge 
                      variant={warehouse.quantity_available >= quantity ? "default" : "destructive"}
                      className="ml-2"
                    >
                      {warehouse.quantity_available} available
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Shipping Method */}
        <div>
          <label className="text-sm font-medium mb-2 block">Shipping Method</label>
          <Select value={selectedMethod} onValueChange={setSelectedMethod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ground">Ground Shipping</SelectItem>
              <SelectItem value="express">Express Shipping</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Delivery Estimate */}
        {currentEstimate && deliveryInfo && selectedWarehouseInfo && (
          <div className="space-y-3">
            {/* Cutoff Time */}
            <Alert className={deliveryInfo.isPastCutoff ? "border-yellow-200" : "border-green-200"}>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                {deliveryInfo.isPastCutoff ? (
                  <>Order by <strong>{currentEstimate.cutoff_time} {currentEstimate.cutoff_timezone}</strong> tomorrow for same-day processing</>
                ) : (
                  <>Order within <strong>{getTimeUntilCutoff(currentEstimate)}</strong> for same-day processing</>
                )}
              </AlertDescription>
            </Alert>

            {/* Delivery Dates */}
            <div className="bg-blue-50 p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="font-medium">
                  Shipping from {selectedWarehouseInfo.city}, {selectedWarehouseInfo.state}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>
                  Estimated delivery: <strong>
                    {formatDeliveryDate(deliveryInfo.minDelivery, deliveryInfo.maxDelivery)}
                  </strong>
                </span>
              </div>
            </div>

            {/* Stock Warning */}
            {selectedWarehouseInfo.quantity_available < quantity * 2 && (
              <Alert className="border-yellow-200">
                <AlertDescription className="text-sm">
                  Limited stock at this location. Consider ordering soon.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getTimeUntilCutoff(estimate: ShippingEstimate): string {
  const now = new Date();
  const cutoffParts = estimate.cutoff_time.split(':');
  const cutoff = new Date();
  cutoff.setHours(parseInt(cutoffParts[0]), parseInt(cutoffParts[1]), 0, 0);
  
  const diff = cutoff.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} minutes`;
}

function formatDeliveryDate(minDate: Date, maxDate: Date): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  
  if (minDate.getTime() === maxDate.getTime()) {
    return minDate.toLocaleDateString('en-US', options);
  }
  
  return `${minDate.toLocaleDateString('en-US', options)} - ${maxDate.toLocaleDateString('en-US', options)}`;
}
