import React from 'react';
import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useApp } from '@/app/context/AppContext'

export const DashboardLayout = () => {
  const { user } = useApp();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#9F1E22] overflow-x-hidden font-sans relative">
      <Sidebar />
      
      {/* Main Content Area - Adjusted margin for floating sidebar */}
      <main className="ml-32 md:ml-[19rem] p-6 md:p-10 min-h-screen transition-all relative">
        
        {/* Header User Profile */}
        <div className="absolute top-6 right-10 flex items-center gap-4 text-white z-40">
          <div className="text-right">
            <h2 className="font-bold text-lg leading-none uppercase">Hello, {user.name}!</h2>
            <p className="text-sm opacity-80 capitalize">{user.role === 'manager' ? 'Admin' : user.role}</p>
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-[#FFD700] bg-[#FFD700] overflow-hidden">
             <img 
               src={user.avatar} 
               alt="User" 
               className="w-full h-full object-cover" 
             />
          </div>
        </div>

        {/* Global Page Title or Breadcrumb could go here */}
        <div className="mt-8 md:mt-4 text-[#FFD700] font-black text-2xl uppercase tracking-widest mb-6">
           DELULU
           <div className="text-white/50 text-sm font-medium tracking-normal capitalize">{user.role}</div>
        </div>

        <div className="max-w-[1600px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
