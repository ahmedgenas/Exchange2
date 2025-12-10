
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { User, UserRole } from '../types';
import { Key, User as UserIcon } from 'lucide-react';

const Login: React.FC = () => {
  const { users, login } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username) {
      login(username, password);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 to-red-500 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-orange-600 mb-2 tracking-wider">TAY GROUP</h1>
          <p className="text-gray-500">نظام إدارة التبادلات الذكي</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <UserIcon size={16} /> اسم المستخدم
            </label>
            <input
              type="text"
              required
              className="w-full p-3 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white text-left text-black font-mono"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Key size={16} /> كلمة المرور
            </label>
            <input
              type="password"
              required
              className="w-full p-3 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white text-left text-black"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 text-black py-3 rounded-lg font-bold hover:bg-orange-600 transition shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            تسجيل الدخول
          </button>
        </form>
        
        {/* Helper for demo: Show available usernames */}
        <div className="mt-8 pt-4 border-t border-gray-100">
            <p className="text-xs text-center text-gray-400 mb-2">للتجربة (المستخدمين المتاحين):</p>
            <div className="flex flex-wrap gap-2 justify-center">
                {users.slice(0, 5).map(u => (
                    <span key={u.id} className="text-[10px] bg-gray-50 px-2 py-1 rounded text-gray-500 border border-gray-200 cursor-pointer hover:bg-orange-50" onClick={() => {setUsername(u.username); setPassword('123')}}>
                        {u.username} (123)
                    </span>
                ))}
            </div>
        </div>

        <div className="mt-6 text-center text-xs text-orange-100">
          v1.2.0 - Powered by TAY GROUP AI
        </div>
      </div>
    </div>
  );
};

export default Login;
