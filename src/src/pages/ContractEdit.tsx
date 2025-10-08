import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { loadBillboards } from '@/services/billboardService';
import { addBillboardsToContract, getContractWithBillboards, removeBillboardFromContract, updateContract } from '@/services/contractService';
import { calculateInstallationCostFromIds } from '@/services/installationService';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import { ContractPDFDialog } from '@/components/Contract';
import type { Billboard } from '@/types';
import { Button } from '@/components/ui/button';
import { RefreshCw, DollarSign, Settings, Wrench } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Import modular components
import { ContractEditHeader } from '@/components/contracts/edit/ContractEditHeader';
import { SelectedBillboardsCard } from '@/components/contracts/edit/SelectedBillboardsCard';
import { BillboardFilters } from '@/components/contracts/edit/BillboardFilters';
import { AvailableBillboardsGrid } from '@/components/contracts/edit/AvailableBillboardsGrid';
import { CustomerInfoForm } from '@/components/contracts/edit/CustomerInfoForm';
import { ContractDatesForm } from '@/components/contracts/edit/ContractDatesForm';
import { InstallmentsManager } from '@/components/contracts/edit/InstallmentsManager';
import { CostSummaryCard } from '@/components/contracts/edit/CostSummaryCard';

// ✅ NEW: Currency options
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', name: 'يورو', symbol: '€' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ' },
];

