import { useMemo, useEffect } from 'react';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import type { Billboard } from '@/types';
import type { ContractFormData } from './useContractForm';

interface UseContractCalculationsProps {
  formData: ContractFormData;
  selected: string[];
  billboards: Billboard[];
  userEditedRentCost: boolean;
  installationCost: number;
  pricingData: any[];
  getPriceFromDatabase: (size: string, level: any, customer: string, months: number) => number | null;
  getDailyPriceFromDatabase: (size: string, level: any, customer: string) => number | null;
  onRentCostChange: (cost: number) => void;
}

export const useContractCalculations = ({
  formData,
  selected,
  billboards,
  userEditedRentCost,
  installationCost,
  pricingData,
  getPriceFromDatabase,
  getDailyPriceFromDatabase,
  onRentCostChange
}: UseContractCalculationsProps) => {
  
  // Calculate estimated total based on selected billboards and pricing
  const estimatedTotal = useMemo(() => {
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    
    if (formData.pricingMode === 'months') {
      const months = Math.max(0, Number(formData.durationMonths || 0));
      if (!months) return 0;
      
      return sel.reduce((acc, b) => {
        const size = (b.size || (b as any).Size || '') as string;
        const level = ((b as any).level || (b as any).Level) as any;
        
        // Try database first
        let price = getPriceFromDatabase(size, level, formData.pricingCategory, months);
        
        // Fallback to static pricing if not found in database
        if (price === null) {
          price = getPriceFor(size, level, formData.pricingCategory as CustomerType, months);
        }
        
        if (price !== null) return acc + price;
        
        // Final fallback to billboard price
        const monthly = Number((b as any).price) || 0;
        return acc + monthly * months;
      }, 0);
    } else {
      const days = Math.max(0, Number(formData.durationDays || 0));
      if (!days) return 0;
      
      return sel.reduce((acc, b) => {
        const size = (b.size || (b as any).Size || '') as string;
        const level = ((b as any).level || (b as any).Level) as any;
        
        // Try database first
        let daily = getDailyPriceFromDatabase(size, level, formData.pricingCategory);
        
        // Fallback to static pricing if not found in database
        if (daily === null) {
          daily = getDailyPriceFor(size, level, formData.pricingCategory as CustomerType);
        }
        
        // If still null, calculate from monthly price
        if (daily === null) {
          let monthlyPrice = getPriceFromDatabase(size, level, formData.pricingCategory, 1);
          if (monthlyPrice === null) {
            monthlyPrice = getPriceFor(size, level, formData.pricingCategory as CustomerType, 1) || 0;
          }
          daily = monthlyPrice ? Math.round((monthlyPrice / 30) * 100) / 100 : 0;
        }
        
        return acc + (daily || 0) * days;
      }, 0);
    }
  }, [billboards, selected, formData.durationMonths, formData.durationDays, formData.pricingMode, formData.pricingCategory, pricingData, getPriceFromDatabase, getDailyPriceFromDatabase]);

  // Auto update rent cost with new estimation unless user manually edited it
  useEffect(() => {
    if (!userEditedRentCost) {
      onRentCostChange(estimatedTotal);
    }
  }, [estimatedTotal, userEditedRentCost, onRentCostChange]);

  // Calculate base total
  const baseTotal = useMemo(() => (
    formData.rentCost && formData.rentCost > 0 ? formData.rentCost : estimatedTotal
  ), [formData.rentCost, estimatedTotal]);

  // Calculate discount amount
  const discountAmount = useMemo(() => {
    if (!formData.discountValue) return 0;
    return formData.discountType === 'percent'
      ? (baseTotal * Math.max(0, Math.min(100, formData.discountValue)) / 100)
      : Math.max(0, formData.discountValue);
  }, [formData.discountType, formData.discountValue, baseTotal]);

  // Calculate totals
  const totalAfterDiscount = useMemo(() => Math.max(0, baseTotal - discountAmount), [baseTotal, discountAmount]);
  const rentalCostOnly = useMemo(() => Math.max(0, totalAfterDiscount - installationCost), [totalAfterDiscount, installationCost]);
  const finalTotal = useMemo(() => rentalCostOnly + installationCost, [rentalCostOnly, installationCost]);

  // Calculate operating fee
  const operatingFee = useMemo(() => {
    return Math.round(rentalCostOnly * (formData.operatingFeeRate / 100) * 100) / 100;
  }, [rentalCostOnly, formData.operatingFeeRate]);

  return {
    estimatedTotal,
    baseTotal,
    discountAmount,
    totalAfterDiscount,
    rentalCostOnly,
    finalTotal,
    operatingFee
  };
};