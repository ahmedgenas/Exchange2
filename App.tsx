
import React, { useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { UserRole } from './types';
import Login from './components/Login';
import BranchView from './components/BranchView';
import DistributionView from './components/DistributionView';
import DeliveryView from './components/DeliveryView';
import AdminDashboard from './components/AdminDashboard';
import InventoryView from './components/InventoryView';
import ShortageView from './components/ShortageView';
import NotificationSystem from './components/NotificationSystem';
import { LogOut, Menu, UserCog, X, Save } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { currentUser, logout, updateUser } = useStore();
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', username: '' });

  if (!currentUser) {
    return <Login />;
  }

  const renderView = () => {
    switch (currentUser.role) {
      case UserRole.ADMIN:
        return <AdminDashboard />;
      case UserRole.BRANCH_MANAGER:
        return <BranchView />;
      case UserRole.DISTRIBUTION:
        return <DistributionView />;
      case UserRole.DELIVERY:
        return <DeliveryView />;
      case UserRole.INVENTORY_MANAGER:
        return <InventoryView />;
      case UserRole.SHORTAGE_MANAGER:
        return <ShortageView />;
      default:
        return <div className="p-10 text-center text-red-500">دور مستخدم غير معروف</div>;
    }
  };

  const openProfileModal = () => {
    if(currentUser) {
        setProfileForm({ name: currentUser.name, username: currentUser.username });
        setIsProfileModalOpen(true);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if(currentUser && profileForm.name && profileForm.username) {
        updateUser(currentUser.id, profileForm);
        setIsProfileModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col">
      {/* Notification System Overlay */}
      <NotificationSystem />

      {/* Header - White BG with Black Text as requested */}
      <header className="bg-white text-gray-900 shadow-sm sticky top-0 z-50 border-b border-orange-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-2xl font-black tracking-wider text-black">TAY GROUP</div>
            <div className="hidden md:block text-gray-600 text-sm border-r-2 border-orange-500 pr-4 mr-4 font-bold">
               نظام التبادلات
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="font-bold text-sm text-black">{currentUser.name}</p>
              <p className="text-xs text-orange-600 font-bold uppercase">{currentUser.role}</p>
            </div>
            
            <button 
              onClick={openProfileModal}
              className="p-2 bg-gray-100 text-black rounded-full hover:bg-orange-100 hover:text-orange-600 transition border border-gray-200"
              title="تعديل الملف الشخصي"
            >
              <UserCog size={18} />
            </button>

            <button 
              onClick={logout}
              className="p-2 bg-gray-100 text-black rounded-full hover:bg-red-50 hover:text-red-600 transition border border-gray-200"
              title="تسجيل الخروج"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-fade-in">
          {renderView()}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-gray-600 text-sm font-bold">
          &copy; {new Date().getFullYear()} TAY GROUP - جميع الحقوق محفوظة
        </div>
      </footer>

      {/* Profile Edit Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border-t-8 border-orange-500 transform transition-all scale-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <UserCog size={24} className="text-orange-600" />
                        تعديل بياناتي
                    </h3>
                    <button onClick={() => setIsProfileModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">الاسم الكامل</label>
                        <input 
                            required 
                            type="text" 
                            className="w-full p-2 border border-gray-300 rounded focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                            value={profileForm.name}
                            onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-1">اسم المستخدم (للدخول)</label>
                        <input 
                            required 
                            type="text" 
                            className="w-full p-2 border border-gray-300 rounded focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none font-mono"
                            value={profileForm.username}
                            onChange={e => setProfileForm({...profileForm, username: e.target.value})}
                        />
                    </div>
                    <div className="pt-2 flex gap-3">
                        <button 
                            type="submit"
                            className="flex-1 bg-orange-600 text-white py-2 rounded-lg font-bold hover:bg-orange-700 transition flex items-center justify-center gap-2"
                        >
                            <Save size={18} />
                            حفظ التعديلات
                        </button>
                        <button 
                            type="button"
                            onClick={() => setIsProfileModalOpen(false)}
                            className="flex-1 bg-gray-100 text-gray-800 py-2 rounded-lg font-bold hover:bg-gray-200 transition"
                        >
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <StoreProvider>
      <MainLayout />
    </StoreProvider>
  );
};

export default App;