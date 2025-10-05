import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ContractRow, PaymentRow } from './BillingTypes';

interface ContractSectionProps {
  contracts: ContractRow[];
  payments: PaymentRow[];
}

export function ContractSection({ contracts, payments }: ContractSectionProps) {
  return (
    <Card className="expenses-preview-card">
      <CardHeader>
        <CardTitle className="expenses-preview-title">العقود ({contracts.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {contracts.length ? (
          <div className="expenses-table-container">
            <Table>
              <TableHeader>
                {/* ✅ FIXED: استخدام ستايل الموقع الذهبي بدلاً من الأزرق */}
                <TableRow className="bg-primary text-primary-foreground">
                  <TableHead className="text-right text-primary-foreground">رقم العقد</TableHead>
                  <TableHead className="text-right text-primary-foreground">نوع الإعلان</TableHead>
                  <TableHead className="text-right text-primary-foreground">عدد اللوحات</TableHead>
                  <TableHead className="text-right text-primary-foreground">تاريخ البداية</TableHead>
                  <TableHead className="text-right text-primary-foreground">تاريخ النهاية</TableHead>
                  <TableHead className="text-right text-primary-foreground">الحالة</TableHead>
                  <TableHead className="text-right text-primary-foreground">القيمة الإجمالية</TableHead>
                  <TableHead className="text-right text-primary-foreground">المدفوع للعقد</TableHead>
                  <TableHead className="text-right text-primary-foreground">المتبقي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map(contract => {
                  // ✅ FIXED: إصلاح حساب المدفوعات للعقد - استخدام رقم العقد كرقم وليس نص
                  const contractPayments = payments
                    .filter(p => {
                      const paymentContractNumber = Number(p.contract_number);
                      const contractNumber = Number(contract.Contract_Number);
                      const isValidPaymentType = p.entry_type === 'receipt' || p.entry_type === 'account_payment';
                      const matches = paymentContractNumber === contractNumber && isValidPaymentType;
                      
                      // ✅ إضافة console.log للتتبع
                      if (matches) {
                        console.log(`✅ دفعة للعقد ${contractNumber}: ${p.amount} د.ل - نوع: ${p.entry_type}`);
                      }
                      
                      return matches;
                    })
                    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
                  
                  const contractTotal = Number(contract['Total Rent']) || 0;
                  const contractRemaining = Math.max(0, contractTotal - contractPayments);
                  
                  console.log(`📊 العقد ${contract.Contract_Number}: إجمالي=${contractTotal}, مدفوع=${contractPayments}, متبقي=${contractRemaining}`);
                  
                  // ✅ FIXED: تحسين منطق تحديد حالة العقد
                  const today = new Date();
                  const startDate = contract['Contract Date'] ? new Date(contract['Contract Date']) : null;
                  const endDate = contract['End Date'] ? new Date(contract['End Date']) : null;
                  const isActive = endDate && today <= endDate;
                  
                  return (
                    <TableRow key={String(contract.Contract_Number)} className="hover:bg-card/50">
                      <TableCell className="expenses-contract-number">
                        {String(contract.Contract_Number || '')}
                      </TableCell>
                      <TableCell>{contract['Ad Type'] || '—'}</TableCell>
                      <TableCell className="font-semibold text-primary">
                        {contract.billboards_count || 0}
                      </TableCell>
                      <TableCell>
                        {contract['Contract Date'] 
                          ? new Date(contract['Contract Date']).toLocaleDateString('ar-LY') 
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {contract['End Date'] 
                          ? new Date(contract['End Date']).toLocaleDateString('ar-LY') 
                          : '—'}
                      </TableCell>
                      {/* ✅ FIXED: استخدام ستايل الموقع للحالة */}
                      <TableCell>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          isActive 
                            ? 'bg-gradient-to-r from-green-500/20 to-green-600/20 text-green-400 border border-green-500/30' 
                            : 'bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-400 border border-red-500/30'
                        }`}>
                          {isActive ? 'ساري' : 'منتهي'}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold expenses-amount-calculated">
                        {contractTotal.toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className="stat-green font-medium">
                        {contractPayments.toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className={contractRemaining > 0 ? 'stat-red font-semibold' : 'stat-green font-medium'}>
                        {contractRemaining.toLocaleString('ar-LY')} د.ل
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="expenses-empty-state text-center py-8">لا توجد عقود</div>
        )}
      </CardContent>
    </Card>
  );
}