import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Plus } from 'lucide-react';
import { PaymentRow } from './BillingTypes';

interface PaymentSectionProps {
  payments: PaymentRow[];
  onEditReceipt: (payment: PaymentRow) => void;
  onDeleteReceipt: (id: string) => void;
  onPrintReceipt: (payment: PaymentRow) => void;
  onAddDebt: () => void;
  onAddAccountPayment: () => void;
}

// ✅ دالة تنسيق نوع الدفعة بستايل الموقع
const getPaymentTypeStyle = (entryType: string): string => {
  switch (entryType) {
    case 'receipt':
      return 'payment-type-receipt';
    case 'invoice':
      return 'payment-type-invoice';
    case 'debt':
      return 'payment-type-debt';
    case 'account_payment':
      return 'payment-type-account';
    default:
      return 'payment-type-default';
  }
};

const getPaymentTypeText = (entryType: string): string => {
  switch (entryType) {
    case 'account_payment':
      return 'دفعة حساب';
    case 'receipt':
      return 'إيصال';
    case 'debt':
      return 'دين سابق';
    case 'invoice':
      return 'فاتورة';
    default:
      return entryType || '—';
  }
};

export function PaymentSection({ 
  payments, 
  onEditReceipt, 
  onDeleteReceipt, 
  onPrintReceipt,
  onAddDebt,
  onAddAccountPayment 
}: PaymentSectionProps) {
  return (
    <Card className="expenses-preview-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="expenses-preview-title">الدفعات والإيصالات ({payments.length})</span>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={onAddDebt}
              className="expenses-action-btn bg-red-600 hover:bg-red-700"
            >
              إضافة دين سابق
            </Button>
            <Button 
              size="sm" 
              className="expenses-action-btn bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-slate-900 font-semibold" 
              onClick={onAddAccountPayment}
            >
              <Plus className="h-4 w-4 ml-1" />
              دفعة على الحساب
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {payments.length ? (
          <div className="expenses-table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم العقد</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">طريقة الدفع</TableHead>
                  <TableHead className="text-right">المرجع</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell className="expenses-contract-number">
                      {payment.contract_number || (payment.entry_type === 'account_payment' ? 'حساب عام' : '—')}
                    </TableCell>
                    <TableCell>
                      {/* ✅ FIXED: استخدام كلاسات CSS المخصصة بستايل الموقع */}
                      <span className={getPaymentTypeStyle(payment.entry_type)}>
                        {getPaymentTypeText(payment.entry_type)}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold stat-green">
                      {(Number(payment.amount) || 0).toLocaleString('ar-LY')} د.ل
                    </TableCell>
                    <TableCell>{payment.method || '—'}</TableCell>
                    <TableCell>{payment.reference || '—'}</TableCell>
                    <TableCell>
                      {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('ar-LY') : '—'}
                    </TableCell>
                    <TableCell>{payment.notes || '—'}</TableCell>
                    <TableCell>
                      <div className="expenses-actions-cell">
                        <Button 
                          size="sm" 
                          onClick={() => onPrintReceipt(payment)} 
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          طباعة إيصال
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => onEditReceipt(payment)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => onDeleteReceipt(payment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="expenses-empty-state text-center py-8">لا توجد دفعات</div>
        )}
      </CardContent>
    </Card>
  );
}