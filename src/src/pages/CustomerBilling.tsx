import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import { Printer, Calculator, Receipt, Info, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllBillboards } from '@/services/supabaseService';
import { getContractWithBillboards } from '@/services/contractService';
import ContractPDFDialog from './ContractPDFDialog';

// Import components
import { SummaryCards } from '@/components/billing/SummaryCards';
import { ContractSection } from '@/components/billing/ContractSection';
import { PaymentSection } from '@/components/billing/PaymentSection';
import ModernPrintInvoiceDialog from '@/components/billing/ModernPrintInvoiceDialog';

// ✅ Import new receipt and account statement dialogs
import ReceiptPrintDialog from '@/components/billing/ReceiptPrintDialog';
import AccountStatementDialog from '@/components/billing/AccountStatementDialog';

// Import types and utilities
import {
  PaymentRow,
  ContractRow,
} from '@/components/billing/BillingTypes';

import {
  calculateRemainingBalanceAfterPayment,
  getContractDetails
} from '@/components/billing/BillingUtils';

interface PrintItem {
  size: string;
  quantity: number;
  faces: number; // عدد الأوجه لكل لوحة
  totalFaces: number; // إجمالي الأوجه (quantity × faces)
  area: number;
  pricePerMeter: number;
  totalArea: number;
  totalPrice: number;
}

