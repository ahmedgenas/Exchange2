
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { RequestStatus, InventoryAuditStatus, TransferRequest } from '../types';
import { ClipboardList, AlertTriangle, ArrowRight, CheckCircle, XCircle, History, Calendar, X, Trash2, CheckSquare, FileText } from 'lucide-react';

const InventoryView: React.FC = () => {
  const { requests, branches, products, resolveDiscrepancy, deleteRequest } = useStore();

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Action Modal State
  const [actionModal, setActionModal] = useState<{req: TransferRequest, action: InventoryAuditStatus} | null>(null);
  const [noteInput, setNoteInput] = useState('');

  // Delete Modal State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 1. All Discrepancy Requests
  const allDiscrepancies = requests.filter(r => 
    (r.status === RequestStatus.DISTRIBUTION || 
     r.status === RequestStatus.ASSIGNED || 
     r.status === RequestStatus.DELIVERED || 
     r.status === RequestStatus.COMPLETED) &&
    (r.issuedQuantity !== undefined && r.issuedQuantity < r.quantity)
  );

  // 2. Filter Active
  const activeDiscrepancies = allDiscrepancies.filter(r => 
      !r.inventoryStatus || r.inventoryStatus === InventoryAuditStatus.PENDING
  );

  // 3. Filter History
  const historyDiscrepancies = allDiscrepancies.filter(r => 
      r.inventoryStatus === InventoryAuditStatus.ITEM_FOUND || 
      r.inventoryStatus === InventoryAuditStatus.CONFIRMED_DEFICIT
  ).filter(req => {
      if (!dateFrom && !dateTo) return true;
      const reqDate = new Date(req.createdAt);
      const start = dateFrom ? new Date(dateFrom) : null;
      const end = dateTo ? new Date(dateTo) : null;
      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(23, 59, 59, 999);
      if (start && reqDate < start) return false;
      if (end && reqDate > end) return false;
      return true;
  });

  // Handlers
  const initiateAction = (req: TransferRequest, action: InventoryAuditStatus) => {
      setNoteInput(req.inventoryNote || '');
      setActionModal({ req, action });
  };

  const confirmAction = () => {
      if (actionModal) {
          resolveDiscrepancy(actionModal.req.id, actionModal.action, noteInput);
          setActionModal(null);
          setNoteInput('');
      }
  };

  const confirmDelete = () => {
      if (deleteId && deleteRequest) {
          deleteRequest(deleteId);
          setDeleteId(null);
      }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold flex items-center gap-3">
           <ClipboardList size={32} className="text-orange-500" />
           لوحة تحكم مسئول الجرد (Inventory Manager)
        </h2>
        <p className="text-slate-300 mt-2 text-sm">
           متابعة ومعالجة العجز في التوريد (الفرق بين الكمية المطلوبة والمصروفة).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold transition ${activeTab === 'active' ? 'bg-orange-600 text-white' : 'text-gray-900 hover:bg-orange-50'}`}
        >
          <AlertTriangle size={20} />
          مهام جارية (Pending)
          {activeDiscrepancies.length > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{activeDiscrepancies.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold transition ${activeTab === 'history' ? 'bg-orange-600 text-white' : 'text-gray-900 hover:bg-orange-50'}`}
        >
          <History size={20} />
          سجل التدقيق (History)
        </button>
      </div>

      {/* --- ACTIVE TAB --- */}
      {activeTab === 'active' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden border-t-4 border-orange-500 animate-fade-in">
            <div className="p-4 bg-orange-50 border-b border-orange-100">
                <h3 className="font-bold text-lg text-orange-900 flex items-center gap-2">
                    <AlertTriangle size={20} />
                    فروقات توريد تحتاج لقرار
                </h3>
            </div>
            
            <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
                <thead className="bg-gray-100 text-black font-bold border-b border-gray-200">
                <tr>
                    <th className="p-4">التاريخ</th>
                    <th className="p-4">من (الموّرد)</th>
                    <th className="p-4">إلى (الطالب)</th>
                    <th className="p-4">الصنف</th>
                    <th className="p-4">طلب / صرف</th>
                    <th className="p-4 text-red-600">قيمة العجز</th>
                    <th className="p-4 text-center">الإجراء اللازم</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                {activeDiscrepancies.length === 0 ? (
                    <tr>
                    <td colSpan={7} className="p-12 text-center text-gray-500 font-medium">
                        <CheckCircle size={48} className="mx-auto mb-2 text-green-400" />
                        ممتاز! لا توجد فروقات معلقة حالياً.
                    </td>
                    </tr>
                ) : (
                    activeDiscrepancies.sort((a,b) => b.createdAt - a.createdAt).map(req => {
                    const deficit = req.quantity - (req.issuedQuantity || 0);
                    const prodName = products.find(p => p.code === req.productCode)?.name;
                    
                    return (
                        <tr key={req.id} className="hover:bg-orange-50 transition">
                        <td className="p-4 text-gray-700 font-mono text-xs">
                            {new Date(req.createdAt).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="p-4 font-bold text-black">
                            {branches.find(b => b.id === req.targetBranchId)?.name}
                        </td>
                        <td className="p-4 text-gray-600">
                            {branches.find(b => b.id === req.requesterBranchId)?.name}
                        </td>
                        <td className="p-4 font-bold text-gray-900">
                            {prodName}
                            <span className="block text-xs font-mono text-gray-400">{req.productCode}</span>
                        </td>
                        <td className="p-4 text-gray-900 font-medium">
                            <span className="text-gray-500">{req.quantity}</span> / <span className="text-green-700 font-bold">{req.issuedQuantity}</span>
                        </td>
                        <td className="p-4">
                            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full font-bold text-sm">
                                {deficit} -
                            </span>
                        </td>
                        <td className="p-4">
                            <div className="flex justify-center gap-2">
                                <button 
                                    onClick={() => initiateAction(req, InventoryAuditStatus.ITEM_FOUND)}
                                    className="bg-green-600 text-white px-3 py-2 rounded text-xs font-bold hover:bg-green-700 shadow-sm transition flex items-center gap-1"
                                >
                                    <CheckCircle size={14} /> الصنف موجود
                                </button>
                                <button 
                                    onClick={() => initiateAction(req, InventoryAuditStatus.CONFIRMED_DEFICIT)}
                                    className="bg-red-600 text-white px-3 py-2 rounded text-xs font-bold hover:bg-red-700 shadow-sm transition flex items-center gap-1"
                                >
                                    <XCircle size={14} /> تأكيد العجز
                                </button>
                            </div>
                        </td>
                        </tr>
                    );
                    })
                )}
                </tbody>
            </table>
            </div>
        </div>
      )}

      {/* --- HISTORY TAB --- */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden border-t-4 border-gray-500 animate-fade-in">
             <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-4 justify-between items-center">
                <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                    <History size={20} />
                    أرشيف العمليات
                </h3>
                
                {/* Date Filter */}
                <div className="flex items-center gap-2 bg-white p-1.5 rounded border border-gray-300 shadow-sm">
                    <Calendar size={16} className="text-gray-500" />
                    <input 
                        type="date" 
                        className="text-xs p-1 border rounded outline-none text-black bg-gray-50"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                    />
                    <span className="text-xs text-gray-400">-</span>
                    <input 
                        type="date" 
                        className="text-xs p-1 border rounded outline-none text-black bg-gray-50"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                    />
                    {(dateFrom || dateTo) && (
                        <button onClick={() => {setDateFrom(''); setDateTo('');}} className="text-red-500 hover:text-red-700 p-1">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
                <thead className="bg-gray-100 text-black font-bold border-b border-gray-200">
                <tr>
                    <th className="p-4">التاريخ</th>
                    <th className="p-4">الفرع الموّرد</th>
                    <th className="p-4">الصنف</th>
                    <th className="p-4">العجز</th>
                    <th className="p-4">القرار</th>
                    <th className="p-4">الملاحظات</th>
                    <th className="p-4">حذف</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                {historyDiscrepancies.length === 0 ? (
                    <tr>
                    <td colSpan={7} className="p-12 text-center text-gray-500 font-medium">
                        السجل فارغ.
                    </td>
                    </tr>
                ) : (
                    historyDiscrepancies.sort((a,b) => b.createdAt - a.createdAt).map(req => {
                    const deficit = req.quantity - (req.issuedQuantity || 0);
                    return (
                        <tr key={req.id} className="hover:bg-gray-50 transition">
                        <td className="p-4 text-gray-700 font-mono text-xs">
                            {new Date(req.createdAt).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="p-4 font-bold text-black">
                            {branches.find(b => b.id === req.targetBranchId)?.name}
                        </td>
                        <td className="p-4 font-bold text-gray-900">
                            {products.find(p => p.code === req.productCode)?.name}
                        </td>
                        <td className="p-4">
                            <span className="text-red-600 font-bold">{deficit}</span>
                        </td>
                        <td className="p-4">
                            {req.inventoryStatus === InventoryAuditStatus.ITEM_FOUND && (
                                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-bold text-xs flex items-center gap-1 w-fit">
                                    <CheckCircle size={12}/> موجود
                                </span>
                            )}
                            {req.inventoryStatus === InventoryAuditStatus.CONFIRMED_DEFICIT && (
                                <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full font-bold text-xs flex items-center gap-1 w-fit">
                                    <XCircle size={12}/> عجز
                                </span>
                            )}
                        </td>
                        <td className="p-4 text-gray-600 italic text-xs max-w-xs break-words">
                            {req.inventoryNote || '-'}
                        </td>
                        <td className="p-4">
                            <button onClick={() => setDeleteId(req.id)} className="text-gray-400 hover:text-red-600 transition">
                                <Trash2 size={16} />
                            </button>
                        </td>
                        </tr>
                    );
                    })
                )}
                </tbody>
            </table>
            </div>
        </div>
      )}

      {/* --- CONFIRMATION ACTION MODAL --- */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className={`bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border-t-8 transform transition-all scale-100 ${actionModal.action === InventoryAuditStatus.CONFIRMED_DEFICIT ? 'border-red-500' : 'border-green-500'}`}>
                <div className="flex flex-col items-center text-center mb-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${actionModal.action === InventoryAuditStatus.CONFIRMED_DEFICIT ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {actionModal.action === InventoryAuditStatus.CONFIRMED_DEFICIT ? <XCircle size={32} /> : <CheckCircle size={32} />}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {actionModal.action === InventoryAuditStatus.CONFIRMED_DEFICIT ? 'تأكيد العجز (Deficit)' : 'تأكيد وجود الصنف (Found)'}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                        {actionModal.action === InventoryAuditStatus.CONFIRMED_DEFICIT 
                            ? "سيتم خصم الكمية الناقصة من رصيد الفرع بشكل نهائي."
                            : "سيتم إغلاق الملف واعتبار الصنف موجوداً (خطأ في الصرف)."
                        }
                    </p>
                    
                    <div className="w-full text-right">
                        <label className="text-xs font-bold text-gray-500 mb-1 block">ملاحظات (اختياري):</label>
                        <textarea 
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            placeholder="أكتب توضيحاً..."
                            className="w-full p-2 border border-gray-300 rounded text-sm text-black h-20 outline-none focus:border-orange-500 bg-gray-50 resize-none"
                        />
                    </div>
                </div>
                <div className="flex gap-3 mt-4">
                    <button 
                        onClick={confirmAction}
                        className={`flex-1 py-3 rounded-lg font-bold text-white transition shadow-lg ${actionModal.action === InventoryAuditStatus.CONFIRMED_DEFICIT ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                        نعم، تنفيذ الإجراء
                    </button>
                    <button 
                        onClick={() => setActionModal(null)}
                        className="flex-1 bg-gray-100 text-gray-800 py-3 rounded-lg font-bold hover:bg-gray-200 transition"
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- DELETE CONFIRM MODAL --- */}
      {deleteId && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border-t-8 border-gray-500">
                  <div className="text-center mb-6">
                      <Trash2 size={40} className="mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-bold text-black">حذف السجل</h3>
                      <p className="text-gray-500 text-sm mt-2">هل أنت متأكد من حذف هذا السجل من الأرشيف؟</p>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={confirmDelete} className="flex-1 bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700">حذف</button>
                      <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-100 text-black py-2 rounded font-bold hover:bg-gray-200">إلغاء</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default InventoryView;
