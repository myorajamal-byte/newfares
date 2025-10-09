import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { CheckCircle2, Info, TrendingUp } from 'lucide-react';

export default function SharedBillboards() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rentAmountById, setRentAmountById] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('billboards')
        .select('*')
        .eq('is_partnership', true)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('load shared billboards', e, { message: e?.message, details: e?.details, hint: e?.hint });
      const msg = e?.message || (typeof e === 'object' ? JSON.stringify(e, Object.getOwnPropertyNames(e)) : String(e));
      toast.error(msg || 'فشل تحميل اللوحات المشتركة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const calculateSplit = (billboard: any, rent: number) => {
    const capital = Number(billboard.capital || 0);
    const capRem = Number(billboard.capital_remaining ?? capital);

    if (capRem > 0) {
      const company = rent * 0.35;
      const partner = rent * 0.35;
      const deduct = rent * 0.30;
      const newCap = Math.max(0, capRem - deduct);
      return { company, partner, deduct, newCap, phase: 'recovery' };
    }

    const company = rent * 0.5;
    const partner = rent * 0.5;
    return { company, partner, deduct: 0, newCap: 0, phase: 'profit_sharing' };
  };

  const applyRent = async (bb: any) => {
    const rent = Number(rentAmountById[bb.ID || bb.id] || 0);
    if (!rent || rent <= 0) {
      toast.error('أدخل مبلغ إيجار صالح');
      return;
    }

    const split = calculateSplit(bb, rent);

    try {
      const payload: any = {};
      if (split.newCap !== undefined) {
        payload.capital_remaining = split.newCap;
      }

      const { error } = await supabase
        .from('billboards')
        .update(payload)
        .eq('ID', bb.ID || bb.id);

      if (error) throw error;

      try {
        await supabase.from('shared_transactions').insert({
          billboard_id: bb.ID || bb.id,
          beneficiary: 'الفارس',
          amount: Number(split.company || 0),
          type: 'rental_income'
        });

        const partners = Array.isArray(bb.partner_companies)
          ? bb.partner_companies
          : (bb.partner_companies ? String(bb.partner_companies).split(',').map((s: any) => s.trim()).filter(Boolean) : []);

        if (partners.length > 0) {
          const perPartner = Number(split.partner || 0) / partners.length;
          const inserts = partners.map((p: any) => ({
            billboard_id: bb.ID || bb.id,
            beneficiary: p,
            amount: perPartner,
            type: 'rental_income'
          }));
          await supabase.from('shared_transactions').insert(inserts as any[]);
        }

        if (Number(split.deduct || 0) > 0) {
          await supabase.from('shared_transactions').insert({
            billboard_id: bb.ID || bb.id,
            beneficiary: 'رأس المال',
            amount: Number(split.deduct || 0),
            type: 'capital_deduction'
          });
        }
      } catch (txErr) {
        console.warn('failed to insert shared transactions', txErr);
      }

      const phase = split.phase === 'recovery' ? 'مرحلة استرداد رأس المال' : 'مرحلة توزيع الأرباح';
      toast.success(
        `تم تطبيق الإيجار (${phase})\n` +
        `• الفارس: ${split.company.toLocaleString()} د.ل (${split.phase === 'recovery' ? '35%' : '50%'})\n` +
        `• الشريك: ${split.partner.toLocaleString()} د.ل (${split.phase === 'recovery' ? '35%' : '50%'})\n` +
        (split.deduct > 0 ? `• خصم رأس المال: ${split.deduct.toLocaleString()} د.ل (30%)` : ''),
        { duration: 5000 }
      );

      setRentAmountById(p => ({ ...p, [String(bb.ID || bb.id)]: 0 }));
      load();
    } catch (e: any) {
      console.error('apply rent error', e);
      toast.error(e?.message || 'فشل تطبيق الإيجار');
    }
  };

  const removeFromPartnership = async (bb: any) => {
    const confirmed = window.confirm('هل تريد إزالة هذه اللوحة من الشراكة؟');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('billboards')
        .update({ is_partnership: false, partner_companies: null })
        .eq('ID', bb.ID || bb.id);

      if (error) throw error;
      toast.success('تمت إزالة اللوحة من الشراكة');
      load();
    } catch (e: any) {
      console.error('remove partnership error', e);
      toast.error(e?.message || 'فشل إزالة اللوحة من الشراكة');
    }
  };

  const getCapitalStatus = (bb: any) => {
    const capital = Number(bb.capital || 0);
    const remaining = Number(bb.capital_remaining ?? capital);

    if (remaining <= 0) {
      return {
        badge: <Badge className="bg-green-600 hover:bg-green-700">مكتمل</Badge>,
        percentage: 100,
        phase: 'توزيع الأرباح'
      };
    }

    const recovered = capital - remaining;
    const percentage = capital > 0 ? Math.round((recovered / capital) * 100) : 0;

    return {
      badge: <Badge className="bg-blue-600 hover:bg-blue-700">استرداد</Badge>,
      percentage,
      phase: 'استرداد رأس المال'
    };
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">اللوحات المشتركة</h1>
        <p className="text-muted-foreground mt-2">إدارة اللوحات الإعلانية المشتركة مع الشركاء</p>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-5 w-5 text-blue-600" />
        <AlertDescription className="text-sm space-y-2 text-gray-700">
          <div className="font-semibold text-blue-900 mb-2">نظام توزيع الإيرادات:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-lg border border-blue-100">
              <div className="font-medium text-blue-900 mb-1">🔵 مرحلة استرداد رأس المال</div>
              <ul className="text-xs space-y-1">
                <li>• الفارس: 35% من الإيجار</li>
                <li>• الشريك: 35% من الإيجار</li>
                <li>• رأس المال: 30% من الإيجار</li>
              </ul>
            </div>
            <div className="bg-white p-3 rounded-lg border border-green-100">
              <div className="font-medium text-green-900 mb-1">🟢 مرحلة توزيع الأرباح (بعد اكتمال رأس المال)</div>
              <ul className="text-xs space-y-1">
                <li>• الفارس: 50% من الإيجار</li>
                <li>• الشريك: 50% من الإيجار</li>
              </ul>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            قائمة اللوحات المشتركة
          </CardTitle>
          <CardDescription>
            {list.length} لوحة مشتركة
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : list.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">لا توجد لوحات مشتركة</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">اسم اللوحة</TableHead>
                    <TableHead className="font-bold">المقاس</TableHead>
                    <TableHead className="font-bold">الشركاء</TableHead>
                    <TableHead className="font-bold">رأس المال</TableHead>
                    <TableHead className="font-bold">المتبقي</TableHead>
                    <TableHead className="font-bold">الحالة</TableHead>
                    <TableHead className="font-bold">التقدم</TableHead>
                    <TableHead className="font-bold w-80">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((bb, i) => {
                    const rowKey = String(bb.ID || bb.id || `bb-${i}`);
                    const status = getCapitalStatus(bb);

                    return (
                      <TableRow key={rowKey} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{bb.Billboard_Name || bb.name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{bb.Size || bb.size || '-'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(bb.partner_companies) && bb.partner_companies.length > 0 ? (
                              bb.partner_companies.map((partner: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {partner}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {(Number(bb.capital) || 0).toLocaleString()} د.ل
                        </TableCell>
                        <TableCell className={status.percentage === 100 ? 'text-green-600 font-medium' : ''}>
                          {(Number(bb.capital_remaining) || 0).toLocaleString()} د.ل
                        </TableCell>
                        <TableCell>
                          {status.badge}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full transition-all ${status.percentage === 100 ? 'bg-green-600' : 'bg-blue-600'}`}
                                  style={{ width: `${status.percentage}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium w-10">{status.percentage}%</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {status.phase}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 items-center">
                            <Input
                              type="number"
                              placeholder="مبلغ الإيجار"
                              className="w-32"
                              value={rentAmountById[rowKey] || ''}
                              onChange={(e) => setRentAmountById(p => ({ ...p, [rowKey]: Number(e.target.value) }))}
                            />
                            <Button
                              size="sm"
                              onClick={() => applyRent(bb)}
                              disabled={!rentAmountById[rowKey] || rentAmountById[rowKey] <= 0}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              تطبيق
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeFromPartnership(bb)}
                            >
                              إزالة
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
