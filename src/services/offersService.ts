import { supabase } from '@/integrations/supabase/client';

export type OfferRow = {
  id?: string;
  customer_name: string;
  duration_months: number;
  notes?: string;
  selected_boards: any[];
  created_at?: string;
};

export async function createOffer(row: OfferRow): Promise<OfferRow | null> {
  try {
    const payload: any = {
      customer_name: row.customer_name,
      duration_months: row.duration_months,
      notes: row.notes || null,
      selected_boards: row.selected_boards ? JSON.stringify(row.selected_boards) : JSON.stringify([]),
    };
    const { data, error } = await (supabase as any)
      .from('offers')
      .insert(payload)
      .select()
      .single();
    if (error) {
      console.warn('Failed to insert into offers table:', error);
      return null;
    }
    return data as OfferRow;
  } catch (e) {
    console.warn('createOffer failed:', e);
    return null;
  }
}

export async function listOffers(): Promise<OfferRow[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('offers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('listOffers error:', error);
      return [];
    }
    return (data as any[]) || [];
  } catch (e) {
    console.warn('listOffers failed:', e);
    return [];
  }
}
