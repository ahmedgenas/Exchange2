
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { AlertTriangle, CheckCircle, PackageSearch } from 'lucide-react';

const ShortageView: React.FC = () => {
  const { shortageReports, branches, products, resolveShortage } = useStore();

  const openReports = shortageReports.filter(r => r.status === 'OPEN');
  const resolvedReports = shortageReports.filter(r => r.status === 'RESOLVED');

  // Local state to track input quantities for resolution
  const [resolveQuantities, setResolveQuantities] = useState<{[key:string]: number}>({});

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border-r-4 border-red-600 p-6 rounded-lg shadow-sm mb-6">
        <h2 className="text-2xl font-bold text-red-900 flex items-center gap-2">
           <PackageSearch size={28} />
           إدارة النواقص (الأصناف غير المتوفرة)
        </h2>
        <p className="text-red-700 mt-2">
           القائمة أدناه تحتوي على الأصناف التي طلبها الفروع ولم يتم العثور على أي رصيد لها في كامل شبكة الفروع.
        </p>
      </div>

      <div className="grid lg:grid-cols-1 gap-6">
          {/* Active Shortages */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden border-t-4 border-red-500">
            <h3 className="p-4 font-bold text-lg bg-gray-50 border-b flex justify-between items-center text-black">
                <span>النواقص الحالية (مطلوب توفيرها)</span>
                <span className="bg-red-100 text-red-800 text-xs px-3 py-1 rounded-full">{openReports.length}</span>
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                <thead className="bg-gray-100 text-black font-bold">
                    <tr>
                    <th className="p-4">التاريخ</th>
                    <th className="p-4">الفرع الطالب</th>
                    <th className="p-4">الصنف</th>
                    <th className="p-4">الكمية المطلوبة</th>
                    <th className="p-4 w-48">الكمية الموفرة</th>
                    <th className="p-4">إجراءات</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {openReports.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500">لا يوجد نواقص مسجلة حالياً</td>
                    </tr>
                    ) : (
                    openReports.sort((a,b) => b.createdAt - a.createdAt).map(rep => (
                        <tr key={rep.id} className="hover:bg-red-50 transition">
                        <td className="p-4 text-gray-700">
                            {new Date(rep.createdAt).toLocaleDateString('ar-EG')} 
                            <span className="text-xs text-gray-500 block">{new Date(rep.createdAt).toLocaleTimeString('ar-EG')}</span>
                        </td>
                        <td className="p-4 font-bold text-black">
                            {branches.find(b => b.id === rep.requesterBranchId)?.name}
                        </td>
                        <td className="p-4 font-bold text-gray-900">
                            {products.find(p => p.code === rep.productCode)?.name}
                            <span className="block text-xs font-mono text-gray-500">{rep.productCode}</span>
                        </td>
                        <td className="p-4 text-red-600 font-bold text-lg">{rep.requestedQuantity}</td>
                        <td className="p-4">
                            <input 
                                type="number" 
                                min="1"
                                className="w-full p-2 border border-gray-300 rounded font-bold text-center outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                                placeholder={rep.requestedQuantity.toString()}
                                value={resolveQuantities[rep.id] || rep.requestedQuantity}
                                onChange={(e) => setResolveQuantities({...resolveQuantities, [rep.id]: parseInt(e.target.value) || 0})}
                            />
                        </td>
                        <td className="p-4">
                            <button 
                                onClick={() => {
                                    const qty = resolveQuantities[rep.id] || rep.requestedQuantity;
                                    if(qty <= 0) return alert('الرجاء إدخال كمية صحيحة');
                                    if(window.confirm(`هل تؤكد توفير كمية (${qty}) من هذا الصنف؟`)) {
                                        resolveShortage(rep.id, qty);
                                    }
                                }}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 text-xs"
                            >
                                <CheckCircle size={14} />
                                تأكيد التوفير
                            </button>
                        </td>
                        </tr>
                    ))
                    )}
                </tbody>
                </table>
            </div>
          </div>

          {/* Resolved History */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden border-t-4 border-gray-300 opacity-80">
            <h3 className="p-4 font-bold text-lg bg-gray-50 border-b flex justify-between items-center text-black">
                <span>سجل النواقص التي تم حلها</span>
                <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full">{resolvedReports.length}</span>
            </h3>
             <div className="overflow-x-auto max-h-60">
                <table className="w-full text-right text-sm text-gray-500">
                <thead className="bg-gray-100">
                    <tr>
                    <th className="p-4">التاريخ</th>
                    <th className="p-4">الفرع</th>
                    <th className="p-4">الصنف</th>
                    <th className="p-4">المطلوب / الموفر</th>
                    <th className="p-4">الحالة</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {resolvedReports.map(rep => (
                        <tr key={rep.id}>
                        <td className="p-4">{new Date(rep.createdAt).toLocaleDateString('ar-EG')}</td>
                        <td className="p-4">{branches.find(b => b.id === rep.requesterBranchId)?.name}</td>
                        <td className="p-4">{products.find(p => p.code === rep.productCode)?.name}</td>
                        <td className="p-4 font-mono">
                            <span className="text-red-600">{rep.requestedQuantity}</span> / <span className="text-green-600 font-bold">{rep.providedQuantity || '-'}</span>
                        </td>
                        <td className="p-4"><span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle size={12}/> تم الحل</span></td>
                        </tr>
                    ))}
                </tbody>
                </table>
             </div>
          </div>
      </div>
    </div>
  );
};

export default ShortageView;
