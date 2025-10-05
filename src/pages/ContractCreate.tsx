import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { loadBillboards } from '@/services/billboardService';
import { createContract } from '@/services/contractService';
import type { Billboard } from '@/types';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import { useContractForm } from '@/hooks/useContractForm';
import { useContractCalculations } from '@/hooks/useContractCalculations';
import { useContractInstallments } from '@/hooks/useContractInstallments';
import { ContractFormSidebar } from '@/components/contracts/ContractFormSidebar';
import { BillboardSelector } from '@/components/contracts/BillboardSelector';
import { InstallationCostSummary } from '@/components/contracts/InstallationCostSummary';
import { DollarSign, Settings } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ✅ NEW: Currency options
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', name: 'يورو', symbol: '€' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ' },
];

export default function ContractCreate() {
  const navigate = useNavigate();
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nextContractNumber, setNextContractNumber] = useState<string>('');
  const [pricingCategories, setPricingCategories] = useState<string[]>([]);

  // ✅ NEW: Print pricing state with enable/disable toggle
  const [printCostEnabled, setPrintCostEnabled] = useState<boolean>(false);
  const [printPricePerMeter, setPrintPricePerMeter] = useState<number>(0);

  // ✅ NEW: Currency conversion state
  const [contractCurrency, setContractCurrency] = useState<string>('LYD');
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  // ✅ NEW: Operating fee rate state
  const [operatingFeeRate, setOperatingFeeRate] = useState<number>(3);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('available');

  // Contract form hook
  const {
    formData,
    updateFormData,
    selected,
    setSelected,
    installments,
    setInstallments,
    updateInstallment,
    userEditedRentCost,
    setUserEditedRentCost,
    installationCost,
    installationDetails,
    pricingData,
    getPriceFromDatabase,
    getDailyPriceFromDatabase,
    calculateDueDate
  } = useContractForm();

  // ✅ NEW: Get current currency info
  const getCurrentCurrency = () => {
    return CURRENCIES.find(c => c.code === contractCurrency) || CURRENCIES[0];
  };

  // ✅ NEW: Apply currency conversion to price
  const convertPrice = (priceInLYD: number): number => {
    return Math.round((priceInLYD * exchangeRate) * 100) / 100;
  };

  // ✅ FIXED: Enhanced bidirectional size matching function
  const findBestSizeMatch = (targetSize: string, level: any, customer: string): any => {
    console.log(`🔍 Bidirectional matching for size: ${targetSize}, level: ${level}, customer: ${customer}`);
    
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
    
    console.log(`Target dimensions: ${targetWidth}x${targetHeight}`);
    
    // ✅ NEW: Try bidirectional matching - both directions
    const candidates = pricingData.filter(p => 
      String(p.billboard_level).trim() === String(level).trim() && 
      String(p.customer_category).trim() === String(customer).trim()
    );
    
    console.log(`Found ${candidates.length} candidates with matching level and customer`);
    
    if (candidates.length === 0) {
      return null;
    }
    
    // ✅ IMPROVED: Check both orientations (4x3 and 3x4)
    for (const candidate of candidates) {
      const candidateMatch = String(candidate.size).match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
      if (!candidateMatch) continue;
      
      const candidateWidth = parseFloat(candidateMatch[1]);
      const candidateHeight = parseFloat(candidateMatch[2]);
      
      // Check both orientations
      const isDirectMatch = (candidateWidth === targetWidth && candidateHeight === targetHeight);
      const isFlippedMatch = (candidateWidth === targetHeight && candidateHeight === targetWidth);
      
      if (isDirectMatch || isFlippedMatch) {
        console.log(`✅ Found bidirectional match: ${candidate.size} matches ${targetSize}`);
        return candidate;
      }
    }
    
    console.log('❌ No bidirectional match found');
    return null;
  };

  // ✅ UPDATED: Enhanced getPriceFromDatabase with bidirectional matching
  const enhancedGetPriceFromDatabase = (size: string, level: any, customer: string, months: number): number | null => {
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

  // ✅ UPDATED: Enhanced getDailyPriceFromDatabase with bidirectional matching
  const enhancedGetDailyPriceFromDatabase = (size: string, level: any, customer: string): number | null => {
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

  // ✅ UPDATED: Calculate print cost only if enabled and consider faces count with currency conversion
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
    
    const costInLYD = area * faces * printPricePerMeter;
    return convertPrice(costInLYD);
  };

  // ✅ NEW: Calculate print cost total
  const printCostTotal = React.useMemo(() => {
    if (!printCostEnabled) return 0;
    return billboards
      .filter((b) => selected.includes(String((b as any).ID)))
      .reduce((sum, b) => sum + calculatePrintCost(b), 0);
  }, [billboards, selected, printCostEnabled, printPricePerMeter, contractCurrency, exchangeRate]);

  // Contract calculations hook with modified estimated total calculation
  const estimatedTotalWithPrint = React.useMemo(() => {
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    if (formData.pricingMode === 'months') {
      const months = Math.max(0, Number(formData.durationMonths || 0));
      if (!months) return 0;
      return sel.reduce((acc, b) => {
        const size = (b.size || (b as any).Size || '') as string;
        const level = ((b as any).level || (b as any).Level) as any;
        
        let price = enhancedGetPriceFromDatabase(size, level, formData.pricingCategory, months);
        if (price === null) {
          price = getPriceFor(size, level, formData.pricingCategory as CustomerType, months);
        }
        if (price !== null) {
          // ✅ UPDATED: Apply currency conversion and add print cost
          const convertedPrice = convertPrice(price);
          const printCost = calculatePrintCost(b);
          return acc + convertedPrice + printCost;
        }
        
        const monthly = Number((b as any).price) || 0;
        const convertedMonthly = convertPrice(monthly * months);
        const printCost = calculatePrintCost(b);
        return acc + convertedMonthly + printCost;
      }, 0);
    } else {
      const days = Math.max(0, Number(formData.durationDays || 0));
      if (!days) return 0;
      return sel.reduce((acc, b) => {
        const size = (b.size || (b as any).Size || '') as string;
        const level = ((b as any).level || (b as any).Level) as any;
        
        let daily = enhancedGetDailyPriceFromDatabase(size, level, formData.pricingCategory);
        if (daily === null) {
          daily = getDailyPriceFor(size, level, formData.pricingCategory as CustomerType);
        }
        if (daily === null) {
          let monthlyPrice = enhancedGetPriceFromDatabase(size, level, formData.pricingCategory, 1);
          if (monthlyPrice === null) {
            monthlyPrice = getPriceFor(size, level, formData.pricingCategory as CustomerType, 1) || 0;
          }
          daily = monthlyPrice ? Math.round((monthlyPrice / 30) * 100) / 100 : 0;
        }
        
        const convertedDaily = convertPrice((daily || 0) * days);
        const printCost = calculatePrintCost(b);
        return acc + convertedDaily + printCost;
      }, 0);
    }
  }, [billboards, selected, formData.durationMonths, formData.durationDays, formData.pricingMode, formData.pricingCategory, pricingData, printCostEnabled, printPricePerMeter, contractCurrency, exchangeRate]);

  const calculations = useContractCalculations({
    formData,
    selected,
    billboards,
    userEditedRentCost,
    installationCost,
    pricingData,
    getPriceFromDatabase,
    getDailyPriceFromDatabase,
    onRentCostChange: (cost) => updateFormData({ rentCost: cost }),
    customEstimatedTotal: estimatedTotalWithPrint,
    // ✅ NEW: Pass currency conversion function
    convertPrice
  });

  // ✅ NEW: Calculate rental cost only (after subtracting installation and print costs)
  const rentalCostOnly = React.useMemo(() => {
    return Math.max(0, calculations.finalTotal - convertPrice(installationCost) - printCostTotal);
  }, [calculations.finalTotal, installationCost, printCostTotal, exchangeRate]);

  // ✅ NEW: Calculate operating fee based on rental cost only with custom rate
  const operatingFee = React.useMemo(() => {
    return Math.round(rentalCostOnly * (operatingFeeRate / 100) * 100) / 100;
  }, [rentalCostOnly, operatingFeeRate]);

  // Installments management hook
  const installmentManager = useContractInstallments({
    installments,
    setInstallments,
    finalTotal: calculations.finalTotal,
    calculateDueDate
  });

  // Get next contract number
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('Contract')
          .select('Contract_Number')
          .order('Contract_Number', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          const lastNumber = parseInt(data[0].Contract_Number) || 0;
          setNextContractNumber(String(lastNumber + 1));
        } else {
          setNextContractNumber('1');
        }
      } catch (e) {
        console.warn('Failed to get next contract number, using 1');
        setNextContractNumber('1');
      }
    })();
  }, []);

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

  // ✅ UPDATED: Calculate billboard price function with currency conversion and print cost
  const calculateBillboardPrice = (billboard: Billboard): number => {
    const size = (billboard.size || (billboard as any).Size || '') as string;
    const level = ((billboard as any).level || (billboard as any).Level) as any;
    
    let basePrice = 0;
    
    if (formData.pricingMode === 'months') {
      const months = Math.max(0, Number(formData.durationMonths || 0));
      let price = enhancedGetPriceFromDatabase(size, level, formData.pricingCategory, months);
      if (price === null) {
        price = getPriceFor(size, level, formData.pricingCategory as CustomerType, months);
      }
      basePrice = price !== null ? convertPrice(price) : 0;
    } else {
      const days = Math.max(0, Number(formData.durationDays || 0));
      let daily = enhancedGetDailyPriceFromDatabase(size, level, formData.pricingCategory);
      if (daily === null) {
        daily = getDailyPriceFor(size, level, formData.pricingCategory as CustomerType);
      }
      if (daily === null) {
        let monthlyPrice = enhancedGetPriceFromDatabase(size, level, formData.pricingCategory, 1);
        if (monthlyPrice === null) {
          monthlyPrice = getPriceFor(size, level, formData.pricingCategory as CustomerType, 1) || 0;
        }
        daily = monthlyPrice ? Math.round((monthlyPrice / 30) * 100) / 100 : 0;
      }
      basePrice = convertPrice((daily || 0) * days);
    }

    // ✅ UPDATED: Add print cost to base price only if enabled
    const printCost = calculatePrintCost(billboard);
    return basePrice + printCost;
  };

  // Toggle billboard selection
  const toggleSelect = (billboard: Billboard) => {
    const id = String((billboard as any).ID);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Remove selected billboard
  const removeSelected = (id: string) => setSelected((prev) => prev.filter((x) => x !== id));

  // Submit contract
  const submit = async () => {
    try {
      if (!formData.customerName || !formData.startDate || !formData.endDate || selected.length === 0) {
        toast.error('يرجى تعبئة بيانات الزبون والتواريخ واختيار لوحات');
        return;
      }

      const validation = installmentManager.validateInstallments();
      if (!validation.isValid) {
        toast.error(validation.message);
        return;
      }

      setSaving(true);

      // ✅ UPDATED: Generate billboard prices data with currency conversion
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
          // ✅ UPDATED: Store calculated price with currency conversion
          contractPrice: calculateBillboardPrice(b),
          printCost: calculatePrintCost(b),
          pricingCategory: formData.pricingCategory,
          pricingMode: formData.pricingMode,
          duration: formData.pricingMode === 'months' ? formData.durationMonths : formData.durationDays
        }));

      // ✅ UPDATED: Use exact same payload structure with currency fields and proper cost calculations
      const payload: any = {
        customer_name: formData.customerName,
        start_date: formData.startDate,
        end_date: formData.endDate,
        // ✅ COPIED FROM ContractEdit: Use exact same field names and values
        'Customer Name': formData.customerName,
        'Ad Type': formData.adType,
        'Contract Date': formData.startDate,
        'End Date': formData.endDate,
        'Total': calculations.finalTotal,
        'Total Rent': rentalCostOnly,
        'Discount': calculations.discountAmount,
        ad_type: formData.adType,
        billboard_ids: selected,
        customer_category: formData.pricingCategory,
        billboards_data: JSON.stringify(selectedBillboardsData),
        billboards_count: selectedBillboardsData.length,
        // ✅ COPIED FROM ContractEdit: Store billboard prices for historical reference
        billboard_prices: JSON.stringify(selectedBillboardsData.map(b => ({
          billboardId: b.id,
          contractPrice: b.contractPrice,
          printCost: b.printCost,
          pricingCategory: b.pricingCategory,
          pricingMode: b.pricingMode,
          duration: b.duration
        }))),
        installments_data: installments, // Pass as array, createContract will stringify it
        // ✅ FIXED: Store installation cost in correct field
        installation_cost: convertPrice(installationCost),
        // ✅ NEW: Store print cost data
        print_cost: printCostTotal,
        print_cost_enabled: printCostEnabled,
        print_price_per_meter: printPricePerMeter,
        // ✅ NEW: Store currency settings
        contract_currency: contractCurrency,
        exchange_rate: exchangeRate,
        // ✅ NEW: Store operating fee rate and calculated fee based on rental cost only
        operating_fee_rate: operatingFeeRate,
        fee: operatingFee, // This is calculated as rentalCostOnly * operatingFeeRate
        'Total Paid': 0,
        'Remaining': calculations.finalTotal,
        // ✅ COPIED FROM ContractEdit: Add rent_cost for compatibility
        rent_cost: calculations.finalTotal,
        discount: calculations.discountAmount,
      };
      
      if (formData.customerId) payload.customer_id = formData.customerId;
      
      console.log('✅ ContractCreate with all cost calculations:');
      console.log('- Contract currency:', contractCurrency);
      console.log('- Exchange rate:', exchangeRate);
      console.log('- Print cost enabled:', printCostEnabled);
      console.log('- Print price per meter:', printPricePerMeter);
      console.log('- Print cost total:', printCostTotal);
      console.log('- Installation cost (converted):', convertPrice(installationCost));
      console.log('- Total (final):', calculations.finalTotal);
      console.log('- Total Rent (rental only):', rentalCostOnly);
      console.log('- Operating fee rate:', operatingFeeRate, '%');
      console.log('- Operating fee:', operatingFee);
      console.log('- Billboard prices data:', selectedBillboardsData.length, 'billboards with prices');
      
      await createContract(payload);
      toast.success(`تم إنشاء العقد بعملة ${getCurrentCurrency().name} بنجاح`);
      navigate('/admin/contracts');
    } catch (e: any) {
      console.error('Contract creation error:', e);
      toast.error(e?.message || 'فشل إنشاء العقد');
    } finally {
      setSaving(false);
    }
  };

  const currentCurrency = getCurrentCurrency();

  return (
    <div className="container mx-auto px-4 py-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-header">إنشاء عقد جديد {nextContractNumber && `#${nextContractNumber}`}</h1>
          <p className="page-subtitle">إنشاء عقد إيجار جديد مع نظام دفعات ديناميكي وتكلفة طباعة وعملات متعددة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/contracts')}>
            عودة
          </Button>
          <Button onClick={submit} className="btn-primary">
            إنشاء العقد
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* ✅ NEW: Currency Selection Section */}
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
                  <span className="text-2xl">{currentCurrency.symbol}</span>
                  <span>{currentCurrency.name}</span>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded mt-4">
              <div className="font-medium mb-1">مثال على التحويل:</div>
              <div>1,000 د.ل × {exchangeRate} = {convertPrice(1000).toLocaleString()} {currentCurrency.symbol}</div>
            </div>
          </div>

          {/* ✅ UPDATED: Print Cost Toggle and Settings with currency display */}
          <div className="expenses-preview-item">
            <div className="flex items-center justify-between mb-3">
              <h3 className="expenses-preview-label">تكلفة الطباعة</h3>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">تفعيل تكلفة الطباعة</label>
                <button
                  type="button"
                  onClick={() => setPrintCostEnabled(!printCostEnabled)}
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
            
            {/* ✅ FIXED: Show current state clearly */}
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
                    <label className="expenses-form-label block mb-2">سعر المتر للطباعة ({currentCurrency.symbol})</label>
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
                      {printCostTotal.toLocaleString('ar-LY')} {currentCurrency.symbol}
                    </div>
                  </div>
                </div>
                
                {printPricePerMeter > 0 && selected.length > 0 && (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                    <div className="font-medium mb-2">تفاصيل تكلفة الطباعة للوحات المختارة:</div>
                    <div className="space-y-1">
                      {billboards
                        .filter(b => selected.includes(String((b as any).ID)))
                        .map(b => {
                          const printCost = calculatePrintCost(b);
                          const size = (b.size || (b as any).Size || '') as string;
                          const faces = Number((b as any).faces || (b as any).Faces || (b as any).faces_count || (b as any).Faces_Count || 1);
                          const sizeMatch = size.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
                          const area = sizeMatch ? parseFloat(sizeMatch[1]) * parseFloat(sizeMatch[2]) : 0;
                          
                          return (
                            <div key={(b as any).ID} className="text-xs">
                              <strong>{(b as any).name || (b as any).Billboard_Name}:</strong> {area}م² × {faces} وجه × {printPricePerMeter} = {printCost.toLocaleString()} {currentCurrency.symbol}
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
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
                  {rentalCostOnly.toLocaleString('ar-LY')} {currentCurrency.symbol}
                </div>
              </div>
              
              <div>
                <label className="expenses-form-label block mb-2">رسوم التشغيل المحسوبة</label>
                <div className="px-4 py-3 rounded bg-primary/10 text-primary font-bold">
                  {operatingFee.toLocaleString('ar-LY')} {currentCurrency.symbol}
                </div>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded mt-4">
              <div className="font-medium mb-1">طريقة الحساب:</div>
              <div>رسوم التشغيل = صافي الإيجار × {operatingFeeRate}% = {rentalCostOnly.toLocaleString()} × {operatingFeeRate}% = {operatingFee.toLocaleString()} {currentCurrency.symbol}</div>
              <div className="text-xs mt-2 text-blue-600">
                💡 صافي الإيجار = الإجمالي النهائي - تكلفة التركيب - تكلفة الطباعة - الخصم
              </div>
            </div>
          </div>

          <BillboardSelector
            billboards={billboards}
            selected={selected}
            onToggleSelect={toggleSelect}
            onRemoveSelected={removeSelected}
            loading={loading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            cityFilter={cityFilter}
            setCityFilter={setCityFilter}
            sizeFilter={sizeFilter}
            setSizeFilter={setSizeFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            pricingCategory={formData.pricingCategory}
            setPricingCategory={(category) => updateFormData({ pricingCategory: category })}
            pricingCategories={pricingCategories}
            calculateBillboardPrice={calculateBillboardPrice}
            installationDetails={installationDetails}
            pricingMode={formData.pricingMode}
            durationMonths={formData.durationMonths}
            durationDays={formData.durationDays}
            // ✅ NEW: Pass currency symbol for display
            currencySymbol={currentCurrency.symbol}
          />
          
          {/* ✅ UPDATED: Installation Cost Summary with unique sizes display */}
          {installationCost > 0 && (
            <div className="expenses-preview-item">
              <h3 className="expenses-preview-label mb-4">ملخص تكلفة التركيب</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="expenses-form-label block mb-2">إجمالي تكلفة التركيب</label>
                  <div className="px-4 py-3 rounded bg-orange/10 text-orange font-bold">
                    {convertPrice(installationCost).toLocaleString('ar-LY')} {currentCurrency.symbol}
                  </div>
                </div>
                
                <div>
                  <label className="expenses-form-label block mb-2">عدد اللوحات</label>
                  <div className="px-4 py-3 rounded bg-muted text-card-foreground font-bold">
                    {selected.length} لوحة
                  </div>
                </div>
              </div>

              {/* ✅ NEW: Display unique installation costs by size without repetition */}
              {installationDetails.length > 0 && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                  <div className="font-medium mb-2">تفاصيل تكلفة التركيب حسب المقاس:</div>
                  <div className="space-y-1">
                    {/* ✅ Group by size and show unique prices */}
                    {Array.from(new Map(installationDetails.map(detail => [detail.size, detail])).values())
                      .map((detail, index) => {
                        const sizeCount = installationDetails.filter(d => d.size === detail.size).length;
                        const totalForSize = detail.installationPrice * sizeCount;
                        const convertedPrice = convertPrice(totalForSize);
                        
                        return (
                          <div key={index} className="text-xs flex justify-between">
                            <span><strong>مقاس {detail.size}:</strong> {detail.installationPrice.toLocaleString()} د.ل × {sizeCount} لوحة</span>
                            <span className="font-bold">{convertedPrice.toLocaleString()} {currentCurrency.symbol}</span>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <ContractFormSidebar
          formData={formData}
          updateFormData={updateFormData}
          pricingCategories={pricingCategories}
          installments={installments}
          setInstallments={setInstallments}
          updateInstallment={updateInstallment}
          estimatedTotal={estimatedTotalWithPrint}
          baseTotal={calculations.baseTotal}
          discountAmount={calculations.discountAmount}
          totalAfterDiscount={calculations.totalAfterDiscount}
          rentalCostOnly={rentalCostOnly}
          finalTotal={calculations.finalTotal}
          operatingFee={operatingFee}
          installationCost={convertPrice(installationCost)}
          userEditedRentCost={userEditedRentCost}
          setUserEditedRentCost={setUserEditedRentCost}
          onSubmit={submit}
          onCancel={() => navigate('/admin/contracts')}
          saving={saving}
          submitLabel="إنشاء العقد"
          distributeEvenly={installmentManager.distributeEvenly}
          addInstallment={installmentManager.addInstallment}
          removeInstallment={installmentManager.removeInstallment}
          clearAllInstallments={installmentManager.clearAllInstallments}
          calculateDueDate={calculateDueDate}
          // ✅ NEW: Pass currency symbol for display
          currencySymbol={currentCurrency.symbol}
        />
      </div>
    </div>
  );
}