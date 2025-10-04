import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';

interface SummaryCardsProps {
  totalRent: number;
  totalCredits: number;
  balance: number;
  accountPayments: number;
}

export function SummaryCards({ totalRent, totalCredits, balance, accountPayments }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card className="expenses-summary-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي العقود</CardTitle>
          <TrendingUp className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{totalRent.toLocaleString('ar-LY')} د.ل</div>
        </CardContent>
      </Card>

      <Card className="expenses-summary-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المدفوع</CardTitle>
          <TrendingDown className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{totalCredits.toLocaleString('ar-LY')} د.ل</div>
        </CardContent>
      </Card>

      <Card className="expenses-summary-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">المتبقي</CardTitle>
          <DollarSign className={`h-4 w-4 ${balance >= 0 ? 'text-red-600' : 'text-green-600'}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {balance >= 0 
              ? `${balance.toLocaleString('ar-LY')} د.ل` 
              : `(${Math.abs(balance).toLocaleString('ar-LY')}) د.ل`
            }
          </div>
          {balance < 0 && (
            <p className="text-xs text-green-600 mt-1">رصيد دائن</p>
          )}
        </CardContent>
      </Card>

      <Card className="expenses-summary-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">رصيد الحساب العام</CardTitle>
          <Wallet className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">{accountPayments.toLocaleString('ar-LY')} د.ل</div>
        </CardContent>
      </Card>
    </div>
  );
}