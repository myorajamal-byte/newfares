import { supabase } from '@/integrations/supabase/client';

export type CustomerType = 'عادي' | 'المدينة' | 'مسوق' | 'شركات';

interface PricingRow {
  size: string;
  billboard_level: string;
  customer_category: string;
  one_month: number;
  '2_months': number;
  '3_months': number;
  '6_months': number;
  full_year: number;
  one_day: number;
}

// Cache for pricing data - initialized as empty arrays
let PRICING_CACHE: PricingRow[] = [];
let CUSTOMERS_CACHE: string[] = ['عادي', 'المدينة', 'مسوق', 'شركات'];
let CACHE_INITIALIZED = false;

// Initialize cache function
const initializeCache = async () => {
  if (CACHE_INITIALIZED) return;
  
  try {
    const pricingData = await getAllPricing();
    PRICING_CACHE = pricingData;
    
    const customerData = await getCustomerCategories();
    CUSTOMERS_CACHE = customerData;
    
    CACHE_INITIALIZED = true;
  } catch (error) {
    console.warn('Failed to initialize pricing cache:', error);
    // Use fallback data
    PRICING_CACHE = [];
    CUSTOMERS_CACHE = ['عادي', 'المدينة', 'مسوق', 'شركات'];
  }
};

async function getAllPricing(): Promise<PricingRow[]> {
  try {
    const { data, error } = await supabase
      .from('pricing')
      .select('*')
      .order('size', { ascending: true });

    if (error) {
      console.error('Error fetching pricing data:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAllPricing:', error);
    return [];
  }
}

async function getCustomerCategories(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('pricing_categories')
      .select('name')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching customer categories:', error);
      return ['عادي', 'المدينة', 'مسوق', 'شركات'];
    }

    const categories = data?.map((item: any) => item.name) || [];
    const staticCategories = ['عادي', 'المدينة', 'مسوق', 'شركات'];
    
    return Array.from(new Set([...staticCategories, ...categories]));
  } catch (error) {
    console.error('Error in getCustomerCategories:', error);
    return ['عادي', 'المدينة', 'مسوق', 'شركات'];
  }
}

function canonSize(size: string): string {
  if (!size) return '4x12';
  
  const normalized = size.toString().trim().toLowerCase();
  
  const sizeMap: Record<string, string> = {
    '4x12': '4x12',
    '4*12': '4x12',
    '4×12': '4x12',
    '12x4': '4x12',
    '12*4': '4x12',
    '12×4': '4x12',
    
    '6x18': '6x18',
    '6*18': '6x18',
    '6×18': '6x18',
    '18x6': '6x18',
    '18*6': '6x18',
    '18×6': '6x18',
    
    '8x24': '8x24',
    '8*24': '8x24',
    '8×24': '8x24',
    '24x8': '8x24',
    '24*8': '8x24',
    '24×8': '8x24',
    
    '3x9': '3x9',
    '3*9': '3x9',
    '3×9': '3x9',
    '9x3': '3x9',
    '9*3': '3x9',
    '9×3': '3x9',
    
    '2x6': '2x6',
    '2*6': '2x6',
    '2×6': '2x6',
    '6x2': '2x6',
    '6*2': '2x6',
    '6×2': '2x6',
  };
  
  return sizeMap[normalized] || size;
}

function canonLevel(level: any): string {
  if (!level) return 'عادي';
  
  const str = String(level).trim();
  const levelMap: Record<string, string> = {
    'عادي': 'عادي',
    'ممتاز': 'ممتاز',
    'vip': 'VIP',
    'VIP': 'VIP',
    'premium': 'ممتاز',
    'normal': 'عادي',
    'excellent': 'ممتاز',
  };
  
  return levelMap[str] || str;
}

