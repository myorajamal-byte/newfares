import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import type { Billboard } from '@/types';

interface AvailableBillboardsGridProps {
  billboards: Billboard[];
  selected: string[];
  onToggleSelect: (billboard: Billboard) => void;
  loading: boolean;
}

export function AvailableBillboardsGrid({
  billboards,
  selected,
  onToggleSelect,
  loading
}: AvailableBillboardsGridProps) {
  return (
    <Card className="bg-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-card-foreground">
          <Calendar className="h-5 w-5 text-primary" />
          اللوحات المتاحة ({billboards.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-10 text-center">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              جاري التحميل...
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {billboards.map((b) => {
              const isSelected = selected.includes(String((b as any).ID));
              const st = ((b as any).status || (b as any).Status || '').toString().toLowerCase();
              const hasContract = !!(b as any).contractNumber || !!(b as any).Contract_Number || !!(b as any).contract_number;
              const isAvailable = st === 'available' || (!hasContract && st !== 'rented');
              
              // تحديد ما إذا كانت اللوحة قريبة من الانتهاء
              const today = new Date();
              const endDate = (b as any).Rent_End_Date || (b as any).rent_end_date || (b as any).rentEndDate;
              const isNearExpiring = endDate ? (() => {
                const end = new Date(endDate);
                if (isNaN(end.getTime())) return false;
                const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
                return diff > 0 && diff <= 30;
              })() : false;

              const canSelect = isAvailable || isNearExpiring || isSelected;
              
              return (
                <Card 
                  key={(b as any).ID} 
                  className={`
                    bg-card/80 border-border transition-all duration-300
                    ${!canSelect ? 'opacity-60' : 'hover:border-primary/50'} 
                    ${isSelected ? 'border-primary bg-primary/10' : ''}
                  `}
                >
                  <CardContent className="p-0">
                    {(b as any).image && (
                      <img 
                        src={(b as any).image} 
                        alt={(b as any).name || (b as any).Billboard_Name} 
                        className="w-full h-40 object-cover rounded-t-lg" 
                      />
                    )}
                    <div className="p-3 space-y-2">
                      <div className="font-semibold text-card-foreground">
                        {(b as any).name || (b as any).Billboard_Name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(b as any).location || (b as any).Nearest_Landmark}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(b as any).city || (b as any).City} • {(b as any).size || (b as any).Size}
                      </div>
                      <div className="text-sm text-primary font-medium">
                        {(Number((b as any).price) || 0).toLocaleString('ar-LY')} د.ل / شهر
                      </div>
                      
                      {/* عرض حالة اللوحة */}
                      <div className="flex items-center gap-2 text-xs">
                        {isAvailable && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                            متاحة
                          </span>
                        )}
                        {isNearExpiring && (
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">
                            قريبة الانتهاء
                          </span>
                        )}
                        {!isAvailable && !isNearExpiring && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full">
                            مؤجرة
                          </span>
                        )}
                      </div>
                      
                      <div className="pt-2">
                        <Button 
                          size="sm" 
                          variant={isSelected ? 'destructive' : 'outline'} 
                          onClick={() => onToggleSelect(b as any)} 
                          disabled={!canSelect}
                          className="w-full"
                        >
                          {isSelected ? 'إزالة' : 'إضافة'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        {!loading && billboards.length === 0 && (
          <div className="py-10 text-center text-muted-foreground">
            لا توجد لوحات تطابق معايير البحث
          </div>
        )}
      </CardContent>
    </Card>
  );
}