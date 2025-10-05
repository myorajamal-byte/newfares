import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Printer, 
  Eye, 
  Calculator, 
  FileText, 
  Settings, 
  Trash2,
  Plus,
  Receipt,
  Save,
  X
} from 'lucide-react';

interface PrintItem {
  size: string;
  quantity: number;
  faces: number;
  totalFaces: number;
  area: number;
  pricePerMeter: number;
  totalArea: number;
  totalPrice: number;
  sortOrder: number;
  width: number;
  height: number;
}

interface ContractRow {
  Contract_Number: string;
  'Customer Name': string;
  'Ad Type': string;
  'Total Rent': number;
  billboard_ids?: string;
  billboards?: any[];
  saved_billboards_data?: string;
  billboards_data?: string;
  [key: string]: any;
}

interface ModernPrintInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  customerName: string;
  contracts: ContractRow[];
  selectedContracts: string[];
  onSelectContracts: (contracts: string[]) => void;
  printItems: PrintItem[];
  onUpdatePrintItem: (index: number, field: keyof PrintItem, value: number) => void;
  onRemoveItem: (index: number) => void;
  includeAccountBalance: boolean;
  onIncludeAccountBalance: (include: boolean) => void;
  accountPayments: number;
  onPrintInvoice: () => void;
  onSaveInvoice: () => void;
}

const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل', writtenName: 'دينار ليبي' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$', writtenName: 'دولار أمريكي' },
  { code: 'EUR', name: 'يورو', symbol: '€', writtenName: 'يورو' },
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

