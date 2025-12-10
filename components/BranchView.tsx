
// ... (keeping imports)
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { RequestStatus, TransferRequest, Product } from '../types';
import { Search, MapPin, Clock, CheckCircle, AlertCircle, Barcode, ArrowLeftRight, History, ArrowRight, X, Archive, ShoppingCart, Plus, Trash, Send, Filter, FileText, CheckSquare, PackageCheck, Scan, Truck, Check, XOctagon, BellRing, Ban, AlertTriangle, PackageX, Sparkles, Activity, Timer, Edit2, Save, HelpCircle, Snowflake, Calendar } from 'lucide-react';

const BranchView: React.FC = () => {
  const { currentUser, products, requests, branches, stocks, shortageReports, createRequest, createBulkRequest, updateRequestQuantity, approveRequest, rejectRequest, confirmReception, cancelRequest, deleteRequest, reportShortage, archiveShortageNotification } = useStore();
  const [activeTab, setActiveTab] = useState<'search' | 'incoming' | 'history'>('search');
  
  // Search & Cart State
  const [searchCode, setSearchCode] = useState('');
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [foundProductStock, setFoundProductStock] = useState<number>(0); // Store Global Stock
  const [requestQuantity, setRequestQuantity] = useState<number>(1);
  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);

  // Incoming Filter State
  const [incomingFilter, setIncomingFilter] = useState('');
  
  // Date Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Confirmation State for Receiving
  const [receiptNumbers, setReceiptNumbers] = useState<{[key:string]: string}>({});

  // Cancel Confirmation Modal State
  const [requestToCancel, setRequestToCancel] = useState<string | null>(null);

  // Shortage Confirmation Modal State
  const [isShortageModalOpen, setIsShortageModalOpen] = useState(false);
  const [shortageQty, setShortageQty] = useState(1);
  
  // Editing Request State
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [editQuantityVal, setEditQuantityVal] = useState<number>(0);
  const [showEditConfirmModal, setShowEditConfirmModal] = useState(false);

  // Audio Notification State
  // We track the IDs of pending requests to detect *new* ones specifically
  const prevPendingIds = useRef<Set<string>>(new Set());

  if (!currentUser || !currentUser.branchId) return <div>خطأ في الصلاحيات</div>;

  // Helper to calculate distance in KM
  const getDistanceKm = (loc1: {lat: number, lng: number}, loc2: {lat: number, lng: number}) => {
    if (!loc1 || !loc2) return 0;
    const R = 6371; // Radius of the earth in km
    const dLat = (loc2.lat - loc1.lat) * (Math.PI / 180);
    const dLon = (loc2.lng - loc1.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(loc1.lat * (Math.PI / 180)) * Math.cos(loc2.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in km
    return d;
  };

  // Helper: Filter by Date Range
  const filterByDate = (req: TransferRequest) => {
      if (!dateFrom && !dateTo) return true;
      const reqDate = new Date(req.createdAt);
      const start = dateFrom ? new Date(dateFrom) : null;
      const end = dateTo ? new Date(dateTo) : null;
      
      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(23, 59, 59, 999);

      if (start && reqDate < start) return false;
      if (end && reqDate > end) return false;
      return true;
  };

  // 1. Pending Incoming Requests (Need Action)
  // We need an unfiltered list for the audio detection to ensure it triggers even if filtered
  const allPendingIncomingRequests = requests.filter(
    r => r.targetBranchId === currentUser.branchId && r.status === RequestStatus.PENDING
  );

  const pendingIncomingRequests = allPendingIncomingRequests.filter(r => {
      if(!incomingFilter) return true;
      // SAFEGUARD: Ensure name and code are strings before calling includes
      const prodName = (products.find(p => p.code === r.productCode)?.name || '').toLowerCase();
      return prodName.includes(incomingFilter.toLowerCase()) || (r.productCode || '').includes(incomingFilter);
  });

  // Effect to play sound on new incoming request
  useEffect(() => {
    // Current set of IDs
    const currentIds = new Set<string>(allPendingIncomingRequests.map(r => r.id));
    
    // Check if any ID in current is NOT in prev (New Arrival)
    const hasNewRequest = allPendingIncomingRequests.some(r => !prevPendingIds.current.has(r.id));
    
    if (hasNewRequest && prevPendingIds.current.size >= 0) {
       const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
       audio.volume = 0.6; // Subtle volume
       audio.play().catch(err => console.log('Audio notification prevented:', err));
    }

    // Update ref
    prevPendingIds.current = currentIds;
  }, [allPendingIncomingRequests]);


  // 2. Fulfilled Incoming Requests (History of what I sent)
  const fulfilledIncomingRequests = requests.filter(
    r => r.targetBranchId === currentUser.branchId && 
    (r.status === RequestStatus.APPROVED || r.status === RequestStatus.DISTRIBUTION || r.status === RequestStatus.ASSIGNED || r.status === RequestStatus.PICKED_UP || r.status === RequestStatus.DELIVERED || r.status === RequestStatus.COMPLETED || r.status === RequestStatus.REJECTED || r.status === RequestStatus.CANCELLED || r.status === RequestStatus.EXPIRED)
  ).filter(filterByDate);
  
  // 3. Active outgoing requests (Waiting for approval, delivery, or confirmation)
  // UPDATED: Included PICKED_UP so requester can see items in transit
  const outgoingRequests = requests.filter(
    r => r.requesterBranchId === currentUser.branchId && 
    (r.status === RequestStatus.PENDING || r.status === RequestStatus.APPROVED || r.status === RequestStatus.DISTRIBUTION || r.status === RequestStatus.ASSIGNED || r.status === RequestStatus.PICKED_UP || r.status === RequestStatus.DELIVERED)
  );

  // 4. History (Completed, Expired, Rejected, CANCELLED)
  const historyRequests = requests.filter(
    r => r.requesterBranchId === currentUser.branchId && 
    (r.status === RequestStatus.COMPLETED || r.status === RequestStatus.EXPIRED || r.status === RequestStatus.REJECTED || r.status === RequestStatus.CANCELLED)
  ).filter(filterByDate);

  // 5. Resolved Shortages (Notifications)
  const resolvedShortages = shortageReports.filter(
      r => r.requesterBranchId === currentUser.branchId && r.status === 'RESOLVED' && !r.archivedByRequester
  );

  const handleSearch = () => {
    const prod = products.find(p => p.code === searchCode || p.barcode === searchCode);
    if (prod) {
      // Calculate Global Stock excluding own branch
      const globalStock = stocks
        .filter(s => s.productCode === prod.code && s.branchId !== currentUser.branchId)
        .reduce((sum, s) => sum + s.quantity, 0);

      setFoundProduct(prod);
      setFoundProductStock(globalStock);
      setRequestQuantity(1);
    } else {
      alert('صنف غير موجود');
      setFoundProduct(null);
      setFoundProductStock(0);
    }
  };

  const handleReportDirectShortage = () => {
      if(foundProduct) {
          setShortageQty(1);
          setIsShortageModalOpen(true);
      }
  };

  const confirmShortageReport = () => {
      if (foundProduct && shortageQty > 0) {
        reportShortage(currentUser.branchId!, foundProduct.code, shortageQty);
        setFoundProduct(null);
        setSearchCode('');
        setIsShortageModalOpen(false);
      }
  };

  const addToCart = () => {
    if (foundProduct && foundProductStock > 0) {
      // Check if already in cart
      const existing = cart.find(item => item.product.code === foundProduct.code);
      if (existing) {
        setCart(cart.map(item => 
          item.product.code === foundProduct.code 
            ? { ...item, quantity: item.quantity + requestQuantity }
            : item
        ));
      } else {
        setCart([...cart, { product: foundProduct, quantity: requestQuantity }]);
      }
      setFoundProduct(null);
      setSearchCode('');
      setRequestQuantity(1);
    } else {
        alert("لا يمكن إضافة الصنف للسلة لعدم توفر رصيد.");
    }
  };

  const addToCartFromShortage = (reportId: string, productCode: string, quantity: number) => {
      const prod = products.find(p => p.code === productCode);
      if(prod) {
        const existing = cart.find(item => item.product.code === productCode);
        if (existing) {
            setCart(cart.map(item => 
            item.product.code === productCode 
                ? { ...item, quantity: item.quantity + quantity }
                : item
            ));
        } else {
            setCart([...cart, { product: prod, quantity: quantity }]);
        }
        archiveShortageNotification(reportId);
        alert('تم إضافة الصنف المتوفر للسلة بنجاح.');
      }
  };

  const removeFromCart = (code: string) => {
    setCart(cart.filter(item => item.product.code !== code));
  };

  const handleSendAllRequests = () => {
    if (cart.length === 0) return;
    const items = cart.map(c => ({ productCode: c.product.code, quantity: c.quantity }));
    createBulkRequest(currentUser.branchId!, items);
    setCart([]);
  };

  const handleConfirmReception = (requestId: string) => {
      const receiptNum = receiptNumbers[requestId];
      if(!receiptNum) return alert("الرجاء إدخال رقم استلام الإذن");
      confirmReception(requestId, receiptNum);
  };

  // Improved Cancel Logic with Modal
  const initiateCancel = (reqId: string) => {
      setRequestToCancel(reqId);
  };

  const confirmCancelAction = () => {
      if(requestToCancel) {
          cancelRequest(requestToCancel);
          setRequestToCancel(null);
      }
  };

  const handleDeleteHistory = (reqId: string) => {
      if(window.confirm("هل تريد حذف هذا السجل نهائياً؟ لا يمكن التراجع عن هذا الإجراء.")) {
          if (deleteRequest) {
             deleteRequest(reqId);
          }
      }
  };
  
  // Edit Handlers
  const startEditing = (req: TransferRequest) => {
      setEditingRequestId(req.id);
      setEditQuantityVal(req.quantity);
  };
  
  const cancelEditing = () => {
      setEditingRequestId(null);
      setEditQuantityVal(0);
      setShowEditConfirmModal(false);
  };
  
  const initiateSaveEditing = () => {
      if (editQuantityVal <= 0) {
          alert("الكمية يجب أن تكون أكبر من 0");
          return;
      }
      setShowEditConfirmModal(true);
  };

  const confirmSaveEditing = () => {
      if (editingRequestId) {
        updateRequestQuantity(editingRequestId, editQuantityVal);
        setEditingRequestId(null);
      }
      setShowEditConfirmModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-white rounded-lg shadow overflow-hidden mb-6">
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold transition ${activeTab === 'search' ? 'bg-orange-500 text-white' : 'text-gray-900 hover:bg-orange-50'}`}
        >
          <Search size={20} />
          طلب جديد / جاري
        </button>
        <button
          onClick={() => setActiveTab('incoming')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold transition ${activeTab === 'incoming' ? 'bg-orange-500 text-white' : 'text-gray-900 hover:bg-orange-50'}`}
        >
          <ArrowLeftRight size={20} />
          الوارد (مطلوب مني)
          {pendingIncomingRequests.length > 0 && (
            <span className="bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{pendingIncomingRequests.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold transition ${activeTab === 'history' ? 'bg-orange-500 text-white' : 'text-gray-900 hover:bg-orange-50'}`}
        >
          <History size={20} />
          سجل طلباتي السابقة
        </button>
      </div>

      {activeTab === 'search' && (
        <div className="grid lg:grid-cols-12 gap-6">
            {/* Left Column: Search and Add to Cart */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Resolved Shortages Alert Area */}
            {resolvedShortages.length > 0 && (
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg shadow-sm animate-fade-in mb-4">
                    <h3 className="font-bold text-green-800 flex items-center gap-2 mb-2">
                        <Sparkles size={20} className="text-green-600" />
                        نواقص تم توفيرها (يمكنك طلبها الآن!)
                    </h3>
                    <div className="space-y-2">
                        {resolvedShortages.map(rep => (
                            <div key={rep.id} className="bg-white p-3 rounded border border-green-200 flex justify-between items-center shadow-sm">
                                <div>
                                    <p className="font-bold text-black">{products.find(p => p.code === rep.productCode)?.name}</p>
                                    <p className="text-xs text-green-700">تم حل المشكلة: {new Date(rep.resolvedAt || Date.now()).toLocaleDateString('ar-EG')}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => addToCartFromShortage(rep.id, rep.productCode, rep.requestedQuantity)}
                                        className="bg-black text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-gray-800"
                                    >
                                        إضافة للسلة ({rep.requestedQuantity})
                                    </button>
                                    <button 
                                        onClick={() => archiveShortageNotification(rep.id)}
                                        className="text-gray-400 hover:text-gray-600 px-1"
                                        title="إخفاء التنبيه"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-orange-500">
                <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
                <Search className="text-orange-600" />
                بحث وإضافة للسلة
                </h2>
                <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    placeholder="كود الصنف أو الباركود"
                    className="flex-1 p-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-gray-900 bg-white placeholder-gray-400"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button onClick={handleSearch} className="bg-orange-600 text-white px-6 rounded-lg hover:bg-orange-700 transition font-bold">
                    بحث
                </button>
                </div>

                {foundProduct && (
                <div className={`border p-4 rounded-lg animate-fade-in ${foundProductStock > 0 ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 className="font-bold text-lg text-black flex items-center gap-2">
                        {foundProduct.name}
                        {foundProduct.isFridge && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1"><Snowflake size={12}/> ثلاجة</span>}
                        </h3>
                        <p className="text-sm text-gray-700 font-mono">كود: {foundProduct.code}</p>
                        {foundProductStock > 0 ? (
                            <p className="text-xs text-green-600 font-bold mt-1">متوفر في الشبكة: {foundProductStock} قطعة</p>
                        ) : (
                            <p className="text-xs text-red-600 font-bold mt-1 flex items-center gap-1">
                                <AlertTriangle size={12}/>
                                غير متوفر في أي فرع (رصيد صفري)
                            </p>
                        )}
                    </div>
                    
                    {foundProductStock > 0 ? (
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="flex items-center border border-gray-600 rounded-lg bg-gray-800">
                                <button 
                                    onClick={() => setRequestQuantity(Math.max(1, requestQuantity - 1))}
                                    className="px-3 py-1 text-white hover:bg-gray-700 font-bold"
                                >-</button>
                                <input 
                                    type="number" 
                                    value={requestQuantity}
                                    onChange={(e) => setRequestQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-16 text-center py-1 outline-none text-white font-bold bg-transparent"
                                />
                                <button 
                                    onClick={() => setRequestQuantity(requestQuantity + 1)}
                                    className="px-3 py-1 text-white hover:bg-gray-700 font-bold"
                                >+</button>
                            </div>
                            <button 
                                onClick={addToCart}
                                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition flex items-center gap-2 flex-1 sm:flex-none justify-center font-bold"
                            >
                                <Plus size={16} />
                                إضافة
                            </button>
                        </div>
                    ) : (
                        <div className="w-full sm:w-auto">
                            <button 
                                onClick={handleReportDirectShortage}
                                className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-2 justify-center font-bold text-sm shadow-md"
                            >
                                <PackageX size={16} />
                                إبلاغ مسئول النواقص
                            </button>
                        </div>
                    )}
                    </div>
                </div>
                )}
            </div>

            {/* Cart Section */}
            {cart.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-gray-600 animate-fade-in">
                    <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                        <ShoppingCart className="text-gray-800" />
                        سلة الطلبات ({cart.length})
                    </h3>
                    <div className="space-y-2 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
                        {cart.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-100">
                                <div>
                                    <span className="font-bold text-black flex items-center gap-2">
                                        {item.product.name}
                                        {item.product.isFridge && <Snowflake size={14} className="text-blue-500" />}
                                    </span>
                                    <span className="text-sm text-gray-600 mx-2 font-bold">(الكمية: {item.quantity})</span>
                                </div>
                                <button 
                                    onClick={() => removeFromCart(item.product.code)}
                                    className="text-red-600 hover:text-red-800 p-1"
                                >
                                    <Trash size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={handleSendAllRequests}
                        className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold hover:shadow-lg transition flex items-center justify-center gap-2"
                    >
                        <Send size={18} />
                        إرسال جميع الطلبات للفروع
                    </button>
                </div>
            )}
          </div>

          {/* Right Column: Ongoing Requests */}
          <div className="lg:col-span-5 bg-white p-6 rounded-lg shadow-md border-t-4 border-orange-500 h-fit">
            <h2 className="text-xl font-bold text-black mb-4">طلباتي الجارية (الصادرة)</h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {outgoingRequests.length === 0 ? (
                <p className="text-gray-500 text-center py-8">لا يوجد طلبات جارية حالياً</p>
              ) : (
                outgoingRequests.sort((a,b) => b.createdAt - a.createdAt).map(req => {
                    // Calculate Estimate Time if in Transit (PICKED_UP)
                    let estimateDisplay = null;
                    if (req.status === RequestStatus.PICKED_UP) {
                        const sourceBranch = branches.find(b => b.id === req.targetBranchId);
                        const myBranch = branches.find(b => b.id === currentUser.branchId);
                        if (sourceBranch && myBranch) {
                             const dist = getDistanceKm(sourceBranch.location, myBranch.location);
                             const mins = Math.round((dist / 40) * 60 + 5);
                             estimateDisplay = (
                                <div className="mt-2 bg-blue-50 border border-blue-200 p-2 rounded-lg flex items-center justify-between animate-pulse">
                                    <div className="flex items-center gap-2">
                                        <Truck size={16} className="text-blue-600" />
                                        <span className="text-xs font-bold text-blue-800">جاري التوصيل إليك</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock size={14} className="text-blue-600" />
                                        <span className="text-xs font-mono font-black text-blue-900">{mins} دقيقة</span>
                                    </div>
                                </div>
                             );
                        }
                    }

                  const prod = products.find(p => p.code === req.productCode);

                  return (
                  <div key={req.id} className="border border-gray-200 p-3 rounded-lg bg-gray-50 animate-fade-in transition-all duration-300 hover:shadow-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-black flex items-center gap-2 flex-wrap">
                             {prod?.name}
                             {prod?.isFridge && <Snowflake size={16} className="text-blue-500" />}
                             
                             {/* Editable Quantity Area */}
                             {req.status === RequestStatus.PENDING ? (
                                 editingRequestId === req.id ? (
                                    <div className="flex items-center bg-gray-200 rounded px-1">
                                        <input 
                                            type="number"
                                            value={editQuantityVal}
                                            onChange={(e) => setEditQuantityVal(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="w-12 text-center bg-white border border-gray-300 rounded text-xs font-bold p-1 outline-none"
                                            autoFocus
                                        />
                                        <button onClick={initiateSaveEditing} className="text-green-600 p-1 hover:bg-green-100 rounded mx-1">
                                            <Save size={14}/>
                                        </button>
                                        <button onClick={cancelEditing} className="text-red-600 p-1 hover:bg-red-100 rounded">
                                            <X size={14}/>
                                        </button>
                                    </div>
                                 ) : (
                                    <span className="bg-gray-200 text-black text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1 group relative">
                                        طلب: {req.quantity}
                                        <button 
                                            onClick={() => startEditing(req)}
                                            className="hidden group-hover:inline-block text-gray-500 hover:text-black ml-1"
                                            title="تعديل الكمية"
                                        >
                                            <Edit2 size={10} />
                                        </button>
                                    </span>
                                 )
                             ) : (
                                <span className="bg-gray-200 text-black text-xs px-2 py-0.5 rounded-full font-bold">طلب: {req.quantity}</span>
                             )}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-700 mt-1">
                          <span>الفرع المستهدف:</span>
                          <span className="font-bold text-black">
                            {branches.find(b => b.id === req.targetBranchId)?.name}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>

                    {/* Estimated Arrival Time (New) */}
                    {estimateDisplay}

                    {/* Pending Actions - Cancel Logic */}
                    {req.status === RequestStatus.PENDING && (
                        <div className="mt-2 flex justify-end">
                            <button 
                                onClick={() => initiateCancel(req.id)}
                                className="text-red-600 text-xs font-bold border border-red-200 px-3 py-1.5 rounded hover:bg-red-50 hover:border-red-400 flex items-center gap-1 transition shadow-sm"
                            >
                                <Ban size={14} /> إلغاء الطلب
                            </button>
                        </div>
                    )}

                    {/* Transaction Details (Issue Number/Qty) */}
                    {(req.status === RequestStatus.APPROVED || req.status === RequestStatus.DISTRIBUTION || req.status === RequestStatus.ASSIGNED || req.status === RequestStatus.PICKED_UP || req.status === RequestStatus.DELIVERED) && (
                        <div className="mt-2 text-xs bg-white border border-gray-200 p-2 rounded">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-500 font-bold">رقم إذن الصرف:</span>
                                <span className="font-mono text-black">{req.issueNumber || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-bold">الكمية المصروفة:</span>
                                <span className="font-bold text-green-600">{req.issuedQuantity || req.quantity}</span>
                            </div>
                        </div>
                    )}

                    {/* Confirmation Action for Delivered Requests */}
                    {req.status === RequestStatus.DELIVERED && (
                        <div className="mt-3 bg-green-50 p-3 rounded border border-green-200 animate-fade-in">
                            <h4 className="font-bold text-green-800 text-sm mb-2 flex items-center gap-1">
                                <PackageCheck size={14}/>
                                تأكيد استلام الطلبية
                            </h4>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="رقم استلام الإذن"
                                    className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                    value={receiptNumbers[req.id] || ''}
                                    onChange={(e) => setReceiptNumbers({...receiptNumbers, [req.id]: e.target.value})}
                                />
                                <button 
                                    onClick={() => handleConfirmReception(req.id)}
                                    className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-green-700"
                                >
                                    تأكيد
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Attempted Branches Progress Stepper */}
                    {req.attemptedBranchIds && req.attemptedBranchIds.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">مسار الطلب</span>
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                                    {req.attemptedBranchIds.length} محاولات
                                </span>
                            </div>
                            
                            <div className="relative flex items-center w-full">
                                {/* Connecting Line */}
                                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -translate-y-1/2 z-0"></div>
                                
                                {req.attemptedBranchIds.map((bid, idx) => {
                                    const bName = branches.find(b => b.id === bid)?.name.split('-')[0].trim() || 'فرع';
                                    const isLast = idx === req.attemptedBranchIds.length - 1;
                                    
                                    // Determine State
                                    let state = 'past'; // past, current, current-success, current-fail
                                    if (isLast) {
                                        if (req.status === RequestStatus.PENDING) state = 'current';
                                        else if (req.status === RequestStatus.REJECTED || req.status === RequestStatus.EXPIRED || req.status === RequestStatus.CANCELLED) state = 'current-fail';
                                        else state = 'current-success';
                                    }

                                    return (
                                        <div key={bid} className="flex-1 flex flex-col items-center relative z-10 group">
                                            {/* Dot / Icon */}
                                            <div className={`
                                                flex items-center justify-center rounded-full border-2 transition-all duration-300
                                                ${state === 'past' ? 'w-4 h-4 bg-gray-50 border-gray-300 text-gray-300' : ''}
                                                ${state === 'current' ? 'w-8 h-8 bg-white border-orange-500 text-orange-600 shadow-md ring-4 ring-orange-50' : ''}
                                                ${state === 'current-success' ? 'w-8 h-8 bg-green-500 border-green-600 text-white shadow-md' : ''}
                                                ${state === 'current-fail' ? 'w-8 h-8 bg-red-500 border-red-600 text-white shadow-md' : ''}
                                            `}>
                                                {state === 'past' && <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                                                {state === 'current' && <Timer size={14} className="animate-spin-slow" />}
                                                {state === 'current-success' && <Check size={14} />}
                                                {state === 'current-fail' && <X size={14} />}
                                            </div>
                                            
                                            {/* Label */}
                                            <div className={`
                                                mt-2 text-[10px] font-bold text-center px-1
                                                ${state === 'past' ? 'text-gray-400' : 'text-gray-900'}
                                            `}>
                                                {bName}
                                            </div>
                                            
                                            {/* Status Label for Current */}
                                            {isLast && (
                                                <div className={`
                                                    absolute -top-6 text-[9px] px-1.5 py-0.5 rounded text-white font-bold whitespace-nowrap shadow-sm opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100
                                                    ${state === 'current' ? 'bg-orange-500' : ''}
                                                    ${state === 'current-success' ? 'bg-green-600' : ''}
                                                    ${state === 'current-fail' ? 'bg-red-500' : ''}
                                                `}>
                                                    {state === 'current' ? 'جاري الاتصال...' : 
                                                    state === 'current-success' ? 'تم القبول' : 'فشل/رفض'}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                  </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'incoming' && (
        <div className="space-y-8">
            {/* 1. Pending Incoming Requests */}
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-orange-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-xl font-bold text-black flex items-center gap-2">
                    <ArrowLeftRight className="text-orange-600" />
                    طلبات واردة (تحتاج موافقة / رد)
                </h2>
                <div className="relative w-full md:w-64">
                    <Filter className="absolute right-3 top-3 text-gray-400" size={16} />
                    <input 
                    type="text" 
                    placeholder="بحث باسم الصنف..." 
                    value={incomingFilter}
                    onChange={(e) => setIncomingFilter(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none text-black"
                    />
                </div>
            </div>
            
            <div className="grid gap-4">
                {pendingIncomingRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <CheckCircle size={48} className="mx-auto mb-2 text-gray-300" />
                    <p>لا يوجد طلبات جديدة تحتاج للموافقة</p>
                </div>
                ) : (
                pendingIncomingRequests.map(req => (
                    <IncomingRequestCard 
                        key={req.id} 
                        request={req} 
                        onApprove={approveRequest} 
                        onReject={rejectRequest}
                    />
                ))
                )}
            </div>
            </div>

            {/* 2. Processed/Fulfilled Requests Tracking Table */}
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-green-500">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                    <h2 className="text-xl font-bold text-black flex items-center gap-2">
                        <Truck className="text-green-600" />
                        سجل المنصرفات ومتابعة الاستلام (ما تم إرساله للفروع)
                    </h2>
                    
                    {/* Date Filters */}
                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                        <Calendar size={16} className="text-gray-500" />
                        <span className="text-xs font-bold text-gray-500">فلتر بالتاريخ:</span>
                        <input 
                            type="date" 
                            className="text-xs p-1 border rounded outline-none text-black"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                        <span className="text-xs text-gray-400">-</span>
                        <input 
                            type="date" 
                            className="text-xs p-1 border rounded outline-none text-black"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                        {(dateFrom || dateTo) && (
                            <button onClick={() => {setDateFrom(''); setDateTo('');}} className="text-red-500 hover:text-red-700">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-gray-100 text-black">
                            <tr>
                                <th className="p-3">التاريخ</th>
                                <th className="p-3">الصنف</th>
                                <th className="p-3">للفرع الطالب</th>
                                <th className="p-3">الكمية المصروفة</th>
                                <th className="p-3">رقم إذن الصرف (لدينا)</th>
                                <th className="p-3">رقم استلام الطالب (لديهم)</th>
                                <th className="p-3">الحالة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {fulfilledIncomingRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-gray-500">
                                        {(dateFrom || dateTo) ? 'لا توجد نتائج في هذا التاريخ' : 'سجل المنصرفات فارغ'}
                                    </td>
                                </tr>
                            ) : (
                                fulfilledIncomingRequests.sort((a,b) => b.createdAt - a.createdAt).map(req => (
                                    <tr key={req.id} className="hover:bg-gray-50">
                                        <td className="p-3 text-gray-600 font-mono text-xs">
                                            {new Date(req.createdAt).toLocaleDateString('ar-EG')}
                                        </td>
                                        <td className="p-3 font-bold text-black">
                                            {products.find(p => p.code === req.productCode)?.name}
                                        </td>
                                        <td className="p-3 text-gray-900">
                                            {branches.find(b => b.id === req.requesterBranchId)?.name}
                                        </td>
                                        <td className="p-3 font-bold text-black">{req.issuedQuantity || req.quantity}</td>
                                        <td className="p-3 font-mono text-gray-700">{req.issueNumber || (req.status === RequestStatus.REJECTED ? <span className="text-red-500 text-xs">مرفوض: {req.rejectionReason}</span> : (req.status === RequestStatus.CANCELLED ? <span className="text-red-500 text-xs">ملغي من الطالب</span> : (req.status === RequestStatus.EXPIRED ? <span className="text-red-500 text-xs">فشل: تجاوز الوقت</span> : '-')))}</td>
                                        <td className="p-3 font-mono">
                                            {req.receiptNumber ? (
                                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-bold flex items-center gap-1 w-fit">
                                                    <Check size={12} /> {req.receiptNumber}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic">في الانتظار...</span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <StatusBadge status={req.status} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-gray-500">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <h2 className="text-xl font-bold text-black flex items-center gap-2">
                <Archive className="text-gray-600" />
                سجل طلباتي السابقة (ما طلبته من الآخرين)
            </h2>
             
            {/* Date Filters */}
            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                <Calendar size={16} className="text-gray-500" />
                <span className="text-xs font-bold text-gray-500">فلتر بالتاريخ:</span>
                <input 
                    type="date" 
                    className="text-xs p-1 border rounded outline-none text-black"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                />
                <span className="text-xs text-gray-400">-</span>
                <input 
                    type="date" 
                    className="text-xs p-1 border rounded outline-none text-black"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                />
                {(dateFrom || dateTo) && (
                    <button onClick={() => {setDateFrom(''); setDateTo('');}} className="text-red-500 hover:text-red-700">
                        <X size={14} />
                    </button>
                )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-100 text-black">
                <tr>
                  <th className="p-3">الصنف</th>
                  <th className="p-3">الكمية</th>
                  <th className="p-3">من الفرع</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">أرقام العملية</th>
                  <th className="p-3">الحالة النهائية</th>
                  <th className="p-3">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {historyRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                         {(dateFrom || dateTo) ? 'لا توجد نتائج في هذا التاريخ' : 'سجل الطلبات فارغ'}
                    </td>
                  </tr>
                ) : (
                  historyRequests.sort((a,b) => b.createdAt - a.createdAt).map(req => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="p-3 font-bold text-black">
                        {products.find(p => p.code === req.productCode)?.name}
                        <div className="text-xs text-gray-500 font-normal">{req.productCode}</div>
                      </td>
                      <td className="p-3 font-bold text-black">
                        {req.issuedQuantity || req.quantity}
                      </td>
                      <td className="p-3 text-gray-800">
                        {branches.find(b => b.id === req.targetBranchId)?.name}
                      </td>
                      <td className="p-3 text-sm text-gray-700">
                        {new Date(req.createdAt).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="p-3 text-xs">
                         <div className="text-gray-900">صرف: {req.issueNumber || '-'}</div>
                         <div className="text-green-700">استلام: {req.receiptNumber || '-'}</div>
                      </td>
                      <td className="p-3">
                        <StatusBadge status={req.status} />
                        {req.status === RequestStatus.REJECTED && req.rejectionReason && (
                            <div className="text-red-600 text-xs mt-1">السبب: {req.rejectionReason}</div>
                        )}
                        {req.status === RequestStatus.EXPIRED && (
                            <div className="text-red-600 text-xs mt-1 font-bold">فشل: لم يتم الرد خلال 30 دقيقة</div>
                        )}
                      </td>
                      <td className="p-3">
                          {/* Allow deleting cancelled/rejected items to clean up history */}
                          {(req.status === RequestStatus.CANCELLED || req.status === RequestStatus.REJECTED || req.status === RequestStatus.EXPIRED) && (
                              <button onClick={() => handleDeleteHistory(req.id)} className="text-red-400 hover:text-red-600">
                                  <Trash size={16} />
                              </button>
                          )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {requestToCancel && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border-t-8 border-red-500 transform transition-all scale-100">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">تأكيد إلغاء الطلب</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                        هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟ <br/>
                        سينتقل الطلب إلى سجل "طلباتي السابقة" ولن يتم إرساله للفرع الآخر.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={confirmCancelAction}
                        className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition shadow-lg hover:shadow-red-200"
                    >
                        نعم، إلغاء الطلب
                    </button>
                    <button 
                        onClick={() => setRequestToCancel(null)}
                        className="flex-1 bg-gray-100 text-gray-800 py-3 rounded-lg font-bold hover:bg-gray-200 transition"
                    >
                        تراجع
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Edit Confirmation Modal */}
      {showEditConfirmModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border-t-8 border-blue-500 transform transition-all scale-100">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4">
                        <HelpCircle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">تأكيد تعديل الكمية</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                        هل أنت متأكد من تغيير الكمية المطلوبة إلى <strong className="text-blue-600 text-lg">{editQuantityVal}</strong>؟ <br/>
                        سيتم تحديث الحجز في الفرع المستهدف.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={confirmSaveEditing}
                        className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg hover:shadow-blue-200"
                    >
                        تأكيد التعديل
                    </button>
                    <button 
                        onClick={() => setShowEditConfirmModal(false)}
                        className="flex-1 bg-gray-100 text-gray-800 py-3 rounded-lg font-bold hover:bg-gray-200 transition"
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Shortage Confirmation Modal */}
      {isShortageModalOpen && foundProduct && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border-t-8 border-red-500 transform transition-all scale-100">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                        <PackageX size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">تأكيد بلاغ النواقص</h3>
                    <p className="text-gray-600 text-sm leading-relaxed mb-4">
                        الصنف <strong>{foundProduct.name}</strong> غير متوفر في أي فرع.<br/>
                        يرجى تحديد الكمية التي تريد طلبها من "مسئول النواقص":
                    </p>
                    <div className="flex items-center border border-gray-300 rounded-lg bg-gray-50">
                        <button 
                            onClick={() => setShortageQty(Math.max(1, shortageQty - 1))}
                            className="px-4 py-2 text-black hover:bg-gray-200 font-bold rounded-r-lg"
                        >-</button>
                        <input 
                            type="number" 
                            value={shortageQty}
                            onChange={(e) => setShortageQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 text-center py-2 outline-none text-black font-bold bg-transparent"
                        />
                        <button 
                            onClick={() => setShortageQty(shortageQty + 1)}
                            className="px-4 py-2 text-black hover:bg-gray-200 font-bold rounded-l-lg"
                        >+</button>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={confirmShortageReport}
                        className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition shadow-lg hover:shadow-red-200"
                    >
                        إرسال البلاغ
                    </button>
                    <button 
                        onClick={() => setIsShortageModalOpen(false)}
                        className="flex-1 bg-gray-100 text-gray-800 py-3 rounded-lg font-bold hover:bg-gray-200 transition"
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

// ... (Rest of the file remains unchanged, keeping IncomingRequestCard and StatusBadge components)
const IncomingRequestCard: React.FC<{ 
  request: TransferRequest; 
  onApprove: (id: string, issueNum: string, quantity: number) => void;
  onReject: (id: string, reason: string) => void; 
}> = ({ request, onApprove, onReject }) => {
  const { products, branches } = useStore();
  const [issueNum, setIssueNum] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [issuedQty, setIssuedQty] = useState(request.quantity);
  const [validationError, setValidationError] = useState('');
  
  // Modal States
  const [showApproveModal, setShowApproveModal] = useState(false);
  
  // Initialize immediately to prevent 00:00 flash
  const calculateTimeLeft = () => Math.max(0, request.expiresAt - Date.now());
  const [timeLeft, setTimeLeft] = useState<number>(calculateTimeLeft());
  
  // Rejection State
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
        const remaining = calculateTimeLeft();
        setTimeLeft(remaining);
    }, 1000);
    return () => clearInterval(timer);
  }, [request.expiresAt]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  // --- 3-Section Timer Logic ---
  let timerColorClass = "";
  let timerLabel = "";
  let timerIcon = <Clock size={24} />;

  // Determine phases
  const isGreenPhase = minutes >= 20;
  const isYellowPhase = minutes >= 10 && minutes < 20;
  const isRedPhase = minutes < 10;

  if (isGreenPhase) {
      timerColorClass = "bg-green-50 text-green-900 border-green-500 shadow-green-100";
      timerLabel = "وقت آمن (Safe)";
  } else if (isYellowPhase) {
      timerColorClass = "bg-yellow-50 text-yellow-900 border-yellow-500 shadow-yellow-100";
      timerLabel = "انتبه للوقت (Warning)";
  } else {
      timerColorClass = "bg-red-50 text-red-900 border-red-600 animate-pulse ring-4 ring-red-200 shadow-red-100";
      timerLabel = "حرج جداً (Critical)!";
      timerIcon = <BellRing size={24} className="animate-bounce text-red-600" />;
  }

  const handleConfirmClick = () => {
    setValidationError('');
    if (!issueNum) {
        setValidationError('يجب إدخال رقم إذن الصرف');
        return;
    }
    if (issuedQty <= 0) {
        setValidationError('الكمية يجب أن تكون أكبر من 0');
        return;
    }
    setShowApproveModal(true);
  };

  const handleFinalApprove = () => {
    onApprove(request.id, issueNum, issuedQty);
    setShowApproveModal(false);
  };

  const handleReject = () => {
      if(!rejectionReason.trim()) return alert('لابد من ذكر سبب الرفض');
      onReject(request.id, rejectionReason);
  };

  const product = products.find(p => p.code === request.productCode);

  if (isRejecting) {
      return (
        <div className="border-2 border-red-200 bg-red-50 p-4 rounded-lg animate-fade-in mb-4">
            <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                <XOctagon size={16} />
                رفض الطلب بالكامل
            </h4>
            <textarea 
                className="w-full p-2 border border-gray-300 rounded mb-2 text-sm text-black" 
                placeholder="أدخل سبب الرفض (إجباري)..."
                rows={2}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div className="flex gap-2">
                <button 
                    onClick={handleReject} 
                    className="flex-1 bg-red-600 text-white py-1.5 rounded font-bold hover:bg-red-700 text-sm"
                >
                    تأكيد الرفض وتحويل الطلب
                </button>
                <button 
                    onClick={() => setIsRejecting(false)} 
                    className="flex-1 bg-gray-200 text-gray-800 py-1.5 rounded font-bold hover:bg-gray-300 text-sm"
                >
                    إلغاء
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className={`bg-white p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow border-l-4 mb-4 ${product?.isFridge ? 'border border-blue-200 border-l-blue-500 bg-blue-50/10' : 'border border-orange-100 border-l-orange-500'} animate-fade-in`}>
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
        
        {/* Product Info & Timer */}
        <div className="flex-1 w-full">
            <div className="flex justify-between items-start mb-4">
                <div>
                   <span className="text-sm text-gray-500 font-bold block mb-1">
                     طلب وارد من: {branches.find(b => b.id === request.requesterBranchId)?.name}
                   </span>
                   <h3 className="font-black text-2xl text-gray-900 flex items-center gap-3">
                     {product?.name}
                     {product?.isFridge && <Snowflake size={24} className="text-blue-500" />}
                     <span className="bg-black text-white text-sm px-3 py-1 rounded-full">الكمية المطلوبة: {request.quantity}</span>
                   </h3>
                   <p className="text-gray-400 font-mono text-sm mt-1">CODE: {request.productCode}</p>
                </div>

                {/* Enlarged 3-Section Timer */}
                <div className={`flex flex-col items-center justify-center px-4 py-3 rounded-xl border-2 transition-all duration-500 shadow-lg ${timerColorClass} w-48 relative overflow-hidden`}>
                   
                   <span className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">{timerLabel}</span>
                   <div className="flex items-center gap-2 mb-2">
                      {timerIcon}
                      <span className="text-4xl font-black font-mono leading-none tracking-tighter drop-shadow-sm">
                         {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
                      </span>
                   </div>
                   
                   {/* Visual Sections Bar - RTL: Right is Start (High Time), Left is End (Low Time) */}
                   <div className="flex w-full gap-1.5 mt-1 h-3 px-1">
                       {/* Green Section (20-30m) - Rightmost in RTL */}
                       <div className={`flex-1 rounded-r-md transition-all duration-500 border ${isGreenPhase ? 'bg-green-600 border-green-700 shadow-[0_0_10px_rgba(22,163,74,0.8)] scale-y-110 z-10' : 'bg-green-100 border-green-200 grayscale opacity-50'}`} title="Safe (20-30m)"></div>

                       {/* Yellow Section (10-20m) - Middle */}
                       <div className={`flex-1 transition-all duration-500 border ${isYellowPhase ? 'bg-yellow-500 border-yellow-600 shadow-[0_0_10px_rgba(234,179,8,0.8)] scale-y-110 z-10' : 'bg-yellow-100 border-yellow-200 grayscale opacity-50'}`} title="Warning (10-20m)"></div>
                       
                       {/* Red Section (0-10m) - Leftmost in RTL */}
                       <div className={`flex-1 rounded-l-md transition-all duration-500 border ${isRedPhase ? 'bg-red-600 border-red-700 shadow-[0_0_10px_rgba(22,38,38,0.8)] scale-y-110 z-10' : 'bg-red-100 border-red-200 grayscale opacity-50'}`} title="Critical (0-10m)"></div>
                   </div>
                </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                 <div className="relative">
                     <label className="text-xs font-bold text-gray-800 mb-1 block">الكمية المصروفة (تعديل)</label>
                     <input 
                        type="number"
                        value={issuedQty}
                        onChange={(e) => setIssuedQty(parseInt(e.target.value) || 0)}
                        className={`w-full h-16 text-3xl font-black text-center text-white bg-gray-900 border-2 rounded-lg outline-none shadow-inner focus:ring-4 focus:ring-orange-500 transition-all ${issuedQty < request.quantity ? 'border-red-500 text-red-400' : 'border-gray-800 focus:border-orange-500'}`}
                     />
                     {issuedQty < request.quantity && (
                         <span className="text-[10px] text-red-600 font-bold block mt-1 text-center">تنبيه: الكمية أقل من المطلوب</span>
                     )}
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">رقم إذن الصرف</label>
                    <div className="relative h-16">
                        <FileText className="absolute right-3 top-5 text-gray-400" size={20} />
                        <input
                            type="text"
                            value={issueNum}
                            onChange={(e) => setIssueNum(e.target.value)}
                            placeholder="رقم الإذن"
                            className="pr-10 pl-3 h-full border border-gray-600 rounded-lg w-full focus:ring-2 focus:ring-orange-500 outline-none text-white bg-gray-900 text-lg font-bold placeholder-gray-500"
                        />
                    </div>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">تأكيد بالباركود</label>
                    <div className="relative h-16">
                        <Scan className="absolute right-3 top-5 text-gray-400" size={20} />
                        <input
                            type="text"
                            value={scannedBarcode}
                            onChange={(e) => setScannedBarcode(e.target.value)}
                            placeholder="امسح الصنف..."
                            className="pr-10 pl-3 h-full border border-gray-600 rounded-lg w-full focus:ring-2 focus:ring-orange-500 outline-none text-white bg-gray-900 text-lg font-bold placeholder-gray-500"
                        />
                    </div>
                 </div>
                 {validationError && (
                    <div className="col-span-3 text-red-600 text-xs font-bold text-center bg-red-50 p-1 rounded animate-pulse">
                        <AlertTriangle size={12} className="inline mr-1" />
                        {validationError}
                    </div>
                 )}
            </div>
        </div>

        {/* Action Buttons (Right side on desktop) */}
        <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto h-full justify-center">
            
            {/* Fridge Alert */}
            {product?.isFridge && (
                <div className="bg-blue-100 border border-blue-400 text-blue-800 p-2 rounded-lg text-center font-bold text-xs flex flex-col items-center justify-center animate-pulse mb-2 shadow-sm">
                    <Snowflake size={20} className="mb-1" />
                    تنبيه هام:<br/> الصنف يحتاج ثلج
                </div>
            )}

            <button 
              onClick={handleConfirmClick}
              className="flex-1 md:flex-none bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <CheckSquare size={18} />
              تأكيد الصرف
            </button>
            <button 
              onClick={() => setIsRejecting(true)}
              className="flex-1 md:flex-none bg-white text-red-600 px-6 py-3 rounded-lg hover:bg-red-50 transition font-bold border border-red-200 flex items-center justify-center gap-2"
              title="رفض الطلب"
            >
              <XOctagon size={18} />
              رفض
            </button>
        </div>
      </div>

      {/* Approve Confirmation Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border-t-8 border-green-500 transform transition-all scale-100">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
                        <CheckCircle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">تأكيد صرف الطلبية</h3>
                    
                    {/* Fridge Warning in Modal */}
                    {product?.isFridge && (
                        <div className="bg-blue-100 text-blue-900 p-3 rounded-lg font-bold text-sm mb-4 w-full flex items-center gap-2 justify-center border border-blue-300">
                            <Snowflake size={18} />
                            تذكير: يرجى وضع ثلج مع الطلبية
                        </div>
                    )}

                    {/* Barcode Warning Check */}
                    {(() => {
                        const prod = products.find(p => p.code === request.productCode);
                        if (!scannedBarcode) {
                            return <p className="text-yellow-600 bg-yellow-50 p-2 rounded text-xs font-bold mb-2 w-full">تنبيه: لم يتم مسح الباركود للتحقق!</p>;
                        } else if (prod && prod.barcode && scannedBarcode !== prod.barcode && scannedBarcode !== prod.code) {
                             return <p className="text-red-600 bg-red-50 p-2 rounded text-xs font-bold mb-2 w-full">تحذير: الباركود الممسوح غير مطابق!</p>;
                        }
                        return <p className="text-green-600 text-xs font-bold mb-2">تم التحقق من الباركود بنجاح</p>;
                    })()}

                    <div className="bg-gray-50 rounded p-3 w-full text-right text-sm space-y-1">
                        <div className="flex justify-between"><span className="text-gray-500">رقم الإذن:</span> <span className="font-bold font-mono">{issueNum}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">الكمية:</span> <span className="font-bold text-green-700">{issuedQty}</span></div>
                        {issuedQty < request.quantity && <div className="text-red-600 text-xs font-bold text-center pt-1 border-t mt-1">يوجد عجز في الكمية ({request.quantity - issuedQty})</div>}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleFinalApprove}
                        className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg hover:shadow-green-200"
                    >
                        تأكيد وإرسال
                    </button>
                    <button 
                        onClick={() => setShowApproveModal(false)}
                        className="flex-1 bg-gray-100 text-gray-800 py-3 rounded-lg font-bold hover:bg-gray-200 transition"
                    >
                        تراجع
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status: RequestStatus }> = ({ status }) => {
  const styles = {
    [RequestStatus.PENDING]: "bg-yellow-100 text-yellow-800",
    [RequestStatus.APPROVED]: "bg-blue-100 text-blue-800",
    [RequestStatus.DISTRIBUTION]: "bg-purple-100 text-purple-800",
    [RequestStatus.ASSIGNED]: "bg-indigo-100 text-indigo-800",
    [RequestStatus.PICKED_UP]: "bg-orange-100 text-orange-800",
    [RequestStatus.DELIVERED]: "bg-teal-100 text-teal-800",
    [RequestStatus.COMPLETED]: "bg-green-100 text-green-800",
    [RequestStatus.EXPIRED]: "bg-red-100 text-red-800",
    [RequestStatus.REJECTED]: "bg-red-100 text-red-800",
    [RequestStatus.CANCELLED]: "bg-gray-100 text-gray-600 line-through",
  };

  const labels = {
    [RequestStatus.PENDING]: "قيد الانتظار",
    [RequestStatus.APPROVED]: "تمت الموافقة",
    [RequestStatus.DISTRIBUTION]: "في التوزيع",
    [RequestStatus.ASSIGNED]: "مع المندوب",
    [RequestStatus.PICKED_UP]: "جاري التوصيل",
    [RequestStatus.DELIVERED]: "تم التوصيل",
    [RequestStatus.COMPLETED]: "مكتملة",
    [RequestStatus.EXPIRED]: "فشل (تجاوز الوقت)",
    [RequestStatus.REJECTED]: "مرفوض",
    [RequestStatus.CANCELLED]: "ملغي",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${styles[status]} transition-all duration-500`}>
      {labels[status]}
    </span>
  );
};

export default BranchView;
