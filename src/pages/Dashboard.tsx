import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText, Receipt, Monitor, Clock, Plus, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

interface LegacyContract {
  Contract_Number: number;
  'Customer Name': string;
  'Ad Type': string;
  'Total Rent': number;
  'Start Date': string;
  'End Date': string;
  'Contract Date': string;
  customer_id: string;
  id: number;
}

interface NewContract {
  id: number;
  contract_number: string;
  customer_name: string;
  start_date: string;
  end_date: string;
  status: string;
  total_amount: number;
  created_at: string;
}

interface Payment {
  id: string;
  customer_name: string;
  amount: number;
  paid_at: string;
  entry_type: string;
  created_at: string;
}

interface Billboard {
  id: number;
  Billboard_Name: string;
  Size: string;
  Level: string;
  Municipality: string;
  Status: string;
  created_at: string;
}

export default function Dashboard() {
  const [legacyContracts, setLegacyContracts] = useState<LegacyContract[]>([]);
  const [newContracts, setNewContracts] = useState<NewContract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);

  // تحميل البيانات
  const loadData = async () => {
    try {
      setLoading(true);

      console.log('🔄 بدء تحميل بيانات لوحة الإدارة...');

      // تحميل العقود القديمة (الجدول الرئيسي) - ترتيب حسب تاريخ العقد
      const { data: legacyData, error: legacyError } = await supabase
        .from('Contract')
        .select('*')
        .order('Contract Date', { ascending: false }); // ترتيب حسب تاريخ العقد

      if (legacyError) {
        console.error('❌ خطأ في تحميل العقود القديمة:', legacyError);
        toast.error(`فشل في تحميل العقود: ${legacyError.message}`);
      } else {
        console.log('✅ تم تحميل العقود القديمة:', legacyData?.length || 0, 'عقد');
        setLegacyContracts(legacyData || []);
      }

      // تحميل العقود الجديدة (للمستقبل)
      const { data: newData, error: newError } = await supabase
        .from('contract')
        .select('*')
        .order('created_at', { ascending: false });

      if (newError) {
        console.error('❌ خطأ في تحميل العقود الجديدة:', newError);
      } else {
        console.log('✅ تم تحميل العقود الجديدة:', newData?.length || 0, 'عقد');
        setNewContracts(newData || []);
      }

      // تحميل المدفوعات من جدول customer_payments - ترتيب حسب تاريخ الإنشاء
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('customer_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (paymentsError) {
        console.error('❌ خطأ في تحميل المدفوعات:', paymentsError);
        toast.error(`فشل في تحميل المدفوعات: ${paymentsError.message}`);
      } else {
        console.log('✅ تم تحميل المدفوعات:', paymentsData?.length || 0, 'دفعة');
        setPayments(paymentsData || []);
      }

      // تحميل اللوحات - ترتيب حسب تاريخ الإنشاء
      const { data: billboardsData, error: billboardsError } = await supabase
        .from('billboards')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (billboardsError) {
        console.error('❌ خطأ في تحميل اللوحات:', billboardsError);
        toast.error(`فشل في تحميل اللوحات: ${billboardsError.message}`);
      } else {
        console.log('✅ تم تحميل اللوحات:', billboardsData?.length || 0, 'لوحة');
        setBillboards(billboardsData || []);
      }

      console.log('🎉 تم الانتهاء من تحميل جميع البيانات');

    } catch (error) {
      console.error('💥 خطأ عام في تحميل البيانات:', error);
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // العقود التي تقارب على الانتهاء (من الجدول القديم بشكل أساسي)
  const expiringContracts = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    // العقود القديمة المنتهية قريباً
    const legacyExpiring = legacyContracts
      .filter(contract => {
        try {
          if (!contract['End Date']) return false;
          const endDate = new Date(contract['End Date']);
          return endDate >= today && endDate <= thirtyDaysFromNow;
        } catch (error) {
          return false;
        }
      })
      .map(contract => ({
        id: `legacy_${contract.Contract_Number}`,
        contract_number: contract.Contract_Number?.toString() || '',
        customer_name: contract['Customer Name'] || '',
        ad_type: contract['Ad Type'] || '',
        end_date: contract['End Date'] || '',
        total_amount: Number(contract['Total']) || 0,
        source: 'legacy'
      }));

    // العقود الجديدة المنتهية قريباً
    const newExpiring = newContracts
      .filter(contract => {
        if (contract.status === 'closed' || contract.status === 'cancelled') return false;
        try {
          const endDate = parseISO(contract.end_date);
          return endDate >= today && endDate <= thirtyDaysFromNow;
        } catch (error) {
          return false;
        }
      })
      .map(contract => ({
        id: `new_${contract.id}`,
        contract_number: contract.contract_number,
        customer_name: contract.customer_name,
        ad_type: 'غير محدد', // العقود الجديدة لا تحتوي على نوع الإعلان بعد
        end_date: contract.end_date,
        total_amount: Number(contract.total_amount) || 0,
        source: 'new'
      }));

    const allExpiring = [...legacyExpiring, ...newExpiring];

    // ترتيب من الأقرب للأبعد
    const sorted = allExpiring.sort((a, b) => {
      try {
        const daysLeftA = differenceInDays(new Date(a.end_date), today);
        const daysLeftB = differenceInDays(new Date(b.end_date), today);
        return daysLeftA - daysLeftB;
      } catch (error) {
        return 0;
      }
    });

    console.log('📊 العقود المنتهية قريباً:', sorted.length);
    return sorted.slice(0, 10);
  }, [legacyContracts, newContracts]);

  // آخر العقود المضافة (من الجدولين) - إصلاح الترتيب حسب التاريخ
  const recentContracts = useMemo(() => {
    const allRecent = [];

    // العقود القديمة - ترتيب حسب تاريخ العقد
    const legacyRecent = legacyContracts
      .map(contract => ({
        id: `legacy_${contract.Contract_Number}`,
        contract_number: contract.Contract_Number?.toString() || '',
        customer_name: contract['Customer Name'] || '',
        ad_type: contract['Ad Type'] || '',
        total_amount: Number(contract['Total Rent']) || 0,
        created_at: contract['Contract Date'] || '',
        date_for_sorting: new Date(contract['Contract Date'] || '1970-01-01').getTime(),
        source: 'legacy'
      }));

    // العقود الجديدة
    const newRecent = newContracts.map(contract => ({
      id: `new_${contract.id}`,
      contract_number: contract.contract_number,
      customer_name: contract.customer_name,
      ad_type: 'غير محدد',
      total_amount: Number(contract.total_amount) || 0,
      created_at: contract.created_at,
      date_for_sorting: new Date(contract.created_at).getTime(),
      source: 'new'
    }));

    allRecent.push(...legacyRecent, ...newRecent);

    // ترتيب حسب التاريخ (الأحدث أولاً)
    const sorted = allRecent.sort((a, b) => b.date_for_sorting - a.date_for_sorting);

    console.log('📋 آخر العقود المضافة (مرتبة):', sorted.slice(0, 5).map(c => ({
      contract: c.contract_number,
      customer: c.customer_name,
      date: c.created_at,
      source: c.source
    })));

    return sorted.slice(0, 5);
  }, [legacyContracts, newContracts]);

  // آخر المدفوعات (الواصلات) - ترتيب حسب تاريخ الإنشاء
  const recentPayments = useMemo(() => {
    const filteredPayments = payments
      .filter(p => p.entry_type === 'receipt' || p.entry_type === 'account_payment')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    console.log('💰 آخر المدفوعات (مرتبة):', filteredPayments.slice(0, 5).map(p => ({
      customer: p.customer_name,
      amount: p.amount,
      date: p.created_at
    })));

    return filteredPayments.slice(0, 5);
  }, [payments]);

  // آخر اللوحات المضافة - ترتيب حسب تاريخ الإنشاء
  const recentBillboards = useMemo(() => {
    const sortedBillboards = billboards
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    console.log('📺 آخر اللوحات (مرتبة):', sortedBillboards.slice(0, 5).map(b => ({
      name: b.Billboard_Name,
      municipality: b.Municipality,
      date: b.created_at
    })));

    return sortedBillboards.slice(0, 5);
  }, [billboards]);

  // حساب الأيام المتبقية
  const getDaysLeft = (endDate: string) => {
    try {
      const today = new Date();
      const end = new Date(endDate);
      return differenceInDays(end, today);
    } catch (error) {
      return 0;
    }
  };

  // تحديد لون البادج حسب الأيام المتبقية
  const getExpiryBadgeColor = (daysLeft: number) => {
    if (daysLeft <= 3) return 'bg-red-500 text-white';
    if (daysLeft <= 7) return 'bg-orange-500 text-white';
    if (daysLeft <= 15) return 'bg-yellow-500 text-black';
    return 'bg-green-500 text-white';
  };

  // تنسيق التاريخ بأمان
  const formatDateSafe = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: ar });
    } catch (error) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="expenses-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل بيانات الإدارة...</p>
          <p className="text-xs text-muted-foreground mt-2">يرجى فتح وحدة التحكم (F12) لمراقبة عملية التحميل</p>
        </div>
      </div>
    );
  }

  return (
    <div className="expenses-container">
      {/* العنوان الرئيسي */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">لوحة الإدارة</h1>
          <p className="text-muted-foreground">نظرة شاملة على آخر التحديثات والعقود المهمة</p>
        </div>
        <Button onClick={loadData} variant="outline" disabled={loading}>
          تحديث البيانات
        </Button>
      </div>

      {/* إحصائيات سريعة */}
      <div className="expenses-stats-grid">
        <Card className="expenses-stat-card">
          <div className="expenses-stat-content">
            <div>
              <p className="expenses-stat-text">إجمالي العقود</p>
              <p className="expenses-stat-value">{legacyContracts.length + newContracts.length}</p>
            </div>
            <FileText className="expenses-stat-icon stat-blue" />
          </div>
        </Card>
        
        <Card className="expenses-stat-card">
          <div className="expenses-stat-content">
            <div>
              <p className="expenses-stat-text">العقود المنتهية قريباً</p>
              <p className="expenses-stat-value stat-red">{expiringContracts.length}</p>
            </div>
            <Clock className="expenses-stat-icon stat-red" />
          </div>
        </Card>
        
        <Card className="expenses-stat-card">
          <div className="expenses-stat-content">
            <div>
              <p className="expenses-stat-text">إجمالي المدفوعات</p>
              <p className="expenses-stat-value">{payments.length}</p>
            </div>
            <Receipt className="expenses-stat-icon stat-green" />
          </div>
        </Card>
        
        <Card className="expenses-stat-card">
          <div className="expenses-stat-content">
            <div>
              <p className="expenses-stat-text">إجمالي اللوحات</p>
              <p className="expenses-stat-value">{billboards.length}</p>
            </div>
            <Monitor className="expenses-stat-icon stat-purple" />
          </div>
        </Card>
      </div>

      {/* القوائم الرئيسية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* العقود التي تقارب على الانتهاء */}
        <Card className="expenses-preview-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="expenses-preview-title">
                <Clock className="inline-block ml-2 h-5 w-5" />
                العقود المنتهية قريباً
              </CardTitle>
              <Badge variant="destructive">{expiringContracts.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {expiringContracts.length === 0 ? (
              <div className="expenses-empty-state">
                <p>لا توجد عقود تنتهي قريباً</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expiringContracts.map((contract, index) => {
                  const daysLeft = getDaysLeft(contract.end_date);
                  return (
                    <div key={contract.id} className="expenses-preview-item">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{contract.contract_number}</p>
                          <p className="text-sm text-muted-foreground">{contract.customer_name}</p>
                          <p className="text-xs text-blue-400 font-medium">{contract.ad_type}</p>
                          <p className="text-xs text-muted-foreground">
                            ينتهي في: {formatDateSafe(contract.end_date)}
                          </p>
                        </div>
                        <div className="text-left">
                          <Badge className={getExpiryBadgeColor(daysLeft)}>
                            {daysLeft === 0 ? 'ينتهي اليوم' : `${daysLeft} يوم`}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {contract.total_amount.toLocaleString()} د.ل
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* آخر العقود المضافة */}
        <Card className="expenses-preview-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="expenses-preview-title">
                <FileText className="inline-block ml-2 h-5 w-5" />
                آخر 5 عقود مضافة
              </CardTitle>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 ml-1" />
                إضافة عقد
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentContracts.length === 0 ? (
              <div className="expenses-empty-state">
                <p>لا توجد عقود مضافة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentContracts.map((contract, index) => (
                  <div key={contract.id} className="expenses-preview-item">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{contract.contract_number}</p>
                        <p className="text-sm text-muted-foreground">{contract.customer_name}</p>
                        <p className="text-xs text-blue-400 font-medium">{contract.ad_type}</p>
                        <p className="text-xs text-muted-foreground">
                          أضيف في: {formatDateSafe(contract.created_at)}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="expenses-amount-calculated">
                          {contract.total_amount?.toLocaleString() || 0} د.ل
                        </p>
                        <Badge variant={contract.source === 'new' ? 'default' : 'secondary'}>
                          {contract.source === 'new' ? 'جديد' : 'قديم'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* آخر المدفوعات المضافة */}
        <Card className="expenses-preview-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="expenses-preview-title">
                <Receipt className="inline-block ml-2 h-5 w-5" />
                آخر 5 مدفوعات مضافة
              </CardTitle>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 ml-1" />
                إضافة دفعة
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <div className="expenses-empty-state">
                <p>لا توجد مدفوعات مضافة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentPayments.map((payment, index) => (
                  <div key={`payment-${payment.id}-${index}`} className="expenses-preview-item">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{payment.customer_name}</p>
                        <p className="text-sm text-muted-foreground">
                          نوع الدفعة: {payment.entry_type === 'receipt' ? 'إيصال' : 'دفعة حساب'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          تاريخ الدفع: {formatDateSafe(payment.paid_at)}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="expenses-amount-calculated">
                          {payment.amount?.toLocaleString() || 0} د.ل
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateSafe(payment.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* آخر اللوحات المضافة */}
        <Card className="expenses-preview-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="expenses-preview-title">
                <Monitor className="inline-block ml-2 h-5 w-5" />
                آخر 5 لوحات مضافة
              </CardTitle>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 ml-1" />
                إضافة لوحة
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentBillboards.length === 0 ? (
              <div className="expenses-empty-state">
                <p>لا توجد لوحات مضافة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentBillboards.map((billboard, index) => (
                  <div key={`billboard-${billboard.id}-${index}`} className="expenses-preview-item">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{billboard.Billboard_Name}</p>
                        <p className="text-sm text-muted-foreground">{billboard.Municipality}</p>
                        <p className="text-xs text-muted-foreground">
                          أضيفت في: {formatDateSafe(billboard.created_at)}
                        </p>
                      </div>
                      <div className="text-left">
                        <Badge variant="outline" className="mb-1">
                          {billboard.Size}
                        </Badge>
                        <p className="text-xs text-muted-foreground">مستوى {billboard.Level}</p>
                        <Badge variant={billboard.Status === 'متاح' ? 'default' : 'secondary'}>
                          {billboard.Status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* أزرار الإجراءات السريعة */}
      <Card className="expenses-preview-card">
        <CardHeader>
          <CardTitle className="expenses-preview-title">الإجراءات السريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="expenses-actions">
            <Button className="expenses-action-btn">
              <Plus className="h-4 w-4" />
              إضافة عقد جديد
            </Button>
            <Button variant="outline" className="expenses-action-btn">
              <Receipt className="h-4 w-4" />
              إضافة دفعة جديدة
            </Button>
            <Button variant="outline" className="expenses-action-btn">
              <Monitor className="h-4 w-4" />
              إضافة لوحة جديدة
            </Button>
            <Button variant="outline" className="expenses-action-btn">
              <Eye className="h-4 w-4" />
              عرض التقارير
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}