export default function ContractEdit() {
  const navigate = useNavigate();
  const location = useLocation();

  // Core state
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contractNumber, setContractNumber] = useState<string>('');
  const [currentContract, setCurrentContract] = useState<any>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  // ✅ NEW: Price update state
  const [useStoredPrices, setUseStoredPrices] = useState<boolean>(true);
  const [refreshingPrices, setRefreshingPrices] = useState(false);

  // ✅ NEW: Currency state
  const [contractCurrency, setContractCurrency] = useState<string>('LYD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  // Customer data
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [adType, setAdType] = useState('');

  // Pricing and categories
  const [pricingCategories, setPricingCategories] = useState<string[]>([]);
  const [pricingCategory, setPricingCategory] = useState<string>('عادي');
  const [pricingData, setPricingData] = useState<any[]>([]);

  // ✅ NEW: Print pricing state with enable/disable toggle
  const [printCostEnabled, setPrintCostEnabled] = useState<boolean>(false);
  const [printPricePerMeter, setPrintPricePerMeter] = useState<number>(0);

  // Installation and operating costs
  const [installationCost, setInstallationCost] = useState<number>(0);
  const [installationDetails, setInstallationDetails] = useState<Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }>>([]);
  const [operatingFee, setOperatingFee] = useState<number>(0);
  const [operatingFeeRate, setOperatingFeeRate] = useState<number>(3);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('available');

  // Contract form data
  const [startDate, setStartDate] = useState('');
  const [pricingMode, setPricingMode] = useState<'months' | 'days'>('months');
  const [durationMonths, setDurationMonths] = useState<number>(3);
  const [durationDays, setDurationDays] = useState<number>(0);
  const [endDate, setEndDate] = useState('');
  const [rentCost, setRentCost] = useState<number>(0);
  const [userEditedRentCost, setUserEditedRentCost] = useState(false);
  const [originalTotal, setOriginalTotal] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Installments
  const [installments, setInstallments] = useState<Array<{ 
    amount: number; 
    paymentType: string; 
    description: string; 
    dueDate: string; 
  }>>([]);

  // ✅ NEW: Get currency symbol
  const getCurrencySymbol = (currencyCode: string): string => {
    return CURRENCIES.find(c => c.code === currencyCode)?.symbol || currencyCode;
  };

  // ✅ NEW: Apply exchange rate to amount
  const applyExchangeRate = (amount: number): number => {
    return Math.round((amount * exchangeRate) * 100) / 100;
  };

  // Load contract number from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cn = params.get('contract');
    if (cn) setContractNumber(String(cn));
  }, [location.search]);

  // Load billboards
  useEffect(() => {
    (async () => {
      try {
        const data = await loadBillboards();
        setBillboards(data);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'فشل تحميل اللوحات');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load customers
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('customers').select('id,name').order('name', { ascending: true });
        if (!error && Array.isArray(data)) {
          setCustomers(data || []);
        }
      } catch (e) {
        console.warn('load customers failed');
      }
    })();
  }, []);

  // Load pricing categories
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('pricing_categories')
          .select('name')
          .order('name', { ascending: true });

        if (!error && Array.isArray(data)) {
          const categories = data.map((item: any) => item.name);
          const staticCategories = ['عادي', 'مسوق', 'شركات'];
          const allCategories = Array.from(new Set([...staticCategories, ...categories]));
          setPricingCategories(allCategories);
        } else {
          setPricingCategories(['عادي', 'مسوق', 'شركات', 'المدينة']);
        }
      } catch (e) {
        console.warn('Failed to load pricing categories, using defaults');
        setPricingCategories(['عادي', 'مسوق', 'شركات', 'المدينة']);
      }
    })();
  }, []);

  // Load pricing data
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('pricing')
          .select('*')
          .order('size', { ascending: true });

        if (!error && Array.isArray(data)) {
          setPricingData(data);
          console.log('✅ Loaded pricing data from database:', data.length, 'rows');
        } else {
          console.error('❌ Failed to load pricing data:', error);
        }
      } catch (e) {
        console.warn('Failed to load pricing data:', e);
      }
    })();
  }, []);

  // Load contract data
  useEffect(() => {
    (async () => {
      if (!contractNumber) return;
      try {
        const c = await getContractWithBillboards(contractNumber);
        console.log('Loaded contract data:', c);
        console.log('installments_data from contract:', c.installments_data);
        
        setCurrentContract(c);
        setCustomerName(c.customer_name || c['Customer Name'] || '');
        setCustomerId(c.customer_id ?? null);
        setAdType(c.ad_type || c['Ad Type'] || '');
        
        const savedPricingCategory = c.customer_category || c['customer_category'] || 'عادي';
        setPricingCategory(savedPricingCategory);

        // ✅ NEW: Load currency settings from contract
        const savedCurrency = c.contract_currency || 'LYD';
        const savedExchangeRate = Number(c.exchange_rate || 1);
        setContractCurrency(savedCurrency);
        setExchangeRate(savedExchangeRate);

        // ✅ FIXED: Proper boolean check for print cost enabled
        const savedPrintEnabled = c.print_cost_enabled === true || c.print_cost_enabled === 1 || c.print_cost_enabled === "true";
        const savedPrintPrice = Number(c.print_price_per_meter || 0);
        setPrintCostEnabled(savedPrintEnabled);
        setPrintPricePerMeter(savedPrintPrice);
        
        console.log('✅ Loading print cost settings:');
        console.log('- Raw print_cost_enabled value:', c.print_cost_enabled, typeof c.print_cost_enabled);
        console.log('- Parsed print_cost_enabled:', savedPrintEnabled);
        console.log('- Print price per meter:', savedPrintPrice);

        // ✅ NEW: Load operating fee rate from contract
        const savedOperatingFeeRate = Number(c.operating_fee_rate || 3);
        setOperatingFeeRate(savedOperatingFeeRate);
        console.log('✅ Loading operating fee rate:', savedOperatingFeeRate, '%');
        
        const s = c.start_date || c['Contract Date'] || '';
        const e = c.end_date || c['End Date'] || '';
        setStartDate(s);
        setEndDate(e);
        
        if (s && e) {
          const sd = new Date(s);
          const ed = new Date(e);
          if (!isNaN(sd.getTime()) && !isNaN(ed.getTime())) {
            const diffTime = Math.abs(ed.getTime() - sd.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const diffMonths = Math.round(diffDays / 30);
            
            if (diffMonths >= 1) {
              setPricingMode('months');
              setDurationMonths(diffMonths);
            } else {
              setPricingMode('days');
              setDurationDays(diffDays);
            }
          }
        }
        
        const savedTotal = typeof c.rent_cost === 'number' ? c.rent_cost : Number(c['Total Rent'] || 0);
        setRentCost(savedTotal);
        setOriginalTotal(savedTotal || 0);
        const disc = Number(c.Discount ?? 0);
        if (!isNaN(disc) && disc > 0) {
          setDiscountType('amount');
          setDiscountValue(disc);
        }

        // ✅ NEW: Load existing operating fee from contract
        const existingFee = Number(c.fee || 0);
        if (existingFee > 0) {
          setOperatingFee(existingFee);
        }

        // ✅ FIXED: Load selected billboards from billboard_ids column
        if (c.billboard_ids) {
          try {
            // Parse billboard_ids if it's a string
            const idsArray = typeof c.billboard_ids === 'string' 
              ? c.billboard_ids.split(',').map(id => id.trim()).filter(Boolean)
              : Array.isArray(c.billboard_ids) ? c.billboard_ids : [];
            setSelected(idsArray);
            console.log('Loaded selected billboards from billboard_ids:', idsArray);
          } catch (e) {
            console.warn('Failed to parse billboard_ids:', e);
            // Fallback to old method
            setSelected((c.billboards || []).map((b: any) => String(b.ID)));
          }
        } else {
          // Fallback to old method
          setSelected((c.billboards || []).map((b: any) => String(b.ID)));
        }
        
        // ✅ FIXED: Properly handle installments_data from database
        let loadedInstallments: any[] = [];
        
        if (c.installments_data) {
          console.log('installments_data exists:', typeof c.installments_data, c.installments_data);
          
          // Handle JSON string format (from database)
          if (typeof c.installments_data === 'string') {
            try {
              const parsed = JSON.parse(c.installments_data);
              if (Array.isArray(parsed)) {
                loadedInstallments = parsed;
                console.log('Successfully parsed installments from string:', loadedInstallments);
              }
            } catch (e) {
              console.warn('Failed to parse installments_data string:', e);
            }
          }
          // Handle array format (already parsed)
          else if (Array.isArray(c.installments_data)) {
            loadedInstallments = c.installments_data;
            console.log('Using installments array directly:', loadedInstallments);
          }
        }
        
        // If we have valid installments data, use it
        if (loadedInstallments.length > 0) {
          setInstallments(loadedInstallments);
          console.log('Set installments from installments_data:', loadedInstallments);
        } else {
          // Fallback to old Payment 1, 2, 3 format
          console.log('No installments_data found, using old Payment format');
          const payments = [];
          if (c['Payment 1']) payments.push({ 
            amount: c['Payment 1'], 
            paymentType: 'شهري', 
            description: 'الدفعة الأولى',
            dueDate: calculateDueDate('شهري', 0, s)
          });
          if (c['Payment 2']) payments.push({ 
            amount: c['Payment 2'], 
            paymentType: 'شهري', 
            description: 'الدفعة الثانية',
            dueDate: calculateDueDate('شهري', 1, s)
          });
          if (c['Payment 3']) payments.push({ 
            amount: c['Payment 3'], 
            paymentType: 'شهري', 
            description: 'الدفعة الثالثة',
            dueDate: calculateDueDate('شهري', 2, s)
          });
          setInstallments(payments);
          console.log('Set installments from old Payment format:', payments);
        }
        
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'تعذر تحميل العقد');
      }
    })();
  }, [contractNumber]);

  // Calculate installation_cost when selected billboards change
  useEffect(() => {
    if (selected.length > 0) {
      (async () => {
        try {
          const result = await calculateInstallationCostFromIds(selected);
          setInstallationCost(result.totalInstallationCost);
          setInstallationDetails(result.installationDetails);
          console.log('✅ installation_cost calculated:', result.totalInstallationCost);
          console.log('✅ Installation details:', result.installationDetails);
        } catch (e) {
          console.warn('Failed to calculate installation_cost:', e);
          setInstallationCost(0);
          setInstallationDetails([]);
        }
      })();
    } else {
      setInstallationCost(0);
      setInstallationDetails([]);
    }
  }, [selected]);

  // Auto-calculate end date
  useEffect(() => {
    if (!startDate) return;
    const d = new Date(startDate);
    const end = new Date(d);
    if (pricingMode === 'months') {
      const days = Math.max(0, Number(durationMonths || 0)) * 30;
      end.setDate(end.getDate() + days);
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      end.setDate(end.getDate() + days);
    }
    const iso = end.toISOString().split('T')[0];
    setEndDate(iso);
  }, [startDate, durationMonths, durationDays, pricingMode]);

  // ✅ NEW: Smart size matching function
  const findBestSizeMatch = (targetSize: string, level: any, customer: string): any => {
    console.log(`🔍 Smart matching for size: ${targetSize}, level: ${level}, customer: ${customer}`);
    
    // First try exact match
    const exactMatch = pricingData.find(p => 
      String(p.size).trim() === String(targetSize).trim() && 
      String(p.billboard_level).trim() === String(level).trim() && 
      String(p.customer_category).trim() === String(customer).trim()
    );
    
    if (exactMatch) {
      console.log('✅ Found exact match:', exactMatch);
      return exactMatch;
    }
    
    // Parse target size dimensions
    const targetMatch = targetSize.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
    if (!targetMatch) {
      console.log('❌ Could not parse target size:', targetSize);
      return null;
    }
    
    const targetWidth = parseFloat(targetMatch[1]);
    const targetHeight = parseFloat(targetMatch[2]);
    const targetArea = targetWidth * targetHeight;
    
    console.log(`Target dimensions: ${targetWidth}x${targetHeight} = ${targetArea}m²`);
    
    // Find sizes with matching level and customer, then find closest area
    const candidates = pricingData.filter(p => 
      String(p.billboard_level).trim() === String(level).trim() && 
      String(p.customer_category).trim() === String(customer).trim()
    );
    
    console.log(`Found ${candidates.length} candidates with matching level and customer`);
    
    if (candidates.length === 0) {
      return null;
    }
    
    // Calculate area differences and find closest match
    let bestMatch = null;
    let smallestDifference = Infinity;
    
    for (const candidate of candidates) {
      const candidateMatch = String(candidate.size).match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
      if (!candidateMatch) continue;
      
      const candidateWidth = parseFloat(candidateMatch[1]);
      const candidateHeight = parseFloat(candidateMatch[2]);
      const candidateArea = candidateWidth * candidateHeight;
      
      const areaDifference = Math.abs(candidateArea - targetArea);
      
      console.log(`Candidate ${candidate.size}: ${candidateWidth}x${candidateHeight} = ${candidateArea}m², difference: ${areaDifference}`);
      
      if (areaDifference < smallestDifference) {
        smallestDifference = areaDifference;
        bestMatch = candidate;
      }
    }
    
    if (bestMatch) {
      console.log(`✅ Best match found: ${bestMatch.size} (difference: ${smallestDifference}m²)`);
      return bestMatch;
    }
    
    console.log('❌ No suitable match found');
    return null;
  };

  // ✅ UPDATED: Helper functions to read prices from database with smart matching
  const getPriceFromDatabase = (size: string, level: any, customer: string, months: number): number | null => {
    console.log(`🔍 Looking for price: size=${size}, level=${level}, customer=${customer}, months=${months}`);
    
    const dbRow = findBestSizeMatch(size, level, customer);
    
    if (dbRow) {
      console.log('✅ Found matching row:', dbRow);
      
      const monthColumnMap: { [key: number]: string } = {
        1: 'one_month',
        2: '2_months', 
        3: '3_months',
        6: '6_months',
        12: 'full_year'
      };
      
      const column = monthColumnMap[months];
      if (column && dbRow[column] !== null && dbRow[column] !== undefined) {
        const price = Number(dbRow[column]) || 0;
        console.log(`✅ Found price in column ${column}:`, price);
        return price;
      } else {
        console.log(`❌ No price found in column ${column}, value:`, dbRow[column]);
      }
    }
    
    return null;
  };

  const getDailyPriceFromDatabase = (size: string, level: any, customer: string): number | null => {
    console.log(`🔍 Looking for daily price: size=${size}, level=${level}, customer=${customer}`);
    
    const dbRow = findBestSizeMatch(size, level, customer);
    
    if (dbRow && dbRow.one_day !== null && dbRow.one_day !== undefined) {
      const dailyPrice = Number(dbRow.one_day) || 0;
      console.log('✅ Found daily price:', dailyPrice);
      return dailyPrice;
    }
    
    console.log('❌ No daily price found');
    return null;
  };

  // ✅ NEW: Get stored price from contract's billboard_prices data
  const getStoredPriceFromContract = (billboardId: string): number | null => {
    if (!currentContract?.billboard_prices) return null;
    
    try {
      const billboardPrices = typeof currentContract.billboard_prices === 'string' 
        ? JSON.parse(currentContract.billboard_prices)
        : currentContract.billboard_prices;
      
      const storedPrice = billboardPrices.find((bp: any) => bp.billboardId === billboardId);
      return storedPrice ? Number(storedPrice.contractPrice || 0) : null;
    } catch (e) {
      console.warn('Failed to parse stored billboard prices:', e);
      return null;
    }
  };

  // ✅ UPDATED: Calculate print cost only if enabled and consider faces count
  const calculatePrintCost = (billboard: Billboard): number => {
    if (!printCostEnabled || !printPricePerMeter || printPricePerMeter <= 0) return 0;
    
    const size = (billboard.size || (billboard as any).Size || '') as string;
    const faces = Number((billboard as any).faces || (billboard as any).Faces || (billboard as any).faces_count || (billboard as any).Faces_Count || 1);
    
    // Parse billboard area from size (e.g., "4x3" -> 12 square meters)
    const sizeMatch = size.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
    if (!sizeMatch) return 0;
    
    const width = parseFloat(sizeMatch[1]);
    const height = parseFloat(sizeMatch[2]);
    const area = width * height;
    
    return area * faces * printPricePerMeter;
  };

  // ✅ UPDATED: Calculate billboard price with option to use stored prices or fresh prices and apply exchange rate
  const calculateBillboardPrice = (billboard: Billboard): number => {
    const billboardId = String((billboard as any).ID);
    
    let basePrice = 0;
    
    // If using stored prices, try to get from contract first
    if (useStoredPrices) {
      const storedPrice = getStoredPriceFromContract(billboardId);
      if (storedPrice !== null) {
        console.log(`Using stored price for billboard ${billboardId}:`, storedPrice);
        basePrice = storedPrice;
        // Apply exchange rate to stored price
        return applyExchangeRate(basePrice);
      }
    }
    
    // Calculate fresh price from current pricing data
    const size = (billboard.size || (billboard as any).Size || '') as string;
    const level = ((billboard as any).level || (billboard as any).Level) as any;
    
    console.log(`🔍 Calculating price for billboard ${billboardId}: size=${size}, level=${level}, category=${pricingCategory}`);
    
    if (pricingMode === 'months') {
      const months = Math.max(0, Number(durationMonths || 0));
      let price = getPriceFromDatabase(size, level, pricingCategory, months);
      if (price === null) {
        console.log('❌ No price from database, trying fallback pricing system');
        price = getPriceFor(size, level, pricingCategory as CustomerType, months);
      }
      basePrice = price !== null ? price : 0;
      console.log(`✅ Monthly price (${months} months):`, basePrice);
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      let daily = getDailyPriceFromDatabase(size, level, pricingCategory);
      if (daily === null) {
        console.log('❌ No daily price from database, trying fallback pricing system');
        daily = getDailyPriceFor(size, level, pricingCategory as CustomerType);
      }
      if (daily === null) {
        let monthlyPrice = getPriceFromDatabase(size, level, pricingCategory, 1);
        if (monthlyPrice === null) {
          monthlyPrice = getPriceFor(size, level, pricingCategory as CustomerType, 1) || 0;
        }
        daily = monthlyPrice ? Math.round((monthlyPrice / 30) * 100) / 100 : 0;
      }
      basePrice = (daily || 0) * days;
      console.log(`✅ Daily price (${days} days):`, basePrice);
    }

    // ✅ UPDATED: Add print cost to base price only if enabled
    const printCost = calculatePrintCost(billboard);
    const finalPrice = basePrice + printCost;
    
    // ✅ NEW: Apply exchange rate
    const convertedPrice = applyExchangeRate(finalPrice);
    
    console.log(`✅ Final calculated price for billboard ${billboardId}: ${finalPrice} LYD -> ${convertedPrice} ${contractCurrency}`);
    return convertedPrice;
  };

  // ✅ NEW: Refresh prices from current pricing system
  const refreshPricesFromSystem = async () => {
    try {
      setRefreshingPrices(true);
      
      // Switch to using fresh prices
      setUseStoredPrices(false);
      
      // Force recalculation by updating a dependency
      setUserEditedRentCost(false);
      
      toast.success('تم تحديث الأسعار من المنظومة الحالية');
      console.log('✅ Switched to fresh pricing system');
      
    } catch (e: any) {
      console.error('Failed to refresh prices:', e);
      toast.error('فشل تحديث الأسعار');
    } finally {
      setRefreshingPrices(false);
    }
  };

  const calculateDueDate = (paymentType: string, index: number, startDateOverride?: string): string => {
    const baseDate = startDateOverride || startDate;
    if (!baseDate) return '';
    
    const date = new Date(baseDate);
    
    if (paymentType === 'عند التوقيع') {
      return baseDate;
    } else if (paymentType === 'شهري') {
      date.setMonth(date.getMonth() + (index + 1));
    } else if (paymentType === 'شهرين') {
      date.setMonth(date.getMonth() + (index + 1) * 2);
    } else if (paymentType === 'ثلاثة أشهر') {
      date.setMonth(date.getMonth() + (index + 1) * 3);
    } else if (paymentType === 'عند التركيب') {
      date.setDate(date.getDate() + 7);
    } else if (paymentType === 'نهاية العقد') {
      return endDate || '';
    }
    
    return date.toISOString().split('T')[0];
  };

  // ✅ FIXED: Calculate installation_cost summary - show always when billboards are selected
  const installationCostSummary = useMemo(() => {
    // ✅ CHANGED: Show when there are selected billboards, regardless of cost
    if (selected.length === 0) return null;

    const totalInstallationCost = installationDetails.reduce((sum, detail) => sum + (detail.installationPrice || 0), 0);
    
    // Group by size and show unique prices without repetition
    const groupedDetails = installationDetails.reduce((groups: any, detail) => {
      const key = `${detail.size}`;
      if (!groups[key]) {
        groups[key] = {
          size: detail.size,
          pricePerUnit: detail.installationPrice || 0,
          count: 0,
          totalForSize: 0,
          hasPrice: detail.installationPrice !== null && detail.installationPrice > 0
        };
      }
      groups[key].count += 1;
      groups[key].totalForSize += (detail.installationPrice || 0);
      return groups;
    }, {});
    
    return {
      totalInstallationCost,
      groupedSizes: Object.values(groupedDetails),
      hasAnyInstallationCost: totalInstallationCost > 0
    };
  }, [selected.length, installationDetails]);

  // ✅ NEW: Calculate print cost summary with grouped sizes and faces
  const printCostSummary = useMemo(() => {
    if (!printCostEnabled || !printPricePerMeter || printPricePerMeter <= 0 || selected.length === 0) return null;

    const selectedBillboards = billboards.filter(b => selected.includes(String((b as any).ID)));
    
    // Group by size and faces to avoid repetition
    const groupedDetails = selectedBillboards.reduce((groups: any, billboard) => {
      const size = (billboard.size || (billboard as any).Size || '') as string;
      const faces = Number((billboard as any).faces || (billboard as any).Faces || (billboard as any).faces_count || (billboard as any).Faces_Count || 1);
      const sizeMatch = size.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
      
      if (!sizeMatch) return groups;
      
      const width = parseFloat(sizeMatch[1]);
      const height = parseFloat(sizeMatch[2]);
      const area = width * height;
      
      const key = `${size}_${faces}faces`;
      
      if (!groups[key]) {
        groups[key] = {
          size,
          faces,
          area,
          count: 0,
          totalArea: 0,
          costPerUnit: area * faces * printPricePerMeter,
          totalCost: 0
        };
      }
      
      groups[key].count += 1;
      groups[key].totalArea += area * faces;
      groups[key].totalCost += area * faces * printPricePerMeter;
      
      return groups;
    }, {});

    const totalPrintCost = Object.values(groupedDetails).reduce((sum: number, group: any) => sum + group.totalCost, 0);
    
    return {
      totalPrintCost,
      groupedDetails: Object.values(groupedDetails)
    };
  }, [billboards, selected, printCostEnabled, printPricePerMeter]);

  // Calculations
  const cities = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).city || (b as any).City))).filter(Boolean) as string[], [billboards]);
  const sizes = useMemo(() => Array.from(new Set(billboards.map(b => (b as any).size || (b as any).Size))).filter(Boolean) as string[], [billboards]);

  const estimatedTotal = useMemo(() => {
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    if (pricingMode === 'months') {
      const months = Math.max(0, Number(durationMonths || 0));
      if (!months) return 0;
      return sel.reduce((acc, b) => {
        const billboardPrice = calculateBillboardPrice(b);
        return acc + billboardPrice;
      }, 0);
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      if (!days) return 0;
      return sel.reduce((acc, b) => {
        const billboardPrice = calculateBillboardPrice(b);
        return acc + billboardPrice;
      }, 0);
    }
  }, [billboards, selected, durationMonths, durationDays, pricingMode, pricingCategory, pricingData, printCostEnabled, printPricePerMeter, useStoredPrices, contractCurrency, exchangeRate]);

  const baseTotal = useMemo(() => (rentCost && rentCost > 0 ? rentCost : estimatedTotal), [rentCost, estimatedTotal]);

  useEffect(() => {
    if (!userEditedRentCost) {
      setRentCost(estimatedTotal);
    }
  }, [estimatedTotal, userEditedRentCost]);

  const discountAmount = useMemo(() => {
    if (!discountValue) return 0;
    return discountType === 'percent'
      ? (baseTotal * Math.max(0, Math.min(100, discountValue)) / 100)
      : Math.max(0, discountValue);
  }, [discountType, discountValue, baseTotal]);

  // ✅ CORRECTED: Fixed calculation formulas as requested
  const finalTotal = useMemo(() => Math.max(0, baseTotal - discountAmount), [baseTotal, discountAmount]);
  
  // ✅ NEW: Calculate print cost total
  const printCostTotal = useMemo(() => {
    if (!printCostEnabled) return 0;
    return billboards
      .filter((b) => selected.includes(String((b as any).ID)))
      .reduce((sum, b) => sum + calculatePrintCost(b), 0);
  }, [billboards, selected, printCostEnabled, printPricePerMeter]);

  const rentalCostOnly = useMemo(() => Math.max(0, baseTotal - discountAmount - applyExchangeRate(installationCost) - applyExchangeRate(printCostTotal)), [baseTotal, discountAmount, installationCost, printCostTotal, exchangeRate]);

  // ✅ CORRECTED: Calculate operating fee based on rental cost only (Total Rent column) with custom rate
  useEffect(() => {
    const fee = Math.round(rentalCostOnly * (operatingFeeRate / 100) * 100) / 100;
    setOperatingFee(fee);
    console.log(`✅ Operating fee calculated: ${rentalCostOnly} × ${operatingFeeRate}% = ${fee}`);
  }, [rentalCostOnly, operatingFeeRate]);

  useEffect(() => {
    if (installments.length === 0 && finalTotal > 0) {
      const half = Math.round((finalTotal / 2) * 100) / 100;
      setInstallments([
        { 
          amount: half, 
          paymentType: 'عند التوقيع', 
          description: 'الدفعة الأولى',
          dueDate: calculateDueDate('عند التوق��ع', 0)
        },
        { 
          amount: finalTotal - half, 
          paymentType: 'شهري', 
          description: 'الدفعة الثانية',
          dueDate: calculateDueDate('شهري', 1)
        },
      ]);
    }
  }, [finalTotal]);

  // Filter billboards
  const filtered = useMemo(() => {
    const today = new Date();
    const NEAR_DAYS = 30;

    const isNearExpiring = (b: any) => {
      const raw = b.Rent_End_Date || b.rent_end_date || b.rentEndDate || b['End Date'];
      if (!raw) return false;
      const end = new Date(raw);
      if (isNaN(end.getTime())) return false;
      const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
      return diff > 0 && diff <= NEAR_DAYS;
    };

    const list = billboards.filter((b: any) => {
      const text = b.name || b.Billboard_Name || '';
      const loc = b.location || b.Nearest_Landmark || '';
      const c = String(b.city || b.City || '');
      const s = String(b.size || b.Size || '');
      const st = String(b.status || b.Status || '').toLowerCase();

      const matchesQ = !searchQuery || text.toLowerCase().includes(searchQuery.toLowerCase()) || loc.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCity = cityFilter === 'all' || c === cityFilter;
      const matchesSize = sizeFilter === 'all' || s === sizeFilter;

      const hasContract = !!(b.contractNumber || b.Contract_Number || b.contract_number);
      const isAvailable = st === 'available' || (!hasContract && st !== 'rented');
      const isNear = isNearExpiring(b);
      const isRented = hasContract || st === 'rented';
      const isInContract = selected.includes(String(b.ID));
      
      let shouldShow = false;
      if (statusFilter === 'all') {
        shouldShow = true;
      } else if (statusFilter === 'available') {
        shouldShow = (isAvailable && !isRented) || isInContract;
      } else if (statusFilter === 'rented') {
        shouldShow = isRented && !isNear;
      }

      return matchesQ && matchesCity && matchesSize && shouldShow;
    });

    return list.sort((a: any, b: any) => {
      const aHasContract = !!(a.contractNumber || a.Contract_Number || a.contract_number);
      const bHasContract = !!(b.contractNumber || b.Contract_Number || b.contract_number);
      const aStatus = (a.status || a.Status || '').toLowerCase();
      const bStatus = (b.status || b.Status || '').toLowerCase();
      
      const aAvailable = aStatus === 'available' || (!aHasContract && aStatus !== 'rented');
      const bAvailable = bStatus === 'available' || (!bHasContract && bStatus !== 'rented');
      
      const aNear = isNearExpiring(a);
      const bNear = isNearExpiring(b);
      
      if (aAvailable && !bAvailable) return -1;
      if (!aAvailable && bAvailable) return 1;
      if (aNear && !bNear) return -1;
      if (!aNear && bNear) return 1;
      
      return 0;
    }).slice(0, 20);
  }, [billboards, searchQuery, cityFilter, sizeFilter, statusFilter, selected]);

  // Event handlers
  const toggleSelect = (b: Billboard) => {
    const id = String((b as any).ID);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const removeSelected = (id: string) => setSelected((prev) => prev.filter((x) => x !== id));

  const handleAddCustomer = async (name: string) => {
    if (!name) return;
    try {
      const { data: newC, error } = await supabase
        .from('customers')
        .insert({ name })
        .select()
        .single();
      if (!error && newC) {
        setCustomerId(newC.id);
        setCustomerName(name);
        setCustomers((prev) => [{ id: newC.id, name }, ...prev]);
      }
    } catch (e) {
      console.warn(e);
    }
    setCustomerOpen(false);
    setCustomerQuery('');
  };

  const handleSelectCustomer = (customer: { id: string; name: string }) => {
    setCustomerName(customer.name);
    setCustomerId(customer.id);
    setCustomerOpen(false);
    setCustomerQuery('');
  };

  // Installment management
  const distributeEvenly = (count: number) => {
    count = Math.max(1, Math.min(6, Math.floor(count)));
    const even = Math.floor((finalTotal / count) * 100) / 100;
    const list = Array.from({ length: count }).map((_, i) => ({
      amount: i === count - 1 ? Math.round((finalTotal - even * (count - 1)) * 100) / 100 : even,
      paymentType: i === 0 ? 'عند التوقيع' : 'شهري',
      description: `الدفعة ${i + 1}`,
      dueDate: calculateDueDate(i === 0 ? 'عند التوقيع' : 'شهري', i)
    }));
    setInstallments(list);
  };

  const addInstallment = () => {
    const newInstallment = {
      amount: 0,
      paymentType: 'شهري',
      description: `الدفعة ${installments.length + 1}`,
      dueDate: calculateDueDate('شهري', installments.length)
    };
    setInstallments([...installments, newInstallment]);
  };

  const removeInstallment = (index: number) => {
    setInstallments(installments.filter((_, i) => i !== index));
  };

  const updateInstallment = (index: number, field: string, value: any) => {
    setInstallments(prev => prev.map((inst, i) => {
      if (i === index) {
        const updated = { ...inst, [field]: value };
        if (field === 'paymentType') {
          updated.dueDate = calculateDueDate(value, i);
        }
        return updated;
      }
      return inst;
    }));
  };

  const clearAllInstallments = () => {
    setInstallments([]);
  };

  const validateInstallments = () => {
    if (installments.length === 0) {
      return { isValid: false, message: 'يجب إضافة دفعة واحدة على الأقل' };
    }

    const totalInstallments = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    const difference = Math.abs(totalInstallments - finalTotal);
    
    if (difference > 1) {
      return { 
        isValid: false, 
        message: `مجموع الدفعات (${totalInstallments.toLocaleString()}) لا يساوي إجمالي العقد (${finalTotal.toLocaleString()})` 
      };
    }

    return { isValid: true, message: '' };
  };

  const save = async () => {
    try {
      if (!contractNumber) return;
      
      const validation = validateInstallments();
      if (!validation.isValid) {
        toast.error(validation.message);
        return;
      }
      
      setSaving(true);
      
      const c = await getContractWithBillboards(contractNumber);
      const current: string[] = (c.billboards || []).map((b: any) => String(b.ID));
      const toAdd = selected.filter((id) => !current.includes(id));
      const toRemove = current.filter((id) => !selected.includes(id));

      if (toAdd.length > 0) {
        await addBillboardsToContract(contractNumber, toAdd, {
          start_date: startDate,
          end_date: endDate,
          customer_name: customerName,
        });
      }
      for (const id of toRemove) {
        await removeBillboardFromContract(contractNumber, id);
      }

      // ✅ NEW: Generate billboard prices data for historical reference
      const selectedBillboardsData = billboards
        .filter((b) => selected.includes(String((b as any).ID)))
        .map((b) => ({
          id: String((b as any).ID),
          name: (b as any).name || (b as any).Billboard_Name || '',
          location: (b as any).location || (b as any).Nearest_Landmark || '',
          city: (b as any).city || (b as any).City || '',
          size: (b as any).size || (b as any).Size || '',
          level: (b as any).level || (b as any).Level || '',
          price: Number((b as any).price) || 0,
          image: (b as any).image || '',
          // ✅ NEW: Store calculated price for this contract (including print cost)
          contractPrice: calculateBillboardPrice(b),
          printCost: calculatePrintCost(b),
          pricingCategory: pricingCategory,
          pricingMode: pricingMode,
          duration: pricingMode === 'months' ? durationMonths : durationDays
        }));

      // ✅ CORRECTED: Fixed calculation structure for database storage
      const updates: any = {
        'Customer Name': customerName,
        'Ad Type': adType,
        'Contract Date': startDate,
        'End Date': endDate,
        // ✅ CORRECTED: Total should store the base total (rental without installation and print)
        'Total': finalTotal,
        // ✅ CORRECTED: Total Rent should store rental cost only (after subtracting installation and print)
        'Total Rent': rentalCostOnly,
        'Discount': discountAmount,
        customer_category: pricingCategory,
        billboards_data: JSON.stringify(selectedBillboardsData),
        billboards_count: selectedBillboardsData.length,
        billboard_ids: selected, // Pass as array, updateContract will handle conversion
        // ✅ NEW: Store billboard prices for historical reference
        billboard_prices: JSON.stringify(selectedBillboardsData.map(b => ({
          billboardId: b.id,
          contractPrice: b.contractPrice,
          printCost: b.printCost,
          pricingCategory: b.pricingCategory,
          pricingMode: b.pricingMode,
          duration: b.duration
        }))),
        // ✅ FIXED: Store installation_cost in correct field name
        'installation_cost': applyExchangeRate(installationCost),
        // ✅ NEW: Store print cost data
        print_cost: applyExchangeRate(printCostTotal),
        print_cost_enabled: printCostEnabled,
        print_price_per_meter: printPricePerMeter,
        // ✅ NEW: Store currency settings
        contract_currency: contractCurrency,
        exchange_rate: exchangeRate,
        // ✅ NEW: Store operating fee rate and calculated fee based on Total Rent
        fee: operatingFee, // This is calculated as rentalCostOnly * operatingFeeRate
        operating_fee_rate: operatingFeeRate, // Store the percentage rate
        // ✅ CRITICAL FIX: Use exact same field name as ContractCreate
        installments_data: installments, // Pass as array, updateContract will stringify it
      };
      
      // Also save individual payments for backward compatibility
      if (installments.length > 0) updates['Payment 1'] = installments[0]?.amount || 0;
      if (installments.length > 1) updates['Payment 2'] = installments[1]?.amount || 0;
      if (installments.length > 2) updates['Payment 3'] = installments[2]?.amount || 0;
      
      updates['Total Paid'] = currentContract?.['Total Paid'] || 0;
      updates['Remaining'] = finalTotal - (currentContract?.['Total Paid'] || 0);
      if (customerId) updates.customer_id = customerId;
      
      console.log('✅ ContractEdit saving with currency:', contractCurrency, 'rate:', exchangeRate);
      console.log('- Print cost enabled:', printCostEnabled);
      console.log('- Print price per meter:', printPricePerMeter);
      console.log('- Print cost total:', applyExchangeRate(printCostTotal));
      console.log('- Total (with currency conversion):', finalTotal);
      console.log('- Total Rent (rental - installation - print):', rentalCostOnly);
      console.log('- Operating fee rate:', operatingFeeRate, '%');
      console.log('- Operating fee (Total Rent * rate):', operatingFee);
      console.log('- installation_cost (converted):', applyExchangeRate(installationCost));
      
      await updateContract(contractNumber, updates);

      toast.success(`تم حفظ التعديلات مع العملة ${getCurrencySymbol(contractCurrency)} بنجاح`);
      navigate('/admin/contracts');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'فشل حفظ التعديلات');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintContract = () => {
    if (currentContract) {
      setPdfOpen(true);
    } else {
      toast.error('يجب حفظ العقد أولاً');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <ContractEditHeader
          contractNumber={contractNumber}
          onBack={() => navigate('/admin/contracts')}
          onPrint={handlePrintContract}
          onSave={save}
          saving={saving}
        />

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* ✅ NEW: Currency Settings */}
            <div className="expenses-preview-item">
              <div className="flex items-center justify-between mb-3">
                <h3 className="expenses-preview-label flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  إعدادات العملة
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="expenses-form-label block mb-2">عملة العقد</label>
                  <Select value={contractCurrency} onValueChange={setContractCurrency}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="اختر العملة" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.symbol} - {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="expenses-form-label block mb-2">سعر الصرف (1 د.ل = ؟ {contractCurrency})</label>
                  <input
                    type="number"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(Number(e.target.value) || 1)}
                    className="w-full px-4 py-3 rounded bg-input border border-border text-card-foreground font-medium"
                    placeholder="1"
                    min="0"
                    step="0.01"
                  />
                </div>
                
                <div>
                  <label className="expenses-form-label block mb-2">العملة المعروضة</label>
                  <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold flex items-center gap-2">
                    <span className="text-2xl">{getCurrencySymbol(contractCurrency)}</span>
                    <span>{CURRENCIES.find(c => c.code === contractCurrency)?.name}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded mt-4">
                <div className="font-medium mb-1">مثال على التحويل:</div>
                <div>1,000 د.ل × {exchangeRate} = {applyExchangeRate(1000).toLocaleString()} {getCurrencySymbol(contractCurrency)}</div>
              </div>
            </div>

            {/* ✅ NEW: Price Update Controls */}
            <div className="expenses-preview-item">
              <div className="flex items-center justify-between mb-3">
                <h3 className="expenses-preview-label">إعدادات الأسعار</h3>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-muted-foreground">
                    {useStoredPrices ? 'الأسعار المخزنة في العقد' : 'الأسعار الحالية من المنظومة'}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshPricesFromSystem}
                    disabled={refreshingPrices || !useStoredPrices}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshingPrices ? 'animate-spin' : ''}`} />
                    {refreshingPrices ? 'جاري التحديث...' : 'تحديث الأسعار'}
                  </Button>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                {useStoredPrices ? (
                  <div>
                    <strong>الوضع الحالي:</strong> يتم استخدام الأسعار المخزنة في العقد عند إنشائه.
                    <br />
                    <strong>للتحديث:</strong> اضغط على زر "تحديث الأسعار" لجلب الأسعار الجديدة من جدول pricing.
                  </div>
                ) : (
                  <div className="text-green-700 bg-green-50 p-2 rounded">
                    <strong>تم التحديث:</strong> يتم الآن استخدام الأسعار الحالية من المنظومة (جدول pricing).
                    <br />
                    <strong>ملاحظة:</strong> احفظ العقد لتطبيق الأسعار الجديدة نهائياً.
                  </div>
                )}
              </div>
            </div>

            {/* ✅ MOVED: installation_cost Section - Now above Print Cost */}
            {installationCostSummary && (
              <Card className="bg-card border-border shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-card-foreground">
                    <Wrench className="h-5 w-5 text-accent" />
                    ملخص تكلفة التركيب
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground block mb-2">إجمالي تكلفة التركيب</label>
                      <div className={`px-4 py-3 rounded font-bold text-lg ${
                        installationCostSummary.hasAnyInstallationCost 
                          ? 'bg-accent/10 text-accent' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {applyExchangeRate(installationCostSummary.totalInstallationCost).toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-muted-foreground block mb-2">عدد اللوحات</label>
                      <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold text-lg">
                        {selected.length} لوحة
                      </div>
                    </div>
                  </div>

                  {/* ✅ Show installation details even if cost is 0 */}
                  <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                    <div className="font-medium mb-2">تفاصيل تكلفة التركيب حسب المقاس:</div>
                    {installationCostSummary.groupedSizes.length > 0 ? (
                      <div className="space-y-1">
                        {installationCostSummary.groupedSizes.map((sizeInfo: any, index: number) => (
                          <div key={index} className="text-xs flex justify-between items-center">
                            <span>
                              <strong>مقاس {sizeInfo.size}:</strong> 
                              {sizeInfo.hasPrice ? (
                                <span> {sizeInfo.pricePerUnit.toLocaleString()} د.ل × {sizeInfo.count} لوحة</span>
                              ) : (
                                <span className="text-orange-600"> بدون تكلفة تركيب × {sizeInfo.count} لوحة</span>
                              )}
                            </span>
                            <span className={`font-bold ${sizeInfo.hasPrice ? 'text-accent' : 'text-gray-500'}`}>
                              {sizeInfo.hasPrice ? (
                                <span>{applyExchangeRate(sizeInfo.totalForSize).toLocaleString()} {getCurrencySymbol(contractCurrency)}</span>
                              ) : (
                                <span>0 {getCurrencySymbol(contractCurrency)}</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-xs">لا توجد تفاصيل تركيب متاحة</div>
                    )}
                    
                    {/* ✅ Show message when no installation_cost */}
                    {!installationCostSummary.hasAnyInstallationCost && (
                      <div className="text-orange-600 text-xs mt-2 p-2 bg-orange-50 rounded">
                        💡 بعض اللوحات المختارة لا تحتاج إلى تكلفة تركيب أو لم يتم تحديد سعر التركيب لها
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ✅ UPDATED: Print Cost Settings with organized display */}
            <div className="expenses-preview-item">
              <div className="flex items-center justify-between mb-3">
                <h3 className="expenses-preview-label">تكلفة الطباعة</h3>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">تفعيل تكلفة الطباعة</label>
                  <button
                    type="button"
                    onClick={() => {
                      const newValue = !printCostEnabled;
                      setPrintCostEnabled(newValue);
                      console.log('✅ Print cost enabled changed to:', newValue);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      printCostEnabled ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        printCostEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              
              <div className={`text-sm p-2 rounded mb-3 ${
                printCostEnabled 
                  ? 'text-green-700 bg-green-50 border border-green-200' 
                  : 'text-gray-600 bg-gray-50 border border-gray-200'
              }`}>
                <strong>الحالة الحالية:</strong> تكلفة الطباعة {printCostEnabled ? 'مفعلة ✅' : 'غير مفعلة ❌'}
              </div>
              
              {printCostEnabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="expenses-form-label block mb-2">سعر المتر للطباعة ({getCurrencySymbol(contractCurrency)})</label>
                      <input
                        type="number"
                        value={printPricePerMeter}
                        onChange={(e) => setPrintPricePerMeter(Number(e.target.value) || 0)}
                        className="w-full px-4 py-3 rounded bg-input border border-border text-card-foreground font-medium"
                        placeholder="0"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="expenses-form-label block mb-2">إجمالي تكلفة الطباعة</label>
                      <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold">
                        {applyExchangeRate(printCostTotal).toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}
                      </div>
                    </div>
                  </div>
                  
                  {/* ✅ NEW: Organized print cost summary */}
                  {printCostSummary && (
                    <Card className="bg-card border-border shadow-card">
                      <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">تفاصيل تكلفة الطباعة للوحات المختارة</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {printCostSummary.groupedDetails.map((group: any, index: number) => (
                            <div key={index} className="flex justify-between items-center text-xs bg-muted/50 p-2 rounded">
                              <span>
                                <strong>مقاس {group.size}</strong> × {group.faces} وجه × {group.count} لوحة
                                <div className="text-muted-foreground">
                                  ({group.area}م² × {group.faces} × {group.count} × {printPricePerMeter})
                                </div>
                              </span>
                              <span className="font-bold text-primary">
                                {applyExchangeRate(group.totalCost).toLocaleString()} {getCurrencySymbol(contractCurrency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                    💡 عند تفعيل تكلفة الطباعة، سيتم إضافة التكلفة تلقائياً إلى سعر كل لوحة وستظهر في العقد المطبوع كـ "شاملة تكاليف الطباعة"
                  </div>
                </div>
              )}
              
              {!printCostEnabled && (
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  تكلفة الطباعة غير مفعلة. العقد سيظهر كـ "غير شاملة تكاليف الطباعة"
                </div>
              )}
            </div>

            {/* ✅ NEW: Operating Fee Settings */}
            <div className="expenses-preview-item">
              <div className="flex items-center justify-between mb-3">
                <h3 className="expenses-preview-label flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  إعدادات رسوم التشغيل
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="expenses-form-label block mb-2">نسبة رسوم التشغيل (%)</label>
                  <input
                    type="number"
                    value={operatingFeeRate}
                    onChange={(e) => setOperatingFeeRate(Number(e.target.value) || 3)}
                    className="w-full px-4 py-3 rounded bg-input border border-border text-card-foreground font-medium"
                    placeholder="3"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
                
                <div>
                  <label className="expenses-form-label block mb-2">صافي الإيجار (أساس الحساب)</label>
                  <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold">
                    {rentalCostOnly.toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}
                  </div>
                </div>
                
                <div>
                  <label className="expenses-form-label block mb-2">رسوم التشغيل المحسوبة</label>
                  <div className="px-4 py-3 rounded bg-primary/10 text-primary font-bold">
                    {operatingFee.toLocaleString('ar-LY')} {getCurrencySymbol(contractCurrency)}
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded mt-4">
                <div className="font-medium mb-1">طريقة الحساب:</div>
                <div>رسوم التشغيل = صافي الإيجار × {operatingFeeRate}% = {rentalCostOnly.toLocaleString()} × {operatingFeeRate}% = {operatingFee.toLocaleString()} {getCurrencySymbol(contractCurrency)}</div>
                <div className="text-xs mt-2 text-blue-600">
                  💡 صافي الإيجار = الإجمالي النهائي - تكلفة التركيب - تكلفة الطباعة - الخصم
                </div>
              </div>
            </div>

            <SelectedBillboardsCard
              selected={selected}
              billboards={billboards}
              onRemoveSelected={removeSelected}
              calculateBillboardPrice={calculateBillboardPrice}
              installationDetails={[]} // ✅ Remove installation details from here since we have separate section
              pricingMode={pricingMode}
              durationMonths={durationMonths}
              durationDays={durationDays}
              currencySymbol={getCurrencySymbol(contractCurrency)}
            />

            <BillboardFilters
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              cityFilter={cityFilter}
              setCityFilter={setCityFilter}
              sizeFilter={sizeFilter}
              setSizeFilter={setSizeFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              pricingCategory={pricingCategory}
              setPricingCategory={setPricingCategory}
              cities={cities}
              sizes={sizes}
              pricingCategories={pricingCategories}
            />

            <AvailableBillboardsGrid
              billboards={filtered}
              selected={selected}
              onToggleSelect={toggleSelect}
              loading={loading}
            />
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[360px] space-y-4">
            <CustomerInfoForm
              customerName={customerName}
              setCustomerName={setCustomerName}
              adType={adType}
              setAdType={setAdType}
              pricingCategory={pricingCategory}
              setPricingCategory={setPricingCategory}
              pricingCategories={pricingCategories}
              customers={customers}
              customerOpen={customerOpen}
              setCustomerOpen={setCustomerOpen}
              customerQuery={customerQuery}
              setCustomerQuery={setCustomerQuery}
              onAddCustomer={handleAddCustomer}
              onSelectCustomer={handleSelectCustomer}
            />

            <ContractDatesForm
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              pricingMode={pricingMode}
              setPricingMode={setPricingMode}
              durationMonths={durationMonths}
              setDurationMonths={setDurationMonths}
              durationDays={durationDays}
              setDurationDays={setDurationDays}
            />

            <InstallmentsManager
              installments={installments}
              finalTotal={finalTotal}
              onDistributeEvenly={distributeEvenly}
              onAddInstallment={addInstallment}
              onRemoveInstallment={removeInstallment}
              onUpdateInstallment={updateInstallment}
              onClearAll={clearAllInstallments}
            />

            <CostSummaryCard
              estimatedTotal={estimatedTotal}
              rentCost={rentCost}
              setRentCost={setRentCost}
              setUserEditedRentCost={setUserEditedRentCost}
              discountType={discountType}
              setDiscountType={setDiscountType}
              discountValue={discountValue}
              setDiscountValue={setDiscountValue}
              baseTotal={baseTotal}
              discountAmount={discountAmount}
              finalTotal={finalTotal}
              installationCost={applyExchangeRate(installationCost)}
              rentalCostOnly={rentalCostOnly}
              operatingFee={operatingFee}
              currentContract={currentContract}
              originalTotal={originalTotal}
              onSave={save}
              onCancel={() => navigate('/admin/contracts')}
              saving={saving}
            />
          </div>
        </div>

        <ContractPDFDialog
          open={pdfOpen}
          onOpenChange={setPdfOpen}
          contract={currentContract}
        />
      </div>
    </div>
  );
}
