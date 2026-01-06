import React, { useState } from 'react';
import { ADMIN_EMAILS, UserRole } from '../types';
import { Lock, Tablet, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLogin: (role: UserRole, email: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [showGooglePrompt, setShowGooglePrompt] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    
    if (ADMIN_EMAILS.includes(cleanEmail)) {
      onLogin(UserRole.ADMIN, cleanEmail);
    } else {
      setError('此 Email 無管理權限，請確認是否為授權帳號。');
    }
  };

  const handleMockGoogleLogin = () => {
      // Since we cannot implement real OAuth without backend/api key in this code demo,
      // we act as if the Google Auth button was clicked, which would prompt the user.
      // Here we just toggle the input field to simulate "System asks for identity".
      setShowGooglePrompt(true);
      setError('');
  }

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[500px] p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-primary-100 p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary-100 p-4 rounded-full mb-4">
            <Lock className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-xl font-bold text-primary-900 text-center">後台管理登入</h1>
          <p className="text-primary-500 text-center">資料維護功能僅限管理員使用</p>
        </div>
        
        {!showGooglePrompt ? (
             <div className="space-y-4">
                 <button 
                    onClick={handleMockGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-lg transition-colors shadow-sm text-base"
                 >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                    使用 Google 帳號登入
                 </button>
                 <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">或</span>
                    <div className="flex-grow border-t border-gray-200"></div>
                 </div>
                 <button 
                    onClick={() => setShowGooglePrompt(true)}
                    className="w-full bg-primary-50 text-primary-600 font-medium py-2 rounded-lg hover:bg-primary-100 transition-colors"
                 >
                    手動輸入 Email
                 </button>
             </div>
        ) : (
            <form onSubmit={handleLogin} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
                <label className="block text-base font-medium text-primary-700 mb-2">
                管理員 Email
                </label>
                <div className="relative">
                <div className="absolute left-3 top-3.5 text-primary-400">
                    <Tablet className="w-5 h-5" />
                </div>
                <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-base"
                    placeholder="輸入您的帳號"
                />
                </div>
                <p className="text-xs text-primary-400 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    系統將比對此帳號是否在白名單內
                </p>
            </div>

            {error && (
                <div className="text-red-600 text-base bg-red-50 p-3 rounded-lg border border-red-100 flex items-center">
                <span className="mr-2">⚠️</span> {error}
                </div>
            )}

            <button
                type="submit"
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-lg transition-colors shadow-lg shadow-primary-500/30 text-lg"
            >
                驗證身份
            </button>
            <button 
                type="button"
                onClick={() => {setShowGooglePrompt(false); setEmail(''); setError('');}}
                className="w-full text-center text-primary-500 hover:text-primary-700 text-sm mt-2"
            >
                返回選擇登入方式
            </button>
            </form>
        )}
      </div>
    </div>
  );
};

export default Login;