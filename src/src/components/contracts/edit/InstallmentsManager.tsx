import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Calculator, Plus as PlusIcon, Trash2 } from 'lucide-react';

interface Installment {
  amount: number;
  paymentType: string;
  description: string;
  dueDate: string;
}

interface InstallmentsManagerProps {
  installments: Installment[];
  finalTotal: number;
  onDistributeEvenly: (count: number) => void;
  onAddInstallment: () => void;
  onRemoveInstallment: (index: number) => void;
  onUpdateInstallment: (index: number, field: string, value: any) => void;
  onClearAll: () => void;
}

export function InstallmentsManager({
  installments,
  finalTotal,
  onDistributeEvenly,
  onAddInstallment,
  onRemoveInstallment,
  onUpdateInstallment,
  onClearAll
}: InstallmentsManagerProps) {
  const totalInstallments = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
  const difference = finalTotal - totalInstallments;

  return (
    <Card className="bg-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <DollarSign className="h-5 w-5 text-primary" />
          نظام الدفعات الديناميكي
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={1}
            max={6}
            placeholder="عدد الدفعات (1-6)"
            className="w-32 bg-input border-border text-foreground"
            onChange={(e) => onDistributeEvenly(parseInt(e.target.value || '1'))}
          />
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onDistributeEvenly(2)} 
            size="sm"
            className="border-border hover:bg-accent"
          >
            <Calculator className="h-4 w-4 mr-1" />
            تقسيم متساوي
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={onAddInstallment} 
            size="sm"
            className="border-border hover:bg-accent"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            إضافة دفعة
          </Button>
          <Button 
            type="button" 
            variant="destructive" 
            onClick={onClearAll} 
            size="sm"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            مسح الكل
          </Button>
        </div>

        {/* Installments List */}
        <div className="space-y-3">
          {installments.map((installment, index) => (
            <Card key={index} className="p-3 bg-card/50 border-border">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-card-foreground">
                    الدفعة {index + 1}
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveInstallment(index)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">المبلغ</label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={installment.amount}
                      onChange={(e) => onUpdateInstallment(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="text-sm bg-input border-border text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">نوع الدفع</label>
                    <Select
                      value={installment.paymentType}
                      onValueChange={(value) => onUpdateInstallment(index, 'paymentType', value)}
                    >
                      <SelectTrigger className="text-sm bg-input border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="عند التوقيع">عند التوقيع</SelectItem>
                        <SelectItem value="عند التركيب">عند التركيب</SelectItem>
                        <SelectItem value="شهري">شهري</SelectItem>
                        <SelectItem value="شهرين">كل شهرين</SelectItem>
                        <SelectItem value="ثلاثة أشهر">كل ثلاثة أشهر</SelectItem>
                        <SelectItem value="نهاية العقد">نهاية العقد</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">الوصف</label>
                  <Input
                    value={installment.description}
                    onChange={(e) => onUpdateInstallment(index, 'description', e.target.value)}
                    placeholder="وصف الدفعة"
                    className="text-sm bg-input border-border text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">تاريخ الاستحقاق</label>
                  <Input
                    type="date"
                    value={installment.dueDate}
                    onChange={(e) => onUpdateInstallment(index, 'dueDate', e.target.value)}
                    className="text-sm bg-input border-border text-foreground"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Summary */}
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">إجمالي العقد:</span>
            <span className="font-medium text-primary">{finalTotal.toLocaleString('ar-LY')} د.ل</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">مجموع الدفعات:</span>
            <span className="font-medium text-card-foreground">
              {totalInstallments.toLocaleString('ar-LY')} د.ل
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">الفرق:</span>
            <span className={`font-medium ${Math.abs(difference) > 1 ? 'text-destructive' : 'text-green-400'}`}>
              {difference.toLocaleString('ar-LY')} د.ل
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}