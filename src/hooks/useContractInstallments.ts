import { toast } from 'sonner';
import type { Installment } from './useContractForm';

interface UseContractInstallmentsProps {
  installments: Installment[];
  setInstallments: (installments: Installment[]) => void;
  finalTotal: number;
  calculateDueDate: (paymentType: string, index: number) => string;
}

export const useContractInstallments = ({
  installments,
  setInstallments,
  finalTotal,
  calculateDueDate
}: UseContractInstallmentsProps) => {

  // Smart installment distribution
  const distributeEvenly = (count: number) => {
    if (finalTotal <= 0) {
      toast.warning('لا يمكن توزيع الدفعات بدون إجمالي صحيح');
      return;
    }
    
    count = Math.max(1, Math.min(6, Math.floor(count)));
    const even = Math.floor((finalTotal / count) * 100) / 100;
    
    const newInstallments = Array.from({ length: count }).map((_, i) => ({
      amount: i === count - 1 ? Math.round((finalTotal - even * (count - 1)) * 100) / 100 : even,
      paymentType: i === 0 ? 'عند التوقيع' : 'شهري',
      description: i === 0 ? 'دفعة أولى عند التوقيع' : `الدفعة ${i + 1}`,
      dueDate: calculateDueDate(i === 0 ? 'عند التوقيع' : 'شهري', i)
    }));
    
    setInstallments(newInstallments);
    toast.success(`تم توزيع المبلغ على ${count} دفعات بنجاح`);
  };

  // Add single installment
  const addInstallment = () => {
    const remainingAmount = finalTotal - installments.reduce((sum, inst) => sum + inst.amount, 0);
    const newInstallment = {
      amount: Math.max(0, remainingAmount),
      paymentType: 'شهري',
      description: `الدفعة ${installments.length + 1}`,
      dueDate: calculateDueDate('شهري', installments.length)
    };
    
    setInstallments([...installments, newInstallment]);
  };

  // Remove installment
  const removeInstallment = (index: number) => {
    setInstallments(installments.filter((_, i) => i !== index));
  };

  // Clear all installments
  const clearAllInstallments = () => {
    setInstallments([]);
    toast.success('تم مسح جميع الدفعات');
  };

  // Validate installments
  const validateInstallments = () => {
    if (installments.length === 0) {
      return { isValid: false, message: 'يرجى إضافة دفعات للعقد' };
    }

    const installmentsTotal = installments.reduce((sum, inst) => sum + inst.amount, 0);
    if (Math.abs(installmentsTotal - finalTotal) > 1) {
      return { isValid: false, message: 'مجموع الدفعات لا يساوي إجمالي العقد' };
    }

    return { isValid: true, message: '' };
  };

  return {
    distributeEvenly,
    addInstallment,
    removeInstallment,
    clearAllInstallments,
    validateInstallments
  };
};