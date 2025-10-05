import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Printer, X, FileText, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface AccountStatementDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: string;
  customerName: string;
}

// ✅ العملات المدعومة
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل', writtenName: 'دينار ليبي' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$', writtenName: 'دولار أمريكي' },
  { code: 'EUR', name: 'يورو', symbol: '€', writtenName: 'يورو' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£', writtenName: 'جنيه إسترليني' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', writtenName: 'ريال سعودي' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', writtenName: 'درهم إماراتي' },
];

// ✅ دالة تنسيق الأرقام العربية
const formatArabicNumber = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  
  const numStr = num.toString();
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  if (decimalPart) {
    return `${formattedInteger}.${decimalPart}`;
  }
  
  return formattedInteger;
};

// ✅ دالة تحديد حالة العقد
const getContractStatus = (endDate: string | null): { status: string; className: string } => {
  if (!endDate) return { status: 'غير محدد', className: 'text-muted-foreground' };
  
  const end = new Date(endDate);
  const now = new Date();
  
  if (end >= now) {
    return { status: 'نشط', className: 'text-green-400 font-semibold' };
  } else {
    return { status: 'منتهي', className: 'text-red-400 font-semibold' };
  }
};

// ✅ دالة تنسيق نوع الدفعة بستايل الموقع
const formatPaymentType = (entryType: string): { text: string; className: string } => {
  switch (entryType) {
    case 'receipt':
      return { 
        text: 'إيصال', 
        className: 'bg-gradient-to-r from-green-500/20 to-green-600/20 text-green-400 px-3 py-1 rounded-full text-xs font-semibold border border-green-500/30' 
      };
    case 'invoice':
      return { 
        text: 'فاتورة', 
        className: 'bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-xs font-semibold border border-blue-500/30' 
      };
    case 'debt':
      return { 
        text: 'دين سابق', 
        className: 'bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-400 px-3 py-1 rounded-full text-xs font-semibold border border-red-500/30' 
      };
    case 'account_payment':
      return { 
        text: 'دفعة حساب', 
        className: 'bg-gradient-to-r from-primary/20 to-primary-glow/20 text-primary px-3 py-1 rounded-full text-xs font-semibold border border-primary/30' 
      };
    default:
      return { 
        text: 'غير محدد', 
        className: 'bg-gradient-to-r from-muted/20 to-muted/30 text-muted-foreground px-3 py-1 rounded-full text-xs font-semibold border border-muted/30' 
      };
  }
};