export function getPriceFor(
  size: string | undefined,
  level: any,
  customer: CustomerType,
  months: number
): number | null {
  // Initialize cache if not already done
  if (!CACHE_INITIALIZED) {
    initializeCache();
  }

  const canonicalSize = canonSize(size || '');
  const canonicalLevel = canonLevel(level);
  
  // Use cached data
  const dbRow = PRICING_CACHE.find(p => 
    p.size === canonicalSize && 
    p.billboard_level === canonicalLevel && 
    p.customer_category === customer
  );
  
  if (dbRow) {
    const monthColumnMap: Record<number, keyof PricingRow> = {
      1: 'one_month',
      2: '2_months',
      3: '3_months',
      6: '6_months',
      12: 'full_year'
    };
    
    const column = monthColumnMap[months];
    if (column && dbRow[column] !== null && dbRow[column] !== undefined) {
      return Number(dbRow[column]) || 0;
    }
  }
  
  // Fallback pricing
  const fallbackPrices: Record<string, Record<string, Record<CustomerType, number>>> = {
    '4x12': {
      'عادي': { 'عادي': 800, 'المدينة': 600, 'مسوق': 700, 'شركات': 750 },
      'ممتاز': { 'عادي': 1200, 'المدينة': 900, 'مسوق': 1050, 'شركات': 1125 },
      'VIP': { 'عادي': 1600, 'المدينة': 1200, 'مسوق': 1400, 'شركات': 1500 }
    },
    '6x18': {
      'عادي': { 'عادي': 1500, 'المدينة': 1125, 'مسوق': 1312, 'شركات': 1406 },
      'ممتاز': { 'عادي': 2250, 'المدينة': 1687, 'مسوق': 1968, 'شركات': 2109 },
      'VIP': { 'عادي': 3000, 'المدينة': 2250, 'مسوق': 2625, 'شركات': 2812 }
    },
    '8x24': {
      'عادي': { 'عادي': 2400, 'المدينة': 1800, 'مسوق': 2100, 'شركات': 2250 },
      'ممتاز': { 'عادي': 3600, 'المدينة': 2700, 'مسوق': 3150, 'شركات': 3375 },
      'VIP': { 'عادي': 4800, 'المدينة': 3600, 'مسوق': 4200, 'شركات': 4500 }
    }
  };
  
  const sizeData = fallbackPrices[canonicalSize];
  if (sizeData && sizeData[canonicalLevel] && sizeData[canonicalLevel][customer]) {
    const basePrice = sizeData[canonicalLevel][customer];
    
    const monthMultipliers: Record<number, number> = {
      1: 1,
      2: 1.8,
      3: 2.5,
      6: 4.5,
      12: 8
    };
    
    const multiplier = monthMultipliers[months] || months;
    return Math.round(basePrice * multiplier);
  }
  
  return null;
}

export function getDailyPriceFor(
  size: string | undefined,
  level: any,
  customer: CustomerType
): number | null {
  // Initialize cache if not already done
  if (!CACHE_INITIALIZED) {
    initializeCache();
  }

  const canonicalSize = canonSize(size || '');
  const canonicalLevel = canonLevel(level);
  
  // Use cached data
  const dbRow = PRICING_CACHE.find(p => 
    p.size === canonicalSize && 
    p.billboard_level === canonicalLevel && 
    p.customer_category === customer
  );
  
  if (dbRow && dbRow.one_day !== null && dbRow.one_day !== undefined) {
    return Number(dbRow.one_day) || 0;
  }
  
  // Fallback: calculate from monthly price
  const monthlyPrice = getPriceFor(size, level, customer, 1);
  if (monthlyPrice !== null) {
    return Math.round((monthlyPrice / 30) * 100) / 100;
  }
  
  return null;
}

// Export functions to get cached data
export function getCustomers(): string[] {
  if (!CACHE_INITIALIZED) {
    initializeCache();
  }
  return CUSTOMERS_CACHE;
}

// Export functions to refresh cache
export const refreshPricingCache = async () => {
  PRICING_CACHE = await getAllPricing();
};

export const refreshCustomersCache = async () => {
  CUSTOMERS_CACHE = await getCustomerCategories();
};

// Export static customers array for immediate use
export const CUSTOMERS = ['عادي', 'المدينة', 'مسوق', 'شركات'];