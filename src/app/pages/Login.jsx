import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/app/context/AppContext'
import { motion } from 'motion/react'

export const Login = () => {
  const { login } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const authenticatedUser = await login(email, password);
    if (!authenticatedUser) return;

    // Redirect based on role from backend
    if (authenticatedUser.role === 'manager') navigate('/manager');
    else if (authenticatedUser.role === 'chef') navigate('/chef');
    else if (authenticatedUser.role === 'cashier') navigate('/cashier');
    else navigate('/staff');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#9F1E22] relative overflow-hidden font-sans">
      {/* Decorative Elements */}
      <div className="absolute top-10 right-10 opacity-80">
        <img src="https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=200&h=200&fit=crop&q=80" className="w-24 h-24 object-contain rounded-full opacity-50 mix-blend-overlay hidden" alt="leaf" /> 
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 text-center z-10"
      >
        <h1 className="text-5xl font-extrabold text-[#FFD700] mb-2 tracking-wide uppercase">DELULU</h1>
        <p className="text-white/80 italic mb-12">Anytime , Anything !!!!</p>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-6 py-4 rounded-full bg-[#F2E8DC] text-[#4A4A4A] placeholder-[#8A8A8A] focus:outline-none focus:ring-4 focus:ring-[#FFD700]/50 border-none text-lg"
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-6 py-4 rounded-full bg-[#F2E8DC] text-[#4A4A4A] placeholder-[#8A8A8A] focus:outline-none focus:ring-4 focus:ring-[#FFD700]/50 border-none text-lg"
            />
          </div>

          <button 
            type="submit"
            className="w-full py-4 rounded-full bg-[#FFD700] hover:bg-[#FCD34D] text-black font-extrabold text-xl shadow-lg shadow-[#FFD700]/20 transition-transform active:scale-95"
          >
            Login
          </button>
        </form>
      </motion.div>

      {/* Bottom Food Images - Decorative */}
      <div className="absolute bottom-0 left-0 w-64 h-64 translate-y-1/3 -translate-x-1/4 pointer-events-none">
         <img src="https://images.unsplash.com/photo-1633337474564-1d9478ca4ef3?w=500" alt="Biryani" className="w-full h-full object-cover rounded-full shadow-2xl" />
      </div>
      <div className="absolute bottom-10 right-0 w-48 h-48 translate-x-1/4 pointer-events-none">
         <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500" alt="Salad" className="w-full h-full object-cover rounded-full shadow-2xl" />
      </div>
    </div>
  );
};