export default function ModernPrintInvoiceDialog({
  open,
  onClose,
  customerName,
  contracts,
  selectedContracts,
  onSelectContracts,
  printItems,
  onUpdatePrintItem,
  onRemoveItem,
  includeAccountBalance,
  onIncludeAccountBalance,
  accountPayments,
  onPrintInvoice,
  onSaveInvoice
}: ModernPrintInvoiceDialogProps) {
  const [activeTab, setActiveTab] = useState<'setup' | 'preview'>('setup');
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  
  const [localPrintItems, setLocalPrintItems] = useState<PrintItem[]>([]);
  const [sizeOrderMap, setSizeOrderMap] = useState<{ [key: string]: number }>({});
  const [sizeDimensionsMap, setSizeDimensionsMap] = useState<{ [key: string]: { width: number; height: number } }>({});

  // ✅ جلب بيانات الأحجام من قاعدة البيانات مع الأبعاد
  const fetchSizeData = async () => {
    try {
      const { data: sizesData, error } = await supabase
        .from('sizes')
        .select('name, sort_order, width, height')
        .order('sort_order', { ascending: true });

      if (!error && sizesData) {
        const orderMap: { [key: string]: number } = {};
        const dimensionsMap: { [key: string]: { width: number; height: number } } = {};
        
        sizesData.forEach(size => {
          orderMap[size.name] = size.sort_order || 999;
          dimensionsMap[size.name] = {
            width: Number(size.width) || 0,
            height: Number(size.height) || 0
          };
        });
        
        setSizeOrderMap(orderMap);
        setSizeDimensionsMap(dimensionsMap);
        console.log('Size data loaded:', { orderMap, dimensionsMap });
      } else {
        console.warn('Failed to load size data:', error);
      }
    } catch (error) {
      console.error('Error fetching size data:', error);
    }
  };

  // ✅ حساب الإجماليات الصحيح
  const subtotal = useMemo(() => {
    let calculatedTotal = 0;
    
    localPrintItems.forEach((item, index) => {
      // ✅ الحساب الصحيح: العرض × الارتفاع × عدد الأوجه × سعر المتر
      const width = Number(item.width) || 0;
      const height = Number(item.height) || 0;
      const totalFaces = Number(item.totalFaces) || 0;
      const pricePerMeter = Number(item.pricePerMeter) || 0;
      
      const itemTotal = width * height * totalFaces * pricePerMeter;
      
      console.log(`Item ${index} (${item.size}): ${width} × ${height} × ${totalFaces} × ${pricePerMeter} = ${itemTotal}`);
      
      if (!isNaN(itemTotal) && itemTotal > 0) {
        calculatedTotal += itemTotal;
      }
    });
    
    console.log('Final subtotal calculated:', calculatedTotal);
    return calculatedTotal;
  }, [localPrintItems]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percentage') {
      return (subtotal * discount) / 100;
    }
    return discount;
  }, [subtotal, discount, discountType]);

  const total = useMemo(() => {
    let finalTotal = subtotal - discountAmount;
    if (includeAccountBalance && accountPayments > 0) {
      finalTotal -= accountPayments;
    }
    return Math.max(0, finalTotal);
  }, [subtotal, discountAmount, includeAccountBalance, accountPayments]);

  useEffect(() => {
    if (open) {
      setActiveTab('setup');
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      setInvoiceNumber(`INV-${timestamp}${randomSuffix}`);
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      setDiscount(0);
      setLocalPrintItems([]);
      
      // ✅ جلب بيانات الأحجام عند فتح النافذة
      fetchSizeData();
    }
  }, [open]);

  const getBillboardsFromContracts = async (contractNumbers: string[]) => {
    if (contractNumbers.length === 0) {
      setLocalPrintItems([]);
      return;
    }

    try {
      const selectedContractData = contracts.filter(contract => 
        contractNumbers.includes(contract.Contract_Number)
      );

      let allBillboards: any[] = [];

      for (const contract of selectedContractData) {
        let billboardsToShow = [];
        
        const billboardIds = contract?.billboard_ids;
        if (billboardIds) {
          try {
            const idsArray = typeof billboardIds === 'string' 
              ? billboardIds.split(',').map(id => id.trim()).filter(Boolean)
              : Array.isArray(billboardIds) ? billboardIds : [];

            if (idsArray.length > 0) {
              const { data: billboardsData, error } = await supabase
                .from('billboards')
                .select('*')
                .in('ID', idsArray);

              if (!error && billboardsData && billboardsData.length > 0) {
                billboardsToShow = billboardsData;
              }
            }
          } catch (e) {
            console.warn('Failed to parse billboard_ids:', e);
          }
        }

        if (billboardsToShow.length === 0) {
          const dbRows: any[] = Array.isArray(contract?.billboards) ? contract.billboards : [];
          let srcRows: any[] = dbRows;
          if (!srcRows.length) {
            try {
              const saved = contract?.saved_billboards_data ?? contract?.billboards_data ?? '[]';
              const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
              if (Array.isArray(parsed)) srcRows = parsed;
            } catch (e) {
              console.warn('Failed to parse saved billboards data:', e);
            }
          }
          billboardsToShow = srcRows;
        }

        allBillboards = [...allBillboards, ...billboardsToShow];
      }

      const printItemsFromBillboards = convertBillboardsToPrintItems(allBillboards);
      setLocalPrintItems(printItemsFromBillboards);

    } catch (error) {
      console.error('Error fetching billboards from contracts:', error);
      toast.error('حدث خطأ في جلب بيانات اللوحات');
      setLocalPrintItems([]);
    }
  };

  // ✅ دالة التحويل مع استخدام أبعاد قاعدة البيانات
  const convertBillboardsToPrintItems = (billboards: any[]): PrintItem[] => {
    const groupedBillboards: { [key: string]: PrintItem } = {};

    billboards.forEach((billboard) => {
      const size = String(billboard.Size ?? billboard.size ?? 'غير محدد');
      const faces = Number(billboard.Faces ?? billboard.faces ?? billboard.Number_of_Faces ?? billboard.Faces_Count ?? billboard.faces_count ?? 1);
      
      // ✅ جلب الأبعاد من قاعدة البيانات
      const dimensions = sizeDimensionsMap[size];
      const width = dimensions?.width || 0;
      const height = dimensions?.height || 0;
      const area = width * height;

      const groupKey = `${size}_${faces}`;
      const sortOrder = sizeOrderMap[size] || 999;

      if (!groupedBillboards[groupKey]) {
        groupedBillboards[groupKey] = {
          size: size,
          quantity: 0,
          faces: faces,
          totalFaces: 0,
          area: area,
          pricePerMeter: 40,
          totalArea: 0,
          totalPrice: 0,
          sortOrder: sortOrder,
          width: width,
          height: height
        };
      }

      groupedBillboards[groupKey].quantity += 1;
      groupedBillboards[groupKey].totalFaces += faces;
      groupedBillboards[groupKey].totalArea += area;
    });

    // ✅ حساب الأسعار الإجمالية وترتيب النتائج
    const result = Object.values(groupedBillboards).map(item => {
      // ✅ الحساب الصحيح: العرض × الارتفاع × عدد الأوجه × سعر المتر
      const calculatedPrice = item.width * item.height * item.totalFaces * item.pricePerMeter;
      
      console.log(`Processing item ${item.size}: ${item.width} × ${item.height} × ${item.totalFaces} × ${item.pricePerMeter} = ${calculatedPrice}`);
      
      return {
        ...item,
        totalPrice: calculatedPrice
      };
    });

    result.sort((a, b) => a.sortOrder - b.sortOrder);
    
    console.log('Final converted print items:', result);
    return result;
  };

  useEffect(() => {
    if (open && Object.keys(sizeDimensionsMap).length > 0) {
      getBillboardsFromContracts(selectedContracts);
    }
  }, [selectedContracts, open, contracts, sizeDimensionsMap]);

  const handleContractToggle = (contractNumber: string) => {
    const isSelected = selectedContracts.includes(contractNumber);
    if (isSelected) {
      onSelectContracts(selectedContracts.filter(c => c !== contractNumber));
    } else {
      onSelectContracts([...selectedContracts, contractNumber]);
    }
  };

  const handleRowClick = (contractNumber: string, event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('input[type="checkbox"]')) {
      return;
    }
    handleContractToggle(contractNumber);
  };

  // ✅ دالة تحديث العناصر مع الحساب الصحيح
  const handlePrintItemUpdate = (index: number, field: keyof PrintItem, value: number) => {
    const updatedItems = [...localPrintItems];
    const item = { ...updatedItems[index] };
    
    const numericValue = isNaN(value) ? 0 : Number(value);
    item[field] = numericValue;
    
    if (field === 'totalFaces') {
      item.totalArea = item.area * numericValue;
    } else if (field === 'quantity') {
      item.totalFaces = numericValue * item.faces;
      item.totalArea = item.area * item.totalFaces;
    }
    
    // ✅ الحساب الصحيح: العرض × الارتفاع × عدد الأوجه × سعر المتر
    item.totalPrice = item.width * item.height * item.totalFaces * item.pricePerMeter;
    
    updatedItems[index] = item;
    
    console.log(`Updated item ${index}:`, {
      size: item.size,
      width: item.width,
      height: item.height,
      totalFaces: item.totalFaces,
      pricePerMeter: item.pricePerMeter,
      totalPrice: item.totalPrice
    });
    
    setLocalPrintItems(updatedItems);
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = localPrintItems.filter((_, i) => i !== index);
    setLocalPrintItems(updatedItems);
  };

  // ✅ دالة طباعة أمر الطباعة (بدون أسعار مع حقول A/B)
  const handlePrintWorkOrder = () => {
    if (localPrintItems.length === 0) {
      toast.error('لا توجد عناصر للطباعة');
      return;
    }

    try {
      const testWindow = window.open('', '_blank', 'width=1,height=1');
      if (!testWindow || testWindow.closed || typeof testWindow.closed === 'undefined') {
        toast.error('يرجى السماح بالنوافذ المنبثقة في المتصفح لتمكين الطباعة');
        return;
      }
      testWindow.close();

      const currentDate = new Date(invoiceDate);
      const formattedDate = currentDate.toLocaleDateString('ar-LY');

      const contractsList = selectedContracts.join('-');
      const dateFormatted = currentDate.toISOString().slice(0, 10).replace(/-/g, '_');
      const customerNameForFile = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
      const fileName = `أمر_طباعة_${customerNameForFile}_عقود_${contractsList}_${dateFormatted}`;

      const FIXED_ROWS = 10;
      const displayItems = [...localPrintItems];

      while (displayItems.length < FIXED_ROWS) {
        displayItems.push({
          size: '',
          quantity: '',
          faces: '',
          totalFaces: '',
          area: '',
          width: '',
          height: ''
        } as any);
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${fileName}</title>
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

            .invoice-container {
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

            .work-order-info {
              text-align: left;
              direction: ltr;
              order: 2;
            }

            .work-order-title {
              font-size: 28px;
              font-weight: bold;
              color: #000;
              margin-bottom: 10px;
            }

            .work-order-details {
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

            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
              table-layout: fixed;
            }

            .items-table th {
              background: #000;
              color: white;
              padding: 12px 8px;
              text-align: center;
              font-weight: bold;
              border: 1px solid #000;
              font-size: 11px;
              height: 40px;
            }

            .items-table td {
              padding: 10px 8px;
              text-align: center;
              border: 1px solid #ddd;
              font-size: 10px;
              vertical-align: middle;
              height: 35px;
            }

            .items-table tbody tr:nth-child(even) {
              background: #f8f9fa;
            }

            .items-table tbody tr:hover {
              background: #e9ecef;
            }

            .items-table tbody tr.empty-row {
              background: white;
            }

            .items-table tbody tr.empty-row:nth-child(even) {
              background: #f8f9fa;
            }

            .design-face-input {
              width: 40px;
              height: 30px;
              border: 1px solid #000;
              text-align: center;
              display: inline-block;
              margin: 0 2px;
            }

            .footer {
              margin-top: 25px;
              text-align: center;
              font-size: 11px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 15px;
            }

            .printer-selection {
              background: #fff3cd;
              border: 2px solid #ffc107;
              padding: 15px;
              margin-bottom: 20px;
              border-radius: 5px;
            }

            .printer-label {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 8px;
              color: #000;
            }

            .printer-input {
              width: 100%;
              padding: 10px;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-size: 14px;
              text-align: right;
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

              .invoice-container {
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
          <div class="invoice-container">
            <div class="header">
              <div class="company-info">
                <img src="/logofares.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
                <div class="company-details">
                  طرابلس – طريق المطار، حي الزهور<br>
                  هاتف: 0912612255
                </div>
              </div>

              <div class="work-order-info">
                <div class="work-order-title">أمر طباعة</div>
                <div class="work-order-details">
                  رقم الأمر: ${invoiceNumber}<br>
                  التاريخ: ${formattedDate}
                </div>
              </div>
            </div>

            <div class="printer-selection">
              <div class="printer-label">اختيار المطبعة:</div>
              <input type="text" class="printer-input" placeholder="اكتب اسم المطبعة هنا..." />
            </div>

            <div class="customer-info">
              <div class="customer-title">بيانات العميل</div>
              <div class="customer-details">
                <strong>الاسم:</strong> ${customerName}<br>
                <strong>العقود المرتبطة:</strong> ${selectedContracts.join(', ')}<br>
                <strong>تاريخ الأمر:</strong> ${formattedDate}
              </div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 6%">#</th>
                  <th style="width: 22%">المقاس</th>
                  <th style="width: 10%">عدد اللوحات</th>
                  <th style="width: 10%">أوجه/لوحة</th>
                  <th style="width: 10%">إجمالي الأوجه</th>
                  <th style="width: 14%">الأبعاد (م)</th>
                  <th style="width: 14%">المساحة/الوجه</th>
                  <th style="width: 14%">التصميم وجه</th>
                </tr>
              </thead>
              <tbody>
                ${displayItems.map((item, index) => {
                  const isEmpty = !item.size;

                  return `
                    <tr class="${isEmpty ? 'empty-row' : ''}">
                      <td>${isEmpty ? '' : index + 1}</td>
                      <td style="text-align: right; padding-right: 8px;">
                        ${isEmpty ? '' : `لوحة إعلانية مقاس ${item.size}`}
                      </td>
                      <td>${isEmpty ? '' : (typeof item.quantity === 'number' ? formatArabicNumber(item.quantity) : item.quantity)}</td>
                      <td>${isEmpty ? '' : (typeof item.faces === 'number' ? item.faces : item.faces)}</td>
                      <td>${isEmpty ? '' : (typeof item.totalFaces === 'number' ? formatArabicNumber(item.totalFaces) : item.totalFaces)}</td>
                      <td>${isEmpty ? '' : (typeof item.width === 'number' && typeof item.height === 'number' ? `${item.width} × ${item.height}` : '')}</td>
                      <td>${isEmpty ? '' : (typeof item.area === 'number' ? `${item.area.toFixed(2)} م²` : item.area)}</td>
                      <td>
                        ${isEmpty ? '' : '<span class="design-face-input">A</span> <span class="design-face-input">B</span>'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div class="footer">
              هذا أمر طباعة ولا يحتوي على أسعار | ملاحظة: حقل "التصميم وجه" يستخدم لتحديد نوع التصميم (A أو B)
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

      const windowFeatures = 'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no';
      const printWindow = window.open('', '_blank', windowFeatures);

      if (!printWindow) {
        throw new Error('فشل في فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح والسماح بالنوافذ المنبثقة.');
      }

      printWindow.document.title = fileName;
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      toast.success('تم فتح أمر الطباعة بنجاح!');

    } catch (error) {
      console.error('Error in print work order:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء تحضير أمر الطباعة: ${errorMessage}`);
    }
  };

  const handlePrint = () => {
    if (localPrintItems.length === 0) {
      toast.error('لا توجد عناصر للطباعة');
      return;
    }

    // ✅ استخدام نفس تصميم الفاتورة من الكود المرجعي
    const printInvoice = async () => {
      try {
        const testWindow = window.open('', '_blank', 'width=1,height=1');
        if (!testWindow || testWindow.closed || typeof testWindow.closed === 'undefined') {
          toast.error('يرجى السماح بالنوافذ المنبثقة في المتصفح لتمكين الطباعة');
          return;
        }
        testWindow.close();

        // ✅ إصلاح تنسيق التاريخ
        const currentDate = new Date(invoiceDate);
        const formattedDate = currentDate.toLocaleDateString('ar-LY');
        
        // ✅ إنشاء اسم الملف مع معلومات العميل والعقود والتاريخ
        const contractsList = selectedContracts.join('-');
        const dateFormatted = currentDate.toISOString().slice(0, 10).replace(/-/g, '_');
        const customerNameForFile = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
        const fileName = `فاتورة_طباعة_${customerNameForFile}_عقود_${contractsList}_${dateFormatted}`;
        
        // ✅ إعداد عناصر الجدول مع صفوف ثابتة
        const FIXED_ROWS = 10;
        const displayItems = [...localPrintItems];
        
        while (displayItems.length < FIXED_ROWS) {
          displayItems.push({
            size: '',
            quantity: '',
            faces: '',
            totalFaces: '',
            area: '',
            totalArea: '',
            pricePerMeter: '',
            totalPrice: '',
            width: '',
            height: ''
          } as any);
        }

        const htmlContent = `
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${fileName}</title>
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
              
              .invoice-container {
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
              
              .invoice-info {
                text-align: left;
                direction: ltr;
                order: 2;
              }
              
              .invoice-title {
                font-size: 28px;
                font-weight: bold;
                color: #000;
                margin-bottom: 10px;
              }
              
              .invoice-details {
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
              
              .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 25px;
                table-layout: fixed;
              }
              
              .items-table th {
                background: #000;
                color: white;
                padding: 12px 8px;
                text-align: center;
                font-weight: bold;
                border: 1px solid #000;
                font-size: 11px;
                height: 40px;
              }
              
              .items-table td {
                padding: 10px 8px;
                text-align: center;
                border: 1px solid #ddd;
                font-size: 10px;
                vertical-align: middle;
                height: 35px;
              }
              
              .items-table tbody tr:nth-child(even) {
                background: #f8f9fa;
              }
              
              .items-table tbody tr:hover {
                background: #e9ecef;
              }
              
              .items-table tbody tr.empty-row {
                background: white;
              }
              
              .items-table tbody tr.empty-row:nth-child(even) {
                background: #f8f9fa;
              }
              
              .total-section {
                margin-top: auto;
                border-top: 2px solid #000;
                padding-top: 20px;
              }
              
              .total-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                font-size: 14px;
              }

              .total-row.subtotal {
                font-size: 16px;
                font-weight: bold;
                border-bottom: 1px solid #ddd;
                margin-bottom: 10px;
              }

              .total-row.discount {
                font-size: 16px;
                font-weight: bold;
                color: #28a745;
                margin-bottom: 10px;
              }
              
              .total-row.grand-total {
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
                
                .invoice-container {
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
            <div class="invoice-container">
              <div class="header">
                <div class="company-info">
                  <img src="/logofares.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
                  <div class="company-details">
                    طرابلس – طريق المطار، حي الزهور<br>
                    هاتف: 0912612255
                  </div>
                </div>
                
                <div class="invoice-info">
                  <div class="invoice-title">INVOICE</div>
                  <div class="invoice-details">
                    رقم الفاتورة: ${invoiceNumber}<br>
                    التاريخ: ${formattedDate}<br>
                    العملة: ${currency.name}
                  </div>
                </div>
              </div>
              
              <div class="customer-info">
                <div class="customer-title">بيانات العميل</div>
                <div class="customer-details">
                  <strong>الاسم:</strong> ${customerName}<br>
                  <strong>العقود المرتبطة:</strong> ${selectedContracts.join(', ')}<br>
                  <strong>تاريخ الفاتورة:</strong> ${formattedDate}
                </div>
              </div>
              
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width: 6%">#</th>
                    <th style="width: 24%">المقاس</th>
                    <th style="width: 8%">عدد اللوحات</th>
                    <th style="width: 8%">أوجه/لوحة</th>
                    <th style="width: 8%">إجمالي الأوجه</th>
                    <th style="width: 10%">الأبعاد (م)</th>
                    <th style="width: 10%">المساحة/الوجه</th>
                    <th style="width: 10%">سعر المتر</th>
                    <th style="width: 16%">إجمالي السعر</th>
                  </tr>
                </thead>
                <tbody>
                  ${displayItems.map((item, index) => {
                    const isEmpty = !item.size;
                    
                    return `
                      <tr class="${isEmpty ? 'empty-row' : ''}">
                        <td>${isEmpty ? '' : index + 1}</td>
                        <td style="text-align: right; padding-right: 8px;">
                          ${isEmpty ? '' : `لوحة إعلانية مقاس ${item.size}`}
                        </td>
                        <td>${isEmpty ? '' : (typeof item.quantity === 'number' ? formatArabicNumber(item.quantity) : item.quantity)}</td>
                        <td>${isEmpty ? '' : (typeof item.faces === 'number' ? item.faces : item.faces)}</td>
                        <td>${isEmpty ? '' : (typeof item.totalFaces === 'number' ? formatArabicNumber(item.totalFaces) : item.totalFaces)}</td>
                        <td>${isEmpty ? '' : (typeof item.width === 'number' && typeof item.height === 'number' ? `${item.width} × ${item.height}` : '')}</td>
                        <td>${isEmpty ? '' : (typeof item.area === 'number' ? `${item.area.toFixed(2)} م²` : item.area)}</td>
                        <td>${isEmpty ? '' : (typeof item.pricePerMeter === 'number' ? `${formatArabicNumber(item.pricePerMeter)} ${currency.symbol}` : item.pricePerMeter)}</td>
                        <td>${isEmpty ? '' : (typeof item.totalPrice === 'number' ? `${formatArabicNumber(item.totalPrice)} ${currency.symbol}` : item.totalPrice)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
              
              <div class="total-section">
                ${discount > 0 ? `
                  <div class="total-row subtotal">
                    <span>المجموع الفرعي:</span>
                    <span>${formatArabicNumber(subtotal)} ${currency.symbol}</span>
                  </div>
                  <div class="total-row discount">
                    <span>خصم (${discountType === 'percentage' ? `${discount}%` : `${formatArabicNumber(discount)} ${currency.symbol}`}):</span>
                    <span>- ${formatArabicNumber(discountAmount)} ${currency.symbol}</span>
                  </div>
                ` : ''}
                
                ${includeAccountBalance && accountPayments > 0 ? `
                  <div class="total-row discount">
                    <span>رصيد الحساب:</span>
                    <span>- ${formatArabicNumber(accountPayments)} ${currency.symbol}</span>
                  </div>
                ` : ''}
                
                <div class="total-row grand-total">
                  <span>المجموع الإجمالي:</span>
                  <span class="currency">${formatArabicNumber(total)} ${currency.symbol}</span>
                </div>
                
                <div style="margin-top: 15px; font-size: 13px; color: #666; text-align: center;">
                  المبلغ بالكلمات: ${formatArabicNumber(total)} ${currency.writtenName}
                </div>
              </div>
              
              <div class="footer">
                شكراً لتعاملكم معنا | Thank you for your business<br>
                هذه فاتورة إلكترونية ولا تحتاج إلى ختم أو توقيع
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

        const windowFeatures = 'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no';
        const printWindow = window.open('', '_blank', windowFeatures);

        if (!printWindow) {
          throw new Error('فشل في فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح والسماح بالنوافذ المنبثقة.');
        }

        // ✅ تعيين عنوان النافذة مع معلومات العميل والعقود والتاريخ
        printWindow.document.title = fileName;

        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        toast.success(`تم فتح الفاتورة للطباعة بنجاح بعملة ${currency.name}!`);

      } catch (error) {
        console.error('Error in print invoice:', error);
        const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
        toast.error(`حدث خطأ أثناء تحضير الفاتورة للطباعة: ${errorMessage}`);
      }
    };

    printInvoice();
  };

  const handleSave = () => {
    if (localPrintItems.length === 0) {
      toast.error('لا توجد عناصر للحفظ');
      return;
    }
    onSaveInvoice();
  };

  const InvoicePreview = () => (
    <div className="bg-background text-foreground p-6 rounded-lg border border-border shadow-card w-full" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-primary">
        <div className="text-right">
          <img src="/logofares.svg" alt="شعار الشركة" className="max-w-[200px] h-auto mb-3" />
          <div className="text-sm text-muted-foreground">
            طرابلس – طريق المطار، حي الزهور<br />
            هاتف: 0912612255
          </div>
        </div>
        <div className="text-left" dir="ltr">
          <h1 className="text-3xl font-bold text-primary mb-3">INVOICE</h1>
          <div className="text-sm text-muted-foreground">
            رقم الفاتورة: {invoiceNumber}<br />
            التاريخ: {new Date(invoiceDate).toLocaleDateString('ar-LY')}<br />
            العملة: {currency.name}
          </div>
        </div>
      </div>

      {/* Customer Info */}
      <div className="expenses-preview-item mb-6 p-4 border-r-4 border-primary">
        <h3 className="expenses-preview-label mb-3 text-lg">بيانات العميل</h3>
        <div className="text-sm space-y-1">
          <div><strong>الاسم:</strong> {customerName}</div>
          <div><strong>العقود المرتبطة:</strong> {selectedContracts.join(', ')}</div>
          <div><strong>تاريخ الفاتورة:</strong> {new Date(invoiceDate).toLocaleDateString('ar-LY')}</div>
        </div>
      </div>

      {/* Items Table */}
      {localPrintItems.length > 0 && (
        <div className="mb-6">
          <h3 className="expenses-preview-label mb-4 text-lg">تفاصيل الطباعة:</h3>
          <div className="expenses-table-container overflow-x-auto">
            <table className="w-full border-collapse border border-border text-sm">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="border border-border p-3 text-center font-bold">المقاس</th>
                  <th className="border border-border p-3 text-center font-bold">عدد اللوحات</th>
                  <th className="border border-border p-3 text-center font-bold">أوجه/لوحة</th>
                  <th className="border border-border p-3 text-center font-bold">إجمالي الأوجه</th>
                  <th className="border border-border p-3 text-center font-bold">الأبعاد (م)</th>
                  <th className="border border-border p-3 text-center font-bold">المساحة/الوجه</th>
                  <th className="border border-border p-3 text-center font-bold">سعر المتر</th>
                  <th className="border border-border p-3 text-center font-bold">إجمالي السعر</th>
                </tr>
              </thead>
              <tbody>
                {localPrintItems.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-card/50' : 'bg-background'}>
                    <td className="border border-border p-3 text-center font-medium">{item.size}</td>
                    <td className="border border-border p-3 text-center">{formatArabicNumber(item.quantity)}</td>
                    <td className="border border-border p-3 text-center">{formatArabicNumber(item.faces)}</td>
                    <td className="border border-border p-3 text-center font-medium">{formatArabicNumber(item.totalFaces)}</td>
                    <td className="border border-border p-3 text-center">{item.width} × {item.height}</td>
                    <td className="border border-border p-3 text-center">{item.area.toFixed(2)} م²</td>
                    <td className="border border-border p-3 text-center">{formatArabicNumber(item.pricePerMeter)} {currency.symbol}</td>
                    <td className="border border-border p-3 text-center expenses-amount-calculated font-bold">{formatArabicNumber(item.totalPrice)} {currency.symbol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Totals */}
      {localPrintItems.length > 0 && (
        <div className="border-t-2 border-primary pt-6">
          <div className="flex justify-end">
            <div className="w-[400px]">
              <div className="flex justify-between py-2 text-sm">
                <span>المجموع الفرعي:</span>
                <span className="expenses-amount-calculated font-bold">{formatArabicNumber(subtotal)} {currency.symbol}</span>
              </div>
              
              {discount > 0 && (
                <div className="flex justify-between py-2 text-sm text-green-400">
                  <span>خصم ({discountType === 'percentage' ? `${discount}%` : `${formatArabicNumber(discount)} ${currency.symbol}`}):</span>
                  <span className="font-bold">- {formatArabicNumber(discountAmount)} {currency.symbol}</span>
                </div>
              )}

              {includeAccountBalance && accountPayments > 0 && (
                <div className="flex justify-between py-2 text-sm stat-blue">
                  <span>رصيد الحساب:</span>
                  <span className="font-bold">- {formatArabicNumber(accountPayments)} {currency.symbol}</span>
                </div>
              )}

              <div className="flex justify-between py-4 text-xl font-bold bg-primary text-primary-foreground px-6 rounded-lg mt-4">
                <span>المجموع الإجمالي:</span>
                <span className="text-primary-glow">{formatArabicNumber(total)} {currency.symbol}</span>
              </div>

              <div className="text-center mt-4 text-sm text-muted-foreground">
                المبلغ بالكلمات: {formatArabicNumber(total)} {currency.writtenName}
              </div>
            </div>
          </div>
        </div>
      )}

      {notes && (
        <div className="mt-6 p-4 bg-accent/20 border border-accent rounded-lg">
          <strong className="text-sm">ملاحظات:</strong> <span className="text-sm">{notes}</span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-muted-foreground border-t border-border pt-4">
        شكراً لتعاملكم معنا | Thank you for your business<br />
        هذه فاتورة إلكترونية ولا تحتاج إلى ختم أو توقيع
      </div>
    </div>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div 
        className="bg-background border border-border rounded-lg shadow-lg w-[96vw] max-h-[96vh] flex flex-col"
        dir="rtl"
      >
        {/* Header */}
        <div className="border-b border-border pb-4 px-6 pt-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="expenses-preview-title flex items-center gap-3 text-xl font-bold text-primary">
              <Receipt className="h-6 w-6" />
              فاتورة طباعة عصرية
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Tabs */}
          <div className="expenses-actions mt-4 gap-4">
            <Button
              variant={activeTab === 'setup' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('setup')}
              className="expenses-action-btn text-sm px-4 py-2"
            >
              <Settings className="h-4 w-4" />
              الإعداد
            </Button>
            <Button
              variant={activeTab === 'preview' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('preview')}
              className="expenses-action-btn text-sm px-4 py-2"
            >
              <Eye className="h-4 w-4" />
              معاينة
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          {activeTab === 'setup' ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 py-4">
              {/* Left Panel - Configuration */}
              <div className="space-y-6">
                {/* Invoice Settings */}
                <Card className="expenses-preview-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="expenses-preview-label flex items-center gap-3 text-lg">
                      <FileText className="h-5 w-5" />
                      إعدادات الفاتورة
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="expenses-form-grid gap-4">
                      <div>
                        <label className="expenses-form-label mb-2 block text-sm">رقم الفاتورة</label>
                        <Input
                          value={invoiceNumber}
                          readOnly
                          className="text-right text-sm p-3 h-10 bg-muted cursor-not-allowed"
                          title="رقم الفاتورة يتم توليده تلقائياً"
                        />
                        <p className="text-xs text-muted-foreground mt-1">يتم توليد رقم الفاتورة تلقائياً</p>
                      </div>
                      <div>
                        <label className="expenses-form-label mb-2 block text-sm">التاريخ</label>
                        <Input
                          type="date"
                          value={invoiceDate}
                          onChange={(e) => setInvoiceDate(e.target.value)}
                          className="text-sm p-3 h-10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="expenses-form-label mb-2 block text-sm">العملة</label>
                      <select
                        value={currency.code}
                        onChange={(e) => setCurrency(CURRENCIES.find(c => c.code === e.target.value) || CURRENCIES[0])}
                        className="w-full p-3 h-10 border border-border rounded-md text-right bg-input text-foreground text-sm"
                      >
                        {CURRENCIES.map(curr => (
                          <option key={curr.code} value={curr.code}>
                            {curr.name} ({curr.symbol})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="expenses-form-label mb-2 block text-sm">ملاحظات</label>
                      <Input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="ملاحظات إضافية..."
                        className="text-right text-sm p-3 h-10"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Contract Selection */}
                <Card className="expenses-preview-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="expenses-preview-label text-lg">اختيار العقود</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {contracts.map((contract) => (
                        <div
                          key={contract.Contract_Number}
                          className="flex items-center space-x-3 space-x-reverse p-3 border border-border rounded-lg hover:bg-card/50 cursor-pointer transition-colors"
                          onClick={(e) => handleRowClick(contract.Contract_Number, e)}
                        >
                          <Checkbox
                            checked={selectedContracts.includes(contract.Contract_Number)}
                            onCheckedChange={() => handleContractToggle(contract.Contract_Number)}
                            className="w-4 h-4"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1">
                            <div className="expenses-contract-number text-sm">عقد رقم {contract.Contract_Number}</div>
                            <div className="expenses-preview-text text-xs">{contract['Ad Type']}</div>
                          </div>
                          <Badge variant="outline" className="border-primary text-primary text-xs px-2 py-1">
                            {formatArabicNumber(contract['Total Rent'])} د.ل
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        💡 انقر على أي صف لاختيار العقد، أو انقر على المربع للتحديد المباشر
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Discount & Account Balance */}
                <Card className="expenses-preview-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="expenses-preview-label text-lg">خصومات ورصيد</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="expenses-form-label mb-2 block text-sm">قيمة الخصم</label>
                        <Input
                          type="number"
                          value={discount}
                          onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                          className="text-right text-sm p-3 h-10"
                        />
                      </div>
                      <div>
                        <label className="expenses-form-label mb-2 block text-sm">النوع</label>
                        <select
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                          className="w-full p-3 h-10 border border-border rounded-md bg-input text-foreground text-sm"
                        >
                          <option value="percentage">%</option>
                          <option value="fixed">ثابت</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 space-x-reverse">
                      <Checkbox
                        checked={includeAccountBalance}
                        onCheckedChange={onIncludeAccountBalance}
                        className="w-4 h-4"
                      />
                      <label className="text-sm">
                        خصم رصيد الحساب ({formatArabicNumber(accountPayments)} {currency.symbol})
                      </label>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Panel - Items */}
              <div className="space-y-6">
                <Card className="expenses-preview-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="expenses-preview-label flex items-center gap-3 text-lg">
                      <Calculator className="h-5 w-5" />
                      عناصر الطباعة ({localPrintItems.length})
                      {localPrintItems.length > 0 && (
                        <span className="text-sm font-normal text-muted-foreground">
                          - المجموع: {formatArabicNumber(subtotal)} {currency.symbol}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedContracts.length === 0 ? (
                      <div className="expenses-empty-state py-12">
                        <Calculator className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg">لا توجد عقود محددة</p>
                        <p className="text-sm">يرجى اختيار العقود أولاً لعرض عناصر الطباعة</p>
                      </div>
                    ) : localPrintItems.length === 0 ? (
                      <div className="expenses-empty-state py-12">
                        <Calculator className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg">لا توجد عناصر للطباعة</p>
                        <p className="text-sm">لم يتم العثور على لوحات مرتبطة بالعقود المحددة</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {localPrintItems.map((item, index) => (
                          <div key={index} className="border border-border rounded-lg p-4 bg-card/50">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="expenses-preview-label text-lg">
                                {item.size} ({item.width} × {item.height} م)
                              </h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(index)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="expenses-form-grid gap-4">
                              <div>
                                <label className="block text-xs text-muted-foreground mb-2">عدد اللوحات</label>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handlePrintItemUpdate(index, 'quantity', Number(e.target.value) || 0)}
                                  className="h-9 text-center text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-muted-foreground mb-2">إجمالي الأوجه</label>
                                <Input
                                  type="number"
                                  value={item.totalFaces}
                                  onChange={(e) => handlePrintItemUpdate(index, 'totalFaces', Number(e.target.value) || 0)}
                                  className="h-9 text-center text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-muted-foreground mb-2">سعر المتر</label>
                                <Input
                                  type="number"
                                  value={item.pricePerMeter}
                                  onChange={(e) => handlePrintItemUpdate(index, 'pricePerMeter', Number(e.target.value) || 0)}
                                  className="h-9 text-center text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-muted-foreground mb-2">الإجمالي</label>
                                <div className="h-9 bg-muted rounded flex items-center justify-center text-sm font-medium expenses-amount-calculated">
                                  {formatArabicNumber(item.totalPrice)} {currency.symbol}
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-3 text-xs text-muted-foreground">
                              الحساب: {item.width} × {item.height} × {item.totalFaces} × {item.pricePerMeter} = {formatArabicNumber(item.totalPrice)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Summary */}
                {localPrintItems.length > 0 && (
                  <Card className="expenses-preview-card">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>المجموع الفرعي:</span>
                          <span className="expenses-amount-calculated font-bold">{formatArabicNumber(subtotal)} {currency.symbol}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-sm stat-green">
                            <span>الخصم:</span>
                            <span className="font-bold">- {formatArabicNumber(discountAmount)} {currency.symbol}</span>
                          </div>
                        )}
                        {includeAccountBalance && accountPayments > 0 && (
                          <div className="flex justify-between text-sm stat-blue">
                            <span>رصيد الحساب:</span>
                            <span className="font-bold">- {formatArabicNumber(accountPayments)} {currency.symbol}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>الإجمالي:</span>
                          <span className="text-primary">{formatArabicNumber(total)} {currency.symbol}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            <div className="py-4">
              <InvoicePreview />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-border pt-4 pb-4 px-6 flex justify-between flex-shrink-0">
          <div className="expenses-actions">
            <Button variant="outline" onClick={onClose} className="text-sm px-6 py-2">
              إغلاق
            </Button>
          </div>
          
          <div className="expenses-actions gap-4">
            <Button
              variant="outline"
              onClick={handleSave}
              className="expenses-action-btn text-sm px-6 py-2"
              disabled={localPrintItems.length === 0}
            >
              <Save className="h-4 w-4" />
              حفظ في الحساب
            </Button>
            <Button
              variant="outline"
              onClick={handlePrintWorkOrder}
              className="expenses-action-btn text-sm px-6 py-2 border-blue-500 text-blue-600 hover:bg-blue-50"
              disabled={localPrintItems.length === 0}
            >
              <FileText className="h-4 w-4" />
              أمر طباعة (بدون أسعار)
            </Button>
            <Button
              onClick={handlePrint}
              className="expenses-action-btn bg-gradient-to-r from-primary to-primary-glow text-sm px-6 py-2"
              disabled={localPrintItems.length === 0}
            >
              <Printer className="h-4 w-4" />
              طباعة الفاتورة
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}