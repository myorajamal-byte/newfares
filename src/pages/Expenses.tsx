import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, DollarSign, Plus, Calculator, TrendingUp, TrendingDown, Lock, Calendar, Hash } from 'lucide-react';

interface Contract {
  id: number;
  contract_number: string;
  customer_name: string;
  fee: number;
  start_date: string;
  total_amount: number;
  status: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  date: string;
  method?: string;
  note?: string;
}

interface PeriodClosure {
  id: number;
  period_start?: string;
  period_end?: string;
  contract_start?: string;
  contract_end?: string;
  closure_date: string;
  closure_type: 'period' | 'contract_range';
  total_contracts: number;
  total_amount: number;
  total_withdrawn: number;
  remaining_balance: number;
  notes?: string;
}

export default function Expenses() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [closures, setClosures] = useState<PeriodClosure[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [closureOpen, setClosureOpen] = useState(false);
  
  // Form states
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('');
  const [withdrawalDate, setWithdrawalDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [withdrawalMethod, setWithdrawalMethod] = useState<string>('');
  const [withdrawalNotes, setWithdrawalNotes] = useState<string>('');
  
  // Period closure form
  const [closureDate, setClosureDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [closureType, setClosureType] = useState<'period' | 'contract_range'>('period');
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [contractStart, setContractStart] = useState<string>('');
  const [contractEnd, setContractEnd] = useState<string>('');
  const [closureNotes, setClosureNotes] = useState<string>('');

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load contracts - ترتيب تنازلي حسب رقم العقد
      const { data: contractsData, error: contractsError } = await supabase
        .from('Contract')
        .select('*')
        .order('Contract_Number', { ascending: false });

      if (contractsError) {
        console.error('خطأ في تحميل العقود:', contractsError);
        toast.error('فشل في تحميل العقود');
      } else {
        const mappedContracts = (contractsData || []).map(c => ({
          id: c.id,
          contract_number: c.Contract_Number || c.contract_number || c.id?.toString() || '',
          customer_name: c['Customer Name'] || c.customer_name || '',
          fee: Number(c.fee) || 3,
          start_date: c['Contract Date'] || c.start_date || c['Start Date'] || '',
          total_amount: Number(c['Total Rent']) || Number(c.rent_cost) || Number(c.total_amount) || 0,
          status: c.status || 'active'
        }));
        
        // ترتيب إضافي في الكود للتأكد
        mappedContracts.sort((a, b) => {
          const numA = parseInt(a.contract_number) || 0;
          const numB = parseInt(b.contract_number) || 0;
          return numB - numA; // ترتيب تنازلي
        });
        
        setContracts(mappedContracts);
      }

      // Load withdrawals
      try {
        const { data: withdrawalsData } = await supabase
          .from('expenses_withdrawals')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (Array.isArray(withdrawalsData)) {
          const mappedWithdrawals = withdrawalsData.map((w: any) => ({
            id: w.id?.toString() || crypto.randomUUID(),
            amount: Number(w.amount) || 0,
            date: (w.date || w.created_at || new Date().toISOString()).slice(0, 10),
            method: w.method || undefined,
            note: w.note || undefined
          }));
          setWithdrawals(mappedWithdrawals);
        }
      } catch (error) {
        console.error('خطأ في تحميل السحوبات:', error);
      }

      // Load period closures
      try {
        const { data: closuresData } = await supabase
          .from('period_closures')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (Array.isArray(closuresData)) {
          setClosures(closuresData);
        }
      } catch (error) {
        console.error('خطأ في تحميل إغلاقات الفترات:', error);
      }

      // Load exclusions
      try {
        const { data: flagsData } = await supabase
          .from('expenses_flags')
          .select('contract_id, excluded');
        
        if (Array.isArray(flagsData)) {
          const excludedSet = new Set<string>();
          flagsData.forEach((flag: any) => {
            if (flag.excluded && flag.contract_id != null) {
              excludedSet.add(String(flag.contract_id));
            }
          });
          setExcludedIds(excludedSet);
        }
      } catch (error) {
        console.error('خطأ في تحميل حالات الاستبعاد:', error);
      }

    } catch (error) {
      console.error('خطأ عام في تحميل البيانات:', error);
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  // Check if contract is in any closed period
  const isContractClosed = (contract: Contract) => {
    return closures.some(closure => {
      if (closure.closure_type === 'period' && closure.period_start && closure.period_end) {
        const contractDate = new Date(contract.start_date);
        const closureStart = new Date(closure.period_start);
        const closureEnd = new Date(closure.period_end);
        return contractDate >= closureStart && contractDate <= closureEnd;
      } else if (closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end) {
        const contractNum = contract.contract_number;
        return contractNum >= closure.contract_start && contractNum <= closure.contract_end;
      }
      return false;
    });
  };

  // Get contracts in range that are not closed
  const getContractsInRange = () => {
    return contracts.filter(contract => {
      if (isContractClosed(contract) || excludedIds.has(contract.id.toString())) {
        return false;
      }

      // Apply current filter
      if (closureType === 'period' && periodStart && periodEnd) {
        const contractDate = new Date(contract.start_date);
        const start = new Date(periodStart);
        const end = new Date(periodEnd);
        return contractDate >= start && contractDate <= end;
      } else if (closureType === 'contract_range' && contractStart && contractEnd) {
        const contractNum = contract.contract_number;
        return contractNum >= contractStart && contractNum <= contractEnd;
      }
      
      return false;
    });
  };

  // Calculate totals with dependency on closures
  const totals = useMemo(() => {
    const totalContracts = contracts.length;
    
    // Calculate pool total (excluding closed periods/ranges and excluded contracts)
    const poolTotal = contracts.reduce((sum, contract) => {
      const id = contract.id.toString();
      
      // Skip excluded contracts
      if (excludedIds.has(id)) {
        return sum;
      }
      
      // Skip closed contracts
      const isClosed = closures.some(closure => {
        if (closure.closure_type === 'period' && closure.period_start && closure.period_end) {
          const contractDate = new Date(contract.start_date);
          const closureStart = new Date(closure.period_start);
          const closureEnd = new Date(closure.period_end);
          return contractDate >= closureStart && contractDate <= closureEnd;
        } else if (closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end) {
          const contractNum = contract.contract_number;
          return contractNum >= closure.contract_start && contractNum <= closure.contract_end;
        }
        return false;
      });
      
      if (isClosed) {
        return sum;
      }
      
      const total = contract.total_amount || 0;
      const feePercent = contract.fee || 3;
      return sum + Math.round(total * (feePercent / 100));
    }, 0);
    
    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const remainingPool = Math.max(0, poolTotal - totalWithdrawn);

    return {
      totalContracts,
      poolTotal,
      totalWithdrawn,
      remainingPool
    };
  }, [contracts, withdrawals, closures, excludedIds]);

  // Add withdrawal
  const addWithdrawal = async () => {
    if (!withdrawalAmount) {
      toast.error('يرجى إدخال مبلغ السحب');
      return;
    }

    if (!withdrawalDate) {
      toast.error('يرجى تحديد تاريخ السحب');
      return;
    }

    try {
      const amount = parseFloat(withdrawalAmount);
      
      // استخدام user_id من الجلسة الحالية
      const { data: { user } } = await supabase.auth.getUser();
      
      const withdrawalData = {
        amount,
        date: withdrawalDate,
        method: withdrawalMethod || null,
        note: withdrawalNotes || null,
        user_id: user?.id || null
      };

      let data;
      const { data: insertData, error } = await supabase
        .from('expenses_withdrawals')
        .insert([withdrawalData])
        .select()
        .single();

      if (error) {
        console.error('خطأ في إضافة السحب:', error);
        
        // إذا كانت المشكلة في RLS، نحاول بدون user_id
        if (error.message?.includes('row-level security')) {
          const simpleData = {
            amount,
            date: withdrawalDate,
            method: withdrawalMethod || null,
            note: withdrawalNotes || null
          };
          
          const { data: retryData, error: retryError } = await supabase
            .from('expenses_withdrawals')
            .insert([simpleData])
            .select()
            .single();
            
          if (retryError) {
            toast.error(`فشل في إضافة السحب: ${retryError.message}`);
            return;
          }
          
          data = retryData;
        } else {
          toast.error(`حدث خطأ في إضافة السحب: ${error.message}`);
          return;
        }
      } else {
        data = insertData;
      }

      const newWithdrawal: Withdrawal = {
        id: data.id.toString(),
        amount: data.amount,
        date: data.date,
        method: data.method,
        note: data.note
      };

      setWithdrawals(prev => [newWithdrawal, ...prev]);
      
      // Reset form
      setWithdrawalOpen(false);
      setWithdrawalAmount('');
      setWithdrawalDate(new Date().toISOString().slice(0,10));
      setWithdrawalMethod('');
      setWithdrawalNotes('');
      
      toast.success('تم إضافة السحب بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // Close period or contract range
  const closePeriodOrRange = async () => {
    if (!closureDate) {
      toast.error('يرجى تحديد تاريخ التسكير');
      return;
    }

    if (closureType === 'period') {
      if (!periodStart || !periodEnd) {
        toast.error('يرجى تحديد بداية ونهاية الفترة');
        return;
      }
      if (new Date(periodStart) >= new Date(periodEnd)) {
        toast.error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
        return;
      }
    } else {
      if (!contractStart || !contractEnd) {
        toast.error('يرجى تحديد رقم العقد الأول والأخير');
        return;
      }
      if (contractStart >= contractEnd) {
        toast.error('رقم العقد الأول يجب أن يكون أصغر من رقم العقد الأخير');
        return;
      }
    }

    // Get contracts in this range
    const contractsInRange = getContractsInRange();
    
    if (contractsInRange.length === 0) {
      toast.error('لا توجد عقود في النطاق المحدد أو جميع العقود مسكرة مسبقاً');
      return;
    }

    // Calculate totals for this range
    const totalAmount = contractsInRange.reduce((sum, contract) => {
      const feePercent = contract.fee || 3;
      return sum + Math.round(contract.total_amount * (feePercent / 100));
    }, 0);

    const totalWithdrawn = 0;
    const remainingBalance = totalAmount - totalWithdrawn;

    try {
      const closureData = {
        closure_type: closureType,
        period_start: closureType === 'period' ? periodStart : null,
        period_end: closureType === 'period' ? periodEnd : null,
        contract_start: closureType === 'contract_range' ? contractStart : null,
        contract_end: closureType === 'contract_range' ? contractEnd : null,
        closure_date: closureDate,
        total_contracts: contractsInRange.length,
        total_amount: totalAmount,
        total_withdrawn: totalWithdrawn,
        remaining_balance: remainingBalance,
        notes: closureNotes || null
      };

      const { data, error } = await supabase
        .from('period_closures')
        .insert([closureData])
        .select()
        .single();

      if (error) {
        console.error('خطأ في الإغلاق:', error);
        toast.error(`حدث خطأ في الإغلاق: ${error.message}`);
        return;
      }

      // Update closures state immediately to trigger recalculation
      setClosures(prev => [data, ...prev]);
      
      // Reset form
      setClosureOpen(false);
      setClosureDate(new Date().toISOString().slice(0,10));
      setPeriodStart('');
      setPeriodEnd('');
      setContractStart('');
      setContractEnd('');
      setClosureNotes('');
      
      const typeText = closureType === 'period' ? 'الفترة' : 'نطاق العقود';
      toast.success(`تم إغلاق ${typeText} بنجاح (${contractsInRange.length} عقد)`);
      
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // Toggle exclusion
  const toggleExclusion = async (contractId: string, exclude: boolean) => {
    try {
      const { error } = await supabase
        .from('expenses_flags')
        .upsert({ contract_id: contractId, excluded: exclude });

      if (error) {
        console.error('خطأ في تحديث حالة الاستبعاد:', error);
        toast.error('تعذر تحديث حالة العقد');
        return;
      }

      const newExcludedIds = new Set(excludedIds);
      if (exclude) {
        newExcludedIds.add(contractId);
      } else {
        newExcludedIds.delete(contractId);
      }
      setExcludedIds(newExcludedIds);
      
      toast.success(exclude ? 'تم استبعاد العقد من الحسبة' : 'تم إرجاع العقد إلى الحسبة');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // Get unique contract numbers for dropdown
  const contractNumbers = useMemo(() => {
    return contracts
      .map(c => c.contract_number)
      .filter(Boolean)
      .sort((a, b) => {
        const na = parseInt(a), nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return nb - na; // ترتيب تنازلي
        return b.localeCompare(a);
      });
  }, [contracts]);

  if (loading) {
    return (
      <div className="expenses-loading">
        <Loader2 className="expenses-loading-spinner" />
        <span>جاري التحميل...</span>
      </div>
    );
  }

  return (
    <div className="expenses-container">
      {/* Statistics Cards */}
      <div className="expenses-stats-grid">
        <Card>
          <CardContent className="expenses-stat-card">
            <div className="expenses-stat-content">
              <div>
                <p className="expenses-stat-text">إجمالي العقود</p>
                <p className="expenses-stat-value">{totals.totalContracts}</p>
              </div>
              <Calculator className="expenses-stat-icon stat-blue" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="expenses-stat-card">
            <div className="expenses-stat-content">
              <div>
                <p className="expenses-stat-text">المجموع العام</p>
                <p className="expenses-stat-value">{totals.poolTotal.toLocaleString()} د.ل</p>
              </div>
              <TrendingUp className="expenses-stat-icon stat-green" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="expenses-stat-card">
            <div className="expenses-stat-content">
              <div>
                <p className="expenses-stat-text">المسحوب</p>
                <p className="expenses-stat-value">{totals.totalWithdrawn.toLocaleString()} د.ل</p>
              </div>
              <TrendingDown className="expenses-stat-icon stat-red" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="expenses-stat-card">
            <div className="expenses-stat-content">
              <div>
                <p className="expenses-stat-text">الرصيد المتبقي</p>
                <p className="expenses-stat-value">{totals.remainingPool.toLocaleString()} د.ل</p>
              </div>
              <DollarSign className="expenses-stat-icon stat-purple" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="expenses-actions">
        <Button onClick={() => setWithdrawalOpen(true)} className="expenses-action-btn">
          <Plus className="h-4 w-4" />
          تسجيل سحب جديد
        </Button>
        <Button onClick={() => setClosureOpen(true)} variant="outline" className="expenses-action-btn">
          <Lock className="h-4 w-4" />
          تسكير حساب
        </Button>
      </div>

      {/* Preview */}
      {((closureType === 'period' && periodStart && periodEnd) || 
        (closureType === 'contract_range' && contractStart && contractEnd)) && (
        <Card className="expenses-preview-card">
          <CardHeader>
            <CardTitle className="expenses-preview-title">
              معاينة {closureType === 'period' ? 'الفترة' : 'نطاق العقود'} المحدد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="expenses-preview-grid">
              {(() => {
                const contractsInRange = getContractsInRange();
                const totalAmount = contractsInRange.reduce((sum, contract) => {
                  const feePercent = contract.fee || 3;
                  return sum + Math.round(contract.total_amount * (feePercent / 100));
                }, 0);
                
                return (
                  <>
                    <div className="expenses-preview-item">
                      <p className="expenses-preview-label">عدد العقود</p>
                      <p className="expenses-preview-value">{contractsInRange.length}</p>
                    </div>
                    <div className="expenses-preview-item">
                      <p className="expenses-preview-label">إجمالي المبلغ</p>
                      <p className="expenses-preview-value">{totalAmount.toLocaleString()} د.ل</p>
                    </div>
                    <div className="expenses-preview-item">
                      <p className="expenses-preview-label">
                        {closureType === 'period' ? 'من تاريخ' : 'من عقد'}
                      </p>
                      <p className="expenses-preview-text">
                        {closureType === 'period' 
                          ? new Date(periodStart).toLocaleDateString('ar-LY')
                          : contractStart
                        }
                      </p>
                    </div>
                    <div className="expenses-preview-item">
                      <p className="expenses-preview-label">
                        {closureType === 'period' ? 'إلى تاريخ' : 'إلى عقد'}
                      </p>
                      <p className="expenses-preview-text">
                        {closureType === 'period' 
                          ? new Date(periodEnd).toLocaleDateString('ar-LY')
                          : contractEnd
                        }
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle>العقود وحالة الحسبة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="expenses-table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم العقد</TableHead>
                  <TableHead className="text-right">اسم العميل</TableHead>
                  <TableHead className="text-right">تاريخ العقد</TableHead>
                  <TableHead className="text-right">النسبة</TableHead>
                  <TableHead className="text-right">قيمة العقد</TableHead>
                  <TableHead className="text-right">المبلغ المحسوب</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map(contract => {
                  const id = contract.id.toString();
                  const total = contract.total_amount || 0;
                  const feePercent = contract.fee || 3;
                  const calculatedAmount = Math.round(total * (feePercent / 100));
                  const excluded = excludedIds.has(id);
                  const closed = isContractClosed(contract);
                  
                  return (
                    <TableRow key={id}>
                      <TableCell className="expenses-contract-number text-right">{contract.contract_number}</TableCell>
                      <TableCell className="text-right">{contract.customer_name}</TableCell>
                      <TableCell className="text-right">{contract.start_date ? new Date(contract.start_date).toLocaleDateString('ar-LY') : '—'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{feePercent}%</Badge>
                      </TableCell>
                      <TableCell className="text-right">{total.toLocaleString()} د.ل</TableCell>
                      <TableCell className={`text-right ${excluded || closed ? 'expenses-amount-excluded' : 'expenses-amount-calculated'}`}>
                        {calculatedAmount.toLocaleString()} د.ل
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          {closed ? (
                            <Badge variant="destructive">مسكر</Badge>
                          ) : excluded ? (
                            <Badge variant="secondary">مستبعد</Badge>
                          ) : (
                            <Badge variant="default">ضمن الحسبة</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="expenses-actions-cell justify-end">
                          {!closed && (
                            excluded ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleExclusion(id, false)}
                              >
                                إرجاع
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => toggleExclusion(id, true)}
                              >
                                استبعاد
                              </Button>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawals History */}
      <Card>
        <CardHeader>
          <CardTitle>سجل السحوبات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="expenses-table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">الطريقة</TableHead>
                  <TableHead className="text-right">البيان</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map(withdrawal => (
                  <TableRow key={withdrawal.id}>
                    <TableCell className="text-right">{new Date(withdrawal.date).toLocaleDateString('ar-LY')}</TableCell>
                    <TableCell className="expenses-amount-calculated text-right">
                      {withdrawal.amount.toLocaleString()} د.ل
                    </TableCell>
                    <TableCell className="text-right">{withdrawal.method || '—'}</TableCell>
                    <TableCell className="text-right">{withdrawal.note || '—'}</TableCell>
                  </TableRow>
                ))}
                {withdrawals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="expenses-empty-state">
                      لا توجد سحوبات مسجلة
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Closures History */}
      <Card>
        <CardHeader>
          <CardTitle>سجل التسكيرات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="expenses-table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">تاريخ التسكير</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">النطاق</TableHead>
                  <TableHead className="text-right">عدد العقود</TableHead>
                  <TableHead className="text-right">إجمالي المبلغ</TableHead>
                  <TableHead className="text-right">المسحوب</TableHead>
                  <TableHead className="text-right">المتبقي</TableHead>
                  <TableHead className="text-right">الملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closures.map(closure => (
                  <TableRow key={closure.id}>
                    <TableCell className="text-right">{new Date(closure.closure_date).toLocaleDateString('ar-LY')}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={closure.closure_type === 'period' ? 'default' : 'secondary'}>
                        {closure.closure_type === 'period' ? 'فترة زمنية' : 'نطاق عقود'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {closure.closure_type === 'period' && closure.period_start && closure.period_end ? 
                        `${new Date(closure.period_start).toLocaleDateString('ar-LY')} - ${new Date(closure.period_end).toLocaleDateString('ar-LY')}` :
                        closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end ?
                        `${closure.contract_start} - ${closure.contract_end}` :
                        '—'
                      }
                    </TableCell>
                    <TableCell className="text-right">{closure.total_contracts}</TableCell>
                    <TableCell className="text-right">{closure.total_amount.toLocaleString()} د.ل</TableCell>
                    <TableCell className="text-right">{closure.total_withdrawn.toLocaleString()} د.ل</TableCell>
                    <TableCell className="text-right">{closure.remaining_balance.toLocaleString()} د.ل</TableCell>
                    <TableCell className="text-right">{closure.notes || '—'}</TableCell>
                  </TableRow>
                ))}
                {closures.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="expenses-empty-state">
                      لا توجد تسكيرات مسجلة
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Withdrawal Dialog */}
      <UIDialog.Dialog open={withdrawalOpen} onOpenChange={setWithdrawalOpen}>
        <UIDialog.DialogContent className="expenses-dialog-content">
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تسجيل سحب جديد</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              أدخل تفاصيل السحب من المجموع العام
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="expenses-dialog-form">
            <div>
              <label className="expenses-form-label">مبلغ السحب (د.ل)</label>
              <Input
                type="number"
                placeholder="أدخل مبلغ السحب"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
              />
            </div>

            <div>
              <label className="expenses-form-label">تاريخ السحب</label>
              <Input
                type="date"
                value={withdrawalDate}
                onChange={(e) => setWithdrawalDate(e.target.value)}
              />
            </div>

            <div>
              <label className="expenses-form-label">طريقة السحب</label>
              <Input
                placeholder="نقدي، تحويل بنكي، شيك..."
                value={withdrawalMethod}
                onChange={(e) => setWithdrawalMethod(e.target.value)}
              />
            </div>

            <div>
              <label className="expenses-form-label">ملاحظات</label>
              <Textarea
                placeholder="أدخل أي ملاحظات إضافية"
                value={withdrawalNotes}
                onChange={(e) => setWithdrawalNotes(e.target.value)}
              />
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={addWithdrawal}>
              حفظ السحب
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* Closure Dialog */}
      <UIDialog.Dialog open={closureOpen} onOpenChange={setClosureOpen}>
        <UIDialog.DialogContent className="max-w-lg">
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تسكير حساب</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              اختر طريقة التسكير: بالفترة الزمنية أو بنطاق أرقام العقود
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="expenses-dialog-form">
            <div>
              <label className="expenses-form-label">تاريخ التسكير</label>
              <Input
                type="date"
                value={closureDate}
                onChange={(e) => setClosureDate(e.target.value)}
              />
            </div>

            <div>
              <label className="expenses-form-label">نوع التسكير</label>
              <Select value={closureType} onValueChange={(value: 'period' | 'contract_range') => setClosureType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="period">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      تسكير بالفترة الزمنية
                    </div>
                  </SelectItem>
                  <SelectItem value="contract_range">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      تسكير بنطاق أرقام العقود
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {closureType === 'period' ? (
              <div className="expenses-form-grid">
                <div>
                  <label className="expenses-form-label">بداية الفترة</label>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="expenses-form-label">نهاية الفترة</label>
                  <Input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="expenses-form-grid">
                <div>
                  <label className="expenses-form-label">من رقم العقد</label>
                  <Select value={contractStart} onValueChange={setContractStart}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر العقد الأول" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractNumbers.map(num => (
                        <SelectItem key={num} value={num}>{num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="expenses-form-label">إلى رقم العقد</label>
                  <Select value={contractEnd} onValueChange={setContractEnd}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر العقد الأخير" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractNumbers.map(num => (
                        <SelectItem key={num} value={num}>{num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div>
              <label className="expenses-form-label">ملاحظات التسكير</label>
              <Textarea
                placeholder="أدخل ملاحظات حول التسكير"
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
              />
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => setClosureOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={closePeriodOrRange} variant="destructive">
              تسكير الحساب
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>
    </div>
  );
}