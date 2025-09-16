import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getPriceFor, CustomerType, CUSTOMERS } from '@/data/pricing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { Plus, Eye, Edit, Trash2, Calendar, User, DollarSign, Search, Filter, Building, AlertCircle, Clock, CheckCircle, Printer } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createContract,
  getContracts,
  getContractWithBillboards,
  getAvailableBillboards,
  updateContract,
  deleteContract,
  addBillboardsToContract,
  removeBillboardFromContract,
  Contract,
  ContractCreate
} from '@/services/contractService';
import { Billboard } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { ContractPDFDialog } from '@/components/Contract';

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [availableBillboards, setAvailableBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [selectedContractForPDF, setSelectedContractForPDF] = useState<any>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');

  const [customersList, setCustomersList] = useState<{id:string; name:string}[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignContractNumber, setAssignContractNumber] = useState<string | null>(null);
  const [assignCustomerId, setAssignCustomerId] = useState<string | null>(null);

  const [formData, setFormData] = useState<ContractCreate>({
    customer_name: '',
    ad_type: '',
    start_date: '',
    end_date: '',
    rent_cost: 0,
    billboard_ids: []
  });
  const [pricingCategory, setPricingCategory] = useState<CustomerType>('عادي');
  const [durationMonths, setDurationMonths] = useState<number>(3);

  const [bbSearch, setBbSearch] = useState('');
  const [editBbSearch, setEditBbSearch] = useState('');

  const loadData = async () => {
    try {
      const contractsData = await getContracts();
      const billboardsData = await getAvailableBillboards();
      setContracts(contractsData as Contract[]);
      setAvailableBillboards(billboardsData || []);
      // load customers list
      try {
        const { data: cdata, error: cErr } = await supabase.from('customers').select('id,name').order('name', { ascending: true });
        if (!cErr && Array.isArray(cdata)) setCustomersList(cdata as any);
      } catch (e) {
        console.warn('failed to load customers list', e);
      }
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // احسب تاريخ النهاية تلقائياً حسب المدة المختارة
  useEffect(() => {
    if (!formData.start_date || !durationMonths) return;
    const d = new Date(formData.start_date);
    if (isNaN(d.getTime())) return;
    const end = new Date(d);
    end.setMonth(end.getMonth() + durationMonths);
    setFormData(prev => ({ ...prev, end_date: end.toISOString().split('T')[0] }));
  }, [formData.start_date, durationMonths]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cn = params.get('contract');
    if (cn && !viewOpen) {
      handleViewContract(String(cn));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const handleCreateContract = async () => {
    try {
      if (!formData.customer_name || !formData.start_date || !formData.end_date || formData.billboard_ids.length === 0) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      await createContract(formData);
      toast.success('تم إنشاء العقد بنجا��');
      setCreateOpen(false);
      setFormData({
        customer_name: '',
        ad_type: '',
        start_date: '',
        end_date: '',
        rent_cost: 0,
        billboard_ids: []
      });
      loadData();
    } catch (error) {
      console.error('خطأ في إنشاء العقد:', error);
      toast.error('فشل في إنشاء العقد');
    }
  };

  const handleViewContract = async (contractId: string) => {
    try {
      const contractWithBillboards = await getContractWithBillboards(contractId);
      setSelectedContract(contractWithBillboards);
      setViewOpen(true);
    } catch (error) {
      console.error('خطأ في جلب تفاصيل العقد:', error);
      toast.error('فشل في جلب تفاصيل العقد');
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا العقد؟')) {
      try {
        await deleteContract(contractId);
        toast.success('تم حذف العقد بنجاح');
        loadData();
      } catch (error) {
        console.error('خطأ في حذف العقد:', error);
        toast.error('فشل في حذف العقد');
      }
    }
  };

  const openAssignDialog = (contractNumber: string, currentCustomerId?: string | null) => {
    setAssignContractNumber(contractNumber);
    setAssignCustomerId(currentCustomerId ?? null);
    setAssignOpen(true);
  };

  const saveAssign = async () => {
    if (!assignContractNumber || !assignCustomerId) {
      toast.error('اختر زبونًا ثم احفظ');
      return;
    }
    const customer = customersList.find(c => c.id === assignCustomerId);
    try {
      await updateContract(assignContractNumber, { customer_id: assignCustomerId, 'Customer Name': customer?.name || '' });
      toast.success('تم تحديث العميل للعقد');
      setAssignOpen(false);
      setAssignContractNumber(null);
      setAssignCustomerId(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('فشل تحديث العقد');
    }
  };

  const handlePrintContract = async (contract: Contract) => {
    try {
      const contractWithBillboards = await getContractWithBillboards(String(contract.id));
      setSelectedContractForPDF(contractWithBillboards);
      setPdfOpen(true);
    } catch (error) {
      console.error('خطأ في جلب تفاصيل العقد للطباعة:', error);
      toast.error('فشل في جلب تفاصيل العقد');
    }
  };

  const getContractStatus = (contract: Contract) => {
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    const startDate = new Date(contract.start_date || '');
    
    if (!contract.end_date || !contract.start_date) {
      return <Badge variant="secondary">غير محدد</Badge>;
    }
    
    if (today < startDate) {
      return <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        لم يبدأ
      </Badge>;
    } else if (today > endDate) {
      return <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        منتهي
      </Badge>;
    } else {
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 30) {
        return <Badge className="bg-warning text-warning-foreground border-warning gap-1">
          <Clock className="h-3 w-3" />
          ينتهي قريباً ({daysRemaining} أيام)
        </Badge>;
      }
      return <Badge className="bg-success text-success-foreground border-success gap-1">
        <CheckCircle className="h-3 w-3" />
        نشط
      </Badge>;
    }
  };

  // تصفية العقود
  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = 
      contract.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ((contract as any)['Ad Type'] || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(contract.id || '').includes(searchQuery);

    const matchesCustomer = customerFilter === 'all' || contract.customer_name === customerFilter;
    
    if (statusFilter === 'all') return matchesSearch && matchesCustomer;
    
    const today = new Date();
    const endDate = new Date(contract.end_date || '');
    const startDate = new Date(contract.start_date || '');
    
    if (!contract.end_date || !contract.start_date) return false;
    
    let matchesStatus = false;
    if (statusFilter === 'active') {
      matchesStatus = today >= startDate && today <= endDate;
    } else if (statusFilter === 'expired') {
      matchesStatus = today > endDate;
    } else if (statusFilter === 'upcoming') {
      matchesStatus = today < startDate;
    } else if (statusFilter === 'expiring') {
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      matchesStatus = daysRemaining <= 30 && daysRemaining > 0;
    }

    return matchesSearch && matchesCustomer && matchesStatus;
  });

  // تقسيم العقود حسب الحالة
  const contractStats = {
    total: contracts.length,
    active: contracts.filter(c => {
      if (!c.end_date || !c.start_date) return false;
      const today = new Date();
      const endDate = new Date(c.end_date);
      const startDate = new Date(c.start_date);
      return today >= startDate && today <= endDate;
    }).length,
    expired: contracts.filter(c => {
      if (!c.end_date) return false;
      return new Date() > new Date(c.end_date);
    }).length,
    expiring: contracts.filter(c => {
      if (!c.end_date) return false;
      const today = new Date();
      const endDate = new Date(c.end_date);
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysRemaining <= 30 && daysRemaining > 0;
    }).length
  };

  const uniqueCustomers = [...new Set(contracts.map(c => c.customer_name))].filter(Boolean);

  const filteredAvailable = availableBillboards.filter((b) => {
    const q = bbSearch.trim().toLowerCase();
    if (!q) return true;
    return [b.name, b.location, b.size, (b as any).city]
      .some((v) => String(v || '').toLowerCase().includes(q));
  });

  const selectedBillboardsDetails = (formData.billboard_ids
    .map((id) => availableBillboards.find((b) => b.id === id))
    .filter(Boolean)) as Billboard[];

  // حساب التكلفة التقديرية حسب باقات الأسعار والفئة
  const estimatedTotal = useMemo(() => {
    const months = Number(durationMonths || 0);
    if (!months) return 0;
    return selectedBillboardsDetails.reduce((acc, b) => {
      const size = (b.size || (b as any).Size || '') as string;
      const level = (b.level || (b as any).Level) as any;
      const price = getPriceFor(size, level, pricingCategory as CustomerType, months);
      if (price !== null) return acc + price;
      const monthly = Number((b as any).price) || 0;
      return acc + monthly * months;
    }, 0);
  }, [selectedBillboardsDetails, durationMonths, pricingCategory]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, rent_cost: estimatedTotal }));
  }, [estimatedTotal]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل العقود...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* العنوان والأزرار */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة العقود</h1>
          <p className="text-muted-foreground">إنشاء وإدارة عقود الإيجار مع اللوحات الإعلانية</p>
        </div>
        <div className="flex gap-2">
          <Button
            className="bg-gradient-primary text-white shadow-elegant hover:shadow-glow transition-smooth"
            onClick={() => navigate('/admin/contracts/new')}
          >
            <Plus className="h-4 w-4 ml-2" />
            إنشاء عقد جديد
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                // جلب جميع اللوحات
                const { fetchAllBillboards } = await import('@/services/supabaseService');
                const rows: any[] = await fetchAllBillboards();
                if (!rows || rows.length === 0) {
                  toast.warning('لا توجد لوحات للطباعة');
                  return;
                }

                // تطبيع الحقول
                const norm = (b: any) => {
                  const id = String(b.ID ?? b.id ?? '');
                  const image = String(b.image ?? b.Image ?? b.billboard_image ?? b.Image_URL ?? b['@IMAGE'] ?? b.image_url ?? b.imageUrl ?? '');
                  const municipality = String(b.Municipality ?? b.municipality ?? '');
                  const district = String(b.District ?? b.district ?? '');
                  const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? '');
                  const size = String(b.Size ?? b.size ?? '');
                  const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? '');
                  const priceVal = b.Price ?? b.rent ?? b.Rent_Price ?? b.price ?? b.rent_cost ?? b['Total Rent'];
                  const priceNum = typeof priceVal === 'number' ? priceVal : Number(String(priceVal || '').replace(/[^\d.]/g, '')) || 0;
                  const price = priceNum ? `${priceNum.toLocaleString('ar-LY')} د.ل` : '';
                  let coords: string = String(b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? '');
                  if (!coords || coords === 'undefined' || coords === 'null') {
                    const lat = b.Latitude ?? b.lat ?? b.latitude;
                    const lng = b.Longitude ?? b.lng ?? b.longitude;
                    if (lat != null && lng != null) coords = `${lat},${lng}`;
                  }
                  const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';
                  return { id, image, municipality, district, landmark, size, faces, price, priceNum, mapLink };
                };

                const normalized = rows.map(norm);
                const total = normalized.reduce((s, r) => s + (r.priceNum || 0), 0);
                const ROWS_PER_PAGE = 12;
                const pages = normalized.reduce((acc: any[][], r, i) => {
                  const p = Math.floor(i / ROWS_PER_PAGE); (acc[p] ||= []).push(r); return acc;
                }, [] as any[][]);

                const tablePagesHtml = pages.map((pageRows, idx) => `
                  <div class="template-container page">
                    <img src="/bgc2.jpg" alt="خلفية جدول اللوحات" class="template-image" />
                    <div class="table-area">
                      <table class="btable" dir="rtl">
                        <colgroup>
                          <col style="width:8%" />
                          <col style="width:14%" />
                          <col style="width:12%" />
                          <col style="width:12%" />
                          <col style="width:18%" />
                          <col style="width:10%" />
                          <col style="width:8%" />
                          <col style="width:10%" />
                          <col style="width:8%" />
                        </colgroup>
                        <tbody>
                          ${pageRows.map((r:any) => `
                            <tr>
                              <td class="c-num">${r.id}</td>
                              <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" />` : ''}</td>
                              <td>${r.municipality}</td>
                              <td>${r.district}</td>
                              <td>${r.landmark}</td>
                              <td>${r.size}</td>
                              <td>${r.faces}</td>
                              <td>${r.price}</td>
                              <td>${r.mapLink ? `<a href="${r.mapLink}" target="_blank" rel="noopener">اضغط هنا</a>` : ''}</td>
                            </tr>`).join('')}
                        </tbody>
                      </table>
                      ${idx === pages.length - 1 ? `<div class="summary">الإجمالي: ${total.toLocaleString('ar-LY')} د.ل</div>` : ''}
                    </div>
                  </div>
                `).join('');

                const html = `
                  <!DOCTYPE html>
                  <html dir="rtl" lang="ar">
                  <head>
                    <meta charset="UTF-8" />
                    <title>عرض عقد - جميع اللوحات</title>
                    <style>
                      *{margin:0;padding:0;box-sizing:border-box}
                      body{font-family:'Noto Sans Arabic',Arial,sans-serif;background:#fff;color:#000}
                      .template-container{position:relative;width:210mm;height:297mm;page-break-after:always;overflow:hidden}
                      .template-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1}
                      .table-area{position:absolute;right:20mm;left:20mm;top:80mm;bottom:32mm;z-index:20}
                      .btable{width:100%;border-collapse:collapse;font-size:12pt}
                      .btable td{border:1px solid #000;padding:4pt 3pt;vertical-align:middle}
                      .c-img img{width:38mm;height:22mm;object-fit:cover;display:block;margin:0 auto}
                      .c-num{text-align:center;font-weight:700}
                      .btable a{color:#004aad;text-decoration:none}
                      .summary{position:absolute;left:20mm;bottom:12mm;font-size:14pt;font-weight:700}
                      @page{size:A4;margin:0}
                      @media print{.controls{display:none}}
                      .controls{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99}
                      .controls button{padding:8px 14px;border:0;border-radius:6px;background:#0066cc;color:#fff;cursor:pointer}
                    </style>
                  </head>
                  <body>
                    ${tablePagesHtml}
                    <div class="controls"><button onclick="window.print()">طباعة</button></div>
                  </body>
                  </html>`;

                const w = window.open('', '_blank');
                if (!w) { toast.error('فشل فتح نافذة الطباعة'); return; }
                w.document.write(html); w.document.close(); w.focus();
                setTimeout(() => w.print(), 600);
              } catch (e) {
                console.error(e);
                toast.error('فشل في عرض العقد');
              }
            }}
          >
            عرض عقد
          </Button>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-card border-0 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي العقود</p>
                <p className="text-2xl font-bold text-foreground">{contractStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-success/10 rounded-lg">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">عقود نشطة</p>
                <p className="text-2xl font-bold text-success">{contractStats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-warning/10 rounded-lg">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">قريبة الانتهاء</p>
                <p className="text-2xl font-bold text-warning">{contractStats.expiring}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-destructive/10 rounded-lg">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">عقود منتهية</p>
                <p className="text-2xl font-bold text-destructive">{contractStats.expired}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* البحث والفلاتر */}
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            البحث والتصفية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث في العق��د..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="حالة العقد" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="active">نشطة</SelectItem>
                <SelectItem value="expiring">قريبة الانتهاء</SelectItem>
                <SelectItem value="expired">منتهية</SelectItem>
                <SelectItem value="upcoming">لم تبدأ</SelectItem>
              </SelectContent>
            </Select>

            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger>
                <SelectValue placeholder="العميل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع العملاء</SelectItem>
                {uniqueCustomers.map(customer => (
                  <SelectItem key={customer} value={customer}>
                    {customer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* جدول العقود */}
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            قائمة العقود ({filteredContracts.length} من {contracts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الزبون</TableHead>
                  <TableHead>نوع الإعلان</TableHead>
                  <TableHead>تاريخ البداية</TableHead>
                  <TableHead>تاريخ النهاية</TableHead>
                  <TableHead>التكلفة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map((contract) => (
                  <TableRow key={contract.id} className="hover:bg-card/50 transition-colors">
                    <TableCell className="font-medium">{contract.customer_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <Building className="h-3 w-3" />
                        {(contract as any)['Ad Type'] || 'غير محدد'}
                      </Badge>
                    </TableCell>
                    <TableCell>{contract.start_date ? new Date(contract.start_date).toLocaleDateString('ar') : '—'}</TableCell>
                    <TableCell>{contract.end_date ? new Date(contract.end_date).toLocaleDateString('ar') : '—'}</TableCell>
                    <TableCell className="font-semibold text-primary">
                      {(contract.rent_cost || 0).toLocaleString()} د.ل
                    </TableCell>
                    <TableCell>{getContractStatus(contract)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/contracts/view?contract=${String(contract.id)}`)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/contracts/edit?contract=${String(contract.id)}`)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openAssignDialog(String((contract as any).Contract_Number ?? contract.id), (contract as any).customer_id ?? null)}
                          className="h-8 px-2"
                        >
                          تعيين زبون
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteContract(String(contract.id))}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePrintContract(contract)}
                          className="h-8 px-2 gap-1"
                        >
                          <Printer className="h-4 w-4" />
                          طباعة
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredContracts.length === 0 && contracts.length > 0 && (
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد نتائج</h3>
              <p className="text-muted-foreground">لم يتم العثور على عقود تطابق معايير البحث</p>
            </div>
          )}

          {contracts.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد عقود</h3>
              <p className="text-muted-foreground">ابدأ بإنشاء عقد جديد</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* مودال عرض تفاصيل العقد */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>تفاصيل العقد</DialogTitle>
          </DialogHeader>
          
          {selectedContract && (
            <div className="space-y-6">
              {/* معلومات العقد */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5" />
                      معلومات الزبون
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p><strong>الاسم:</strong> {selectedContract.customer_name}</p>
                      <p><strong>نوع الإعلان:</strong> {selectedContract.ad_type || '—'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      تفاصيل العقد
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p><strong>تار  خ البداية:</strong> {selectedContract.start_date ? new Date(selectedContract.start_date).toLocaleDateString('ar') : '—'}</p>
                      <p><strong>تاريخ النهاية:</strong> {selectedContract.end_date ? new Date(selectedContract.end_date).toLocaleDateString('ar') : '—'}</p>
                      <p><strong>التكلفة الإجمالية:</strong> {(selectedContract.rent_cost || 0).toLocaleString()} د.ل</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* اللوحات المرتبطة */}
              {selectedContract.billboards && selectedContract.billboards.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">اللوحات المرتبطة ({selectedContract.billboards.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedContract.billboards.map((billboard: any) => (
                        <Card key={billboard.ID || billboard.id} className="border">
                          <CardContent className="p-4 flex items-center justify-between gap-3">
                            <div>
                              <h4 className="font-semibold">{billboard.Billboard_Name || billboard.name}</h4>
                              <p className="text-sm text-muted-foreground">{billboard.Nearest_Landmark || billboard.location}</p>
                              <p className="text-sm">الحجم: {billboard.Size || billboard.size}</p>
                              <p className="text-sm">المدينة: {billboard.City || billboard.city}</p>
                            </div>
                            <div className="text-xs text-muted-foreground">ضمن العقد</div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign customer dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعيين زبون للعقد {assignContractNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-2">
            <Select value={assignCustomerId || '__none'} onValueChange={(v) => setAssignCustomerId(v === '__none' ? null : v)}>
              <SelectTrigger><SelectValue placeholder="اختر زبون" /></SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="__none">اختيار</SelectItem>
                {customersList.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setAssignOpen(false); setAssignCustomerId(null); setAssignContractNumber(null); }}>إلغاء</Button>
              <Button onClick={saveAssign}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Dialog */}
      <ContractPDFDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        contract={selectedContractForPDF}
      />
    </div>
  );
}
