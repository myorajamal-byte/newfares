import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useBillboardData = () => {
  const [billboards, setBillboards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [municipalities, setMunicipalities] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [faces, setFaces] = useState<any[]>([]);
  const [billboardTypes, setBillboardTypes] = useState<string[]>([]);
  
  // Derived data for filters
  const [citiesList, setCitiesList] = useState<string[]>([]);
  const [dbSizes, setDbSizes] = useState<string[]>([]);
  const [dbMunicipalities, setDbMunicipalities] = useState<string[]>([]);
  const [dbAdTypes, setDbAdTypes] = useState<string[]>([]);
  const [dbCustomers, setDbCustomers] = useState<string[]>([]);
  const [dbContractNumbers, setDbContractNumbers] = useState<string[]>([]);

  // ✅ FIXED: Memoize getSizeOrderFromDB to prevent recreation
  const getSizeOrderFromDB = useCallback(async (): Promise<{ [key: string]: number }> => {
    try {
      const { data, error } = await supabase
        .from('sizes')
        .select('name, sort_order')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      
      const sizeOrderMap: { [key: string]: number } = {};
      data?.forEach((size) => {
        sizeOrderMap[size.name] = size.sort_order || 999;
      });
      
      console.log('✅ Size order map from database:', sizeOrderMap);
      return sizeOrderMap;
    } catch (error) {
      console.error('Error loading size order from database:', error);
      // Fallback to hardcoded order
      return {
        '13*5': 1, '13x5': 1, '13×5': 1, '5*13': 1, '5x13': 1, '5×13': 1,
        '12*4': 2, '12x4': 2, '12×4': 2, '4*12': 2, '4x12': 2, '4×12': 2,
        '10*4': 3, '10x4': 3, '10×4': 3, '4*10': 3, '4x10': 3, '4×10': 3,
        '8*3': 4, '8x3': 4, '8×3': 4, '3*8': 4, '3x8': 4, '3×8': 4,
        '6*3': 5, '6x3': 5, '6×3': 5, '3*6': 5, '3x6': 5, '3×6': 5,
        '4*3': 6, '4x3': 6, '4×3': 6, '3*4': 6, '3x4': 6, '3×4': 6,
        '5*3': 7, '5x3': 7, '5×3': 7, '3*5': 7, '3x5': 7, '3×5': 7
      };
    }
  }, []);

  // ✅ FIXED: Memoize sortBillboardsBySize to prevent recreation
  const sortBillboardsBySize = useCallback(async (billboards: any[]): Promise<any[]> => {
    const sizeOrderMap = await getSizeOrderFromDB();
    
    return [...billboards].sort((a, b) => {
      const sizeA = a.Size || a.size || '';
      const sizeB = b.Size || b.size || '';
      
      const orderA = sizeOrderMap[sizeA] || 999;
      const orderB = sizeOrderMap[sizeB] || 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // If same size order, sort by billboard ID
      const idA = a.ID || a.id || 0;
      const idB = b.ID || b.id || 0;
      return idA - idB;
    });
  }, [getSizeOrderFromDB]);

  // ✅ ENHANCED: Load contracts data with better field mapping
  const loadContractsData = useCallback(async () => {
    try {
      console.log('🔄 Loading contracts data...');
      
      const { data: contractsData, error } = await supabase
        .from('Contract')
        .select('*')
        .order('id', { ascending: false });

      if (error) {
        console.log('❌ Error loading contracts:', error);
        return { customers: [], adTypes: [], contractNumbers: [] };
      }

      console.log('✅ Contracts data loaded:', contractsData?.length || 0);
      
      if (!contractsData || contractsData.length === 0) {
        return { customers: [], adTypes: [], contractNumbers: [] };
      }

      // Extract unique values with enhanced field mapping
      const customerNames = new Set<string>();
      const adTypes = new Set<string>();
      const contractNumbers = new Set<string>();

      contractsData.forEach((contract: any) => {
        // ✅ ENHANCED: Customer names with more field variations
        const customerFields = [
          'customer_name', 'Customer Name', 'customerName', 'client_name', 
          'Client Name', 'clientName', 'Customer_Name', 'CLIENT_NAME'
        ];
        
        for (const field of customerFields) {
          const customerName = contract[field];
          if (customerName && String(customerName).trim()) {
            customerNames.add(String(customerName).trim());
            break;
          }
        }

        // ✅ ENHANCED: Ad types with comprehensive field mapping
        const adTypeFields = [
          'Ad Type', 'ad_type', 'adType', 'advertisement_type', 'type', 
          'Ad_Type', 'AD_TYPE', 'advertisementType', 'advType', 'category'
        ];
        
        for (const field of adTypeFields) {
          const adType = contract[field];
          if (adType && String(adType).trim() && String(adType).trim() !== 'null') {
            adTypes.add(String(adType).trim());
            break;
          }
        }

        // ✅ ENHANCED: Contract numbers with more variations
        const contractNumberFields = [
          'Contract_Number', 'contract_number', 'contractNumber', 'number', 
          'id', 'CONTRACT_NUMBER', 'contract_id', 'contractId'
        ];
        
        for (const field of contractNumberFields) {
          const contractNumber = contract[field];
          if (contractNumber && String(contractNumber).trim() && String(contractNumber).trim() !== '0') {
            contractNumbers.add(String(contractNumber).trim());
            break;
          }
        }
      });

      console.log('✅ Extracted contract data:');
      console.log('- Customers:', Array.from(customerNames).length);
      console.log('- Ad types:', Array.from(adTypes).length, Array.from(adTypes).slice(0, 10));
      console.log('- Contract numbers:', Array.from(contractNumbers).length);

      return {
        customers: Array.from(customerNames).sort(),
        adTypes: Array.from(adTypes).sort(),
        contractNumbers: Array.from(contractNumbers).sort((a, b) => {
          const numA = parseInt(a) || 0;
          const numB = parseInt(b) || 0;
          return numB - numA; // Descending order
        })
      };
    } catch (error) {
      console.error('Error loading contracts data:', error);
      return { customers: [], adTypes: [], contractNumbers: [] };
    }
  }, []);

  // ✅ ENHANCED: Load billboards with proper contract matching
  const loadBillboards = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading billboards...');
      
      // Load billboards data
      const { data: billboardsData, error: billboardsError } = await supabase
        .from('billboards')
        .select('*')
        .order('ID', { ascending: true });
      
      if (billboardsError) {
        console.error('❌ Error loading billboards:', billboardsError);
        throw billboardsError;
      }

      console.log('✅ Billboards loaded:', billboardsData?.length || 0);
      
      if (!billboardsData) {
        setBillboards([]);
        return;
      }

      // ✅ NEW: Load all contracts to match with billboards
      const { data: contractsData } = await supabase
        .from('Contract')
        .select('*')
        .order('id', { ascending: false });

      console.log('✅ Contracts loaded for matching:', contractsData?.length || 0);

      // ✅ ENHANCED: Process billboards with contract matching
      const processedBillboards = billboardsData.map(billboard => {
        const billboardId = String(billboard.ID);
        
        // Find contracts that include this billboard ID
        const matchingContracts = contractsData?.filter((contract: any) => {
          // Check billboard_ids field (comma-separated string)
          const billboardIds = contract.billboard_ids;
          if (billboardIds) {
            const idsArray = String(billboardIds).split(',').map(id => id.trim());
            return idsArray.includes(billboardId);
          }
          
          // Also check billboard_id field (single ID)
          if (contract.billboard_id && String(contract.billboard_id) === billboardId) {
            return true;
          }
          
          return false;
        }) || [];

        // Get the most recent active contract
        const activeContract = matchingContracts.length > 0 ? matchingContracts[0] : null;

        // ✅ DEBUG: Log contract matching for specific billboard
        if (billboardId === '954' || billboardId === '216' || billboardId === '160' || billboardId === '162') {
          console.log(`🔍 Billboard ${billboardId} contract matching:`, {
            matchingContracts: matchingContracts.length,
            activeContract: activeContract ? {
              id: activeContract.id,
              Contract_Number: activeContract.Contract_Number,
              'Ad Type': activeContract['Ad Type'],
              'Customer Name': activeContract['Customer Name']
            } : null
          });
        }

        return {
          ...billboard,
          // ✅ ENHANCED: Better contract field mapping
          Contract_Number: activeContract?.Contract_Number || billboard.Contract_Number || '',
          contractNumber: activeContract?.Contract_Number || billboard.Contract_Number || '',
          Customer_Name: activeContract?.['Customer Name'] || activeContract?.customer_name || billboard.Customer_Name || '',
          clientName: activeContract?.['Customer Name'] || activeContract?.customer_name || billboard.Customer_Name || '',
          Ad_Type: activeContract?.['Ad Type'] || activeContract?.ad_type || billboard.Ad_Type || '',
          adType: activeContract?.['Ad Type'] || activeContract?.ad_type || billboard.Ad_Type || '',
          Rent_Start_Date: activeContract?.['Contract Date'] || activeContract?.start_date || billboard.Rent_Start_Date || null,
          Rent_End_Date: activeContract?.['End Date'] || activeContract?.end_date || billboard.Rent_End_Date || null,
          ContractStatus: activeContract?.status || null,
          // ✅ FIXED: Map faces count correctly from database column
          Faces: billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Faces || 1,
          faces: billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Faces || 1,
          Number_of_Faces: billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Faces || 1,
          faces_count: billboard.Faces_Count || billboard.faces_count || billboard.faces || billboard.Faces || 1,
          // ✅ NEW: Add contract info for easier access
          contracts: matchingContracts.length > 0 ? matchingContracts : null
        };
      });

      // ✅ Sort billboards by database size order
      const sortedBillboards = await sortBillboardsBySize(processedBillboards);
      setBillboards(sortedBillboards);
      
      // Load contracts data for filters
      const { adTypes, customers, contractNumbers } = await loadContractsData();
      setDbAdTypes(adTypes);
      setDbCustomers(customers);
      setDbContractNumbers(contractNumbers);
      
      // Extract unique values for filters from billboards
      const cities = [...new Set(processedBillboards
        .map((b: any) => b.City || b.city)
        .filter(Boolean)
        .map((c: string) => c.trim())
        .filter(Boolean)
      )].sort();

      const billboardSizes = [...new Set(processedBillboards
        .map((b: any) => b.Size || b.size)
        .filter(Boolean)
        .map((s: string) => s.trim())
        .filter(Boolean)
      )];

      const municipalities = [...new Set(processedBillboards
        .map((b: any) => b.Municipality || b.municipality)
        .filter(Boolean)
        .map((m: string) => m.trim())
        .filter(Boolean)
      )].sort();
      
      setCitiesList(cities);
      setDbMunicipalities(municipalities);
      
      // ✅ Sort sizes by database order
      const sizeOrderMap = await getSizeOrderFromDB();
      const sortedSizes = billboardSizes.sort((a, b) => {
        const orderA = sizeOrderMap[a] || 999;
        const orderB = sizeOrderMap[b] || 999;
        return orderA - orderB;
      });
      setDbSizes(sortedSizes);
      
      console.log('✅ Billboards loaded successfully:');
      console.log('- Total billboards:', processedBillboards.length);
      console.log('- Cities:', cities.length);
      console.log('- Sizes (sorted):', sortedSizes.length, sortedSizes);
      console.log('- Municipalities:', municipalities.length);
      console.log('- Ad types (from contracts):', adTypes.length);
      console.log('- Customers (from contracts):', customers.length);
      console.log('- Contract numbers:', contractNumbers.length);
      
    } catch (error: any) {
      console.error('❌ Error loading billboards:', error);
      toast.error(`فشل في تحميل اللوحات: ${error.message || 'خطأ غير معروف'}`)
      setBillboards([]);
    } finally {
      setLoading(false);
    }
  }, [sortBillboardsBySize, loadContractsData, getSizeOrderFromDB]);

  // Load municipalities
  const loadMunicipalities = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('municipalities')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setMunicipalities(data || []);
      console.log('✅ Municipalities loaded:', data?.length || 0);
    } catch (error: any) {
      console.error('Error loading municipalities:', error);
    }
  }, []);

  // ✅ Load sizes with sort_order from database
  const loadSizes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sizes')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      setSizes(data || []);
      
      // ✅ Update dbSizes with sorted order from database
      const sortedSizeNames = data?.map(s => s.name) || [];
      setDbSizes(sortedSizeNames);
      
      console.log('✅ Sizes loaded with database sort order:', sortedSizeNames);
    } catch (error: any) {
      console.error('Error loading sizes:', error);
    }
  }, []);

  // Load levels - من جدول billboard_levels
  const loadLevels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('billboard_levels')
        .select('*')
        .order('level_code', { ascending: true });
      
      if (error) throw error;
      
      const levelCodes = data?.map(level => level.level_code).filter(Boolean) || [];
      setLevels(levelCodes);
      console.log('✅ Loaded levels from billboard_levels:', levelCodes);
    } catch (error: any) {
      console.error('Error loading levels:', error);
      setLevels(['A', 'B', 'S']); // القيم الافتراضية
    }
  }, []);

  // Load faces - من جدول billboard_faces
  const loadFaces = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('billboard_faces')
        .select('*')
        .order('count', { ascending: true });
      
      if (error) throw error;
      
      const facesData = data?.map(face => ({
        id: face.id,
        name: face.name,
        count: face.count
      })) || [];
      
      setFaces(facesData);
      console.log('✅ Loaded faces from billboard_faces:', facesData);
    } catch (error: any) {
      console.error('Error loading faces:', error);
      setFaces([
        { id: 1, name: 'وجه واحد', count: 1 },
        { id: 2, name: 'وجهين', count: 2 },
        { id: 4, name: 'أربعة أوجه', count: 4 }
      ]);
    }
  }, []);

  // Load billboard types - من جدول billboard_types
  const loadBillboardTypes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('billboard_types')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      const typeNames = data?.map(type => type.name).filter(Boolean) || [];
      setBillboardTypes(typeNames);
      console.log('✅ Loaded billboard types from billboard_types:', typeNames);
    } catch (error: any) {
      console.error('Error loading billboard types:', error);
      setBillboardTypes(['تيبول', 'برجية', 'عادية']);
    }
  }, []);

  // ✅ FIXED: Initialize data on component mount with proper dependency array
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        loadMunicipalities(),
        loadSizes(),
        loadLevels(),
        loadFaces(),
        loadBillboardTypes()
      ]);
      // Load billboards last to ensure all form data is ready
      await loadBillboards();
    };
    
    initializeData();
  }, []); // ✅ Empty dependency array to prevent infinite loop

  return {
    billboards,
    loading,
    citiesList,
    dbSizes,
    dbMunicipalities,
    dbAdTypes,
    dbCustomers,
    dbContractNumbers,
    municipalities,
    sizes,
    levels,
    faces,
    billboardTypes,
    loadBillboards,
    setMunicipalities,
    setSizes,
    setLevels,
    setBillboardTypes,
    setDbMunicipalities,
    setDbSizes,
    getSizeOrderFromDB,
    sortBillboardsBySize
  };
};