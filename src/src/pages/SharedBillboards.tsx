import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export default function SharedBillboards() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rentAmountById, setRentAmountById] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    try {
      // اقرأ من أعمدة الشراكة مباشرة
      const { data, error } = await supabase
        .from('billboards')
        .select('*')
        .or('is_partnership.eq.true,partner_companies.not.is.null')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setList(Array.isArray(data) ? data : []);
    } catch (e:any) {
      // Log full error for debugging and show a readable message to the user
      console.error('load shared billboards', e, { message: e?.message, details: e?.details, hint: e?.hint });
      const msg = e?.message || (typeof e === 'object' ? JSON.stringify(e, Object.getOwnPropertyNames(e)) : String(e));
      toast.error(msg || 'فشل تحميل اللوحات المشتركة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const calculateSplit = (billboard: any, rent: number) => {
    const capRem = Number(billboard.capital_remaining ?? billboard.capital ?? 0);
    if (capRem > 0) {
      const company = rent * 0.35;
      const partner = rent * 0.35;
      const deduct = rent * 0.30;
      const newCap = Math.max(0, capRem - deduct);
      return { company, partner, deduct, newCap };
    }
    // capital already recovered
    const company = rent * 0.5;
    const partner = rent * 0.5;
    return { company, partner, deduct: 0, newCap: 0 };
  };

  const applyRent = async (bb: any) => {
    const rent = Number(rentAmountById[bb.id] || 0);
    if (!rent || rent <= 0) { toast.error('أدخل مبلغ إيجار صالح'); return; }
    const split = calculateSplit(bb, rent);
    try {
      // update capital_remaining on billboard
      const payload: any = {};
      if (split.newCap !== undefined) payload.capital_remaining = split.newCap;
      const { error } = await supabase.from('billboards').update(payload).eq('id', bb.id);
      if (error) throw error;

      // Insert transactions into shared_transactions table
      try {
        // Our company transaction
        await supabase.from('shared_transactions').insert({ billboard_id: bb.id, beneficiary: 'our_company', amount: Number(split.company || 0), type: 'rental_income' });

        // Partner transactions: split among partner companies if multiple
        const partners = Array.isArray(bb.partner_companies) ? bb.partner_companies : (bb.partner_companies ? String(bb.partner_companies).split(',').map((s:any)=>s.trim()).filter(Boolean) : []);
        if (partners.length > 0) {
          const perPartner = Number(split.partner || 0) / partners.length;
          const inserts = partners.map((p:any) => ({ billboard_id: bb.id, beneficiary: p, amount: perPartner, type: 'rental_income' }));
          await supabase.from('shared_transactions').insert(inserts as any[]);
        } else {
          // If no partner listed, still record a generic partner transaction
          await supabase.from('shared_transactions').insert({ billboard_id: bb.id, beneficiary: 'partner', amount: Number(split.partner || 0), type: 'rental_income' });
        }

        // Record capital deduction as transaction
        if (Number(split.deduct || 0) > 0) {
          await supabase.from('shared_transactions').insert({ billboard_id: bb.id, beneficiary: 'capital', amount: Number(split.deduct || 0), type: 'capital_deduction' });
        }
      } catch (txErr) {
        console.warn('failed to insert shared transactions', txErr);
      }

      toast.success(`تطبيق الإيجار. الشركة: ${split.company.toLocaleString()} د.ل، الشريك: ${split.partner.toLocaleString()} د.ل، خصم من رأس المال: ${split.deduct.toLocaleString()} د.ل`);
      load();
    } catch (e:any) {
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
        .eq('id', bb.id);
      if (error) throw error;
      toast.success('تمت إزالة اللوحة من الشراكة');
      load();
    } catch (e:any) {
      console.error('remove partnership error', e);
      toast.error(e?.message || 'فشل إزالة اللوحة من الشراكة');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>اللوحات المشتركة</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <div>جاري التحميل...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>المقاس</TableHead>
                  <TableHead>رأس المال</TableHead>
                  <TableHead>المتبقي</TableHead>
                  <TableHead>شراكة</TableHead>
                  <TableHead>الشركات المشاركة</TableHead>
                  <TableHead>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((bb, i) => {
                  const rowKey = String(bb.id ?? bb.ID ?? bb.Billboard_ID ?? `${bb.Billboard_Name || bb.name || 'bb'}-${i}`);
                  return (
                    <TableRow key={rowKey}>
                      <TableCell className="font-medium">{bb.Billboard_Name || bb.name}</TableCell>
                      <TableCell>{bb.Size || bb.size}</TableCell>
                      <TableCell>{(Number(bb.capital)||0).toLocaleString()} د.ل</TableCell>
                      <TableCell>{(Number(bb.capital_remaining)||0).toLocaleString()} د.ل</TableCell>
                      <TableCell>
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" checked={!!bb.is_partnership} readOnly className="accent-primary w-4 h-4" />
                          <span className="text-xs">{bb.is_partnership ? 'مفعلة' : 'غير مفعلة'}</span>
                        </label>
                      </TableCell>
                      <TableCell>{Array.isArray(bb.partner_companies) ? (bb.partner_companies.filter(Boolean).join(', ')) : (bb.partner_companies || '')}</TableCell>
                      <TableCell>
                        <div className="flex gap-2 items-center">
                          <Input type="number" placeholder="مبلغ الإيجار" value={rentAmountById[String(bb.id)] || ''} onChange={(e)=> setRentAmountById(p => ({ ...p, [String(bb.id)]: Number(e.target.value) }))} />
                          <Button onClick={() => applyRent(bb)}>تطبيق الإيجار</Button>
                        <Button variant="destructive" onClick={() => removeFromPartnership(bb)}>إزالة من الشراكة</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