export default function AccountStatementDialog({ open, onOpenChange, customerId, customerName }: AccountStatementDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [customerData, setCustomerData] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState(CURRENCIES[0]);

  // ✅ تحميل بيانات العميل
  const loadCustomerData = async () => {
    try {
      if (customerId) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();
        
        if (!error && data) {
          setCustomerData(data);
        } else {
          setCustomerData({ name: customerName, id: customerId });
        }
      } else {
        // إذا لم يكن هناك customerId، ابحث بالاسم
        const { data } = await supabase
          .from('customers')
          .select('*')
          .ilike('name', `%${customerName}%`)
          .limit(1)
          .maybeSingle();
        
        if (data) {
          setCustomerData(data);
        } else {
          setCustomerData({ name: customerName, id: customerId || 'غير محدد' });
        }
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
      setCustomerData({ name: customerName, id: customerId || 'غير محدد' });
    }
  };

  // ✅ FIXED: تحميل العقود والدفعات من الجداول الصحيحة
  const loadAccountData = async () => {
    setIsLoading(true);
    try {
      // ✅ تحميل العقود من جدول Contract
      let contractsData: any[] = [];
      
      if (customerId) {
        const { data, error } = await supabase
          .from('Contract')
          .select('*')
          .eq('customer_id', customerId)
          .order('Contract Date', { ascending: false });

        if (!error && data) {
          contractsData = data;
        }
      }
      
      // إذا لم نجد عقود بالـ customer_id، ابحث بالاسم
      if (contractsData.length === 0 && customerName) {
        const { data, error } = await supabase
          .from('Contract')
          .select('*')
          .ilike('Customer Name', `%${customerName}%`)
          .order('Contract Date', { ascending: false });

        if (!error && data) {
          contractsData = data;
        }
      }
      
      setContracts(contractsData);
      console.log('✅ تم تحميل العقود:', contractsData);

      // ✅ تحميل الدفعات من جدول customer_payments
      let paymentsData: any[] = [];
      
      if (customerId) {
        let paymentsQuery = supabase
          .from('customer_payments')
          .select('*')
          .eq('customer_id', customerId)
          .order('paid_at', { ascending: true }); // ✅ FIXED: ترتيب من الأقدم للأجدد

        // تطبيق فلتر التاريخ إذا تم تحديده
        if (startDate) {
          paymentsQuery = paymentsQuery.gte('paid_at', startDate);
        }
        if (endDate) {
          paymentsQuery = paymentsQuery.lte('paid_at', endDate);
        }

        const { data, error } = await paymentsQuery;

        if (!error && data) {
          paymentsData = data;
        }
      }
      
      // إذا لم نجد دفعات بالـ customer_id، ابحث بالاسم
      if (paymentsData.length === 0 && customerName) {
        let paymentsQuery = supabase
          .from('customer_payments')
          .select('*')
          .ilike('customer_name', `%${customerName}%`)
          .order('paid_at', { ascending: true }); // ✅ FIXED: ترتيب من الأقدم للأجدد

        // تطبيق فلتر التاريخ إذا تم تحديده
        if (startDate) {
          paymentsQuery = paymentsQuery.gte('paid_at', startDate);
        }
        if (endDate) {
          paymentsQuery = paymentsQuery.lte('paid_at', endDate);
        }

        const { data, error } = await paymentsQuery;

        if (!error && data) {
          paymentsData = data;
        }
      }
      
      setPayments(paymentsData);
      console.log('✅ تم تحميل الدفعات:', paymentsData);

      // ✅ NEW: إنشاء قائمة موحدة لجميع الحركات (دائن ومدين)
      const transactions: any[] = [];
      
      // إضافة العقود كحركات مدينة
      contractsData.forEach(contract => {
        transactions.push({
          id: `contract-${contract.Contract_Number}`,
          date: contract['Contract Date'],
          type: 'contract',
          description: `عقد رقم ${contract.Contract_Number} - ${contract['Ad Type'] || 'غير محدد'}`,
          debit: Number(contract['Total Rent']) || 0,
          credit: 0,
          balance: 0, // سيتم حسابه لاحقاً
          reference: `عقد-${contract.Contract_Number}`,
          notes: `نوع الإعلان: ${contract['Ad Type'] || 'غير محدد'}`,
        });
      });

      // إضافة الدفعات كحركات دائنة أو مدينة
      paymentsData.forEach(payment => {
        const isDebit = payment.entry_type === 'invoice' || payment.entry_type === 'debt';
        const amount = Number(payment.amount) || 0;
        
        transactions.push({
          id: `payment-${payment.id}`,
          date: payment.paid_at,
          type: payment.entry_type,
          description: formatPaymentType(payment.entry_type).text,
          debit: isDebit ? amount : 0,
          credit: isDebit ? 0 : amount,
          balance: 0, // سيتم حسابه لاحقاً
          reference: payment.reference || payment.contract_number || '—',
          notes: payment.notes || '—',
          method: payment.method || '—',
        });
      });

      // ترتيب الحركات حسب التاريخ من الأقدم للأجدد
      transactions.sort((a, b) => new Date(a.date || '1900-01-01').getTime() - new Date(b.date || '1900-01-01').getTime());

      // حساب الرصيد المتراكم
      let runningBalance = 0;
      transactions.forEach(transaction => {
        runningBalance += (transaction.debit - transaction.credit);
        transaction.balance = runningBalance;
      });

      setAllTransactions(transactions);
      console.log('✅ تم إنشاء قائمة الحركات:', transactions);

    } catch (error) {
      console.error('Error loading account data:', error);
      toast.error('حدث خطأ في تحميل بيانات الحساب');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadCustomerData();
      // تعيين التواريخ الافتراضية (آخر سنة)
      const today = new Date();
      const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      setStartDate(oneYearAgo.toISOString().slice(0, 10));
      setEndDate(today.toISOString().slice(0, 10));
    }
  }, [open]);

  useEffect(() => {
    if (open && (customerId || customerName)) {
      loadAccountData();
    }
  }, [open, customerId, customerName, startDate, endDate]);

  // ✅ FIXED: حساب الإحصائيات من البيانات الصحيحة
  const calculateStatistics = () => {
    const totalContracts = contracts.length;
    const activeContracts = contracts.filter(c => {
      const endDate = new Date(c['End Date'] || c.end_date);
      return endDate >= new Date();
    }).length;

    const totalContractValue = contracts.reduce((sum, contract) => {
      return sum + (Number(contract['Total Rent']) || 0);
    }, 0);

    const totalDebits = allTransactions.reduce((sum, transaction) => sum + transaction.debit, 0);
    const totalCredits = allTransactions.reduce((sum, transaction) => sum + transaction.credit, 0);
    const balance = totalDebits - totalCredits;

    return {
      totalContracts,
      activeContracts,
      totalContractValue,
      totalDebits,
      totalCredits,
      balance
    };
  };

  // ✅ طباعة كشف الحساب
  const handlePrintStatement = async () => {
    if (!customerData) {
      toast.error('لا توجد بيانات عميل للطباعة');
      return;
    }

    setIsGenerating(true);
    
    try {
      const statistics = calculateStatistics();
      const statementDate = new Date().toLocaleDateString('ar-LY');
      const statementNumber = `STMT-${Date.now()}`;
      
      // تنسيق فترة الكشف
      const periodStart = startDate ? new Date(startDate).toLocaleDateString('ar-LY') : 'غير محدد';
      const periodEnd = endDate ? new Date(endDate).toLocaleDateString('ar-LY') : 'غير محدد';

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>كشف حساب ${customerData.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            html, body {
              width: 210mm;
              height: 297mm;
              font-family: 'Noto Sans Arabic', Arial, sans-serif;
              direction: rtl;
              text-align: right;
              background: white;
              color: #000;
              font-size: 12px;
              line-height: 1.4;
              overflow: hidden;
            }
            
            .statement-container {
              width: 210mm;
              height: 297mm;
              padding: 15mm;
              display: flex;
              flex-direction: column;
            }
            
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 30px;
              border-bottom: 2px solid #000;
              padding-bottom: 20px;
            }
            
            .statement-info {
              text-align: left;
              direction: ltr;
              order: 2;
            }
            
            .statement-title {
              font-size: 28px;
              font-weight: bold;
              color: #000;
              margin-bottom: 10px;
            }
            
            .statement-details {
              font-size: 12px;
              color: #666;
              line-height: 1.6;
            }
            
            .company-info {
              display: flex;
              flex-direction: column;
              align-items: flex-end;
              text-align: right;
              order: 1;
            }
            
            .company-logo {
              max-width: 400px;
              height: auto;
              object-fit: contain;
              margin-bottom: 5px;
              display: block;
              margin-right: 0;
            }
            
            .company-details {
              font-size: 12px;
              color: #666;
              line-height: 1.6;
              font-weight: 400;
              text-align: right;
            }
            
            .customer-info {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 0;
              margin-bottom: 25px;
              border-right: 4px solid #000;
            }
            
            .customer-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #000;
            }
            
            .customer-details {
              font-size: 13px;
              line-height: 1.6;
            }
            
            .transactions-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
              table-layout: fixed;
            }
            
            .transactions-table th {
              background: #000;
              color: white;
              padding: 12px 8px;
              text-align: center;
              font-weight: bold;
              border: 1px solid #000;
              font-size: 11px;
              height: 40px;
            }
            
            .transactions-table td {
              padding: 8px 6px;
              text-align: center;
              border: 1px solid #ddd;
              font-size: 10px;
              vertical-align: middle;
              height: 30px;
            }
            
            .transactions-table tbody tr:nth-child(even) {
              background: #f8f9fa;
            }
            
            .debit {
              color: #dc2626;
              font-weight: bold;
            }
            
            .credit {
              color: #16a34a;
              font-weight: bold;
            }
            
            .balance {
              font-weight: bold;
            }
            
            .summary-section {
              margin-top: auto;
              border-top: 2px solid #000;
              padding-top: 20px;
            }
            
            .summary-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 8px 0;
              font-size: 14px;
            }

            .summary-row.total-debits {
              font-size: 16px;
              font-weight: bold;
              color: #dc2626;
              margin-bottom: 10px;
            }

            .summary-row.total-credits {
              font-size: 16px;
              font-weight: bold;
              color: #16a34a;
              margin-bottom: 10px;
            }
            
            .summary-row.balance {
              font-size: 20px;
              font-weight: bold;
              background: #000;
              color: white;
              padding: 20px 25px;
              border-radius: 0;
              margin-top: 15px;
              border: none;
            }
            
            .currency {
              font-weight: bold;
              color: #FFD700;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
            }
            
            .footer {
              margin-top: 25px;
              text-align: center;
              font-size: 11px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 15px;
            }
            
            @media print {
              html, body {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                color-adjust: exact;
              }
              
              .statement-container {
                width: 210mm !important;
                height: 297mm !important;
                padding: 15mm !important;
              }
              
              @page {
                size: A4 portrait;
                margin: 0 !important;
                padding: 0 !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="statement-container">
            <div class="header">
              <div class="company-info">
                <img src="/logofares.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
                <div class="company-details">
                  طرابلس – طريق المطار، حي الزهور<br>
                  هاتف: 0912612255
                </div>
              </div>
              
              <div class="statement-info">
                <div class="statement-title">كشف حساب</div>
                <div class="statement-details">
                  رقم الكشف: ${statementNumber}<br>
                  التاريخ: ${statementDate}<br>
                  الفترة: ${periodStart} - ${periodEnd}
                </div>
              </div>
            </div>
            
            <div class="customer-info">
              <div class="customer-title">بيانات العميل</div>
              <div class="customer-details">
                <strong>الاسم:</strong> ${customerData.name}<br>
                ${customerData.company ? `<strong>الشركة:</strong> ${customerData.company}<br>` : ''}
                ${customerData.phone ? `<strong>الهاتف:</strong> ${customerData.phone}<br>` : ''}
                ${customerData.email ? `<strong>البريد الإلكتروني:</strong> ${customerData.email}<br>` : ''}
                <strong>رقم العميل:</strong> ${customerData.id}
              </div>
            </div>
            
            <table class="transactions-table">
              <thead>
                <tr>
                  <th style="width: 8%">#</th>
                  <th style="width: 12%">التاريخ</th>
                  <th style="width: 20%">البيان</th>
                  <th style="width: 12%">المرجع</th>
                  <th style="width: 12%">مدين</th>
                  <th style="width: 12%">دائن</th>
                  <th style="width: 12%">الرصيد</th>
                  <th style="width: 12%">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                ${allTransactions.map((transaction, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${transaction.date ? new Date(transaction.date).toLocaleDateString('ar-LY') : '—'}</td>
                    <td style="text-align: right; padding-right: 8px;">${transaction.description}</td>
                    <td>${transaction.reference}</td>
                    <td class="debit">${transaction.debit > 0 ? `${currency.symbol} ${formatArabicNumber(transaction.debit)}` : '—'}</td>
                    <td class="credit">${transaction.credit > 0 ? `${currency.symbol} ${formatArabicNumber(transaction.credit)}` : '—'}</td>
                    <td class="balance">${currency.symbol} ${formatArabicNumber(transaction.balance)}</td>
                    <td style="text-align: right; padding-right: 8px;">${transaction.notes}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="summary-section">
              <div class="summary-row total-debits">
                <span>إجمالي المدين:</span>
                <span>${currency.symbol} ${formatArabicNumber(statistics.totalDebits)}</span>
              </div>
              <div class="summary-row total-credits">
                <span>إجمالي الدائن:</span>
                <span>- ${currency.symbol} ${formatArabicNumber(statistics.totalCredits)}</span>
              </div>
              <div class="summary-row balance">
                <span>الرصيد النهائي:</span>
                <span class="currency">${currency.symbol} ${formatArabicNumber(statistics.balance)}</span>
              </div>
              <div style="margin-top: 15px; font-size: 13px; color: #666; text-align: center;">
                الرصيد بالكلمات: ${formatArabicNumber(statistics.balance)} ${currency.writtenName}
              </div>
            </div>
            
            <div class="footer">
              شكراً لتعاملكم معنا | Thank you for your business<br>
              هذا كشف حساب إلكتروني ولا يحتاج إلى ختم أو توقيع
            </div>
          </div>
          
          <script>
            window.addEventListener('load', function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 500);
            });
          </script>
        </body>
        </html>
      `;

      // فتح نافذة الطباعة
      const windowFeatures = 'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no';
      const printWindow = window.open('', '_blank', windowFeatures);

      if (!printWindow) {
        throw new Error('فشل في فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح والسماح بالنوافذ المنبثقة.');
      }

      printWindow.document.title = `كشف_حساب_${customerData.name}_${statementNumber}`;
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      toast.success(`تم فتح كشف الحساب للطباعة بنجاح بعملة ${currency.name}!`);
      onOpenChange(false);

    } catch (error) {
      console.error('Error in handlePrintStatement:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء تحضير كشف الحساب للطباعة: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const statistics = calculateStatistics();

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      {/* ✅ FIXED: تطبيق العرض والارتفاع المناسبين */}
      <UIDialog.DialogContent className="w-[69rem] max-w-[69rem] h-[85vh] max-h-[85vh] overflow-hidden">
        <UIDialog.DialogHeader>
          <UIDialog.DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            كشف حساب العميل
          </UIDialog.DialogTitle>
          <UIDialog.DialogClose className="absolute left-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">إغلاق</span>
          </UIDialog.DialogClose>
        </UIDialog.DialogHeader>
        
        {/* ✅ FIXED: إضافة scroll للمحتوى مع ارتفاع محدود */}
        <div className="flex-1 overflow-y-auto space-y-4 px-1">
          {isGenerating ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg font-semibold">جاري تحضير كشف الحساب للطباعة...</p>
              <p className="text-sm text-gray-600 mt-2">يتم تحميل بيانات العميل وتحضير التخطيط</p>
            </div>
          ) : (
            <>
              {/* إعدادات الكشف */}
              <div className="bg-gradient-to-br from-card to-primary/10 p-4 rounded-lg border border-primary/30">
                <h3 className="font-semibold mb-4 text-primary">إعدادات كشف الحساب:</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">من تاريخ:</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">إلى تاريخ:</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">العملة:</label>
                    <select
                      value={currency.code}
                      onChange={(e) => setCurrency(CURRENCIES.find(c => c.code === e.target.value) || CURRENCIES[0])}
                      className="w-full p-2 border border-border rounded-md text-sm bg-input text-foreground"
                    >
                      {CURRENCIES.map(curr => (
                        <option key={curr.code} value={curr.code}>
                          {curr.name} ({curr.symbol})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* معلومات العميل */}
              {customerData && (
                <div className="expenses-preview-item">
                  <h3 className="expenses-preview-label">بيانات العميل:</h3>
                  <div className="text-sm space-y-1">
                    <p><strong>الاسم:</strong> {customerData.name}</p>
                    {customerData.company && (
                      <p><strong>الشركة:</strong> {customerData.company}</p>
                    )}
                    {customerData.phone && (
                      <p><strong>الهاتف:</strong> {customerData.phone}</p>
                    )}
                    {customerData.email && (
                      <p><strong>البريد الإلكتروني:</strong> {customerData.email}</p>
                    )}
                    <p><strong>رقم العميل:</strong> {customerData.id}</p>
                  </div>
                </div>
              )}

              {/* ✅ FIXED: الإحصائيات بستايل الموقع */}
              {!isLoading && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="expenses-preview-item">
                    <div className="expenses-preview-label">إجمالي العقود</div>
                    <div className="expenses-preview-value">{formatArabicNumber(statistics.totalContracts)}</div>
                  </div>
                  <div className="expenses-preview-item">
                    <div className="expenses-preview-label">العقود النشطة</div>
                    <div className="expenses-preview-value stat-green">{formatArabicNumber(statistics.activeContracts)}</div>
                  </div>
                  <div className="expenses-preview-item">
                    <div className="expenses-preview-label">إجمالي المدين</div>
                    <div className="expenses-preview-value stat-red">{formatArabicNumber(statistics.totalDebits)} {currency.symbol}</div>
                  </div>
                  <div className="expenses-preview-item">
                    <div className="expenses-preview-label">إجمالي الدائن</div>
                    <div className="expenses-preview-value stat-green">{formatArabicNumber(statistics.totalCredits)} {currency.symbol}</div>
                  </div>
                  <div className="expenses-preview-item">
                    <div className="expenses-preview-label">الرصيد النهائي</div>
                    <div className="expenses-preview-value text-primary">{formatArabicNumber(statistics.balance)} {currency.symbol}</div>
                  </div>
                </div>
              )}

              {/* ✅ NEW: جدول جميع الحركات (دائن ومدين) */}
              {!isLoading && allTransactions.length > 0 && (
                <div className="expenses-preview-item">
                  <h3 className="expenses-preview-label">جميع حركات الحساب ({allTransactions.length}):</h3>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-sm border-collapse border border-border">
                      <thead>
                        <tr className="bg-primary text-primary-foreground">
                          <th className="border border-border p-2 text-center">#</th>
                          <th className="border border-border p-2 text-center">التاريخ</th>
                          <th className="border border-border p-2 text-center">البيان</th>
                          <th className="border border-border p-2 text-center">المرجع</th>
                          <th className="border border-border p-2 text-center">مدين</th>
                          <th className="border border-border p-2 text-center">دائن</th>
                          <th className="border border-border p-2 text-center">الرصيد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allTransactions.map((transaction, index) => (
                          <tr key={transaction.id} className={index % 2 === 0 ? 'bg-card/50' : 'bg-background'}>
                            <td className="border border-border p-2 text-center">{index + 1}</td>
                            <td className="border border-border p-2 text-center">
                              {transaction.date ? new Date(transaction.date).toLocaleDateString('ar-LY') : '—'}
                            </td>
                            <td className="border border-border p-2 text-right">
                              {transaction.type === 'contract' ? (
                                <span className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 text-purple-400 px-3 py-1 rounded-full text-xs font-semibold border border-purple-500/30">
                                  {transaction.description}
                                </span>
                              ) : (
                                <span className={formatPaymentType(transaction.type).className}>
                                  {formatPaymentType(transaction.type).text}
                                </span>
                              )}
                            </td>
                            <td className="border border-border p-2 text-center">{transaction.reference}</td>
                            <td className="border border-border p-2 text-center font-medium text-red-400">
                              {transaction.debit > 0 ? `${formatArabicNumber(transaction.debit)} ${currency.symbol}` : '—'}
                            </td>
                            <td className="border border-border p-2 text-center font-medium text-green-400">
                              {transaction.credit > 0 ? `${formatArabicNumber(transaction.credit)} ${currency.symbol}` : '—'}
                            </td>
                            <td className="border border-border p-2 text-center font-bold text-primary">
                              {formatArabicNumber(transaction.balance)} {currency.symbol}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ✅ UPDATED: جدول العقود مع حالة العقد */}
              {!isLoading && contracts.length > 0 && (
                <div className="expenses-preview-item">
                  <h3 className="expenses-preview-label">العقود ({contracts.length}):</h3>
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-sm border-collapse border border-border">
                      <thead>
                        <tr className="bg-primary text-primary-foreground">
                          <th className="border border-border p-2 text-center">رقم العقد</th>
                          <th className="border border-border p-2 text-center">نوع الإعلان</th>
                          <th className="border border-border p-2 text-center">تاريخ البداية</th>
                          <th className="border border-border p-2 text-center">تاريخ النهاية</th>
                          <th className="border border-border p-2 text-center">حالة العقد</th>
                          <th className="border border-border p-2 text-center">القيمة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contracts.map((contract, index) => {
                          const contractStatus = getContractStatus(contract['End Date']);
                          return (
                            <tr key={index} className={index % 2 === 0 ? 'bg-card/50' : 'bg-background'}>
                              <td className="border border-border p-2 text-center font-medium">{contract.Contract_Number}</td>
                              <td className="border border-border p-2 text-right">{contract['Ad Type'] || '—'}</td>
                              <td className="border border-border p-2 text-center">
                                {contract['Contract Date'] ? new Date(contract['Contract Date']).toLocaleDateString('ar-LY') : '—'}
                              </td>
                              <td className="border border-border p-2 text-center">
                                {contract['End Date'] ? new Date(contract['End Date']).toLocaleDateString('ar-LY') : '—'}
                              </td>
                              <td className={`border border-border p-2 text-center ${contractStatus.className}`}>
                                {contractStatus.status}
                              </td>
                              <td className="border border-border p-2 text-center font-medium">
                                {(Number(contract['Total Rent']) || 0).toLocaleString('ar-LY')} {currency.symbol}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-sm text-muted-foreground">جاري تحميل بيانات الحساب...</p>
                </div>
              )}

              {/* رسالة عدم وجود بيانات */}
              {!isLoading && contracts.length === 0 && payments.length === 0 && (
                <div className="text-center py-8 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-yellow-800 font-medium">لا توجد بيانات للعميل في الفترة المحددة</p>
                  <p className="text-yellow-600 text-sm mt-2">يرجى التحقق من اسم العميل أو تغيير الفترة الزمنية</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ✅ FIXED: أزرار العمليات في أسفل النافذة */}
        <div className="flex gap-2 justify-end pt-4 border-t border-border">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="border-primary/30 hover:bg-primary/10"
          >
            إغلاق
          </Button>
          <Button 
            onClick={handlePrintStatement}
            className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
            disabled={isGenerating || isLoading || allTransactions.length === 0}
          >
            <Printer className="h-4 w-4 ml-2" />
            طباعة كشف الحساب
          </Button>
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}