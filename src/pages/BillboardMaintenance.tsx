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
import { 
  Wrench, 
  Search, 
  Plus, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Settings,
  FileText,
  Printer,
  Download,
  Filter
} from 'lucide-react';
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
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const reportHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير صيانة اللوحات الطرقية</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
          
          @page {
            size: A4;
            margin: 15mm;
          }
          
          body {
            font-family: 'Noto Sans Arabic', Arial, sans-serif;
            font-size: 11px;
            line-height: 1.3;
            color: #333;
            direction: rtl;
            text-align: right;
            margin: 0;
            padding: 0;
            background: #f8f9fa;
          }
          
          .contract-page {
            background: white;
            min-height: 100vh;
            padding: 20px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          
          .header {
            text-align: center;
            margin-bottom: 25px;
            border-bottom: 3px solid #FFD700;
            padding-bottom: 15px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 8px;
            padding: 20px;
          }
          
          .company-logo {
            width: 70px;
            height: 70px;
            margin: 0 auto 10px;
            background: linear-gradient(135deg, #FFD700, #FFA500);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
            font-weight: bold;
            box-shadow: 0 4px 8px rgba(255, 215, 0, 0.3);
          }
          
          .company-name {
            font-size: 20px;
            font-weight: bold;
            color: #333;
            margin-bottom: 6px;
          }
          
          .report-title {
            font-size: 16px;
            color: #666;
            margin-bottom: 6px;
            font-weight: 600;
          }
          
          .report-date {
            font-size: 11px;
            color: #888;
          }
          
          .billboard-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin: 20px 0;
          }
          
          .billboard-card {
            background: white;
            border: 2px solid #e9ecef;
            border-radius: 12px;
            padding: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            position: relative;
            overflow: hidden;
          }
          
          .billboard-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #FFD700, #FFA500);
          }
          
          .billboard-image {
            width: 100%;
            height: 120px;
            object-fit: cover;
            border-radius: 8px;
            margin-bottom: 10px;
            border: 2px solid #e9ecef;
          }
          
          .billboard-placeholder {
            width: 100%;
            height: 120px;
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            border-radius: 8px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6c757d;
            font-size: 12px;
            border: 2px dashed #dee2e6;
          }
          
          .billboard-title {
            font-size: 14px;
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
            text-align: center;
          }
          
          .billboard-info {
            font-size: 10px;
            line-height: 1.4;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            padding: 2px 0;
          }
          
          .info-label {
            font-weight: bold;
            color: #555;
            min-width: 60px;
          }
          
          .info-value {
            color: #333;
            text-align: left;
          }
          
          .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: bold;
            text-align: center;
          }
          
          .status-maintenance { background-color: #fff3cd; color: #856404; }
          .status-repair { background-color: #f8d7da; color: #721c24; }
          .status-out-of-service { background-color: #f1f1f1; color: #6c757d; }
          
          .priority-low { background-color: #d1ecf1; color: #0c5460; }
          .priority-normal { background-color: #d4edda; color: #155724; }
          .priority-high { background-color: #fff3cd; color: #856404; }
          .priority-urgent { background-color: #f8d7da; color: #721c24; }
          
          .maintenance-notes {
            background: #f8f9fa;
            padding: 8px;
            border-radius: 6px;
            margin-top: 8px;
            font-size: 9px;
            border-right: 3px solid #FFD700;
          }
          
          .stats-summary {
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
          }
          
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-top: 10px;
          }
          
          .stat-item {
            background: white;
            padding: 8px;
            border-radius: 6px;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          .stat-number {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 2px;
          }
          
          .stat-label {
            font-size: 9px;
            color: #666;
          }
          
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 2px solid #e9ecef;
            text-align: center;
            font-size: 9px;
            color: #666;
          }
          
          .signature-section {
            margin-top: 30px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
          }
          
          .signature-box {
            text-align: center;
            padding: 10px;
          }
          
          .signature-line {
            border-top: 1px solid #333;
            margin-top: 30px;
            padding-top: 5px;
            font-size: 10px;
          }
          
          @media print {
            body { margin: 0; background: white; }
            .contract-page { box-shadow: none; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="contract-page">
          <div class="header">
            <div class="company-logo">ص</div>
            <div class="company-name">شركة إدارة اللوحات الإعلانية</div>
            <div class="report-title">تقرير صيانة اللوحات الطرقية</div>
            <div class="report-date">تاريخ التقرير: ${new Date().toLocaleDateString('ar-LY', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</div>
          </div>

          <div class="stats-summary">
            <h3 style="margin: 0 0 10px 0; color: #333;">ملخص حالة اللوحات</h3>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-number" style="color: #ffc107;">${billboards.filter(b => b.maintenance_status === 'maintenance').length}</div>
                <div class="stat-label">قيد الصيانة</div>
              </div>
              <div class="stat-item">
                <div class="stat-number" style="color: #dc3545;">${billboards.filter(b => b.maintenance_status === 'repair_needed').length}</div>
                <div class="stat-label">تحتاج إصلاح</div>
              </div>
              <div class="stat-item">
                <div class="stat-number" style="color: #6c757d;">${billboards.filter(b => b.maintenance_status === 'out_of_service').length}</div>
                <div class="stat-label">خارج الخدمة</div>
              </div>
            </div>
          </div>

          <div class="billboard-grid">
            ${filteredBillboards.map((billboard, index) => `
              <div class="billboard-card">
                ${billboard.Image_URL ? 
                  `<img src="${billboard.Image_URL}" alt="صورة اللوحة" class="billboard-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div class="billboard-placeholder" style="display: none;">لا توجد صورة متاحة</div>` :
                  `<div class="billboard-placeholder">لا توجد صورة متاحة</div>`
                }
                
                <div class="billboard-title">${billboard.Billboard_Name || `لوحة رقم ${billboard.ID}`}</div>
                
                <div class="billboard-info">
                  <div class="info-row">
                    <span class="info-label">الموقع:</span>
                    <span class="info-value">${billboard.Nearest_Landmark || 'غير محدد'}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">البلدية:</span>
                    <span class="info-value">${billboard.Municipality || 'غير محدد'}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">المقاس:</span>
                    <span class="info-value">${billboard.Size || 'غير محدد'}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">الحالة:</span>
                    <span class="info-value">
                      <span class="status-badge status-${billboard.maintenance_status}">
                        ${billboard.maintenance_status === 'maintenance' ? 'قيد الصيانة' :
                          billboard.maintenance_status === 'repair_needed' ? 'تحتاج إصلاح' : 'خارج الخدمة'}
                      </span>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">الأولوية:</span>
                    <span class="info-value">
                      <span class="priority-${billboard.maintenance_priority}">
                        ${billboard.maintenance_priority === 'low' ? 'منخفضة' :
                          billboard.maintenance_priority === 'normal' ? 'عادية' :
                          billboard.maintenance_priority === 'high' ? 'عالية' : 'عاجلة'}
                      </span>
                    </span>
                  </div>
                  ${billboard.GPS_Link ? `
                  <div class="info-row">
                    <span class="info-label">الموقع:</span>
                    <span class="info-value" style="font-size: 8px; word-break: break-all;">${billboard.GPS_Link}</span>
                  </div>
                  ` : ''}
                  <div class="info-row">
                    <span class="info-label">آخر صيانة:</span>
                    <span class="info-value">${billboard.maintenance_date ? new Date(billboard.maintenance_date).toLocaleDateString('ar-LY') : 'لا يوجد'}</span>
                  </div>
                  ${billboard.maintenance_cost ? `
                  <div class="info-row">
                    <span class="info-label">التكلفة:</span>
                    <span class="info-value">${billboard.maintenance_cost.toLocaleString()} د.ل</span>
                  </div>
                  ` : ''}
                </div>
                
                ${billboard.maintenance_notes ? `
                <div class="maintenance-notes">
                  <strong>ملاحظات الصيانة:</strong><br>
                  ${billboard.maintenance_notes}
                </div>
                ` : ''}
              </div>
            `).join('')}
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line">مسؤول الصيانة</div>
            </div>
            <div class="signature-box">
              <div class="signature-line">مدير العمليات</div>
            </div>
            <div class="signature-box">
              <div class="signature-line">المدير العام</div>
            </div>
          </div>

          <div class="footer">
            <p><strong>شركة إدارة اللوحات الإعلانية</strong></p>
            <p>هاتف: +218-XXX-XXXX | البريد الإلكتروني: info@billboards.ly</p>
            <p>تم إنشاء هذا التقرير تلقائياً من نظام إدارة اللوحات الإعلانية - الإصدار 2.0</p>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.print();
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
            <span className="mr-2">جاري تحميل بيانات الصيانة...</span>
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

      {/* جدول اللوحات */}
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
                  <SelectItem value="استبدال قطع">استبدال قطع</SelectItem>
                  <SelectItem value="فحص">فحص</SelectItem>
                  <SelectItem value="أخرى">أخرى</SelectItem>
                </SelectContent>
              </Select>
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
              <Label htmlFor="technician">اسم الفني</Label>
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