import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Edit, Link, Unlink, Wrench, ExternalLink } from 'lucide-react';
import { BillboardGridCard } from '@/components/BillboardGridCard';
import { BillboardFilters } from '@/components/BillboardFilters';
import { BillboardActions } from '@/components/BillboardActions';
import { BillboardAddDialog } from '@/components/billboards/BillboardAddDialog';
import { BillboardEditDialog } from '@/components/billboards/BillboardEditDialog';
import { ContractManagementDialog } from '@/components/billboards/ContractManagementDialog';
import { PrintFiltersDialog } from '@/components/billboards/PrintFiltersDialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { searchBillboards } from '@/services/billboardService';
import { useBillboardData } from '@/hooks/useBillboardData';
import { useBillboardForm } from '@/hooks/useBillboardForm';
import { useBillboardActions } from '@/hooks/useBillboardActions';
import { useBillboardExport } from '@/hooks/useBillboardExport';
import { useBillboardContract } from '@/hooks/useBillboardContract';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Billboards() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 16;

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('all');
  const [adTypeFilter, setAdTypeFilter] = useState<string>('all');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedContractNumbers, setSelectedContractNumbers] = useState<string[]>([]);

  // Print filters
  const [printFiltersOpen, setPrintFiltersOpen] = useState(false);
  const [printFilters, setPrintFilters] = useState({
    municipality: 'all',
    city: 'all',
    size: 'all',
    status: 'all',
    adType: 'all'
  });

  // Maintenance dialog state
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
  const [selectedBillboard, setSelectedBillboard] = useState<any>(null);
  const [maintenanceForm, setMaintenanceForm] = useState({
    status: '',
    type: '',
    description: '',
    priority: 'normal'
  });

  // Custom hooks
  const billboardData = useBillboardData();
  const billboardForm = useBillboardForm(billboardData.municipalities);
  const billboardActions = useBillboardActions();
  const billboardExport = useBillboardExport();
  const billboardContract = useBillboardContract();

  const { 
    billboards, 
    loading, 
    citiesList, 
    dbSizes, 
    dbMunicipalities, 
    dbAdTypes, 
    dbCustomers, 
    dbContractNumbers, 
    loadBillboards,
    municipalities,
    sizes,
    levels,
    faces,
    billboardTypes,
    setMunicipalities,
    setSizes,
    setLevels,
    setBillboardTypes,
    setDbMunicipalities,
    setDbSizes,
    sortBillboardsBySize
  } = billboardData;

  const { isContractExpired, hasActiveContract } = billboardActions;

  // ✅ ENHANCED: Better contract number extraction with multiple sources
  const getCurrentContractNumber = (billboard: any): string => {
    // Try multiple possible field names for contract numbers
    const contractNum = billboard.Contract_Number || 
                       billboard.contractNumber || 
                       billboard.contract_number ||
                       billboard.contract_id ||
                       (billboard.contracts && billboard.contracts[0]?.Contract_Number) ||
                       (billboard.contracts && billboard.contracts[0]?.contract_number) ||
                       (billboard.contracts && billboard.contracts[0]?.id) ||
                       '';
    
    const result = String(contractNum).trim();
    return result;
  };

  // Handle maintenance status update
  const handleMaintenanceSubmit = async () => {
    if (!selectedBillboard || !maintenanceForm.status) {
      toast.error('يرجى اختيار حالة الصيانة');
      return;
    }

    try {
      const { error } = await supabase
        .from('billboards')
        .update({
          maintenance_status: maintenanceForm.status,
          maintenance_date: new Date().toISOString(),
          maintenance_notes: maintenanceForm.description || null,
          maintenance_type: maintenanceForm.type || null,
          maintenance_priority: maintenanceForm.priority
        })
        .eq('ID', selectedBillboard.ID);

      if (error) throw error;

      // Add maintenance history record if needed
      if (maintenanceForm.type && maintenanceForm.description) {
        await supabase
          .from('maintenance_history')
          .insert({
            billboard_id: selectedBillboard.ID,
            maintenance_type: maintenanceForm.type,
            description: maintenanceForm.description,
            priority: maintenanceForm.priority,
            maintenance_date: new Date().toISOString()
          });
      }

      toast.success('تم تحديث حالة الصيانة بنجاح');
      setIsMaintenanceDialogOpen(false);
      setMaintenanceForm({
        status: '',
        type: '',
        description: '',
        priority: 'normal'
      });
      loadBillboards();
    } catch (error) {
      console.error('Error updating maintenance status:', error);
      toast.error('فشل في تحديث حالة الصيانة');
    }
  };

  // ✅ إنشاء نافذة تأكيد مخصصة بنمط النظام
  const showSystemConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      // إنشاء عنصر النافذة المنبثقة
      const overlay = document.createElement('div');
      overlay.className = 'custom-confirm-overlay';
      
      const dialog = document.createElement('div');
      dialog.className = 'custom-confirm-dialog';
      
      dialog.innerHTML = `
        <div class="system-dialog-header">
          <h3 class="system-dialog-title">${title}</h3>
        </div>
        <div class="system-dialog-content">
          <p style="white-space: pre-line; line-height: 1.6; margin-bottom: 20px;">${message}</p>
          <div class="system-dialog-buttons">
            <button class="system-btn-secondary" id="cancel-btn">إلغاء</button>
            <button class="system-btn-primary" id="confirm-btn">حذف</button>
          </div>
        </div>
      `;
      
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      
      const cleanup = () => {
        document.body.removeChild(overlay);
        document.body.style.overflow = 'unset';
      };
      
      const confirmBtn = dialog.querySelector('#confirm-btn');
      const cancelBtn = dialog.querySelector('#cancel-btn');
      
      confirmBtn?.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });
      
      cancelBtn?.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });
      
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(false);
        }
      });
      
      // إضافة دعم مفتاح Escape
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cleanup();
          resolve(false);
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
    });
  };

  // ✅ COMPLETELY FIXED: Delete function with better error handling and system-style confirmation
  const deleteBillboard = async (billboardId: number | string) => {
    try {
      // ✅ ENHANCED: Better confirmation dialog
      const billboardName = billboards.find(b => (b.ID || b.id) == billboardId)?.Billboard_Name || `اللوحة رقم ${billboardId}`;
      
      const confirmed = await showSystemConfirm(
        'تأكيد حذف اللوحة',
        `هل تريد حذف "${billboardName}"؟\n\nتحذير: هذا الإجراء لا يمكن التراجع عنه!`
      );
      
      if (!confirmed) {
        return;
      }
      
      // ✅ ENHANCED: Better ID validation and conversion
      const id = Number(billboardId);
      if (!id || isNaN(id) || id <= 0) {
        toast.error('معرف اللوحة غير صحيح');
        console.error('❌ Invalid billboard ID:', billboardId);
        return;
      }

      console.log('🗑️ Attempting to delete billboard with ID:', id);
      
      // ✅ FINAL FIX: Use ONLY the correct field name "ID" (uppercase) from database
      const { error } = await supabase
        .from('billboards')
        .delete()
        .eq('ID', id);
        
      if (error) {
        console.error('❌ Delete error:', error);
        // ✅ ENHANCED: Better error handling with specific error messages
        if (error.code === '23503') {
          toast.error('لا يمكن حذف هذه اللوحة لأنها مرتبطة بعقود أو بيانات أخرى');
        } else if (error.code === '42703') {
          toast.error('خطأ في بنية قاعدة البيانات - يرجى الاتصال بالدعم الفني');
        } else if (error.code === 'PGRST116') {
          toast.error('لا توجد لوحة بهذا المعرف');
        } else {
          toast.error(`فشل في حذف اللوحة: ${error.message}`);
        }
        return;
      }
      
      console.log('✅ Billboard deleted successfully');
      toast.success(`تم حذف "${billboardName}" بنجاح`);
      await loadBillboards();
    } catch (error: any) {
      console.error('❌ Delete billboard error:', error);
      toast.error(error?.message || 'فشل في حذف اللوحة');
    }
  };

  // ✅ ENHANCED: Search function with support for billboard names and nearest landmark
  const enhancedSearchBillboards = (billboards: any[], query: string) => {
    if (!query.trim()) return billboards;
    
    const searchTerm = query.toLowerCase().trim();
    console.log('🔍 البحث عن:', searchTerm);
    
    return billboards.filter((billboard) => {
      // ✅ Billboard name search with multiple field variations
      const billboardName = String(
        billboard.Billboard_Name || 
        billboard.billboardName || 
        billboard.billboard_name ||
        billboard.name ||
        ''
      ).toLowerCase();
      
      // ✅ ENHANCED: Nearest landmark search with multiple field variations
      const nearestLandmark = String(
        billboard['Nearest Landmark'] ||
        billboard.nearestLandmark ||
        billboard.nearest_landmark ||
        billboard.Nearest_Landmark ||
        billboard['أقرب نقطة دالة'] ||
        billboard.landmark ||
        billboard.Location ||
        billboard.location ||
        billboard.Address ||
        billboard.address ||
        ''
      ).toLowerCase();
      
      // Municipality search with multiple field variations
      const municipality = String(
        billboard.Municipality || 
        billboard.municipality || 
        billboard.Municipality_Name ||
        billboard.municipality_name ||
        ''
      ).toLowerCase();
      
      // City search
      const city = String(
        billboard.City || 
        billboard.city || 
        billboard.City_Name ||
        billboard.city_name ||
        ''
      ).toLowerCase();
      
      // Contract number search
      const contractNumber = String(getCurrentContractNumber(billboard)).toLowerCase();
      
      // Ad type search with multiple field variations
      const adType = String(
        billboard.Ad_Type || 
        billboard.adType || 
        billboard.ad_type || 
        billboard.AdType || 
        (billboard.contracts && billboard.contracts[0]?.['Ad Type']) || 
        ''
      ).toLowerCase();
      
      // Customer name search
      const customerName = String(
        billboard.Customer_Name || 
        billboard.clientName || 
        billboard.customer_name ||
        (billboard.contracts && billboard.contracts[0]?.['Customer Name']) || 
        ''
      ).toLowerCase();
      
      // Size search
      const size = String(
        billboard.Size || 
        billboard.size || 
        ''
      ).toLowerCase();
      
      // ✅ ENHANCED: Comprehensive search matching including nearest landmark
      const matches = billboardName.includes(searchTerm) ||
                     nearestLandmark.includes(searchTerm) ||
                     municipality.includes(searchTerm) ||
                     city.includes(searchTerm) ||
                     contractNumber.includes(searchTerm) ||
                     adType.includes(searchTerm) ||
                     customerName.includes(searchTerm) ||
                     size.includes(searchTerm);
      
      if (matches) {
        console.log('✅ تطابق:', {
          name: billboardName,
          nearestLandmark,
          municipality,
          city,
          searchTerm
        });
      }
      
      return matches;
    });
  };

  // ✅ ENHANCED: Enhanced filtering with "منتهي" status support
  const filteredBillboards = useMemo(() => {
    console.log('🔄 Filtering billboards...', {
      totalBillboards: billboards.length,
      searchQuery,
      selectedContractNumbers,
      selectedStatuses,
      adTypeFilter,
      dbAdTypes: dbAdTypes.slice(0, 5),
      dbContractNumbers: dbContractNumbers.slice(0, 5)
    });
    
    const searched = enhancedSearchBillboards(billboards, searchQuery);
    console.log('🔍 نتائج البحث:', searched.length, 'من أصل', billboards.length);
    
    return searched.filter((billboard) => {
      const statusValue = String(((billboard as any).Status ?? (billboard as any).status ?? '')).trim();
      const statusLower = statusValue.toLowerCase();
      const hasContract = !!(getCurrentContractNumber(billboard) && getCurrentContractNumber(billboard) !== '0');
      const contractExpired = isContractExpired((billboard as any).Rent_End_Date ?? (billboard as any).rent_end_date);
      
      const isAvailable = (statusLower === 'available' || statusValue === 'متاح') || !hasContract || contractExpired;
      const isBooked = ((statusLower === 'rented' || statusValue === 'مؤجر' || statusValue === 'محجوز') || hasContract) && !contractExpired;
      
      let isNearExpiry = false;
      const end = (billboard as any).Rent_End_Date ?? (billboard as any).rent_end_date;
      if (end && !contractExpired) {
        try {
          const endDate = new Date(end);
          const diffDays = Math.ceil((endDate.getTime() - Date.now()) / 86400000);
          isNearExpiry = diffDays > 0 && diffDays <= 20;
        } catch {}
      }

      // ✅ NEW: Check if contract is expired (منتهي status)
      const isExpired = contractExpired && hasContract;
      
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.some(s => (
        (s === 'متاحة' && isAvailable) ||
        (s === 'محجوز' && isBooked) ||
        (s === 'قريبة الانتهاء' && isNearExpiry) ||
        (s === 'منتهي' && isExpired)
      ));
      
      const matchesCity = selectedCities.length === 0 || selectedCities.includes((billboard as any).City || billboard.city || '');
      const matchesSize = sizeFilter === 'all' || (((billboard as any).Size || billboard.size || '') === sizeFilter);
      const matchesMunicipality = municipalityFilter === 'all' || (((billboard as any).Municipality || (billboard as any).municipality || '') === municipalityFilter);
      
      // ✅ FIXED: Better ad type matching with multiple field variations
      const adTypeVal = String(billboard.Ad_Type || billboard.adType || billboard.ad_type || billboard.AdType || 
                              (billboard.contracts && billboard.contracts[0]?.['Ad Type']) || '').trim();
      const matchesAdType = adTypeFilter === 'all' || adTypeVal === adTypeFilter;
      
      const customerVal = String((billboard as any).Customer_Name ?? (billboard as any).clientName ?? '');
      const matchesCustomer = selectedCustomers.length === 0 || selectedCustomers.includes(customerVal);
      
      // ✅ ENHANCED: Contract number filtering with better matching logic
      const contractNoVal = getCurrentContractNumber(billboard);
      let matchesContractNo = true;
      
      if (selectedContractNumbers.length > 0) {
        if (!contractNoVal || contractNoVal === '0' || contractNoVal === '') {
          matchesContractNo = false;
        } else {
          matchesContractNo = selectedContractNumbers.some(selectedContract => {
            const selected = String(selectedContract).trim();
            const current = String(contractNoVal).trim();
            
            // Exact match
            if (current === selected) return true;
            
            // Try numeric comparison for contract numbers
            const selectedNum = parseInt(selected);
            const currentNum = parseInt(current);
            if (!isNaN(selectedNum) && !isNaN(currentNum) && selectedNum === currentNum) {
              return true;
            }
            
            return false;
          });
        }
      }
      
      const result = matchesStatus && matchesCity && matchesSize && matchesMunicipality && matchesAdType && matchesCustomer && matchesContractNo;
      
      return result;
    });
  }, [billboards, searchQuery, selectedStatuses, selectedCities, sizeFilter, municipalityFilter, adTypeFilter, selectedCustomers, selectedContractNumbers, isContractExpired]);

  // ✅ FIXED: Use useMemo for sorted filtered billboards to prevent re-sorting
  const sortedFilteredBillboards = useMemo(() => {
    if (filteredBillboards.length === 0) return [];
    
    // Use synchronous sorting instead of async to prevent state updates
    const sizeOrder: { [key: string]: number } = {
      '13*5': 1, '13x5': 1, '13×5': 1, '5*13': 1, '5x13': 1, '5×13': 1,
      '12*4': 2, '12x4': 2, '12×4': 2, '4*12': 2, '4x12': 2, '4×12': 2,
      '10*4': 3, '10x4': 3, '10×4': 3, '4*10': 3, '4x10': 3, '4×10': 3,
      '8*3': 4, '8x3': 4, '8×3': 4, '3*8': 4, '3x8': 4, '3×8': 4,
      '6*3': 5, '6x3': 5, '6×3': 5, '3*6': 5, '3x6': 5, '3×6': 5,
      '4*3': 6, '4x3': 6, '4×3': 6, '3*4': 6, '3x4': 6, '3×4': 6,
      '5*3': 7, '5x3': 7, '5×3': 7, '3*5': 7, '3x5': 7, '3×5': 7
    };
    
    return [...filteredBillboards].sort((a, b) => {
      const sizeA = a.Size || a.size || '';
      const sizeB = b.Size || b.size || '';
      
      const orderA = sizeOrder[sizeA] || 999;
      const orderB = sizeOrder[sizeB] || 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      const idA = a.ID || a.id || 0;
      const idB = b.ID || b.id || 0;
      return idA - idB;
    });
  }, [filteredBillboards]);

  const totalPages = Math.max(1, Math.ceil(sortedFilteredBillboards.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagedBillboards = sortedFilteredBillboards.slice(startIndex, startIndex + PAGE_SIZE);

  // ✅ UPDATED: Calculate available billboards count with useMemo
  const availableBillboardsCount = useMemo(() => {
    return billboards.filter((billboard: any) => {
      const statusValue = String(billboard.Status ?? billboard.status ?? '').trim();
      const statusLower = statusValue.toLowerCase();
      const hasContract = !!(getCurrentContractNumber(billboard) && getCurrentContractNumber(billboard) !== '0');
      const contractExpired = isContractExpired(billboard.Rent_End_Date ?? billboard.rent_end_date);
      
      return (statusLower === 'available' || statusValue === 'متاح') || !hasContract || contractExpired;
    }).length;
  }, [billboards, isContractExpired]);

  // ✅ FIXED: Reset current page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatuses, selectedCities, sizeFilter, municipalityFilter, adTypeFilter, selectedCustomers, selectedContractNumbers]);

  // ✅ FIXED: Stable pagination handlers with useCallback
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // ✅ FIXED: Simple pagination without complex components
  const PaginationControls = () => (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handlePreviousPage}
        disabled={currentPage === 1}
        className="px-3 py-1"
      >
        السابق
      </Button>
      
      {(() => {
        const windowSize = 5;
        let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
        let end = start + windowSize - 1;
        if (end > totalPages) {
          end = totalPages;
          start = Math.max(1, end - windowSize + 1);
        }
        return Array.from({ length: end - start + 1 }, (_, idx) => start + idx).map((p) => (
          <Button
            key={p}
            variant={currentPage === p ? "default" : "outline"}
            size="sm"
            onClick={() => handlePageChange(p)}
            className="w-8 h-8 p-0"
          >
            {p}
          </Button>
        ));
      })()}

      <Button
        variant="outline"
        size="sm"
        onClick={handleNextPage}
        disabled={currentPage === totalPages}
        className="px-3 py-1"
      >
        التالي
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="expenses-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل اللوحات الإعلانية...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="expenses-container">
      {/* Header and Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-header">إدارة اللوحات الإعلانية</h1>
          <p className="text-muted">عرض وإدارة جميع اللوحات الإعلانية مع ترتيب المقاسات من قاعدة البيانات وبيانات العقود المحدثة</p>
        </div>
        <BillboardActions
          exportToExcel={() => billboardExport.exportToExcel(billboards)}
          exportAvailableToExcel={() => billboardExport.exportAvailableToExcel(billboards, isContractExpired)}
          exportFollowUpToExcel={() => billboardExport.exportFollowUpToExcel(billboards)}
          setPrintFiltersOpen={setPrintFiltersOpen}
          availableBillboardsCount={availableBillboardsCount}
          initializeAddForm={billboardForm.initializeAddForm}
          setAddOpen={billboardForm.setAddOpen}
        />
      </div>

      {/* ✅ Enhanced info section with luxury styling */}
      <div className="expenses-preview-card">
        <div className="p-6">
          <h3 className="expenses-preview-title mb-4">إحصائيات اللوحات الإعلانية</h3>
          <div className="expenses-stats-grid">
            <div className="expenses-stat-card card-elegant">
              <div className="expenses-stat-content">
                <div>
                  <div className="expenses-stat-text">إجمالي اللوحات</div>
                  <div className="expenses-stat-value text-blue">{billboards.length}</div>
                </div>
                <MapPin className="expenses-stat-icon text-blue" />
              </div>
            </div>
            <div className="expenses-stat-card card-elegant">
              <div className="expenses-stat-content">
                <div>
                  <div className="expenses-stat-text">اللوحات المتاحة</div>
                  <div className="expenses-stat-value text-green">{availableBillboardsCount}</div>
                </div>
                <MapPin className="expenses-stat-icon text-green" />
              </div>
            </div>
            <div className="expenses-stat-card card-elegant">
              <div className="expenses-stat-content">
                <div>
                  <div className="expenses-stat-text">أسماء الزبائن</div>
                  <div className="expenses-stat-value text-purple">{dbCustomers.length}</div>
                  <div className="text-xs text-purple">من العقود النشطة</div>
                </div>
                <MapPin className="expenses-stat-icon text-purple" />
              </div>
            </div>
            <div className="expenses-stat-card card-elegant">
              <div className="expenses-stat-content">
                <div>
                  <div className="expenses-stat-text">أنواع الإعلانات</div>
                  <div className="expenses-stat-value text-orange">{dbAdTypes.length}</div>
                  <div className="text-xs text-orange">من العقود النشطة</div>
                </div>
                <MapPin className="expenses-stat-icon text-orange" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ FIXED: Search results counter with proper styling */}
      <div className="expenses-preview-card">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <MapPin className="h-4 w-4" />
              <span className="expenses-preview-text">
                نتائج البحث: <span className="expenses-stat-value text-primary">{sortedFilteredBillboards.length}</span> لوحة من أصل <span className="expenses-stat-value text-primary">{billboards.length}</span>
              </span>
            </div>
            <div className="expenses-preview-text">
              الصفحة {currentPage} من {totalPages}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <BillboardFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
        selectedCities={selectedCities}
        setSelectedCities={setSelectedCities}
        sizeFilter={sizeFilter}
        setSizeFilter={setSizeFilter}
        municipalityFilter={municipalityFilter}
        setMunicipalityFilter={setMunicipalityFilter}
        adTypeFilter={adTypeFilter}
        setAdTypeFilter={setAdTypeFilter}
        selectedCustomers={selectedCustomers}
        setSelectedCustomers={setSelectedCustomers}
        selectedContractNumbers={selectedContractNumbers}
        setSelectedContractNumbers={setSelectedContractNumbers}
        cities={citiesList}
        billboardSizes={dbSizes}
        billboardMunicipalities={dbMunicipalities}
        uniqueAdTypes={dbAdTypes}
        uniqueCustomers={dbCustomers}
        uniqueContractNumbers={dbContractNumbers}
      />

      {/* Top Pagination */}
      {sortedFilteredBillboards.length > 0 && (
        <div className="flex justify-center mb-4">
          <PaginationControls />
        </div>
      )}

      {/* Billboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {pagedBillboards.map((billboard, idx) => {
          const keyVal = String((billboard as any).id ?? (billboard as any).ID ?? `${(billboard as any).Billboard_Name ?? 'bb'}-${startIndex + idx}`);
          const hasContract = hasActiveContract(billboard);
          
          return (
            <div key={keyVal} className="space-y-2">
              <BillboardGridCard billboard={billboard as any} showBookingActions={false} />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 card-hover" onClick={() => billboardForm.setEditing(billboard)}>
                  <Edit className="h-4 w-4 ml-1" />
                  تعديل
                </Button>
                
                {/* زر موقع اللوحة */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="card-hover"
                  onClick={() => {
                    if (billboard.GPS_Link) {
                      window.open(billboard.GPS_Link, '_blank');
                    } else {
                      toast.error('لا يوجد رابط موقع لهذه اللوحة');
                    }
                  }}
                  disabled={!billboard.GPS_Link}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>

                {/* زر صيانة اللوحة */}
                <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="card-hover"
                      onClick={() => {
                        setSelectedBillboard(billboard);
                        setMaintenanceForm({
                          status: billboard.maintenance_status || '',
                          type: billboard.maintenance_type || '',
                          description: billboard.maintenance_notes || '',
                          priority: billboard.maintenance_priority || 'normal'
                        });
                      }}
                    >
                      <Wrench className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                </Dialog>
                
                <Button 
                  variant={hasContract ? "secondary" : "default"} 
                  size="sm" 
                  className="flex-1"
                  onClick={() => billboardContract.openContractDialog(billboard)}
                >
                  {hasContract ? (
                    <>
                      <Unlink className="h-4 w-4 ml-1" />
                      إزالة من العقد
                    </>
                  ) : (
                    <>
                      <Link className="h-4 w-4 ml-1" />
                      إضافة إلى عقد
                    </>
                  )}
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => {
                    // ✅ ENHANCED: Better ID extraction with multiple fallbacks
                    const billboardId = (billboard as any).ID || (billboard as any).id;
                    console.log('🔍 Billboard ID for deletion:', billboardId, 'Billboard object:', billboard);
                    deleteBillboard(billboardId);
                  }}
                >
                  حذف
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Pagination */}
      {sortedFilteredBillboards.length > 0 && (
        <div className="flex justify-center mt-6">
          <PaginationControls />
        </div>
      )}

      {/* No Results */}
      {sortedFilteredBillboards.length === 0 && (
        <Card className="card-elegant">
          <CardContent className="p-12 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد لوحات</h3>
            <p className="text-muted-foreground">لم يتم العثور على لوحات تطابق معايير البحث المحددة</p>
          </CardContent>
        </Card>
      )}

      {/* Maintenance Dialog */}
      <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إدارة صيانة اللوحة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedBillboard && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedBillboard.Billboard_Name || `لوحة رقم ${selectedBillboard.ID}`}</p>
                <p className="text-sm text-muted-foreground">{selectedBillboard.Nearest_Landmark || selectedBillboard.District}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="maintenance-status">حالة الصيانة *</Label>
              <Select
                value={maintenanceForm.status}
                onValueChange={(value) => setMaintenanceForm(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر حالة الصيانة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">تعمل بشكل طبيعي</SelectItem>
                  <SelectItem value="maintenance">قيد الصيانة</SelectItem>
                  <SelectItem value="repair_needed">تحتاج إصلاح</SelectItem>
                  <SelectItem value="out_of_service">خارج الخدمة</SelectItem>
                  <SelectItem value="متضررة اللوحة">متضررة اللوحة</SelectItem>
                  <SelectItem value="تحتاج ازالة لغرض التطوير">تحتاج ازالة لغرض التطوير</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenance-type">نوع الصيانة</Label>
              <Select
                value={maintenanceForm.type}
                onValueChange={(value) => setMaintenanceForm(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع الصيانة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="صيانة دورية">صيانة دورية</SelectItem>
                  <SelectItem value="إصلاح">إصلاح</SelectItem>
                  <SelectItem value="تنظيف">تنظيف</SelectItem>
                  <SelectItem value="استبدال اللوحة">استبدال اللوحة</SelectItem>
                  <SelectItem value="قص اللوحة">قص اللوحة</SelectItem>
                  <SelectItem value="أخرى">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">الأولوية</Label>
              <Select
                value={maintenanceForm.priority}
                onValueChange={(value) => setMaintenanceForm(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="normal">عادية</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">وصف المشكلة أو الصيانة</Label>
              <Textarea
                id="description"
                placeholder="اكتب وصف تفصيلي..."
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleMaintenanceSubmit} className="flex-1">
                حفظ
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsMaintenanceDialogOpen(false)}
                className="flex-1"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogs */}
      <BillboardAddDialog 
        {...billboardForm} 
        {...billboardData} 
        {...billboardActions}
        municipalities={municipalities}
        sizes={sizes}
        levels={levels}
        citiesList={citiesList}
        faces={faces}
        billboardTypes={billboardTypes}
        setMunicipalities={setMunicipalities}
        setSizes={setSizes}
        setLevels={setLevels}
        setBillboardTypes={setBillboardTypes}
        setDbMunicipalities={setDbMunicipalities}
        setDbSizes={setDbSizes}
        loadBillboards={loadBillboards}
      />
      
      <BillboardEditDialog 
        {...billboardForm} 
        {...billboardData} 
        {...billboardActions}
        municipalities={municipalities}
        sizes={sizes}
        levels={levels}
        citiesList={citiesList}
        faces={faces}
        billboardTypes={billboardTypes}
        setMunicipalities={setMunicipalities}
        setDbMunicipalities={setDbMunicipalities}
        loadBillboards={loadBillboards}
      />
      
      <ContractManagementDialog 
        {...billboardContract}
        loadBillboards={loadBillboards}
      />
      
      <PrintFiltersDialog 
        open={printFiltersOpen}
        onOpenChange={setPrintFiltersOpen}
        filters={printFilters}
        setFilters={setPrintFilters}
        billboards={billboards}
        isContractExpired={isContractExpired}
        billboardMunicipalities={dbMunicipalities}
        cities={citiesList}
        billboardSizes={dbSizes}
        uniqueAdTypes={dbAdTypes}
      />
    </div>
  );
}