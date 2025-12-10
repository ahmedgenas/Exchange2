
import React from 'react';
import { useStore } from '../context/StoreContext';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

const NotificationSystem: React.FC = () => {
  const { notifications, removeNotification } = useStore();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-3 w-80 pointer-events-none">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={`pointer-events-auto transform transition-all duration-300 ease-in-out animate-fade-in-left shadow-lg rounded-lg border-r-4 p-4 flex items-start gap-3 bg-white
            ${notif.type === 'success' ? 'border-green-500 bg-green-50' : ''}
            ${notif.type === 'error' ? 'border-red-500 bg-red-50' : ''}
            ${notif.type === 'warning' ? 'border-yellow-500 bg-yellow-50' : ''}
            ${notif.type === 'info' ? 'border-blue-500 bg-blue-50' : ''}
          `}
        >
          <div className="flex-shrink-0 mt-0.5">
            {notif.type === 'success' && <CheckCircle size={20} className="text-green-600" />}
            {notif.type === 'error' && <AlertCircle size={20} className="text-red-600" />}
            {notif.type === 'warning' && <AlertTriangle size={20} className="text-yellow-600" />}
            {notif.type === 'info' && <Info size={20} className="text-blue-600" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800 leading-snug">{notif.message}</p>
            <p className="text-xs text-gray-500 mt-1">{new Date(notif.timestamp).toLocaleTimeString('ar-EG')}</p>
          </div>
          <button 
            onClick={() => removeNotification(notif.id)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes fade-in-left {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in-left {
            animation: fade-in-left 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default NotificationSystem;
