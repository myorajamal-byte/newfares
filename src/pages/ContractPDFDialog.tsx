import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ContractPDFDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: any;
}

export default function ContractPDFDialog({ open, onOpenChange, contract }: ContractPDFDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  // Auto-generate PDF immediately when dialog opens
  useEffect(() => {
    if (open && contract) {
      handlePrintContract();
    }
  }, [open, contract]);

  const calculateContractDetails = () => {
    const startDate = contract?.start_date || contract?.['Contract Date'];
    const endDate = contract?.end_date || contract?.['End Date'];
    const totalCost = contract?.rent_cost || contract?.['Total Rent'] || 0;
    
    let duration = '';
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      duration = `${days}`;
    }

    return {
      price: `${totalCost.toLocaleString('ar-LY')}`,
      duration,
      startDate: startDate ? new Date(startDate).toLocaleDateString('ar-LY') : '',
      endDate: endDate ? new Date(endDate).toLocaleDateString('ar-LY') : ''
    };
  };

  const handlePrintContract = async () => {
    if (!contract) {
      toast.error('لا توجد بيانات عقد للطباعة');
      return;
    }

    setIsGenerating(true);
    try {
      const contractDetails = calculateContractDetails();
      const year = new Date().getFullYear();

      // Extract all contract data automatically
      const contractData = {
        contractNumber: contract?.id || contract?.Contract_Number || '',
        customerName: contract?.customer_name || contract?.['Customer Name'] || '',
        adType: contract?.ad_type || contract?.['Ad Type'] || 'عقد إيجار لوحات إعلانية',
        startDate: contractDetails.startDate,
        endDate: contractDetails.endDate,
        price: contractDetails.price,
        duration: contractDetails.duration,
        year: year.toString(),
        companyName: 'شركة الفارس الذهبي للدعاية والإعلان',
        phoneNumber: '0912612255'
      };

      // Normalize contract billboards for table pages
      const rows: any[] = Array.isArray(contract?.billboards) ? contract.billboards : [];
      const norm = (b: any) => {
        const id = String(b.ID ?? b.id ?? '');
        const image = String(b.image ?? b.Image ?? b.billboard_image ?? b.Image_URL ?? b['@IMAGE'] ?? b.image_url ?? b.imageUrl ?? '');
        const municipality = String(b.Municipality ?? b.municipality ?? '');
        const district = String(b.District ?? b.district ?? '');
        const landmark = String(b.Nearest_Landmark ?? b.nearest_landmark ?? b.location ?? '');
        const size = String(b.Size ?? b.size ?? '');
        const faces = String(b.Faces ?? b.faces ?? b.Number_of_Faces ?? '');
        const priceVal = b.Price ?? b.rent ?? b.Rent_Price ?? b.rent_cost ?? b['Total Rent'];
        const price = typeof priceVal === 'number' ? `${priceVal.toLocaleString('ar-LY')} د.ل` : (priceVal || '');
        let coords: string = String(b.GPS_Coordinates ?? b.coords ?? b.coordinates ?? b.GPS ?? '');
        if (!coords || coords === 'undefined' || coords === 'null') {
          const lat = b.Latitude ?? b.lat ?? b.latitude;
          const lng = b.Longitude ?? b.lng ?? b.longitude;
          if (lat != null && lng != null) coords = `${lat},${lng}`;
        }
        const mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';
        return { id, image, municipality, district, landmark, size, faces, price, mapLink };
      };
      const normalized = rows.map(norm);
      const ROWS_PER_PAGE = 12;
      const tablePagesHtml = normalized.length
        ? normalized
            .reduce((acc: any[][], r, i) => {
              const p = Math.floor(i / ROWS_PER_PAGE);
              (acc[p] ||= []).push(r);
              return acc;
            }, [])
            .map((pageRows) => `
              <div class="template-container page">
                <img src="/bgc2.jpg" alt="خلفية جدول اللوحات" class="template-image" />
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:8%" />
                      <col style="width:14%" />
                      <col style="width:12%" />
                      <col style="width:12%" />
                      <col style="width:18%" />
                      <col style="width:10%" />
                      <col style="width:8%" />
                      <col style="width:10%" />
                      <col style="width:8%" />
                    </colgroup>
                    <tbody>
                      ${pageRows
                        .map(
                          (r) => `
                          <tr>
                            <td class="c-num">${r.id}</td>
                            <td class="c-img">${r.image ? `<img src="${r.image}" alt="صورة اللوحة" />` : ''}</td>
                            <td>${r.municipality}</td>
                            <td>${r.district}</td>
                            <td>${r.landmark}</td>
                            <td>${r.size}</td>
                            <td>${r.faces}</td>
                            <td>${r.price}</td>
                            <td>${r.mapLink ? `<a href="${r.mapLink}" target="_blank" rel="noopener">اضغط هنا</a>` : ''}</td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `)
            .join('')
        : '';

      // Create HTML content for printing - Full A4 size without margins
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>عقد إيجار لوحات إعلانية</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');

            * { margin: 0 !important; padding: 0 !important; box-sizing: border-box; }
            html, body { width: 100% !important; height: 100% !important; overflow: hidden; font-family: 'Noto Sans Arabic', 'Doran', Arial, sans-serif; direction: rtl; text-align: right; background: white; color: #000; }
            .template-container { position: relative; width: 100vw; height: 100vh; overflow: hidden; display: block; }
            .template-image { position: absolute; inset: 0; width: 100% !important; height: 100% !important; object-fit: cover; object-position: center; z-index: 1; display: block; }
            .overlay-svg { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 10; pointer-events: none; }
            .page { page-break-after: always; }

            /* Table overlay area for bgc2 pages */
            .table-area { position: absolute; right: 20mm; left: 20mm; top: 80mm; bottom: 32mm; z-index: 20; }
            .btable { width: 100%; border-collapse: collapse; font-size: 12pt; }
            .btable td { border: 1px solid #000; padding: 4pt 3pt; vertical-align: middle; }
            .c-img img { width: 38mm; height: 22mm; object-fit: cover; display: block; margin: 0 auto; }
            .c-num { text-align: center; font-weight: 700; }
            .btable a { color: #004aad; text-decoration: none; }

            @media print {
              html, body { width: 210mm !important; height: 297mm !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
              .template-container { width: 210mm !important; height: 297mm !important; position: relative !important; }
              .template-image, .overlay-svg { width: 210mm !important; height: 297mm !important; }
              .controls { display: none !important; }
              @page { size: A4; margin: 0 !important; padding: 0 !important; }
            }
            .controls { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 100; background: rgba(0,0,0,0.8); padding: 10px 20px; border-radius: 5px; }
            .controls button { padding: 10px 20px; font-size: 16px; background-color: #0066cc; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 0 5px; }
            .controls button:hover { background-color: #0052a3; }
          </style>
        </head>
        <body>
          <div class="template-container page">
            <img src="/contract-template.png" alt="عقد إيجار لوحات إعلانية" class="template-image" />
            <svg class="overlay-svg" viewBox="0 0 2480 3508" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
              <text x="1750" y="700" font-family="Doran, sans-serif" font-weight="bold" font-size="62" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">إيجار لمواقع إعلانية رقم: ${contractData.contractNumber} سنة ${contractData.year}</text>
              <text x="440" y="700" font-family="Doran, sans-serif" font-weight="bold" font-size="62" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">التاريخ: ${contractData.startDate}</text>
              <text x="2050" y="915" font-family="Doran, sans-serif" font-weight="bold" font-size="62" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">نوع الإعلان: ${contractData.adType}.</text>
              <text x="2220" y="1140" font-family="Doran, sans-serif" font-weight="bold" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">الطرف الأول:</text>
              <text x="1500" y="1140" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">شركة الفارس الذهبي للدعاية والإعلان، طرابلس – طريق المطار، حي الزهور.</text>
              <text x="1960" y="1200" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">يمثلها السيد جمال أحمد زحيل (المدير العام).</text>
              <text x="2210" y="1380" font-family="Doran, sans-serif" font-weight="bold" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">الطرف الثاني:</text>
              <text x="1920" y="1380" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">${contractData.customerName}.</text>
              <text x="1970" y="1440" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">يمثلها السيد علي عمار هاتف: ${contractData.phoneNumber}.</text>
              <text x="2250" y="1630" font-family="Doran, sans-serif" font-weight="bold" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">المقدمة:</text>
              <text x="1290" y="1630" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">نظرًا لرغبة الطرف الثاني في استئجار مساحات إعلانية من الطرف الأول، تم الاتفاق على الشروط التالية:</text>
              <text x="2240" y="1715" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند الأول:</text>
              <text x="1190" y="1715" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">يلتزم الطرف الثاني بتجهيز التصميم في أسرع وقت وأي تأخير يعتبر مسؤوليته، وتبدي مدة العقد من التاريخ .</text>
              <text x="2095" y="1775" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">المذكور في المادة السادسة</text>
              <text x="2230" y="1890" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند الثاني:</text>
              <text x="1170" y="1890" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">يلتزم الطرف الأول بتعبئة وتركيب التصاميم بدقة على المساحات المتفق عليها وفق الجدول المرفق، ويتحمل .</text>
              <text x="1850" y="1950" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">الأخير تكاليف التغيير الناتجة عن الأحوال الجوية أو الحوادث.</text>
              <text x="2225" y="2065" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند الثالث:</text>
              <text x="1240" y="2065" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">في حال وقوع ظروف قاهرة تؤثر على إحدى المساحات، يتم نقل الإعلان إلى موقع بديل، ويتولى الطرف الأول</text>
              <text x="1890" y="2125" font-family="Doran, sans-serif" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">الحصول على الموافقات اللازمة من الجهات ذات العلاقة.</text>
              <text x="2235" y="2240" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند الرابع:</text>
              <text x="1190" y="2240" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">لايجوز للطرف الثاني التنازل عن العقد أو التعامل مع جهات أخرى دون موافقة الطرف الأول، الذي يحتفظ بحق.</text>
              <text x="1530" y="2300" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">استغلال المساحات في المناسبات الوطنية و الانتخابات مع تعويض الطرف الثاني بفترة بديلة.</text>
              <text x="560" y="2410" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="end" dominant-baseline="middle" style="direction: rtl; text-align: center">قيمة العقد ${contractData.price} دينار ليبي بدون طباعة، دفع عند توقيع العقد والنصف الآخر بعد</text>
              <text x="1640" y="2470" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">التركيب، وإذا تأخر السداد عن 30 يومًا يحق للطرف الأول إعادة تأجير المساحات.</text>
              <text x="2210" y="2590" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند السادس:</text>
              <text x="1150" y="2590" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">مدة العقد ${contractData.duration} يومًا تبدأ من ${contractData.startDate} وتنتهي في ${contractData.endDate}، ويجوز تجديده برضى الطرفين قبل</text>
              <text x="1800" y="2650" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">انتهائه بمدة لا تقل عن 15 يومًا وفق شروط يتم الاتفاق عليها .</text>
              <text x="2220" y="2760" font-family="Doran, sans-serif" font-weight="bold" font-size="42" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">البند السابع:</text>
              <text x="1150" y="2760" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">في حال حدوث خلاف بين الطرفين يتم حلّه وديًا، وإذا تعذر ذلك يُعين طرفان محاميان لتسوية النزاع بقرار نهائي</text>
              <text x="2200" y="2820" font-family="Doran, sans-serif" font-size="46" fill="#000" text-anchor="middle" dominant-baseline="middle" style="direction: rtl; text-align: center">وملزم للطرفين.</text>
            </svg>
            <div class="controls"><button onclick="window.print()">طباعة</button><button onclick="window.close()">إغلاق</button></div>
          </div>

          ${tablePagesHtml}
        </body>
        </html>
      `;

      // Create a new window and write the HTML content
      const printWindow = window.open('', '_blank', 'fullscreen=yes,scrollbars=no,resizable=yes');

      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.focus();
            printWindow.print();
          }, 800);
        };

        toast.success('تم فتح العقد للطباعة مع جدول اللوحات!');
        onOpenChange(false);
      } else {
        throw new Error('فشل في فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.');
      }

    } catch (error) {
      console.error('Error opening print window:', error);
      toast.error('حدث خطأ أثناء فتح نافذة الطباعة: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const contractDetails = calculateContractDetails();

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="max-w-md">
        <UIDialog.DialogHeader>
          <UIDialog.DialogTitle>طباعة العقد</UIDialog.DialogTitle>
        </UIDialog.DialogHeader>
        
        <div className="space-y-4">
          {isGenerating ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg font-semibold">جاري تحضير العقد للطباعة...</p>
              <p className="text-sm text-gray-600 mt-2">سيتم فتح نافذة الطباعة بدون فراغات</p>
            </div>
          ) : (
            <>
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">تم إنشاء العقد بالبيانات التالية:</h3>
                <div className="text-sm space-y-1">
                  <p><strong>رقم العقد:</strong> {contract?.id || contract?.Contract_Number || 'غير محدد'}</p>
                  <p><strong>العميل:</strong> {contract?.customer_name || contract?.['Customer Name'] || 'غير محدد'}</p>
                  <p><strong>قيمة العقد:</strong> {contractDetails.price} د.ل</p>
                  <p><strong>مدة العقد:</strong> {contractDetails.duration} يوم</p>
                  <p><strong>تاريخ البداية:</strong> {contractDetails.startDate}</p>
                  <p><strong>تاريخ النهاية:</strong> {contractDetails.endDate}</p>
                  {contract?.billboards && (
                    <p><strong>عدد اللوحات:</strong> {contract.billboards.length}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                >
                  إغلاق
                </Button>
                <Button 
                  onClick={handlePrintContract}
                  className="bg-primary text-primary-foreground"
                >
                  طباعة بدون فراغات
                </Button>
              </div>
            </>
          )}
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}
