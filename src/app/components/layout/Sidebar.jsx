import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Utensils, Users, ClipboardList, LogOut, LayoutDashboard, ChefHat } from 'lucide-react'
import { useApp } from '@/app/context/AppContext'

export const Sidebar = () => {
  const { user, logout, updateProfile } = useApp();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileDob, setProfileDob] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const fileInputRef = useRef(null);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    if (isProfileOpen && user) {
      setProfileName(user.name || '');
      setProfilePhone(user.phone || '');
      setProfileDob(user.date_of_birth ? user.date_of_birth.slice(0, 10) : '');
      setProfilePhoto(user.photo || user.avatar || '');
    }
  }, [isProfileOpen, user]);

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProfilePhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const getLinks = (role) => {
    const links = [];
    
    // Manager / Admin Links
    if (role === 'manager' || role === 'admin') {
      links.push(
        { icon: Home, label: 'Dashboard', path: '/manager' },
        { icon: LayoutDashboard, label: 'Tables', path: '/manager/tables' },
        { icon: Utensils, label: 'Menu', path: '/manager/menu' },
        { icon: Users, label: 'Staff', path: '/manager/staff' },
        { icon: ClipboardList, label: 'Report', path: '/manager/reports' },
      );
    } 
    // Staff Links
    else if (role === 'staff') {
      links.push(
        { icon: LayoutDashboard, label: 'Tables', path: '/staff' },
      );
    } 
    // Cashier Links
    else if (role === 'cashier') {
      links.push(
        { icon: LayoutDashboard, label: 'Tables', path: '/cashier' },
      );
    } 
    // Chef Links
    else if (role === 'chef') {
      links.push(
        { icon: ChefHat, label: 'Kitchen', path: '/chef' },
      );
    }

    return links;
  };

  return (
    <div className="fixed left-6 top-6 bottom-6 w-24 md:w-64 bg-[#F2E8DC] rounded-3xl z-50 flex flex-col shadow-2xl overflow-hidden">
      {/* Home / Logo Icon */}
      <div className="p-8 flex items-center gap-3">
        <Home className="text-[#9F1E22] w-8 h-8 md:w-10 md:h-10" strokeWidth={2.5} />
        {/* <h1 className="text-[#9F1E22] font-black tracking-widest text-lg hidden md:block">DELULU</h1> */}
      </div>

      <nav className="flex-1 px-4 space-y-4 mt-4">
        {getLinks(user.role).map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={true}
            className={({ isActive }) => `
              flex flex-col md:flex-row items-center md:gap-4 p-4 rounded-xl transition-all group relative overflow-hidden
              ${isActive ? 'bg-[#9F1E22] shadow-md' : 'hover:bg-[#9F1E22]/10'}
            `}
          >
            {({ isActive }) => (
              <>
                <link.icon 
                  size={24} 
                  className={`z-10 transition-colors ${isActive ? "text-white" : "text-[#9F1E22]"}`} 
                  strokeWidth={2.5}
                />
                <span className={`z-10 text-base font-bold hidden md:block transition-colors ${isActive ? "text-white" : "text-[#9F1E22]"}`}>
                  {link.label}
                </span>
                
                {/* Decorative Pill for active state */}
                {isActive && (
                   <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FFD700] hidden md:block" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 mb-4">
        <button
          onClick={() => setIsProfileOpen(true)}
          className="w-full flex flex-col md:flex-row items-center md:gap-4 p-4 rounded-xl hover:bg-[#9F1E22]/10 transition-colors group mb-3"
        >
          <img
            src={user.avatar}
            alt={user.name}
            className="w-6 h-6 rounded-full object-cover border border-[#9F1E22]/20"
          />
          <span className="text-base font-bold text-[#9F1E22] hidden md:block">Profile</span>
        </button>
        <button 
          onClick={handleLogout}
          className="w-full flex flex-col md:flex-row items-center md:gap-4 p-4 rounded-xl hover:bg-[#9F1E22]/10 transition-colors group"
        >
          <LogOut className="text-[#9F1E22]" size={24} strokeWidth={2.5} />
          <span className="text-base font-bold text-[#9F1E22] hidden md:block">Log out</span>
        </button>
      </div>

      {isProfileOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-[#F2E8DC] w-full max-w-xl rounded-2xl shadow-2xl p-8 relative text-[#9F1E22]">
            <button
              onClick={() => setIsProfileOpen(false)}
              className="absolute top-4 right-4 text-[#9F1E22] font-bold"
            >
              ✕
            </button>
            <h2 className="text-2xl font-black mb-6">Edit Profile</h2>

            <div className="flex items-center gap-6 mb-6">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-white">
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
              </div>
              <div className="flex flex-col gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white px-4 py-2 rounded-full shadow-sm font-bold hover:bg-gray-50 border border-[#9F1E22]/20"
                >
                  Upload Photo
                </button>
                <button
                  onClick={() => setProfilePhoto('')}
                  className="bg-white px-4 py-2 rounded-full shadow-sm font-bold hover:bg-gray-50 border border-[#9F1E22]/20"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-bold mb-2">Name</label>
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#9F1E22]/20 bg-white"
                />
              </div>
              <div>
                <label className="block font-bold mb-2">Date of Birth</label>
                <input
                  type="date"
                  value={profileDob}
                  onChange={(e) => setProfileDob(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#9F1E22]/20 bg-white"
                />
              </div>
              <div>
                <label className="block font-bold mb-2">Phone</label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="w-full p-3 rounded-xl border border-[#9F1E22]/20 bg-white"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsProfileOpen(false)}
                className="px-6 py-2 rounded-full border border-[#9F1E22]/20 bg-white font-bold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await updateProfile({
                    name: profileName,
                    date_of_birth: profileDob || null,
                    phone: profilePhone || null,
                    photo: profilePhoto || null,
                  });
                  setIsProfileOpen(false);
                }}
                className="px-6 py-2 rounded-full bg-[#9F1E22] text-white font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