export default function CustomerBilling() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const paramId = params.get('id') || '';
  const paramName = params.get('name') || '';
  const modernPrintFlag = params.get('modernPrint');

  // Basic state
  const [customerId, setCustomerId] = useState<string>(paramId);
  const [customerName, setCustomerName] = useState<string>(paramName);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [allBillboards, setAllBillboards] = useState<any[]>([]);

  // Dialog states
  const [editReceiptOpen, setEditReceiptOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<PaymentRow | null>(null);
  const [editReceiptAmount, setEditReceiptAmount] = useState('');
  const [editReceiptMethod, setEditReceiptMethod] = useState('');
  const [editReceiptReference, setEditReceiptReference] = useState('');
  const [editReceiptNotes, setEditReceiptNotes] = useState('');
  const [editReceiptDate, setEditReceiptDate] = useState('');

  const [addDebtOpen, setAddDebtOpen] = useState(false);
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNotes, setDebtNotes] = useState('');
  const [debtDate, setDebtDate] = useState<string>(()=> new Date().toISOString().slice(0,10));

  // Enhanced print invoice states
  const [printContractInvoiceOpen, setPrintContractInvoiceOpen] = useState(false);
  const [selectedContractsForInv, setSelectedContractsForInv] = useState<string[]>([]);
  const [sizeCounts, setSizeCounts] = useState<Record<string, number>>({});
  const [printPrices, setPrintPrices] = useState<Record<string, number>>({});
  const [sizeAreas, setSizeAreas] = useState<Record<string, number>>({});
  const [sizeFaces, setSizeFaces] = useState<Record<string, number>>({});
  const [printItems, setPrintItems] = useState<PrintItem[]>([]);
  const [includeAccountBalance, setIncludeAccountBalance] = useState(false);

  // Contract PDF Dialog state
  const [contractPDFOpen, setContractPDFOpen] = useState(false);
  const [selectedContractForPDF, setSelectedContractForPDF] = useState<any>(null);

  // ✅ NEW: Receipt and Account Statement dialog states
  const [receiptPrintOpen, setReceiptPrintOpen] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<any>(null);
  const [accountStatementOpen, setAccountStatementOpen] = useState(false);

  // Account payment dialog states
  const [accountPaymentOpen, setAccountPaymentOpen] = useState(false);
  const [accountPaymentAmount, setAccountPaymentAmount] = useState('');
  const [accountPaymentMethod, setAccountPaymentMethod] = useState('');
  const [accountPaymentReference, setAccountPaymentReference] = useState('');
  const [accountPaymentNotes, setAccountPaymentNotes] = useState('');
  const [accountPaymentDate, setAccountPaymentDate] = useState<string>(()=> new Date().toISOString().slice(0,10));
  const [accountPaymentContract, setAccountPaymentContract] = useState('');
  const [accountPaymentToGeneral, setAccountPaymentToGeneral] = useState(true);

  useEffect(() => {
    if (modernPrintFlag) {
      setPrintContractInvoiceOpen(true);
      const cleanedParams = new URLSearchParams(location.search);
      cleanedParams.delete('modernPrint');
      const nextSearch = cleanedParams.toString();
      navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true });
    }
  }, [location.pathname, location.search, modernPrintFlag, navigate]);

  // Initialize customer data
  useEffect(() => {
    (async () => {
      try {
        if (customerId && !customerName) {
          const { data } = await supabase.from('customers').select('name').eq('id', customerId).single();
          setCustomerName(data?.name || '');
        }
        if (!customerId && customerName) {
          const { data } = await supabase.from('customers').select('id').ilike('name', customerName).limit(1).maybeSingle();
          if (data?.id) setCustomerId(data.id);
        }
      } catch {}
    })();
  }, [customerId, customerName]);

  // ✅ FIXED: Load data with proper contract-payment relationship
  const loadData = async () => {
    try {
      let paymentsData: PaymentRow[] = [];
      if (customerId) {
        const p = await supabase.from('customer_payments').select('*').eq('customer_id', customerId).order('created_at', { ascending: true });
        if (!p.error) paymentsData = p.data || [];
      }
      if ((!paymentsData || paymentsData.length === 0) && customerName) {
        const p = await supabase.from('customer_payments').select('*').ilike('customer_name', `%${customerName}%`).order('created_at', { ascending: true });
        if (!p.error) paymentsData = p.data || [];
      }
      setPayments(paymentsData);

      let contractsData: ContractRow[] = [];
      if (customerId) {
        const c = await supabase.from('Contract').select('*').eq('customer_id', customerId);
        if (!c.error) contractsData = c.data || [];
      }
      if ((!contractsData || contractsData.length === 0) && customerName) {
        const c = await supabase.from('Contract').select('*').ilike('Customer Name', `%${customerName}%`);
        if (!c.error) contractsData = c.data || [];
      }
      setContracts(contractsData);

      try {
        const billboards = await fetchAllBillboards();
        setAllBillboards(billboards as any);
      } catch {
        setAllBillboards([]);
      }
    } catch (e) {
      console.error(e);
      toast.error('فشل تحميل البيانات');
    }
  };

  useEffect(() => { loadData(); }, [customerId, customerName]);

  // ✅ إصلاح حساب عدد الأوجه - حساب إجمالي الأوجه من جميع اللوحات
  useEffect(() => {
    const sel = new Set(selectedContractsForInv);
    const boards = allBillboards.filter((b: any) => 
      sel.has(String(b.Contract_Number || '')) && 
      (!customerName || String(b.Customer_Name || '').toLowerCase().includes(customerName.toLowerCase()))
    );
    
    const counts: Record<string, number> = {};
    const totalFacesPerSize: Record<string, number> = {};
    const facesPerBoard: Record<string, number> = {};
    
    for (const b of boards) {
      const size = String(b.Size || b.size || '—');
      const faceCount = Number(b.Faces || b.faces || b.Number_of_Faces || b.Faces_Count || b.faces_count || 1);
      
      counts[size] = (counts[size] || 0) + 1;
      totalFacesPerSize[size] = (totalFacesPerSize[size] || 0) + faceCount;
      
      // حفظ عدد الأوجه لكل لوحة (للعرض)
      if (!facesPerBoard[size]) {
        facesPerBoard[size] = faceCount;
      }
    }
    
    setSizeCounts(counts);
    setSizeFaces(facesPerBoard);
    
    console.log('✅ حساب الأوجه الجديد:', {
      counts,
      totalFacesPerSize,
      facesPerBoard
    });
  }, [selectedContractsForInv, allBillboards, customerName]);

  // Load size information and print prices
  useEffect(() => {
    const sizes = Object.keys(sizeCounts);
    if (sizes.length === 0) { 
      setPrintPrices({});
      setSizeAreas({});
      return; 
    }

    (async () => {
      try {
        let sizeData: any[] = [];
        
        const sizeRes1 = await supabase
          .from('Size')
          .select('name, width, height')
          .in('name', sizes);
        
        if (!sizeRes1.error && sizeRes1.data) {
          sizeData = sizeRes1.data;
        } else {
          const sizeRes2 = await supabase
            .from('sizes')
            .select('name, width, height')
            .in('name', sizes);
          
          if (!sizeRes2.error && sizeRes2.data) {
            sizeData = sizeRes2.data;
          }
        }

        const areas: Record<string, number> = {};
        const prices: Record<string, number> = {};
        
        sizes.forEach(size => {
          const sizeInfo = sizeData.find(s => s.name === size);
          if (sizeInfo && sizeInfo.width && sizeInfo.height) {
            const width = parseFloat(sizeInfo.width);
            const height = parseFloat(sizeInfo.height);
            areas[size] = width * height;
          } else {
            areas[size] = 1;
          }
          prices[size] = 25;
        });

        setSizeAreas(areas);
        setPrintPrices(prices);

        try {
          const { data: pricingData, error: pricingError } = await supabase
            .from('installation_print_pricing')
            .select('size, print_price')
            .in('size', sizes);
          
          if (!pricingError && Array.isArray(pricingData)) {
            const updatedPrices = { ...prices };
            pricingData.forEach((r: any) => {
              if (r.size && r.print_price) {
                updatedPrices[r.size] = Number(r.print_price) || 25;
              }
            });
            setPrintPrices(updatedPrices);
          }
        } catch (pricingErr) {
          console.log('Could not load pricing data, using defaults');
        }

      } catch (err) {
        console.error('Error loading size data:', err);
        const defaultAreas: Record<string, number> = {};
        const defaultPrices: Record<string, number> = {};
        sizes.forEach(size => {
          defaultAreas[size] = 1;
          defaultPrices[size] = 25;
        });
        setSizeAreas(defaultAreas);
        setPrintPrices(defaultPrices);
      }
    })();
  }, [sizeCounts]);

  // ✅ تحديث حساب عناصر الطباعة مع إجمالي الأوجه الصحيح
  useEffect(() => {
    if (Object.keys(sizeCounts).length > 0) {
      const sel = new Set(selectedContractsForInv);
      const boards = allBillboards.filter((b: any) => 
        sel.has(String(b.Contract_Number || '')) && 
        (!customerName || String(b.Customer_Name || '').toLowerCase().includes(customerName.toLowerCase()))
      );

      const items: PrintItem[] = Object.entries(sizeCounts).map(([size, quantity]) => {
        const area = sizeAreas[size] || 1;
        const facesPerBoard = sizeFaces[size] || 1;
        const pricePerMeter = printPrices[size] || 25;
        
        // ✅ حساب إجمالي الأوجه من جميع اللوحات بهذا المقاس
        const boardsOfThisSize = boards.filter(b => String(b.Size || b.size || '—') === size);
        const totalFaces = boardsOfThisSize.reduce((sum, board) => {
          return sum + Number(board.Faces || board.faces || board.Number_of_Faces || board.Faces_Count || board.faces_count || 1);
        }, 0);
        
        const totalArea = area * totalFaces; // المساحة × إجمالي الأوجه
        const totalPrice = totalArea * pricePerMeter;

        console.log(`✅ ${size}: ${quantity} لوحة، ${facesPerBoard} وجه/لوحة، إجمالي الأوجه: ${totalFaces}`);

        return {
          size,
          quantity,
          faces: facesPerBoard, // عدد الأوجه لكل لوحة
          totalFaces, // إجمالي الأوجه
          area,
          pricePerMeter,
          totalArea,
          totalPrice
        };
      });
      setPrintItems(items);
    } else {
      setPrintItems([]);
    }
  }, [sizeCounts, sizeAreas, printPrices, sizeFaces, selectedContractsForInv, allBillboards, customerName]);

  // ✅ FIXED: Calculate financial totals with proper contract-payment relationship
  const totalRent = useMemo(() => contracts.reduce((s, c) => s + (Number(c['Total Rent']) || 0), 0), [contracts]);
  
  const totalDebits = useMemo(() => {
    let totalDebit = totalRent;
    payments.forEach(p => {
      const amount = Number(p.amount) || 0;
      if (p.entry_type === 'invoice' || p.entry_type === 'debt') {
        totalDebit += amount;
      }
    });
    return totalDebit;
  }, [payments, totalRent]);
  
  const totalCredits = useMemo(() => {
    return payments.reduce((s, p) => {
      const amount = Number(p.amount) || 0;
      if (p.entry_type === 'receipt' || p.entry_type === 'account_payment') {
        return s + amount;
      }
      return s;
    }, 0);
  }, [payments]);
  
  // ✅ إصلاح حساب ال��تبقي - إظهار الرصيد السالب عندما يكون المدفوع أكثر من المستحق
  const balance = totalDebits - totalCredits;

  // ✅ إصلاح حساب رصيد الحساب العام - فقط المدفوعات العامة
  const accountPayments = useMemo(() => 
    payments.filter(p => p.entry_type === 'account_payment')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0), [payments]);

  // ✅ NEW: Calculate payments per contract using contract_number from customer_payments
  const getContractPayments = (contractNumber: number): number => {
    return payments
      .filter(p => 
        p.contract_number === contractNumber && 
        (p.entry_type === 'receipt' || p.entry_type === 'account_payment')
      )
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  };

  // ✅ NEW: Calculate remaining balance for each contract
  const getContractRemaining = (contract: ContractRow): number => {
    const contractTotal = Number(contract['Total Rent']) || 0;
    const contractPaid = getContractPayments(contract.Contract_Number);
    return contractTotal - contractPaid;
  };

  // Event handlers
  const openEditReceipt = (payment: PaymentRow) => {
    setEditingReceipt(payment);
    setEditReceiptAmount(String(payment.amount || ''));
    setEditReceiptMethod(payment.method || '');
    setEditReceiptReference(payment.reference || '');
    setEditReceiptNotes(payment.notes || '');
    setEditReceiptDate(payment.paid_at ? payment.paid_at.split('T')[0] : '');
    setEditReceiptOpen(true);
  };

  // ✅ NEW: Open receipt print dialog
  const openReceiptPrint = (payment: PaymentRow) => {
    setSelectedPaymentForReceipt(payment);
    setReceiptPrintOpen(true);
  };

  // ✅ NEW: Open account statement dialog
  const openAccountStatement = () => {
    setAccountStatementOpen(true);
  };

  const saveReceiptEdit = async () => {
    if (!editingReceipt) return;
    try {
      const { error } = await supabase.from('customer_payments').update({
        amount: Number(editReceiptAmount) || 0,
        method: editReceiptMethod || null,
        reference: editReceiptReference || null,
        notes: editReceiptNotes || null,
        paid_at: editReceiptDate ? new Date(editReceiptDate).toISOString() : null,
      }).eq('id', editingReceipt.id).select();
      
      if (error) { 
        console.error('Update error:', error);
        toast.error('فشل في تحديث الإيصال: ' + error.message); 
        return; 
      }
      
      toast.success('تم تحديث الإيصال');
      setEditReceiptOpen(false); 
      setEditingReceipt(null);
      await loadData();
    } catch (e) {
      console.error(e); 
      toast.error('خطأ في حفظ الإيصال');
    }
  };

  const deleteReceipt = async (id: string) => {
    if (!window.confirm('تأكيد حذف الإيصال؟')) return;
    try {
      const { error } = await supabase.from('customer_payments').delete().eq('id', id);
      if (error) { 
        toast.error('فشل الحذف'); 
        return; 
      }
      toast.success('تم الحذف');
      await loadData();
    } catch (e) { 
      console.error(e); 
      toast.error('خطأ في الحذف'); 
    }
  };

  const updatePrintItem = (index: number, field: keyof PrintItem, value: number) => {
    const newItems = [...printItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'pricePerMeter' || field === 'totalFaces') {
      newItems[index].totalArea = newItems[index].area * newItems[index].totalFaces;
      newItems[index].totalPrice = newItems[index].totalArea * newItems[index].pricePerMeter;
    }
    
    setPrintItems(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = printItems.filter((_, i) => i !== index);
    setPrintItems(newItems);
  };

  // ✅ تعديل الدالة ل��باعة فاتورة الطباعة فقط (بدون العقد)
  const printPrintingInvoiceOnly = async () => {
    if (selectedContractsForInv.length === 0) {
      toast.error('يرجى اختيار عقد واحد على الأقل');
      return;
    }

    if (printItems.length === 0) {
      toast.error('لا توجد عناصر للطباعة');
      return;
    }

    try {
      await printPrintingInvoicePage();
      toast.success('تم طباعة فاتورة الطباعة بنجاح');
      setPrintContractInvoiceOpen(false);
    } catch (error) {
      console.error('Error printing:', error);
      toast.error('فشل في الطباعة');
    }
  };

  const printPrintingInvoicePage = async () => {
    const totalFaces = printItems.reduce((s, item) => s + (Number(item.totalFaces) || 0), 0);

    const printRows = printItems.map(item => `
      <tr>
        <td>${item.size}</td>
        <td>${item.quantity}</td>
        <td>${item.faces}</td>
        <td>${item.totalFaces}</td>
        <td>${item.area.toFixed(2)} م²</td>
        <td>${item.totalArea.toFixed(2)} م²</td>
      </tr>
    `).join('');

    const invoiceHtml = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
      <title>فاتورة طباعة - ${customerName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); }
        body{font-family:'Cairo','Doran',Arial,sans-serif;padding:20px;max-width:1000px;margin:auto;background:white;color:black;min-height:100vh}
        h1{font-size:28px;text-align:center;margin-bottom:20px;color:#1f2937;text-shadow:0 2px 4px rgba(31,41,55,0.1)}
        .customer-info{margin-bottom:25px;background:#f9fafb;padding:20px;border-radius:10px;box-shadow:0 4px 6px rgba(0,0,0,0.1);border:1px solid #e5e7eb}
        .info-row{display:flex;justify-content:space-between;margin-bottom:8px;padding:5px 0;border-bottom:1px solid #e5e7eb}
        .info-label{font-weight:bold;color:#374151}
        .info-value{color:#1f2937}
        table{width:100%;border-collapse:collapse;margin:20px 0;background:white;box-shadow:0 4px 6px rgba(0,0,0,0.1);border-radius:10px;overflow:hidden}
        th,td{border:1px solid #d1d5db;padding:8px 6px;text-align:center;color:#1f2937;font-size:12px}
        th{background:#f3f4f6;font-weight:bold;color:#1f2937}
        .total-row{background:#fef3c7;font-weight:bold;color:#92400e;font-size:14px}
        .section-title{font-size:20px;font-weight:bold;margin:25px 0 15px 0;color:#1f2937;text-align:center}
        .signature{margin-top:30px;display:flex;justify-content:space-between}
        .signature div{text-align:center;width:200px}
        .signature-line{border-top:2px solid #374151;margin-top:40px;padding-top:10px}
        @media print{body{background:white!important;color:black!important;padding:10px} .customer-info,table{background:white!important} th{background:#f5f5f5!important;color:black!important} .total-row{background:#fff7ed!important;color:#92400e!important} @page{size:A4;margin:10mm}}
      </style></head><body>

      <h1>فاتورة طباعة</h1>

      <div class="customer-info">
        <div class="info-row">
          <span class="info-label">العميل:</span>
          <span class="info-value">${customerName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">التاريخ:</span>
          <span class="info-value">${new Date().toLocaleDateString('ar-LY')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">العقود المرتبطة:</span>
          <span class="info-value">${selectedContractsForInv.join(', ')}</span>
        </div>
      </div>

      <div class="section-title">تفاصيل الطباعة:</div>
      <table>
        <thead>
          <tr>
            <th>المقاس</th>
            <th>عدد اللوحات</th>
            <th>أوجه/لوحة</th>
            <th>إجمالي الأوجه</th>
            <th>المساحة/الوحدة</th>
            <th>إجمالي المساحة</th>
          </tr>
        </thead>
        <tbody>
          ${printRows}
          <tr class="total-row">
            <td colspan="5">الإجمالي النهائي (أوجه)</td>
            <td>${totalFaces.toLocaleString('ar-LY')} وحدة</td>
          </tr>
        </tbody>
      </table>
      
      <div class="signature">
        <div>
          <div class="signature-line">توقيع العميل</div>
        </div>
        <div>
          <div class="signature-line">توقيع الشركة</div>
        </div>
      </div>
      
      <script>window.onload=function(){window.print();}</script>
      </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(invoiceHtml);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 1000);
    }
  };

  const saveContractInvoiceToAccount = async () => {
    if (selectedContractsForInv.length === 0) {
      toast.error('يرجى اختيار عقد واحد على الأقل');
      return;
    }

    try {
      const printTotal = printItems.reduce((sum, item) => sum + item.totalPrice, 0);
      
      if (printTotal <= 0) {
        toast.error('يجب أن يكون إجمالي الفاتورة أكبر من صفر');
        return;
      }

      const selectedContractNumbers = selectedContractsForInv.join(', ');
      const itemsDescription = printItems.map(item => 
        `${item.size}: ${item.quantity} لوحة × ${item.totalFaces} وجه (${item.totalArea.toFixed(2)} م²)`
      ).join(' | ');

      const payload = {
        customer_id: customerId || null,
        customer_name: customerName,
        contract_number: selectedContractsForInv.length === 1 ? Number(selectedContractsForInv[0]) : null,
        amount: printTotal,
        method: 'فاتورة طباعة',
        reference: `عقود: ${selectedContractNumbers}`,
        notes: `فاتورة طباعة - ${itemsDescription}`,
        paid_at: new Date().toISOString(),
        entry_type: 'invoice',
      };

      const { error } = await supabase.from('customer_payments').insert(payload).select();
      if (error) { 
        console.error('Invoice insert error:', error); 
        toast.error('فشل في حفظ الفاتورة: ' + error.message); 
        return; 
      }

      toast.success('تم حفظ فات��رة الطباعة في حساب العميل');
      setPrintContractInvoiceOpen(false);
      
      setSelectedContractsForInv([]);
      setSizeCounts({});
      setPrintItems([]);
      
      await loadData();
    } catch (e) { 
      console.error('Invoice save error:', e); 
      toast.error('خطأ غير متوقع: ' + (e as Error).message); 
    }
  };

  return (
    <div className="expenses-container">
      {/* Header */}
      <Card className="expenses-preview-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-primary rounded-lg">
                <Receipt className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="expenses-preview-title">فواتير وإيصالات العميل</CardTitle>
                <p className="text-muted-foreground">{customerName || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/customers')} 
                className="gap-2 expenses-action-btn"
              >
                رجوع للزبائن
              </Button>
              {/* ✅ NEW: Only modern buttons - removed old ones */}
              <Button 
                onClick={openAccountStatement}
                className="gap-2 expenses-action-btn bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold"
              >
                <FileText className="h-4 w-4" />
                كشف حساب الزبون
              </Button>
              <Button 
                onClick={() => {
                  setSelectedContractsForInv(contracts[0]?.Contract_Number ? [String(contracts[0]?.Contract_Number)] : []);
                  setPrintContractInvoiceOpen(true);
                }} 
                className="gap-2 expenses-action-btn bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Calculator className="h-4 w-4" />
                فاتورة طباعة عصرية
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <SummaryCards 
        totalRent={totalRent}
        totalCredits={totalCredits}
        balance={balance}
        accountPayments={accountPayments}
      />

      {/* ✅ FIXED: Use ContractSection component instead of inline table */}
      <ContractSection 
        contracts={contracts}
        payments={payments}
      />

      {/* Payments Section */}
      <PaymentSection 
        payments={payments}
        onEditReceipt={openEditReceipt}
        onDeleteReceipt={deleteReceipt}
        onPrintReceipt={openReceiptPrint}
        onAddDebt={() => { setAddDebtOpen(true); setDebtAmount(''); setDebtNotes(''); setDebtDate(new Date().toISOString().slice(0,10)); }}
        onAddAccountPayment={() => { setAccountPaymentOpen(true); setAccountPaymentAmount(''); setAccountPaymentMethod(''); setAccountPaymentReference(''); setAccountPaymentNotes(''); setAccountPaymentDate(new Date().toISOString().slice(0,10)); setAccountPaymentContract(''); setAccountPaymentToGeneral(true); }}
      />

      {/* Modern Print Invoice Dialog */}
      <ModernPrintInvoiceDialog
        open={printContractInvoiceOpen}
        onClose={() => setPrintContractInvoiceOpen(false)}
        customerName={customerName}
        contracts={contracts}
        selectedContracts={selectedContractsForInv}
        onSelectContracts={setSelectedContractsForInv}
        printItems={printItems}
        onUpdatePrintItem={updatePrintItem}
        onRemoveItem={removeItem}
        includeAccountBalance={includeAccountBalance}
        onIncludeAccountBalance={setIncludeAccountBalance}
        accountPayments={accountPayments}
        onPrintInvoice={printPrintingInvoiceOnly}
        onSaveInvoice={saveContractInvoiceToAccount}
      />

      {/* ✅ NEW: Receipt Print Dialog */}
      <ReceiptPrintDialog
        open={receiptPrintOpen}
        onOpenChange={setReceiptPrintOpen}
        payment={selectedPaymentForReceipt}
        customerName={customerName}
      />

      {/* ✅ NEW: Account Statement Dialog */}
      <AccountStatementDialog
        open={accountStatementOpen}
        onOpenChange={setAccountStatementOpen}
        customerId={customerId}
        customerName={customerName}
      />

      {/* Contract PDF Dialog */}
      <ContractPDFDialog
        open={contractPDFOpen}
        onOpenChange={setContractPDFOpen}
        contract={selectedContractForPDF}
      />

      {/* Account Payment Dialog */}
      <Dialog open={accountPaymentOpen} onOpenChange={setAccountPaymentOpen}>
        <DialogContent className="max-w-md expenses-dialog-content" dir="rtl">
          <DialogHeader className="border-b border-slate-600 pb-4">
            <DialogTitle className="text-lg font-bold text-yellow-400 text-right">دفع�� على الحساب</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-slate-700 p-3 rounded-lg border border-slate-600">
              <div className="text-sm text-slate-300 mb-1 font-medium">العميل:</div>
              <div className="font-semibold text-yellow-400">{customerName}</div>
            </div>
            
            <div className="bg-slate-700 border border-slate-600 rounded-lg p-3">
              <div className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                اختر وجهة الدفعة:
              </div>
              <div className="space-y-2">
                <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-all ${
                  accountPaymentToGeneral 
                    ? 'border-yellow-500 bg-yellow-900/20 text-yellow-300' 
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
                }`}>
                  <input
                    type="radio"
                    name="payment-destination"
                    checked={accountPaymentToGeneral}
                    onChange={() => setAccountPaymentToGeneral(true)}
                    className="w-4 h-4 text-yellow-600"
                  />
                  <span className="text-sm font-medium">إضافة إلى الحساب العام</span>
                </label>
                <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-all ${
                  !accountPaymentToGeneral 
                    ? 'border-yellow-500 bg-yellow-900/20 text-yellow-300' 
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
                }`}>
                  <input
                    type="radio"
                    name="payment-destination"
                    checked={!accountPaymentToGeneral}
                    onChange={() => setAccountPaymentToGeneral(false)}
                    className="w-4 h-4 text-yellow-600"
                  />
                  <span className="text-sm font-medium">إضافة إلى عقد محدد</span>
                </label>
              </div>
            </div>

            {!accountPaymentToGeneral && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300 block">العقد</label>
                <Select value={accountPaymentContract} onValueChange={setAccountPaymentContract}>
                  <SelectTrigger className="text-right bg-slate-700 border-slate-600 text-slate-200">
                    <SelectValue placeholder="اختر عقدًا" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 bg-slate-700 border-slate-600">
                    {contracts.map((ct)=> (
                      <SelectItem key={String(ct.Contract_Number)} value={String(ct.Contract_Number)} className="text-slate-200">
                        عقد رقم {String(ct.Contract_Number)} - {ct['Ad Type']}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!accountPaymentToGeneral && accountPaymentContract && (
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-green-400" />
                  <span className="font-semibold text-sm text-green-300">تفاصيل العقد</span>
                </div>
                {(() => {
                  const contract = contracts.find(c => String(c.Contract_Number) === accountPaymentContract);
                  if (!contract) return null;
                  const contractTotal = Number(contract['Total Rent']) || 0;
                  const contractPaid = getContractPayments(contract.Contract_Number);
                  const contractRemaining = contractTotal - contractPaid;
                  
                  return (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">إجمالي العقد:</span>
                        <span className="font-semibold text-slate-200">{contractTotal.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">المدفوع:</span>
                        <span className="font-semibold text-green-400">{contractPaid.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-600 pt-1">
                        <span className="text-slate-400">المتبقي:</span>
                        <span className={`font-bold ${contractRemaining > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {contractRemaining.toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 block">المبلغ</label>
              <Input 
                type="number" 
                value={accountPaymentAmount} 
                onChange={(e)=> setAccountPaymentAmount(e.target.value)}
                className="text-right bg-slate-700 border-slate-600 text-slate-200"
                placeholder="أدخل المبلغ"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 block">طريقة الدفع</label>
              <Select value={accountPaymentMethod} onValueChange={setAccountPaymentMethod}>
                <SelectTrigger className="text-right bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue placeholder="اختر طريقة الدفع" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="نقدي" className="text-slate-200">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي" className="text-slate-200">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك" className="text-slate-200">شيك</SelectItem>
                  <SelectItem value="بطاقة ائتمان" className="text-slate-200">بطاقة ائتمان</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 block">المرجع</label>
              <Input 
                value={accountPaymentReference} 
                onChange={(e)=> setAccountPaymentReference(e.target.value)}
                className="text-right bg-slate-700 border-slate-600 text-slate-200"
                placeholder="رقم المرجع (اختياري)"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 block">التاريخ</label>
              <Input 
                type="date" 
                value={accountPaymentDate} 
                onChange={(e)=> setAccountPaymentDate(e.target.value)}
                className="text-right bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 block">ملاحظات</label>
              <Input 
                value={accountPaymentNotes} 
                onChange={(e)=> setAccountPaymentNotes(e.target.value)}
                className="text-right bg-slate-700 border-slate-600 text-slate-200"
                placeholder="ملاحظات إضافية (اختياري)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-600">
              <Button 
                variant="outline" 
                onClick={()=> setAccountPaymentOpen(false)} 
                className="px-4 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                إلغاء
              </Button>
              <Button onClick={async () => {
                try {
                  if (!accountPaymentAmount) { toast.error('أدخل المبلغ'); return; }
                  const amt = Number(accountPaymentAmount);
                  if (!amt || amt <= 0) { toast.error('المبلغ يجب أن يكون أكبر من صفر'); return; }
                  
                  if (!accountPaymentToGeneral && !accountPaymentContract) {
                    toast.error('يرجى اختي��ر عقد');
                    return;
                  }
                  
                  const contractNumber = accountPaymentToGeneral ? null : 
                    (accountPaymentContract ? (isNaN(Number(accountPaymentContract)) ? null : Number(accountPaymentContract)) : null);
                  
                  const payload = {
                    customer_id: customerId || null,
                    customer_name: customerName,
                    contract_number: contractNumber,
                    amount: amt,
                    method: accountPaymentMethod || null,
                    reference: accountPaymentReference || null,
                    notes: accountPaymentNotes || null,
                    paid_at: accountPaymentDate ? new Date(accountPaymentDate).toISOString() : new Date().toISOString(),
                    entry_type: accountPaymentToGeneral ? 'account_payment' : 'receipt',
                  };
                  
                  const { error } = await supabase.from('customer_payments').insert(payload).select();
                  if (error) { 
                    console.error('Insert error:', error);
                    toast.error('فشل الحفظ: ' + error.message); 
                    return; 
                  }
                  
                  toast.success('تم الحفظ بنجاح');
                  setAccountPaymentOpen(false);
                  
                  setAccountPaymentAmount('');
                  setAccountPaymentMethod('');
                  setAccountPaymentReference('');
                  setAccountPaymentNotes('');
                  setAccountPaymentContract('');
                  setAccountPaymentToGeneral(true);
                  
                  await loadData();
                } catch (e) { 
                  console.error('Unexpected error:', e); 
                  toast.error('خطأ غير متوقع: ' + (e as Error).message); 
                }
              }} className="px-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-slate-900 font-semibold">
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit receipt dialog */}
      <Dialog open={editReceiptOpen} onOpenChange={setEditReceiptOpen}>
        <DialogContent className="max-w-md expenses-dialog-content">
          <DialogHeader className="border-b border-slate-600 pb-4">
            <DialogTitle className="text-yellow-400">تعديل الإيصال</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium text-slate-300">المبلغ</label>
              <Input type="number" value={editReceiptAmount} onChange={(e)=> setEditReceiptAmount(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">طريقة الدفع</label>
              <Select value={editReceiptMethod} onValueChange={setEditReceiptMethod}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue placeholder="اختر طريقة الدفع" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="نقدي" className="text-slate-200">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي" className="text-slate-200">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك" className="text-slate-200">شيك</SelectItem>
                  <SelectItem value="بطاقة ائتمان" className="text-slate-200">بطاقة ائتمان</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">المرجع</label>
              <Input value={editReceiptReference} onChange={(e)=> setEditReceiptReference(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">تاريخ الدفع</label>
              <Input type="date" value={editReceiptDate} onChange={(e)=> setEditReceiptDate(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">ملاحظات</label>
              <Input value={editReceiptNotes} onChange={(e)=> setEditReceiptNotes(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-600">
              <Button 
                variant="outline" 
                onClick={()=> setEditReceiptOpen(false)} 
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                إلغاء
              </Button>
              <Button 
                onClick={saveReceiptEdit} 
                className="bg-slate-700 hover:bg-slate-600 text-yellow-400"
              >
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add previous debt */}
      <Dialog open={addDebtOpen} onOpenChange={setAddDebtOpen}>
        <DialogContent className="max-w-md expenses-dialog-content">
          <DialogHeader className="border-b border-slate-600 pb-4">
            <DialogTitle className="text-yellow-400">إضافة دين سابق</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium text-slate-300">المبلغ</label>
              <Input type="number" value={debtAmount} onChange={(e)=> setDebtAmount(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">ملاحظات</label>
              <Input value={debtNotes} onChange={(e)=> setDebtNotes(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">التاريخ</label>
              <Input type="date" value={debtDate} onChange={(e)=> setDebtDate(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-600">
              <Button 
                variant="outline" 
                onClick={()=> setAddDebtOpen(false)} 
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                إلغاء
              </Button>
              <Button onClick={async () => {
                try {
                  if (!debtAmount) { toast.error('أدخل المبلغ'); return; }
                  const amt = Number(debtAmount);
                  if (!amt || amt <= 0) { toast.error('المبلغ يجب أن يكون أكبر من صفر'); return; }
                  
                  const payload = {
                    customer_id: customerId || null,
                    customer_name: customerName,
                    contract_number: null,
                    amount: amt,
                    method: 'دين سابق',
                    reference: null,
                    notes: debtNotes || null,
                    paid_at: debtDate ? new Date(debtDate).toISOString() : new Date().toISOString(),
                    entry_type: 'debt',
                  };
                  
                  const { error } = await supabase.from('customer_payments').insert(payload).select();
                  if (error) { 
                    console.error('Debt insert error:', error); 
                    toast.error('فشل الحفظ: ' + error.message); 
                    return; 
                  }
                  toast.success('تمت الإضافة');
                  setAddDebtOpen(false);
                  
                  setDebtAmount('');
                  setDebtNotes('');
                  
                  await loadData();
                } catch (e) { 
                  console.error('Debt save error:', e); 
                  toast.error('خطأ غير متوقع: ' + (e as Error).message); 
                }
              }} className="bg-red-600 hover:bg-red-700 text-white">
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
