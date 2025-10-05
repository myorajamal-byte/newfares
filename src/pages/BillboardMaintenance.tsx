import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Wrench, Search, Plus, Calendar, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Clock, Settings, FileText, Printer, Download, Filter } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Billboard {
  ID: number;
  Billboard_Name: string;
  Nearest_Landmark: string;
  District: string;
  Municipality: string;
  Size: string;
  Status: string;
  maintenance_status: string;
  maintenance_date: string | null;
  maintenance_notes: string | null;
  maintenance_type: string | null;
  maintenance_cost: number | null;
  next_maintenance_date: string | null;
  maintenance_priority: string;
  Image_URL: string | null;
  GPS_Link: string | null;
}

interface MaintenanceRecord {
  id: string;
  billboard_id: number;
  maintenance_type: string;
  maintenance_date: string;
  description: string;
  cost: number | null;
  technician_name: string | null;
  status: string;
  priority: string;
  billboard?: {
    Billboard_Name: string;
    Nearest_Landmark: string;
  };
}

export default function BillboardMaintenance() {
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedBillboard, setSelectedBillboard] = useState<Billboard | null>(null);
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    type: '',
    description: '',
    cost: '',
    technician: '',
    priority: 'normal',
    scheduledDate: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // تحميل اللوحات التي تحتاج صيانة فقط
      const { data: billboardsData, error: billboardsError } = await supabase
        .from('billboards')
        .select('*')
        .in('maintenance_status', ['maintenance', 'repair_needed', 'out_of_service'])
        .order('Billboard_Name');

      if (billboardsError) throw billboardsError;

      // تحميل سجل الصيانة
      const { data: historyData, error: historyError } = await supabase
        .from('maintenance_history')
        .select(`
          *,
          billboard:billboards!billboard_id(Billboard_Name, Nearest_Landmark)
        `)
        .order('maintenance_date', { ascending: false });

      if (historyError) throw historyError;

      setBillboards(billboardsData || []);
      setMaintenanceHistory(historyData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "خطأ في تحميل البيانات",
        description: "تعذر تحميل بيانات الصيانة",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      operational: { label: 'تعمل بشكل طبيعي', variant: 'default' as const, className: 'text-green bg-green-100' },
      maintenance: { label: 'قيد الصيانة', variant: 'secondary' as const, className: 'text-yellow bg-yellow-100' },
      repair_needed: { label: 'تحتاج إصلاح', variant: 'destructive' as const, className: 'text-red bg-red-100' },
      out_of_service: { label: 'خارج الخدمة', variant: 'outline' as const, className: 'text-red bg-red-100' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.operational;
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { label: 'منخفضة', className: 'text-blue bg-blue-100' },
      normal: { label: 'عادية', className: 'text-green bg-green-100' },
      high: { label: 'عالية', className: 'text-orange bg-orange-100' },
      urgent: { label: 'عاجلة', className: 'text-red bg-red-100' }
    };

    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.normal;
    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const handleMaintenanceSubmit = async () => {
    if (!selectedBillboard || !maintenanceForm.type || !maintenanceForm.description) {
      toast({
        title: "بيانات ناقصة",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    try {
      // إضافة سجل صيانة جديد
      const { error: historyError } = await supabase
        .from('maintenance_history')
        .insert({
          billboard_id: selectedBillboard.ID,
          maintenance_type: maintenanceForm.type,
          description: maintenanceForm.description,
          cost: maintenanceForm.cost ? parseFloat(maintenanceForm.cost) : null,
          technician_name: maintenanceForm.technician || null,
          priority: maintenanceForm.priority,
          maintenance_date: maintenanceForm.scheduledDate || new Date().toISOString()
        });

      if (historyError) throw historyError;

      // تحديث حالة اللوحة
      const newStatus = maintenanceForm.type === 'إصلاح' ? 'repair_needed' : 'maintenance';
      const { error: updateError } = await supabase
        .from('billboards')
        .update({
          maintenance_status: newStatus,
          maintenance_date: new Date().toISOString(),
          maintenance_notes: maintenanceForm.description,
          maintenance_type: maintenanceForm.type,
          maintenance_cost: maintenanceForm.cost ? parseFloat(maintenanceForm.cost) : null,
          maintenance_priority: maintenanceForm.priority
        })
        .eq('ID', selectedBillboard.ID);

      if (updateError) throw updateError;

      toast({
        title: "تم بنجاح",
        description: "تم إضافة سجل الصيانة وتحديث حالة اللوحة"
      });

      setIsMaintenanceDialogOpen(false);
      setMaintenanceForm({
        type: '',
        description: '',
        cost: '',
        technician: '',
        priority: 'normal',
        scheduledDate: ''
      });
      loadData();
    } catch (error) {
      console.error('Error submitting maintenance:', error);
      toast({
        title: "خطأ في الحفظ",
        description: "تعذر حفظ بيانات الصيانة",
        variant: "destructive"
      });
    }
  };

  const handleStatusChange = async (billboardId: number, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('billboards')
        .update({ 
          maintenance_status: newStatus,
          maintenance_date: new Date().toISOString()
        })
        .eq('ID', billboardId);

      if (error) throw error;

      toast({
        title: "تم التحديث",
        description: "تم تحديث حالة اللوحة بنجاح"
      });

      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "خطأ في التحديث",
        description: "تعذر تحديث حالة اللوحة",
        variant: "destructive"
      });
    }
  };

  // ✅ تقرير طباعة محسن مطابق لتقارير العقود
  const printMaintenanceReport = () => {
    const filteredBillboards = getFilteredBillboards();

    if (filteredBillboards.length === 0) {
      toast({
        title: 'لا توجد بيانات للطباعة',
        description: 'يرجى التأكد من توفر لوحات ضمن نتائج الصيانة قبل الطباعة.',
        variant: 'destructive',
      });
      return;
    }

    const normalizeBoard = (board: Billboard) => {
      const id = String(board.ID ?? '').trim();
      const name = board.Billboard_Name?.trim() || (id ? `لوحة ${id}` : 'لوحة غير معروفة');
      const image = board.Image_URL?.trim() || '';
      const municipality = board.Municipality?.trim() || '';
      const district = board.District?.trim() || '';
      const landmark = board.Nearest_Landmark?.trim() || '';
      const size = board.Size?.trim() || '';
      const rawFaces =
        (board as Record<string, unknown>).Faces ??
        (board as Record<string, unknown>)['Number_of_Faces'] ??
        '';
      const maintenanceType = board.maintenance_type?.trim() || '';
      const faces = String(rawFaces ?? '').trim() || maintenanceType;
      let coords = String(
        (board as Record<string, unknown>).GPS_Coordinates ??
          board.GPS_Link ??
          (board as Record<string, unknown>).GPS ??
          '',
      ).trim();

      if (coords && coords !== 'null' && coords !== 'undefined') {
        if (!coords.startsWith('http')) {
          coords = `https://www.google.com/maps?q=${encodeURIComponent(coords)}`;
        }
      } else {
        const lat = (board as Record<string, unknown>).Latitude ?? (board as Record<string, unknown>).lat;
        const lng = (board as Record<string, unknown>).Longitude ?? (board as Record<string, unknown>).lng;
        if (lat != null && lng != null) {
          coords = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
        } else {
          coords = '';
        }
      }

      const maintenanceStatus = board.maintenance_status === 'maintenance'
        ? 'قيد الصيانة'
        : board.maintenance_status === 'repair_needed'
          ? 'تحتاج إصلاح'
          : board.maintenance_status === 'out_of_service'
            ? 'خارج الخدمة'
            : 'غير محدد';

      const priorityLabel = board.maintenance_priority === 'low'
        ? 'منخفضة'
        : board.maintenance_priority === 'normal'
          ? 'عادية'
          : board.maintenance_priority === 'high'
            ? 'عالية'
            : board.maintenance_priority === 'urgent'
              ? 'عاجلة'
              : 'غير محدد';

      const lastMaintenanceDate = board.maintenance_date
        ? new Date(board.maintenance_date).toLocaleDateString('ar-LY')
        : '';

      return {
        id,
        name,
        image,
        municipality,
        district,
        landmark,
        size,
        faces,
        status: maintenanceStatus,
        priority: priorityLabel,
        lastMaintenanceDate,
        mapLink: coords,
      };
    };

    const normalizedBoards = filteredBillboards.map(normalizeBoard);
    type NormalizedBoard = (typeof normalizedBoards)[number];

    const START_Y = 63.53;
    const ROW_H = 13.818;
    const PAGE_H = 297;
    const ROWS_PER_PAGE = Math.max(1, Math.floor((PAGE_H - START_Y) / ROW_H));

    const tablePagesHtml = normalizedBoards
      .reduce((pages: NormalizedBoard[][], row, index) => {
        const pageIndex = Math.floor(index / ROWS_PER_PAGE);
        if (!pages[pageIndex]) pages[pageIndex] = [];
        pages[pageIndex].push(row);
        return pages;
      }, [] as NormalizedBoard[][])
      .map(
        (pageRows) => `
              <div class="template-container page">
                <img src="/bgc2.svg" alt="خلفية جدول اللوحات" class="template-image" onerror="console.warn('Failed to load bgc2.svg')" />
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:50mm" />
                      <col style="width:20mm" />
                      <col style="width:20mm" />
                      <col style="width:22mm" />
                    </colgroup>
                    <tbody>
                      ${pageRows
                        .map(
                          (row) => `
                          <tr>
                            <td class="c-name">${row.name || row.id}</td>
                            <td class="c-img">${
                              row.image
                                ? `<img src="${row.image}" alt="صورة اللوحة" onerror="this.style.display='none'" />`
                                : ''
                            }</td>
                            <td>${row.municipality}</td>
                            <td>${row.district}</td>
                            <td>${row.landmark}</td>
                            <td>${row.size || '-'}${row.status ? `<div class="cell-sub">${row.status}</div>` : ''}</td>
                            <td>${row.priority}${row.faces ? `<div class="cell-sub">${row.faces}</div>` : ''}</td>
                            <td>${row.mapLink
                              ? `<a href="${row.mapLink}" target="_blank" rel="noopener">الخريطة</a>${
                                  row.lastMaintenanceDate
                                    ? `<div class="cell-sub">${row.lastMaintenanceDate}</div>`
                                    : ''
                                }`
                              : row.lastMaintenanceDate}
                            </td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `,
      )
      .join('');

    const html = `<!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>تقرير صيانة اللوحات</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; font-style: normal; font-display: swap; }
            @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; font-style: normal; font-display: swap; }
            * { margin: 0 !important; padding: 0 !important; box-sizing: border-box; }
            html, body { width: 100% !important; height: 100% !important; overflow: hidden; font-family: 'Noto Sans Arabic','Doran','Arial Unicode MS',Arial,sans-serif; direction: rtl; text-align: right; background: #fff; color: #000; }
            .template-container { position: relative; width: 100vw; height: 100vh; overflow: hidden; display: block; }
            .template-image { position: absolute; inset: 0; width: 100% !important; height: 100% !important; object-fit: cover; object-position: center; z-index: 1; display: block; }
            .page { page-break-after: always; page-break-inside: avoid; }
            .table-area { position: absolute; top: 63.53mm; left: 12.8765mm; right: 12.8765mm; z-index: 20; }
            .btable { width: 100%; border-collapse: collapse; border-spacing: 0; font-size: 8px; font-family: 'Doran','Noto Sans Arabic','Arial Unicode MS',Arial,sans-serif; table-layout: fixed; border: 0.2mm solid #000; }
            .btable tr { height: 13.818mm; }
            .btable td { border: 0.2mm solid #000; padding: 0 1mm; vertical-align: middle; text-align: center; background: transparent; color: #000; white-space: normal; word-break: break-word; overflow: hidden; }
            .btable td a { color: #0047AB; text-decoration: none; }
            .cell-sub { margin-top: 2px; font-size: 7px; color: #333; }
            .c-img img { width: 100%; height: 100%; object-fit: contain; object-position: center; display: block; }
            @media print { html, body { width: 210mm !important; min-height: 297mm !important; height: auto !important; margin:0 !important; padding:0 !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .template-container { width: 210mm !important; height: 297mm !important; position: relative !important; }
              .template-image { width: 210mm !important; height: 297mm !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: A4; margin: 0 !important; padding: 0 !important; } .controls{display:none!important}
            }
            .controls{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99}
            .controls button{padding:8px 14px;border:0;border-radius:6px;background:#0066cc;color:#fff;cursor:pointer}
          </style>
        </head>
        <body>
          ${tablePagesHtml}
          <div class="controls"><button onclick="window.print()">طباعة</button></div>
        </body>
        </html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'تعذر فتح نافذة الطباعة',
        description: 'يرجى السماح بالنوافذ المنبثقة للموقع ثم المحاولة مرة أخرى.',
        variant: 'destructive',
      });
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 600);
  };

  // إزالة اللوحة من قائمة الصيانة عند تغيير حالتها إلى "تعمل بشكل طبيعي"
  const handleCompleteMaintenanceAndRemove = async (billboardId: number) => {
    try {
      const { error } = await supabase
        .from('billboards')
        .update({ 
          maintenance_status: 'operational',
          maintenance_date: new Date().toISOString()
        })
        .eq('ID', billboardId);

      if (error) throw error;

      toast({
        title: "تم إكمال الصيانة",
        description: "تم إكمال صيانة اللوحة وإزالتها من القائمة"
      });

      loadData(); // سيؤدي إلى إزالة اللوحة من القائمة تلقائياً
    } catch (error) {
      console.error('Error completing maintenance:', error);
      toast({
        title: "خطأ في التحديث",
        description: "تعذر إكمال الصيانة",
        variant: "destructive"
      });
    }
  };

  const getFilteredBillboards = () => {
    return billboards.filter(billboard => {
      const matchesSearch = 
        billboard.Billboard_Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        billboard.Nearest_Landmark?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        billboard.District?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || billboard.maintenance_status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || billboard.maintenance_priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="mr-2">جاري تحميل بيان��ت الصيانة...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const filteredBillboards = getFilteredBillboards();

  return (
    <div className="space-y-6">
      {/* رأس القسم */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Wrench className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">صيانة اللوحات الطرقية</h2>
            <p className="text-muted-foreground">إدارة ومتابعة اللوحات التي تحتاج صيانة أو بها مشاكل</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={printMaintenanceReport}>
            <Printer className="h-4 w-4" />
            طباعة التقرير
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            تصدير
          </Button>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Settings className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">قيد الصيانة</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {billboards.filter(b => b.maintenance_status === 'maintenance').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">تحتاج إصلاح</p>
                <p className="text-2xl font-bold text-red-600">
                  {billboards.filter(b => b.maintenance_status === 'repair_needed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Clock className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">خارج الخدمة</p>
                <p className="text-2xl font-bold text-gray-600">
                  {billboards.filter(b => b.maintenance_status === 'out_of_service').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* البحث والفلاتر */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث في اللوحات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="فلترة حسب الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="maintenance">قيد الصيانة</SelectItem>
                <SelectItem value="repair_needed">تحتاج إصلاح</SelectItem>
                <SelectItem value="out_of_service">خارج الخدمة</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="فلترة حسب الأولوية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأولويات</SelectItem>
                <SelectItem value="low">منخفضة</SelectItem>
                <SelectItem value="normal">عادية</SelectItem>
                <SelectItem value="high">عالية</SelectItem>
                <SelectItem value="urgent">عاجلة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* جدول اللوح��ت */}
      <Card>
        <CardHeader>
          <CardTitle>اللوحات التي تحتاج صيانة ({filteredBillboards.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">اسم اللوحة</TableHead>
                <TableHead className="text-right">الموقع</TableHead>
                <TableHead className="text-right">الحجم</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">الأولوية</TableHead>
                <TableHead className="text-right">آخر صيانة</TableHead>
                <TableHead className="text-right">التكلفة</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBillboards.map((billboard) => (
                <TableRow key={billboard.ID}>
                  <TableCell className="font-medium">
                    {billboard.Billboard_Name || `لوحة رقم ${billboard.ID}`}
                  </TableCell>
                  <TableCell>{billboard.Nearest_Landmark || billboard.District || 'غير محدد'}</TableCell>
                  <TableCell>{billboard.Size || 'غير محدد'}</TableCell>
                  <TableCell>{getStatusBadge(billboard.maintenance_status)}</TableCell>
                  <TableCell>{getPriorityBadge(billboard.maintenance_priority)}</TableCell>
                  <TableCell>
                    {billboard.maintenance_date 
                      ? new Date(billboard.maintenance_date).toLocaleDateString('ar-LY')
                      : 'لا يوجد'
                    }
                  </TableCell>
                  <TableCell>
                    {billboard.maintenance_cost 
                      ? `${billboard.maintenance_cost.toLocaleString()} د.ل`
                      : 'غير محدد'
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1"
                            onClick={() => setSelectedBillboard(billboard)}
                          >
                            <Wrench className="h-3 w-3" />
                            صيانة
                          </Button>
                        </DialogTrigger>
                      </Dialog>

                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 gap-1"
                        onClick={() => handleCompleteMaintenanceAndRemove(billboard.ID)}
                      >
                        <CheckCircle className="h-3 w-3" />
                        إكمال
                      </Button>

                      <Select
                        value={billboard.maintenance_status}
                        onValueChange={(value) => handleStatusChange(billboard.ID, value)}
                      >
                        <SelectTrigger className="h-8 w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="operational">طبيعي</SelectItem>
                          <SelectItem value="maintenance">صيانة</SelectItem>
                          <SelectItem value="repair_needed">إصلاح</SelectItem>
                          <SelectItem value="out_of_service">خارج الخدمة</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredBillboards.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد لوحات تحتاج صيانة حالياً
            </div>
          )}
        </CardContent>
      </Card>

      {/* نافذة إضافة صيانة */}
      <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة سجل صيانة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedBillboard && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedBillboard.Billboard_Name || `لوحة رقم ${selectedBillboard.ID}`}</p>
                <p className="text-sm text-muted-foreground">{selectedBillboard.Nearest_Landmark || selectedBillboard.District}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="maintenance-type">نوع الصيانة *</Label>
              <div className="flex gap-2">
                <Select
                  value={maintenanceForm.type}
                  onValueChange={(value) => setMaintenanceForm(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="اختر نوع الصيانة أو أدخل يدوياً" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="صيانة دورية">صيانة دورية</SelectItem>
                    <SelectItem value="إصلاح">إصلاح</SelectItem>
                    <SelectItem value="تنظيف">تنظيف</SelectItem>
                    <SelectItem value="استبدال قطع">استبدال قطع</SelectItem>
                    <SelectItem value="فحص">فحص</SelectItem>
                    <SelectItem value="طباعة">طباعة</SelectItem>
                    <SelectItem value="تركيب">تركيب</SelectItem>
                    <SelectItem value="دهان">دهان</SelectItem>
                    <SelectItem value="كهرباء">كهرباء</SelectItem>
                    <SelectItem value="لحام">لحام</SelectItem>
                    <SelectItem value="أخرى">أخرى</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="أو اكتب هنا..."
                  value={maintenanceForm.type}
                  onChange={(e) => setMaintenanceForm(prev => ({ ...prev, type: e.target.value }))}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">اختر من القائمة أو اكتب نوع الصيانة يدوياً</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">الوصف *</Label>
              <Textarea
                id="description"
                placeholder="وصف تفصيلي للصيانة المطلوبة..."
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">التكلفة (د.ل)</Label>
                <Input
                  id="cost"
                  type="number"
                  placeholder="0"
                  value={maintenanceForm.cost}
                  onChange={(e) => setMaintenanceForm(prev => ({ ...prev, cost: e.target.value }))}
                />
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="technician">اسم الفن��</Label>
              <Input
                id="technician"
                placeholder="اسم الفني المسؤول"
                value={maintenanceForm.technician}
                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, technician: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled-date">تاريخ الصيانة المجدولة</Label>
              <Input
                id="scheduled-date"
                type="datetime-local"
                value={maintenanceForm.scheduledDate}
                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
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
    </div>
  );
}
