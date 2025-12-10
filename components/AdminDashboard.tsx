
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts';
import { RequestStatus, UserRole, User, Branch, Product, Stock, TransferRequest, FirebaseConfig } from '../types';
import { Activity, LayoutDashboard, PackagePlus, Users, Building, Database, Save, Server, Trash2, PlusCircle, Search, MapPin, Snowflake, Edit2, CheckCircle, Shield, AlertCircle, FileText, ArrowUpDown, Clock, Zap, X, Key } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const { 
    requests, products, branches, stocks, users, systemConfig, updateSystemConfig,
    addProduct, editProduct, deleteProduct,
    addUser, 
    addBranch, editBranch, deleteBranch, 
    updateStock, deleteStock,
  } = useStore();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'users' | 'branches' | 'stock' | 'products' | 'settings'>('overview');
  
  // Forms State
  const [newUser, setNewUser] = useState<Partial<User>>({ role: UserRole.BRANCH_MANAGER, username: '', password: '', name: '', branchId: '' });
  const [newBranch, setNewBranch] = useState<Partial<Branch>>({ name: '', address: '', location: { lat: 30.04, lng: 31.23 } });
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ name: '', code: '', barcode: '', isFridge: false });
  const [stockForm, setStockForm] = useState({ branchId: '', productCode: '', quantity: 0 });
  const [filterText, setFilterText] = useState('');

  // Editing State
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingProductCode, setEditingProductCode] = useState<string | null>(null);

  // Report Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Firebase Config Form
  const [fbConfig, setFbConfig] = useState<FirebaseConfig>(systemConfig.firebase || {
      apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: ''
  });

  const handleSaveFirebase = () => {
      updateSystemConfig({
          mode: 'CLOUD',
          firebase: fbConfig
      });
      alert("تم حفظ الإعدادات وسيتم إعادة تحميل النظام للاتصال بقاعدة البيانات السحابية.");
  };

  const handleSwitchLocal = () => {
      if(window.confirm("هل أنت متأكد من العودة للوضع المحلي؟ لن ترى البيانات المشتركة بين الفروع.")) {
          updateSystemConfig({ mode: 'LOCAL' });
      }
  };

  // Stats
  const total = requests.length;
  const completed = requests.filter(r => r.status === RequestStatus.DELIVERED || r.status === RequestStatus.COMPLETED).length;
  const pending = requests.filter(r => r.status === RequestStatus.PENDING).length;
  const expired = requests.filter(r => r.status === RequestStatus.EXPIRED).length;
  const rejected = requests.filter(r => r.status === RequestStatus.REJECTED).length;

  const statusData = [
    { name: 'مكتمل/واصل', value: completed, color: '#10b981' },
    { name: 'قيد الانتظار', value: pending, color: '#f59e0b' },
    { name: 'منتهي الوقت', value: expired, color: '#ef4444' },
    { name: 'مرفوض', value: rejected, color: '#991b1b' },
  ];

  // Helper: Calculate Distance
  const getDistanceKm = (loc1: {lat: number, lng: number}, loc2: {lat: number, lng: number}) => {
    if (!loc1 || !loc2) return 0;
    const R = 6371; 
    const dLat = (loc2.lat - loc1.lat) * (Math.PI / 180);
    const dLon = (loc2.lng - loc1.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(loc1.lat * (Math.PI / 180)) * Math.cos(loc2.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Report Data Calculation: Delivery Performance
  const driverPerformanceData = useMemo(() => {
    const deliveredRequests = requests.filter(
        r => (r.status === RequestStatus.DELIVERED || r.status === RequestStatus.COMPLETED) && 
        r.pickedUpAt && r.deliveredAt && r.driverId
    );

    let data = deliveredRequests.map(req => {
        const driver = users.find(u => u.id === req.driverId);
        const source = branches.find(b => b.id === req.targetBranchId);
        const target = branches.find(b => b.id === req.requesterBranchId);
        
        // Actual Time in Minutes
        const actualMinutes = Math.round((req.deliveredAt! - req.pickedUpAt!) / 60000);
        
        // Estimated Time
        let distance = 0;
        let estMinutes = 0;
        
        if (source?.location && target?.location) {
            distance = getDistanceKm(source.location, target.location);
            // Avg speed 40km/h + 5 min buffer
            estMinutes = Math.round((distance / 40) * 60 + 5);
        }

        const variance = actualMinutes - estMinutes; // Positive = Late, Negative = Fast

        return {
            id: req.id,
            date: req.deliveredAt,
            driverName: driver?.name || 'Unknown',
            route: `${source?.name} -> ${target?.name}`,
            distance: distance.toFixed(1),
            estTime: estMinutes,
            actualTime: actualMinutes,
            variance: variance
        };
    });

    if (sortConfig && ['driverName', 'distance', 'estTime', 'actualTime', 'variance'].includes(sortConfig.key)) {
        data.sort((a: any, b: any) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return data;
  }, [requests, users, branches, sortConfig]);
  
  // Report Data Calculation: Branch Response Performance
  const branchResponseData = useMemo(() => {
    let data = branches.map(branch => {
        const branchRequests = requests.filter(r => r.targetBranchId === branch.id);
        const total = branchRequests.length;
        
        // Requests that have been responded to (Approved or Rejected)
        const respondedReqs = branchRequests.filter(r => 
            (r.status === RequestStatus.APPROVED || 
             r.status === RequestStatus.DISTRIBUTION || 
             r.status === RequestStatus.ASSIGNED || 
             r.status === RequestStatus.PICKED_UP || 
             r.status === RequestStatus.DELIVERED || 
             r.status === RequestStatus.COMPLETED || 
             r.status === RequestStatus.REJECTED) &&
             !r.archivedByRequester
        );

        const responseTimes = respondedReqs.map(r => {
            if (r.respondedAt) return r.respondedAt - r.createdAt;
            // Fallback for rejection if respondedAt missing
            if (r.status === RequestStatus.REJECTED && r.updatedAt) return r.updatedAt - r.createdAt;
            return 0; 
        }).filter(t => t > 0);

        const avgTime = responseTimes.length > 0 
            ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) / 60000) 
            : 0;

        const expired = branchRequests.filter(r => r.status === RequestStatus.EXPIRED).length;

        return {
            branchId: branch.id,
            branchName: branch.name,
            total,
            respondedCount: respondedReqs.length,
            avgResponseTime: avgTime,
            expiredCount: expired
        };
    });

    if (sortConfig && ['branchName', 'total', 'respondedCount', 'avgResponseTime', 'expiredCount'].includes(sortConfig.key)) {
        data.sort((a: any, b: any) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return data;
  }, [requests, branches, sortConfig]);

  const requestSort = (key: string) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };


  // --- CRUD Handlers ---

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if(newUser.username && newUser.name && newUser.role && newUser.password) {
        if (newUser.role === UserRole.BRANCH_MANAGER && !newUser.branchId) {
            alert("يجب اختيار الفرع لمدير الفرع");
            return;
        }
        addUser({ 
            id: `u-${Date.now()}`, 
            username: newUser.username, 
            password: newUser.password,
            name: newUser.name, 
            role: newUser.role, 
            branchId: newUser.branchId || undefined 
        } as User);
        setNewUser({ role: UserRole.BRANCH_MANAGER, username: '', password: '', name: '', branchId: '' });
        alert("تم إضافة المستخدم بنجاح");
    } else {
        alert("يرجى ملء جميع الحقول المطلوبة بما في ذلك كلمة المرور");
    }
  };
  
  const startEditBranch = (branch: Branch) => {
    setNewBranch(branch);
    setEditingBranchId(branch.id);
  };

  const cancelEditBranch = () => {
    setNewBranch({ name: '', address: '', location: { lat: 30.04, lng: 31.23 } });
    setEditingBranchId(null);
  };

  const handleAddBranch = (e: React.FormEvent) => {
      e.preventDefault();
      if(newBranch.name && newBranch.address) {
          if (editingBranchId) {
             editBranch({
                 ...newBranch,
                 id: editingBranchId,
                 location: newBranch.location || { lat: 30.0, lng: 31.0 }
             } as Branch);
             alert("تم تعديل الفرع بنجاح");
          } else {
             addBranch({
                 id: `b-${Date.now()}`,
                 name: newBranch.name,
                 address: newBranch.address,
                 location: newBranch.location || { lat: 30.0, lng: 31.0 }
             } as Branch);
             alert("تم إضافة الفرع بنجاح");
          }
          cancelEditBranch();
      }
  };

  const startEditProduct = (prod: Product) => {
    setNewProduct(prod);
    setEditingProductCode(prod.code);
  };

  const cancelEditProduct = () => {
    setNewProduct({ name: '', code: '', barcode: '', isFridge: false });
    setEditingProductCode(null);
  };

  const handleAddProduct = (e: React.FormEvent) => {
      e.preventDefault();
      if(newProduct.name && newProduct.code) {
          if (editingProductCode) {
              editProduct({
                 code: editingProductCode, // Original Code ID
                 name: newProduct.name,
                 barcode: newProduct.barcode || newProduct.code,
                 isFridge: newProduct.isFridge || false
             } as Product);
             alert("تم تعديل الصنف بنجاح");
          } else {
              addProduct({
                  code: newProduct.code,
                  name: newProduct.name,
                  barcode: newProduct.barcode || newProduct.code,
                  isFridge: newProduct.isFridge || false
              } as Product);
              alert("تم إضافة الصنف بنجاح");
          }
          cancelEditProduct();
      }
  };

  const handleUpdateStock = (e: React.FormEvent) => {
      e.preventDefault();
      if(stockForm.branchId && stockForm.productCode) {
          updateStock(stockForm.branchId, stockForm.productCode, Number(stockForm.quantity));
          alert("تم تحديث الرصيد بنجاح");
      }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 flex flex-wrap gap-2">
        <TabButton id="overview" label="نظرة عامة" icon={<LayoutDashboard size={18} />} active={activeTab} set={setActiveTab} />
        <TabButton id="reports" label="تقارير الأداء" icon={<FileText size={18} />} active={activeTab} set={setActiveTab} />
        <TabButton id="branches" label="الفروع" icon={<Building size={18} />} active={activeTab} set={setActiveTab} />
        <TabButton id="users" label="المستخدمين" icon={<Users size={18} />} active={activeTab} set={setActiveTab} />
        <TabButton id="products" label="الأصناف" icon={<PackagePlus size={18} />} active={activeTab} set={setActiveTab} />
        <TabButton id="stock" label="المخزون" icon={<Database size={18} />} active={activeTab} set={setActiveTab} />
        <TabButton id="settings" label="الإعدادات" icon={<Server size={18} />} active={activeTab} set={setActiveTab} />
      </div>

      {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in">
              <StatCard title="إجمالي الطلبات" value={total} color="bg-blue-600" icon={<Activity className="text-white opacity-80" />} />
              <StatCard title="تم التسليم" value={completed} color="bg-green-600" icon={<CheckCircle className="text-white opacity-80" />} />
              <StatCard title="معلق / قيد التنفيذ" value={pending} color="bg-yellow-500" icon={<AlertCircle className="text-white opacity-80" />} />
              <StatCard title="مشاكل / مرفوض" value={rejected + expired} color="bg-red-600" icon={<Shield className="text-white opacity-80" />} />
              
              <div className="col-span-full bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-96 flex flex-col items-center justify-center">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 self-start">تحليل حالة الطلبات</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value">
                        {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>
      )}

      {/* --- REPORTS TAB --- */}
      {activeTab === 'reports' && (
          <div className="space-y-8 animate-fade-in">
            {/* 1. Driver Performance Report */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                            <Clock size={24} className="text-blue-600"/>
                            تقرير أداء التوصيل
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">مقارنة الوقت المقدر بالوقت الفعلي للمهام المكتملة</p>
                    </div>
                    <div className="text-sm font-bold bg-white px-3 py-1 rounded border border-gray-200">
                        عدد العمليات: {driverPerformanceData.length}
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-gray-800 text-white">
                            <tr>
                                <th className="p-4 text-sm font-bold cursor-pointer hover:bg-gray-700" onClick={() => requestSort('driverName')}>
                                    <div className="flex items-center gap-1">المندوب <ArrowUpDown size={14}/></div>
                                </th>
                                <th className="p-4 text-sm font-bold">المسار (من -> إلى)</th>
                                <th className="p-4 text-sm font-bold cursor-pointer hover:bg-gray-700" onClick={() => requestSort('distance')}>
                                    <div className="flex items-center gap-1">المسافة <ArrowUpDown size={14}/></div>
                                </th>
                                <th className="p-4 text-sm font-bold cursor-pointer hover:bg-gray-700" onClick={() => requestSort('estTime')}>
                                    <div className="flex items-center gap-1">الوقت المقدر <ArrowUpDown size={14}/></div>
                                </th>
                                <th className="p-4 text-sm font-bold cursor-pointer hover:bg-gray-700" onClick={() => requestSort('actualTime')}>
                                    <div className="flex items-center gap-1">الوقت الفعلي <ArrowUpDown size={14}/></div>
                                </th>
                                <th className="p-4 text-sm font-bold cursor-pointer hover:bg-gray-700" onClick={() => requestSort('variance')}>
                                    <div className="flex items-center gap-1">الفارق (دقيقة) <ArrowUpDown size={14}/></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {driverPerformanceData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">لا توجد عمليات توصيل مكتملة حتى الآن.</td>
                                </tr>
                            ) : (
                                driverPerformanceData.map((row) => (
                                    <tr key={row.id} className="hover:bg-blue-50 transition">
                                        <td className="p-4 font-bold text-gray-900">{row.driverName}</td>
                                        <td className="p-4 text-gray-600 text-sm">{row.route}</td>
                                        <td className="p-4 font-mono text-gray-700">{row.distance} km</td>
                                        <td className="p-4 font-mono text-gray-600">{row.estTime} دقيقة</td>
                                        <td className="p-4 font-mono font-bold text-gray-900">{row.actualTime} دقيقة</td>
                                        <td className="p-4 font-mono font-bold">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                row.variance > 10 ? 'bg-red-100 text-red-700' : 
                                                row.variance < -5 ? 'bg-green-100 text-green-700' : 
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                                {row.variance > 0 ? `+${row.variance}` : row.variance}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 2. Branch Response Performance Report */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                            <Zap size={24} className="text-orange-600"/>
                            سرعة استجابة الفروع
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">تحليل متوسط الوقت المستغرق للرد على الطلبات الواردة (قبول/رفض)</p>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-gray-800 text-white">
                            <tr>
                                <th className="p-4 text-sm font-bold cursor-pointer hover:bg-gray-700" onClick={() => requestSort('branchName')}>
                                    <div className="flex items-center gap-1">الفرع <ArrowUpDown size={14}/></div>
                                </th>
                                <th className="p-4 text-sm font-bold cursor-pointer hover:bg-gray-700" onClick={() => requestSort('total')}>
                                    <div className="flex items-center gap-1">إجمالي الوارد <ArrowUpDown size={14}/></div>
                                </th>
                                <th className="p-4 text-sm font-bold cursor-pointer hover:bg-gray-700" onClick={() => requestSort('respondedCount')}>
                                    <div className="flex items-center gap-1">تم الرد <ArrowUpDown size={14}/></div>
                                </th>
                                <th className="p-4 text-sm font-bold cursor-pointer hover:bg-gray-700" onClick={() => requestSort('avgResponseTime')}>
                                    <div className="flex items-center gap-1">متوسط زمن الرد (دقيقة) <ArrowUpDown size={14}/></div>
                                </th>
                                <th className="p-4 text-sm font-bold cursor-pointer hover:bg-gray-700" onClick={() => requestSort('expiredCount')}>
                                    <div className="flex items-center gap-1">تجاهل/انتهاء <ArrowUpDown size={14}/></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {branchResponseData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500">لا توجد بيانات كافية.</td>
                                </tr>
                            ) : (
                                branchResponseData.map((row) => (
                                    <tr key={row.branchId} className="hover:bg-orange-50 transition">
                                        <td className="p-4 font-bold text-gray-900">{row.branchName}</td>
                                        <td className="p-4 font-mono font-bold text-gray-700">{row.total}</td>
                                        <td className="p-4 font-mono text-green-700">{row.respondedCount}</td>
                                        <td className="p-4 font-mono font-bold text-gray-900">
                                            {row.avgResponseTime > 0 ? `${row.avgResponseTime} دقيقة` : '-'}
                                        </td>
                                        <td className="p-4 font-mono">
                                            {row.expiredCount > 0 ? (
                                                <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">{row.expiredCount}</span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
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

      {/* --- BRANCHES MANAGEMENT --- */}
      {activeTab === 'branches' && (
          <div className="grid lg:grid-cols-3 gap-8 animate-fade-in">
              {/* Form */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
                  <h3 className="font-bold text-xl mb-6 flex items-center gap-2 text-gray-900 border-b pb-3">
                      {editingBranchId ? <Edit2 className="text-orange-600" size={24} /> : <PlusCircle className="text-orange-600" size={24} />}
                      {editingBranchId ? 'تعديل بيانات الفرع' : 'إضافة فرع جديد'}
                  </h3>
                  <form onSubmit={handleAddBranch} className="space-y-5">
                      <div>
                          <label className="text-sm font-bold text-gray-800 block mb-2">اسم الفرع</label>
                          <input required type="text" className="input-field" value={newBranch.name} onChange={e => setNewBranch({...newBranch, name: e.target.value})} placeholder="مثال: فرع رشدي" />
                      </div>
                      <div>
                          <label className="text-sm font-bold text-gray-800 block mb-2">العنوان</label>
                          <input required type="text" className="input-field" value={newBranch.address} onChange={e => setNewBranch({...newBranch, address: e.target.value})} placeholder="العنوان بالتفصيل" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="text-sm font-bold text-gray-800 block mb-2">Latitude</label>
                              <input 
                                type="number" 
                                step="any" 
                                className="input-field" 
                                value={newBranch.location?.lat} 
                                onChange={e => setNewBranch({
                                    ...newBranch, 
                                    location: { 
                                        lat: parseFloat(e.target.value) || 0, 
                                        lng: newBranch.location?.lng || 0 
                                    }
                                })} 
                              />
                          </div>
                          <div>
                              <label className="text-sm font-bold text-gray-800 block mb-2">Longitude</label>
                              <input 
                                type="number" 
                                step="any" 
                                className="input-field" 
                                value={newBranch.location?.lng} 
                                onChange={e => setNewBranch({
                                    ...newBranch, 
                                    location: { 
                                        lat: newBranch.location?.lat || 0, 
                                        lng: parseFloat(e.target.value) || 0 
                                    }
                                })} 
                              />
                          </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-700 transition shadow-md hover:shadow-lg">
                            {editingBranchId ? 'حفظ التعديلات' : 'إضافة الفرع'}
                        </button>
                        {editingBranchId && (
                            <button type="button" onClick={cancelEditBranch} className="bg-gray-100 text-gray-600 px-4 rounded-lg hover:bg-gray-200">
                                <X size={20} />
                            </button>
                        )}
                      </div>
                  </form>
              </div>

              {/* List */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                   <div className="p-5 bg-gray-50 border-b border-gray-200 font-bold flex justify-between items-center">
                       <span className="text-lg text-gray-800">قائمة الفروع ({branches.length})</span>
                   </div>
                   <div className="overflow-x-auto">
                       <table className="w-full text-right">
                           <thead className="bg-gray-800 text-white">
                               <tr>
                                   <th className="p-4 text-sm font-bold">اسم الفرع</th>
                                   <th className="p-4 text-sm font-bold">العنوان</th>
                                   <th className="p-4 text-sm font-bold">الموقع (GPS)</th>
                                   <th className="p-4 text-sm font-bold">إجراءات</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                               {branches.map(b => (
                                   <tr key={b.id} className="hover:bg-orange-50 transition">
                                       <td className="p-4 font-bold text-gray-900">{b.name}</td>
                                       <td className="p-4 text-gray-600">{b.address}</td>
                                       <td className="p-4 font-mono text-xs text-gray-500">
                                          {b.location?.lat ? b.location.lat.toFixed(4) : 'N/A'}, 
                                          {b.location?.lng ? b.location.lng.toFixed(4) : 'N/A'}
                                       </td>
                                       <td className="p-4 flex gap-2">
                                           <button onClick={() => startEditBranch(b)} className="bg-blue-50 text-blue-600 p-2 rounded hover:bg-blue-100 transition" title="تعديل">
                                               <Edit2 size={16} />
                                           </button>
                                           <button onClick={() => { if(window.confirm('حذف الفرع؟')) deleteBranch(b.id) }} className="bg-red-50 text-red-600 p-2 rounded hover:bg-red-100 transition" title="حذف">
                                               <Trash2 size={16} />
                                           </button>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
              </div>
          </div>
      )}

      {/* --- USERS MANAGEMENT --- */}
      {activeTab === 'users' && (
          <div className="grid lg:grid-cols-3 gap-8 animate-fade-in">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
                  <h3 className="font-bold text-xl mb-6 flex items-center gap-2 text-gray-900 border-b pb-3">
                      <PlusCircle className="text-blue-600" size={24} /> 
                      إضافة مستخدم
                  </h3>
                  <form onSubmit={handleAddUser} className="space-y-5">
                      <div>
                          <label className="text-sm font-bold text-gray-800 block mb-2">اسم المستخدم (للدخول)</label>
                          <input required type="text" className="input-field" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-sm font-bold text-gray-800 block mb-2">كلمة المرور</label>
                          <input required type="text" className="input-field" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="تعيين كلمة مرور" />
                      </div>
                      <div>
                          <label className="text-sm font-bold text-gray-800 block mb-2">الاسم الكامل</label>
                          <input required type="text" className="input-field" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-sm font-bold text-gray-800 block mb-2">الدور (Role)</label>
                          <select className="input-field" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                              {Object.values(UserRole).map(role => (
                                  <option key={role} value={role}>{role}</option>
                              ))}
                          </select>
                      </div>
                      {newUser.role === UserRole.BRANCH_MANAGER && (
                          <div>
                              <label className="text-sm font-bold text-gray-800 block mb-2">الفرع التابع له</label>
                              <select className="input-field" value={newUser.branchId} onChange={e => setNewUser({...newUser, branchId: e.target.value})}>
                                  <option value="">-- اختر الفرع --</option>
                                  {branches.map(b => (
                                      <option key={b.id} value={b.id}>{b.name}</option>
                                  ))}
                              </select>
                          </div>
                      )}
                      <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-md hover:shadow-lg">حفظ المستخدم</button>
                  </form>
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-5 bg-gray-50 border-b border-gray-200 font-bold text-lg text-gray-800">قائمة المستخدمين ({users.length})</div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-right">
                          <thead className="bg-gray-800 text-white">
                              <tr>
                                  <th className="p-4 text-sm font-bold">الاسم</th>
                                  <th className="p-4 text-sm font-bold">اسم الدخول</th>
                                  <th className="p-4 text-sm font-bold">كلمة المرور</th>
                                  <th className="p-4 text-sm font-bold">الدور</th>
                                  <th className="p-4 text-sm font-bold">الفرع</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {users.map(u => (
                                  <tr key={u.id} className="hover:bg-blue-50 transition">
                                      <td className="p-4 font-bold text-gray-900">{u.name}</td>
                                      <td className="p-4 font-mono text-gray-600">{u.username}</td>
                                      <td className="p-4 font-mono text-gray-400">••••</td>
                                      <td className="p-4"><span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded border border-gray-300 font-bold">{u.role}</span></td>
                                      <td className="p-4 text-gray-700">{branches.find(b => b.id === u.branchId)?.name || '-'}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* --- PRODUCTS MANAGEMENT --- */}
      {activeTab === 'products' && (
          <div className="grid lg:grid-cols-3 gap-8 animate-fade-in">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
                  <h3 className="font-bold text-xl mb-6 flex items-center gap-2 text-gray-900 border-b pb-3">
                      {editingProductCode ? <Edit2 className="text-purple-600" size={24} /> : <PlusCircle className="text-purple-600" size={24} />} 
                      {editingProductCode ? 'تعديل الصنف' : 'إضافة صنف جديد'}
                  </h3>
                  <form onSubmit={handleAddProduct} className="space-y-5">
                      <div>
                          <label className="text-sm font-bold text-gray-800 block mb-2">كود الصنف</label>
                          <input required type="text" disabled={!!editingProductCode} className={`input-field ${editingProductCode ? 'bg-gray-100 text-gray-500' : ''}`} value={newProduct.code} onChange={e => setNewProduct({...newProduct, code: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-sm font-bold text-gray-800 block mb-2">اسم الصنف</label>
                          <input required type="text" className="input-field" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-sm font-bold text-gray-800 block mb-2">الباركود</label>
                          <input type="text" className="input-field" value={newProduct.barcode} onChange={e => setNewProduct({...newProduct, barcode: e.target.value})} />
                      </div>
                      <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg border border-blue-200">
                          <input type="checkbox" id="isFridge" checked={newProduct.isFridge} onChange={e => setNewProduct({...newProduct, isFridge: e.target.checked})} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                          <label htmlFor="isFridge" className="text-sm font-bold text-blue-900 flex items-center gap-2"><Snowflake size={16}/> هل الصنف يحتاج ثلاجة؟</label>
                      </div>
                      <div className="flex gap-2">
                          <button type="submit" className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition shadow-md hover:shadow-lg">
                              {editingProductCode ? 'حفظ التعديلات' : 'حفظ الصنف'}
                          </button>
                          {editingProductCode && (
                            <button type="button" onClick={cancelEditProduct} className="bg-gray-100 text-gray-600 px-4 rounded-lg hover:bg-gray-200">
                                <X size={20} />
                            </button>
                           )}
                      </div>
                  </form>
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-5 bg-gray-50 border-b border-gray-200 font-bold flex justify-between items-center">
                      <span className="text-lg text-gray-800">قائمة الأصناف ({products.length})</span>
                      <div className="relative w-64">
                          <Search size={16} className="absolute right-3 top-3 text-gray-400"/>
                          <input type="text" placeholder="بحث باسم أو كود..." className="pr-9 pl-3 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm" value={filterText} onChange={e => setFilterText(e.target.value)} />
                      </div>
                  </div>
                  <div className="overflow-x-auto max-h-[600px]">
                      <table className="w-full text-right">
                          <thead className="bg-gray-800 text-white sticky top-0 z-10">
                              <tr>
                                  <th className="p-4 text-sm font-bold">الكود</th>
                                  <th className="p-4 text-sm font-bold">الاسم</th>
                                  <th className="p-4 text-sm font-bold">الباركود</th>
                                  <th className="p-4 text-sm font-bold">خصائص</th>
                                  <th className="p-4 text-sm font-bold">إجراءات</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {products.filter(p => (p.name || '').includes(filterText) || (p.code || '').includes(filterText)).map(p => (
                                  <tr key={p.code} className="hover:bg-purple-50 transition">
                                      <td className="p-4 font-mono text-gray-700 font-bold">{p.code}</td>
                                      <td className="p-4 font-bold text-gray-900">{p.name}</td>
                                      <td className="p-4 font-mono text-gray-500">{p.barcode}</td>
                                      <td className="p-4">
                                          {p.isFridge && <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1 w-fit border border-blue-200"><Snowflake size={12}/> ثلاجة</span>}
                                      </td>
                                      <td className="p-4 flex gap-2">
                                          <button onClick={() => startEditProduct(p)} className="bg-blue-50 text-blue-600 p-2 rounded hover:bg-blue-100 transition" title="تعديل">
                                              <Edit2 size={16} />
                                          </button>
                                          <button onClick={() => { if(window.confirm('حذف الصنف؟')) deleteProduct(p.code) }} className="bg-red-50 text-red-600 p-2 rounded hover:bg-red-100 transition" title="حذف">
                                              <Trash2 size={16} />
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* --- STOCK MANAGEMENT --- */}
      {activeTab === 'stock' && (
          <div className="grid lg:grid-cols-3 gap-8 animate-fade-in">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
                  <h3 className="font-bold text-xl mb-6 flex items-center gap-2 text-gray-900 border-b pb-3">
                      <Edit2 className="text-green-600" size={24} /> 
                      تعديل الرصيد يدوياً
                  </h3>
                  <form onSubmit={handleUpdateStock} className="space-y-5">
                      <div>
                          <label className="text-sm font-bold text-gray-800 block mb-2">الفرع</label>
                          <select required className="input-field" value={stockForm.branchId} onChange={e => setStockForm({...stockForm, branchId: e.target.value})}>
                              <option value="">-- اختر الفرع --</option>
                              {branches.map(b => (
                                  <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="text-sm font-bold text-gray-800 block mb-2">الصنف</label>
                          <select required className="input-field" value={stockForm.productCode} onChange={e => setStockForm({...stockForm, productCode: e.target.value})}>
                              <option value="">-- اختر الصنف --</option>
                              {products.map(p => (
                                  <option key={p.code} value={p.code}>{p.name}</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="text-sm font-bold text-gray-800 block mb-2">الكمية الجديدة</label>
                          <input required type="number" min="0" className="input-field" value={stockForm.quantity} onChange={e => setStockForm({...stockForm, quantity: parseInt(e.target.value)})} />
                      </div>
                      <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-md hover:shadow-lg">تحديث المخزون</button>
                  </form>
              </div>

              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-5 bg-gray-50 border-b border-gray-200 font-bold flex justify-between items-center">
                      <span className="text-lg text-gray-800">أرصدة الفروع ({stocks.length})</span>
                  </div>
                  <div className="overflow-x-auto max-h-[600px]">
                      <table className="w-full text-right">
                          <thead className="bg-gray-800 text-white sticky top-0 z-10">
                              <tr>
                                  <th className="p-4 text-sm font-bold">الفرع</th>
                                  <th className="p-4 text-sm font-bold">الصنف</th>
                                  <th className="p-4 text-sm font-bold">الكمية</th>
                                  <th className="p-4 text-sm font-bold">إجراءات</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {stocks.length === 0 ? (
                                  <tr><td colSpan={4} className="p-8 text-center text-gray-500 font-bold">لا يوجد أرصدة مسجلة</td></tr>
                              ) : (
                                  stocks.map((s, idx) => {
                                      const branchName = branches.find(b => b.id === s.branchId)?.name || s.branchId;
                                      const prodName = products.find(p => p.code === s.productCode)?.name || s.productCode;
                                      return (
                                          <tr key={`${s.branchId}-${s.productCode}-${idx}`} className="hover:bg-green-50 transition">
                                              <td className="p-4 text-gray-800">{branchName}</td>
                                              <td className="p-4 font-bold text-gray-900">{prodName}</td>
                                              <td className="p-4 font-mono font-bold text-green-700 text-lg">{s.quantity}</td>
                                              <td className="p-4">
                                                  <button onClick={() => { if(window.confirm('حذف هذا الرصيد؟')) deleteStock(s.branchId, s.productCode) }} className="bg-red-50 text-red-600 p-2 rounded hover:bg-red-100 transition">
                                                      <Trash2 size={16} />
                                                  </button>
                                              </td>
                                          </tr>
                                      )
                                  })
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* --- SETTINGS TAB --- */}
      {activeTab === 'settings' && (
          <div className="bg-white p-8 rounded-xl shadow-sm animate-fade-in border-t-8 border-indigo-600">
              <h3 className="font-bold text-2xl mb-8 flex items-center gap-3 text-gray-900">
                  <Server className="text-indigo-600" size={32} />
                  ربط قاعدة البيانات السحابية (Firebase Cloud)
              </h3>
              
              <div className="grid lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                      <div className={`p-5 rounded-xl border-2 flex items-center justify-between ${systemConfig.mode === 'CLOUD' ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-gray-300'}`}>
                          <div>
                              <p className="font-black text-gray-800 text-lg mb-1">حالة النظام الحالية:</p>
                              <p className={`text-sm font-bold flex items-center gap-2 ${systemConfig.mode === 'CLOUD' ? 'text-green-700' : 'text-gray-600'}`}>
                                  {systemConfig.mode === 'CLOUD' ? <><CheckCircle size={16}/> متصل بالسحابة (Online)</> : <><Database size={16}/> وضع محلي (Offline Local)</>}
                              </p>
                          </div>
                          {systemConfig.mode === 'CLOUD' && (
                              <button onClick={handleSwitchLocal} className="text-xs bg-white border border-gray-300 hover:bg-gray-100 px-4 py-2 rounded-lg text-black font-bold shadow-sm">
                                  فصل العودة للمحلي
                              </button>
                          )}
                      </div>

                      <p className="text-sm text-gray-600 leading-relaxed">
                          لتفعيل التزامن اللحظي بين الفروع، يرجى إنشاء مشروع جديد على <a href="https://console.firebase.google.com" target="_blank" className="text-indigo-600 font-bold underline hover:text-indigo-800">Firebase Console</a> ونسخ إعدادات الويب (Web App Config) هنا.
                      </p>

                      <div className="space-y-3">
                          <input type="text" placeholder="apiKey" className="input-field font-mono text-xs" value={fbConfig.apiKey} onChange={e => setFbConfig({...fbConfig, apiKey: e.target.value})} />
                          <input type="text" placeholder="authDomain" className="input-field font-mono text-xs" value={fbConfig.authDomain} onChange={e => setFbConfig({...fbConfig, authDomain: e.target.value})} />
                          <input type="text" placeholder="projectId" className="input-field font-mono text-xs" value={fbConfig.projectId} onChange={e => setFbConfig({...fbConfig, projectId: e.target.value})} />
                          <input type="text" placeholder="storageBucket" className="input-field font-mono text-xs" value={fbConfig.storageBucket} onChange={e => setFbConfig({...fbConfig, storageBucket: e.target.value})} />
                          <input type="text" placeholder="messagingSenderId" className="input-field font-mono text-xs" value={fbConfig.messagingSenderId} onChange={e => setFbConfig({...fbConfig, messagingSenderId: e.target.value})} />
                          <input type="text" placeholder="appId" className="input-field font-mono text-xs" value={fbConfig.appId} onChange={e => setFbConfig({...fbConfig, appId: e.target.value})} />
                      </div>

                      <button onClick={handleSaveFirebase} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg hover:shadow-indigo-200 transition text-lg">
                          حفظ وتفعيل الاتصال
                      </button>
                  </div>

                  <div className="bg-gradient-to-br from-indigo-50 to-white p-8 rounded-xl border border-indigo-100 text-indigo-900 leading-relaxed shadow-sm">
                      <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><Shield size={20}/> لماذا Firebase؟</h4>
                      <ul className="list-disc list-inside space-y-3 text-sm font-medium">
                          <li>قاعدة بيانات <strong>NoSQL Realtime</strong> الأسرع عالمياً.</li>
                          <li>مجاني تماماً للاستخدام المبدئي (Spark Plan).</li>
                          <li>يدعم العمل بدون إنترنت تلقائياً (Offline Persistence).</li>
                          <li>أمان عالي وسرعة استجابة للخريطة الحية وتتبع المناديب.</li>
                      </ul>
                  </div>
              </div>
          </div>
      )}
      
      <style>{`
        .input-field { 
            width: 100%; 
            padding: 0.75rem; 
            border: 1px solid #d1d5db; 
            border-radius: 0.5rem; 
            font-size: 0.95rem; 
            outline: none; 
            color: #111827; 
            background-color: #ffffff;
            transition: all 0.2s;
        }
        .input-field:focus { 
            border-color: #f97316; 
            box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1); 
        }
        ::placeholder {
            color: #9ca3af;
        }
      `}</style>
    </div>
  );
};

const TabButton: React.FC<{ id: string, label: string, icon: React.ReactNode, active: string, set: (id: any) => void }> = ({ id, label, icon, active, set }) => (
    <button 
        onClick={() => set(id)} 
        className={`flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-300 font-bold text-sm ${
            active === id 
            ? 'bg-gray-900 text-white shadow-md transform scale-105' 
            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-black'
        }`}
    >
        {icon} <span>{label}</span>
    </button>
);

const StatCard: React.FC<{ title: string; value: number; color: string; icon: React.ReactNode }> = ({ title, value, color, icon }) => (
  <div className={`${color} p-5 rounded-xl shadow-md text-white flex flex-col justify-between relative overflow-hidden group`}>
    <div className="absolute right-[-20px] top-[-20px] opacity-10 transform rotate-12 group-hover:scale-110 transition duration-500">
        {React.cloneElement(icon as React.ReactElement<any>, { size: 100 })}
    </div>
    <div className="flex justify-between items-start z-10">
        <p className="text-sm font-medium opacity-90">{title}</p>
        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
            {icon}
        </div>
    </div>
    <p className="text-4xl font-black mt-2 z-10">{value}</p>
  </div>
);

export default AdminDashboard;
